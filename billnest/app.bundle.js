// BillNest standalone bundle: no module loading required.
/** Pure billing calculations. All monetary values returned are integer paise. */
const toPaise = value => Math.round((Number(value) || 0) * 100);
const rupees = paise => (Number(paise || 0) / 100);
const money = paise => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(rupees(paise));
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const safeNum = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
function calculateInvoice(items, productMap, discountPercent = 0, settings = {}, customer = {}) {
  const discount = Math.min(100,Math.max(0,safeNum(discountPercent)));
  const inclusive = settings.taxMode === 'inclusive';
  const lines = [];
  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) throw new Error('One of the products no longer exists.');
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity for ' + product.name);
    if (qty > product.stock) throw new Error(`Only ${product.stock} ${product.unit || 'units'} available for ${product.name}.`);
    const unit = toPaise(product.price);
    if (unit < 0) throw new Error('Invalid price for ' + product.name);
    const rate = Math.max(0,safeNum(product.gst));
    const original = unit * qty;
    const discounted = Math.round(original * (100 - discount) / 100);
    const taxable = inclusive ? Math.round(discounted * 100 / (100 + rate)) : discounted;
    const tax = inclusive ? discounted - taxable : Math.round(taxable * rate / 100);
    const total = inclusive ? discounted : taxable + tax;
    lines.push({productId:product.id,sku:product.sku,name:product.name,unit:product.unit || 'pcs',qty,unitPrice:unit,gst:rate,original,discount:original-discounted,taxable,tax,total});
  }
  const totals = lines.reduce((a,l) => ({list:a.list+l.original,discount:a.discount+l.discount,taxable:a.taxable+l.taxable,tax:a.tax+l.tax,total:a.total+l.total}), {list:0,discount:0,taxable:0,tax:0,total:0});
  const source = (settings.state || '').toLowerCase().trim();
  const destination = (customer.state || settings.state || '').toLowerCase().trim();
  const taxType = source && destination ? (source === destination ? 'intra' : 'inter') : 'unspecified';
  const cgst = taxType === 'intra' ? Math.floor(totals.tax / 2) : 0;
  const sgst = taxType === 'intra' ? totals.tax - cgst : 0;
  const igst = taxType === 'inter' ? totals.tax : 0;
  return {lines, ...totals, cgst, sgst, igst, taxType, inclusive, discountPercent:discount};
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function csvEncode(rows) {
  return rows.map(row => row.map(v => {
    const text = String(v ?? '');
    // Defuse spreadsheet formulas in user-entered text before exporting.
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"','""') + '"';
  }).join(',')).join('\r\n');
}

const e = escapeHtml;

