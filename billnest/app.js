import {toPaise,rupees,money,today,calculateInvoice,summarizeProfit,expiryStatus,escapeHtml as e,csvEncode} from './logic.mjs';
import {invoiceOutstanding,makeAccountingSummary,ACCOUNT_TYPES} from './accounting.mjs';
import {barcodeAliases,decodeRetailImageData,coverCameraRect} from './barcode-ean.mjs';
import {barcodeSceneBrightness} from './scanner-assist.mjs';
import {isValidUpiId,buildUpiIntent} from './upi.mjs';

const STORE_KEY = 'billnest-workspace-v1';
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
const PAGES = [
 ['dashboard','Dashboard','▦'],['billing','Billing','▧'],['inventory','Inventory','▤'],['sales','Invoices & Sales','▤'],['customers','Customers','♙'],['accounting','Accounting','₹'],['reports','Reports','▥'],['settings','Settings','⚙']
];
const ICON_PATHS = {
 billing:'<rect x="4" y="3" width="16" height="19" rx="2"/><path d="M8 8h8M8 12h8M8 16h3m4 0h1"/>',
 add:'<path d="M4 8V4h16v4M4 13v7h16v-7M12 7v12M7 13h10"/>',
 accounting:'<path d="M3 10 12 4l9 6M5 10v10m5-10v10m4-10v10m5-10v10M3 21h18M3 10h18"/>',
 sales:'<path d="M4 20V12m5 8V8m5 12v-5m5 5V4"/>',
 products:'<path d="M4 7 12 3l8 4-8 4-8-4ZM4 7v10l8 4 8-4V7M12 11v10"/>',
 warning:'<path d="m12 3 10 18H2L12 3Zm0 7v4m0 3h.01"/>',
 stock:'<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3M4 14h16"/>',
 expiry:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-9 3v4m-2-2h4"/>',
 dashboard:'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
 customers:'<circle cx="8" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M18 9a3 3 0 0 1 0 6m-1 2a4 4 0 0 1 5 4"/>',
 reports:'<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/>',
 settings:'<path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1"/><circle cx="12" cy="12" r="4"/>'
};
const icon3D = type => `<svg class="icon-3d-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[type]||ICON_PATHS.products}</svg>`;
const navIcon = page => icon3D(page==='inventory'?'products':page==='sales'?'billing':page);
const $ = s => document.querySelector(s);
const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const emptyDb = () => ({version:1,demo:false,settings:{businessName:'My Store',owner:'',phone:'',email:'',address:'',state:'',gstin:'',invoicePrefix:'INV',nextInvoice:1,taxMode:'exclusive',termsAndConditions:'',invoiceThankYou:'Thank you for your business!',invoiceFooterNote:'Invoice generated with BillNest',logoDataUrl:'',logoKey:'',upiId:''},logoAssets:{},products:[],customers:[],invoices:[],movements:[],accounting:{opening:{cash:0,bank:0},entries:[]}});
const localDay = d => today(d);
const dateFromDay = day => {const [y,m,d]=day.split('-').map(Number);return new Date(y,m-1,d)};
const shiftDay = (day,n) => {const d=dateFromDay(day);d.setDate(d.getDate()+n);return localDay(d)};
function sampleDb(){
 const d=emptyDb(); d.demo=true;
 d.settings={...d.settings,businessName:'Sample General Store',phone:'98765 43210',address:'Main Market, Patna',state:'Bihar'};
 const raw=[['P-1001','A4 Notebook','Stationery',85,48,74,10,5],['P-1002','Ball Pen Pack','Stationery',60,30,42,10,18],['P-1003','Desk Organizer','Accessories',349,215,21,5,18],['P-1004','Steel Water Bottle','Home & Living',499,310,13,5,18],['P-1005','Sticky Notes','Stationery',99,50,6,10,18],['P-1006','LED Desk Lamp','Electronics',899,610,4,5,18],['P-1007','Canvas Tote Bag','Accessories',249,125,31,8,5],['P-1008','Marker Set','Stationery',179,92,0,5,18]];
 d.products=raw.map(([sku,name,category,price,cost,stock,lowStock,gst])=>({id:uid(),sku,name,category,price,cost,stock,lowStock,gst,unit:'pcs',createdAt:new Date().toISOString()}));
 d.customers=[{id:uid(),name:'Priya Sharma',phone:'90000 00001',email:'',address:'Patna',state:'Bihar',gstin:''},{id:uid(),name:'Rahul Enterprises',phone:'90000 00002',email:'',address:'Guwahati',state:'Assam',gstin:''},{id:uid(),name:'Aman Verma',phone:'90000 00003',email:'',address:'Patna',state:'Bihar',gstin:''}];
 [[-6,0,2,0],[-4,1,3,1],[-2,2,1,2],[-1,0,1,0],[0,3,1,1]].forEach(([offset,idx,qty,cidx])=>{
   const item=d.products[idx];const customer=d.customers[cidx];const total=calculateInvoice([{productId:item.id,qty}],Object.fromEntries(d.products.map(p=>[p.id,p])),0,d.settings,customer);
   const date=shiftDay(today(),offset),number=`INV-${String(d.settings.nextInvoice++).padStart(4,'0')}`;
   item.stock-=qty;
   d.invoices.push({id:uid(),number,date,customer:{...customer},business:{...d.settings},payment:idx%2?'UPI':'Cash',paid:true,notes:'Sample invoice',...total,createdAt:new Date(date+'T12:00:00').toISOString(),demo:true});
 });
 return d;
}
function normaliseAccounting(value){
 const obj=value&&typeof value==='object'?value:{};
 const opening=obj.opening&&typeof obj.opening==='object'?obj.opening:{};
 const valid=value=>Number.isSafeInteger(value)&&Math.abs(value)<=1_000_000_000_00;
 return {opening:{cash:valid(opening.cash)?opening.cash:0,bank:valid(opening.bank)?opening.bank:0},entries:Array.isArray(obj.entries)?obj.entries.filter(row=>row&&typeof row==='object'&&typeof row.id==='string').slice(0,100000):[]};
}
function readDb(){try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return sampleDb();const data=JSON.parse(raw);if(!data || data.version!==1 || !Array.isArray(data.products)||!Array.isArray(data.invoices)||!Array.isArray(data.customers))throw Error('Unsupported data');return {...emptyDb(),...data,settings:{...emptyDb().settings,...data.settings},accounting:normaliseAccounting(data.accounting)};}catch(err){console.warn('Could not read existing workspace:',err);return emptyDb()}}
let db=readDb();
const pageFromHash = () => {const page=(globalThis.location?.hash||'').replace(/^#\/?/,'').split('/')[0].toLowerCase();return PAGES.some(p=>p[0]===page)?page:'dashboard'};
let ui={page:pageFromHash(),search:'',filter:'all',salesSearch:'',customerSearch:'',reportRange:'30',profitRange:'30',profitSearch:'',accountingRange:'30',accountingSearch:'',modal:null,editId:null,cart:[],billingSearch:'',billingCustomer:'',discount:0,payment:'Cash',billNotes:'',invoiceId:null,scanCode:'',addAfterScan:false};
let toastTimer;
const productsMap = () => Object.fromEntries(db.products.map(p=>[p.id,p]));
const cleanBarcode = code => String(code??'').trim().slice(0,80);
// Permit only reasonably sized raster image data URLs from the logo editor or a restored backup.
// SVG and remote images are intentionally excluded from invoices.
const safeLogoUrl = value => typeof value==='string' && value.length<=420_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value) ? value : '';
const logoMarkup = (source, klass='invoice-logo') => {const safe=safeLogoUrl(source);return safe?`<img class="${klass}" src="${safe}" alt="Business logo">`:''};
const logoKeyFor = data => {
 let hash=2166136261;
 for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
 return `logo-${(hash>>>0).toString(36)}-${data.length}`;
};
const resolveBusinessLogo = business => safeLogoUrl(business?.logoDataUrl)||safeLogoUrl(db.logoAssets?.[business?.logoKey])||'';
let pendingLogo=null; // null means unchanged; empty string explicitly removes it.
const effectiveLogo = () => pendingLogo===null?resolveBusinessLogo(db.settings):pendingLogo;
function paintLogoPreview(){
 const preview=$('#businessLogoPreview');if(preview)preview.innerHTML=logoMarkup(effectiveLogo(),'business-logo-preview-image')||'<span class="business-logo-placeholder" aria-hidden="true">▣</span>';
 const state=$('#businessLogoState');if(state)state.textContent=pendingLogo===null?'Logo is saved with your business details.':pendingLogo?'New logo selected. Click Save settings to apply.':'Logo will be removed when you save settings.';
 const remove=$('#removeBusinessLogo');if(remove)remove.hidden=!safeLogoUrl(effectiveLogo());
}
async function convertBusinessLogo(file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Use a PNG, JPG or WebP image. SVG files are not supported.','error');return}
 if(file.size>4_000_000){toast('Choose a logo image smaller than 4 MB.','error');return}
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not read this image.'));img.src=url});
  if(!img.naturalWidth||!img.naturalHeight)throw Error('The image has no valid dimensions.');
  const ratio=Math.min(1,360/img.naturalWidth,180/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*ratio)),h=Math.max(1,Math.round(img.naturalHeight*ratio));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing is not available in this browser.');
  ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
  let result=canvas.toDataURL('image/png');
  if(result.length>300_000){result=canvas.toDataURL('image/webp',0.82)}
  if(result.length>300_000){ctx.fillStyle='#fff';ctx.globalCompositeOperation='destination-over';ctx.fillRect(0,0,w,h);result=canvas.toDataURL('image/jpeg',0.75)}
  if(!safeLogoUrl(result))throw Error('Logo is too large to store. Please use a simpler image.');
  pendingLogo=result;paintLogoPreview();toast('Logo ready. Save settings to apply it to future invoices.');
 }catch(error){toast(error.message||'Could not prepare logo.','error')}
 finally{URL.revokeObjectURL(url);const input=$('#businessLogoFile');if(input)input.value=''}
}

