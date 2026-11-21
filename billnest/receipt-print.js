/* 58/80mm receipt printing plus optional direct ESC/POS over compatible Bluetooth LE GATT.
 * Paired Bluetooth Classic, USB and Wi-Fi printers work through the system print dialog.
 * This module never changes invoice records or marks a payment as received.
 */
(() => {
 'use strict';
 const KEY='billnest-receipt-paper-v1';
 const allowed=['58','80'];
 let paper='58';
 try{const saved=localStorage.getItem(KEY);if(allowed.includes(saved))paper=saved}catch{}
 const money=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format((Number(v)||0)/100);
 const asciiMoney=v=>'Rs.'+((Number(v)||0)/100).toFixed(2);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const hi=()=>globalThis.BillNestI18n?.language?.()==='hi';
 const label=(en,hindi)=>hi()?hindi:en;
 const itemCount=inv=>Array.isArray(inv.lines)?inv.lines.reduce((n,x)=>n+(Number(x.qty)||0),0):0;
 const safe=inv=>inv&&Array.isArray(inv.lines)&&inv.number&&inv.business;
 const lines=(text,width=32)=>{
  const words=String(text||'').split(/\s+/),out=[];let line='';
  for(const word of words){
   if(line&&line.length+word.length+1>width){out.push(line);line=''}
   if(word.length>width){if(line){out.push(line);line=''}for(let k=0;k<word.length;k+=width)out.push(word.slice(k,k+width))}
   else line+=(line?' ':'')+word;
  }
  if(line)out.push(line);return out;
 };
 const displayDate=value=>{
  if(!value)return '';
  const parsed=new Date(String(value).slice(0,10)+'T12:00:00');
  return Number.isFinite(parsed.getTime())?parsed.toLocaleDateString(hi()?'hi-IN':'en-IN'):(String(value).slice(0,30));
 };
 function buildHtml(inv,outstanding=0){
  if(!safe(inv))throw Error('Valid invoice is required.');
  const b=inv.business,c=inv.customer||{},tax=inv.taxType||'',due=Math.max(0,Number(outstanding)||0);
  const row=(name,amount,klass='')=>'<div class="r-row '+klass+'"><span>'+esc(name)+'</span><strong>'+esc(money(amount))+'</strong></div>';
  const meta=(name,value)=>value?'<div class="r-meta">'+esc(name)+': '+esc(value)+'</div>':'';
  const receiptLines=inv.lines.map(x=>'<div class="r-line"><strong>'+esc(x.name||'Item')+'</strong><div class="r-line-values"><span>'+esc(String(x.qty||0)+' × '+money(x.unitPrice||0))+(x.gst!==undefined?' · GST '+esc(x.gst)+'%':'')+'</span><b>'+esc(money(x.total||0))+'</b></div></div>').join('');
  const terms=String(b.termsAndConditions||'').trim();
  return '<div class="r-sheet" lang="'+(hi()?'hi':'en')+'">'+
   (inv.demo?'<div class="r-alert">SAMPLE · NOT FOR USE</div>':'')+
   '<h1>'+esc(b.businessName||'My Store')+'</h1>'+
   (b.address?'<p>'+esc(b.address)+'</p>':'')+
   meta(label('Phone','फ़ोन'),b.phone)+meta('GSTIN',b.gstin)+
   '<div class="r-rule"></div><h2>'+label('RECEIPT','रसीद')+'</h2>'+
   meta(label('Invoice','बिल नंबर'),inv.number)+meta(label('Date','तारीख'),displayDate(inv.date))+
   meta(label('Customer','ग्राहक'),c.name||label('Walk-in customer','सामान्य ग्राहक'))+
   meta(label('Payment','भुगतान'),inv.payment||'')+
   '<div class="r-rule"></div><div class="r-items">'+receiptLines+'</div><div class="r-rule"></div>'+
   row(label('Subtotal','उप-योग'),inv.list||0)+
   (inv.discount?row(label('Discount','छूट')+' '+(inv.discountPercent||0)+'%',-inv.discount):'')+
   row(label('Taxable','कर योग्य'),inv.taxable||0)+
   (tax==='intra'?row('CGST',inv.cgst||0)+row('SGST',inv.sgst||0):tax==='inter'?row('IGST',inv.igst||0):row('GST',inv.tax||0))+
   row(label('TOTAL','कुल राशि'),inv.total||0,'r-total')+
   (due?row(label('Amount due','बकाया राशि'),due):'<p class="r-paid">'+label('Payment recorded','भुगतान दर्ज')+'</p>')+
   (inv.notes?'<div class="r-extra"><b>'+label('Note','नोट')+':</b> '+esc(inv.notes)+'</div>':'')+
   (terms?'<div class="r-extra"><b>'+label('Terms','नियम')+':</b> '+esc(terms)+'</div>':'')+
   '<div class="r-rule"></div><div class="r-thanks">'+esc(b.invoiceThankYou??label('Thank you for your business!','खरीदारी के लिए धन्यवाद!'))+'</div>'+
   (b.invoiceFooterNote?'<p>'+esc(b.invoiceFooterNote)+'</p>':'')+
   '<p>BillNest</p></div>';
 }
 function popupPrint(inv,due){
  if(!safe(inv))throw Error('Cannot print an empty invoice.');
  // Call window.open synchronously from the invoice's click handler.
  const win=window.open('','_blank','width=480,height=700');
  if(!win){alert(label('Pop-up blocked. Allow pop-ups for BillNest to print receipts.','पॉप-अप अवरुद्ध है। रसीद प्रिंट के लिए पॉप-अप की अनुमति दें।'));return false}
  const pageWidth=paper==='80'?'80mm':'58mm';
  const css=[
   '@page{size:'+pageWidth+' auto;margin:0}',
   '*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:black}',
   'body{font:11px/1.35 Arial,"Noto Sans Devanagari",sans-serif}',
   '.r-sheet{width:'+pageWidth+';max-width:'+pageWidth+';padding:2mm 2.5mm;margin:0 auto;overflow-wrap:anywhere}',
   'h1{font-size:15px;text-align:center;margin:3px 0 5px}h2{font-size:12px;text-align:center;margin:5px 0}',
   'p{margin:3px 0;text-align:center;white-space:pre-wrap}',
   '.r-meta{font-size:10px;margin:3px 0}.r-rule{border-top:1px dashed #000;margin:9px 0}',
   '.r-line{padding:5px 0;page-break-inside:avoid}.r-line>strong{display:block;font-size:11px}',
   '.r-line-values{display:flex;justify-content:space-between;gap:8px;font-size:10px}',
   '.r-line-values>b{white-space:nowrap}.r-row{display:flex;justify-content:space-between;gap:6px;padding:2px 0}',
   '.r-row>span{flex:1}.r-row>strong{white-space:nowrap;font-size:11px}',
   '.r-total{border-top:1px solid;margin-top:5px;padding-top:6px;font-size:14px;font-weight:700}',
   '.r-total strong{font-size:14px}.r-paid{text-align:left;font-weight:700}',
   '.r-extra{font-size:10px;margin:8px 0;white-space:pre-wrap}',
   '.r-thanks{text-align:center;font-weight:700;margin:10px 0 3px}',
   '.r-alert{font-weight:700;text-align:center;border:1px solid;margin:4px 0;padding:4px}',
   '@media screen{body{background:#ddd;padding:16px}.r-sheet{background:white;min-height:100px;box-shadow:0 3px 20px #0002}}',
   '@media print{body{background:white;padding:0}.r-sheet{box-shadow:none}}'
  ].join('');
  win.document.open();
  win.document.write('<!doctype html><html lang="'+(hi()?'hi':'en')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+esc(inv.number)+' - BillNest receipt</title><style>'+css+'</style></head><body>'+buildHtml(inv,due)+'</body></html>');
  win.document.close();
  win.focus();
  // Printing is initiated from the user-triggered popup. Keep it open for reprint.
  win.addEventListener('load',()=>win.print(),{once:true});
  return true;
 }
 const pad=(s,n)=>String(s).slice(0,n).padEnd(n,' ');
 const right=(l,r,n)=>{l=String(l);r=String(r);return l.slice(0,Math.max(1,n-r.length-1)).padEnd(Math.max(1,n-r.length),' ')+r};
 function escposText(inv,due){
  const b=inv.business,c=inv.customer||{},cols=paper==='80'?42:30;
  const text=[String(b.businessName||'My Store'),b.address||'',b.phone?'Tel: '+b.phone:'',b.gstin?'GSTIN: '+b.gstin:'','-'.repeat(cols),
   'RECEIPT', 'Invoice: '+inv.number,'Date: '+String(inv.date||''),'Customer: '+(c.name||'Walk-in customer'),
   'Payment: '+(inv.payment||''),'-'.repeat(cols)];
  for(const line of inv.lines){
   text.push(...lines(line.name||'Item',cols));
   text.push(right((line.qty||0)+' x '+asciiMoney(line.unitPrice||0),asciiMoney(line.total||0),cols));
  }
  text.push('-'.repeat(cols));
  text.push(right('Taxable',asciiMoney(inv.taxable||0),cols));
  if(inv.taxType==='intra'){text.push(right('CGST',asciiMoney(inv.cgst||0),cols),right('SGST',asciiMoney(inv.sgst||0),cols))}
  else if(inv.taxType==='inter')text.push(right('IGST',asciiMoney(inv.igst||0),cols));
  else text.push(right('GST',asciiMoney(inv.tax||0),cols));
  if(inv.discount)text.push(right('Discount','-'+asciiMoney(inv.discount),cols));
  text.push(right('TOTAL',asciiMoney(inv.total||0),cols));
  if(due>0)text.push(right('DUE',asciiMoney(due),cols));
  text.push('-'.repeat(cols),String(b.invoiceThankYou||'Thank you!'),'BillNest','','','');
  const body=text.filter(x=>x!==undefined&&x!==null).join('\n')+'\n';
  // ESC/POS default codepage does not reliably support Devanagari or Unicode.
  if(/[^\x09\x0A\x0D\x20-\x7E]/.test(body))throw Error('Direct Bluetooth ESC/POS cannot safely print Hindi or Unicode names. Use system thermal print to preserve characters.');
  const encode=new TextEncoder();
  return new Uint8Array([0x1b,0x40,...encode.encode(body),0x1d,0x56,0x41,0x03]);
 }
 const SERVICE_MAP=[
  {service:0xffe0,chars:[0xffe1]},
  {service:0xff00,chars:[0xff02,0xff01]},
  {service:0x18f0,chars:[0x2af1]},
  {service:'49535343-fe7d-4ae5-8fa9-9fafd205e455',chars:['49535343-8841-43f4-a8d4-ecbe34729bb3']}
 ];
 async function printBluetooth(inv,due=0){
  if(!safe(inv))throw Error('Select an invoice to print.');
  if(!navigator.bluetooth?.requestDevice){alert('Direct Bluetooth LE is not supported in this browser. Use Print thermal receipt and choose your paired printer.');return false}
  // Validate before the device picker so no data is transmitted if characters are unsupported.
  let bytes;
  try{bytes=escposText(inv,due)}catch(err){alert(err.message);return false}
  // requestDevice runs before the first await to preserve the required user gesture.
  const choice=navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:SERVICE_MAP.map(x=>x.service)});
  try{
   const device=await choice;
   const server=await device.gatt.connect();
   let characteristic=null;
   for(const entry of SERVICE_MAP){
    try{
     const svc=await server.getPrimaryService(entry.service);
     for(const id of entry.chars){
      try{
       const candidate=await svc.getCharacteristic(id);
       if(candidate.properties.write||candidate.properties.writeWithoutResponse){characteristic=candidate;break}
      }catch{}
     }
    }catch{}
    if(characteristic)break;
   }
   if(!characteristic)throw Error('Printer does not expose a supported BLE ESC/POS write characteristic. Use system print or the printer vendor app.');
   for(let i=0;i<bytes.length;i+=20){
    const chunk=bytes.slice(i,i+20);
    if(characteristic.properties.writeWithoutResponse&&characteristic.writeValueWithoutResponse)await characteristic.writeValueWithoutResponse(chunk);
    else if(characteristic.writeValueWithResponse)await characteristic.writeValueWithResponse(chunk);
    else await characteristic.writeValue(chunk);
   }
   device.gatt.disconnect();
   alert('Receipt data sent to Bluetooth printer. Check the printed receipt.');
   return true;
  }catch(err){
   if(err?.name==='NotFoundError')return false;
   alert('Bluetooth printing failed: '+(err.message||String(err)));
   return false;
  }
 }
 const settingsMarkup=()=>'<section class="card setting-section" id="billnestPrinterSettings"><h3>🧾 '+label('Receipt printer','रसीद प्रिंटर')+'</h3>'+
  '<p>'+label('Print 58 mm or 80 mm receipts using your system printer, including paired Bluetooth, USB or Wi-Fi thermal printers.','सिस्टम प्रिंटर से 58 या 80 मिमी रसीद प्रिंट करें। ब्लूटूथ, USB और Wi-Fi प्रिंटर भी उपयोग कर सकते हैं।')+'</p>'+
  '<div class="field"><label for="billnestPaperWidth">'+label('Paper width','कागज़ की चौड़ाई')+'</label>'+
  '<select id="billnestPaperWidth" class="select-input"><option value="58" '+(paper==='58'?'selected':'')+'>58 mm</option><option value="80" '+(paper==='80'?'selected':'')+'>80 mm</option></select></div>'+
  '<p class="mini-note">'+label('For Bluetooth Classic printers, pair the printer in your device settings and use Print thermal receipt. Direct BLE printing is only for compatible ESC/POS GATT printers; Hindi text requires system printing.','ब्लूटूथ क्लासिक प्रिंटर पहले फ़ोन की सेटिंग्स में जोड़ें, फिर थर्मल रसीद प्रिंट चुनें। सीधे BLE प्रिंट के लिए संगत प्रिंटर चाहिए; हिंदी टेक्स्ट के लिए सिस्टम प्रिंट चुनें।')+'</p>'+
  '<button type="button" class="btn btn-sm" data-billnest-test-receipt>'+label('Test receipt','टेस्ट रसीद')+'</button></section>';
 document.addEventListener('change',e=>{
  if(e.target?.id!=='billnestPaperWidth')return;
  if(allowed.includes(e.target.value)){paper=e.target.value;try{localStorage.setItem(KEY,paper)}catch{}}
 });
 document.addEventListener('click',e=>{
  if(!e.target.closest('[data-billnest-test-receipt]'))return;
  const demo={business:{businessName:'BillNest Printer Test',invoiceThankYou:'Printer test successful'},number:'TEST-0001',date:new Date().toISOString().slice(0,10),payment:'Cash',customer:{name:'Test customer'},lines:[{name:'Sample item',qty:1,unitPrice:10000,total:10000,gst:0}],list:10000,taxable:10000,tax:0,total:10000,demo:true};
  popupPrint(demo,0);
 });
 globalThis.BillNestReceipt={printInvoice:popupPrint,printBluetooth,settingsMarkup,getPaper:()=>paper,setPaper:value=>{if(allowed.includes(String(value))){paper=String(value);try{localStorage.setItem(KEY,paper)}catch{}}},escposText,buildHtml};
})();