import test from 'node:test';
import assert from 'node:assert/strict';
import {barcodeSceneBrightness} from '../scanner-assist.mjs';
function pixels(width,height,fn){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const v=fn(x,y),i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
 }
 return {data,width,height};
}
test('detects dark camera images for automatic light',()=>{
 assert.ok(barcodeSceneBrightness(pixels(100,40,()=>35))<105);
 assert.ok(barcodeSceneBrightness(pixels(100,40,()=>125))>=105);
});
test('white barcode label with dark bars is not mistaken for dark lighting',()=>{
 const brightLabel=pixels(150,60,(x)=>x%4<2?10:250);
 assert.ok(barcodeSceneBrightness(brightLabel)>160);
});
test('graceful handling of invalid frames',()=>{
 assert.equal(barcodeSceneBrightness(null),null);
 assert.equal(barcodeSceneBrightness({width:4,height:4,data:new Uint8Array(2)}),null);
});