const matchBarcode = code => {
 // UPC-A is often reported as EAN-13 (with a leading zero) by phone cameras.
 // Compare both valid representations without stripping other significant zeroes.
 const lookup=new Set(barcodeAliases(cleanBarcode(code)).map(x=>x.toLowerCase()));
 return [...lookup].some(Boolean) ? db.products.find(p=>[p.barcode,p.sku].some(value=>barcodeAliases(value).some(x=>lookup.has(x.toLowerCase())))) : undefined;
};
// The camera API can only request capabilities. Minimum physical focus distance
// depends on the phone and which rear lens it exposes to the browser.
const SCANNABLE_FORMATS = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','code_93','itf','codabar','qr_code','data_matrix'];
const scanner = {
 open:false,mode:'billing',session:0,stream:null,controls:null,timer:null,engineTimer:null,
 busy:false,last:'',lastSeenAt:0,engine:'',facing:'environment',torch:false,switching:false,
 deviceId:'',cameras:[],zoom:1,zoomRange:null,misses:0,cropCanvas:null,localCanvas:null,localTimer:null,localScans:0,
 focusTimer:null,focusMode:'device',lastFocusAt:0,lastReadAt:0,lightMode:'auto',torchAvailable:false,torchBusy:false,torchFailed:false,lightDimSamples:0,lightCheckedAt:0
};
const scannerStatus = (message,type='info') => {const el=$('#scannerStatus');if(el){el.textContent=message;el.dataset.state=type}};
function releaseScannerCamera(){
 scanner.session++;
 clearTimeout(scanner.timer);clearTimeout(scanner.engineTimer);clearTimeout(scanner.localTimer);clearTimeout(scanner.focusTimer);
 scanner.timer=null;scanner.engineTimer=null;scanner.localTimer=null;scanner.focusTimer=null;scanner.busy=false;scanner.switching=false;
 try{scanner.controls?.stop?.()}catch(err){console.warn('Scanner stop:',err)}scanner.controls=null;
 scanner.stream?.getTracks?.().forEach(track=>track.stop());scanner.stream=null;
 const vid=$('#scannerVideo');if(vid){try{vid.pause?.()}catch{}vid.srcObject=null}
 scanner.engine='';scanner.torch=false;scanner.torchAvailable=false;scanner.torchBusy=false;scanner.torchFailed=false;scanner.lightDimSamples=0;scanner.lightCheckedAt=0;scanner.zoomRange=null;scanner.misses=0;scanner.cropCanvas=null;scanner.localCanvas=null;scanner.localScans=0;scanner.focusMode='device';scanner.lastFocusAt=0;scanner.lastReadAt=0;
}
function stopScanner(){
 scanner.open=false;releaseScannerCamera();
 const layer=$('#scannerLayer');if(layer)layer.innerHTML='';
 document.body.classList.remove('scanner-open');
}
function scannerMarkup(mode){
 const title=mode==='inventory'?'Scan to find or add stock':mode==='product'?'Scan product barcode':'Scan items for billing';
 const desc=mode==='billing'?'Scan an item to add one unit to the bill.':mode==='inventory'?'Known codes open products. Unknown codes start a new product.':'Scanning fills the product barcode field.';
 return `<div class="scanner-overlay" role="dialog" aria-modal="true" aria-label="Barcode scanner"><div class="scanner-panel">
 <div class="scanner-top"><div><span class="scanner-eyebrow">BILLNEST SCANNER</span><h2>${title}</h2><p>${desc}</p></div><button type="button" class="scanner-close" data-action="close-scanner" aria-label="Close scanner">×</button></div>
 <div class="scanner-preview"><video id="scannerVideo" muted playsinline autoplay aria-label="Live barcode camera preview"></video><div class="scanner-guide" aria-hidden="true"><span></span></div><span class="scanner-camera-label">Hold still • Keep the complete barcode in view</span></div>
 <p id="scannerStatus" class="scanner-status" role="status" aria-live="polite">Opening rear camera…</p>
 <div class="scanner-optics"><div id="scannerCameraWrap" class="scanner-camera-pick" hidden><label for="scannerCamera">Camera lens (choose Macro for close labels)</label><select id="scannerCamera" aria-label="Choose camera lens"></select></div><div id="scannerZoomWrap" class="scanner-zoom" hidden><div><label for="scannerZoom">Zoom</label><output id="scannerZoomValue" for="scannerZoom">1.0×</output></div><input id="scannerZoom" type="range" min="1" max="2" step="0.1" value="1" aria-label="Camera optical or digital zoom"></div></div>
 <div class="scanner-actions"><button type="button" class="btn" data-action="scanner-focus">◎ Refocus</button><button type="button" class="btn" data-action="scanner-switch">↻ Switch</button><button type="button" class="btn" data-action="scanner-torch" id="scannerTorch" title="Tap to cycle Auto, On, Off" hidden>⚡ Light: Auto</button><button type="button" class="btn" data-action="scanner-retry">Retry</button></div>
 <label class="scanner-photo-button" for="barcodePhoto">📷 Scan from photo / camera</label><input class="scanner-photo-input" id="barcodePhoto" type="file" accept="image/*" aria-label="Scan barcode from a photo or camera">
 <p class="scanner-photo-hint">Scanning continues until a code is found or you close the camera. Autofocus and automatic light work on supported phones. Tap Light to cycle Auto, On and Off. If the image is blurry, try Refocus, adjust the distance, or Scan from photo.</p>
 <form id="scanManualForm" class="scanner-manual-form"><label for="manualBarcode">Enter the barcode manually</label><div class="scanner-manual-row"><input id="manualBarcode" name="barcode" placeholder="EAN, UPC, barcode or SKU" autocomplete="off" autocapitalize="off" inputmode="text" maxlength="80" required><button class="btn btn-primary" type="submit">Use code</button></div></form>
 <p class="scanner-hint">HTTPS and camera permission are required. Your camera video is not uploaded. Barcode prices and product details come from your own inventory.</p>
 </div></div>`;
}
function openScanner(mode='billing'){
 if(scanner.open)stopScanner();
 scanner.open=true;scanner.mode=mode;scanner.last='';scanner.lastSeenAt=0;scanner.facing='environment';scanner.deviceId='';scanner.zoom=1;scanner.lightMode='auto';
 $('#scannerLayer').innerHTML=scannerMarkup(mode);
 document.body.classList.add('scanner-open');
 startScannerCamera();
}
function barcodeFound(raw,explicit=false){
 if(!scanner.open)return;
 const code=cleanBarcode(raw);if(!code)return;
 const when=Date.now();
 // Do not bill the same visible barcode on every video frame.
 // While the same label remains in view, suppress duplicate billing. To scan
 // another unit of the same product, move the label out of view for ~1.5s.
 const sameLabel=barcodeAliases(code).some(value=>barcodeAliases(scanner.last).includes(value));
 if(!explicit&&sameLabel&&when-scanner.lastSeenAt<1500){scanner.lastSeenAt=when;return}
 scanner.last=code;scanner.lastSeenAt=when;scanner.lastReadAt=when;
 if(scanner.mode==='product'){
  stopScanner();const input=$('#barcode');if(input){input.value=code;input.focus()}
  const sku=$('#sku');if(sku&&!sku.value.trim())sku.value=code.slice(0,40);
  toast('Barcode captured. Finish entering product details.');return;
 }
 const product=matchBarcode(code);
 if(scanner.mode==='inventory'){
  stopScanner();if(product){navigate('inventory');openModal('product',product.id);toast('Product found by barcode.')}else{ui.scanCode=code;ui.addAfterScan=false;openModal('product');toast('New barcode. Add the product details.')}return;
 }
 if(product){
  const current=ui.cart.find(line=>line.productId===product.id);
  if(product.stock<=0||(current&&current.qty>=product.stock)){scannerStatus(`${product.name} has no more available stock.`,'error');return}
  if(current)current.qty++;else ui.cart.push({productId:product.id,qty:1});
  scannerStatus(`✓ ${product.name} added to bill. Move the barcode away before scanning it again.`,'success');
  if(navigator.vibrate)navigator.vibrate(65);
  render();return;
 }
 stopScanner();ui.scanCode=code;ui.addAfterScan=true;openModal('product');
 toast('This barcode is new. Add the product to continue billing.');
}
let fallbackLoader;
function loadBarcodeLibrary(){
 if(globalThis.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve(globalThis.ZXingBrowser);
 if(fallbackLoader)return fallbackLoader;
 // Two CDNs, with timeouts: blocked CDN must not leave the camera stuck on "Loading".
 const urls=['https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js','https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js'];
 const load=url=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');let finished=false;
  const complete=(error)=>{if(finished)return;finished=true;clearTimeout(timeout);if(error){script.remove();reject(error)}else resolve(globalThis.ZXingBrowser)};
  const timeout=setTimeout(()=>complete(new Error('Barcode decoder download timed out')),8500);
  script.async=true;script.src=url;
  script.onload=()=>globalThis.ZXingBrowser?.BrowserMultiFormatReader?complete():complete(new Error('Barcode decoder did not initialize'));
  script.onerror=()=>complete(new Error('Barcode decoder could not load'));
  document.head.appendChild(script);
 });
 fallbackLoader=(async()=>{
  let lastError;
  for(const url of urls){try{return await load(url)}catch(err){lastError=err}}
  throw lastError||new Error('Barcode decoder unavailable');
 })().catch(err=>{fallbackLoader=null;throw err});
 return fallbackLoader;
}
function scannerCameraTrack(){return scanner.stream?.getVideoTracks?.()[0]||$('#scannerVideo')?.srcObject?.getVideoTracks?.()[0]||null}
function updateScannerLightButton(){
 const button=$('#scannerTorch');if(!button)return;
 const value=scanner.lightMode==='auto'?'Auto':scanner.lightMode==='on'?'On':'Off';
 button.textContent=`⚡ Light: ${value}`;
 button.title='Tap to cycle automatic, always on, and off';
 button.setAttribute?.('aria-label',`Flashlight ${value}. Tap to change mode`);
}
async function setScannerTorch(enabled,session=scanner.session){
 const track=scannerCameraTrack();
 if(!scanner.open||session!==scanner.session||!scanner.torchAvailable||scanner.torchFailed||scanner.torchBusy||!track?.applyConstraints)return false;
 if(scanner.torch===enabled)return true;
 scanner.torchBusy=true;
 try{
  await track.applyConstraints({advanced:[{torch:enabled}]});
  if(session===scanner.session&&scanner.open){
   scanner.torch=enabled;
   if(enabled&&scanner.lightMode==='auto')scannerStatus('Low light detected. Flashlight on; scanning continues.');
  }
  return true;
 }catch(err){
  if(session===scanner.session&&scanner.open){
   scanner.torchFailed=true;
   scannerStatus('Camera torch is unavailable on this browser. Keep the barcode well lit or use photo scanning.','error');
  }
  return false;
 }finally{if(session===scanner.session)scanner.torchBusy=false}
}
function autoAdjustScannerLight(frame,session){
 if(!scanner.open||scanner.session!==session||scanner.lightMode!=='auto'||!scanner.torchAvailable||scanner.torch||scanner.torchFailed)return;
 const now=Date.now();if(now-scanner.lightCheckedAt<650)return;
 scanner.lightCheckedAt=now;
 // Use high-percentile luminance so the black barcode stripes do not
 // mistakenly trigger the light against a bright white label.
 const light=barcodeSceneBrightness(frame);
 if(light===null)return;
 scanner.lightDimSamples=light<105?scanner.lightDimSamples+1:0;
 if(scanner.lightDimSamples>=3){scanner.lightDimSamples=0;setScannerTorch(true,session)}
}
async function requestScannerFocus(session=scanner.session){
 if(!scanner.open||scanner.session!==session||!scanner.stream)return;
 const track=scannerCameraTrack();if(!track?.applyConstraints)return;
 try{
  const caps=track.getCapabilities?.()||{};
  const modes=Array.isArray(caps.focusMode)?caps.focusMode:[];
  const mode=modes.includes('continuous')?'continuous':modes.includes('single-shot')?'single-shot':null;
  if(!mode)return;
  await track.applyConstraints({advanced:[{focusMode:mode}]});
  if(scanner.session===session){scanner.focusMode=mode;scanner.lastFocusAt=Date.now()}
 }catch(err){console.info('Autofocus is controlled by camera hardware:',err)}
}
function startScannerFocusLoop(session){
 clearTimeout(scanner.focusTimer);
 // Continuous autofocus is hardware-managed. For single-shot devices, retry
 // when the barcode has not been detected. Never restart the camera stream.
 const tick=()=>{
  if(!scanner.open||scanner.session!==session)return;
  if(scanner.focusMode==='single-shot'&&Date.now()-scanner.lastReadAt>3500)requestScannerFocus(session);
  scanner.focusTimer=setTimeout(tick,4000);
 };
 scanner.focusTimer=setTimeout(tick,4000);
}
function scannerCameraConstraints(){
 return {audio:false,video:{...(scanner.deviceId?{deviceId:{exact:scanner.deviceId}}:{facingMode:{ideal:scanner.facing}}),width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}}};
}
async function configureScannerTrack(){
 const track=scannerCameraTrack();if(!track)return;
 let caps={};try{caps=track.getCapabilities?.()||{}}catch{}
 scanner.torchAvailable=Boolean(caps.torch) && typeof track.applyConstraints==='function';
 const torchButton=$('#scannerTorch');if(torchButton){torchButton.hidden=!scanner.torchAvailable;updateScannerLightButton()}
 // Only request supported focusing features. Never let an unsupported constraint
 // prevent the basic camera stream from working.
 const focusModes=Array.isArray(caps.focusMode)?caps.focusMode:[];
 scanner.focusMode='device';
 if(focusModes.includes('continuous')){
  try{await track.applyConstraints?.({advanced:[{focusMode:'continuous'}]});scanner.focusMode='continuous';scanner.lastFocusAt=Date.now()}catch(err){console.info('Continuous autofocus unavailable:',err)}
 }
 if(scanner.focusMode==='device'&&focusModes.includes('single-shot')){
  try{await track.applyConstraints?.({advanced:[{focusMode:'single-shot'}]});scanner.focusMode='single-shot';scanner.lastFocusAt=Date.now()}catch(err){console.info('Single-shot focus unavailable:',err)}
 }
 startScannerFocusLoop(scanner.session);
 if(scanner.lightMode==='on'&&scanner.torchAvailable)await setScannerTorch(true,scanner.session);
 const zoomWrap=$('#scannerZoomWrap'),slider=$('#scannerZoom'),output=$('#scannerZoomValue');
 const zoom=caps.zoom;
 if(zoomWrap&&slider&&zoom&&Number.isFinite(zoom.min)&&Number.isFinite(zoom.max)&&zoom.max>zoom.min){
  scanner.zoomRange={min:zoom.min,max:zoom.max};
  slider.min=String(zoom.min);slider.max=String(Math.min(zoom.max,5));
  slider.step=String(Number.isFinite(zoom.step)&&zoom.step>0?zoom.step:0.1);
  scanner.zoom=Math.max(zoom.min,Math.min(Math.min(zoom.max,5),scanner.zoom));
  slider.value=String(scanner.zoom);
  if(output)output.textContent=scanner.zoom.toFixed(1)+'×';
  zoomWrap.hidden=false;
 }else if(zoomWrap){zoomWrap.hidden=true;scanner.zoomRange=null}
 const settings=track.getSettings?.()||{};
 const video=$('#scannerVideo');
 if(video&&settings.width&&settings.height)video.dataset.resolution=`${settings.width}×${settings.height}`;
}
async function listScannerCameras(session){
 if(!scanner.open||session!==scanner.session||!navigator.mediaDevices?.enumerateDevices)return;
 try{
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput');
  if(!scanner.open||session!==scanner.session)return;
  scanner.cameras=devices;
  const select=$('#scannerCamera'),wrap=$('#scannerCameraWrap');
  if(!select||!wrap)return;
  wrap.hidden=devices.length<2;
  select.innerHTML='<option value="">Auto rear camera</option>'+devices.map((d,i)=>{
   const hint=/macro|close|ultra.?wide/i.test(d.label)?' ✦ close focus':'';
   return `<option value="${e(d.deviceId)}">${e(d.label||'Camera '+(i+1))}${hint}</option>`;
  }).join('');
  select.value=scanner.deviceId||'';
 }catch(err){console.info('Could not list camera lenses:',err)}
}
async function applyScannerZoom(value){
 const track=scannerCameraTrack(),range=scanner.zoomRange;
 if(!track?.applyConstraints||!range)return;
 const requested=Number(value);
 if(!Number.isFinite(requested))return;
 const next=Math.max(range.min,Math.min(range.max,requested));
 try{
  await track.applyConstraints({advanced:[{zoom:next}]});
  scanner.zoom=next;
  const output=$('#scannerZoomValue');if(output)output.textContent=next.toFixed(1)+'×';
 }catch{scannerStatus('Zoom is unavailable on this camera. Try Refocus.','error')}
}
async function refocusScanner(){
 const track=scannerCameraTrack();if(!track?.applyConstraints)return scannerStatus('Automatic focus is controlled by your phone. Try the photo scanner.');
 let modes=[];try{modes=track.getCapabilities?.()?.focusMode||[]}catch{}
 try{
  if(modes.includes('single-shot'))await track.applyConstraints({advanced:[{focusMode:'single-shot'}]});
  if(modes.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]});
  scannerStatus(modes.length?'Refocusing. Hold the barcode steady until the lines are sharp.':'This camera does not expose manual focus. Try moving the barcode slightly farther away.');
 }catch{scannerStatus('Focus is controlled by the device. Try a different rear camera or photo scanning.','error')}
}
async function getNativeDetector(){
 if(typeof globalThis.BarcodeDetector!=='function')return null;
 try{
  const supported=await globalThis.BarcodeDetector.getSupportedFormats?.();
  const formats=Array.isArray(supported)?SCANNABLE_FORMATS.filter(x=>supported.includes(x)):SCANNABLE_FORMATS;
  const supports1D=formats.some(x=>['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'].includes(x));
  if(!supports1D)return null;
  return new globalThis.BarcodeDetector({formats});
 }catch(err){console.info('Native barcode decoder unavailable:',err);return null}
}
function nativeBarcodeCrop(video){
 // Native API can examine a high-resolution central strip, not just a
 // downscaled full video frame. Preserve both quiet zones around the bars.
 const w=video.videoWidth||0,h=video.videoHeight||0;
 if(w<320||h<240||!document.createElement)return null;
 const canvas=scanner.cropCanvas||(scanner.cropCanvas=document.createElement('canvas'));
 const cropW=Math.round(w*.92),cropH=Math.round(h*.64);
 canvas.width=cropW;canvas.height=cropH;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)return null;
 ctx.drawImage(video,Math.round((w-cropW)/2),Math.round((h-cropH)/2),cropW,cropH,0,0,cropW,cropH);
 return canvas;
}
async function useFallbackScanner(nativeSession){
 if(!scanner.open||scanner.session!==nativeSession||scanner.engine!=='native'||scanner.switching)return;
 scanner.switching=true;
 scannerStatus('Trying enhanced live recognition without restarting your camera…');
 let zxing;
 try{zxing=await loadBarcodeLibrary()}
 catch(err){
  if(scanner.open&&scanner.session===nativeSession){scanner.switching=false;scannerStatus('Retail scanner is still searching. Wider-format decoder unavailable; photo scanning is still available.')}
  return;
 }
 if(!scanner.open||scanner.session!==nativeSession)return;
 // Critically, do NOT stop the stream or reset continuous autofocus here.
 clearTimeout(scanner.timer);clearTimeout(scanner.engineTimer);scanner.timer=null;scanner.engineTimer=null;
 scanner.engine='zxing';scanner.switching=false;
 await startZXingScanner(zxing,nativeSession);
}
async function startZXingScanner(zxing,session){
 if(!scanner.open||scanner.session!==session)return;
 scanner.engine='zxing';
 const video=$('#scannerVideo');
 try{
  const reader=new zxing.BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:160,delayBetweenScanSuccess:400});
  const callback=(result,error,controls)=>{
   if(!scanner.open||scanner.session!==session)return;
   if(controls&&!scanner.controls)scanner.controls=controls;
   if(result)barcodeFound(result.getText());
  };
  let controls;
  // Reuse the existing high-resolution video stream, including focus and zoom.
  if(typeof reader.decodeFromStream==='function'&&scanner.stream){
   controls=await reader.decodeFromStream(scanner.stream,video,callback);
  }else{
   // Older ZXing builds: release the stream only if this compatibility path is required.
   releaseScannerCamera();session=scanner.session;scanner.engine='zxing';
   controls=await reader.decodeFromConstraints(scannerCameraConstraints(),video,callback);
  }
  if(!scanner.open||scanner.session!==session){controls?.stop?.();return}
  scanner.controls=controls;
  scanner.stream=video.srcObject||scanner.stream;
  await configureScannerTrack();
  scannerStatus('Barcode reader ready. Keep the complete barcode in view.');
 }catch(err){
  if(!scanner.open||scanner.session!==session)return;
  console.warn('Enhanced barcode scanner failed:',err);
  scannerStatus('Retail barcode reader remains active. Extra barcode formats could not start. Try a photo for difficult labels.','error');
 }
}
// Always-on EAN/UPC path that does not require a CDN or BarcodeDetector.
// This uses a thin high-resolution image strip and a verified GTIN checksum.
function startLocalRetailReader(session){
 const loop=()=>{
  if(!scanner.open||scanner.session!==session)return;
  try{
   const video=$('#scannerVideo');
   if(video?.readyState>=2&&video.videoWidth>=320&&video.videoHeight>=120){
    const canvas=scanner.localCanvas||(scanner.localCanvas=document.createElement('canvas'));
    // Scan the whole visible video region, not a 44%-high horizontal strip.
    // Match the mobile CSS object-fit:cover crop to what the user sees.
    const preview=$('.scanner-preview');
    const viewW=preview?.clientWidth||video.clientWidth||video.videoWidth;
    const viewH=preview?.clientHeight||video.clientHeight||video.videoHeight;
    const rect=coverCameraRect(video.videoWidth,video.videoHeight,viewW,viewH);
    const w=Math.min(1280,Math.max(320,Math.round(rect.sw)));
    const h=Math.min(580,Math.max(80,Math.round(w*rect.sh/rect.sw)));
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
    const ctx=canvas.getContext?.('2d',{willReadFrequently:true});
    if(ctx){
     ctx.drawImage(video,rect.sx,rect.sy,rect.sw,rect.sh,0,0,w,h);
     const frame=ctx.getImageData(0,0,w,h);
     autoAdjustScannerLight(frame,session);
     const code=decodeRetailImageData(frame);
     if(code)barcodeFound(code);
     scanner.localScans++;
    }
   }
  }catch(err){
   if(scanner.localScans<2)console.info('Local barcode frame unavailable:',err);
  }
  if(scanner.open&&scanner.session===session)scanner.localTimer=setTimeout(loop,260);
 };
 loop();
}

