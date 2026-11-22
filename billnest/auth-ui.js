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
 let mode='signin',channel='phone',contact='',sent=false,busy=false,notice='',noticeError=false,previousFocus=null,resendAfter=0,resendTimer=null;
 const account=()=>cloud.currentAccount?.()||null;
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
  const panel=layer.querySelector('.billnest-auth-panel');
  if(!panel)return;
  const node=document.createElement('p');
  node.className='billnest-auth-message'+(noticeError?' error':'');
  node.setAttribute('role','status');
  node.textContent=notice;
  panel.append(node);
 }
 function message(value,error=false){notice=String(value||'');noticeError=error;messageBox()}
 function resetFlow(){
  contact='';sent=false;resendAfter=0;notice='';noticeError=false;
  if(resendTimer){clearTimeout(resendTimer);resendTimer=null}
 }
 function scheduleResend(){
  if(resendTimer)clearTimeout(resendTimer);
  const delay=Math.max(0,resendAfter-Date.now());
  resendTimer=setTimeout(()=>{
   resendTimer=null;
   const resend=layer.querySelector('[data-auth-resend]');
   if(resend){resend.disabled=false;resend.textContent='Resend verification code'}
  },delay);
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
   content='<section class="billnest-auth-setup" role="alert"><strong>Google and mobile login need activation</strong>'+
    '<p class="billnest-auth-note">To let people sign in with their own Google account or mobile number, the site owner must connect Supabase, enable Google sign-in and configure an SMS provider for phone verification.</p>'+
    '<p class="billnest-auth-note">Until then, you can keep using the offline billing workspace without signing in.</p>'+
    '<button type="button" class="billnest-auth-google" data-auth-google><span class="billnest-google-g" aria-hidden="true">G</span> Continue with Google</button>'+
    '<button type="button" class="billnest-auth-primary" data-auth-settings>Configure authentication</button>'+
    '<button type="button" class="billnest-auth-secondary" data-auth-close>Continue without account</button></section>';
  }else{
   content='<button type="button" class="billnest-auth-google" data-auth-google><span class="billnest-google-g" aria-hidden="true">G</span> Continue with Google</button>'+
    '<p class="billnest-auth-or">or sign in with a mobile number / email</p>'+
    '<div class="billnest-auth-tabs billnest-auth-mode" role="tablist" aria-label="Account action">'+
    '<button type="button" role="tab" data-auth-mode="signup" aria-selected="'+(mode==='signup')+'">Create account</button>'+
    '<button type="button" role="tab" data-auth-mode="signin" aria-selected="'+(mode==='signin')+'">Sign in</button></div>'+
    '<div class="billnest-auth-tabs" role="tablist" aria-label="Verification method">'+
    '<button type="button" role="tab" data-auth-tab="email" aria-selected="'+(channel==='email')+'">Email ID</button>'+
    '<button type="button" role="tab" data-auth-tab="phone" aria-selected="'+(channel==='phone')+'">Mobile number</button></div>'+
    '<form id="billnestAuthSend" class="billnest-auth-form">'+
    '<label for="billnestAuthContact">'+(channel==='email'?'Email address':'Mobile number (India +91 by default)')+'</label>'+
    '<input id="billnestAuthContact" name="contact" '+(channel==='email'?'type="email" autocomplete="email" placeholder="you@example.com"':'type="tel" inputmode="tel" autocomplete="tel" placeholder="9876543210 or +919876543210"')+
    ' value="'+esc(contact)+'" maxlength="200" required '+(sent?'readonly':'')+'>'+
    (!sent?'<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Create account with OTP':'Send login code')+'</button>':'')+'</form>'+
    (sent?'<form id="billnestAuthVerify" class="billnest-auth-form"><label for="billnestAuthOtp">Verification code</label>'+
    '<input id="billnestAuthOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" placeholder="Enter 6-digit OTP" required>'+
    '<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Verify and create account':'Verify and sign in')+'</button>'+
    '<div class="billnest-auth-otp-actions"><button type="button" data-auth-resend class="billnest-auth-secondary" '+(Date.now()<resendAfter?'disabled':'')+'>Resend verification code</button>'+
    '<button type="button" data-auth-restart class="billnest-auth-secondary">Change '+(channel==='email'?'email':'number')+'</button></div></form>':'')+
    '<p class="billnest-auth-note">'+(mode==='signup'
      ?'New accounts are created only after email or SMS verification. No password is needed.'
      :'Enter the same email or mobile number used for registration. This login will not create another account.')+
    ' A working internet connection is required to receive a code.</p>';
  }
  layer.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="billnestAuthTitle" class="billnest-auth-panel">'+
   '<button type="button" class="billnest-auth-close" data-auth-close aria-label="Close">×</button>'+
   '<div class="billnest-auth-title"><img src="logo-mark.svg" width="45" height="45" alt=""><h2 id="billnestAuthTitle">'+(user?'My Account':mode==='signup'?'Create your BillNest account':'Login to BillNest')+'</h2></div>'+
   '<p class="billnest-auth-subtitle">'+(user?'Manage your account and local billing data.':'Use your Google account or verify your mobile number')+'</p>'+
   content+'</div>';
  messageBox();
 }
 function open(){previousFocus=document.activeElement;layer.hidden=false;document.body.classList.add('billnest-auth-open');render();layer.querySelector('[data-auth-close]')?.focus()}
 function close(){
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
  if(target.matches('[data-auth-google]')){
   busy=true;target.disabled=true;
   cloud.startGoogleSignIn().catch(err=>{
    busy=false;target.disabled=false;
    message(err.message||'Unable to start Google login.',true);
   });
   return;
  }
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
   if(Date.now()<resendAfter)return;
   busy=true;target.disabled=true;
   cloud.sendOtp(channel,contact,mode).then(result=>{
    contact=result.contact;resendAfter=Date.now()+60000;
    message('Another verification code was requested. Check your '+(channel==='email'?'email inbox':'SMS')+'.');
    scheduleResend();
   }).catch(err=>message(err.message||'Unable to resend the code.',true)).finally(()=>{busy=false;const b=layer.querySelector('[data-auth-resend]');if(b&&!resendTimer)b.disabled=false});
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
    message('Verification code requested. Check your '+(channel==='email'?'email inbox (also spam)':'mobile SMS')+'.');
    scheduleResend();
    layer.querySelector('#billnestAuthOtp')?.focus();
   }else{
    const code=new FormData(form).get('otp');
    await cloud.verifyOtp(channel,contact,code);
    close();
   }
  }catch(err){message(err.message||'Account request failed. Try again.',true)}
  finally{busy=false;const active=layer.querySelector('[type=submit]');if(active)active.disabled=false}
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
 window.addEventListener('billnest-google-auth-error',()=>{
  open();
  message(cloud.getGoogleError?.()||'Google sign-in was not completed.',true);
  cloud.clearGoogleError?.();
 });
 if(cloud.getGoogleError?.()){
  open();message(cloud.getGoogleError(),true);cloud.clearGoogleError?.();
 }
 updateButton();
})();