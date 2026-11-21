import test from 'node:test';
import assert from 'node:assert/strict';
import {barcodeAliases, decodeRetailBits, decodeRetailImageData} from '../barcode-ean.mjs';
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1010000','1010000','1000100','1001000','1110100']; R[5]='1001110';
const P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function checksum(s){let sum=0,weight=3;for(let i=s.length-1;i>=0;i--){sum+=Number(s[i])*weight;weight=weight===3?1:3}return String((10-sum%10)%10)}
function makeBits(code){
 if(code.length===13){const p=P[+code[0]];return '101'+[...code.slice(1,7)].map((d,i)=>p[i]==='L'?L[+d]:G[+d]).join('')+'01010'+[...code.slice(7)].map(d=>R[+d]).join('')+'101'}
 if(code.length===8)return '101'+[...code.slice(0,4)].map(d=>L[+d]).join('')+'01010'+[...code.slice(4)].map(d=>R[+d]).join('')+'101';
 throw Error('bad code length');
}
function frame(bits,{module=4,width=1100,height=120,flip=false}={}){
 const data=new Uint8ClampedArray(width*height*4);const start=Math.round((width-bits.length*module)/2);
 const mono=[];for(let x=0;x<width;x++){let m=Math.floor((x-start)/module);const black=m>=0&&m<bits.length&&bits[m]==='1';mono.push(black?20:240)}
 if(flip)mono.reverse();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=mono[x];data[k+3]=255}
 return {data,width,height};
}
test('EAN-13 bit recognition and strong checksum validation',()=>{
 const code='5901234123457',b=makeBits(code);
 assert.equal(decodeRetailBits(b),code);
 assert.equal(decodeRetailBits(b.replace(/.$/,'0')),'');
 assert.equal(decodeRetailBits(b.slice(0,94)),'');
});
test('Retail scans from an actual pixel buffer at 3 and 6px module sizes',()=>{
 const code='5901234123457';
 for(const module of [3,4,6])assert.equal(decodeRetailImageData(frame(makeBits(code),{module})),code,`module ${module}`);
});
test('Photo and camera scans support reversed barcode direction',()=>{
 const code='5901234123457';
 assert.equal(decodeRetailImageData(frame(makeBits(code),{flip:true})),code);
});
test('EAN-8 and UPC-A equivalents remain recognizable',()=>{
 const ean8='1234567'+checksum('1234567');
 assert.equal(decodeRetailImageData(frame(makeBits(ean8))),ean8);
 const upc='03600029145'+checksum('03600029145');
 const ean13='0'+upc;
 assert.equal(decodeRetailImageData(frame(makeBits(ean13))),ean13);
 assert.deepEqual(barcodeAliases(upc),[upc,ean13]);
 assert.deepEqual(barcodeAliases(ean13),[ean13,upc]);
});
test('No fabricated barcode from blank, noise or invalid checksum',()=>{
 const blank=frame('0'.repeat(95));
 assert.equal(decodeRetailImageData(blank),'');
 assert.equal(decodeRetailBits(makeBits('5901234123458')),'');
});
test('cover camera crop matches full-width phone preview', async()=>{
 const {coverCameraRect}=await import('../barcode-ean.mjs');
 assert.deepEqual(coverCameraRect(720,1280,360,300),{sx:0,sy:340,sw:720,sh:600});
 assert.deepEqual(coverCameraRect(1920,1080,300,450),{sx:600,sy:0,sw:720,sh:1080});
});
test('full-frame scan can recognize barcode near the lower preview edge',()=>{
 const code='5901234123457',bits=makeBits(code);
 const width=1100,height=600,module=4,start=Math.round((width-bits.length*module)/2);
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const m=Math.floor((x-start)/module);
  const black=y>height*.84&&y<height*.94&&m>=0&&m<bits.length&&bits[m]==='1';
  const pos=(y*width+x)*4;
  data[pos]=data[pos+1]=data[pos+2]=black?20:240;
  data[pos+3]=255;
 }
 assert.equal(decodeRetailImageData({data,width,height}),code);
});
