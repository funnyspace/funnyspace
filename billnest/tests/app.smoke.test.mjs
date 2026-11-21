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
test('all pages show just the page title without workspace breadcrumbs',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="breadcrumb"/);
 assert.doesNotMatch(html,/WORKSPACE\s*\/\s*(?:DASHBOARD|INVENTORY|BILLING|REPORTS)/i);
 for(const page of ['dashboard','inventory','billing','sales','customers','accounting','reports','settings']){
  clickGo(page);
  assert.doesNotMatch(node('#main').innerHTML,/WORKSPACE\s*\/\s*(?:DASHBOARD|INVENTORY|BILLING|REPORTS)/i);
 }
 clickGo('dashboard');
});
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

test('profit and loss is in Reports, not Dashboard, with working filters',()=>{
 clickGo('dashboard');
 assert.doesNotMatch(node('#main').innerHTML,/id="profitTitle"/);
 clickGo('reports');
 let markup=node('#main').innerHTML;
 assert.match(markup,/Profit &amp; loss/);
 assert.match(markup,/Product-wise profit \/ loss/);
 assert.match(markup,/Net sales \(excl\. GST\)/);
 assert.match(markup,/id="profitRange"/);
 assert.match(markup,/data-search="profit"/);
 const change = listeners.change;
 change({target:{id:'profitRange',value:'all',dataset:{}}});
 markup=node('#main').innerHTML;
 assert.match(markup,/<option value="all" selected>/);
 const input=listeners.input;
 input({target:{dataset:{search:'profit'},value:'Terms test item'}});
 markup=node('#main').innerHTML;
 assert.match(markup,/Terms test item/);
 assert.doesNotMatch(markup,/A4 Notebook/);
 input({target:{dataset:{search:'profit'},value:''}});
});

test('accounting navigation, dashboard shortcut and mobile Accounts tab',()=>{
 clickGo('dashboard');
 assert.match(node('#navigation').innerHTML,/Accounting/);
 assert.match(node('#mobileBottomNav').innerHTML,/Accounts/);
 assert.match(node('#main').innerHTML,/Estimated net profit/);
 clickGo('accounting');
 assert.match(node('#main').innerHTML,/Accounting &(?:amp;)? cashbook/);
 assert.match(node('#main').innerHTML,/Cash balance/);
 assert.match(node('#main').innerHTML,/Customer receivables/);
 assert.match(node('#main').innerHTML,/Cashbook/);
 clickAction('add-accounting');
 assert.match(node('#modalLayer').innerHTML,/id="accountingForm"/);
 clickAction('close-modal');
});

test('accounting transactions, opening balances, and receipts persist with proper balances',()=>{
 const OldFormData=globalThis.FormData;
 globalThis.FormData=class {constructor(form){this.entries=Object.entries(form.values)}*[Symbol.iterator](){yield* this.entries}};
 const submit=(id,values)=>listeners.submit({target:{id,values,matches:s=>s.split(',').some(x=>x.trim()===`#${id}`)},preventDefault(){}});
 try{
  clickGo('accounting');
  clickAction('opening-balances');
  submit('openingForm',{cash:'1000',bank:'500'});
  let db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.accounting.opening.cash,100000);
  assert.equal(db.accounting.opening.bank,50000);
  clickAction('add-accounting');
  submit('accountingForm',{type:'expense',date:'2026-11-21',amount:'250',account:'cash',toAccount:'bank',category:'Rent <danger>',description:'Shop rent'});
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.accounting.entries.at(-1).amount,25000);
  assert.match(node('#main').innerHTML,/Shop rent/);
  assert.match(node('#main').innerHTML,/Rent &lt;danger&gt;/);
  assert.match(node('#main').innerHTML,/Operating expenses/);
  clickAction('add-accounting');
  submit('accountingForm',{type:'transfer',date:'2026-11-21',amount:'100',account:'cash',toAccount:'bank',category:'',description:'Cash to bank'});
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.accounting.entries.length,2);
  assert.equal(db.accounting.entries.at(-1).type,'transfer');
  clickAction('delete-accounting',db.accounting.entries.at(-1).id);
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.accounting.entries.length,1);
  clickGo('billing');
  const item=db.products.find(p=>p.stock>0);
  clickAction('add-to-cart',item.id);
  listeners.change({target:{id:'billPayment',value:'Credit',dataset:{}}});
  clickAction('save-invoice');
  db=JSON.parse(items.get('billnest-workspace-v1'));
  const credit=db.invoices.at(-1);
  assert.equal(credit.paid,false);
  clickGo('accounting');
  assert.match(node('#main').innerHTML,new RegExp(credit.number));
  clickAction('record-receipt',credit.id);
  assert.match(node('#modalLayer').innerHTML,/id="receiptForm"/);
  submit('receiptForm',{amount:'10.00',date:credit.date,account:'bank',description:'First part'});
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.accounting.entries.at(-1).type,'customer-receipt');
  assert.equal(db.invoices.at(-1).paid,false);
  clickAction('record-receipt',credit.id);
  const due=db.invoices.at(-1).total-1000;
  submit('receiptForm',{amount:(due/100).toFixed(2),date:credit.date,account:'bank',description:'Final payment'});
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.invoices.at(-1).paid,true);
  assert.doesNotMatch(node('#main').innerHTML,new RegExp('data-action="record-receipt" data-id="'+credit.id+'"'));
  assert.equal(db.accounting.entries.filter(x=>x.invoiceId===credit.id).length,2);
  clickAction('delete-accounting',db.accounting.entries.at(-1).id);
  db=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(db.invoices.at(-1).paid,false);
 }finally{globalThis.FormData=OldFormData;clickAction('close-modal')}
});


