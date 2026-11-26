/* BillNest Cloud shop database: opt-in staging UI, separate from local billing.
 * Requires versioned bn_* SQL migrations and an authenticated Supabase session.
 * Never sends service role keys or overwrites the existing browser workspace.
 */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isUuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value||''));
 let identity='',shops=[],roles=new Map(),selected='',products=[],team=[],busy=false,loaded=false,message='',error=false;
 const account=()=>cloud?.currentAccount?.()||null;
 function resetForAccount(){
   const current=account()?.id||'';
   if(current===identity)return;
   identity=current;shops=[];roles=new Map();products=[];team=[];loaded=false;message='';error=false;
   try{selected=current?localStorage.getItem('billnest-cloud-shop-'+current)||'':''}catch{selected=''}
 }
 function setMessage(value,isError=false){
   message=String(value||'').slice(0,250);error=isError;paint();
 }
 function shopOptions(){
   return shops.map(s=>'<option value="'+escapeHtml(s.id)+'" '+(selected===s.id?'selected':'')+'>'+
    escapeHtml(s.name)+' ('+escapeHtml(roles.get(s.id)||'member')+')</option>').join('');
 }
 const roleNames={owner:'Owner',manager:'Manager',cashier:'Cashier',viewer:'Viewer'};
 const roleOptions=current=>['manager','cashier','viewer'].map(role=>'<option value="'+role+'" '+(current===role?'selected':'')+'>'+roleNames[role]+'</option>').join('');
 function teamMarkup(){
   const role=roles.get(selected);
   if(!role)return '';
   const owner=role==='owner';
   return '<section class="bn-team-panel" aria-label="Team and roles"><h4>Team &amp; roles</h4><p class="mini-note">Your role: <strong>'+escapeHtml(roleNames[role]||role)+'</strong>. Each member uses their own registered email.</p>'+
   '<div class="bn-role-hierarchy"><div><strong>Owner</strong><small>Manage shop and team</small></div><div><strong>Manager</strong><small>Manage cloud products and operations</small></div><div><strong>Cashier</strong><small>Billing and payments via cloud API</small></div><div><strong>Viewer</strong><small>Read-only permitted cloud records</small></div></div>'+
   (owner?'<form id="bnAddMemberForm" class="bn-db-form"><h4>Add team member</h4><label>Registered email ID<input name="email" type="email" maxlength="200" required autocomplete="off"></label><label>Assign role<select name="role">'+roleOptions('cashier')+'</select></label><button type="submit" class="btn btn-primary btn-sm" '+(busy?'disabled':'')+'>Add member</button><p class="mini-note">The member must first register and verify their email. Adding an existing member updates their role.</p></form>'+
    '<h4>Current members</h4>'+(team.length?'<div class="bn-team-list">'+team.map(m=>'<div class="bn-team-member"><div class="bn-member-info"><strong>'+escapeHtml(m.full_name||m.email||'Member')+'</strong><small>'+escapeHtml(m.email)+'</small><span class="bn-member-role">'+escapeHtml(roleNames[m.role]||m.role)+'</span></div>'+
     (m.role==='owner'?'<span class="mini-note">Protected owner</span>':'<form class="bn-team-role-form" data-bn-role-form data-user-id="'+escapeHtml(m.user_id)+'"><label class="sr-only">Role</label><select name="role" aria-label="Member role" '+(busy?'disabled':'')+'>'+roleOptions(m.role)+'</select><button type="submit" class="btn btn-sm" '+(busy?'disabled':'')+'>Save role</button><button type="button" class="btn btn-sm bn-member-remove" data-bn-db="remove-member" data-user-id="'+escapeHtml(m.user_id)+'" '+(busy?'disabled':'')+'>Remove</button></form>')+'</div>').join('')+'</div>':'<p class="mini-note">No member details loaded. Refresh shops.</p>'):'<p class="mini-note">Only the owner can add, remove or change roles.</p>')+
   '<p class="mini-note">Team permissions apply to Cloud Shops. Local billing records are not shared. Individual subscription requirements remain unchanged.</p></section>';
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
    await loadTeam();
    setMessage('Team membership updated.');
   }finally{busy=false;paint()}
 }
 async function addMember(form){
   const d=new FormData(form),email=String(d.get('email')||'').trim(),role=d.get('role');
   if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>200||!['manager','cashier','viewer'].includes(role))throw Error('Enter a valid registered email and select a role.');
   await mutateTeam('bn_add_existing_member',{p_email:email,p_role:role});
 }
 async function changeMember(form){
   const user=form.dataset.userId,role=new FormData(form).get('role');
   if(!isUuid(user)||!['manager','cashier','viewer'].includes(role))throw Error('Invalid member or role.');
   await mutateTeam('bn_change_member_role',{p_user_id:user,p_role:role});
 }
 async function removeMember(user){
   if(!isUuid(user)||!team.some(m=>m.user_id===user&&m.role!=='owner'))return;
   if(confirm('Remove this member from the selected cloud shop? Their own account will remain.'))await mutateTeam('bn_remove_member',{p_user_id:user});
 }
 function teamError(err){const msg=String(err?.message||'');setMessage(/^(Enter a valid|Only the shop owner|Staff member must|Owner role|Invalid member|Member not found)/.test(msg)?msg:'Could not update team. Check that the member has verified their email, then refresh before retrying.',true);}
 function settingsMarkup(){
   resetForAccount();
   const signed=Boolean(account());
   const status=!cloud?.hasAuthConfig?.()?'Cloud service is currently unavailable. Contact BillNest support.':!signed?'Sign in to manage your cloud shops.':!loaded?'View your existing cloud shops or create a new one.':shops.length?'Your cloud shops are ready.':'No cloud shops yet.';
   const active=shops.find(s=>s.id===selected);
   const canEdit=['owner','manager'].includes(roles.get(selected));
   return '<section class="card setting-section bn-database-panel" id="bnDatabasePanel" aria-label="Cloud shops">'+
    '<div class="bn-shop-heading"><span class="bn-shop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18l-2-6H5zM4 10v10h16V10M9 20v-6h6v6"/><path d="M8 10v2m8-2v2"/></svg></span><div><h3>Cloud Shops</h3><p>Manage shops, team access and online products.</p></div></div>'+
    '<p class="bn-shop-warning">Cloud stock is separate from your local inventory and billing. Changes here do not sync with local records.</p>'+
    '<p class="mini-note">'+escapeHtml(status)+'</p>'+
    (message?'<p class="bn-db-message '+(error?'bn-db-error':'')+'" role="status">'+escapeHtml(message)+'</p>':'')+
    (signed?'<div class="bn-db-actions"><button class="btn btn-sm" type="button" data-bn-db="refresh" '+(busy?'disabled':'')+'>Load / refresh shops</button></div>'+
      '<form id="bnCreateShopForm" class="bn-db-form"><h4>Create a shop</h4><label>Shop name<input type="text" name="name" minlength="1" maxlength="120" required placeholder="Enter shop name"></label><label>State (optional)<input type="text" name="state" maxlength="100" placeholder="Enter state"></label><button class="btn btn-primary btn-sm" type="submit" '+(busy?'disabled':'')+'>Create shop</button></form>'+
      (shops.length?'<div class="bn-db-select"><label for="bnShopSelect">Cloud shop</label><select id="bnShopSelect" class="select-input" '+(busy?'disabled':'')+'>'+shopOptions()+'</select></div>':'')+
      (active?teamMarkup()+'<div class="bn-db-catalog"><h4>Cloud products: '+escapeHtml(active.name)+'</h4>'+
      '<p class="mini-note">Showing up to 40 cloud products.</p>'+
      (products.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th></tr></thead><tbody>'+
       products.map(p=>'<tr><td>'+escapeHtml(p.sku)+'</td><td>'+escapeHtml(p.name)+'</td><td>₹'+(Number(p.price_paise||0)/100).toFixed(2)+'</td><td>'+escapeHtml(p.stock_qty)+' '+escapeHtml(p.unit||'pcs')+'</td></tr>').join('')+
       '</tbody></table></div>':'<p class="mini-note">No cloud products to display yet.</p>')+
      (canEdit?'<form id="bnAddCloudProductForm" class="bn-db-form"><h4>Add product to cloud</h4>'+
       '<label>SKU<input name="sku" required maxlength="80" placeholder="PROD-001"></label>'+
       '<label>Product name<input name="name" required maxlength="200"></label>'+
       '<label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" max="100000000" required></label>'+
       '<label>Unit<select name="unit"><option value="pcs">Pieces</option><option value="kg">Kilogram (kg)</option></select></label><label>Opening stock<input name="stock" type="number" min="0" max="1000000" step="0.001" value="0" required></label>'+
       '<button type="submit" class="btn btn-primary btn-sm" '+(busy?'disabled':'')+'>Save cloud product</button></form>':
       '<p class="mini-note">Your role cannot modify cloud products.</p>')+
       '</div>':''):'<p class="mini-note">Sign in to get started.</p>')+
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
     await Promise.all([loadProducts(),loadTeam()]);
     setMessage('Cloud shops refreshed.');
   }catch(err){
     loaded=false;
     console.warn('Cloud shop refresh failed',err);
     setMessage('Could not load cloud shops. Check your internet connection and try again.',true);
   }finally{busy=false;paint()}
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
   busy=true;paint();
   try{
     const id=await api('/rest/v1/rpc/bn_create_shop',{method:'POST',body:{p_name:name,p_state:state,p_invoice_prefix:'INV'}});
     if(!isUuid(id))throw Error('Cloud shop response was invalid.');
     selected=id;
     await apiRefreshAfterMutation();
     setMessage('Cloud shop created.');
   }finally{busy=false;paint()}
 }
 async function apiRefreshAfterMutation(){
   const next=await api('/rest/v1/bn_shops?select=id,name,state,created_at&order=created_at.desc&limit=50');
   const members=await api('/rest/v1/bn_shop_members?select=shop_id,role&user_id=eq.'+encodeURIComponent(account().id)+'&limit=50');
   roles=new Map((Array.isArray(members)?members:[]).map(row=>[row.shop_id,row.role]));
   shops=(Array.isArray(next)?next:[]).filter(row=>isUuid(row.id));
   if(!shops.some(s=>s.id===selected))selected=shops[0]?.id||'';
   loaded=true;
   await Promise.all([loadProducts(),loadTeam()]);
   try{if(identity&&selected)localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
 }
 async function addProduct(form){
   if(busy||!isUuid(selected))return;
   const d=new FormData(form),sku=String(d.get('sku')||'').trim(),name=String(d.get('name')||'').trim();
   const amount=Number(d.get('price')),stock=Number(d.get('stock')),price=Math.round(amount*100),unit=d.get('unit')==='kg'?'kg':'pcs';
   const scaled=stock*(unit==='kg'?1000:1);
   if(!sku||!name||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(price)||
      price>10000000000000||!Number.isFinite(stock)||Math.abs(scaled-Math.round(scaled))>0.000001||stock<0||stock>1000000)
     throw Error('Enter a valid SKU, name, price and opening stock.');
   busy=true;paint();
   try{
     await api('/rest/v1/rpc/bn_upsert_product',{method:'POST',
       body:{p_shop_id:selected,p_sku:sku,p_name:name,p_price_paise:price,p_stock_qty:stock,p_unit:unit}});
     await Promise.all([loadProducts(),loadTeam()]);
     setMessage('Product saved to the selected cloud shop. Local inventory is unchanged.');
   }finally{busy=false;paint()}
 }
 document.addEventListener('click',event=>{
   const btn=event.target.closest?.('[data-bn-db]');
   if(!btn)return;
   event.preventDefault();
   if(btn.dataset.bnDb==='refresh')void refresh();
   if(btn.dataset.bnDb==='remove-member')void removeMember(btn.dataset.userId).catch(teamError);
 });
 document.addEventListener('change',event=>{
   if(event.target.id!=='bnShopSelect'||busy)return;
   const next=event.target.value;
   if(!shops.some(s=>s.id===next))return;
   selected=next;products=[];team=[];busy=true;paint();
   try{localStorage.setItem('billnest-cloud-shop-'+identity,selected)}catch{}
   void (async()=>{try{await Promise.all([loadProducts(),loadTeam()]);paint()}catch(err){console.warn('Cloud catalog load failed',err);setMessage('Could not load cloud shop. Please refresh your shops.',true)}finally{busy=false;paint()}})();
 });
 document.addEventListener('submit',event=>{
   const form=event.target;
   if(form?.id==='bnAddMemberForm'||form?.matches?.('[data-bn-role-form]')){event.preventDefault();void (form.id==='bnAddMemberForm'?addMember(form):changeMember(form)).catch(teamError);return;}
   if(!['bnCreateShopForm','bnAddCloudProductForm'].includes(form?.id))return;
   event.preventDefault();
   const action=form.id==='bnCreateShopForm'?createShop:addProduct;
   void action(form).catch(err=>{console.warn('Cloud shop action failed',err);const msg=String(err?.message||'');setMessage(msg.startsWith('Enter a ') ? msg : 'Could not save. Please refresh your cloud shops and check whether the change was saved before trying again.',true)});
 });
 window.addEventListener('billnest-auth-changed',()=>{identity='';resetForAccount();paint()});
 globalThis.BillNestDatabase={settingsMarkup,refresh,readOnlyStatus:()=>({loaded,shops:shops.length,products:products.length})};
})();