async function startScannerCamera(){
 if(!scanner.open)return;
 releaseScannerCamera();
 const session=scanner.session;
 scannerStatus('Opening high-resolution '+(scanner.facing==='environment'?'rear':'front')+' camera…');
 const video=$('#scannerVideo');
 if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia){
  scannerStatus('Live camera requires HTTPS and permission. Photo scanning remains available.','error');return;
 }
 try{
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia(scannerCameraConstraints())}
  catch(err){
   // A restricted camera can reject 1080p / 30fps or a previously selected device.
   if(err.name!=='OverconstrainedError'&&err.name!=='NotFoundError')throw err;
   scanner.deviceId='';
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:scanner.facing},width:{ideal:1280},height:{ideal:720}}});
  }
  if(!scanner.open||session!==scanner.session){stream.getTracks().forEach(t=>t.stop());return}
  scanner.stream=stream;video.srcObject=stream;
  await video.play();
  if(!scanner.open||session!==scanner.session)return;
  await configureScannerTrack();
  listScannerCameras(session);
  startLocalRetailReader(session);
  scannerStatus('Scanning continuously. Hold the barcode steady and fully visible; automatic focus/light run where available.');
  const detector=await getNativeDetector();
  if(!scanner.open||session!==scanner.session)return;
  if(!detector){
   scanner.engine='local';
   scannerStatus('Local retail scanner running. Loading wider barcode support…');
   try{
    const zxing=await loadBarcodeLibrary();
    if(!scanner.open||session!==scanner.session)return;
    await startZXingScanner(zxing,session);
   }catch(err){
    if(scanner.open&&session===scanner.session)scannerStatus('Retail scanner is still searching. Other barcode formats need a network connection; photo/manual entry is available.');
   }
   return;
  }
  scanner.engine='native';
  // Fast escalation, but retain the same autofocus/stream if another decoder is needed.
  scanner.engineTimer=setTimeout(()=>useFallbackScanner(session),3300);
  const tick=async()=>{
   if(!scanner.open||scanner.session!==session||scanner.engine!=='native')return;
   if(!scanner.busy&&video.readyState>=2){
    scanner.busy=true;
    try{
     let found=await detector.detect(video);
     if(!found?.length&&scanner.misses%2===1){
      const crop=nativeBarcodeCrop(video);
      if(crop)found=await detector.detect(crop);
     }
     scanner.misses++;
     if(found?.length&&scanner.session===session){barcodeFound(found[0].rawValue);scanner.misses=0;clearTimeout(scanner.engineTimer);scanner.engineTimer=setTimeout(()=>useFallbackScanner(session),3500)}
    }catch(err){
     if(++scanner.misses>=4)useFallbackScanner(session);
    }finally{scanner.busy=false}
   }
   if(scanner.open&&scanner.session===session&&scanner.engine==='native')scanner.timer=setTimeout(tick,160);
  };
  tick();
 }catch(err){
  if(session!==scanner.session||!scanner.open)return;
  console.warn('Barcode camera unavailable:',err);
  scanner.stream?.getTracks?.().forEach(track=>track.stop());scanner.stream=null;
  scannerStatus(err?.name==='NotAllowedError'?'Camera permission denied. Allow camera access in site settings and Retry.':err?.name==='NotReadableError'?'Camera is busy in another app. Close it and Retry.':`Live camera unavailable: ${err.message||'try the photo scanner'}`,'error');
 }
}
async function retryScannerCamera(facing,deviceId){
 if(!scanner.open)return;
 if(facing){scanner.facing=facing;scanner.deviceId=''}
 if(deviceId!==undefined)scanner.deviceId=deviceId;
 await startScannerCamera();
}
async function scanBarcodeImage(file){
 if(!scanner.open||!file)return;
 if(!file.type.startsWith('image/')){scannerStatus('Choose a photo containing a barcode.','error');return}
 if(file.size>15_000_000){scannerStatus('Photo is too large. Choose an image under 15 MB.','error');return}
 const layer=$('#scannerLayer');if(!layer)return;
 scannerStatus('Reading barcode from photo…');
 const objectUrl=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=objectUrl;
  await img.decode();
  if(!scanner.open)return;
  let code='';
  const detector=await getNativeDetector();
  if(detector){try{const results=await detector.detect(img);code=results?.[0]?.rawValue||''}catch{}}
  if(!code){
   // Use the same offline retail decoder on still photos before loading ZXing.
   try{
    const canvas=document.createElement('canvas');const w=Math.min(img.naturalWidth||img.width,1600);
    const h=Math.max(1,Math.round(w*(img.naturalHeight||img.height)/(img.naturalWidth||img.width)));
    if(w>0&&h>0){canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);code=decodeRetailImageData(ctx.getImageData(0,0,w,h))}
   }catch(err){console.info('Photo retail decoder unavailable:',err)}
  }
  if(!code){
   scannerStatus('Using enhanced decoder on photo…');
   const zxing=await loadBarcodeLibrary();
   if(!scanner.open)return;
   const reader=new zxing.BrowserMultiFormatReader();
   const result=await reader.decodeFromImageElement(img);
   code=result?.getText?.()||'';
  }
  if(!scanner.open)return;
  if(code)barcodeFound(code,true);
  else scannerStatus('No barcode was found. Try a closer, sharper photo showing the full code.','error');
 }catch(err){
  if(scanner.open)scannerStatus(`Could not read the photo. Try better light, another photo or manual entry. (${err.message||'No barcode found'})`,'error');
 }finally{URL.revokeObjectURL(objectUrl);const f=$('#barcodePhoto');if(f)f.value=''}
}
async function toggleScannerTorch(){
 if(!scanner.torchAvailable)return scannerStatus('This camera does not support a controllable flashlight.','error');
 const next=scanner.lightMode==='auto'?'on':scanner.lightMode==='on'?'off':'auto';
 scanner.lightMode=next;scanner.lightDimSamples=0;scanner.lightCheckedAt=0;
 updateScannerLightButton();
 if(next==='off')await setScannerTorch(false);
 else if(next==='on')await setScannerTorch(true);
 else {await setScannerTorch(false);scannerStatus('Automatic light detection enabled. Scanning continues.');}
}

function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(db));globalThis.BillNestCloud?.onSave?.();return true}catch(err){console.error(err);toast('Could not save. Browser storage is unavailable or full. Export a backup.','error');return false}}
function toast(message,type='ok'){const node=$('#toastLayer');node.innerHTML=`<div class="toast ${type==='error'?'error':''}">${e(message)}</div>`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.innerHTML='',4300)}
const num = v => Number(v)||0;
const pct = n => `${Number(n||0)}%`;
const productStatus = p => p.stock<=0 ? '<span class="chip red">Out of stock</span>' : p.stock<=p.lowStock ? '<span class="chip yellow">Low stock</span>' : '<span class="chip green">In stock</span>';
const productExpiryStatus = p => expiryStatus(p.expiryDate);
const activeExpiryAlerts = () => db.products.filter(p=>p.stock>0&&['soon','expired'].includes(productExpiryStatus(p).state))
  .sort((a,b)=>productExpiryStatus(a).days-productExpiryStatus(b).days || a.name.localeCompare(b.name));
const expiryLabel = p => {
 const info=productExpiryStatus(p);
 if(info.state==='expired')return `Expired ${Math.abs(info.days)} day${Math.abs(info.days)===1?'':'s'} ago`;
 if(info.state==='soon')return info.days===0?'Expires today':info.days===1?'Expires tomorrow':`Expires in ${info.days} days`;
 return '';
};
const expiryBadge = p => {const info=productExpiryStatus(p);return ['soon','expired'].includes(info.state)
 ? `<span class="chip expiry-chip ${info.state==='expired'?'red':'yellow'}" title="Expiry: ${e(p.expiryDate)}">${info.state==='expired'?'Expired':info.days===0?'Expires today':`${info.days}d to expiry`}</span>`:''};

