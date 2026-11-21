import test from 'node:test';
import assert from 'node:assert/strict';
const L=['0001101','0011001','0010011','0111101','0100011','0101111','0101111','0111011','0110111','0001011'];L[5]='0110001';
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const P=['LLLLLL','LLGLGG','LLGGLG','LGLLGG','LGGLL','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];P[4]='LGLLGG';
const code='0036000291452';const bits='101'+[...code.slice(1,7)].map((d,i)=>(P[+code[0]][i]==='L'?L:G)[+d]).join('')+'01010'+[...code.slice(7)].map(d=>R[+d]).join('')+'101';
const nodes=new Map();const listeners={};
function node(s){if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){return false},contains(){return false}},addEventListener(){},focus(){},scrollTo(){}});return nodes.get(s)}
const video=node('#scannerVideo');Object.assign(video,{readyState:4,videoWidth:1100,videoHeight:720,play:async()=>{},pause:()=>{},srcObject:null});
const status=node('#scannerStatus');status.dataset={};
const imageData=(w,h)=>{
 const data=new Uint8ClampedArray(w*h*4),module=5,start=Math.round((w-95*module)/2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const m=Math.floor((x-start)/module);const v=m>=0&&m<bits.length&&bits[m]==='1'?25:250;const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255}
 return {width:w,height:h,data};
};
const createElement=tag=>tag==='canvas'?{width:0,height:0,getContext(){return {drawImage(){},getImageData(_x,_y,w,h){return imageData(w,h)}}}}:node(tag);
globalThis.document={querySelector:node,createElement,head:{appendChild(){}},body:{classList:{add(){},remove(){}},appendChild(){}},addEventListener:(name,fn)=>listeners[name]=fn};
globalThis.window={scrollTo(){},addEventListener(){},print(){}};
globalThis.isSecureContext=true;
const stream={getTracks(){return [track]},getVideoTracks(){return [track]}};
const track={stop(){},getCapabilities(){return {}},getSettings(){return {width:1100,height:720}},applyConstraints:async()=>{}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>stream,enumerateDevices:async()=>[]},vibrate(){}},configurable:true});
globalThis.BarcodeDetector=class {static async getSupportedFormats(){return ['ean_13']}async detect(){return []}};
const settings={businessName:'Test Shop',owner:'',state:'',invoicePrefix:'INV',nextInvoice:1,taxMode:'exclusive',termsAndConditions:'',invoiceThankYou:'Thank you',invoiceFooterNote:''};
const items=new Map([['billnest-workspace-v1',JSON.stringify({version:1,demo:false,settings,products:[{id:'p1',name:'Scan Test Product',sku:'TESTSCAN',barcode:'036000291452',stock:10,lowStock:1,unit:'pcs',price:100,cost:50,gst:0,category:'Test'}],customers:[],invoices:[],movements:[],accounting:{opening:{cash:0,bank:0},entries:[]}})]]);
globalThis.localStorage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
await import('../app.js');
function go(page){listeners.click({target:{closest:q=>q==='[data-go]'?{dataset:{go:page}}:null},preventDefault(){}})}
function act(action){listeners.click({target:{closest:q=>q==='[data-action]'?{dataset:{action}}:null},preventDefault(){}})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('Local camera recognizes a pixel barcode when native detector returns nothing, with UPC alias',async()=>{
 go('billing');act('scan-billing');
 await sleep(700);
 assert.match(node('#main').innerHTML,/Scan Test Product/);
 assert.match(node('#main').innerHTML,/1 items/);
 await sleep(1900);
 assert.match(node('#main').innerHTML,/1 items/,'keeping the same barcode visible must not duplicate cart quantity');
 act('close-scanner');
 assert.equal(node('#scannerLayer').innerHTML,'');
});