import test from 'node:test';
import assert from 'node:assert/strict';

// The only camera hardware capabilities exposed in browsers are optional.
// Exercise a simulated phone that supports single-shot focus and torch,
// while leaving the native BarcodeDetector unable to recognize any code.
const code='0036000291452';
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];L[5]='0110001';
const G=['0100111','0110011','0011011','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const bits='101'+[...code.slice(1,7)].map(d=>L[+d]).join('')+'01010'+[...code.slice(7)].map(d=>R[+d]).join('')+'101';
const nodes=new Map(),listeners={};
function node(s){if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{add(){},remove(){},toggle(){return false},contains(){return false}},addEventListener(){},focus(){},scrollTo(){},setAttribute(){}});return nodes.get(s)}
const video=node('#scannerVideo');Object.assign(video,{readyState:4,videoWidth:1100,videoHeight:720,play:async()=>{},pause:()=>{},srcObject:null});
let imageMode='dark';
function imageData(w,h){
 const data=new Uint8ClampedArray(w*h*4),module=5,start=Math.floor((w-95*module)/2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const m=Math.floor((x-start)/module);
  const value=imageMode==='dark'?22:m>=0&&m<bits.length&&bits[m]==='1'?25:250;
  const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 return {data,width:w,height:h};
}
const createElement=tag=>tag==='canvas'?{width:0,height:0,getContext(){return {drawImage(){},getImageData(_x,_y,w,h){return imageData(w,h)}}}}:node(tag);
globalThis.document={querySelector:node,createElement,head:{appendChild(){}},body:{classList:{add(){},remove(){}},appendChild(){}},addEventListener:(name,cb)=>listeners[name]=cb};
globalThis.window={scrollTo(){},addEventListener(){},print(){}};
globalThis.isSecureContext=true;
const commands=[];
const track={stop(){},getCapabilities(){return {torch:true,focusMode:['single-shot']}},getSettings(){return {width:1100,height:720}},async applyConstraints(c){commands.push(c)}};
const stream={getTracks(){return [track]},getVideoTracks(){return [track]}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>stream,enumerateDevices:async()=>[]},vibrate(){}},configurable:true});
globalThis.BarcodeDetector=class {static async getSupportedFormats(){return ['ean_13']}async detect(){return []}};
globalThis.ZXingBrowser={BrowserMultiFormatReader:class {decodeFromStream(){return Promise.resolve({stop(){}})}}};
const items=new Map([['billnest-workspace-v1',JSON.stringify({version:1,demo:false,settings:{businessName:'Shop',state:'',invoicePrefix:'INV',nextInvoice:1,taxMode:'exclusive'},products:[{id:'p1',name:'Autofocus Product',sku:'SCAN1',barcode:'036000291452',stock:10,lowStock:1,unit:'pcs',price:100,cost:60,gst:0}],customers:[],invoices:[],movements:[],accounting:{opening:{cash:0,bank:0},entries:[]}})]]);
globalThis.localStorage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};
await import('../app.js');
function go(page){listeners.click({target:{closest:q=>q==='[data-go]'?{dataset:{go:page}}:null},preventDefault(){}})}
function act(action){listeners.click({target:{closest:q=>q==='[data-action]'?{dataset:{action}}:null},preventDefault(){}})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function hasTorch(v){return commands.some(c=>c.advanced?.some(x=>x.torch===v))}
function focusCount(){return commands.filter(c=>c.advanced?.some(x=>x.focusMode==='single-shot')).length}
test('automatically focuses, lights dark barcode, and keeps scanning until a valid read',async()=>{
 go('billing');act('scan-billing');
 try{
  await sleep(2100);
  assert.ok(focusCount()>=1,'initial single-shot autofocus requested');
  assert.equal(node('#scannerTorch').hidden,false,'auto light control visible');
  assert.ok(hasTorch(true),'flashlight enables in sustained low light');
  assert.doesNotMatch(node('#main').innerHTML,/1 items/,'still waiting when code is unreadable');
  act('scanner-torch'); // Auto -> On
  await sleep(50);
  act('scanner-torch'); // On -> Off
  await sleep(80);
  assert.ok(hasTorch(false),'user can turn off the light');
  assert.match(node('#scannerTorch').textContent,/Off/);
  await sleep(2150);
  assert.ok(focusCount()>=2,'single-shot focus retried without restarting the camera');
  assert.match(node('#scannerTorch').textContent,/Off/,'manual override survives dark conditions');
  imageMode='barcode';
  await sleep(900);
  assert.match(node('#main').innerHTML,/1 items/,'eventually finds barcode without a user retry');
  await sleep(1650);
  assert.match(node('#main').innerHTML,/1 items/,'does not add repeated copies of a held barcode');
 }finally{act('close-scanner')}
 assert.equal(node('#scannerLayer').innerHTML,'');
});