test('dashboard has three raised SVG quick actions and inventory supports 30-day expiry alert',()=>{
  clickGo('dashboard');
  let markup=node('#main').innerHTML;
  assert.match(markup,/class="quick-start-icon icon-3d"/);
  assert.equal((markup.match(/class="quick-start-icon icon-3d"/g)||[]).length,3);
  assert.match(markup,/icon-3d-svg/);
  clickGo('inventory');clickAction('add-product');
  assert.match(node('#modalLayer').innerHTML,/name="expiryDate" type="date"/);
  const oldFormData=globalThis.FormData;
  globalThis.FormData=class {constructor(form){this.entries=Object.entries(form.values)}*[Symbol.iterator](){yield* this.entries}};
  const due=new Date();due.setDate(due.getDate()+30);
  const date=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
  try{
    listeners.submit({target:{id:'productForm',values:{name:'Expiring sample',sku:'EXPIRY-SAMPLE-1',barcode:'',category:'Food',unit:'pcs',price:'120',cost:'60',stock:'8',lowStock:'2',gst:'5',expiryDate:date},matches:q=>q.includes('#productForm')},preventDefault(){}});
    const db=JSON.parse(items.get('billnest-workspace-v1'));
    assert.equal(db.products.at(-1).expiryDate,date);
    assert.match(node('#main').innerHTML,/Expiring sample/);
    assert.match(node('#main').innerHTML,/30d to expiry/);
    assert.match(node('#main').innerHTML,/Expiring ≤30 days/);
    listeners.change({target:{dataset:{filter:'inventory'},value:'expiring'}});
    assert.match(node('#main').innerHTML,/Expiring sample/);
    clickGo('dashboard');
    assert.match(node('#main').innerHTML,/Stock &amp; expiry alerts/);
    assert.match(node('#main').innerHTML,/Expiring sample/);
    assert.match(node('#main').innerHTML,/30 days/);
  }finally{globalThis.FormData=oldFormData;clickAction('close-modal')}
});

test('mobile topbar headings stay left-aligned across all sections',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(css,/\.topbar \.page-heading\{[^}]*text-align:left/);
 assert.match(css,/\.topbar \.page-heading h1\{[^}]*text-align:left/);
 assert.match(css,/\.topbar\{justify-content:flex-start;gap:10px\}/);
 assert.match(html,/styles\.css\?v=15/);
 for(const page of ['dashboard','billing','inventory','sales','customers','accounting','reports','settings']){
  clickGo(page);
  assert.equal(node('#pageTitle').textContent, {'dashboard':'Dashboard','billing':'Billing','inventory':'Inventory','sales':'Invoices & Sales','customers':'Customers','accounting':'Accounting','reports':'Reports','settings':'Settings'}[page]);
 }
 clickGo('dashboard');
});

