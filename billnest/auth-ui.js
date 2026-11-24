/* BillNest account registration and login. Real OTPs require Supabase Auth configuration. */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 const top=document.querySelector('.top-actions');
 if(!cloud||!top)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const layer=document.createElement('div');
 layer.id='billnestAuthLayer';
 layer.className='billnest-auth-layer';
 layer.hidden=true;
 document.body.append(layer);
 const btn=document.createElement('button');
 btn.type='button';
 btn.className='billnest-account-btn';
 btn.id='billnestAccountBtn';
 top.prepend(btn);
 let mode='signin',channel='email',contact='',sent=false,busy=false,notice='',noticeError=false,previousFocus=null,resendAfter=0,resendTimer=null;
 const account=()=>cloud.currentAccount?.()||null;
 const app=document.getElementById('app');
 const gate=document.getElementById('billnestAuthGate');
 const status=document.getElementById('billnestAuthStatus');
 const retry=document.getElementById('billnestAuthRetry');
 const reset=document.getElementById('billnestAuthReset');
 let locked=true,verified=null,loaded=false,loading=false,checking=false,reloading=false;
 function setLocked(value){
  locked=value;
  app.hidden=value;app.inert=value;
  gate.hidden=!value;
  document.body.toggleAttribute('data-auth-locked',value);
 }
 function gateStatus(value,canRetry=false){
  status.textContent=value;retry.hidden=!canRetry;reset.hidden=!account();
 }
 function reloadLocked(){
  if(reloading)return;
  reloading=true;setLocked(true);location.reload();
 }
 function loadScript(src){
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=src;
   script.onload=resolve;script.onerror=()=>reject(Error('Unable to load BillNest. Please reload.'));
   document.body.append(script);
  });
 }
 async function checkAccess(){
  if(checking||reloading)return;
  checking=true;
  try{
   if(!account()){
    verified=null;setLocked(true);
    if(loaded||loading){reloadLocked();return;}
    gateStatus('Sign in to access your BillNest workspace.');
    if(layer.hidden)open();else render();
    return;
   }
   if(navigator.onLine===false){
    // Existing, previously validated open tabs may work offline until token expiry.
    if(loaded&&verified&&verified.id===account().id&&verified.expiresAt>Date.now())return;
    setLocked(true);gateStatus('Connect to the internet to verify your session.',true);return;
   }
   if(verified&&verified.expiresAt<=Date.now())setLocked(true);
   const user=await cloud.validateSession();
   if(reloading)return;
   if(!user){
    verified=null;setLocked(true);
    if(loaded||loading){reloadLocked();return;}
    gateStatus('Your session has expired. Sign in again.');
    if(layer.hidden)open();else render();
    return;
   }
   if(verified&&verified.id!==user.id){reloadLocked();return;}
   verified=user;
   if(!loaded){
    loading=true;
    await loadScript('app.bundle.js?v=33');
    await loadScript('i18n.js?v=3');
    loaded=true;loading=false;
   }
   if(reloading||account()?.id!==verified.id){reloadLocked();return;}
   const wasLocked=locked;setLocked(false);if(wasLocked&&!layer.hidden)close();
  }catch(err){
   if(reloading)return;
   setLocked(true);gateStatus('Unable to verify or load your workspace. Connect to the internet and retry.',true);
   // A partially initialized bundle must not be executed a second time.
   if(loading){retry.onclick=()=>reloadLocked();}
  }finally{checking=false}
 }
 retry.addEventListener('click',()=>{if(!loading)void checkAccess()});
 reset.addEventListener('click',()=>cloud.signOut());
 window.addEventListener('online',()=>void checkAccess());
 window.addEventListener('offline',()=>void checkAccess());
 window.addEventListener('hashchange',()=>void checkAccess());
 window.addEventListener('pageshow',()=>void checkAccess());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkAccess()});
 window.addEventListener('storage',event=>{
  if(event.key===null||event.key==='billnest-cloud-session-v1'){
   const incoming=(()=>{try{return JSON.parse(event.newValue||'null')}catch{return null}})();
   // Same-account token rotations are not account switches.
   if(event.key===null||!incoming?.user?.id||incoming.user.id!==account()?.id)reloadLocked();
  }
 });
 setInterval(()=>{if(account()||loaded)void checkAccess()},30000);
 function updateButton(){
  const signed=Boolean(account());
  btn.innerHTML='<span class="billnest-account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><span class="billnest-account-text">'+(signed?'My Account':'Login / Sign up')+'</span>';
  btn.setAttribute('aria-label',signed?'Open your BillNest account':'Create a BillNest account or sign in');
 }
 function importAvailable(){
  try{return Boolean(account()?.id&&localStorage.getItem('billnest-workspace-v1')&&!localStorage.getItem(cloud.workspaceKey()))}catch{return false}
 }
 function messageBox(){
  const old=layer.querySelector('.billnest-auth-message');
  if(old)old.remove();
  if(!notice)return;
  const panel=layer.querySelector('.billnest-auth-content');
  if(!panel)return;
  const node=document.createElement('p');
  node.className='billnest-auth-message'+(noticeError?' error':'');
  node.setAttribute('role','status');
  node.textContent=notice;
  if(noticeError&&channel==='phone'&&!account()){
   const alternative=document.createElement('button');
   alternative.type='button';
   alternative.className='billnest-auth-email-alternative';
   alternative.setAttribute('data-auth-use-email','');
   alternative.textContent='Use Email ID instead';
   node.append(alternative);
  }
  panel.append(node);
 }
 function message(value,error=false){notice=String(value||'');noticeError=error;messageBox()}
 function resetFlow(){
  contact='';sent=false;resendAfter=0;notice='';noticeError=false;
  if(resendTimer){clearTimeout(resendTimer);resendTimer=null}
 }
 function resendSeconds(){return Math.max(0,Math.ceil((resendAfter-Date.now())/1000))}
 function updateResendState(){
  const remaining=resendSeconds();
  const button=layer.querySelector('[data-auth-resend]');
  if(button){
   button.disabled=busy||remaining>0;
   button.textContent=remaining?'Resend code in '+remaining+'s':'Resend code';
  }
  const hint=layer.querySelector('.billnest-auth-resend-hint');
  if(hint)hint.textContent=remaining?'Did not receive a code? Try again in '+remaining+' seconds.':'Did not receive a code? You can resend it now.';
 }
 function scheduleResend(){
  if(resendTimer){clearTimeout(resendTimer);resendTimer=null}
  if(layer.hidden||!sent)return;
  updateResendState();
  if(resendSeconds()>0)resendTimer=setTimeout(scheduleResend,1000);
 }
 function render(){
  updateButton();
  if(layer.hidden)return;
  const user=account();
  let content='';
  if(user){
   content='<div class="billnest-auth-user"><strong>Signed in</strong>'+esc(user.email||user.phone||'BillNest user')+'</div>'+
    '<p class="billnest-auth-note">Your shop data stays separate from other accounts on this device. Offline records are saved locally; cloud backup is available in Settings.</p>'+
    (importAvailable()?'<button type="button" class="billnest-auth-primary" data-auth-import>Copy existing offline store into this account</button><p class="billnest-auth-note">Your original offline store will not be deleted.</p>':'')+
    '<button type="button" class="billnest-auth-logout" data-auth-signout>Sign out</button>';
  }else if(!cloud.hasAuthConfig?.()){
   content='<section class="billnest-auth-setup" role="alert"><strong>Email and mobile login need activation</strong>'+
    '<p class="billnest-auth-note">Connect your Supabase project and enable email authentication or a mobile SMS provider to receive verification codes.</p>'+
    '<p class="billnest-auth-note">The workspace is protected. Ask the shop administrator to configure authentication, then reload.</p></section>';
  }else{
   content='<div class="billnest-auth-tabs billnest-auth-channel" role="tablist" aria-label="Sign-in method">'+
    '<button type="button" role="tab" data-auth-tab="email" aria-selected="'+(channel==='email')+'">Email ID</button>'+
    '<button type="button" role="tab" data-auth-tab="phone" aria-selected="'+(channel==='phone')+'">Mobile number</button></div>'+
    '<form id="billnestAuthSend" class="billnest-auth-form">'+
    '<label for="billnestAuthContact">'+(channel==='email'?'Email ID':'Mobile number')+'</label>'+
    '<input id="billnestAuthContact" name="contact" '+(channel==='email'?'type="email" inputmode="email" autocomplete="email"':'type="tel" inputmode="tel" autocomplete="tel"')+
    ' value="'+esc(contact)+'" maxlength="200" required '+(sent?'readonly':'')+'>'+
    (!sent?'<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Send registration code':'Send login code')+'</button>':'')+'</form>'+
    (sent?'<form id="billnestAuthVerify" class="billnest-auth-form"><label for="billnestAuthOtp">Verification code</label>'+
    '<input id="billnestAuthOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" placeholder="Enter verification code" required>'+
    '<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Verify and create account':'Verify and sign in')+'</button>'+
    '<p class="billnest-auth-resend-hint" role="status" aria-live="polite">Did not receive a code? You can resend it when the countdown ends.</p>'+
    '<div class="billnest-auth-otp-actions"><button type="button" data-auth-resend class="billnest-auth-secondary" '+(resendSeconds()>0||busy?'disabled':'')+'>'+(resendSeconds()>0?'Resend code in '+resendSeconds()+'s':'Resend code')+'</button>'+
    '<button type="button" data-auth-restart class="billnest-auth-secondary">Change '+(channel==='email'?'email':'number')+'</button></div></form>':'')+
    '<p class="billnest-auth-note">'+(mode==='signup'
      ?'A new account is created after your email or mobile number is verified. No password is required.'
      :'Enter the email ID or mobile number registered with your account. Sign in will not create another account.')+
    ' An internet connection is required to receive a code.</p>';
  }
  const footer=(!user&&cloud.hasAuthConfig?.())
   ?'<div class="billnest-auth-switch"><button type="button" data-auth-mode="'+(mode==='signin'?'signup':'signin')+'">'+
     (mode==='signin'?'Create account':'Already have an account? Sign in')+'</button></div>'
   :'';
  layer.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="billnestAuthTitle" class="billnest-auth-panel">'+
   (!locked?'<button type="button" class="billnest-auth-close" data-auth-close aria-label="Close">×</button>':'')+
   '<div class="billnest-auth-title"><div class="billnest-auth-brand"><img class="billnest-auth-reference-logo" src="data:image/webp;base64,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" width="337" height="151" alt="billnest. INVENTORY + BILLING"></div><h2 id="billnestAuthTitle">'+(user?'My Account':mode==='signup'?'Create account':'Sign in')+'</h2></div>'+
   '<p class="billnest-auth-subtitle">'+(user?'Manage your account and local billing data.':'Email ID or mobile number')+'</p>'+
   '<div class="billnest-auth-content">'+content+'</div>'+footer+'</div>';
  messageBox();
 }
 function open(){previousFocus=document.activeElement;layer.hidden=false;document.body.classList.add('billnest-auth-open');render();if(sent)scheduleResend();(layer.querySelector('[data-auth-close]')||layer.querySelector('#billnestAuthContact')||layer.querySelector('button'))?.focus()}
 function close(){
  if(locked)return;
  layer.hidden=true;layer.innerHTML='';document.body.classList.remove('billnest-auth-open');
  if(resendTimer){clearTimeout(resendTimer);resendTimer=null}
  previousFocus?.focus?.();
 }
 btn.addEventListener('click',open);
 layer.addEventListener('click',e=>{
  if(e.target===layer){close();return}
  const target=e.target.closest('button');
  if(!target||busy)return;
  if(target.matches('[data-auth-close]')){close();return}
  if(target.matches('[data-auth-use-email]')){channel='email';resetFlow();render();layer.querySelector('#billnestAuthContact')?.focus();return}
  if(target.matches('[data-auth-mode]')){
   mode=target.dataset.authMode;resetFlow();render();layer.querySelector('#billnestAuthContact')?.focus();return;
  }
  if(target.matches('[data-auth-tab]')){
   channel=target.dataset.authTab;resetFlow();render();layer.querySelector('#billnestAuthContact')?.focus();return;
  }
  if(target.matches('[data-auth-restart]')){resetFlow();render();layer.querySelector('#billnestAuthContact')?.focus();return}
  if(target.matches('[data-auth-settings]')){close();location.hash='#settings';return}
  if(target.matches('[data-auth-signout]')){
   if(confirm('Sign out of BillNest? Your local billing records will remain on this device.'))cloud.signOut();
   return;
  }
  if(target.matches('[data-auth-import]')){
   if(!importAvailable()||!confirm('Copy your existing offline store into this account? The original store will remain unchanged.'))return;
   try{
    const source=localStorage.getItem('billnest-workspace-v1');
    const data=JSON.parse(source);
    if(data?.version!==1||!Array.isArray(data.products)||!Array.isArray(data.invoices)||!Array.isArray(data.customers))throw Error('Invalid offline workspace');
    localStorage.setItem(cloud.workspaceKey(),source);location.reload();
   }catch(err){message('Could not copy offline data: '+err.message,true)}
   return;
  }
  if(target.matches('[data-auth-resend]')){
   if(!sent||resendSeconds()>0)return;
   busy=true;updateResendState();
   cloud.sendOtp(channel,contact,mode).then(result=>{
    contact=result.contact;resendAfter=Date.now()+60000;
    message('Another code was requested. Check your '+(channel==='email'?'email inbox and spam folder':'mobile SMS')+'.');
   }).catch(err=>{
    if(err?.status===429)resendAfter=Date.now()+60000;
    message(err.message||'Unable to resend the code. Try again or change the contact.',true);
   }).finally(()=>{busy=false;scheduleResend()});
  }
 });
 layer.addEventListener('submit',async e=>{
  const form=e.target;
  if(form.id!=='billnestAuthSend'&&form.id!=='billnestAuthVerify')return;
  e.preventDefault();
  if(busy)return;
  busy=true;
  const submit=form.querySelector('[type=submit]');
  if(submit)submit.disabled=true;
  try{
   if(form.id==='billnestAuthSend'){
    const raw=String(new FormData(form).get('contact')||'').trim();
    const result=await cloud.sendOtp(channel,raw,mode);
    contact=result.contact;sent=true;resendAfter=Date.now()+60000;
    render();
    message('Code request accepted. Check your '+(channel==='email'?'email inbox and spam folder':'mobile SMS')+'. If nothing arrives, use Resend code after the countdown.');
    scheduleResend();
    layer.querySelector('#billnestAuthOtp')?.focus();
   }else{
    const code=new FormData(form).get('otp');
    await cloud.verifyOtp(channel,contact,code);
    close();
   }
  }catch(err){message(err.message||'Account request failed. Try again.',true)}
  finally{busy=false;const active=layer.querySelector('[type=submit]');if(active)active.disabled=false;updateResendState()}
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
 window.addEventListener('billnest-auth-changed',()=>{updateButton();reloadLocked()});
 window.addEventListener('billnest-google-auth-error',()=>{
  open();
  message(cloud.getGoogleError?.()||'Google sign-in was not completed.',true);
  cloud.clearGoogleError?.();
 });
 if(cloud.getGoogleError?.()){
  open();message(cloud.getGoogleError(),true);cloud.clearGoogleError?.();
 }
 updateButton();
 void checkAccess();
})();