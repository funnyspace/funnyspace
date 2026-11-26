/* BillNest account registration and login. Real OTPs require Supabase Auth configuration. */
(() => {
 'use strict';
 const cloud=globalThis.BillNestCloud;
 // Public subscription merchant address, shipped with the QR renderer to prevent mixed-cache configuration.
 const SUBSCRIPTION_UPI='9631011998@ptsbi';
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
 let signupName='',signupMobile='';
 let mode='signin',channel='email',contact='',sent=false,busy=false,notice='',noticeError=false,previousFocus=null,resendAfter=0,resendTimer=null;
 const account=()=>cloud.currentAccount?.()||null;
 const app=document.getElementById('app');
 const gate=document.getElementById('billnestAuthGate');
 const status=document.getElementById('billnestAuthStatus');
 const retry=document.getElementById('billnestAuthRetry');
 const reset=document.getElementById('billnestAuthReset');
 let locked=true,verified=null,loaded=false,loading=false,checking=false,reloading=false;
 let entitlement=null,accessDeadline=0;
 const plan=document.getElementById('billnestPlanGate');
 const trialBadge=document.createElement('span');trialBadge.className='billnest-trial-badge';trialBadge.hidden=true;top.prepend(trialBadge);
 let paymentBusy=false;
 const paymentDialog=document.createElement('dialog');paymentDialog.className='bn-payment-dialog';document.body.append(paymentDialog);
 let paymentAccount='',paymentPlan='monthly';
 const formatPlanMoney=paise=>'₹'+(paise/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const planDetails=(info,code)=>{const annual=code==='annual',base=Number(annual?info.annual_base_paise:info.monthly_base_paise),amount=Number(annual?info.annual_price_paise:info.price_paise),gst=Number(info.gst_percent),tax=Math.round(base*gst/100);if(Number(info.pricing_version)!==2||gst!==18||base!==(annual?99900:9900)||amount!==base+tax)throw Error('Invalid subscription amount. Reload BillNest.');return {code:annual?'annual':'monthly',base,amount,tax,gst,period:annual?'year':'month',label:annual?'Annual':'Monthly'};};
 const planButtons=info=>{const renderOption=code=>{try{const p=planDetails(info,code),annual=code==='annual';return `<button type="button" class="bn-subscription-option ${annual?'bn-annual-option':''}" data-subscription-pay="${code}"><span>${p.label}${annual?' <b class="bn-plan-saving">Save ₹223.02</b>':''}</span><strong>₹${p.base/100} + <span style="font-size:0.65em;white-space:nowrap">${p.gst}% GST</span></strong><small>per ${p.period}</small><small>Total payable: ${formatPlanMoney(p.amount)}</small></button>`;}catch{return `<button type="button" class="bn-subscription-option" disabled><span>${code==='annual'?'Annual':'Monthly'}</span><small>Refresh to load pricing</small></button>`;}};return '<div class="bn-subscription-options">'+renderOption('monthly')+renderOption('annual')+'</div>';};
 function paymentNotice(message){const el=paymentDialog.querySelector('[data-payment-notice]');if(el)el.textContent=message;}
 async function openPayment(requestedPlan='monthly'){
  const user=account(),info=entitlement;
  if(!user||!info||info.user_id!==user.id)return;
  if(paymentDialog.open)return;
  paymentAccount=user.id;paymentPlan=requestedPlan==='annual'?'annual':'monthly';
  paymentDialog.innerHTML='<div class="bn-payment-inner"><button type="button" class="bn-payment-close" aria-label="Close" data-payment-close>×</button><h2>Subscription payment</h2><p data-payment-notice role="status">Checking payment status…</p><div data-payment-content></div></div>';
  paymentDialog.showModal();
  try{
   const rows=await cloud.databaseRequest('/rest/v1/bn_subscription_payments?select=id,status,created_at,plan_code,amount_paise&order=created_at.desc&limit=1');
   if(!paymentDialog.open||account()?.id!==paymentAccount)return;
   const content=paymentDialog.querySelector('[data-payment-content]');
   if(rows?.[0]?.status==='pending'){paymentNotice((rows[0].plan_code==='annual'?'Annual':'Monthly')+' payment of ₹'+(Number(rows[0].amount_paise)/100).toFixed(2)+' submitted. Awaiting verification. Do not pay again.');return;}
   const upi=SUBSCRIPTION_UPI;
   if(!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upi)){paymentNotice('Payment details are temporarily unavailable. Reload BillNest and try again.');return;}
   const selected=planDetails(info,paymentPlan),amount=selected.amount;
   paymentNotice(rows?.[0]?.status==='rejected'?'Previous payment could not be verified. Check your bank transaction before paying again.':'Scan using your preferred UPI app. Verify the recipient name before paying.');
   content.innerHTML='<div class="bn-payment-amount">₹'+(amount/100).toFixed(2)+' <small>/ '+selected.period+' · incl. GST</small></div><div class="bn-payment-tax"><div><span>Subscription fee</span><strong>'+formatPlanMoney(selected.base)+'</strong></div><div><span>GST (18%)</span><strong>'+formatPlanMoney(selected.tax)+'</strong></div><div><span>Total payable</span><strong>'+formatPlanMoney(amount)+'</strong></div></div><div class="bn-payment-qr" data-payment-qr></div><p class="bn-payment-hint">On mobile, use another device to scan, or save the QR image and import it in a supported UPI app.</p><form data-payment-form><label>UPI transaction reference (12 digits)<input name="reference" inputmode="numeric" pattern="[0-9]{12}" maxlength="12" required autocomplete="off"></label><button type="submit" class="btn btn-primary">Submit payment for verification</button></form><p class="bn-payment-hint">Access is activated only after BillNest verifies receipt. No automatic renewal.</p>';
   if(typeof globalThis.QRCode!=='function')throw Error('QR unavailable. Reload and try again.');
   const uri='upi://pay?'+new URLSearchParams({pa:upi,pn:'BillNest',am:(amount/100).toFixed(2),cu:'INR',tn:'BillNest '+selected.code+' subscription'}).toString();
   new globalThis.QRCode(content.querySelector('[data-payment-qr]'),{text:uri,width:216,height:216,colorDark:'#101e30',colorLight:'#ffffff',correctLevel:globalThis.QRCode.CorrectLevel.M});
  }catch(err){paymentDialog.querySelector('[data-payment-content]')?.replaceChildren();paymentNotice('Unable to load payment details. Reopen this window and try again.');}
 }
 paymentDialog.addEventListener('click',event=>{if(event.target.closest('[data-payment-close]')&&!paymentBusy)paymentDialog.close();});
 paymentDialog.addEventListener('cancel',event=>{if(paymentBusy)event.preventDefault();});
 paymentDialog.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-payment-form]'))return;
  event.preventDefault();if(paymentBusy||account()?.id!==paymentAccount)return;
  const form=event.target,reference=String(new FormData(form).get('reference')||'').trim();
  if(!/^[0-9]{12}$/.test(reference))return;
  paymentBusy=true;const btn=form.querySelector('button');btn.disabled=true;
  try{
   await cloud.databaseRequest('/rest/v1/bn_subscription_payments',{method:'POST',preference:'return=minimal',body:{user_id:paymentAccount,reference,plan_code:paymentPlan,pricing_version:2}});
   if(account()?.id!==paymentAccount)return;
   paymentDialog.querySelector('[data-payment-content]').replaceChildren();
   paymentNotice('Payment submitted. Awaiting verification. Do not pay again.');
  }catch(err){paymentNotice('Could not submit this reference. Close and reopen to check whether it was received. Do not pay again.');}
  finally{paymentBusy=false;btn.disabled=false;}
 });
 document.addEventListener('click',event=>{const button=event.target.closest?.('[data-subscription-pay]');if(button){event.preventDefault();void openPayment(button.dataset.subscriptionPay);}});
 function remainingDays(){return Math.max(0,Math.ceil((accessDeadline-performance.now())/86400000));}
 function showPlan(info){
  plan.hidden=false;plan.querySelector('[data-plan-options]').innerHTML=planButtons(info);
  plan.querySelector('[data-plan-contact]').textContent='Pay using the UPI QR code. Access is activated after payment verification.';
  layer.hidden=true;document.body.classList.remove('billnest-auth-open');
 }
 function subscriptionMarkup(){
  const info=entitlement;
  if(!info||info.user_id!==account()?.id)return '<section id="billnestSubscriptionPanel" class="card setting-section billnest-subscription-panel"><h3>Subscription</h3><p class="mini-note">Subscription status has not been verified yet.</p></section>';
  const left=remainingDays(),active=performance.now()<accessDeadline&&info.status!=='expired',trial=info.status==='trial'&&active;
  const date=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not available';};
  const amount=Number(info.price_paise)/100;
  const price=Number.isFinite(amount)&&amount>=0?'₹'+amount.toLocaleString('en-IN'):'Not available';
  const duration=Date.parse(info.trial_ends_at)-Date.parse(info.trial_started_at);
  const percent=trial&&duration>0?Math.min(100,Math.max(0,(accessDeadline-performance.now())/duration*100)):0;
  const badge=trial?'Free trial':active?'Premium active':'Expired';
  return `<section id="billnestSubscriptionPanel" class="card setting-section billnest-subscription-panel" aria-label="Subscription information"><div class="subscription-heading"><span class="subscription-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg></span><div><h3>Subscription</h3><p class="mini-note">Manage your BillNest plan.</p></div><span class="subscription-status ${active?'is-active':''}">${badge}</span></div><div class="subscription-plan"><strong>BillNest Premium</strong><span>${info.last_paid_plan==='annual'?'Annual plan':info.last_paid_plan==='monthly'?'Monthly plan':'Choose a plan'}</span></div>${trial?`<div class="subscription-trial"><strong>${left} day${left===1?'':'s'} remaining</strong><span>15-day free trial</span><div class="subscription-progress" role="progressbar" aria-label="Trial remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><div style="width:${percent}%"></div></div></div>`:''}<div class="subscription-row"><span>Trial started</span><strong>${esc(date(info.trial_started_at))}</strong></div><div class="subscription-row"><span>Trial ends</span><strong>${esc(date(info.trial_ends_at))}</strong></div><div class="subscription-row"><span>Access valid until</span><strong>${esc(date(info.access_ends_at))}</strong></div><div class="subscription-row"><span>Payment status</span><strong>${info.paid_until&&Date.parse(info.paid_until)>Date.parse(info.server_now)?'Paid':'No active paid subscription'}</strong></div><p class="mini-note subscription-note">Pay by UPI QR. Subscription activation requires payment verification.</p>${planButtons(info)}<p class="mini-note">Prices include 18% GST. Choose a plan to display its payment QR code.</p><button type="button" class="btn subscription-refresh" data-subscription-refresh>Refresh subscription status</button></section>`;
 }
 function paintSubscription(){const panel=document.getElementById('billnestSubscriptionPanel');if(panel)panel.outerHTML=subscriptionMarkup();}
 globalThis.BillNestSubscription=Object.freeze({settingsMarkup:subscriptionMarkup});
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-subscription-refresh]')){event.preventDefault();if(navigator.onLine===false){const b=event.target.closest('[data-subscription-refresh]');b.textContent='Connect to the internet to refresh';return;}void checkAccess();}});
 function updateTrialBadge(){trialBadge.hidden=!entitlement||locked;trialBadge.textContent=entitlement?.status==='trial'?remainingDays()+' days left in trial':'Premium active';}
 function exportExpiredData(){try{const raw=localStorage.getItem(cloud.workspaceKey());if(!raw){gateStatus('No local business data to export.',true);return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download='BillNest-business-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch{gateStatus('Unable to export your data.',true);}}
 plan.querySelector('[data-plan-export]').addEventListener('click',exportExpiredData);
 function setLocked(value){
  locked=value;
  app.hidden=value;app.inert=value;
  gate.hidden=!value;
  document.body.toggleAttribute('data-auth-locked',value);
  updateTrialBadge();paintSubscription();
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
   await cloud.socialReady;
   if(reloading)return;
   if(!account()){
    verified=null;entitlement=null;accessDeadline=0;plan.hidden=true;setLocked(true);
    if(loaded||loading){reloadLocked();return;}
    gateStatus('Sign in to access your BillNest workspace.');
    if(layer.hidden)open();else render();
    return;
   }
   if(navigator.onLine===false){
    // Existing, previously validated open tabs may work offline until token expiry.
    if(loaded&&verified&&verified.id===account().id&&verified.expiresAt>Date.now()&&entitlement?.status!=='expired'&&performance.now()<accessDeadline){updateTrialBadge();paintSubscription();return;}
    if(entitlement&&performance.now()>=accessDeadline){setLocked(true);showPlan(entitlement);gateStatus('Your access period has ended. Connect to check subscription status.',true);return;}
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
   const info=await cloud.databaseRequest('/rest/v1/rpc/bn_subscription_status',{method:'POST',body:{}});
   if(reloading||account()?.id!==user.id){reloadLocked();return;}
   if(!info||info.user_id!==user.id||!['trial','active','expired'].includes(info.status)||!Number.isFinite(Date.parse(info.server_now))||!Number.isFinite(Date.parse(info.access_ends_at)))throw Error('Invalid subscription status.');
   entitlement=info;accessDeadline=performance.now()+Math.max(0,Date.parse(info.access_ends_at)-Date.parse(info.server_now));
   if(info.status==='expired'||performance.now()>=accessDeadline){setLocked(true);showPlan(info);gateStatus('Your 15-day trial or subscription has ended.',true);return;}
   plan.hidden=true;
   if(!loaded){
    loading=true;
    await loadScript('app.bundle.js?v=52');
    await loadScript('i18n.js?v=3');
    loaded=true;loading=false;
   }
   if(reloading||account()?.id!==verified.id){reloadLocked();return;}
   const wasLocked=locked;setLocked(false);if(wasLocked&&!layer.hidden)close();
  }catch(err){
   if(reloading)return;
   plan.hidden=true;setLocked(true);gateStatus('Unable to verify or load your workspace. Connect to the internet and retry.',true);
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
 setInterval(()=>{if(entitlement&&performance.now()>=accessDeadline&&!locked){setLocked(true);showPlan(entitlement);gateStatus('Your access period has ended. Check subscription status.',true);}if(account()||loaded)void checkAccess()},30000);
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
  contact='';signupName='';signupMobile='';sent=false;resendAfter=0;notice='';noticeError=false;
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
 const socialIcons={google:'<svg viewBox="0 0 48 48" width="19" height="19" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.95-2.24 5.46-4.76 7.16l7.73 6C44.42 38 46.98 31.85 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.12.78-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.82l-7.73-6c-2.15 1.45-4.92 2.31-8.18 2.31-6.26 0-11.57-4.22-13.47-9.9l-7.97 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>',apple:'<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor"><path d="M17.05 12.31c.03 3.1 2.72 4.13 2.75 4.14-.02.07-.43 1.47-1.41 2.91-.85 1.24-1.73 2.47-3.11 2.5-1.36.03-1.8-.81-3.36-.81-1.57 0-2.06.78-3.35.84-1.33.05-2.34-1.34-3.2-2.57-1.75-2.53-3.08-7.15-1.29-10.27a4.97 4.97 0 0 1 4.22-2.56c1.31-.02 2.55.89 3.36.89.8 0 2.31-1.1 3.9-.94.67.03 2.56.27 3.77 2.04-.1.06-2.25 1.31-2.28 3.83ZM14.52 4.77c.71-.87 1.18-2.06 1.05-3.25-1.03.04-2.27.69-3.01 1.55-.66.76-1.24 1.97-1.08 3.13 1.15.09 2.33-.57 3.04-1.43Z"/></svg>'};
 function socialMarkup(){return '<div class="billnest-social-divider"><span>or</span></div><div class="billnest-social-options">'+['google','apple'].map(provider=>'<button type="button" class="billnest-social-button" data-auth-social="'+provider+'" '+(busy?'disabled':'')+'>'+socialIcons[provider]+'<span>Continue with '+(provider==='google'?'Google':'Apple')+'</span></button>').join('')+'</div><p class="billnest-social-note">Enter your name and mobile number first. Your provider supplies the verified email.</p>';}
 function render(){
  updateButton();
  if(layer.hidden)return;
  const user=account();
  layer.classList.toggle('billnest-register-layer',!user&&mode==='signup');
  if(channel!=='email'){channel='email';resetFlow();}
  let content='';
  if(user){
   content='<div class="billnest-auth-user"><strong class="billnest-auth-status"><span aria-hidden="true"></span>Signed in</strong><div class="billnest-auth-identity">'+esc(user.full_name||user.email||user.phone||'BillNest user')+'</div>'+(user.full_name&&user.email?'<p class="billnest-auth-note">'+esc(user.email)+'</p>':'')+(user.contact_mobile?'<p class="billnest-auth-note">Mobile: '+esc(user.contact_mobile)+' (not verified)</p>':'')+'</div>'+
    (entitlement?'<p class="billnest-auth-note">'+(entitlement.status==='trial'?remainingDays()+' days remaining in your free trial':entitlement.status==='active'?'Premium subscription active':'Subscription required')+'</p>':'')+
    '<p class="billnest-auth-note">Your shop data stays separate from other accounts on this device. Offline records are saved locally; cloud backup is available in Settings.</p>'+
    (importAvailable()?'<button type="button" class="billnest-auth-primary" data-auth-import>Copy existing offline store into this account</button><p class="billnest-auth-note">Your original offline store will not be deleted.</p>':'')+
    '<button type="button" class="billnest-auth-logout" data-auth-signout>Sign out</button>';
  }else if(!cloud.hasAuthConfig?.()){
   content='<section class="billnest-auth-setup" role="alert"><strong>Email login needs activation</strong>'+
    '<p class="billnest-auth-note">Connect your Supabase project and enable email authentication to receive verification codes.</p>'+
    '<p class="billnest-auth-note">The workspace is protected. Ask the shop administrator to configure authentication, then reload.</p></section>';
  }else{
   content='<form id="billnestAuthSend" class="billnest-auth-form">'+
    (mode==='signup'?'<label for="billnestSignupName">Full name</label><input id="billnestSignupName" name="full_name" type="text" autocomplete="name" maxlength="100" required value="'+esc(signupName)+'" '+(sent?'readonly':'')+'><label for="billnestSignupMobile">Mobile number</label><input id="billnestSignupMobile" name="contact_mobile" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" required value="'+esc(signupMobile)+'" '+(sent?'readonly':'')+'>':'')+
    '<label for="billnestAuthContact">Email ID</label>'+
    '<input id="billnestAuthContact" name="contact" type="email" inputmode="email" autocomplete="email"'+
    ' value="'+esc(contact)+'" maxlength="200" required '+(sent?'readonly':'')+'>'+
    (!sent?'<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Send registration code':'Send login code')+'</button>':'')+'</form>'+
    (sent?'<form id="billnestAuthVerify" class="billnest-auth-form">'+(mode==='signup'?'<p class="billnest-register-recipient">Code sent to <strong>'+esc(contact)+'</strong></p>':'')+'<label for="billnestAuthOtp">Verification code</label>'+
    '<input id="billnestAuthOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" placeholder="Enter verification code" required>'+
    '<button type="submit" class="billnest-auth-primary" '+(busy?'disabled':'')+'>'+(mode==='signup'?'Verify and create account':'Verify and sign in')+'</button>'+
    '<p class="billnest-auth-resend-hint" role="status" aria-live="polite">Did not receive a code? You can resend it when the countdown ends.</p>'+
    '<div class="billnest-auth-otp-actions"><button type="button" data-auth-resend class="billnest-auth-secondary" '+(resendSeconds()>0||busy?'disabled':'')+'>'+(resendSeconds()>0?'Resend code in '+resendSeconds()+'s':'Resend code')+'</button>'+
    '<button type="button" data-auth-restart class="billnest-auth-secondary">Change '+(channel==='email'?'email':'number')+'</button></div></form>':'')+
    '<p class="billnest-auth-note">'+(mode==='signup'
      ?'Email OTP verification only. Mobile number is saved for contact.'
      :'Enter the email ID registered with your account. Sign in will not create another account.')+
    (mode==='signup'?'':' An internet connection is required to receive a code.')+'</p>'+(mode==='signup'&&!sent?socialMarkup():'');
  }
  const footer=(!user&&cloud.hasAuthConfig?.())
   ?'<div class="billnest-auth-switch"><button type="button" data-auth-mode="'+(mode==='signin'?'signup':'signin')+'">'+
     (mode==='signin'?'Create account':'Already have an account? Sign in')+'</button></div>'
   :'';
  layer.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="billnestAuthTitle" class="billnest-auth-panel'+(!user&&mode==='signup'?' billnest-register-panel':'')+'" data-auth-step="'+(sent?'verify':'entry')+'">'+
   (!locked?'<button type="button" class="billnest-auth-close" data-auth-close aria-label="Close">×</button>':'')+
   '<div class="billnest-auth-title"><div class="brand"><div class="brand-mark" aria-hidden="true"><img src="logo-mark.svg?v=24" width="47" height="53" alt=""></div><div><strong>BillNest</strong><small>INVENTORY &amp; BILLING</small></div></div><h2 id="billnestAuthTitle">'+(user?'My Account':mode==='signup'?'Create account':'Sign in')+'</h2></div>'+
   '<p class="billnest-auth-subtitle">'+(user?'Manage your account and billing data.':'Secure access to your business workspace')+'</p>'+
   '<div class="billnest-auth-content">'+content+'</div>'+footer+'</div>';
  messageBox();
 }
 function open(){previousFocus=document.activeElement;layer.hidden=false;document.body.classList.add('billnest-auth-open');render();if(sent)scheduleResend();(layer.querySelector('[data-auth-close]')||layer.querySelector(sent?'#billnestAuthOtp':mode==='signup'?'#billnestSignupName':'#billnestAuthContact')||layer.querySelector('button'))?.focus({preventScroll:true})}
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
  if(target.matches('[data-auth-social]')){
   if(mode!=='signup'||sent||account())return;
   signupName=String(layer.querySelector('#billnestSignupName')?.value||'').trim();signupMobile=String(layer.querySelector('#billnestSignupMobile')?.value||'').trim();contact=String(layer.querySelector('#billnestAuthContact')?.value||'').trim();
   busy=true;layer.querySelectorAll('button,input').forEach(el=>el.disabled=true);
   message('Connecting to '+(target.dataset.authSocial==='google'?'Google':'Apple')+'…');
   cloud.startSocialSignIn(target.dataset.authSocial,{full_name:signupName,contact_mobile:signupMobile}).catch(err=>{busy=false;render();message(err.message||'Could not start account creation.',true);});return;
  }
  if(target.matches('[data-auth-use-email]')){channel='email';resetFlow();render();layer.querySelector('#billnestAuthContact')?.focus();return}
  if(target.matches('[data-auth-mode]')){
   mode=target.dataset.authMode;channel='email';resetFlow();render();layer.querySelector(mode==='signup'?'#billnestSignupName':'#billnestAuthContact')?.focus({preventScroll:true});return;
  }

  if(target.matches('[data-auth-restart]')){resetFlow();render();layer.querySelector(mode==='signup'?'#billnestSignupName':'#billnestAuthContact')?.focus({preventScroll:true});return}
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
   if(!sent||resendSeconds()>0||channel!=='email')return;
   busy=true;updateResendState();
   cloud.sendOtp(channel,contact,mode,mode==='signup'?{full_name:signupName,contact_mobile:signupMobile}:undefined).then(result=>{
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
  if(channel!=='email'){channel='email';resetFlow();render();return;}
  busy=true;
  const submit=form.querySelector('[type=submit]');
  if(submit)submit.disabled=true;
  try{
   if(form.id==='billnestAuthSend'){
    const data=new FormData(form),raw=String(data.get('contact')||'').trim();
    if(mode==='signup'){signupName=String(data.get('full_name')||'').trim();signupMobile=String(data.get('contact_mobile')||'').trim();}
    const result=await cloud.sendOtp(channel,raw,mode,mode==='signup'?{full_name:signupName,contact_mobile:signupMobile}:undefined);
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
 function showSocialError(){mode='signup';channel='email';resetFlow();open();message(cloud.getSocialError?.()||'Social sign-in was not completed.',true);cloud.clearSocialError?.();}
 window.addEventListener('billnest-social-auth-error',showSocialError);
 if(cloud.getSocialError?.())showSocialError();
 updateButton();
 void checkAccess();
})();