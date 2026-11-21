/* BillNest sign-in / sign-up interface. Uses the existing Supabase Auth API. */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 const top=document.querySelector('.top-actions');
 if(!cloud||!top)return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const layer=document.createElement('div');
 layer.id='billnestAuthLayer';
 layer.className='billnest-auth-layer';
 layer.hidden=true;
 document.body.append(layer);
 const btn=document.createElement('button');
 btn.type='button';btn.className='billnest-account-btn';btn.id='billnestAccountBtn';
 top.prepend(btn);
 let channel='email',contact='',sent=false,busy=false,message='',isError=false,previousFocus=null;
 const account=()=>cloud.currentAccount();
 function updateButton(){
  const signed=Boolean(account());
  btn.innerHTML='<span class="billnest-account-icon" aria-hidden="true">♙</span><span class="billnest-account-text">'+(signed?'My Account':'Sign in')+'</span>';
  btn.setAttribute('aria-label',signed?'Open BillNest account':'Sign in or sign up to BillNest');
 }
 function importAvailable(){
  try{return Boolean(account()?.id && localStorage.getItem('billnest-workspace-v1') && !localStorage.getItem(cloud.workspaceKey()))}catch{return false}
 }
 function render(){
  updateButton();if(layer.hidden)return;
  const user=account();
  let inner='';
  if(user){
   inner='<div class="billnest-auth-user"><strong>Signed in</strong>'+escape(user.email||user.phone||'BillNest user')+'</div>'+
   '<p class="billnest-auth-note">Your account uses its own workspace on this device. Cloud backup is available in Settings. Your device can continue saving locally offline.</p>'+
   (importAvailable()?'<button type="button" class="billnest-auth-primary" data-auth-import>Copy offline store to this account</button><p class="billnest-auth-note">Only available when this account has no saved workspace on this device. Original data stays unchanged.</p>':'')+
   '<button type="button" class="billnest-auth-logout" data-auth-signout>Sign out</button>';
  }else if(!cloud.hasAuthConfig()){
   inner='<section class="billnest-auth-setup"><strong>Sign-in setup is needed</strong><p class="billnest-auth-note">The site owner must configure Supabase for real email and SMS verification. You can continue using offline billing meanwhile.</p><button type="button" class="billnest-auth-secondary" data-auth-settings>Open cloud settings</button></section>';
  }else{
   inner='<div role="tablist" aria-label="Sign-in method" class="billnest-auth-tabs">'+
    '<button type="button" role="tab" data-auth-tab="email" aria-selected="'+(channel==='email')+'">Email</button>'+
    '<button type="button" role="tab" data-auth-tab="phone" aria-selected="'+(channel==='phone')+'">Mobile number</button></div>'+
    '<form id="billnestAuthSend" class="billnest-auth-form"><label for="billnestAuthContact">'+(channel==='email'?'Email address':'Mobile number including country code')+'</label>'+
    '<input id="billnestAuthContact" name="contact" '+(channel==='email'?'type="email" autocomplete="email" placeholder="you@example.com"':'type="tel" autocomplete="tel" placeholder="+919876543210"')+
    ' value="'+escape(contact)+'" required '+(sent?'readonly':'')+'>'+
    (!sent?'<button class="billnest-auth-primary" type="submit" '+(busy?'disabled':'')+'>Send verification code</button>':'')+'</form>'+
    (sent?'<form id="billnestAuthVerify" class="billnest-auth-form"><label for="billnestAuthOtp">One-time verification code</label>'+
    '<input id="billnestAuthOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" placeholder="6-digit code" required>'+
    '<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>Verify and continue</button>'+
    '<button type="button" data-auth-restart class="billnest-auth-secondary">Use another '+(channel==='email'?'email':'number')+'</button></form>':'')+
    '<p class="billnest-auth-note">New users are registered automatically after verification. Sign-in uses a one-time code, not a password. SMS delivery depends on your configured provider.</p>';
  }
  layer.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="billnestAuthTitle" class="billnest-auth-panel">'+
   '<button type="button" class="billnest-auth-close" aria-label="Close" data-auth-close>×</button>'+
   '<div class="billnest-auth-title"><img src="logo-mark.svg" alt=""><h2 id="billnestAuthTitle">'+(user?'My Account':'Welcome to BillNest')+'</h2></div>'+
   '<p class="billnest-auth-subtitle">'+(user?'Manage your account and local workspace.':'Sign in or create an account with email or mobile OTP.')+'</p>'+
   inner+(message?'<p role="status" class="billnest-auth-message '+(isError?'error':'')+'">'+escape(message)+'</p>':'')+'</div>';
 }
 function open(){previousFocus=document.activeElement;layer.hidden=false;document.body.classList.add('billnest-auth-open');render();layer.querySelector('[data-auth-close]')?.focus()}
 function close(){layer.hidden=true;layer.innerHTML='';document.body.classList.remove('billnest-auth-open');previousFocus?.focus?.()}
 function show(text,error=false){message=String(text||'');isError=error;render()}
 btn.addEventListener('click',open);
 layer.addEventListener('click',e=>{
  if(e.target===layer){close();return}
  const t=e.target.closest('button');if(!t)return;
  if(t.matches('[data-auth-close]')){close();return}
  if(t.matches('[data-auth-tab]')){channel=t.dataset.authTab;contact='';sent=false;message='';render();layer.querySelector('#billnestAuthContact')?.focus();return}
  if(t.matches('[data-auth-restart]')){sent=false;message='';render();layer.querySelector('#billnestAuthContact')?.focus();return}
  if(t.matches('[data-auth-settings]')){close();location.hash='#settings';return}
  if(t.matches('[data-auth-signout]')){if(confirm('Sign out? Local billing records will remain on this device.'))cloud.signOut();return}
  if(t.matches('[data-auth-import]')){
   if(!importAvailable()||!confirm('Copy the offline store into this account? The original offline data stays unchanged.'))return;
   try{
    const source=localStorage.getItem('billnest-workspace-v1'),obj=JSON.parse(source);
    if(obj?.version!==1||!Array.isArray(obj.products)||!Array.isArray(obj.invoices)||!Array.isArray(obj.customers))throw Error('Invalid offline workspace');
    localStorage.setItem(cloud.workspaceKey(),source);location.reload();
   }catch(err){show('Could not copy offline store: '+err.message,true)}
  }
 });
 layer.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const f=e.target;if(f.id!=='billnestAuthSend'&&f.id!=='billnestAuthVerify')return;
  busy=true;
  try{
   if(f.id==='billnestAuthSend'){
    contact=String(new FormData(f).get('contact')||'').trim();
    await cloud.sendOtp(channel,contact);
    sent=true;show('Code sent. Check your '+(channel==='email'?'email':'SMS messages')+'.');
    layer.querySelector('#billnestAuthOtp')?.focus();
   }else{
    await cloud.verifyOtp(channel,contact,new FormData(f).get('otp'));
    close();
   }
  }catch(err){show(err.message||'Sign-in failed. Please try again.',true)}
  finally{busy=false;if(!layer.hidden)render()}
 });
 document.addEventListener('keydown',e=>{
  if(layer.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key!=='Tab')return;
  const items=[...layer.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
  if(!items.length)return;
  if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus()}
  else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus()}
 });
 window.addEventListener('billnest-auth-changed',()=>{updateButton();setTimeout(()=>location.reload(),150)});
 updateButton();
})();
