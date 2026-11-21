import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser-like DOM to exercise stateful application flow in Node.
const nodes=new Map();
function node(selector){
 if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){return false},contains(){return false}},addEventListener(){},focus(){},scrollTo(){}});
 return nodes.get(selector);
}
const listeners={};
globalThis.document={querySelector:sel=>node(sel),addEventListener:(name,fn)=>listeners[name]=fn};
globalThis.window={scrollTo(){},addEventListener(){},print(){}};
globalThis.confirm=()=>true;
const items=new Map();
globalThis.localStorage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};
await import('../app.js');
function clickAction(action,id){listeners.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action,id},preventDefault(){}}:null},preventDefault(){}})}
function clickGo(page){listeners.click({target:{closest:selector=>selector==='[data-go]'?{dataset:{go:page}}:null},preventDefault(){}})}
test('dashboard renders sample stock and sales',()=>{assert.match(node('#main').innerHTML,/exploring a demo workspace/);assert.match(node('#main').innerHTML,/Recent invoices/)});
test('inventory screen lists stock entries',()=>{clickGo('inventory');assert.match(node('#main').innerHTML,/A4 Notebook/);assert.match(node('#main').innerHTML,/Marker Set/)});
test('billing generates invoice and subtracts stock',()=>{
 clickGo('billing');const savedBefore=items.get('billnest-workspace-v1');assert.equal(savedBefore,undefined);
 const app=nodes.get('#main').innerHTML; const id=app.match(/data-action="add-to-cart" data-id="([a-z0-9-]+)"/)[1];
 clickAction('add-to-cart',id);assert.match(node('#main').innerHTML,/1 items/);
 clickAction('save-invoice');const db=JSON.parse(items.get('billnest-workspace-v1'));assert.equal(db.invoices.length,6);
 assert.equal(db.invoices.at(-1).lines[0].productId,id);
 assert.equal(db.invoices.at(-1).number,'INV-0006');assert.equal(db.products.find(p=>p.id===id).stock,70);
 assert.match(node('#modalLayer').innerHTML,/INVOICE/);
});
test('can clear demo to an empty workspace',()=>{clickAction('reset-data');const db=JSON.parse(items.get('billnest-workspace-v1'));assert.equal(db.invoices.length,0);assert.equal(db.products.length,0);assert.equal(db.demo,false);assert.match(node('#main').innerHTML,/No invoices yet/)});
test('billing route is clearly named and reachable from dashboard',()=>{
  clickGo('dashboard');
  assert.match(node('#navigation').innerHTML,/>Billing<\/span>/);
  assert.match(node('#main').innerHTML,/quick-start-action quick-billing/);
  clickGo('billing');
  assert.match(node('#main').innerHTML,/Billing &amp; checkout|Billing & checkout/);
});
test('modal backdrop does not swallow product form submit clicks',()=>{
  clickGo('inventory');
  clickAction('add-product');
  const modal=node('#modalLayer').innerHTML;
  assert.match(modal,/id="productForm"/);
  assert.match(modal,/class="modal-overlay" role="presentation"/);
  assert.doesNotMatch(modal,/class="modal-overlay"[^>]*data-action/);
});
test('mobile scanner opens in inventory and billing with manual barcode entry fallback',()=>{
 globalThis.document.body={classList:{add(){},remove(){}}};
 clickGo('inventory');clickAction('scan-inventory');
 assert.match(node('#scannerLayer').innerHTML,/id="scanManualForm"/);
 assert.match(node('#scannerLayer').innerHTML,/id="scannerVideo"/);
 assert.match(node('#scannerLayer').innerHTML,/data-action="scanner-switch"/);
 assert.match(node('#scannerLayer').innerHTML,/id="barcodePhoto"/);
 clickAction('close-scanner');
 assert.equal(node('#scannerLayer').innerHTML,'');
 clickGo('billing');clickAction('scan-billing');
 assert.match(node('#scannerLayer').innerHTML,/Scan items for billing/);
 clickAction('close-scanner');
});
test('manual barcode in inventory pre-populates product barcode and SKU',()=>{
 clickGo('inventory');clickAction('scan-inventory');
 const OldFormData=globalThis.FormData;
 globalThis.FormData=class {constructor(form){this.barcode=form.value} get(){return this.barcode}};
 try{
  const form={value:'00012345678901',matches:selector=>selector==='#scanManualForm'};
  listeners.submit({target:form,preventDefault(){}});
  assert.match(node('#modalLayer').innerHTML,/id="barcode"[^>]*value="00012345678901"/);
  assert.match(node('#modalLayer').innerHTML,/id="sku"[^>]*value="00012345678901"/);
 }finally{globalThis.FormData=OldFormData;clickAction('close-modal')}
});