const avatarClass = i => ['','blue','orange','purple'][Math.abs(i)%4];
const productAvatar = (p,i=0) => `<span class="item-avatar ${avatarClass(i)}">${e(p.name?.slice(0,1).toUpperCase()||'?')}</span>`;
const formatDate = day => {try{return dateFromDay(day).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch{return e(day)}};
const stateOptions = current => `<option value="">Select state / UT</option>${STATES.map(s=>`<option ${s===current?'selected':''} value="${e(s)}">${e(s)}</option>`).join('')}`;
const empty = (icon,title,desc,btnText,action) => `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${e(title)}</h3><p>${e(desc)}</p>${btnText?`<button class="btn btn-primary" data-action="${e(action)}">+ ${e(btnText)}</button>`:''}</div>`;
const field = (label,name,value='',type='text',extra='') => `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
const sectionHeader = (title,sub='',actions='') => `<div class="page-intro"><div><h2>${title}</h2><p>${sub}</p></div>${actions?`<div class="toolbar-actions">${actions}</div>`:''}</div>`;
const reportDateRange = () => ui.reportRange==='all' ? '0001-01-01' : shiftDay(today(),-Number(ui.reportRange)+1);
function showDemoBanner(){return db.demo?`<div class="banner orange"><div><strong>✦ You are exploring a demo workspace</strong><p>Sample products and invoices are only examples. Start fresh before using this for your real store.</p></div><button class="btn btn-sm" data-action="reset-data">Start with an empty store</button></div>`:''}
function render(){
 $('#navigation').innerHTML=PAGES.map(([key,label,icon])=>`<button type="button" data-go="${key}" class="nav-item ${ui.page===key?'active':''} ${key==='settings'?'nav-spacer':''}" ${ui.page===key?'aria-current="page"':''}><span class="nav-icon nav-icon-3d">${navIcon(key)}</span><span>${label}</span></button>`).join('');
 const mobileNav=$('#mobileBottomNav');
 if(mobileNav)mobileNav.innerHTML=['dashboard','billing','inventory','sales','accounting'].map(key=>{const [name,label,icon]=PAGES.find(p=>p[0]===key);const tabLabel=key==='sales'?'Invoices':key==='accounting'?'Accounts':label;return `<button type="button" data-go="${name}" class="mobile-tab ${ui.page===name?'active':''}" ${ui.page===name?'aria-current="page"':''}><span class="mobile-tab-icon nav-icon-3d">${navIcon(name)}</span><span>${tabLabel}</span></button>`}).join('');
 $('#pageTitle').textContent=PAGES.find(p=>p[0]===ui.page)?.[1]||'Overview';
 $('#storeName').textContent=db.settings.businessName||'My Store';
 $('#storeAvatar').textContent=(db.settings.businessName||'My Store').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const screens={dashboard:renderDashboard,inventory:renderInventory,billing:renderBilling,sales:renderSales,customers:renderCustomers,accounting:renderAccounting,reports:renderReports,settings:renderSettings};
 try{$('#main').innerHTML=screens[ui.page]()}catch(err){console.error('BillNest screen error:',err);$('#main').innerHTML=`<section class="card section-card" role="alert"><h2>Unable to display this section</h2><p>Please return to Dashboard, or restore your latest backup in Settings.</p><button class="btn btn-primary" data-go="dashboard">Go to Dashboard</button></section>`;}
 if(ui.modal)renderModal();else $('#modalLayer').innerHTML='';
}
function navigate(page,updateHash=true){if(page!=='settings')pendingLogo=null;if(!PAGES.some(p=>p[0]===page))return;if(scanner.open)stopScanner();ui.page=page;ui.modal=null;ui.search='';ui.filter='all';ui.billingSearch='';render();$('.sidebar').classList.remove('open');$('#backdrop')?.classList.remove('show');if(updateHash&&globalThis.location&&location.hash!=='#'+page)location.hash=page;window.scrollTo?.({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>{const page=pageFromHash();if(page!==ui.page)navigate(page,false)});
// The dashboard reports gross profit on invoiced goods, not business net income.
function renderProfitReport(){
 const from=ui.profitRange==='all'?'0001-01-01':shiftDay(today(),-Number(ui.profitRange)+1);
 const stat=summarizeProfit(db.invoices,db.products,from);
 const dateLabel=ui.profitRange==='all'?'All-time':`Last ${ui.profitRange} days`;
 const fmtProfit=value=>`${value<0?'− ':''}${money(Math.abs(value))}`;
 const tone=value=>value<0?'loss':value>0?'gain':'neutral';
 const query=ui.profitSearch.toLowerCase().trim();
 const visible=stat.productRows.filter(p=>!query||[p.name,p.sku].some(v=>v.toLowerCase().includes(query)));
 const number=(v)=>Math.round(v).toLocaleString('en-IN');
 const cards=[
  ['Net sales (excl. GST)',money(stat.sales),'After invoice discounts','neutral'],
  ['Cost of goods sold',money(stat.cost),'Cost of sold products','neutral'],
  ['Gross profit / loss',fmtProfit(stat.profit),stat.missingCostLines?'Partial: some costs unknown':`${dateLabel} · invoiced sales`,tone(stat.profit)],
  ['Gross margin',stat.margin===null?'—':`${stat.margin.toFixed(1)}%`,'On sales with known costs',tone(stat.profit)]
 ];
 const disclaimer=stat.estimatedLines?`<div class="profit-info">ⓘ ${number(stat.estimatedLines)} older invoice item(s) use current purchase costs. Figures for those sales are <b>estimated</b>.</div>`:'';
 const missing=stat.missingCostLines?`<div class="profit-info profit-warning">⚠ ${number(stat.missingCostLines)} invoice item(s) lack purchase cost. Their sales are shown, but are excluded from gross profit.</div>`:'';
 const rowStatus=p=>p.qty===0?'<span class="profit-label neutral">No sales</span>':p.missingCostLines?`<span class="profit-label warning">${p.recognizedSales?'Partial':'Cost missing'}</span>`:p.profit<0?'<span class="profit-label loss">Loss</span>':p.profit>0?'<span class="profit-label gain">Profit</span>':'<span class="profit-label neutral">Break-even</span>';
 const rowProfit=p=>p.qty===0||!p.recognizedSales&&p.missingCostLines?'—':`<strong class="profit-${tone(p.profit)}">${fmtProfit(p.profit)}</strong>`;
 return `<section class="card profit-panel" aria-labelledby="profitTitle">
  <div class="profit-panel-heading"><div><h3 id="profitTitle">Profit &amp; loss</h3><p>Gross profit from invoices, by product. GST is excluded.</p></div>
    <label class="profit-period-label" for="profitRange">Period<select class="select-input" id="profitRange" aria-label="Profit date range">${[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['all','All time']].map(([key,label])=>`<option value="${key}" ${ui.profitRange===key?'selected':''}>${label}</option>`).join('')}</select></label>
  </div>
  <div class="profit-summary-grid">${cards.map(([label,value,hint,className])=>`<div class="profit-summary-card"><span>${label}</span><strong class="profit-${className}">${value}</strong><small>${hint}</small></div>`).join('')}</div>
  ${disclaimer}${missing}
  <div class="profit-products-head"><div><h4>Product-wise profit / loss</h4><p>Search a product to see units sold, net sales, cost and profit.</p></div><label class="profit-search"><span class="sr-only">Search product profit</span><input type="search" data-search="profit" placeholder="Search product or SKU" value="${e(ui.profitSearch)}" aria-label="Search product profit"></label></div>
  ${visible.length?`<div class="profit-table-scroll"><table class="profit-table"><thead><tr><th>Product</th><th>Units sold</th><th>Net sales</th><th>Cost</th><th>Gross P/L</th><th>Margin</th><th>Status</th></tr></thead><tbody>${visible.map(p=>`<tr><td><strong>${e(p.name)}</strong><small>${e(p.sku||'')}</small></td><td>${number(p.qty)}</td><td>${p.qty?money(p.sales):'—'}</td><td>${p.qty?money(p.cost):'—'}</td><td>${rowProfit(p)}</td><td>${p.qty && p.recognizedSales?`${(p.profit/p.recognizedSales*100).toFixed(1)}%`:'—'}</td><td>${rowStatus(p)}</td></tr>`).join('')}</tbody></table></div>
  <div class="profit-mobile-list">${visible.map(p=>`<article class="profit-mobile-item"><div><strong>${e(p.name)}</strong><span>${e(p.sku||'')} · ${number(p.qty)} sold</span></div><div class="profit-mobile-money">${rowProfit(p)}${rowStatus(p)}</div><small>Sales ${money(p.sales)} · Cost ${money(p.cost)}</small></article>`).join('')}</div>`:empty('▥','No matching products',db.products.length?'Try another product name or SKU.':'Add products and issue invoices to see gross profit.')}
  <p class="profit-footnote">Gross profit = invoiced sales excluding GST and after discounts − purchase cost of units sold. This is <b>not net business profit</b>: rent, salaries, shipping, returns and other expenses are not included. Unpaid invoices count as sales. Enter accurate purchase costs in Inventory.</p>
 </section>`;
}
function renderDashboard(){
 const daily=db.invoices.filter(i=>i.date===today()),todayRevenue=daily.reduce((s,i)=>s+i.total,0);
 const low=db.products.filter(p=>p.stock<=p.lowStock),expiring=activeExpiryAlerts(),stockValue=db.products.reduce((s,p)=>s+toPaise(p.cost)*p.stock,0);
 const metrics=[['Today’s sales',money(todayRevenue),'Across '+daily.length+' invoices','sales',''],['Total products',db.products.length.toLocaleString('en-IN'),'Products in your catalogue','products','blue'],['Low stock items',low.length,'Need your attention','warning','orange'],['Stock value',money(stockValue),'Based on purchase cost','stock','purple']];
 const days=Array.from({length:7},(_,i)=>shiftDay(today(),i-6));const points=days.map(day=>db.invoices.filter(x=>x.date===day).reduce((s,x)=>s+x.total,0));const max=Math.max(...points,1);
 const recent=[...db.invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
 return `${showDemoBanner()}<div class="page-intro"><div><h2>Good to see you 👋</h2><p>Here is what is happening in your store today, ${formatDate(today())}.</p></div><div class="toolbar-actions"><button class="btn" data-go="inventory">Manage stock</button><button class="btn btn-primary" data-go="billing">+ Open Billing</button></div></div>
 <div class="quick-start" role="group" aria-label="Quick actions"><button class="quick-start-action quick-billing" data-go="billing"><span class="quick-start-icon icon-3d">${icon3D('billing')}</span><span><b>Billing</b><small>New invoice and checkout</small></span><span class="quick-start-arrow">→</span></button><button class="quick-start-action" data-action="add-product"><span class="quick-start-icon icon-3d">${icon3D('add')}</span><span><b>Add product</b><small>Update inventory</small></span><span class="quick-start-arrow">→</span></button><button class="quick-start-action" data-go="accounting"><span class="quick-start-icon icon-3d">${icon3D('accounting')}</span><span><b>Accounting</b><small>Expenses and cashbook</small></span><span class="quick-start-arrow">→</span></button></div>
 <div class="grid metric-grid">${metrics.map(([name,value,subtitle,icon,color])=>`<div class="card metric-card"><div class="metric-top">${name}<span class="metric-icon icon-3d ${color}">${icon3D(icon)}</span></div><div class="metric-value">${value}</div><div class="metric-sub">${subtitle}</div></div>`).join('')}</div>
 ${renderAccountingShortcut()}
 <div class="section-grid"><section class="card section-card"><div class="section-title"><h3>Sales overview</h3><span class="muted small">Last 7 days</span></div><div class="chart-wrap">${points.map((value,i)=>`<div class="chart-col"><div class="chart-bars"><div class="chart-bar" style="height:${Math.max(2,Math.round(value/max*100))}%" title="${e(days[i])}: ${money(value)}"></div></div><div class="chart-label">${dateFromDay(days[i]).toLocaleDateString('en-IN',{weekday:'short'})}</div></div>`).join('')}</div><p class="mini-note">Daily invoice totals in Indian rupees</p></section>
 <section class="card section-card"><div class="section-title"><h3>Stock &amp; expiry alerts</h3><button class="section-link" data-go="inventory">View inventory →</button></div>${expiring.length?`<div class="expiry-overview"><strong>${expiring.filter(p=>productExpiryStatus(p).state==='expired').length} expired · ${expiring.filter(p=>productExpiryStatus(p).state==='soon').length} expiring within 30 days</strong><button class="section-link" data-go="inventory" data-filter-jump="expiring">Review expiry →</button></div><div class="alert-list expiry-alert-list">${expiring.slice(0,4).map(p=>`<div class="alert-row expiry-alert-row"><span class="alert-icon expiry-alert-icon">${icon3D('expiry')}</span><div class="alert-details"><b>${e(p.name)}</b><small>Expiry ${formatDate(p.expiryDate)} · ${p.stock} in stock</small></div><span class="chip ${productExpiryStatus(p).state==='expired'?'red':'yellow'}">${e(expiryLabel(p))}</span></div>`).join('')}</div>${expiring.length>4?`<p class="mini-note">+${expiring.length-4} more expiry alerts</p>`:''}`:'<p class="mini-note expiry-empty-note">Set an expiry date on a product to receive alerts 30 days before expiry.</p>'}${low.length?`<div class="alert-list">${low.slice(0,4).map(p=>`<div class="alert-row"><div class="alert-icon">⚠</div><div class="alert-details"><b>${e(p.name)}</b><small>${e(p.sku)} · Reorder at ${p.lowStock}</small></div><span class="chip ${p.stock===0?'red':'yellow'}">${p.stock} left</span></div>`).join('')}</div>${low.length>4?`<p class="mini-note">+${low.length-4} more products need attention</p>`:''}`:empty('✓','All stocked up','No products have reached their low-stock threshold.')}</section></div>
 <section class="card recent-card"><div class="section-title" style="padding:20px 22px 0;margin-bottom:8px"><h3>Recent invoices</h3><button class="section-link" data-go="sales">View all →</button></div>${recent.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Amount</th><th></th></tr></thead><tbody>${recent.map(x=>`<tr><td><strong>${e(x.number)}</strong></td><td>${e(x.customer?.name||'Walk-in customer')}</td><td>${formatDate(x.date)}</td><td><span class="chip ${x.paid?'green':'yellow'}">${x.paid?'Paid':'Unpaid'}</span></td><td><strong>${money(x.total)}</strong></td><td><button class="btn btn-sm" data-action="view-invoice" data-id="${x.id}">View</button></td></tr>`).join('')}</tbody></table></div>`:empty('▧','No invoices yet','Start by creating your first invoice.','Create invoice','new-bill')}</section>`;
}
function renderInventory(){
 const q=ui.search.trim().toLowerCase();const filtered=db.products.filter(p=>(!q||[p.name,p.sku,p.barcode,p.category].some(s=>String(s||'').toLowerCase().includes(q)))&&(ui.filter==='all'||ui.filter==='low'&&p.stock<=p.lowStock||ui.filter==='out'&&p.stock===0||ui.filter==='expiring'&&p.stock>0&&productExpiryStatus(p).state==='soon'||ui.filter==='expired'&&p.stock>0&&productExpiryStatus(p).state==='expired'));
 return `${sectionHeader('Your products','Manage stock, prices and expiry dates with 30-day alerts.',`<button class="btn btn-scan" data-action="scan-inventory">▣ Scan barcode</button><button class="btn" data-action="export-products">↓ Export CSV</button><button class="btn btn-primary" data-action="add-product">+ Add product</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input type="search" data-search="inventory" value="${e(ui.search)}" placeholder="Search product, barcode or SKU..." aria-label="Search inventory"></div><select class="select-input" data-filter="inventory" aria-label="Filter products"><option value="all" ${ui.filter==='all'?'selected':''}>All products</option><option value="low" ${ui.filter==='low'?'selected':''}>Low stock</option><option value="out" ${ui.filter==='out'?'selected':''}>Out of stock</option><option value="expiring" ${ui.filter==='expiring'?'selected':''}>Expiring ≤30 days</option><option value="expired" ${ui.filter==='expired'?'selected':''}>Expired</option></select></div>${filtered.length?`<div class="mobile-product-list">${filtered.map((p,i)=>`<article class="mobile-product"><div class="mobile-product-main">${productAvatar(p,i)}<div class="mobile-product-name"><strong>${e(p.name)}</strong><span>${e(p.barcode||p.sku)}</span></div><strong>${money(toPaise(p.price))}</strong></div><div class="mobile-product-foot"><span>${p.stock} ${e(p.unit)} left</span>${productStatus(p)}${expiryBadge(p)}${p.expiryDate?`<span class="mobile-expiry-date">Expiry ${formatDate(p.expiryDate)}</span>`:''}<button class="btn btn-sm" data-action="stock" data-id="${p.id}">+ Stock</button><button class="btn btn-sm" data-action="edit-product" data-id="${p.id}">Edit</button></div></article>`).join('')}</div><div class="table-scroll inventory-desktop-table"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Selling price</th><th>Stock</th><th>GST</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map((p,i)=>`<tr><td><div class="product-cell">${productAvatar(p,i)}<div><strong>${e(p.name)}</strong><small>${e(p.sku)}${p.barcode?' · '+e(p.barcode):''}</small></div></div></td><td>${e(p.category||'Uncategorised')}</td><td><strong>${money(toPaise(p.price))}</strong></td><td>${p.stock} ${e(p.unit)}</td><td>${pct(p.gst)}</td><td><div class="expiry-cell">${p.expiryDate?formatDate(p.expiryDate):'Not set'}${expiryBadge(p)}</div></td><td>${productStatus(p)}</td><td><div class="menu-links"><button class="btn btn-sm" data-action="stock" data-id="${p.id}">+ Stock</button><button class="btn btn-sm" data-action="edit-product" data-id="${p.id}">Edit</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('▤',q||ui.filter!=='all'?'No matching products':'No products yet',q||ui.filter!=='all'?'Try a different search or filter.':'Add your first product to track stock and create invoices.',q?'':'Add product',q?'':'add-product')}<div class="pagination-text">Showing ${filtered.length} of ${db.products.length} products</div></section>`;
}
function billingPreview(){try{return calculateInvoice(ui.cart,productsMap(),ui.discount,db.settings,db.customers.find(c=>c.id===ui.billingCustomer)||{state:db.settings.state})}catch{return null}}
function renderBilling(){
 const q=ui.billingSearch.toLowerCase().trim();const matching=db.products.filter(p=>[p.name,p.sku,p.barcode,p.category].some(x=>String(x||'').toLowerCase().includes(q)));
 const preview=billingPreview();
 return `${sectionHeader('Billing & checkout','Select products, set quantities and create a printable invoice.',`<button class="btn btn-scan" data-action="scan-billing">▣ Scan barcode</button><button class="btn" data-go="sales">Invoice history</button>`)}
 <div class="two-col"><section class="card products-picker"><div class="table-top"><div><strong style="font-size:14px">Select products</strong><div class="mini-note">Click a product to add it to the invoice</div></div></div><div style="padding:13px 17px"><div class="billing-search-row"><div class="searchbox" style="max-width:none"><input type="search" data-search="billing" value="${e(ui.billingSearch)}" placeholder="Search name, SKU or barcode..." aria-label="Find product"></div><button type="button" class="btn btn-scan mobile-scan-btn" data-action="scan-billing">▣ Scan</button></div></div><div class="picker-list">${matching.length?matching.map((p,i)=>`<button class="picker-product" data-action="add-to-cart" data-id="${p.id}" ${p.stock===0?'disabled':''}>${productAvatar(p,i)}<span class="picker-info"><strong>${e(p.name)}</strong><small>${e(p.sku)} · ${p.stock>0?`${p.stock} in stock`:'Out of stock'}</small></span><span class="picker-price">${money(toPaise(p.price))}</span><span class="picker-add">+</span></button>`).join(''):db.products.length?empty('⌕','No matching products','Try searching with a different keyword.'):empty('▧','No products to bill yet','Add your first product to start billing.','Add product','add-product')}</div></section>
 <section class="card bill-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h3>Current invoice</h3><span class="chip grey">${ui.cart.reduce((a,b)=>a+b.qty,0)} items</span></div><div class="field"><label for="billCustomer">Customer</label><select id="billCustomer"><option value="">Walk-in customer</option>${db.customers.map(c=>`<option value="${c.id}" ${ui.billingCustomer===c.id?'selected':''}>${e(c.name)}</option>`).join('')}</select></div><div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="section-link" data-action="add-customer">+ Add customer</button></div>
 <div class="bill-items">${ui.cart.length?ui.cart.map(item=>{const p=db.products.find(p=>p.id===item.productId);if(!p)return '';const line=preview?.lines.find(l=>l.productId===p.id);return `<div class="bill-item"><div><div class="name">${e(p.name)}</div><small>${money(toPaise(p.price))} / ${e(p.unit)}</small><div class="qty-control"><button data-action="decrease-qty" data-id="${p.id}" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-action="increase-qty" data-id="${p.id}" aria-label="Increase quantity" ${item.qty>=p.stock?'disabled':''}>+</button></div></div><div><div class="bill-line-total">${money(line?.total ?? toPaise(p.price)*item.qty)}</div><button class="remove-item" data-action="remove-cart" data-id="${p.id}">Remove</button></div></div>`}).join(''):empty('▧','Your cart is empty','Choose a product on the left to begin billing.')}</div>
 <div class="field"><label for="billDiscount">Discount (%)</label><input id="billDiscount" type="number" min="0" max="100" step="0.5" value="${e(ui.discount)}"></div><div class="summary-box"><div class="summary-row"><span>Subtotal ${db.settings.taxMode==='inclusive'?'(incl. GST)':''}</span><b>${money(preview?.list||0)}</b></div><div class="summary-row"><span>Discount</span><b>− ${money(preview?.discount||0)}</b></div><div class="summary-row"><span>GST ${preview?.taxType==='intra'?'(CGST + SGST)':preview?.taxType==='inter'?'(IGST)':''} ${db.settings.taxMode==='inclusive'?'included':''}</span><b>${money(preview?.tax||0)}</b></div><div class="summary-row total"><span>Total</span><b>${money(preview?.total||0)}</b></div></div>
 <div class="form-grid" style="margin-bottom:14px"><div class="field"><label for="billPayment">Payment method</label><select id="billPayment">${['Cash','UPI','Card','Bank transfer','Credit'].map(x=>`<option ${ui.payment===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="billNotes">Reference / notes</label><input id="billNotes" placeholder="Optional" value="${e(ui.billNotes)}" maxlength="140"></div></div>
 ${ui.payment==='UPI'?`<p class="upi-billing-hint">${isValidUpiId(db.settings.upiId)?`UPI QR for <b>${e(db.settings.upiId)}</b> will appear after invoice creation. Confirm receipt before marking paid.`:`Set a receiving UPI ID in <button class="section-link" type="button" data-go="settings">Store Settings</button> first.`}</p>`:''}
 <button class="btn btn-primary btn-block btn-lg" data-action="save-invoice" ${!ui.cart.length||!preview?'disabled':''}>✓ Generate invoice · ${money(preview?.total||0)}</button><p class="mini-note" style="text-align:center">Stock is deducted when you generate the invoice.</p></section></div>`;
}
function renderSales(){const q=ui.salesSearch.toLowerCase().trim();const invoices=[...db.invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(i=>[i.number,i.customer?.name,i.payment].some(x=>String(x||'').toLowerCase().includes(q)));return `${sectionHeader('Sales & invoices','Every generated invoice is stored in this browser.',`<button class="btn" data-action="export-invoices">↓ Export CSV</button><button class="btn btn-primary" data-go="billing">+ New invoice</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input data-search="sales" type="search" value="${e(ui.salesSearch)}" placeholder="Search invoice or customer..." aria-label="Search invoices"></div><span class="muted small">${invoices.length} invoices</span></div>${invoices.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Payment method</th><th>Payment</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${invoices.map(i=>`<tr><td><strong>${e(i.number)}</strong>${i.demo?'<small class="muted"> (sample)</small>':''}</td><td>${e(i.customer?.name||'Walk-in customer')}</td><td>${formatDate(i.date)}</td><td>${e(i.payment)}</td><td><span class="chip ${i.paid?'green':'yellow'}">${invoiceOutstanding(i,db.accounting.entries)===0?'Paid':invoiceOutstanding(i,db.accounting.entries)===i.total?'Unpaid':'Part paid'}</span></td><td><strong>${money(i.total)}</strong>${invoiceOutstanding(i,db.accounting.entries)?`<small class="muted"> Due: ${money(invoiceOutstanding(i,db.accounting.entries))}</small>`:''}</td><td><button class="btn btn-sm" data-action="view-invoice" data-id="${i.id}">View / Print</button>${invoiceOutstanding(i,db.accounting.entries)>0?` <button class="btn btn-sm" data-action="record-receipt" data-id="${i.id}">Receive payment</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty('▧','No invoices found',q?'Try a different search.':'Invoices will appear here after you generate them.',q?'':'Create invoice',q?'':'new-bill')}</section>`}
function renderCustomers(){const q=ui.customerSearch.toLowerCase().trim(),list=db.customers.filter(c=>[c.name,c.phone,c.email,c.state].some(v=>String(v||'').toLowerCase().includes(q)));return `${sectionHeader('Customers','Keep customer details ready for faster billing.',`<button class="btn btn-primary" data-action="add-customer">+ Add customer</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input data-search="customers" type="search" value="${e(ui.customerSearch)}" placeholder="Search customers..." aria-label="Search customers"></div><span class="muted small">${list.length} customers</span></div>${list.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>State</th><th>Invoices</th><th>Actions</th></tr></thead><tbody>${list.map((c,i)=>`<tr><td><div class="product-cell">${productAvatar(c,i)}<div><strong>${e(c.name)}</strong><small>${e(c.email||'Individual / business')}</small></div></div></td><td>${e(c.phone||'Not provided')}</td><td>${e(c.state||'Not set')}</td><td>${db.invoices.filter(x=>x.customer?.id===c.id).length}</td><td><button class="btn btn-sm" data-action="edit-customer" data-id="${c.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`:empty('♙','No customers found',q?'Try another name or phone.':'Add customers so you can quickly select them when billing.',q?'':'Add customer',q?'':'add-customer')}</section>`}
// Accounting is a cashbook plus an indicative P&L, not a full double-entry ledger.
const accountingFrom = () => ui.accountingRange==='all'?'0001-01-01':shiftDay(today(),-Number(ui.accountingRange)+1);
const accountingStats = () => makeAccountingSummary(db.invoices,db.products,db.accounting,accountingFrom());
const signedMoney = amount => `${amount<0?'− ':''}${money(Math.abs(amount))}`;
function renderAccountingShortcut(){
 const report=makeAccountingSummary(db.invoices,db.products,db.accounting,shiftDay(today(),-29));
 return `<section class="card accounting-dashboard-strip" aria-label="Accounting summary"><div><small>Estimated net profit · last 30 days</small><strong class="${report.netProfit<0?'accounting-negative':'accounting-positive'}">${signedMoney(report.netProfit)}</strong><span>Gross profit + other income − operating expenses${report.incomplete?' · incomplete costs':''}</span></div><div><small>Customer outstanding</small><strong>${money(report.outstanding)}</strong><span>${report.unpaidInvoices.length} invoices with balance due</span></div><button class="btn btn-sm" data-go="accounting">Open accounting →</button></section>`;
}
function renderAccounting(){
 const stat=accountingStats();
 const from=accountingFrom(), label=ui.accountingRange==='all'?'all dates':`last ${ui.accountingRange} days`;
 const query=ui.accountingSearch.trim().toLowerCase();
 const rows=stat.cashbook.filter(row=>row.date>=from&&(!query||[row.label,row.type,row.category,row.invoiceId].some(v=>String(v||'').toLowerCase().includes(query))));
 const cashflow=rows.reduce((sum,row)=>sum+row.cash+row.bank,0);
 const cards=[
  ['Cash balance',signedMoney(stat.balances.cash),'Opening + recorded cash movements'],
  ['Bank / UPI balance',signedMoney(stat.balances.bank),'UPI and card receipts included'],
  ['Outstanding from customers',money(stat.outstanding),`${stat.unpaidInvoices.length} invoices with balance due`],
  ['Operating expenses',money(stat.operatingExpenses),`Recorded in ${label}`],
  ['Other income',money(stat.otherIncome),'Excludes invoiced sales'],
  ['Estimated net profit / loss',signedMoney(stat.netProfit),`Invoiced gross profit + other income − expenses (${label})`]
 ];
 const expenseRows=stat.expenseCategories.slice(0,5);
 return `${showDemoBanner()}${sectionHeader('Accounting & cashbook','Track cash, bank, shop expenses and customer dues alongside your invoices.',`<button type="button" class="btn" data-action="opening-balances">Opening balances</button><button type="button" class="btn btn-primary" data-action="add-accounting">+ New transaction</button>`)}
 <div class="accounting-toolbar"><label for="accountingRange">Reporting period</label><select id="accountingRange" class="select-input" aria-label="Accounting date range">${[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['all','All time']].map(([key,text])=>`<option value="${key}" ${ui.accountingRange===key?'selected':''}>${text}</option>`).join('')}</select><span class="accounting-period-hint">Balances and outstanding invoices are always current; P/L and transactions use the selected period.</span></div>
 <div class="accounting-card-grid">${cards.map(([title,value,hint])=>`<section class="card accounting-metric"><span>${title}</span><strong>${value}</strong><small>${hint}</small></section>`).join('')}</div>
 ${stat.incomplete?`<p class="accounting-warning" role="status">Some invoice items have unknown purchase costs. Net profit is incomplete. Add their purchase costs in Inventory.</p>`:''}
 ${stat.estimated?`<p class="accounting-warning">Older invoices without cost snapshots use current product purchase costs, so their profit is estimated.</p>`:''}
 <div class="accounting-two-col"><section class="card accounting-block"><div class="section-title"><h3>Customer receivables</h3><span class="muted small">${money(stat.outstanding)} due</span></div>
 ${stat.unpaidInvoices.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th></th></tr></thead><tbody>${stat.unpaidInvoices.map(inv=>`<tr><td><strong>${e(inv.number)}</strong><small>${formatDate(inv.date)}</small></td><td>${e(inv.customer?.name||'Walk-in customer')}</td><td>${money(inv.outstanding)}</td><td><button class="btn btn-sm" data-action="record-receipt" data-id="${e(inv.id)}">Receive</button></td></tr>`).join('')}</tbody></table></div>`:empty('✓','No pending payments','All recorded invoices are settled.')}
 </section><section class="card accounting-block"><div class="section-title"><h3>Operating expenses by category</h3></div>${expenseRows.length?expenseRows.map(([category,amount])=>`<div class="accounting-category-row"><span>${e(category)}</span><strong>${money(amount)}</strong></div>`).join(''):empty('▤','No expenses recorded','Record rent, transport, salary or other shop costs.')}
 <p class="mini-note">Inventory purchases, transfers and owner drawings affect money balances, not operating profit.</p></section></div>
 <section class="card accounting-block accounting-ledger"><div class="section-title"><div><h3>Cashbook</h3><p class="mini-note">${rows.length} movements · ${label} · cashflow ${signedMoney(cashflow)}</p></div><div class="accounting-ledger-actions"><input class="accounting-search" type="search" data-search="accounting" aria-label="Search transactions" value="${e(ui.accountingSearch)}" placeholder="Search transactions"><button class="btn btn-sm" data-action="export-accounting">↓ CSV</button></div></div>
 ${rows.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Details</th><th>Account</th><th>Cash change</th><th>Bank change</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${formatDate(r.date)}</td><td><strong>${e(r.label)}</strong><small>${e(ACCOUNT_TYPES[r.type]||'Invoice payment')}</small></td><td>${e(r.account==='cash'?'Cash':'Bank / UPI')}</td><td class="${r.cash<0?'accounting-negative':'accounting-positive'}">${r.cash?signedMoney(r.cash):'—'}</td><td class="${r.bank<0?'accounting-negative':'accounting-positive'}">${r.bank?signedMoney(r.bank):'—'}</td><td>${r.auto?'Auto':`<button class="btn btn-sm" data-action="delete-accounting" data-id="${e(r.id)}" aria-label="Delete transaction">Delete</button>`}</td></tr>`).join('')}</tbody></table></div>`:empty('▥','No cashbook entries found','Try another period or record an expense or receipt.')}
 <p class="accounting-note">Cashbook balances include invoices marked paid (older invoices assumed received in their original payment method), manual transactions and opening balances. Outstanding and profit are calculated separately.  Do not record a paid invoice again as other income.</p></section>
 <p class="accounting-note accounting-final-note"><strong>About this report:</strong> Estimated net profit = invoiced gross profit (sales excluding GST minus cost of goods sold) + other income − recorded operating expenses. It is not a statutory financial statement. GST, depreciation, loans, supplier payables, refunds, and other accounting adjustments are not fully handled. Inventory purchase payments do not automatically add stock; record stock changes separately in Inventory. Data stays in this browser unless exported.</p>`;
}
function renderReports(){const start=reportDateRange(),inv=db.invoices.filter(x=>x.date>=start),sales=inv.reduce((s,i)=>s+i.total,0),tax=inv.reduce((s,i)=>s+i.tax,0),count=inv.length,avg=count?Math.round(sales/count):0;
 const payments={};inv.forEach(i=>{payments[i.payment]=(payments[i.payment]||0)+i.total});
 const prod={}; inv.forEach(i=>i.lines.forEach(line=>{const item=prod[line.name] ||= {name:line.name,qty:0,total:0};item.qty+=line.qty;item.total+=line.total}));const best=Object.values(prod).sort((a,b)=>b.qty-a.qty).slice(0,6);const topSales=Math.max(...Object.values(payments),1),topQty=Math.max(...best.map(i=>i.qty),1);
 return `${sectionHeader('Business reports','Simple insights to help you make decisions.',`<select class="select-input" id="reportRange" aria-label="Date range"><option value="7" ${ui.reportRange==='7'?'selected':''}>Last 7 days</option><option value="30" ${ui.reportRange==='30'?'selected':''}>Last 30 days</option><option value="90" ${ui.reportRange==='90'?'selected':''}>Last 90 days</option><option value="all" ${ui.reportRange==='all'?'selected':''}>All time</option></select><button class="btn" data-action="export-invoices">↓ Export sales</button>`)}<div class="grid report-grid">${[['Total sales',money(sales)],['Invoices issued',count],['GST on sales',money(tax)],['Average invoice',money(avg)],['Unpaid invoices',inv.filter(i=>!i.paid).length],['Inventory at cost',money(db.products.reduce((s,p)=>s+toPaise(p.cost)*p.stock,0))]].map(([label,value])=>`<div class="card report-card"><div class="overline">${label}</div><div class="metric-value">${value}</div></div>`).join('')}</div>
 ${renderProfitReport()}
 <div class="report-layout"><section class="card section-card"><div class="section-title"><h3>Sales by payment method</h3></div>${Object.keys(payments).length?Object.entries(payments).sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<div class="stat-line"><div class="stat-name">${e(name)}</div><div class="progress-track"><div class="progress-fill" style="width:${Math.max(2,value/topSales*100)}%"></div></div><span class="stat-number">${money(value)}</span></div>`).join(''):empty('▥','No sales in this period','Try selecting a longer date range.')}</section><section class="card section-card"><div class="section-title"><h3>Best-selling products</h3><span class="muted small">Units sold</span></div>${best.length?best.map(x=>`<div class="stat-line"><div class="stat-name" title="${e(x.name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(x.name)}</div><div class="progress-track"><div class="progress-fill" style="width:${x.qty/topQty*100}%"></div></div><span class="stat-number">${x.qty} sold</span></div>`).join(''):empty('▤','No products sold yet','Create an invoice to see what sells best.')}</section></div>`;
}
function renderSettings(){const s=db.settings;return `${sectionHeader('Store settings','Personalise your invoices and manage your data.')}<div class="settings-grid"><div><section class="card setting-section"><h3>Business details</h3><p>This information appears on every new invoice.</p><form id="settingsForm"><div class="business-logo-uploader"><div id="businessLogoPreview" class="business-logo-preview">${logoMarkup(effectiveLogo(),'business-logo-preview-image')||'<span class="business-logo-placeholder" aria-hidden="true">▣</span>'}</div><div class="business-logo-controls"><label for="businessLogoFile">Business logo</label><span>Displayed beside your shop name on invoices and saved PDFs. Use PNG, JPG or WebP, up to 4 MB.</span><div class="business-logo-buttons"><label for="businessLogoFile" class="btn btn-sm business-logo-upload">↑ Upload logo</label><button id="removeBusinessLogo" type="button" class="btn btn-sm" data-action="remove-business-logo" ${safeLogoUrl(effectiveLogo())?'':'hidden'}>Remove logo</button></div><input id="businessLogoFile" type="file" accept="image/png,image/jpeg,image/webp" class="business-logo-file" aria-label="Choose business logo"><small id="businessLogoState" class="field-hint" aria-live="polite">${pendingLogo!==null?'New logo selected. Click Save settings to apply.':'Logo is saved with your business details.'}</small></div></div><div class="form-grid">${field('Business / shop name','businessName',s.businessName,'text','required maxlength="80"')}${field('Owner / contact name','owner',s.owner,'text','maxlength="80"')}${field('Phone number','phone',s.phone,'tel','maxlength="25"')}${field('Email address','email',s.email,'email','maxlength="100"')}${field('GSTIN (optional)','gstin',s.gstin,'text','maxlength="15" style="text-transform:uppercase"')}<div class="field"><label for="state">Business state / UT</label><select name="state" id="state">${stateOptions(s.state)}</select></div><div class="field full"><label for="address">Business address</label><textarea id="address" name="address" maxlength="240">${e(s.address)}</textarea></div></div><div class="thin-line"></div><h3>Billing preferences</h3><p>Choose how prices are stored. This affects GST calculations on new invoices.</p><div class="form-grid"><div class="field"><label for="invoicePrefix">Invoice prefix</label><input id="invoicePrefix" name="invoicePrefix" value="${e(s.invoicePrefix)}" maxlength="12" required></div><div class="field"><label for="taxMode">Product price includes GST?</label><select id="taxMode" name="taxMode"><option value="exclusive" ${s.taxMode==='exclusive'?'selected':''}>No, add GST</option><option value="inclusive" ${s.taxMode==='inclusive'?'selected':''}>Yes, GST included</option></select></div></div><div class="thin-line"></div><h3>UPI payment QR</h3><p class="settings-term-help">Enter the UPI ID that should receive payments. New UPI invoices will include a QR for their exact payable total.</p><div class="field"><label for="upiId">Receiving UPI ID</label><input id="upiId" name="upiId" type="text" maxlength="100" autocomplete="off" placeholder="shop@upi" value="${e(s.upiId||'')}"><span class="field-hint">Verify this ID in your bank or UPI app. QR generation does not confirm receipt.</span></div><p class="mini-note">Next invoice: ${e(s.invoicePrefix)}-${String(s.nextInvoice).padStart(4,'0')}. GST rates must be verified for each product.</p><div class="thin-line"></div><h3>Invoice Terms &amp; Conditions</h3><p class="settings-term-help">Write the terms you want customers to see. They will appear at the bottom-left of each new bill. Leave this blank to hide the section.</p><div class="field"><label for="termsAndConditions">Terms &amp; Conditions</label><textarea id="termsAndConditions" name="termsAndConditions" class="terms-editor" rows="6" maxlength="2000" placeholder="Example: Goods once sold may be returned within 7 days with the original receipt.">${e(s.termsAndConditions||'')}</textarea><span class="field-hint">Maximum 2,000 characters. Line breaks are preserved. Existing invoices keep the terms saved when they were issued.</span></div><div class="thin-line"></div><h3>Invoice footer message</h3><p class="settings-term-help">Customise the two lines shown below the bill. Leave either field empty to hide that line.</p><div class="field"><label for="invoiceThankYou">Thank-you message</label><input id="invoiceThankYou" name="invoiceThankYou" maxlength="160" placeholder="Thank you for your business!" value="${e(s.invoiceThankYou??'Thank you for your business!')}"></div><div class="field" style="margin-top:12px"><label for="invoiceFooterNote">Second footer line</label><input id="invoiceFooterNote" name="invoiceFooterNote" maxlength="200" placeholder="Invoice generated with BillNest" value="${e(s.invoiceFooterNote??'Invoice generated with BillNest')}"></div><span class="field-hint">These messages are saved on new invoices. Previously issued invoices are not changed.</span><div style="margin-top:22px"><button class="btn btn-primary" type="submit">Save settings</button></div></form></section></div><div>${globalThis.BillNestCloud?.settingsMarkup?.()||''}<section class="card setting-section"><h3>Data & backup</h3><p>Your store data lives in this browser. It does not automatically sync across devices or to GitHub.</p><div class="help-row"><div class="help-icon">↓</div><div style="flex:1"><b>Download backup</b><p>Save products, customers, stock movements, invoices, accounting transactions and opening balances as JSON.</p><button class="btn btn-sm" style="margin-top:10px" data-action="backup">Download JSON</button></div></div><div class="help-row"><div class="help-icon">↑</div><div style="flex:1"><b>Restore backup</b><p>Replaces the current browser workspace with a backup file.</p><button class="btn btn-sm" style="margin-top:10px" data-action="choose-import">Import JSON</button><input id="importFile" type="file" accept=".json,application/json" hidden></div></div><div class="thin-line"></div><div class="help-row"><div class="help-icon" style="background:#fff1ee;color:#c15a4d">!</div><div style="flex:1"><b>Reset workspace</b><p>Erase this browser's current store and accounting data. Export a backup first.</p><button class="btn btn-danger btn-sm" style="margin-top:10px" data-action="reset-data">Clear all data</button></div></div></section><section class="card setting-section" style="margin-top:18px"><h3>Before using real invoices</h3><p>Confirm your GST registration, product HSN/SAC, applicable tax rates, invoice particulars and local compliance requirements with a qualified tax professional. This is a starter billing app, not certified GST software.</p><span class="chip green">✓ No external libraries required</span></section></div></div>`}
function openModal(type,id=null){ui.modal=type;ui.editId=id;renderModal()}
function closeModal(){ui.modal=null;ui.editId=null;ui.scanCode='';ui.addAfterScan=false;$('#modalLayer').innerHTML=''}
function shellModal(title,desc,body,footer='',cls=''){return `<div class="modal-overlay" role="presentation"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${e(title)}"><div class="modal-header"><div><h2>${title}</h2><p>${desc}</p></div><button type="button" class="modal-x" data-action="close-modal" aria-label="Close">×</button></div>${body}${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`}
function renderModal(){let h='';
 if(ui.modal==='product'){
  const p=db.products.find(x=>x.id===ui.editId)||{};const editing=Boolean(p.id);const newCode=editing?(p.barcode||''):ui.scanCode;
  h=shellModal(editing?'Edit product':'Add a product',editing?'Update product information.':'Enter the details for your new product.',`<form id="productForm"><div class="modal-body"><div class="form-grid">${field('Product name *','name',p.name||'','text','required maxlength="100"')}${field('SKU / item code *','sku',p.sku||(newCode||'').slice(0,40),'text','required maxlength="40"')}${field('Barcode / EAN / UPC','barcode',newCode,'text','maxlength="80" autocomplete="off"')}<div class="field full scan-in-form"><button type="button" class="btn btn-scan" data-action="scan-product-field">▣ Scan barcode with camera</button><span class="field-hint">Barcode identifies the item. Enter its name, prices and GST manually.</span></div>${field('Category','category',p.category||'','text','maxlength="40"')}${field('Unit','unit',p.unit||'pcs','text','required maxlength="16"')}${field('Selling price (₹) *','price',p.price??'','number','required min="0" step="0.01"')}${field('Purchase cost (₹)','cost',p.cost??'','number','min="0" step="0.01"')}${field('Opening stock','stock',p.stock??0,'number',`required min="0" step="1" ${editing?'readonly title="Use Stock button to update inventory"':''}`)}${field('Low stock alert at','lowStock',p.lowStock??5,'number','required min="0" step="1"')}${field('Expiry date (optional)','expiryDate',p.expiryDate||'','date')}<div class="field full expiry-form-note"><span class="field-hint">Receive a warning 30 days before expiry. Each product currently supports one expiry date.</span></div><div class="field full"><label for="gst">GST rate (%)</label><input id="gst" name="gst" type="number" required min="0" max="100" step="0.01" value="${e(p.gst??18)}"><span class="field-hint">Common rates include 0%, 5%, 18% and 40%. Check the applicable rate for each product.</span></div></div>${editing?`<p class="field-hint" style="margin:13px 0 0">Use “+ Stock” on the inventory page to change stock and record a movement.</p>`:''}</div><div class="modal-footer">${editing?'<button type="button" class="btn btn-danger" data-action="delete-product">Delete product</button>':''}<span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?'Save changes':'Add product'}</button></div></form>`);
 }
 if(ui.modal==='customer'){
 const c=db.customers.find(x=>x.id===ui.editId)||{};const editing=Boolean(c.id);
 h=shellModal(editing?'Edit customer':'Add customer','Customer details for invoices.',`<form id="customerForm"><div class="modal-body"><div class="form-grid">${field('Customer / business name *','name',c.name||'','text','required maxlength="90"')}${field('Phone','phone',c.phone||'','tel','maxlength="25"')}${field('Email','email',c.email||'','email','maxlength="100"')}${field('GSTIN (optional)','gstin',c.gstin||'','text','maxlength="15"')}<div class="field full"><label for="customerState">State / UT</label><select id="customerState" name="state">${stateOptions(c.state||'')}</select></div><div class="field full"><label for="customerAddress">Address</label><textarea name="address" id="customerAddress" maxlength="240">${e(c.address||'')}</textarea></div></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?'Save changes':'Add customer'}</button></div></form>`);
 }
 if(ui.modal==='stock'){
 const p=db.products.find(x=>x.id===ui.editId);if(!p)return closeModal();
 h=shellModal('Update stock',`${p.name} · Current quantity ${p.stock}`,`<form id="stockForm"><div class="modal-body"><div class="field"><label for="stockMode">Stock update</label><select id="stockMode" name="mode"><option value="add">Stock received (+)</option><option value="set">Set exact available stock</option></select></div><div class="field" style="margin-top:14px"><label for="stockQty">Quantity *</label><input id="stockQty" name="quantity" type="number" min="0" step="1" required placeholder="Enter quantity"></div><div class="field" style="margin-top:14px"><label for="stockReason">Note (optional)</label><input id="stockReason" name="reason" maxlength="120" placeholder="Supplier delivery, stock count, damage..."></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Update stock</button></div></form>`,'','small-modal');
 }
 if(ui.modal==='accounting'){
  const type=Object.keys(ACCOUNT_TYPES).filter(type=>type!=='customer-receipt');
  const current=type.includes(ui.editId)?ui.editId:'expense';
  h=shellModal('New accounting transaction','Record business movements in cash or bank. Invoiced sales are automatic.',`<form id="accountingForm"><div class="modal-body"><div class="form-grid">
   <div class="field"><label for="bookType">Transaction type</label><select id="bookType" name="type">${type.map(key=>`<option value="${key}" ${current===key?'selected':''}>${e(ACCOUNT_TYPES[key])}</option>`).join('')}</select></div>
   ${field('Date','date',today(),'date','required')}
   ${field('Amount (INR)','amount','','number','required min="0.01" step="0.01" max="9999999"')}
   <div class="field"><label for="bookAccount">Paid from / received in</label><select id="bookAccount" name="account"><option value="cash">Cash</option><option value="bank">Bank / UPI / Card</option></select></div>
   <div class="field"><label for="bookToAccount">Transfer destination (transfers only)</label><select id="bookToAccount" name="toAccount"><option value="bank">Bank / UPI</option><option value="cash">Cash</option></select></div>
   ${field('Category','category',current==='expense'?'Rent / Utilities / Travel / Salary':'','text','maxlength="60"')}
   <div class="field full">${field('Description','description','','text','required maxlength="140"')}</div>
   </div><p class="accounting-note">Stock purchases reduce cash/bank but are not counted as operating expenses, because the cost of sold inventory is already used in gross profit. Update stock separately in Inventory.</p></div><div class="modal-footer"><button class="btn" type="button" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save transaction</button></div></form>`,'small-modal');
 }
 if(ui.modal==='opening'){
  h=shellModal('Opening balances','Balances before transactions and invoices already in this BillNest workspace.',`<form id="openingForm"><div class="modal-body"><p class="accounting-note">Enter opening amounts once. Recorded paid invoices and cashbook transactions will be added on top, so do not enter a current closing balance.</p><div class="form-grid">${field('Opening cash (INR)','cash',rupees(db.accounting.opening.cash),'number','required min="0" step="0.01"')}${field('Opening bank (INR)','bank',rupees(db.accounting.opening.bank),'number','required min="0" step="0.01"')}</div></div><div class="modal-footer"><button class="btn" type="button" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save balances</button></div></form>`,'small-modal');
 }
 if(ui.modal==='receipt'){
  const inv=db.invoices.find(x=>x.id===ui.editId),due=inv?invoiceOutstanding(inv,db.accounting.entries):0;
  if(!inv||due<=0)return closeModal();
  h=shellModal('Receive invoice payment',`${e(inv.number)} · Outstanding ${money(due)}`,`<form id="receiptForm"><div class="modal-body"><p>Customer: <b>${e(inv.customer?.name||'Walk-in customer')}</b></p><div class="form-grid">${field('Amount received (INR)','amount',rupees(due).toFixed(2),'number',`required min="0.01" max="${rupees(due).toFixed(2)}" step="0.01"`)}${field('Payment date','date',today(),'date','required')}<div class="field"><label for="receiptAccount">Received in</label><select id="receiptAccount" name="account"><option value="cash" ${inv.payment==='Cash'?'selected':''}>Cash</option><option value="bank" ${inv.payment!=='Cash'?'selected':''}>Bank / UPI / Card</option></select></div>${field('Payment reference','description','','text','maxlength="140"')}</div></div><div class="modal-footer"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save payment</button></div></form>`,'small-modal');
 }
 if(ui.modal==='invoice'){
 const inv=db.invoices.find(x=>x.id===ui.invoiceId);if(!inv)return closeModal();
 const paymentAction=inv.payment==='UPI'&&invoiceOutstanding(inv,db.accounting.entries)>0?'<button class="btn btn-primary" data-action="record-receipt" data-id="'+e(inv.id)+'">✓ Record verified payment</button>':'';
 h=shellModal(`Invoice ${e(inv.number)}`,`${formatDate(inv.date)} · ${inv.paid?'Paid':'Unpaid'}`,`<div class="modal-body">${invoicePaper(inv)}</div>`,`${paymentAction}<button class="btn" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="print-invoice" data-id="${inv.id}">▤ Print / Save as PDF</button>`,'invoice-modal');
 }
 $('#modalLayer').innerHTML=h;
 if(ui.modal==='invoice')drawInvoiceUpiQr($('#modalLayer'));
 $('#modalLayer input:not([readonly]),#modalLayer select')?.focus({preventScroll:true});
}
function upiInvoiceSection(inv,b){
 if(inv.payment!=='UPI')return '';
 const due=invoiceOutstanding(inv,db.accounting.entries);
 if(due<=0)return '';
 const upiId=String(b.upiId||'').trim();
 if(!isValidUpiId(upiId))return '<section class="invoice-upi-payment"><p>Receiving UPI ID was not configured when this invoice was issued.</p></section>';
 let intent='';
 try{intent=buildUpiIntent({upiId,payeeName:b.businessName||'My Store',amountPaise:due,reference:'BN'+String(inv.id||'').replace(/[^A-Za-z0-9]/g,''),invoiceNumber:inv.number})}catch{return ''}
 return '<section class="invoice-upi-payment" aria-label="UPI payment QR">'
 + '<h4>Pay by UPI</h4><div class="invoice-upi-qr" data-upi-uri="'+e(intent)+'" role="img" aria-label="Scan QR to pay '+e(rupees(due).toFixed(2))+' rupees">Preparing payment QR…</div>'
 + '<strong class="invoice-upi-amount">'+money(due)+'</strong>'
 + '<span class="invoice-upi-payee">Receiving UPI ID: '+e(upiId)+'</span>'
 + '<a class="invoice-upi-open" href="'+e(intent)+'">Open UPI payment app</a>'
 + '<p class="invoice-upi-warning">Verify the payment in your bank or UPI app before marking this invoice paid. Scanning a QR does not confirm receipt.</p></section>';
}
function drawInvoiceUpiQr(root){
 if(!root?.querySelectorAll)return;
 for(const target of root.querySelectorAll('.invoice-upi-qr[data-upi-uri]')){
  if(typeof globalThis.QRCode!=='function'){target.textContent='QR unavailable. Use the receiving UPI ID shown below.';continue}
  try{
   const uri=target.dataset.upiUri;
   target.innerHTML='';
   new globalThis.QRCode(target,{text:uri,width:192,height:192,colorDark:'#101e30',colorLight:'#ffffff',correctLevel:globalThis.QRCode.CorrectLevel.M});
   const canvas=target.querySelector('canvas');
   if(canvas&&typeof canvas.toDataURL==='function'){
    const image=canvas.toDataURL('image/png');
    if(/^data:image\/png;base64,/.test(image))target.innerHTML='<img alt="UPI payment QR" width="192" height="192" src="'+image+'">';
   }
  }catch(err){console.warn('QR render error:',err);target.textContent='Unable to display QR. Check the receiving UPI ID below.'}
 }
}

function invoicePaper(inv){const b=inv.business||db.settings,c=inv.customer||{};
 const printedTerms=String(b.termsAndConditions||'').trim();
 const upiMarkup=upiInvoiceSection(inv,b);
 const termsMarkup=printedTerms?`<section class="invoice-terms" aria-label="Invoice terms and conditions"><h4>Terms &amp; Conditions</h4><p>${e(printedTerms)}</p></section>`:'';
 let taxLines = inv.taxType==='intra' ? `<div class="summary-row"><span>CGST</span><b>${money(inv.cgst)}</b></div><div class="summary-row"><span>SGST</span><b>${money(inv.sgst)}</b></div>`:inv.taxType==='inter'?`<div class="summary-row"><span>IGST</span><b>${money(inv.igst)}</b></div>`:`<div class="summary-row"><span>GST (split not specified)</span><b>${money(inv.tax)}</b></div>`;
 return `<article class="invoice-paper printable-invoice">${resolveBusinessLogo(b)?`<div class="invoice-logo-top">${logoMarkup(resolveBusinessLogo(b))}</div>`:''}<div class="invoice-head"><div class="invoice-business-block"><div class="invoice-business-details"><div class="invoice-business">${e(b.businessName||'My Store')}</div>${b.owner?`<p>${e(b.owner)}</p>`:''}${b.address?`<p>${e(b.address)}</p>`:''}${b.state?`<p>${e(b.state)}</p>`:''}<p>${[b.phone,b.email].filter(Boolean).map(e).join(' · ')}</p>${b.gstin?`<p><b>GSTIN:</b> ${e(b.gstin)}</p>`:''}</div></div><div><div class="invoice-title">INVOICE</div><p style="text-align:right"><b>${e(inv.number)}</b></p>${inv.demo?'<span class="chip yellow">SAMPLE · NOT FOR USE</span>':''}</div></div><div class="invoice-meta"><div><b>BILL TO</b><p><strong>${e(c.name||'Walk-in customer')}</strong></p>${c.address?`<p>${e(c.address)}</p>`:''}${c.state?`<p>${e(c.state)}</p>`:''}${c.phone?`<p>${e(c.phone)}</p>`:''}${c.gstin?`<p>GSTIN: ${e(c.gstin)}</p>`:''}</div><div style="text-align:right"><b>INVOICE DETAILS</b><p>Date: ${formatDate(inv.date)}</p><p>Payment: ${e(inv.payment)}</p><p>Status: ${invoiceOutstanding(inv,db.accounting.entries)===0?'Paid':invoiceOutstanding(inv,db.accounting.entries)===inv.total?'Unpaid':`Part paid (due ${money(invoiceOutstanding(inv,db.accounting.entries))})`}</p></div></div><div class="table-scroll"><table class="invoice-print-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th style="text-align:right">Amount</th></tr></thead><tbody>${inv.lines.map(x=>`<tr><td>${e(x.name)}<div style="font-size:10px;color:#8a99a6">${e(x.sku||'')}</div></td><td>${x.qty} ${e(x.unit)}</td><td>${money(x.unitPrice)}</td><td>${pct(x.gst)}</td><td style="text-align:right">${money(x.total)}</td></tr>`).join('')}</tbody></table></div><div class="invoice-bottom"><div class="invoice-bottom-left">${inv.notes?`<p class="invoice-notes"><strong>Note:</strong> ${e(inv.notes)}</p>`:''}${termsMarkup}</div><div class="invoice-total"><div class="summary-row"><span>Items subtotal ${inv.inclusive?'(incl. GST)':''}</span><b>${money(inv.list)}</b></div>${inv.discount?`<div class="summary-row"><span>Discount (${inv.discountPercent}%)</span><b>− ${money(inv.discount)}</b></div>`:''}<div class="summary-row"><span>Taxable amount</span><b>${money(inv.taxable)}</b></div>${taxLines}<div class="summary-row total"><span>Total</span><b>${money(inv.total)}</b></div></div></div>${upiMarkup}<div class="invoice-footer">${String(b.invoiceThankYou??'Thank you for your business!').trim()?`<div class="invoice-footer-primary">${e(String(b.invoiceThankYou??'Thank you for your business!').trim())}</div>`:''}${String(b.invoiceFooterNote??'Invoice generated with BillNest').trim()?`<div class="invoice-footer-secondary">${e(String(b.invoiceFooterNote??'Invoice generated with BillNest').trim())}</div>`:''}</div></article>`;
}
function downloadFile(name,content,mime){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function exportProducts(){const rows=[['SKU','Product','Category','Unit','Selling price INR','Purchase cost INR','Stock','Low stock level','GST percent','Barcode','Expiry date']];db.products.forEach(p=>rows.push([p.sku,p.name,p.category,p.unit,p.price,p.cost,p.stock,p.lowStock,p.gst,p.barcode||'',p.expiryDate||'']));downloadFile(`billnest-products-${today()}.csv`,'\ufeff'+csvEncode(rows),'text/csv;charset=utf-8')}
function exportAccounting(){
 const summary=accountingStats();
 const rows=[['Date','Type','Description','Account','Cash change INR','Bank change INR','Category','Linked invoice']];
 summary.cashbook.forEach(row=>rows.push([row.date,ACCOUNT_TYPES[row.type]||'Invoice payment',row.label,row.account==='cash'?'Cash':'Bank / UPI',rupees(row.cash).toFixed(2),rupees(row.bank).toFixed(2),row.category||'',row.invoiceId||'']));
 downloadFile(`billnest-cashbook-${today()}.csv`,'\ufeff'+csvEncode(rows),'text/csv;charset=utf-8');toast('Cashbook exported.');
}
function exportInvoices(){const rows=[['Invoice','Date','Customer','Payment','Payment status','Taxable INR','GST INR','Total INR','Number of items']];db.invoices.forEach(i=>rows.push([i.number,i.date,i.customer?.name||'Walk-in customer',i.payment,i.paid?'Paid':'Unpaid',rupees(i.taxable).toFixed(2),rupees(i.tax).toFixed(2),rupees(i.total).toFixed(2),i.lines.reduce((s,l)=>s+l.qty,0)]));downloadFile(`billnest-invoices-${today()}.csv`,'\ufeff'+csvEncode(rows),'text/csv;charset=utf-8')}
function saveInvoice(){
 if(!ui.cart.length)return toast('Add at least one product.','error');
 if(ui.payment==='UPI'&&!isValidUpiId(db.settings.upiId))return toast('Set a valid receiving UPI ID in Store Settings before generating a UPI invoice.','error');
 let summary;const customer=db.customers.find(c=>c.id===ui.billingCustomer)||{name:'Walk-in customer',state:db.settings.state};
 try{summary=calculateInvoice(ui.cart,productsMap(),ui.discount,db.settings,customer)}catch(err){return toast(err.message,'error')}
 const invoice={id:uid(),number:`${db.settings.invoicePrefix}-${String(db.settings.nextInvoice).padStart(4,'0')}`,date:today(),createdAt:new Date().toISOString(),customer:{...customer},business:{...db.settings},payment:ui.payment,paid:ui.payment!=='Credit'&&ui.payment!=='UPI',notes:ui.billNotes,...summary,demo:db.demo};
 const prior=JSON.stringify(db);
 for(const line of summary.lines){const p=db.products.find(x=>x.id===line.productId);p.stock-=line.qty;db.movements.push({id:uid(),productId:p.id,change:-line.qty,reason:'Sale '+invoice.number,date:invoice.date,createdAt:invoice.createdAt})}
 db.invoices.push(invoice);db.settings.nextInvoice++;
 if(!save()){db=JSON.parse(prior);return}
 ui.cart=[];ui.discount=0;ui.billingSearch='';ui.billNotes='';ui.invoiceId=invoice.id;ui.modal='invoice';render();
 if(invoice.payment==='UPI')$('#modalLayer')?.querySelector?.('.invoice-upi-payment')?.scrollIntoView?.({behavior:'auto',block:'center'});
 toast(`Invoice ${invoice.number} saved. Stock updated.`)
}
function handleAction(action,id){switch(action){
 case 'add-product':ui.scanCode='';ui.addAfterScan=false;ui.editId=null;openModal('product');break;
 case 'scan-inventory':openScanner('inventory');break;
 case 'scan-billing':openScanner('billing');break;
 case 'scan-product-field':openScanner('product');break;
 case 'close-scanner':stopScanner();break;
 case 'scanner-retry':retryScannerCamera();break;
 case 'scanner-switch':retryScannerCamera(scanner.facing==='environment'?'user':'environment');break;
 case 'scanner-torch':toggleScannerTorch();break;
 case 'scanner-focus':refocusScanner();break;
 case 'edit-product':openModal('product',id);break;
 case 'delete-product':{
  const p=db.products.find(x=>x.id===ui.editId);if(!p)return;
  if(!confirm(`Delete ${p.name} from active inventory? Existing invoices will be preserved.`))return;
  db.products=db.products.filter(x=>x.id!==p.id);ui.cart=ui.cart.filter(x=>x.productId!==p.id);save();closeModal();render();toast('Product removed.');break;
 }
 case 'stock':openModal('stock',id);break;
 case 'add-customer':openModal('customer');break;
 case 'edit-customer':openModal('customer',id);break;
 case 'close-modal':closeModal();break;
 case 'overlay-close':break;
 case 'new-bill':navigate('billing');break;
 case 'add-to-cart':{
  const p=db.products.find(x=>x.id===id);if(!p || p.stock<=0)return;
  const prev=ui.cart.find(x=>x.productId===id);if(prev){if(prev.qty>=p.stock)return toast('Not enough stock available.','error');prev.qty++}else ui.cart.push({productId:id,qty:1});render();break;
 }
 case 'remove-cart':ui.cart=ui.cart.filter(x=>x.productId!==id);render();break;
 case 'increase-qty':{const x=ui.cart.find(x=>x.productId===id),p=db.products.find(x=>x.id===id);if(x&&p&&x.qty<p.stock)x.qty++;else toast('Not enough stock.','error');render();break}
 case 'decrease-qty':{const x=ui.cart.find(x=>x.productId===id);if(x){x.qty--;if(x.qty<=0)ui.cart=ui.cart.filter(y=>y.productId!==id)}render();break}
 case 'add-accounting':openModal('accounting','expense');break;
 case 'opening-balances':openModal('opening');break;
 case 'record-receipt':openModal('receipt',id);break;
 case 'delete-accounting':{
   const entry=db.accounting.entries.find(x=>x.id===id);if(!entry)return;
   if(!confirm(`Delete this ${ACCOUNT_TYPES[entry.type]||'transaction'} record? This will change cash/bank balances.${entry.type==='customer-receipt'?' Its invoice may become unpaid again.':''}`))return;
   const previous=JSON.stringify(db);
   db.accounting.entries=db.accounting.entries.filter(x=>x.id!==id);
   if(entry.type==='customer-receipt'){const inv=db.invoices.find(x=>x.id===entry.invoiceId);if(inv)inv.paid=false}
   if(!save()){db=JSON.parse(previous);return}
   render();toast('Transaction deleted.');break;
 }
 case 'export-accounting':exportAccounting();break;
 case 'save-invoice':saveInvoice();break;
 case 'view-invoice':ui.invoiceId=id;openModal('invoice');break;
 case 'print-invoice':{const inv=db.invoices.find(i=>i.id===id);if(!inv)return;$('#printLayer').innerHTML=invoicePaper(inv);drawInvoiceUpiQr($('#printLayer'));window.print();break}
 case 'mark-paid':openModal('receipt',id);break
 case 'export-products':exportProducts();break;
 case 'export-invoices':exportInvoices();break;
 case 'remove-business-logo':pendingLogo='';paintLogoPreview();break;
 case 'backup':downloadFile(`billnest-backup-${today()}.json`,JSON.stringify(db,null,2),'application/json');toast('Backup downloaded.');break;
 case 'choose-import':$('#importFile')?.click();break;
 case 'reset-data':if(confirm('This will permanently clear all products, invoices, customers and settings saved in this browser. Have you downloaded a backup?')){db=emptyDb();if(save()){ui={...ui,page:'dashboard',modal:null,cart:[],billingCustomer:'',billingSearch:'',search:''};render();toast('Workspace cleared. Start by adding a product.')}}break;
 }}
function validateNonnegative(n,name,integer=false){if(!Number.isFinite(n)||n<0||integer&&!Number.isInteger(n))throw Error('Enter a valid '+name+'.')}
function handleForm(form){const data=Object.fromEntries(new FormData(form));try{
 if(form.id==='accountingForm'){
   const type=String(data.type||''),date=String(data.date||''),amount=toPaise(data.amount);
   if(!Object.keys(ACCOUNT_TYPES).includes(type)||type==='customer-receipt')throw Error('Select a valid transaction type.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T12:00:00').getTime()))throw Error('Enter a valid transaction date.');
   if(!Number.isSafeInteger(amount)||amount<=0||amount>999999900)throw Error('Amount must be between ₹0.01 and ₹99,99,999.');
   if(!['cash','bank'].includes(data.account))throw Error('Select Cash or Bank.');
   if(type==='transfer'&&!['cash','bank'].includes(data.toAccount)||type==='transfer'&&data.toAccount===data.account)throw Error('Transfer destination must be the other account.');
   const description=String(data.description||'').trim().slice(0,140),category=String(data.category||'').trim().slice(0,60);
   if(!description)throw Error('Enter a description.');
   const entry={id:uid(),createdAt:new Date().toISOString(),date,type,account:data.account,
     toAccount:type==='transfer'?data.toAccount:'',amount,category,description};
   db.accounting.entries.push(entry);
   if(!save()){db.accounting.entries.pop();return}
   closeModal();render();toast('Accounting transaction saved.');
 }
 if(form.id==='openingForm'){
   const cash=toPaise(data.cash),bank=toPaise(data.bank);
   if(!Number.isSafeInteger(cash)||cash<0||!Number.isSafeInteger(bank)||bank<0||cash>1_000_000_000_00||bank>1_000_000_000_00)throw Error('Enter valid non-negative opening balances.');
   const before={...db.accounting.opening};db.accounting.opening={cash,bank};
   if(!save()){db.accounting.opening=before;return}
   closeModal();render();toast('Opening balances saved.');
 }
 if(form.id==='receiptForm'){
   const inv=db.invoices.find(x=>x.id===ui.editId);if(!inv)throw Error('Invoice not found.');
   const due=invoiceOutstanding(inv,db.accounting.entries),amount=toPaise(data.amount);
   if(!Number.isSafeInteger(amount)||amount<=0||amount>due)throw Error('Receipt must be greater than zero and not exceed the outstanding balance.');
   const date=String(data.date||'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T12:00:00').getTime())||date<inv.date)throw Error('Payment date must be on or after the invoice date.');
   if(!['cash','bank'].includes(data.account))throw Error('Select Cash or Bank.');
   const prevPaid=inv.paid;
   db.accounting.entries.push({id:uid(),date,createdAt:new Date().toISOString(),type:'customer-receipt',invoiceId:inv.id,account:data.account,amount,category:'Customer receipt',description:String(data.description||'').trim().slice(0,140)||`Receipt for ${inv.number}`});
   inv.paid=amount===due;
   if(!save()){db.accounting.entries.pop();inv.paid=prevPaid;return}
   closeModal();render();toast(inv.paid?'Invoice paid in full.':'Partial payment recorded.');
 }
 if(form.id==='productForm'){
  const name=data.name.trim(),sku=data.sku.trim().toUpperCase(),barcode=cleanBarcode(data.barcode),price=Number(data.price),cost=data.cost===''?0:Number(data.cost),stock=Number(data.stock),lowStock=Number(data.lowStock),expiryDate=String(data.expiryDate||'').trim();
  if(!name||!sku)throw Error('Product name and SKU are required.');
  if(expiryDate&&expiryStatus(expiryDate).state==='invalid')throw Error('Enter a valid expiry date.');
  validateNonnegative(price,'selling price');validateNonnegative(cost,'purchase cost');validateNonnegative(stock,'stock',true);validateNonnegative(lowStock,'low stock level',true);if(data.gst===""||!Number.isFinite(Number(data.gst))||Number(data.gst)<0||Number(data.gst)>100)throw Error("Enter a valid GST rate between 0 and 100%.");
  if(db.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==ui.editId))throw Error('Another product already has that SKU.');
  if(barcode&&db.products.some(p=>p.id!==ui.editId&&[p.barcode,p.sku].some(code=>String(code||'').toLowerCase()===barcode.toLowerCase())))throw Error('This barcode is already assigned to another product.');
  const attrs={name,sku,barcode,category:data.category.trim(),unit:data.unit.trim()||'pcs',price,cost,lowStock,gst:Number(data.gst),expiryDate};
  const old=db.products.find(p=>p.id===ui.editId);
  if(old)Object.assign(old,attrs);
  else db.products.push({id:uid(),...attrs,stock,createdAt:new Date().toISOString()});
  const addToBill=ui.addAfterScan&&!old;const productId=old?.id||db.products.at(-1).id;
  if(!save())return;closeModal();if(addToBill){navigate('billing');const added=db.products.find(p=>p.id===productId);if(added?.stock>0)ui.cart.push({productId,qty:1});render();toast(added?.stock>0?'Product created and added to bill.':'Product saved. Add stock before billing.')}else{render();toast(old?'Product updated.':'Product added to inventory.')}
 }
 if(form.id==='customerForm'){
  const name=data.name.trim();if(!name)throw Error('Customer name is required.');
  const attrs={name,phone:data.phone.trim(),email:data.email.trim(),gstin:data.gstin.trim().toUpperCase(),address:data.address.trim(),state:data.state};
  const old=db.customers.find(x=>x.id===ui.editId);
  if(old)Object.assign(old,attrs);else {const item={id:uid(),...attrs};db.customers.push(item);if(ui.page==='billing')ui.billingCustomer=item.id}
  save();closeModal();render();toast(old?'Customer updated.':'Customer added.');
 }
 if(form.id==='stockForm'){
  const p=db.products.find(x=>x.id===ui.editId),qty=Number(data.quantity);if(!p)throw Error('Product not found.');
  validateNonnegative(qty,'quantity',true);
  const prev=p.stock,next=data.mode==='set'?qty:prev+qty,change=next-prev;p.stock=next;
  if(change!==0)db.movements.push({id:uid(),productId:p.id,change,reason:data.reason.trim()||(data.mode==='set'?'Stock count correction':'Stock received'),date:today(),createdAt:new Date().toISOString()});
  save();closeModal();render();toast(`Stock updated to ${p.stock} ${p.unit}.`);
 }
 if(form.id==='settingsForm'){
  const prefix=data.invoicePrefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');if(!prefix)throw Error('Invoice prefix is required.');
  const upiId=String(data.upiId||'').trim();if(upiId&&!isValidUpiId(upiId))throw Error('Enter a valid receiving UPI ID (example: shop@upi).');
  const previousSettings=db.settings,previousAssets=db.logoAssets;
  const storedLogo=safeLogoUrl(effectiveLogo());
  const logoKey=storedLogo?logoKeyFor(storedLogo):'';
  db.logoAssets={...db.logoAssets};
  if(logoKey)db.logoAssets[logoKey]=storedLogo;
  db.settings={...db.settings,businessName:data.businessName.trim(),owner:data.owner.trim(),phone:data.phone.trim(),email:data.email.trim(),gstin:data.gstin.trim().toUpperCase(),address:data.address.trim(),state:data.state,taxMode:data.taxMode,upiId,invoicePrefix:prefix,termsAndConditions:String(data.termsAndConditions||'').trim().slice(0,2000),invoiceThankYou:String(data.invoiceThankYou??'').trim().slice(0,160),invoiceFooterNote:String(data.invoiceFooterNote??'').trim().slice(0,200),logoKey,logoDataUrl:''};
  if(!save()){db.settings=previousSettings;db.logoAssets=previousAssets;return}
  pendingLogo=null;render();toast('Business settings saved.');
 }
 }catch(err){toast(err.message,'error')}
}
function rerenderKeepFocus(selector,value){const old=document.activeElement;const pos=old?.selectionStart;render();const next=$(selector);if(next){next.focus();if(typeof pos==='number'&&next.setSelectionRange)try{next.setSelectionRange(pos,pos)}catch{}}}
async function importBackup(file){if(!file)return;try{
 const raw=await file.text();if(raw.length>10_000_000)throw Error('Backup file is too large.');const payload=JSON.parse(raw);
 if(payload.version!==1||!Array.isArray(payload.products)||!Array.isArray(payload.customers)||!Array.isArray(payload.invoices)||!Array.isArray(payload.movements)||!payload.settings||!Number.isInteger(payload.settings.nextInvoice)||payload.settings.nextInvoice<1)throw Error('This is not a valid BillNest v1 backup.');
 if(payload.products.length>100000||payload.invoices.length>100000)throw Error('Backup has too many records.');
 if(payload.accounting){
   const ac=payload.accounting;
   if(!ac||typeof ac!=='object'||!Array.isArray(ac.entries)||ac.entries.length>100000||ac.entries.some(row=>!row||typeof row.id!=='string'||!Number.isSafeInteger(row.amount)||row.amount<=0||!Object.keys(ACCOUNT_TYPES).includes(row.type)||!['cash','bank'].includes(row.account)||!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||''))))throw Error('Backup contains invalid accounting transactions.');
 }
 if(!payload.products.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isInteger(p.stock)&&p.stock>=0&&Number.isFinite(p.price)&&p.price>=0)||!payload.invoices.every(i=>i&&Array.isArray(i.lines)&&Number.isFinite(i.total)))throw Error('Backup contains invalid records.');
 if(!confirm(`Replace this workspace with ${payload.products.length} products and ${payload.invoices.length} invoices from the backup? Your current data will be overwritten.`))return;
 const old=db;db={...emptyDb(),...payload,settings:{...emptyDb().settings,...payload.settings},accounting:normaliseAccounting(payload.accounting)};if(!save()){db=old;return}ui={...ui,page:'dashboard',cart:[],modal:null};render();toast('Backup restored successfully.');
 }catch(err){toast('Import failed: '+err.message,'error')}finally{const f=$('#importFile');if(f)f.value=''}}

document.addEventListener('click',event=>{
 const filterJump=event.target.closest?.('[data-filter-jump]');if(filterJump){navigate('inventory');ui.filter=filterJump.dataset.filterJump==='expiring'?'expiring':'all';render();return;} 
 const backdrop=event.target.closest('.modal-overlay');if(backdrop&&event.target===backdrop){closeModal();return}
 const go=event.target.closest('[data-go]');if(go){navigate(go.dataset.go);return}
 const action=event.target.closest('[data-action]');if(action&&action.dataset.action!=='overlay-close'){event.preventDefault();handleAction(action.dataset.action,action.dataset.id);return}
});
document.addEventListener('submit',event=>{if(event.target.matches('#scanManualForm')){event.preventDefault();barcodeFound(new FormData(event.target).get('barcode'),true);return}if(event.target.matches('#productForm,#customerForm,#stockForm,#settingsForm,#accountingForm,#openingForm,#receiptForm')){event.preventDefault();handleForm(event.target)}});
document.addEventListener('input',event=>{
 const input=event.target;
 if(input.dataset.search){const key=input.dataset.search;const map={inventory:'search',billing:'billingSearch',sales:'salesSearch',customers:'customerSearch',profit:'profitSearch',accounting:'accountingSearch'};ui[map[key]]=input.value;rerenderKeepFocus(`[data-search="${key}"]`);}
 if(input.id==='billDiscount'){const n=Number(input.value);ui.discount=Math.max(0,Math.min(100,Number.isFinite(n)?n:0));rerenderKeepFocus('#billDiscount')}
 if(input.id==='billNotes')ui.billNotes=input.value;
 if(input.id==='scannerZoom')applyScannerZoom(input.value);
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.dataset.filter==='inventory'){ui.filter=t.value;render()}
 if(t.id==='billCustomer'){ui.billingCustomer=t.value;render()}
 if(t.id==='billPayment'){ui.payment=t.value;render()}
 if(t.id==='reportRange'){ui.reportRange=t.value;render()}
 if(t.id==='profitRange' && ['7','30','90','all'].includes(t.value)){ui.profitRange=t.value;render()}
 if(t.id==='accountingRange' && ['7','30','90','all'].includes(t.value)){ui.accountingRange=t.value;render()}
 if(t.id==='importFile')importBackup(t.files?.[0]);
 if(t.id==='businessLogoFile')convertBusinessLogo(t.files?.[0]);
 if(t.id==='barcodePhoto')scanBarcodeImage(t.files?.[0]);
 if(t.id==='scannerCamera')retryScannerCamera(undefined,t.value);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&scanner.open){stopScanner();return}if(event.key==='Escape'&&ui.modal)closeModal();if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();navigate('inventory');$('[data-search="inventory"]')?.focus()}});
