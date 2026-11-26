/* BillNest Cloud shop database: opt-in staging UI, separate from local billing.
 * Requires versioned bn_* SQL migrations and an authenticated Supabase session.
 * Never sends service role keys or overwrites the existing browser workspace.
 */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isUuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value||''));
 let identity='',shops=[],roles=new Map(),selected='',products=[],team=[],invoices=[],customers=[],devices=[],cart=[],detail=null,lastSync='',draftDirty=false,busy=false,loaded=false,message='',error=false;
 const account=()=>cloud?.currentAccount?.()||null;
 function resetForAccount(){
   const current=account()?.id||'';
   if(current===identity)return;
   identity=current;shops=[];roles=new Map();products=[];team=[];invoices=[];customers=[];devices=[];cart=[];detail=null;lastSync='';draftDirty=false;loaded=false;message='';error=false;
   try{selected=current?localStorage.getItem('billnest-cloud-shop-'+current)||'':''}catch{selected=''}
 }
 function setMessage(value,isError=false){
   message=String(value||'').slice(0,250);error=isError;paint();
 }
 function shopOptions(){
   return shops.map(s=>'<option value="'+escapeHtml(s.id)+'" '+(selected===s.id?'selected':'')+'>'+
    escapeHtml(s.name)+' ('+escapeHtml(roleNames[roles.get(s.id)]||'Member')+')</option>').join('');
 }
 const roleNames={owner:'Business Owner',manager:'Store Manager',cashier:'Billing Staff'};
 const roleOptions=current=>['manager','cashier'].map(role=>'<option value="'+role+'" '+(current===role?'selected':'')+'>'+roleNames[role]+'</option>').join('');
 function teamMarkup(){
   const role=roles.get(selected);
   if(!role)return '';
   const owner=role==='owner';
   return '<section class="bn-team-panel" aria-label="Team and roles"><h4>Team management</h4><p class="mini-note">Your role: <strong>'+escapeHtml(roleNames[role]||role)+'</strong>. Each member uses their own registered email.</p>'+
   '<div class="bn-role-hierarchy"><div><strong>Business Owner</strong><small>Manage shop, team and devices</small></div><div><strong>Store Manager</strong><small>Manage cloud products and operations</small></div><div><strong>Billing Staff</strong><small>Cloud billing and payment permissions</small></div></div>'+
   (owner?'<form id="bnAddMemberForm" class="bn-db-form"><h4>Add team member</h4><label>Registered email ID<input name="email" type="email" maxlength="200" required autocomplete="off"></label><label>Assign role<select name="role">'+roleOptions('cashier')+'</select></label><button type="submit" class="btn btn-primary btn-sm" '+(busy?'disabled':'')+'>Add member</button><p class="mini-note">The member must first register and verify their email. Adding an existing member updates their role.</p></form>'+
    '<h4>Current members</h4>'+(team.length?'<div class="bn-team-list">'+team.map(m=>'<div class="bn-team-member"><div class="bn-member-info"><strong>'+escapeHtml(m.full_name||m.email||'Member')+'</strong><small>'+escapeHtml(m.email)+'</small><span class="bn-member-role">'+escapeHtml(roleNames[m.role]||m.role)+'</span></div>'+
     (m.role==='owner'?'<span class="mini-note">Protected owner</span>':'<form class="bn-team-role-form" data-bn-role-form data-user-id="'+escapeHtml(m.user_id)+'"><label class="sr-only">Role</label><select name="role" aria-label="Member role" '+(busy?'disabled':'')+'>'+roleOptions(m.role)+'</select><button type="submit" class="btn btn-sm" '+(busy?'disabled':'')+'>Save role</button><button type="button" class="btn btn-sm bn-member-remove" data-bn-db="remove-member" data-user-id="'+escapeHtml(m.user_id)+'" '+(busy?'disabled':'')+'>Remove</button></form>')+'</div>').join('')+'</div>':'<p class="mini-note">No member details loaded. Refresh shops.</p>'):'<p class="mini-note">Only the owner can add, remove or change roles.</p>')+
   '<p class="mini-note">Team permissions apply to the shared cloud shop. Each member signs in separately. Individual subscription requirements remain unchanged.</p></section>';
 }
 async function loadTeam(){
   team=[];
   const sid=selected;
   if(!isUuid(sid)||roles.get(sid)!=='owner')return;
   const rows=await api('/rest/v1/rpc/bn_list_team',{method:'POST',body:{p_shop_id:sid}});
   if(selected===sid&&Array.isArray(rows))team=rows.filter(m=>isUuid(m.user_id));
 }
 function requireOwner(){if(!isUuid(selected)||roles.get(selected)!=='owner')throw Error('Only the shop owner can manage team members.');}
 async function mutateTeam(action,body){
   if(busy)return;
   requireOwner();
   busy=true;paint();
   try{
    const result=await api('/rest/v1/rpc/'+action,{method:'POST',body:{p_shop_id:selected,...body}});
    if(result===false)throw Error('Member not found or protected.');
    await loadShared();
    setMessage('Team membership updated.');
   }finally{busy=false;paint()}
 }
 async function addMember(form){
   const d=new FormData(form),email=String(d.get('email')||'').trim(),role=d.get('role');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||!['manager','cashier'].includes(role))throw Error('Enter a valid registered email and select a role.');
   await mutateTeam('bn_add_existing_member',{p_email:email,p_role:role});
 }
 async function changeMember(form){
   const user=form.dataset.userId,role=new FormData(form).get('role');
   if(!isUuid(user)||!['manager','cashier'].includes(role))throw Error('Invalid member or role.');
   await mutateTeam('bn_change_member_role',{p_user_id:user,p_role:role});
 }
 async function removeMember(user){
   if(!isUuid(user)||!team.some(m=>m.user_id===user&&m.role!=='owner'))return;
   if(confirm('Remove this member from the selected cloud shop? Their own account will remain.'))await mutateTeam('bn_remove_member',{p_user_id:user});
 }
 function teamError(err){const msg=String(err?.message||'');setMessage(/^(Enter a valid|Only the shop owner|Staff member must|Owner role|Invalid member|Member not found)/.test(msg)?msg:'Could not update team. Check that the member has verified their email, then refresh before retrying.',true);}
 function syncMarkup(){
   if(!isUuid(selected)||!roles.get(selected))return '';
   const formatDate=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}):'Not synced';};
   const current=cloud?.deviceInfo?.();
   return '<section class="bn-sync-panel" aria-label="Device synchronization"><h4>Synced devices</h4><div class="bn-sync-status"><span>'+escapeHtml(navigator.onLine===false?'Offline':error?'Sync needs attention':lastSync?'Cloud sync enabled':'Ready to sync')+'</span><small>Last successful sync: '+escapeHtml(lastSync?formatDate(lastSync):'Not yet')+'</small></div><p class="mini-note">Refreshes automatically every 20 seconds while this section is open, online and not editing. All members access the same cloud shop records.</p>'+
    '<button type="button" class="btn btn-sm" data-bn-db="refresh" '+(busy?'disabled':'')+'>Sync now</button>'+
    (devices.length?'<div class="bn-team-list">'+devices.map(d=>'<div class="bn-team-member"><div class="bn-member-info"><strong>'+escapeHtml(d.device_name)+(d.user_id===identity&&d.device_id===current?.id?' (This device)':'')+'</strong><small>'+escapeHtml(d.member_name)+' · '+escapeHtml(roleNames[d.role]||d.role)+'</small></div><span class="mini-note">'+escapeHtml(formatDate(d.last_synced_at))+'</span></div>').join('')+'</div>':'<p class="mini-note">No synced devices recorded yet.</p>')+
    '<p class="mini-note">'+(roles.get(selected)==='owner'?'The owner can view all registered shop devices.':'You can view your own registered devices.')+'</p></section>';
 }
 function invoiceMarkup(){
   return '<section class="bn-db-catalog"><h4>Shared cloud invoices</h4><p class="mini-note">Latest 100 invoices from the selected shared shop.</p>'+
   (invoices.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>'+invoices.map(v=>'<tr><td>'+escapeHtml(v.invoice_no)+'</td><td>₹'+(Number(v.total_paise||0)/100).toFixed(2)+'</td><td>'+escapeHtml(v.status)+'</td><td><button type="button" class="btn btn-sm" data-bn-db="view-shared-invoice" data-id="'+escapeHtml(v.id)+'">View</button></td></tr>').join('')+'</tbody></table></div>':'<p class="mini-note">No cloud invoices yet.</p>')+'</section>';
 }
 const queryShop=(table,fields,sid,order,limit)=>api('/rest/v1/'+table+'?select='+fields+'&shop_id=eq.'+encodeURIComponent(sid)+'&order='+order+'&limit='+limit);
 async function snapshot(sid,role){
   if(!isUuid(sid)||!role)return {products:[],team:[],invoices:[],customers:[],devices:[],lastSync:''};
   const [productRows,teamRows,invoiceRows,customerRows]=await Promise.all([
     queryShop('bn_products','id,sku,name,price_paise,stock_qty,gst_rate,unit,barcode,archived',sid,'name.asc',1000),
     role==='owner'?api('/rest/v1/rpc/bn_list_team',{method:'POST',body:{p_shop_id:sid}}):Promise.resolve([]),
     queryShop('bn_invoices','id,invoice_no,total_paise,status,issued_at',sid,'issued_at.desc',100),
     queryShop('bn_customers','id,name,phone,state',sid,'name.asc',200)
   ]);
   const device=cloud?.deviceInfo?.();
   if(!device?.id)throw Error('Device identity unavailable.');
   const stamp=await api('/rest/v1/rpc/bn_sync_device',{method:'POST',body:{p_shop_id:sid,p_device_id:device.id,p_device_name:device.name}});
   const deviceRows=await api('/rest/v1/rpc/bn_list_devices',{method:'POST',body:{p_shop_id:sid}});
   if(![productRows,teamRows,invoiceRows,customerRows,deviceRows].every(Array.isArray)||typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw Error('Invalid sync response.');
   return {products:productRows.filter(p=>!p.archived),team:teamRows.filter(m=>isUuid(m.user_id)),invoices:invoiceRows,customers:customerRows,devices:deviceRows,lastSync:stamp};
 }
 function applySnapshot(data){({products,team,invoices,customers,devices,lastSync}=data);}
 async function loadShared(){const sid=selected,role=roles.get(sid);const data=await snapshot(sid,role);if(selected===sid)applySnapshot(data);}
 function editing(){const panel=document.getElementById('bnDatabasePanel');return draftDirty||Boolean(panel&&document.activeElement?.closest?.('form')&&panel.contains(document.activeElement));}

 const sharedMoney=n=>'₹'+(Number(n||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const kgUnit=u=>/^(kg|kgs|kilogram|kilograms)$/i.test(String(u).trim());
 function quantity(raw,unit,max=100000){
   const n=Number(raw),scale=kgUnit(unit)?1000:1,scaled=n*scale;
   if(raw===null||String(raw).trim()===''||!Number.isFinite(n)||n<1/scale||n>max||Math.abs(scaled-Math.round(scaled))>=0.000001)throw Error('Enter a valid positive quantity for '+unit+'.');
   return Math.round(scaled)/scale;
 }
 const activeShop=()=>shops.find(s=>s.id===selected);
 const canManage=()=>['owner','manager'].includes(roles.get(selected));
 const sharedOpen=()=>Boolean(document.getElementById('bnSharedWorkspace'));
 const jobKey=()=> 'billnest-shared-pending-v1:'+identity+':'+selected;
 const jobRpcs={invoice:'bn_issue_invoice',payment:'bn_record_payment',refill:'bn_refill_shared_stock'};
 function pendingJob(){
   if(!identity||!isUuid(selected))return null;
   try{const raw=localStorage.getItem(jobKey());if(!raw)return null;const job=JSON.parse(raw);if(!Object.hasOwn(jobRpcs,job.kind)||job.body?.p_shop_id!==selected||!isUuid(job.body?.p_idempotency_key))throw Error('Invalid pending request');return job;}catch{return {invalid:true};}
 }
 function pendingMarkup(){
   const job=pendingJob();if(!job)return '';
   return '<div class="bn-shop-warning" role="alert">'+(job.invalid?'A saved request cannot be read. Do not submit another shared transaction until browser storage is available.':'A '+escapeHtml(job.kind)+' request is awaiting confirmation. Retry the exact request to avoid duplicates.')+'</div>'+
   (!job.invalid?'<button class="btn btn-primary" type="button" data-bn-db="retry-shared-job" '+(busy?'disabled':'')+'>Retry pending request</button>':'');
 }
 async function runJob(job){
   if(busy||!isUuid(selected)||navigator.onLine===false)return;
   if(!Object.hasOwn(jobRpcs,job.kind)||job.body.p_shop_id!==selected)throw Error('Invalid request.');
   const key=jobKey(),actor=identity,sid=selected;
   busy=true;draftDirty=false;paint();
   try{
     const result=await api('/rest/v1/rpc/'+jobRpcs[job.kind],{method:'POST',body:job.body,signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(25000):undefined});
     if(identity!==actor||selected!==sid)return;
     if(!result||!isUuid(result.id))throw Error('Result not confirmed.');
     localStorage.removeItem(key);
     if(job.kind==='invoice'){cart=[];detail=null;message='Invoice '+String(result.invoice_no||'')+' saved. Amount '+sharedMoney(result.total_paise)+'. Record payment separately.';}
     else{message=job.kind==='refill'?'Shared stock refill saved.':'Payment recorded.';detail=null;}
     error=false;
     try{await loadShared();}catch{message+=' Refresh to see the latest records.';}
   }catch(err){
     if(identity!==actor||selected!==sid)return;
     // A validated SQL rejection is a rolled-back transaction. Network, permission and ambiguous errors keep the request ID.
     if(err?.status===400&&['22023','p0001','23514','22p02'].includes(String(err.code||'').toLowerCase())){
       try{localStorage.removeItem(key)}catch{}
       message=String(err.message||'Request rejected. Review the details.').slice(0,200);
     }else message='Request not confirmed. Use Retry pending request; do not enter the sale or payment again.';
     error=true;
   }finally{busy=false;paint();}
 }
 async function startJob(kind,body){
   if(busy||!isUuid(selected)||!roles.get(selected)||navigator.onLine===false)throw Error('Connect and synchronize the shared shop first.');
   if(pendingJob())throw Error('Resolve the pending shared request first.');
   if(!globalThis.crypto?.randomUUID)throw Error('Secure browser required.');
   const job={kind,body:{...body,p_shop_id:selected,p_idempotency_key:crypto.randomUUID()}};
   try{localStorage.setItem(jobKey(),JSON.stringify(job))}catch{throw Error('Could not save the request ID. No transaction sent. Free browser storage and try again.');}
   await runJob(job);
 }
 function sharedCheckoutMarkup(){
   const shop=activeShop();if(!shop)return '';
   const blocked=busy||Boolean(pendingJob())||navigator.onLine===false;
   const disabled=blocked?'disabled':'';
   const available=products.filter(p=>Number(p.stock_qty)>0&&isUuid(p.id));
   const opts=available.map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.name)+' · '+escapeHtml(p.sku)+' · '+sharedMoney(p.price_paise)+' / '+escapeHtml(p.unit)+' · Stock '+escapeHtml(p.stock_qty)+'</option>').join('');
   const rows=cart.map(x=>{const p=products.find(v=>v.id===x.product_id);return '<div class="bn-shared-cart-row"><div><strong>'+escapeHtml(p?.name||'Unavailable item')+'</strong><small>'+escapeHtml(x.quantity)+' '+escapeHtml(p?.unit||'')+'</small></div><button class="btn btn-sm" type="button" data-bn-db="remove-shared-line" data-id="'+escapeHtml(x.product_id)+'" '+disabled+'>Remove</button></div>'}).join('');
   return '<section class="bn-shared-checkout"><h4>Shared billing</h4><p class="mini-note">Invoices and stock deductions are saved together on the server. The server uses the current price and GST. Payment is recorded separately.</p>'+pendingMarkup()+
    '<form id="bnSharedCartForm" class="bn-db-form"><label>Product<select name="product_id" required><option value="">Select product</option>'+opts+'</select></label><label>Quantity<input type="number" min="0.001" max="100000" step="0.001" name="quantity" value="1" required></label><button type="submit" class="btn" '+(blocked||!available.length?'disabled':'')+'>Add to shared bill</button></form>'+
    (rows?'<div class="bn-team-list">'+rows+'</div>':'<p class="mini-note">Cart is empty.</p>')+
    '<form id="bnSharedInvoiceForm" class="bn-db-form"><label>Customer<select name="customer_id"><option value="">Walk-in customer</option>'+customers.map(v=>'<option value="'+escapeHtml(v.id)+'">'+escapeHtml(v.name)+(v.phone?' · '+escapeHtml(v.phone):'')+'</option>').join('')+'</select></label><label>Payment method<select name="method"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Credit</option></select></label><label>Discount (%)<input name="discount" type="number" min="0" max="100" step="0.01" value="0" required></label><button type="submit" class="btn btn-primary" '+(blocked||!cart.length?'disabled':'')+'>Generate shared invoice</button></form>'+
    '<details><summary>Add shared customer</summary><form id="bnSharedCustomerForm" class="bn-db-form"><label>Name<input name="name" maxlength="200" required></label><label>Phone<input name="phone" maxlength="40" type="tel"></label><label>State<input name="state" maxlength="100"></label><label>GSTIN (optional)<input name="gstin" maxlength="30"></label><button type="submit" class="btn" '+disabled+'>Save customer</button></form></details>'+
    (canManage()?'<details><summary>Refill shared inventory</summary><form id="bnSharedRefillForm" class="bn-db-form"><label>Product<select name="product_id" required><option value="">Select product</option>'+products.map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.name)+' · '+escapeHtml(p.sku)+'</option>').join('')+'</select></label><label>Received quantity<input type="number" min="0.001" step="0.001" max="1000000" name="quantity" required></label><button type="submit" class="btn" '+disabled+'>Add stock</button></form></details>':'')+
    (detail?detailMarkup():'')+'</section>';
 }
 function detailMarkup(){
   const {row,items,paid}=detail,due=Math.max(0,Number(row.total_paise)-paid);
   const disabled=busy||pendingJob()||navigator.onLine===false?'disabled':'';
   return '<section class="bn-shared-detail"><h4>Invoice '+escapeHtml(row.invoice_no)+'</h4><p class="mini-note">'+escapeHtml(row.status)+' · '+escapeHtml(row.payment_method)+' · '+escapeHtml(row.customer_snapshot?.name||'Walk-in customer')+'</p>'+
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+escapeHtml(x.name_snapshot)+'</td><td>'+escapeHtml(x.quantity)+' '+escapeHtml(x.unit_snapshot)+'</td><td>'+sharedMoney(x.total_paise)+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p>Total: <strong>'+sharedMoney(row.total_paise)+'</strong> · Paid: '+sharedMoney(paid)+' · Due: '+sharedMoney(due)+'</p>'+
    (row.status!=='void'&&due>0?'<form id="bnSharedPaymentForm" class="bn-db-form"><label>Amount received (₹)<input name="amount" type="number" min="0.01" max="'+(due/100).toFixed(2)+'" step="0.01" required value="'+(due/100).toFixed(2)+'"></label><label>Method<select name="method"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option></select></label><button type="submit" class="btn btn-primary" '+disabled+'>Record received payment</button><p class="mini-note">Only record money actually received. No automatic UPI verification.</p></form>':'')+
    '<button class="btn btn-sm" type="button" data-bn-db="close-shared-invoice">Close invoice details</button></section>';
 }
 async function viewSharedInvoice(id){
   if(busy||!isUuid(id)||!isUuid(selected))return;
   const sid=selected,actor=identity;busy=true;paint();
   try{
     const base='&shop_id=eq.'+encodeURIComponent(sid),filter='&invoice_id=eq.'+encodeURIComponent(id);
     const [rows,items,receipts]=await Promise.all([
       api('/rest/v1/bn_invoices?select=id,invoice_no,total_paise,status,payment_method,customer_snapshot&limit=1&id=eq.'+encodeURIComponent(id)+base),
       api('/rest/v1/bn_invoice_items?select=name_snapshot,quantity,unit_snapshot,total_paise&limit=200'+base+filter),
       api('/rest/v1/bn_payments?select=amount_paise&limit=1000'+base+filter)]);
     if(identity!==actor||selected!==sid)return;
     if(!rows?.length||!Array.isArray(items)||!Array.isArray(receipts)||receipts.length>=1000)throw Error('Invoice details unavailable.');
     detail={row:rows[0],items,paid:receipts.reduce((sum,r)=>sum+Number(r.amount_paise),0)};
   }finally{busy=false;paint();}
 }
 async function submitShared(form){
   if(busy||!activeShop()||navigator.onLine===false)throw Error('Connect to the shared shop first.');
   const d=new FormData(form);
   if(form.id==='bnSharedCartForm'){
     const p=products.find(x=>x.id===d.get('product_id'));if(!p)throw Error('Choose a product.');
     const q=quantity(d.get('quantity'),p.unit),old=cart.find(x=>x.product_id===p.id),total=quantity((old?.quantity||0)+q,p.unit);
     if(total>Number(p.stock_qty))throw Error('Requested quantity exceeds synchronized stock.');
     if(!old&&cart.length>=200)throw Error('Maximum 200 products per shared invoice.');
     if(old)old.quantity=total;else cart.push({product_id:p.id,quantity:total});draftDirty=false;paint();return;
   }
   if(form.id==='bnSharedInvoiceForm'){
     if(!cart.length)throw Error('Add products to the shared bill.');
     const method=d.get('method'),discount=Number(d.get('discount')),cid=String(d.get('customer_id')||'');
     if(!['Cash','UPI','Card','Bank transfer','Credit'].includes(method)||!Number.isFinite(discount)||discount<0||discount>100||cid&&!customers.some(c=>c.id===cid))throw Error('Check the invoice details.');
     if(!confirm('Generate the shared invoice using current server prices and stock?'))return;
     await startJob('invoice',{p_items:cart.map(x=>({...x})),p_payment_method:method,p_customer_id:cid||null,p_discount_percent:discount});return;
   }
   if(form.id==='bnSharedRefillForm'){
     if(!canManage())throw Error('Only the owner or manager can refill stock.');
     const p=products.find(x=>x.id===d.get('product_id'));if(!p)throw Error('Choose a product.');
     await startJob('refill',{p_product_id:p.id,p_quantity:quantity(d.get('quantity'),p.unit,1000000)});return;
   }
   if(form.id==='bnSharedPaymentForm'){
     if(!detail)throw Error('Open an invoice first.');
     const amount=Number(d.get('amount')),paise=Math.round(amount*100),method=d.get('method'),due=Number(detail.row.total_paise)-detail.paid;
     if(!Number.isSafeInteger(paise)||paise<=0||paise>due||Math.abs(amount*100-paise)>0.000001||!['Cash','UPI','Card','Bank transfer'].includes(method))throw Error('Enter a valid amount received.');
     if(!confirm('Confirm that '+sharedMoney(paise)+' has actually been received.'))return;
     await startJob('payment',{p_invoice_id:detail.row.id,p_amount_paise:paise,p_method:method});return;
   }
   if(form.id==='bnSharedCustomerForm'){
     const name=String(d.get('name')||'').trim();if(!name||name.length>200)throw Error('Enter a customer name.');
     busy=true;draftDirty=false;paint();
     try{await api('/rest/v1/rpc/bn_upsert_customer',{method:'POST',body:{p_shop_id:selected,p_name:name,p_phone:String(d.get('phone')||''),p_state:String(d.get('state')||''),p_gstin:String(d.get('gstin')||'')}});await loadShared();setMessage('Shared customer saved.');}finally{busy=false;paint();}
   }
 }
 function workspaceMarkup(){return '<div id="bnSharedWorkspace"><div class="page-intro"><div><h2>Shared workspace</h2><p>One shop, synchronized inventory and billing across authorized devices.</p></div><button type="button" class="btn" data-go="billing">Local billing</button></div>'+settingsMarkup(true)+'</div>';}
 function settingsMarkup(sharedView=false){
   resetForAccount();
   const signed=Boolean(account());
   const status=!cloud?.hasAuthConfig?.()?'Cloud service is currently unavailable. Contact BillNest support.':!signed?'Sign in to manage your cloud shops.':!loaded?'View your existing cloud shops or create a new one.':shops.length?'Your cloud shops are ready.':'No cloud shops yet.';
   const active=shops.find(s=>s.id===selected);
   const canEdit=['owner','manager'].includes(roles.get(selected));
   return '<section class="card setting-section bn-database-panel" id="bnDatabasePanel" aria-label="Cloud shops">'+
    '<div class="bn-shop-heading"><span class="bn-shop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18l-2-6H5zM4 10v10h16V10M9 20v-6h6v6"/><path d="M8 10v2m8-2v2"/></svg></span><div><h3>Cloud Shops</h3><p>Manage shops, team access and online products.</p></div></div>'+
    '<p class="bn-shop-warning">Shared workspace data is stored in the cloud and updated across devices. Local invoices and inventory are kept separately.</p>'+
    '<p class="mini-note">'+escapeHtml(status)+'</p>'+
    (message?'<p class="bn-db-message '+(error?'bn-db-error':'')+'" role="status">'+escapeHtml(message)+'</p>':'')+
    (signed?'<div class="bn-db-actions"><button class="btn btn-sm" type="button" data-bn-db="refresh" '+(busy?'disabled':'')+'>Load / refresh shops</button></div>'+
      '<form id="bnCreateShopForm" class="bn-db-form"><h4>Create a shop</h4><label>Shop name<input type="text" name="name" minlength="1" maxlength="120" required placeholder="Enter shop name"></label><label>State (optional)<input type="text" name="state" maxlength="100" placeholder="Enter state"></label><button class="btn btn-primary btn-sm" type="submit" '+(busy?'disabled':'')+'>Create shop</button></form>'+
      (shops.length?'<div class="bn-db-select"><label for="bnShopSelect">Cloud shop</label><select id="bnShopSelect" class="select-input" '+(busy?'disabled':'')+'>'+shopOptions()+'</select></div>':'')+
      (active?(sharedView?sharedCheckoutMarkup():'<div class="bn-db-actions"><button type="button" class="btn btn-primary" data-go="shared">Open shared workspace</button></div>')+teamMarkup()+syncMarkup()+invoiceMarkup()+'<div class="bn-db-catalog"><h4>Cloud products: '+escapeHtml(active.name)+'</h4>'+
      '<p class="mini-note">Showing up to 1,000 active products (first 1,000 catalogue records).</p>'+
      (products.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th></tr></thead><tbody>'+
       products.map(p=>'<tr><td>'+escapeHtml(p.sku)+'</td><td>'+escapeHtml(p.name)+'</td><td>₹'+(Number(p.price_paise||0)/100).toFixed(2)+'</td><td>'+escapeHtml(p.stock_qty)+' '+escapeHtml(p.unit||'pcs')+'</td></tr>').join('')+
       '</tbody></table></div>':'<p class="mini-note">No cloud products to display yet.</p>')+
      (canEdit?'<form id="bnAddCloudProductForm" class="bn-db-form"><h4>Add product to cloud</h4>'+
       '<label>SKU<input name="sku" required maxlength="80" placeholder="PROD-001"></label>'+
       '<label>Product name<input name="name" required maxlength="200"></label>'+
       '<label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" max="100000000" required></label>'+
       '<label>Unit<select name="unit"><option value="pcs">Pieces</option><option value="kg">Kilogram (kg)</option></select></label><label>GST rate (%)<input name="gst" type="number" min="0" max="100" step="0.01" value="0" required></label><label>Opening stock<input name="stock" type="number" min="0" max="1000000" step="0.001" value="0" required></label>'+
       '<button type="submit" class="btn btn-primary btn-sm" '+(busy?'disabled':'')+'>Save cloud product</button></form>':
       '<p class="mini-note">Your role cannot modify cloud products.</p>')+
       '</div>':''):'<p class="mini-note">Sign in to get started.</p>')+
    '</section>';
 }
 function paint(){const el=document.getElementById('bnDatabasePanel');if(el)el.outerHTML=settingsMarkup(sharedOpen())}
 async function api(path,options={}){
   const user=account();
   if(!user?.id)throw Error('Please sign in before accessing cloud shops.');
   if(!cloud?.databaseRequest)throw Error('Supabase authentication connection is unavailable.');
   const response=await cloud.databaseRequest(path,options);
   if(account()?.id!==user.id)throw Error('Account switched. Retry from the current account.');
   return response;
 }
 async function refresh(automatic=false){
   resetForAccount();
   if(busy||!account()||navigator.onLine===false||automatic&&editing())return;
   if(!automatic&&draftDirty&&!confirm('Sync now and discard unsaved changes in this cloud shop form?'))return;
   if(!automatic)draftDirty=false;
   const previousIdentity=identity;
   busy=true;if(!automatic)paint();
   try{
     const next=await api('/rest/v1/bn_shops?select=id,name,state,tax_mode,created_at&order=created_at.desc&limit=50');
     const memberRows=await api('/rest/v1/bn_shop_members?select=shop_id,role&user_id=eq.'+encodeURIComponent(previousIdentity)+'&limit=50');
     if(!Array.isArray(next)||!Array.isArray(memberRows))throw Error('Unexpected shop response.');
     const nextRoles=new Map(memberRows.filter(m=>['owner','manager','cashier'].includes(m.role)).map(m=>[m.shop_id,m.role]));
     const nextShops=next.filter(s=>isUuid(s.id)&&nextRoles.has(s.id));
     const nextSelected=nextShops.some(s=>s.id===selected)?selected:nextShops[0]?.id||'';
     const data=await snapshot(nextSelected,nextRoles.get(nextSelected));
     if(identity!==previousIdentity||account()?.id!==previousIdentity||automatic&&editing())return;
     if(selected!==nextSelected){cart=[];detail=null;}else if(detail){const updated=data.invoices.find(v=>v.id===detail.row.id);if(!updated||updated.status!==detail.row.status||Number(updated.total_paise)!==Number(detail.row.total_paise))detail=null;}shops=nextShops;roles=nextRoles;selected=nextSelected;applySnapshot(data);loaded=true;
     try{if(selected)localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
     message=automatic?'':'Cloud shop synchronized.';error=false;
   }catch(err){
     if(identity!==previousIdentity)return;
     console.warn('Cloud sync failed',err);message='Could not synchronize cloud shop. Check your connection and retry.';error=true;
   }finally{busy=false;if(!automatic||!editing())paint()}
 }
 async function loadProducts(){
   if(!isUuid(selected)){products=[];return}
   const rows=await api('/rest/v1/bn_products?select=id,sku,name,price_paise,stock_qty,gst_rate,unit&shop_id=eq.'+
     encodeURIComponent(selected)+'&order=name.asc&limit=40');
   products=Array.isArray(rows)?rows:[];
 }
 async function createShop(form){
   if(busy)return;
   const data=new FormData(form),name=String(data.get('name')||'').trim(),state=String(data.get('state')||'').trim();
   if(name.length<1||name.length>120)throw Error('Enter a shop name (up to 120 characters).');
   if(cart.length&&!confirm('Create another shop and discard this unsubmitted shared cart?'))return;
   busy=true;paint();
   try{
     const id=await api('/rest/v1/rpc/bn_create_shop',{method:'POST',body:{p_name:name,p_state:state,p_invoice_prefix:'INV'}});
     if(!isUuid(id))throw Error('Cloud shop response was invalid.');
     selected=id;cart=[];detail=null;
     await apiRefreshAfterMutation();
     setMessage('Cloud shop created.');
   }finally{busy=false;paint()}
 }
 async function apiRefreshAfterMutation(){
   const next=await api('/rest/v1/bn_shops?select=id,name,state,tax_mode,created_at&order=created_at.desc&limit=50');
   const members=await api('/rest/v1/bn_shop_members?select=shop_id,role&user_id=eq.'+encodeURIComponent(account().id)+'&limit=50');
   roles=new Map((Array.isArray(members)?members:[]).map(row=>[row.shop_id,row.role]));
   shops=(Array.isArray(next)?next:[]).filter(row=>isUuid(row.id));
   if(!shops.some(s=>s.id===selected))selected=shops[0]?.id||'';
   loaded=true;
   await loadShared();
   try{if(identity&&selected)localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
 }
 async function addProduct(form){
   if(busy||!isUuid(selected))return;
   const d=new FormData(form),sku=String(d.get('sku')||'').trim(),name=String(d.get('name')||'').trim();
   const amount=Number(d.get('price')),stock=Number(d.get('stock')),gst=Number(d.get('gst')),price=Math.round(amount*100),unit=d.get('unit')==='kg'?'kg':'pcs';
   const scaled=stock*(unit==='kg'?1000:1);
   if(!['owner','manager'].includes(roles.get(selected)))throw Error('Only the owner or manager can create products.');
   if(!sku||!name||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(price)||
      price>10000000000000||!Number.isFinite(gst)||gst<0||gst>100||!Number.isFinite(stock)||Math.abs(scaled-Math.round(scaled))>0.000001||stock<0||stock>1000000||(stock>0&&stock<(unit==='kg'?0.001:1)))
     throw Error('Enter a valid SKU, name, price and opening stock.');
   busy=true;paint();
   try{
     await api('/rest/v1/rpc/bn_upsert_product',{method:'POST',
       body:{p_shop_id:selected,p_sku:sku,p_name:name,p_price_paise:price,p_stock_qty:stock,p_unit:unit,p_gst_rate:gst}});
     await loadShared();
     setMessage('Product saved to the selected cloud shop. Local inventory is unchanged.');
   }finally{busy=false;paint()}
 }
 document.addEventListener('click',event=>{
   const btn=event.target.closest?.('[data-bn-db]');
   if(!btn)return;
   event.preventDefault();
   if(btn.dataset.bnDb==='refresh')void refresh(false);
   if(btn.dataset.bnDb==='remove-member')void removeMember(btn.dataset.userId).catch(teamError);
   if(btn.dataset.bnDb==='remove-shared-line'&&!busy&&!pendingJob()){cart=cart.filter(x=>x.product_id!==btn.dataset.id);draftDirty=false;paint();}
   if(btn.dataset.bnDb==='retry-shared-job'){const job=pendingJob();if(job&&!job.invalid)void runJob(job);}
   if(btn.dataset.bnDb==='view-shared-invoice'){if(!sharedOpen()){location.hash='shared';return;}void viewSharedInvoice(btn.dataset.id).catch(err=>setMessage(err.message||'Could not open invoice.',true));}
   if(btn.dataset.bnDb==='close-shared-invoice'&&!busy){detail=null;draftDirty=false;paint();}
 });
 document.addEventListener('change',event=>{
   if(event.target.id!=='bnShopSelect'||busy)return;
   const next=event.target.value;
   if(!shops.some(s=>s.id===next))return;
   if((draftDirty||cart.length)&&!confirm('Switch shops and discard this unsubmitted cart and form changes?')){event.target.value=selected;return;}
   draftDirty=false;selected=next;products=[];team=[];invoices=[];customers=[];devices=[];cart=[];detail=null;lastSync='';busy=true;paint();
   try{localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
   void (async()=>{try{await loadShared();paint()}catch(err){console.warn('Cloud catalog load failed',err);setMessage('Could not load cloud shop. Please refresh your shops.',true)}finally{busy=false;paint()}})();
 });
 document.addEventListener('submit',event=>{
   const form=event.target;
   if(['bnSharedCartForm','bnSharedInvoiceForm','bnSharedRefillForm','bnSharedCustomerForm','bnSharedPaymentForm'].includes(form?.id)){event.preventDefault();void submitShared(form).catch(err=>setMessage(String(err.message||'Shared action failed.'),true));return;}
   if(form?.id==='bnAddMemberForm'||form?.matches?.('[data-bn-role-form]')){event.preventDefault();if(busy)return;draftDirty=false;void (form.id==='bnAddMemberForm'?addMember(form):changeMember(form)).catch(teamError);return;}
   if(!['bnCreateShopForm','bnAddCloudProductForm'].includes(form?.id))return;
   event.preventDefault();
   if(busy)return;draftDirty=false;
   const action=form.id==='bnCreateShopForm'?createShop:addProduct;
   void action(form).catch(err=>{console.warn('Cloud shop action failed',err);const msg=String(err?.message||'');setMessage(msg.startsWith('Enter a ') ? msg : 'Could not save. Please refresh your cloud shops and check whether the change was saved before trying again.',true)});
 });
 document.addEventListener('input',event=>{if(event.target.closest?.('#bnDatabasePanel form'))draftDirty=true;});
 document.addEventListener('change',event=>{if(event.target.closest?.('#bnDatabasePanel form'))draftDirty=true;});
 function autoSync(){if(!document.hidden&&document.getElementById('bnDatabasePanel')&&account()&&!busy&&!editing()&&navigator.onLine!==false)void refresh(true);}
 setInterval(autoSync,20000);
 window.addEventListener('hashchange',()=>setTimeout(autoSync,0));
 window.addEventListener('online',autoSync);
 window.addEventListener('focus',autoSync);
 document.addEventListener('visibilitychange',autoSync);
 window.addEventListener('billnest-auth-changed',()=>{identity='';resetForAccount();paint();autoSync()});
 globalThis.BillNestDatabase={settingsMarkup,workspaceMarkup,refresh,autoSync,readOnlyStatus:()=>({loaded,shops:shops.length,products:products.length,invoices:invoices.length,devices:devices.length,lastSync})};
})();