test('store terms are saved with line breaks and printed on lower-left of new invoices',()=>{
 clickGo('settings');
 assert.match(node('#main').innerHTML,/id="termsAndConditions"/);
 assert.match(node('#main').innerHTML,/Invoice Terms &amp; Conditions/);
 const base={businessName:'Test Store',owner:'Owner',phone:'',email:'',gstin:'',address:'',state:'Bihar',taxMode:'exclusive',invoicePrefix:'INV'};
 const terms='Payment due within 7 days.\nNo returns without receipt. <script>alert(1)</script>';
 const PreviousFormData=globalThis.FormData;
 globalThis.FormData=class {constructor(form){this.entries=Object.entries(form.values)}*[Symbol.iterator](){yield* this.entries}};
 const submit=(id,values)=>listeners.submit({target:{id,values,matches:s=>s.split(',').some(x=>x.trim()===`#${id}`)},preventDefault(){}});
 try{
  submit('settingsForm',{...base,termsAndConditions:terms});
  let data=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(data.settings.termsAndConditions,terms);
  assert.match(node('#main').innerHTML,/No returns without receipt. &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  clickGo('inventory');clickAction('add-product');
  submit('productForm',{name:'Terms test item',sku:'TEST-TERMS',barcode:'',category:'Testing',unit:'pcs',price:'120',cost:'70',stock:'5',lowStock:'1',gst:'18'});
  clickGo('billing');
  const id=JSON.parse(items.get('billnest-workspace-v1')).products.at(-1).id;
  clickAction('add-to-cart',id);
  clickAction('save-invoice');
  data=JSON.parse(items.get('billnest-workspace-v1'));
  const invoice=data.invoices.at(-1);
  assert.equal(invoice.business.termsAndConditions,terms);
  const paper=node('#modalLayer').innerHTML;
  assert.match(paper,/class="invoice-bottom"/);
  assert.match(paper,/class="invoice-bottom-left"/);
  assert.match(paper,/class="invoice-terms"/);
  assert.match(paper,/No returns without receipt. &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(paper,/<script>alert/);
  clickAction('print-invoice',invoice.id);
  assert.match(node('#printLayer').innerHTML,/class="invoice-terms"/);
  clickAction('close-modal');
  clickGo('settings');
  submit('settingsForm',{...base,termsAndConditions:'Updated terms apply to future invoices only.'});
  assert.equal(JSON.parse(items.get('billnest-workspace-v1')).invoices.at(-1).business.termsAndConditions,terms);
  clickGo('sales');clickAction('view-invoice',invoice.id);
  assert.match(node('#modalLayer').innerHTML,/No returns without receipt/);
 }finally{globalThis.FormData=PreviousFormData;clickAction('close-modal')}
});

test('business logo upload, custom invoice footer, escaped messages and invoice snapshots',async()=>{
 clickGo('settings');
 const html=node('#main').innerHTML;
 assert.match(html,/id="businessLogoFile"/);
 assert.match(html,/id="invoiceThankYou"/);
 assert.match(html,/id="invoiceFooterNote"/);
 const oldCreate=globalThis.document.createElement, oldImage=globalThis.Image;
 const oldFormData=globalThis.FormData;
 globalThis.Image=class {naturalWidth=640;naturalHeight=320;set src(_v){queueMicrotask(()=>this.onload?.())}};
 globalThis.document.createElement=(tag)=>tag==='canvas'?{
  width:0,height:0,
  getContext:()=>({clearRect(){},drawImage(){}}),
  toDataURL:()=> 'data:image/png;base64,aGVsbG8='
 }:oldCreate?.(tag);
 globalThis.FormData=class {constructor(form){this.entries=Object.entries(form.values)}*[Symbol.iterator](){yield* this.entries}};
 const submit=(values)=>listeners.submit({target:{id:'settingsForm',values,matches:s=>s.split(',').some(x=>x.trim()==='#settingsForm')},preventDefault(){}});
 try{
  listeners.change({target:{id:'businessLogoFile',dataset:{},files:[new Blob(['png'],{type:'image/png'})]}});
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.match(node('#businessLogoPreview').innerHTML,/business-logo-preview-image/);
  assert.match(node('#businessLogoState').textContent,/Save settings/);
  const values={businessName:'Custom Logo Shop',owner:'',phone:'',email:'',gstin:'',address:'',state:'Bihar',taxMode:'exclusive',invoicePrefix:'CL',termsAndConditions:'Returns only with receipt',invoiceThankYou:'Thanks <friends> & family!',invoiceFooterNote:'For help: call 12345'};
  submit(values);
  let data=JSON.parse(items.get('billnest-workspace-v1'));
  const key=data.settings.logoKey;
  assert.ok(key.startsWith('logo-'));
  assert.equal(data.logoAssets[key],'data:image/png;base64,aGVsbG8=');
  assert.equal(data.settings.logoDataUrl,'');
  assert.equal(data.settings.invoiceThankYou,values.invoiceThankYou);
  assert.match(node('#main').innerHTML,/Thanks &lt;friends&gt; &amp; family!/);
  clickGo('billing');
  const id=data.products.at(-1).id;
  clickAction('add-to-cart',id);
  clickAction('save-invoice');
  data=JSON.parse(items.get('billnest-workspace-v1'));
  const inv=data.invoices.at(-1);
  assert.equal(inv.business.logoKey,key);
  assert.equal(inv.business.invoiceFooterNote,'For help: call 12345');
  assert.doesNotMatch(JSON.stringify(inv),/data:image\/png/);
  assert.match(node('#modalLayer').innerHTML,/class="invoice-logo-top"/);
  assert.match(node('#modalLayer').innerHTML,/<article class="invoice-paper printable-invoice"><div class="invoice-logo-top">/);
  assert.doesNotMatch(node('#modalLayer').innerHTML,/<div class="invoice-business-block"><img/);
  assert.match(node('#modalLayer').innerHTML,/class="invoice-logo"/);
  assert.match(node('#modalLayer').innerHTML,/Thanks &lt;friends&gt; &amp; family!/);
  assert.doesNotMatch(node('#modalLayer').innerHTML,/<friends>/);
  assert.match(node('#modalLayer').innerHTML,/For help: call 12345/);
  clickAction('print-invoice',inv.id);
  assert.match(node('#printLayer').innerHTML,/class="invoice-logo-top"/);
  assert.match(node('#printLayer').innerHTML,/class="invoice-logo"/);
  assert.match(node('#printLayer').innerHTML,/For help: call 12345/);
  clickAction('close-modal');
  clickGo('settings');
  clickAction('remove-business-logo');
  assert.match(node('#businessLogoPreview').innerHTML,/business-logo-placeholder/);
  submit({...values,invoiceThankYou:'New footer',invoiceFooterNote:''});
  data=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(data.settings.logoKey,'');
  assert.ok(data.logoAssets[key],'Asset must remain available for historical invoices');
  assert.equal(data.invoices.at(-1).business.invoiceThankYou,values.invoiceThankYou);
  clickGo('sales');
  clickAction('view-invoice',inv.id);
  assert.match(node('#modalLayer').innerHTML,/class="invoice-logo"/);
  assert.match(node('#modalLayer').innerHTML,/For help: call 12345/);
 }finally{globalThis.document.createElement=oldCreate;globalThis.Image=oldImage;globalThis.FormData=oldFormData;clickAction('close-modal')}
});
