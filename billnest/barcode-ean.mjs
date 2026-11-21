/**
 * Small, dependency-free reader for retail EAN-13 / UPC-A / EAN-8 barcodes.
 * Reads dark vertical bars from the camera while optional ZXing loads.
 * A full checksum is mandatory: a guessed/partial code is never accepted.
 */
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const digit=(pattern,table)=>table.indexOf(pattern);
const validCheckDigit=code=>{
  if(!/^\d{8}$|^\d{13}$/.test(code))return false;
  let sum=0,weight=3;
  for(let i=code.length-2;i>=0;i--){sum+=Number(code[i])*weight;weight=weight===3?1:3}
  return (10-sum%10)%10===Number(code.at(-1));
};
export function barcodeAliases(raw){
  const code=String(raw??'').trim();const values=[code];
  // UPC-A is the same physical barcode as EAN-13 prefixed with zero.
  if(/^0\d{12}$/.test(code))values.push(code.slice(1));
  else if(/^\d{12}$/.test(code))values.push('0'+code);
  return values;
}
export function decodeRetailBits(bits){
  if(typeof bits!=='string'||![95,67].includes(bits.length))return '';
  if(!bits.startsWith('101')||!bits.endsWith('101'))return '';
  if(bits.length===95){
    if(bits.slice(45,50)!=='01010')return '';
    let left='',parity='',right='';
    for(let i=0;i<6;i++){
      const pat=bits.slice(3+i*7,10+i*7);
      let d=digit(pat,L);if(d>=0){parity+='L'}else{d=digit(pat,G);parity+='G'}
      if(d<0)return '';left+=d;
    }
    const prefix=PARITY.indexOf(parity);if(prefix<0)return '';
    for(let i=0;i<6;i++){
      const d=digit(bits.slice(50+i*7,57+i*7),R);if(d<0)return '';right+=d;
    }
    const code=String(prefix)+left+right;
    return validCheckDigit(code)?code:'';
  }
  if(bits.slice(31,36)!=='01010')return '';
  let code='';
  for(let i=0;i<4;i++){
    const d=digit(bits.slice(3+i*7,10+i*7),L);if(d<0)return '';code+=d;
  }
  for(let i=0;i<4;i++){
    const d=digit(bits.slice(36+i*7,43+i*7),R);if(d<0)return '';code+=d;
  }
  return validCheckDigit(code)?code:'';
}
function runsFor(binary){
  let runs=[],prev=binary[0],start=0;
  for(let i=1;i<=binary.length;i++){
    if(i===binary.length||binary[i]!==prev){
      runs.push({dark:prev===1,start,end:i,length:i-start});start=i;prev=binary[i];
    }
  }
  return runs;
}
function tryScanline(binary){
  const runs=runsFor(binary),count=runs.length;
  for(let i=0;i<count-2;i++){
    const a=runs[i],b=runs[i+1],c=runs[i+2];
    if(!a.dark||b.dark||!c.dark)continue;
    const approx=(a.length+b.length+c.length)/3;
    if(approx<1.55||approx>16||Math.min(a.length,b.length,c.length)<approx*.48||Math.max(a.length,b.length,c.length)>approx*1.65)continue;
    // The wide quiet zone before the first dark bar is an important guard.
    if(i>0&&!runs[i-1].dark&&runs[i-1].length<approx*1.5)continue;
    for(const modules of [95,67]){
      const from=a.start+(modules*approx*.67),to=a.start+(modules*approx*1.38);
      for(let j=i+3;j<count-2;j++){
        const x=runs[j],y=runs[j+1],z=runs[j+2];
        if(x.start>to)break;
        if(x.start<from||!x.dark||y.dark||!z.dark)continue;
        const width=(z.end-a.start)/modules;
        if(width<1.5||width>16||Math.abs(width-approx)>approx*.37)continue;
        if(Math.min(x.length,y.length,z.length)<width*.48||Math.max(x.length,y.length,z.length)>width*1.65)continue;
        let bits='';
        for(let k=0;k<modules;k++){
          const at=Math.floor(a.start+(k+.5)*width);
          if(at<0||at>=binary.length){bits='';break}
          bits+=binary[at];
        }
        const found=decodeRetailBits(bits);
        if(found)return found;
      }
    }
  }
  return '';
}
/** Decode barcodes in an ImageData from a canvas; no network, DOM or dependencies. */
export function decodeRetailImageData(frame){
  if(!frame?.data||!frame.width||!frame.height)return '';
  const {data,width,height}=frame;
  if(width<190||height<20)return '';
  const positions=[.49,.36,.61,.25,.74,.43,.55];
  for(const fraction of positions){
    const row=Math.max(1,Math.min(height-2,Math.round(height*fraction)));
    const light=new Uint8Array(width),hist=new Uint32Array(256);
    for(let x=0;x<width;x++){
      let lum=0;
      for(const dy of [-1,0,1]){
        const off=((row+dy)*width+x)*4;
        lum+=(data[off]*77+data[off+1]*150+data[off+2]*29)>>8;
      }
      const v=Math.round(lum/3);light[x]=v;hist[v]++;
    }
    let low=0,high=255,acc=0;
    for(let v=0;v<256;v++){acc+=hist[v];if(acc>=width*.025){low=v;break}}
    acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>=width*.025){high=v;break}}
    if(high-low<35)continue; // unfocused or flat-contrast image: do not guess
    const base=(low+high)/2;
    for(const shift of [0,-12,12]){
      const threshold=base+shift,binary=new Uint8Array(width);
      for(let x=1;x<width-1;x++)binary[x]=(light[x-1]+2*light[x]+light[x+1])/4<threshold?1:0;
      binary[0]=light[0]<threshold?1:0;binary[width-1]=light[width-1]<threshold?1:0;
      const code=tryScanline(binary);if(code)return code;
      const reversed=tryScanline(binary.reverse());if(reversed)return reversed;
    }
  }
  return '';
}