const STORE_KEY = 'billnest-workspace-v1';
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
const PAGES = [
 ['dashboard','Dashboard','▦'],['billing','Billing','▧'],['inventory','Inventory','▤'],['sales','Invoices & Sales','▤'],['customers','Customers','♙'],['reports','Reports','▥'],['settings','Settings','⚙']
];
const $ = s => document.querySelector(s);
const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const emptyDb = () => ({version:1,demo:false,settings:{businessName:'My Store',owner:'',phone:'',email:'',address:'',state:'',gstin:'',invoicePrefix:'INV',nextInvoice:1,taxMode:'exclusive'},products:[],customers:[],invoices:[],movements:[]});
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
function readDb(){try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return sampleDb();const data=JSON.parse(raw);if(!data || data.version!==1 || !Array.isArray(data.products)||!Array.isArray(data.invoices)||!Array.isArray(data.customers))throw Error('Unsupported data');return {...emptyDb(),...data,settings:{...emptyDb().settings,...data.settings}};}catch(err){console.warn('Could not read existing workspace:',err);return emptyDb()}}
let db=readDb();
const pageFromHash = () => {const page=(globalThis.location?.hash||'').replace(/^#\/?/,'').split('/')[0].toLowerCase();return PAGES.some(p=>p[0]===page)?page:'dashboard'};
let ui={page:pageFromHash(),search:'',filter:'all',salesSearch:'',customerSearch:'',reportRange:'30',modal:null,editId:null,cart:[],billingSearch:'',billingCustomer:'',discount:0,payment:'Cash',billNotes:'',invoiceId:null};
let toastTimer;
const productsMap = () => Object.fromEntries(db.products.map(p=>[p.id,p]));
function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(db));return true}catch(err){console.error(err);toast('Could not save. Browser storage is unavailable or full. Export a backup.','error');return false}}
function toast(message,type='ok'){const node=$('#toastLayer');node.innerHTML=`<div class="toast ${type==='error'?'error':''}">${e(message)}</div>`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.innerHTML='',4300)}
const num = v => Number(v)||0;
const pct = n => `${Number(n||0)}%`;
const productStatus = p => p.stock<=0 ? '<span class="chip red">Out of stock</span>' : p.stock<=p.lowStock ? '<span class="chip yellow">Low stock</span>' : '<span class="chip green">In stock</span>';
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
 $('#navigation').innerHTML=PAGES.map(([key,label,icon])=>`<button type="button" data-go="${key}" class="nav-item ${ui.page===key?'active':''} ${key==='settings'?'nav-spacer':''}" ${ui.page===key?'aria-current="page"':''}><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');
 const mobileNav=$('#mobileBottomNav');
 if(mobileNav)mobileNav.innerHTML=['dashboard','billing','inventory','sales'].map(key=>{const [name,label,icon]=PAGES.find(p=>p[0]===key);return `<button type="button" data-go="${name}" class="mobile-tab ${ui.page===name?'active':''}" ${ui.page===name?'aria-current="page"':''}><span class="mobile-tab-icon">${icon}</span><span>${label}</span></button>`}).join('');
 $('#breadcrumb').textContent=`WORKSPACE / ${PAGES.find(p=>p[0]===ui.page)?.[1].toUpperCase()}`;
 $('#pageTitle').textContent=PAGES.find(p=>p[0]===ui.page)?.[1]||'Overview';
 $('#storeName').textContent=db.settings.businessName||'My Store';
 $('#storeAvatar').textContent=(db.settings.businessName||'My Store').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const screens={dashboard:renderDashboard,inventory:renderInventory,billing:renderBilling,sales:renderSales,customers:renderCustomers,reports:renderReports,settings:renderSettings};
 try{$('#main').innerHTML=screens[ui.page]()}catch(err){console.error('BillNest screen error:',err);$('#main').innerHTML=`<section class="card section-card" role="alert"><h2>Unable to display this section</h2><p>Please return to Dashboard, or restore your latest backup in Settings.</p><button class="btn btn-primary" data-go="dashboard">Go to Dashboard</button></section>`;}
 if(ui.modal)renderModal();else $('#modalLayer').innerHTML='';
}
function navigate(page,updateHash=true){if(!PAGES.some(p=>p[0]===page))return;ui.page=page;ui.modal=null;ui.search='';ui.filter='all';ui.billingSearch='';render();$('.sidebar').classList.remove('open');$('#backdrop')?.classList.remove('show');if(updateHash&&globalThis.location&&location.hash!=='#'+page)location.hash=page;window.scrollTo?.({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>{const page=pageFromHash();if(page!==ui.page)navigate(page,false)});
function renderDashboard(){
 const daily=db.invoices.filter(i=>i.date===today()),todayRevenue=daily.reduce((s,i)=>s+i.total,0);
 const low=db.products.filter(p=>p.stock<=p.lowStock),stockValue=db.products.reduce((s,p)=>s+toPaise(p.cost)*p.stock,0);
 const metrics=[['Today’s sales',money(todayRevenue),'Across '+daily.length+' invoices','↗',''],['Total products',db.products.length.toLocaleString('en-IN'),'Products in your catalogue','▤','blue'],['Low stock items',low.length,'Need your attention','⚠','orange'],['Stock value',money(stockValue),'Based on purchase cost','◈','purple']];
 const days=Array.from({length:7},(_,i)=>shiftDay(today(),i-6));const points=days.map(day=>db.invoices.filter(x=>x.date===day).reduce((s,x)=>s+x.total,0));const max=Math.max(...points,1);
 const recent=[...db.invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
 return `${showDemoBanner()}<div class="page-intro"><div><h2>Good to see you 👋</h2><p>Here is what is happening in your store today, ${formatDate(today())}.</p></div><div class="toolbar-actions"><button class="btn" data-go="inventory">Manage stock</button><button class="btn btn-primary" data-go="billing">+ Open Billing</button></div></div>
 <div class="quick-start" role="group" aria-label="Quick actions"><button class="quick-start-action quick-billing" data-go="billing"><span class="quick-start-icon">▧</span><span><b>Billing</b><small>New invoice and checkout</small></span><span class="quick-start-arrow">→</span></button><button class="quick-start-action" data-action="add-product"><span class="quick-start-icon">＋</span><span><b>Add product</b><small>Update inventory</small></span><span class="quick-start-arrow">→</span></button><button class="quick-start-action" data-go="sales"><span class="quick-start-icon">▤</span><span><b>View invoices</b><small>Sales history</small></span><span class="quick-start-arrow">→</span></button></div>
 <div class="grid metric-grid">${metrics.map(([name,value,subtitle,icon,color])=>`<div class="card metric-card"><div class="metric-top">${name}<span class="metric-icon ${color}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-sub">${subtitle}</div></div>`).join('')}</div>
 <div class="section-grid"><section class="card section-card"><div class="section-title"><h3>Sales overview</h3><span class="muted small">Last 7 days</span></div><div class="chart-wrap">${points.map((value,i)=>`<div class="chart-col"><div class="chart-bars"><div class="chart-bar" style="height:${Math.max(2,Math.round(value/max*100))}%" title="${e(days[i])}: ${money(value)}"></div></div><div class="chart-label">${dateFromDay(days[i]).toLocaleDateString('en-IN',{weekday:'short'})}</div></div>`).join('')}</div><p class="mini-note">Daily invoice totals in Indian rupees</p></section>
 <section class="card section-card"><div class="section-title"><h3>Stock alerts</h3><button class="section-link" data-go="inventory">View inventory →</button></div>${low.length?`<div class="alert-list">${low.slice(0,4).map(p=>`<div class="alert-row"><div class="alert-icon">⚠</div><div class="alert-details"><b>${e(p.name)}</b><small>${e(p.sku)} · Reorder at ${p.lowStock}</small></div><span class="chip ${p.stock===0?'red':'yellow'}">${p.stock} left</span></div>`).join('')}</div>${low.length>4?`<p class="mini-note">+${low.length-4} more products need attention</p>`:''}`:empty('✓','All stocked up','No products have reached their low-stock threshold.')}</section></div>
 <section class="card recent-card"><div class="section-title" style="padding:20px 22px 0;margin-bottom:8px"><h3>Recent invoices</h3><button class="section-link" data-go="sales">View all →</button></div>${recent.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Amount</th><th></th></tr></thead><tbody>${recent.map(x=>`<tr><td><strong>${e(x.number)}</strong></td><td>${e(x.customer?.name||'Walk-in customer')}</td><td>${formatDate(x.date)}</td><td><span class="chip ${x.paid?'green':'yellow'}">${x.paid?'Paid':'Unpaid'}</span></td><td><strong>${money(x.total)}</strong></td><td><button class="btn btn-sm" data-action="view-invoice" data-id="${x.id}">View</button></td></tr>`).join('')}</tbody></table></div>`:empty('▧','No invoices yet','Start by creating your first invoice.','Create invoice','new-bill')}</section>`;
}
function renderInventory(){
 const q=ui.search.trim().toLowerCase();const filtered=db.products.filter(p=>(!q||[p.name,p.sku,p.category].some(s=>String(s).toLowerCase().includes(q)))&&(ui.filter==='all'||ui.filter==='low'&&p.stock<=p.lowStock||ui.filter==='out'&&p.stock===0));
 return `${sectionHeader('Your products','Add products, manage prices and keep stock accurate.',`<button class="btn" data-action="export-products">↓ Export CSV</button><button class="btn btn-primary" data-action="add-product">+ Add product</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input type="search" data-search="inventory" value="${e(ui.search)}" placeholder="Search product, SKU or category..." aria-label="Search inventory"></div><select class="select-input" data-filter="inventory" aria-label="Filter products"><option value="all" ${ui.filter==='all'?'selected':''}>All products</option><option value="low" ${ui.filter==='low'?'selected':''}>Low stock</option><option value="out" ${ui.filter==='out'?'selected':''}>Out of stock</option></select></div>${filtered.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Selling price</th><th>Stock</th><th>GST</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map((p,i)=>`<tr><td><div class="product-cell">${productAvatar(p,i)}<div><strong>${e(p.name)}</strong><small>${e(p.sku)}</small></div></div></td><td>${e(p.category||'Uncategorised')}</td><td><strong>${money(toPaise(p.price))}</strong></td><td>${p.stock} ${e(p.unit)}</td><td>${pct(p.gst)}</td><td>${productStatus(p)}</td><td><div class="menu-links"><button class="btn btn-sm" data-action="stock" data-id="${p.id}">+ Stock</button><button class="btn btn-sm" data-action="edit-product" data-id="${p.id}">Edit</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('▤',q||ui.filter!=='all'?'No matching products':'No products yet',q||ui.filter!=='all'?'Try a different search or filter.':'Add your first product to track stock and create invoices.',q?'':'Add product',q?'':'add-product')}<div class="pagination-text">Showing ${filtered.length} of ${db.products.length} products</div></section>`;
}
function billingPreview(){try{return calculateInvoice(ui.cart,productsMap(),ui.discount,db.settings,db.customers.find(c=>c.id===ui.billingCustomer)||{state:db.settings.state})}catch{return null}}
function renderBilling(){
 const q=ui.billingSearch.toLowerCase().trim();const matching=db.products.filter(p=>[p.name,p.sku,p.category].some(x=>String(x).toLowerCase().includes(q)));
 const preview=billingPreview();
 return `${sectionHeader('Billing & checkout','Select products, set quantities and create a printable invoice.',`<button class="btn" data-go="sales">Invoice history</button>`)}
 <div class="two-col"><section class="card products-picker"><div class="table-top"><div><strong style="font-size:14px">Select products</strong><div class="mini-note">Click a product to add it to the invoice</div></div></div><div style="padding:13px 17px"><div class="searchbox" style="max-width:none"><input type="search" data-search="billing" value="${e(ui.billingSearch)}" placeholder="Search by name or SKU..." aria-label="Find product"></div></div><div class="picker-list">${matching.length?matching.map((p,i)=>`<button class="picker-product" data-action="add-to-cart" data-id="${p.id}" ${p.stock===0?'disabled':''}>${productAvatar(p,i)}<span class="picker-info"><strong>${e(p.name)}</strong><small>${e(p.sku)} · ${p.stock>0?`${p.stock} in stock`:'Out of stock'}</small></span><span class="picker-price">${money(toPaise(p.price))}</span><span class="picker-add">+</span></button>`).join(''):db.products.length?empty('⌕','No matching products','Try searching with a different keyword.'):empty('▧','No products to bill yet','Add your first product to start billing.','Add product','add-product')}</div></section>
 <section class="card bill-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h3>Current invoice</h3><span class="chip grey">${ui.cart.reduce((a,b)=>a+b.qty,0)} items</span></div><div class="field"><label for="billCustomer">Customer</label><select id="billCustomer"><option value="">Walk-in customer</option>${db.customers.map(c=>`<option value="${c.id}" ${ui.billingCustomer===c.id?'selected':''}>${e(c.name)}</option>`).join('')}</select></div><div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="section-link" data-action="add-customer">+ Add customer</button></div>
 <div class="bill-items">${ui.cart.length?ui.cart.map(item=>{const p=db.products.find(p=>p.id===item.productId);if(!p)return '';const line=preview?.lines.find(l=>l.productId===p.id);return `<div class="bill-item"><div><div class="name">${e(p.name)}</div><small>${money(toPaise(p.price))} / ${e(p.unit)}</small><div class="qty-control"><button data-action="decrease-qty" data-id="${p.id}" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-action="increase-qty" data-id="${p.id}" aria-label="Increase quantity" ${item.qty>=p.stock?'disabled':''}>+</button></div></div><div><div class="bill-line-total">${money(line?.total ?? toPaise(p.price)*item.qty)}</div><button class="remove-item" data-action="remove-cart" data-id="${p.id}">Remove</button></div></div>`}).join(''):empty('▧','Your cart is empty','Choose a product on the left to begin billing.')}</div>
 <div class="field"><label for="billDiscount">Discount (%)</label><input id="billDiscount" type="number" min="0" max="100" step="0.5" value="${e(ui.discount)}"></div><div class="summary-box"><div class="summary-row"><span>Subtotal ${db.settings.taxMode==='inclusive'?'(incl. GST)':''}</span><b>${money(preview?.list||0)}</b></div><div class="summary-row"><span>Discount</span><b>− ${money(preview?.discount||0)}</b></div><div class="summary-row"><span>GST ${preview?.taxType==='intra'?'(CGST + SGST)':preview?.taxType==='inter'?'(IGST)':''} ${db.settings.taxMode==='inclusive'?'included':''}</span><b>${money(preview?.tax||0)}</b></div><div class="summary-row total"><span>Total</span><b>${money(preview?.total||0)}</b></div></div>
 <div class="form-grid" style="margin-bottom:14px"><div class="field"><label for="billPayment">Payment method</label><select id="billPayment">${['Cash','UPI','Card','Bank transfer','Credit'].map(x=>`<option ${ui.payment===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="billNotes">Reference / notes</label><input id="billNotes" placeholder="Optional" value="${e(ui.billNotes)}" maxlength="140"></div></div>
 <button class="btn btn-primary btn-block btn-lg" data-action="save-invoice" ${!ui.cart.length||!preview?'disabled':''}>✓ Generate invoice · ${money(preview?.total||0)}</button><p class="mini-note" style="text-align:center">Stock is deducted when you generate the invoice.</p></section></div>`;
}
function renderSales(){const q=ui.salesSearch.toLowerCase().trim();const invoices=[...db.invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(i=>[i.number,i.customer?.name,i.payment].some(x=>String(x||'').toLowerCase().includes(q)));return `${sectionHeader('Sales & invoices','Every generated invoice is stored in this browser.',`<button class="btn" data-action="export-invoices">↓ Export CSV</button><button class="btn btn-primary" data-go="billing">+ New invoice</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input data-search="sales" type="search" value="${e(ui.salesSearch)}" placeholder="Search invoice or customer..." aria-label="Search invoices"></div><span class="muted small">${invoices.length} invoices</span></div>${invoices.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Payment method</th><th>Payment</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${invoices.map(i=>`<tr><td><strong>${e(i.number)}</strong>${i.demo?'<small class="muted"> (sample)</small>':''}</td><td>${e(i.customer?.name||'Walk-in customer')}</td><td>${formatDate(i.date)}</td><td>${e(i.payment)}</td><td><span class="chip ${i.paid?'green':'yellow'}">${i.paid?'Paid':'Unpaid'}</span></td><td><strong>${money(i.total)}</strong></td><td><button class="btn btn-sm" data-action="view-invoice" data-id="${i.id}">View / Print</button>${!i.paid?` <button class="btn btn-sm" data-action="mark-paid" data-id="${i.id}">Mark paid</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty('▧','No invoices found',q?'Try a different search.':'Invoices will appear here after you generate them.',q?'':'Create invoice',q?'':'new-bill')}</section>`}
function renderCustomers(){const q=ui.customerSearch.toLowerCase().trim(),list=db.customers.filter(c=>[c.name,c.phone,c.email,c.state].some(v=>String(v||'').toLowerCase().includes(q)));return `${sectionHeader('Customers','Keep customer details ready for faster billing.',`<button class="btn btn-primary" data-action="add-customer">+ Add customer</button>`)}<section class="card card-table"><div class="table-top"><div class="searchbox"><input data-search="customers" type="search" value="${e(ui.customerSearch)}" placeholder="Search customers..." aria-label="Search customers"></div><span class="muted small">${list.length} customers</span></div>${list.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>State</th><th>Invoices</th><th>Actions</th></tr></thead><tbody>${list.map((c,i)=>`<tr><td><div class="product-cell">${productAvatar(c,i)}<div><strong>${e(c.name)}</strong><small>${e(c.email||'Individual / business')}</small></div></div></td><td>${e(c.phone||'Not provided')}</td><td>${e(c.state||'Not set')}</td><td>${db.invoices.filter(x=>x.customer?.id===c.id).length}</td><td><button class="btn btn-sm" data-action="edit-customer" data-id="${c.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`:empty('♙','No customers found',q?'Try another name or phone.':'Add customers so you can quickly select them when billing.',q?'':'Add customer',q?'':'add-customer')}</section>`}
function renderReports(){const start=reportDateRange(),inv=db.invoices.filter(x=>x.date>=start),sales=inv.reduce((s,i)=>s+i.total,0),tax=inv.reduce((s,i)=>s+i.tax,0),count=inv.length,avg=count?Math.round(sales/count):0;
 const payments={};inv.forEach(i=>{payments[i.payment]=(payments[i.payment]||0)+i.total});
 const prod={}; inv.forEach(i=>i.lines.forEach(line=>{const item=prod[line.name] ||= {name:line.name,qty:0,total:0};item.qty+=line.qty;item.total+=line.total}));const best=Object.values(prod).sort((a,b)=>b.qty-a.qty).slice(0,6);const topSales=Math.max(...Object.values(payments),1),topQty=Math.max(...best.map(i=>i.qty),1);
 return `${sectionHeader('Business reports','Simple insights to help you make decisions.',`<select class="select-input" id="reportRange" aria-label="Date range"><option value="7" ${ui.reportRange==='7'?'selected':''}>Last 7 days</option><option value="30" ${ui.reportRange==='30'?'selected':''}>Last 30 days</option><option value="90" ${ui.reportRange==='90'?'selected':''}>Last 90 days</option><option value="all" ${ui.reportRange==='all'?'selected':''}>All time</option></select><button class="btn" data-action="export-invoices">↓ Export sales</button>`)}<div class="grid report-grid">${[['Total sales',money(sales)],['Invoices issued',count],['GST on sales',money(tax)],['Average invoice',money(avg)],['Unpaid invoices',inv.filter(i=>!i.paid).length],['Inventory at cost',money(db.products.reduce((s,p)=>s+toPaise(p.cost)*p.stock,0))]].map(([label,value])=>`<div class="card report-card"><div class="overline">${label}</div><div class="metric-value">${value}</div></div>`).join('')}</div><div class="report-layout"><section class="card section-card"><div class="section-title"><h3>Sales by payment method</h3></div>${Object.keys(payments).length?Object.entries(payments).sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<div class="stat-line"><div class="stat-name">${e(name)}</div><div class="progress-track"><div class="progress-fill" style="width:${Math.max(2,value/topSales*100)}%"></div></div><span class="stat-number">${money(value)}</span></div>`).join(''):empty('▥','No sales in this period','Try selecting a longer date range.')}</section><section class="card section-card"><div class="section-title"><h3>Best-selling products</h3><span class="muted small">Units sold</span></div>${best.length?best.map(x=>`<div class="stat-line"><div class="stat-name" title="${e(x.name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(x.name)}</div><div class="progress-track"><div class="progress-fill" style="width:${x.qty/topQty*100}%"></div></div><span class="stat-number">${x.qty} sold</span></div>`).join(''):empty('▤','No products sold yet','Create an invoice to see what sells best.')}</section></div>`;
}
function renderSettings(){const s=db.settings;return `${sectionHeader('Store settings','Personalise your invoices and manage your data.')}<div class="settings-grid"><div><section class="card setting-section"><h3>Business details</h3><p>This information appears on every new invoice.</p><form id="settingsForm"><div class="form-grid">${field('Business / shop name','businessName',s.businessName,'text','required maxlength="80"')}${field('Owner / contact name','owner',s.owner,'text','maxlength="80"')}${field('Phone number','phone',s.phone,'tel','maxlength="25"')}${field('Email address','email',s.email,'email','maxlength="100"')}${field('GSTIN (optional)','gstin',s.gstin,'text','maxlength="15" style="text-transform:uppercase"')}<div class="field"><label for="state">Business state / UT</label><select name="state" id="state">${stateOptions(s.state)}</select></div><div class="field full"><label for="address">Business address</label><textarea id="address" name="address" maxlength="240">${e(s.address)}</textarea></div></div><div class="thin-line"></div><h3>Billing preferences</h3><p>Choose how prices are stored. This affects GST calculations on new invoices.</p><div class="form-grid"><div class="field"><label for="invoicePrefix">Invoice prefix</label><input id="invoicePrefix" name="invoicePrefix" value="${e(s.invoicePrefix)}" maxlength="12" required></div><div class="field"><label for="taxMode">Product price includes GST?</label><select id="taxMode" name="taxMode"><option value="exclusive" ${s.taxMode==='exclusive'?'selected':''}>No, add GST</option><option value="inclusive" ${s.taxMode==='inclusive'?'selected':''}>Yes, GST included</option></select></div></div><p class="mini-note">Next invoice: ${e(s.invoicePrefix)}-${String(s.nextInvoice).padStart(4,'0')}. GST rates must be verified for each product.</p><div style="margin-top:22px"><button class="btn btn-primary" type="submit">Save settings</button></div></form></section></div><div><section class="card setting-section"><h3>Data & backup</h3><p>Your store data lives in this browser. It does not automatically sync across devices or to GitHub.</p><div class="help-row"><div class="help-icon">↓</div><div style="flex:1"><b>Download backup</b><p>Save your products, customers, stock movements and invoices as a JSON file.</p><button class="btn btn-sm" style="margin-top:10px" data-action="backup">Download JSON</button></div></div><div class="help-row"><div class="help-icon">↑</div><div style="flex:1"><b>Restore backup</b><p>Replaces the current browser workspace with a backup file.</p><button class="btn btn-sm" style="margin-top:10px" data-action="choose-import">Import JSON</button><input id="importFile" type="file" accept=".json,application/json" hidden></div></div><div class="thin-line"></div><div class="help-row"><div class="help-icon" style="background:#fff1ee;color:#c15a4d">!</div><div style="flex:1"><b>Reset workspace</b><p>Erase this browser's current store data. Export a backup first.</p><button class="btn btn-danger btn-sm" style="margin-top:10px" data-action="reset-data">Clear all data</button></div></div></section><section class="card setting-section" style="margin-top:18px"><h3>Before using real invoices</h3><p>Confirm your GST registration, product HSN/SAC, applicable tax rates, invoice particulars and local compliance requirements with a qualified tax professional. This is a starter billing app, not certified GST software.</p><span class="chip green">✓ No external libraries required</span></section></div></div>`}
function openModal(type,id=null){ui.modal=type;ui.editId=id;renderModal()}
function closeModal(){ui.modal=null;ui.editId=null;$('#modalLayer').innerHTML=''}
function shellModal(title,desc,body,footer='',cls=''){return `<div class="modal-overlay" role="presentation"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${e(title)}"><div class="modal-header"><div><h2>${title}</h2><p>${desc}</p></div><button type="button" class="modal-x" data-action="close-modal" aria-label="Close">×</button></div>${body}${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`}
function renderModal(){let h='';
 if(ui.modal==='product'){
  const p=db.products.find(x=>x.id===ui.editId)||{};const editing=Boolean(p.id);
  h=shellModal(editing?'Edit product':'Add a product',editing?'Update product information.':'Enter the details for your new product.',`<form id="productForm"><div class="modal-body"><div class="form-grid">${field('Product name *','name',p.name||'','text','required maxlength="100"')}${field('SKU / item code *','sku',p.sku||'','text','required maxlength="40"')}${field('Category','category',p.category||'','text','maxlength="40"')}${field('Unit','unit',p.unit||'pcs','text','required maxlength="16"')}${field('Selling price (₹) *','price',p.price??'','number','required min="0" step="0.01"')}${field('Purchase cost (₹)','cost',p.cost??'','number','min="0" step="0.01"')}${field('Opening stock','stock',p.stock??0,'number',`required min="0" step="1" ${editing?'readonly title="Use Stock button to update inventory"':''}`)}${field('Low stock alert at','lowStock',p.lowStock??5,'number','required min="0" step="1"')}<div class="field full"><label for="gst">GST rate (%)</label><input id="gst" name="gst" type="number" required min="0" max="100" step="0.01" value="${e(p.gst??18)}"><span class="field-hint">Common rates include 0%, 5%, 18% and 40%. Check the applicable rate for each product.</span></div></div>${editing?`<p class="field-hint" style="margin:13px 0 0">Use “+ Stock” on the inventory page to change stock and record a movement.</p>`:''}</div><div class="modal-footer">${editing?'<button type="button" class="btn btn-danger" data-action="delete-product">Delete product</button>':''}<span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?'Save changes':'Add product'}</button></div></form>`);
 }
 if(ui.modal==='customer'){
 const c=db.customers.find(x=>x.id===ui.editId)||{};const editing=Boolean(c.id);
 h=shellModal(editing?'Edit customer':'Add customer','Customer details for invoices.',`<form id="customerForm"><div class="modal-body"><div class="form-grid">${field('Customer / business name *','name',c.name||'','text','required maxlength="90"')}${field('Phone','phone',c.phone||'','tel','maxlength="25"')}${field('Email','email',c.email||'','email','maxlength="100"')}${field('GSTIN (optional)','gstin',c.gstin||'','text','maxlength="15"')}<div class="field full"><label for="customerState">State / UT</label><select id="customerState" name="state">${stateOptions(c.state||'')}</select></div><div class="field full"><label for="customerAddress">Address</label><textarea name="address" id="customerAddress" maxlength="240">${e(c.address||'')}</textarea></div></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?'Save changes':'Add customer'}</button></div></form>`);
 }
 if(ui.modal==='stock'){
 const p=db.products.find(x=>x.id===ui.editId);if(!p)return closeModal();
 h=shellModal('Update stock',`${p.name} · Current quantity ${p.stock}`,`<form id="stockForm"><div class="modal-body"><div class="field"><label for="stockMode">Stock update</label><select id="stockMode" name="mode"><option value="add">Stock received (+)</option><option value="set">Set exact available stock</option></select></div><div class="field" style="margin-top:14px"><label for="stockQty">Quantity *</label><input id="stockQty" name="quantity" type="number" min="0" step="1" required placeholder="Enter quantity"></div><div class="field" style="margin-top:14px"><label for="stockReason">Note (optional)</label><input id="stockReason" name="reason" maxlength="120" placeholder="Supplier delivery, stock count, damage..."></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Update stock</button></div></form>`,'','small-modal');
 }
 if(ui.modal==='invoice'){
 const inv=db.invoices.find(x=>x.id===ui.invoiceId);if(!inv)return closeModal();
 h=shellModal(`Invoice ${e(inv.number)}`,`${formatDate(inv.date)} · ${inv.paid?'Paid':'Unpaid'}`,`<div class="modal-body">${invoicePaper(inv)}</div>`,`<button class="btn" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="print-invoice" data-id="${inv.id}">▤ Print / Save as PDF</button>`,'invoice-modal');
 }
 $('#modalLayer').innerHTML=h;
 $('#modalLayer input:not([readonly]),#modalLayer select')?.focus({preventScroll:true});
}
function invoicePaper(inv){const b=inv.business||db.settings,c=inv.customer||{};
 let taxLines = inv.taxType==='intra' ? `<div class="summary-row"><span>CGST</span><b>${money(inv.cgst)}</b></div><div class="summary-row"><span>SGST</span><b>${money(inv.sgst)}</b></div>`:inv.taxType==='inter'?`<div class="summary-row"><span>IGST</span><b>${money(inv.igst)}</b></div>`:`<div class="summary-row"><span>GST (split not specified)</span><b>${money(inv.tax)}</b></div>`;
 return `<article class="invoice-paper printable-invoice"><div class="invoice-head"><div><div class="invoice-business">${e(b.businessName||'My Store')}</div>${b.owner?`<p>${e(b.owner)}</p>`:''}${b.address?`<p>${e(b.address)}</p>`:''}${b.state?`<p>${e(b.state)}</p>`:''}<p>${[b.phone,b.email].filter(Boolean).map(e).join(' · ')}</p>${b.gstin?`<p><b>GSTIN:</b> ${e(b.gstin)}</p>`:''}</div><div><div class="invoice-title">INVOICE</div><p style="text-align:right"><b>${e(inv.number)}</b></p>${inv.demo?'<span class="chip yellow">SAMPLE · NOT FOR USE</span>':''}</div></div><div class="invoice-meta"><div><b>BILL TO</b><p><strong>${e(c.name||'Walk-in customer')}</strong></p>${c.address?`<p>${e(c.address)}</p>`:''}${c.state?`<p>${e(c.state)}</p>`:''}${c.phone?`<p>${e(c.phone)}</p>`:''}${c.gstin?`<p>GSTIN: ${e(c.gstin)}</p>`:''}</div><div style="text-align:right"><b>INVOICE DETAILS</b><p>Date: ${formatDate(inv.date)}</p><p>Payment: ${e(inv.payment)}</p><p>Status: ${inv.paid?'Paid':'Unpaid'}</p></div></div><div class="table-scroll"><table class="invoice-print-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th style="text-align:right">Amount</th></tr></thead><tbody>${inv.lines.map(x=>`<tr><td>${e(x.name)}<div style="font-size:10px;color:#8a99a6">${e(x.sku||'')}</div></td><td>${x.qty} ${e(x.unit)}</td><td>${money(x.unitPrice)}</td><td>${pct(x.gst)}</td><td style="text-align:right">${money(x.total)}</td></tr>`).join('')}</tbody></table></div><div class="invoice-total"><div class="summary-row"><span>Items subtotal ${inv.inclusive?'(incl. GST)':''}</span><b>${money(inv.list)}</b></div>${inv.discount?`<div class="summary-row"><span>Discount (${inv.discountPercent}%)</span><b>− ${money(inv.discount)}</b></div>`:''}<div class="summary-row"><span>Taxable amount</span><b>${money(inv.taxable)}</b></div>${taxLines}<div class="summary-row total"><span>Total</span><b>${money(inv.total)}</b></div></div>${inv.notes?`<p><strong>Note:</strong> ${e(inv.notes)}</p>`:''}<div class="invoice-footer">Thank you for your business!<div style="font-size:9px;margin-top:5px">Invoice generated with BillNest</div></div></article>`;
}
function downloadFile(name,content,mime){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function exportProducts(){const rows=[['SKU','Product','Category','Unit','Selling price INR','Purchase cost INR','Stock','Low stock level','GST percent']];db.products.forEach(p=>rows.push([p.sku,p.name,p.category,p.unit,p.price,p.cost,p.stock,p.lowStock,p.gst]));downloadFile(`billnest-products-${today()}.csv`,'\ufeff'+csvEncode(rows),'text/csv;charset=utf-8')}
function exportInvoices(){const rows=[['Invoice','Date','Customer','Payment','Payment status','Taxable INR','GST INR','Total INR','Number of items']];db.invoices.forEach(i=>rows.push([i.number,i.date,i.customer?.name||'Walk-in customer',i.payment,i.paid?'Paid':'Unpaid',rupees(i.taxable).toFixed(2),rupees(i.tax).toFixed(2),rupees(i.total).toFixed(2),i.lines.reduce((s,l)=>s+l.qty,0)]));downloadFile(`billnest-invoices-${today()}.csv`,'\ufeff'+csvEncode(rows),'text/csv;charset=utf-8')}
function saveInvoice(){
 if(!ui.cart.length)return toast('Add at least one product.','error');
 let summary;const customer=db.customers.find(c=>c.id===ui.billingCustomer)||{name:'Walk-in customer',state:db.settings.state};
 try{summary=calculateInvoice(ui.cart,productsMap(),ui.discount,db.settings,customer)}catch(err){return toast(err.message,'error')}
 const invoice={id:uid(),number:`${db.settings.invoicePrefix}-${String(db.settings.nextInvoice).padStart(4,'0')}`,date:today(),createdAt:new Date().toISOString(),customer:{...customer},business:{...db.settings},payment:ui.payment,paid:ui.payment!=='Credit',notes:ui.billNotes,...summary,demo:db.demo};
 const prior=JSON.stringify(db);
 for(const line of summary.lines){const p=db.products.find(x=>x.id===line.productId);p.stock-=line.qty;db.movements.push({id:uid(),productId:p.id,change:-line.qty,reason:'Sale '+invoice.number,date:invoice.date,createdAt:invoice.createdAt})}
 db.invoices.push(invoice);db.settings.nextInvoice++;
 if(!save()){db=JSON.parse(prior);return}
 ui.cart=[];ui.discount=0;ui.billingSearch='';ui.billNotes='';ui.invoiceId=invoice.id;ui.modal='invoice';render();toast(`Invoice ${invoice.number} saved. Stock updated.`)
}
function handleAction(action,id){switch(action){
 case 'add-product':ui.editId=null;openModal('product');break;
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
 case 'save-invoice':saveInvoice();break;
 case 'view-invoice':ui.invoiceId=id;openModal('invoice');break;
 case 'print-invoice':{const inv=db.invoices.find(i=>i.id===id);if(!inv)return;$('#printLayer').innerHTML=invoicePaper(inv);window.print();break}
 case 'mark-paid':{const inv=db.invoices.find(i=>i.id===id);if(inv&&!inv.paid&&confirm(`Mark ${inv.number} as paid?`)){inv.paid=true;save();render();toast('Payment marked as received.')}break}
 case 'export-products':exportProducts();break;
 case 'export-invoices':exportInvoices();break;
 case 'backup':downloadFile(`billnest-backup-${today()}.json`,JSON.stringify(db,null,2),'application/json');toast('Backup downloaded.');break;
 case 'choose-import':$('#importFile')?.click();break;
 case 'reset-data':if(confirm('This will permanently clear all products, invoices, customers and settings saved in this browser. Have you downloaded a backup?')){db=emptyDb();if(save()){ui={...ui,page:'dashboard',modal:null,cart:[],billingCustomer:'',billingSearch:'',search:''};render();toast('Workspace cleared. Start by adding a product.')}}break;
 }}
function validateNonnegative(n,name,integer=false){if(!Number.isFinite(n)||n<0||integer&&!Number.isInteger(n))throw Error('Enter a valid '+name+'.')}
function handleForm(form){const data=Object.fromEntries(new FormData(form));try{
 if(form.id==='productForm'){
  const name=data.name.trim(),sku=data.sku.trim().toUpperCase(),price=Number(data.price),cost=data.cost===''?0:Number(data.cost),stock=Number(data.stock),lowStock=Number(data.lowStock);
  if(!name||!sku)throw Error('Product name and SKU are required.');
  validateNonnegative(price,'selling price');validateNonnegative(cost,'purchase cost');validateNonnegative(stock,'stock',true);validateNonnegative(lowStock,'low stock level',true);if(data.gst===""||!Number.isFinite(Number(data.gst))||Number(data.gst)<0||Number(data.gst)>100)throw Error("Enter a valid GST rate between 0 and 100%.");
  if(db.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==ui.editId))throw Error('Another product already has that SKU.');
  const attrs={name,sku,category:data.category.trim(),unit:data.unit.trim()||'pcs',price,cost,lowStock,gst:Number(data.gst)};
  const old=db.products.find(p=>p.id===ui.editId);
  if(old)Object.assign(old,attrs);
  else db.products.push({id:uid(),...attrs,stock,createdAt:new Date().toISOString()});
  save();closeModal();render();toast(old?'Product updated.':'Product added to inventory.');
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
  db.settings={...db.settings,businessName:data.businessName.trim(),owner:data.owner.trim(),phone:data.phone.trim(),email:data.email.trim(),gstin:data.gstin.trim().toUpperCase(),address:data.address.trim(),state:data.state,taxMode:data.taxMode,invoicePrefix:prefix};
  save();render();toast('Business settings saved.');
 }
 }catch(err){toast(err.message,'error')}
}
function rerenderKeepFocus(selector,value){const old=document.activeElement;const pos=old?.selectionStart;render();const next=$(selector);if(next){next.focus();if(typeof pos==='number'&&next.setSelectionRange)try{next.setSelectionRange(pos,pos)}catch{}}}
async function importBackup(file){if(!file)return;try{
 const raw=await file.text();if(raw.length>10_000_000)throw Error('Backup file is too large.');const payload=JSON.parse(raw);
 if(payload.version!==1||!Array.isArray(payload.products)||!Array.isArray(payload.customers)||!Array.isArray(payload.invoices)||!Array.isArray(payload.movements)||!payload.settings||!Number.isInteger(payload.settings.nextInvoice)||payload.settings.nextInvoice<1)throw Error('This is not a valid BillNest v1 backup.');
 if(payload.products.length>100000||payload.invoices.length>100000)throw Error('Backup has too many records.');
 if(!payload.products.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isInteger(p.stock)&&p.stock>=0&&Number.isFinite(p.price)&&p.price>=0)||!payload.invoices.every(i=>i&&Array.isArray(i.lines)&&Number.isFinite(i.total)))throw Error('Backup contains invalid records.');
 if(!confirm(`Replace this workspace with ${payload.products.length} products and ${payload.invoices.length} invoices from the backup? Your current data will be overwritten.`))return;
 const old=db;db=payload;if(!save()){db=old;return}ui={...ui,page:'dashboard',cart:[],modal:null};render();toast('Backup restored successfully.');
 }catch(err){toast('Import failed: '+err.message,'error')}finally{const f=$('#importFile');if(f)f.value=''}}

document.addEventListener('click',event=>{
 const backdrop=event.target.closest('.modal-overlay');if(backdrop&&event.target===backdrop){closeModal();return}
 const go=event.target.closest('[data-go]');if(go){navigate(go.dataset.go);return}
 const action=event.target.closest('[data-action]');if(action&&action.dataset.action!=='overlay-close'){event.preventDefault();handleAction(action.dataset.action,action.dataset.id);return}
});
document.addEventListener('submit',event=>{if(event.target.matches('#productForm,#customerForm,#stockForm,#settingsForm')){event.preventDefault();handleForm(event.target)}});
document.addEventListener('input',event=>{
 const input=event.target;
 if(input.dataset.search){const key=input.dataset.search;const map={inventory:'search',billing:'billingSearch',sales:'salesSearch',customers:'customerSearch'};ui[map[key]]=input.value;rerenderKeepFocus(`[data-search="${key}"]`);}
 if(input.id==='billDiscount'){const n=Number(input.value);ui.discount=Math.max(0,Math.min(100,Number.isFinite(n)?n:0));rerenderKeepFocus('#billDiscount')}
 if(input.id==='billNotes')ui.billNotes=input.value;
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.dataset.filter==='inventory'){ui.filter=t.value;render()}
 if(t.id==='billCustomer'){ui.billingCustomer=t.value;render()}
 if(t.id==='billPayment'){ui.payment=t.value;render()}
 if(t.id==='reportRange'){ui.reportRange=t.value;render()}
 if(t.id==='importFile')importBackup(t.files?.[0]);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.modal)closeModal();if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();navigate('inventory');$('[data-search="inventory"]')?.focus()}});
$('#menuToggle').addEventListener('click',()=>{$('.sidebar').classList.toggle('open');let b=$('#backdrop');if(!b){b=document.createElement('div');b.id='backdrop';b.className='mobile-backdrop';document.body.appendChild(b);b.addEventListener('click',()=>{$('.sidebar').classList.remove('open');b.classList.remove('show')})}b.classList.toggle('show', $('.sidebar').classList.contains('open'))});
window.addEventListener('afterprint',()=>{$('#printLayer').innerHTML=''});
window.addEventListener('error',event=>{console.error('BillNest application error',event.error||event.message)});
render();
