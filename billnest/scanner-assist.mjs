/** Estimate the 75th percentile luminance of camera pixels (0..255).
 * Bright barcode labels contain dark stripes; using the upper percentile
 * avoids misclassifying their dark bars as poor ambient lighting.
 * Returns null for absent/invalid frames. The camera stream remains local.
 */
export function barcodeSceneBrightness(frame){
 const {data,width,height}=frame||{};
 if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length<width*height*4)return null;
 const buckets=new Uint32Array(16);
 const dx=Math.max(1,Math.floor(width/48)),dy=Math.max(1,Math.floor(height/14));
 let samples=0;
 for(let y=0;y<height;y+=dy){
  for(let x=0;x<width;x+=dx){
   const i=(y*width+x)*4;
   const lum=Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);
   buckets[Math.min(15,lum>>4)]++;samples++;
  }
 }
 const target=Math.ceil(samples*.75);
 let count=0;
 for(let i=0;i<16;i++){count+=buckets[i];if(count>=target)return i*16+8}
 return 0;
}
