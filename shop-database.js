/* BillNest Supabase shop database: opt-in staging UI, separate from local billing.
 * Requires versioned bn_* SQL migrations and an authenticated Supabase session.
 * Never sends service role keys or overwrites the existing browser workspace.
 */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isUuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value||''));
 let identity='',shops=[],roles=new Map(),selected='',products=[],busy=false,loaded=false,message='',error=false;
 const account=()=>cloud?.currentAccount?.()||null;
 function resetForAccount(){
   const current=account()?.id||'';
   if(current===identity)return;
   identity=current;shops=[];roles=new Map();products=[];loaded=false;message='';error=false;
   try{selected=current?localStorage.getItem('billnest-cloud-shop-'+current)||'':''}catch{selected=''}
 }
 function setMessage(value,isError=false){
   message=String(value||'').slice(0,250);error=isError;paint();
 }
 function shopOptions(){
   return shops.map(s=>'<option value="'+escapeHtml(s.id)+'" '+(selected===s.id?'selected':'')+'>'+
    escapeHtml(s.name)+' ('+escapeHtml(roles.get(s.id)||'member')+')</option>').join('');
 }
 function settingsMarkup(){
   resetForAccount();
   const signed=Boolean(account());
   const status=!cloud?.hasAuthConfig?.()?'Configure Supabase in Cloud backup first.':!signed?'Sign in to use your Supabase shop database.':!loaded?'Select Refresh cloud shops to check the database migration.':shops.length?'Cloud shops available. Existing browser invoices remain unchanged.':'No cloud shops found. Create one to start.';
   const active=shops.find(s=>s.id===selected);
   const canEdit=['owner','manager'].includes(roles.get(selected));
   return '<section class="card setting-section bn-database-panel" id="bnDatabasePanel" aria-label="Supabase shop database">'+
    '<h3>▤ Supabase shop database</h3>'+
    '<p class="mini-note"><strong>Staged integration:</strong> Secure cloud shops and product catalog are separate from offline inventory and invoices. Local billing is NOT synchronized with the database yet. Do not use both as a shared stock ledger.</p>'+
    '<p class="mini-note">'+escapeHtml(status)+'</p>'+
    (message?'<p class="bn-db-message '+(error?'bn-db-error':'')+'" role="status">'+escapeHtml(message)+'</p>':'')+
    (signed?'<div class="bn-db-actions"><button class="btn btn-sm" type="button" data-bn-db="refresh" '+(busy?'disabled':'')+'>Refresh cloud shops</button></div>'+
      '<form id="bnCreateShopForm" class="bn-db-form"><label>New cloud shop name<input type="text" name="name" minlength="1" maxlength="120" required placeholder="My Shop"></label><label>State<input type="text" name="state" maxlength="100" placeholder="Bihar"></label><button class="btn btn-primary btn-sm" type="submit" '+(busy?'disabled':'')+'>Create cloud shop</button></form>'+
      (shops.length?'<div class="bn-db-select"><label for="bnShopSelect">Cloud shop</label><select id="bnShopSelect" class="select-input">'+shopOptions()+'</select></div>':'')+
      (active?'<div class="bn-db-catalog"><h4>Cloud products: '+escapeHtml(active.name)+'</h4>'+
      '<p class="mini-note">Displaying up to 40 products from this shop. These are saved in PostgreSQL under tenant security policies.</p>'+
      (products.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th></tr></thead><tbody>'+
       products.map(p=>'<tr><td>'+escapeHtml(p.sku)+'</td><td>'+escapeHtml(p.name)+'</td><td>₹'+(Number(p.price_paise||0)/100).toFixed(2)+'</td><td>'+escapeHtml(p.stock_qty)+'</td></tr>').join('')+
       '</tbody></table></div>':'<p class="mini-note">No cloud products to display yet.</p>')+
      (canEdit?'<form id="bnAddCloudProductForm" class="bn-db-form"><h4>Add product to cloud</h4>'+
       '<label>SKU<input name="sku" required maxlength="80" placeholder="PROD-001"></label>'+
       '<label>Product name<input name="name" required maxlength="200"></label>'+
       '<label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" max="100000000" required></label>'+
       '<label>Opening stock<input name="stock" type="number" min="0" max="1000000" step="1" value="0" required></label>'+
       '<button type="submit" class="btn btn-primary btn-sm" '+(busy?'disabled':'')+'>Save product in Supabase</button></form>':
       '<p class="mini-note">Your role cannot modify cloud products.</p>')+
       '</div>':''):'<p class="mini-note">Sign in using Login / Sign up. The owner must first deploy the Supabase migrations.</p>')+
    '<p class="mini-note">Existing product and invoice data in this browser are not uploaded, deleted or modified by this panel.</p>'+
    '</section>';
 }
 function paint(){const el=document.getElementById('bnDatabasePanel');if(el)el.outerHTML=settingsMarkup()}
 async function api(path,options={}){
   const user=account();
   if(!user?.id)throw Error('Please sign in before accessing cloud shops.');
   if(!cloud?.databaseRequest)throw Error('Supabase authentication connection is unavailable.');
   const response=await cloud.databaseRequest(path,options);
   if(account()?.id!==user.id)throw Error('Account switched. Retry from the current account.');
   return response;
 }
 async function refresh(){
   resetForAccount();
   if(busy)return;
   busy=true;paint();
   try{
     const next=await api('/rest/v1/bn_shops?select=id,name,state,created_at&order=created_at.desc&limit=50');
     if(!Array.isArray(next))throw Error('Unexpected shop response.');
     const members=await api('/rest/v1/bn_shop_members?select=shop_id,role&user_id=eq.'+encodeURIComponent(account().id)+'&limit=50');
     roles=new Map((Array.isArray(members)?members:[]).map(row=>[row.shop_id,row.role]));
     shops=next.filter(row=>isUuid(row.id));
     if(!shops.some(s=>s.id===selected))selected=shops[0]?.id||'';
     loaded=true;
     await loadProducts();
     setMessage('Supabase database connection verified. Cloud catalog loaded.');
   }catch(err){
     loaded=false;
     const detail=String(err?.message||err);
     setMessage(/bn_shops|PGRST205|not found|404/i.test(detail)?
       'Database tables are not installed yet. Apply the SQL migrations in billnest/supabase/migrations first. '+detail:
       'Could not load cloud shops: '+detail,true);
   }finally{busy=false;paint()}
 }
 async function loadProducts(){
   if(!isUuid(selected)){products=[];return}
   const rows=await api('/rest/v1/bn_products?select=id,sku,name,price_paise,stock_qty,gst_rate&shop_id=eq.'+
     encodeURIComponent(selected)+'&order=name.asc&limit=40');
   products=Array.isArray(rows)?rows:[];
 }
 async function createShop(form){
   if(busy)return;
   const data=new FormData(form),name=String(data.get('name')||'').trim(),state=String(data.get('state')||'').trim();
   if(name.length<1||name.length>120)throw Error('Enter a shop name (up to 120 characters).');
   busy=true;paint();
   try{
     const id=await api('/rest/v1/rpc/bn_create_shop',{method:'POST',body:{p_name:name,p_state:state,p_invoice_prefix:'INV'}});
     if(!isUuid(id))throw Error('Cloud shop response was invalid.');
     selected=id;
     await apiRefreshAfterMutation();
     setMessage('Shop created securely in Supabase. Your offline store has not been changed.');
   }finally{busy=false;paint()}
 }
 async function apiRefreshAfterMutation(){
   const next=await api('/rest/v1/bn_shops?select=id,name,state,created_at&order=created_at.desc&limit=50');
   const members=await api('/rest/v1/bn_shop_members?select=shop_id,role&user_id=eq.'+encodeURIComponent(account().id)+'&limit=50');
   roles=new Map((Array.isArray(members)?members:[]).map(row=>[row.shop_id,row.role]));
   shops=(Array.isArray(next)?next:[]).filter(row=>isUuid(row.id));
   if(!shops.some(s=>s.id===selected))selected=shops[0]?.id||'';
   loaded=true;
   await loadProducts();
   try{if(identity&&selected)localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
 }
 async function addProduct(form){
   if(busy||!isUuid(selected))return;
   const d=new FormData(form),sku=String(d.get('sku')||'').trim(),name=String(d.get('name')||'').trim();
   const amount=Number(d.get('price')),stock=Number(d.get('stock')),price=Math.round(amount*100);
   if(!sku||!name||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(price)||
      price>10000000000000||!Number.isSafeInteger(stock)||stock<0||stock>1000000)
     throw Error('Enter a valid SKU, name, price and opening stock.');
   busy=true;paint();
   try{
     await api('/rest/v1/rpc/bn_upsert_product',{method:'POST',
       body:{p_shop_id:selected,p_sku:sku,p_name:name,p_price_paise:price,p_stock_qty:stock}});
     await loadProducts();
     setMessage('Product saved to the selected cloud shop. Local inventory is unchanged.');
   }finally{busy=false;paint()}
 }
 document.addEventListener('click',event=>{
   const btn=event.target.closest?.('[data-bn-db]');
   if(!btn)return;
   event.preventDefault();
   if(btn.dataset.bnDb==='refresh')void refresh();
 });
 document.addEventListener('change',event=>{
   if(event.target.id!=='bnShopSelect')return;
   const next=event.target.value;
   if(!shops.some(s=>s.id===next))return;
   selected=next;products=[];
   try{localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
   void (async()=>{try{await loadProducts();paint()}catch(err){setMessage(err.message,true)}})();
 });
 document.addEventListener('submit',event=>{
   const form=event.target;
   if(!['bnCreateShopForm','bnAddCloudProductForm'].includes(form?.id))return;
   event.preventDefault();
   const action=form.id==='bnCreateShopForm'?createShop:addProduct;
   void action(form).catch(err=>setMessage(err.message,true));
 });
 window.addEventListener('billnest-auth-changed',()=>{identity='';resetForAccount();paint()});
 globalThis.BillNestDatabase={settingsMarkup,refresh,readOnlyStatus:()=>({loaded,shops:shops.length,products:products.length})};
})();