$('#menuToggle').addEventListener('click',()=>{$('.sidebar').classList.toggle('open');let b=$('#backdrop');if(!b){b=document.createElement('div');b.id='backdrop';b.className='mobile-backdrop';document.body.appendChild(b);b.addEventListener('click',()=>{$('.sidebar').classList.remove('open');b.classList.remove('show')})}b.classList.toggle('show', $('.sidebar').classList.contains('open'))});
window.addEventListener('afterprint',()=>{$('#printLayer').innerHTML=''});
document.addEventListener('visibilitychange',()=>{if(!scanner.open)return;if(document.hidden){releaseScannerCamera();scannerStatus('Camera paused while this page is in the background.')}else if(!scanner.stream&&!scanner.controls){startScannerCamera()}});
window.addEventListener('pagehide',()=>{if(scanner.open)stopScanner()});
window.addEventListener('error',event=>{console.error('BillNest application error',event.error||event.message)});
// Online backup remains optional. Never replace the local workspace without user confirmation.
globalThis.BillNestCloud?.setWorkspaceReader?.(()=>db);
globalThis.BillNestCloud?.setRestoreHandler?.(payload=>{
 try{
  if(!payload||payload.version!==1||!payload.settings||!Number.isInteger(payload.settings.nextInvoice)||payload.settings.nextInvoice<1)return false;
  if(!Array.isArray(payload.products)||!Array.isArray(payload.invoices)||!Array.isArray(payload.customers)||!Array.isArray(payload.movements))return false;
  if(payload.products.length>100000||payload.invoices.length>100000||payload.customers.length>100000||payload.movements.length>200000)return false;
  if(!payload.products.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isInteger(p.stock)&&p.stock>=0&&Number.isFinite(p.price)&&p.price>=0))return false;
  if(!payload.invoices.every(i=>i&&Array.isArray(i.lines)&&Number.isSafeInteger(i.total)&&i.total>=0))return false;
  if(JSON.stringify(payload).length>8_000_000)return false;
  const old=db;
  db={...emptyDb(),...payload,settings:{...emptyDb().settings,...payload.settings},accounting:normaliseAccounting(payload.accounting)};
  if(!save()){db=old;return false}
  if(scanner.open)stopScanner();
  ui={...ui,page:'dashboard',modal:null,cart:[],billingSearch:'',billingCustomer:'',search:'',filter:'all'};
  render();
  toast('Cloud backup restored to this device. Local data is saved.');
  return true;
 }catch(err){console.warn('Cloud backup restore rejected',err);return false}
});
render();