test('mobile billing scan barcode and invoice history share one row',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 clickGo('billing');
 const markup=node('#main').innerHTML;
 assert.match(markup,/data-action="scan-billing"[^>]*>[^<]*Scan barcode/);
 assert.match(markup,/data-go="sales"[^>]*>Invoice history/);
 const mobile=css.slice(css.lastIndexOf('/* Mobile billing: keep Scan Barcode'));
 assert.match(mobile,/@media \(max-width:700px\)/);
 assert.match(mobile,/\.page-intro \.toolbar-actions \.btn\[data-action="scan-billing"\]\{grid-column:auto/);
 assert.match(mobile,/\.page-intro \.toolbar-actions \.btn\[data-go="sales"\]/);
 assert.match(html,/styles\.css\?v=21/);
 clickGo('dashboard');
});

test('UPI billing generates an exact-amount pending invoice QR and verifies receipt manually',()=>{
 const OldFormData=globalThis.FormData;
 const fields={
   businessName:'Test Shop UPI',owner:'',phone:'',email:'',gstin:'',address:'',state:'',
   taxMode:'exclusive',invoicePrefix:'INV',termsAndConditions:'',invoiceThankYou:'Thanks',
   invoiceFooterNote:'',upiId:'testmerchant@upi'
 };
 globalThis.FormData=class{
  constructor(form){this.form=form}
  *[Symbol.iterator](){yield* Object.entries(fields)}
 };
 try{
  clickGo('settings');
  listeners.submit({target:{id:'settingsForm',matches:s=>s.includes('#settingsForm')},preventDefault(){}});
  let saved=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(saved.settings.upiId,'testmerchant@upi');
  clickGo('billing');
  listeners.change({target:{id:'billPayment',value:'UPI'}});
  assert.match(node('#main').innerHTML,/UPI QR for/);
  const id=node('#main').innerHTML.match(/data-action="add-to-cart" data-id="([a-z0-9-]+)"/)?.[1];
  assert.ok(id,'expected an inventory product to bill');
  clickAction('add-to-cart',id);
  clickAction('save-invoice');
  saved=JSON.parse(items.get('billnest-workspace-v1'));
  const invoice=saved.invoices.at(-1);
  assert.equal(invoice.payment,'UPI');
  assert.equal(invoice.paid,false,'showing a QR is not receiving payment');
  assert.equal(invoice.business.upiId,'testmerchant@upi');
  const popup=node('#modalLayer').innerHTML;
  assert.match(popup,/class="invoice-upi-qr"/);
  assert.match(popup,/data-upi-uri="upi:\/\/pay\?pa=testmerchant%40upi/);
  assert.match(popup,/Record verified payment/);
  assert.match(popup,/Receiving UPI ID: testmerchant@upi/);
  fields.amount=(invoice.total/100).toFixed(2);
  fields.date=invoice.date;
  fields.account='bank';
  fields.description='Verified bank UTR';
  clickAction('record-receipt',invoice.id);
  listeners.submit({target:{id:'receiptForm',matches:s=>s.includes('#receiptForm')},preventDefault(){}});
  saved=JSON.parse(items.get('billnest-workspace-v1'));
  assert.equal(saved.invoices.at(-1).paid,true);
  assert.equal(saved.accounting.entries.at(-1).type,'customer-receipt');
  clickAction('view-invoice',invoice.id);
  assert.doesNotMatch(node('#modalLayer').innerHTML,/class="invoice-upi-qr"/,'fully settled invoices must not keep requesting money');
 }finally{
  globalThis.FormData=OldFormData;
  clickAction('close-modal');
  clickGo('dashboard');
 }
});

test('cloud backup is optional, saves locally first and requires confirmed restore',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/BillNestCloud\?\.onSave\?\.\(\)/);
 assert.match(app,/BillNestCloud\?\.settingsMarkup\?\.\(\)/);
 assert.match(app,/BillNestCloud\?\.setRestoreHandler\?\.\(payload=>/);
 assert.match(app,/if\(!payload\|\|payload\.version!==1/);
 assert.match(html,/cloud-backup\.js\?v=23/);
 assert.ok(html.indexOf('cloud-backup.js?v=23') < html.indexOf('app.bundle.js?v=23'));
});
