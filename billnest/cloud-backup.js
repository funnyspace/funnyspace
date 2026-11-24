/**
 * BillNest optional cloud backup for its static GitHub Pages site.
 * Local-first: save locally, then upload one latest snapshot per signed-in device.
 * Cloud restore is always explicit. Never share a service_role / secret key here.
 */
(() => {
  'use strict';
  const CONFIG_KEY = 'billnest-cloud-config-v1';
  const SESSION_KEY = 'billnest-cloud-session-v1';
  const GOOGLE_PKCE_KEY = 'billnest-google-pkce-v1';
  const DEVICE_KEY = 'billnest-cloud-device-v1';
  const MAX_BACKUP_CHARS = 8_000_000;
  const TABLE = 'billnest_cloud_backups';
  const read = key => {try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }};
  const persist = (key, value) => {try { if(value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }};
  const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '') && String(value).length <= 200;
  // E.164 is required by Supabase for phone authentication. For Indian shops, also
  // accept a plain ten-digit domestic number as a convenient +91 shorthand.
  function normalizeOtpContact(channel,value){
    const raw=String(value||'').trim();
    if(channel==='email'){
      const email=raw.toLowerCase();
      if(!validEmail(email))throw Error('Please enter a valid email address.');
      return email;
    }
    if(channel!=='phone')throw Error('Choose email or mobile number.');
    let phone=raw.replace(/[\s().-]/g,'');
    if(/^\d{10}$/.test(phone))phone='+91'+phone;
    if(/^91\d{10}$/.test(phone))phone='+'+phone;
    if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Enter a valid mobile number. For India, use 10 digits, or enter a number with its country code.');
    return phone;
  }
  const uuid = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'bn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId || !/^[\w-]{12,64}$/.test(deviceId)) {deviceId = uuid();try{localStorage.setItem(DEVICE_KEY,deviceId)}catch{}}
  // Public project identifiers may be deployed by the site owner. Never embed service_role keys.
  const deployedConfig = globalThis.BILLNEST_AUTH_CONFIG || {};
  let config = read(CONFIG_KEY) || null;
  const originalConfig = config;
  if (deployedConfig.url && deployedConfig.key) {
    try {
      config = {url:assertConfig(deployedConfig.url,deployedConfig.key),key:deployedConfig.key,deviceName:config?.deviceName||'My browser'};
    } catch (err) {console.error('Invalid BillNest public auth configuration',err);config=null}
  }
  let session = read(SESSION_KEY) || null;
  let googleError = '';
  // An auth token from another project must never be reused against a new project.
  if(session && (!config || (originalConfig && (originalConfig.url!==config.url || originalConfig.key!==config.key)))){
    session=null;
    persist(SESSION_KEY,null);
  }
  let workspaceReader = null;
  let restoreHandler = null;
  let list = [];
  let message = '';
  let state = 'local';
  let pending = false;
  let dirtySeq = 0;
  let savedSeq = -1;
  let timer = null;
  let busy = false;
  let inFlight = null;
  let otpEmail = '';
  let otpTarget = '';
  let otpChannel = '';
  const workspaceKey = () => session?.user?.id ? 'billnest-workspace-v1-user-'+session.user.id : 'billnest-workspace-v1';
  const accountInfo = () => config && session?.access_token && session?.user?.id ? {id:session.user.id,email:session.user.email||'',phone:session.user.phone||''} : null;
  let refreshing = null;
  let lastSync = '';
  let authGeneration = 0;
  const online = () => navigator.onLine !== false;
  const ready = () => Boolean(config?.url && config?.key && session?.access_token && session?.user?.id);
  function assertConfig(url, key) {
    const parsed = new URL(String(url || '').trim());
    if(parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Enter a Supabase project HTTPS URL without a path.');
    if(!/^[A-Za-z0-9.\-]+$/.test(parsed.hostname) || parsed.hostname.length > 255) throw Error('Invalid Supabase host.');
    if(!/^[A-Za-z0-9_.\-]+$/.test(String(key || '')) || String(key).length > 2000) throw Error('Enter the Supabase publishable or legacy anon public key.');
    if(/^sb_secret_/i.test(key)) throw Error('Never enter a Supabase secret or service_role key in the website.');
    return parsed.origin;
  }
  function setMessage(value, nextState) {message = String(value || '').slice(0,200);if(nextState)state = nextState;paint();}
  function statusLabel() {
    if(!config) return 'Local only. Cloud not configured';
    if(!session) return 'Cloud configured. Sign in to enable backup';
    if(!online()) return 'Offline. Local changes will upload when online';
    if(busy) return 'Saving cloud backup…';
    if(state === 'error') return 'Cloud backup needs attention';
    if(pending) return 'Pending cloud backup';
    return lastSync ? 'Cloud saved ' + new Date(lastSync).toLocaleString() : 'Cloud connected';
  }
  const deviceName = () => String(config?.deviceName || 'My browser').slice(0,60);
  function markup() {
    const connected = ready();
    const subtitle = 'Stores data locally first and backs up automatically when online. Backups are private to your signed-in account.';
    const saved = list.length ? `<div class="cloud-backup-list">${list.map(row => `<div class="cloud-backup-row"><div><strong>${escapeHtml(row.device_name || 'Browser device')}</strong><small>${escapeHtml(new Date(row.saved_at).toLocaleString())} · ${Math.max(0,Math.round(Number(row.size_bytes||0)/1024))} KB ${row.device_id===deviceId?'· This device':''}</small></div><button type="button" class="btn btn-sm" data-cloud-restore="${escapeHtml(row.device_id)}">Restore</button></div>`).join('')}</div>` : `<p class="mini-note">No cloud backups listed yet.</p>`;
    return `<section class="card setting-section cloud-backup-panel" id="cloudBackupPanel" aria-label="Cloud backup settings"><h3>☁ Cloud backup</h3><p>${subtitle}</p><div class="cloud-backup-status" role="status"><span class="cloud-indicator-dot ${connected && online() && state!=='error'?'cloud-online':''}"></span> ${escapeHtml(statusLabel())}</div>${message?`<p class="cloud-message ${state==='error'?'cloud-message-error':''}">${escapeHtml(message)}</p>`:''}
    <form id="cloudConfigForm" class="cloud-small-form"><label for="cloudUrl">Supabase project URL</label><input id="cloudUrl" type="url" name="url" placeholder="https://your-project.supabase.co" value="${escapeHtml(config?.url||'')}" required autocomplete="off"><label for="cloudKey">Publishable (public anon) key</label><input id="cloudKey" name="key" type="text" placeholder="sb_publishable_..." value="${escapeHtml(config?.key||'')}" required autocomplete="off"><label for="cloudDeviceName">Device name</label><input id="cloudDeviceName" name="deviceName" maxlength="60" value="${escapeHtml(deviceName())}" autocomplete="off"><button class="btn btn-sm" type="submit">Save cloud connection</button><p class="mini-note">Never paste a secret, service_role or database password here. Cloud setup requires the SQL table described in the project README.</p></form>
    ${config && !connected ? `<div class="cloud-signin-area"><form id="cloudOtpForm" class="cloud-small-form"><label for="cloudEmail">Email for cloud sign-in</label><input id="cloudEmail" type="email" name="email" value="${escapeHtml(otpEmail)}" placeholder="you@example.com" autocomplete="email" required><button class="btn btn-primary btn-sm" type="submit">Email sign-in code</button></form>${otpEmail?`<form id="cloudVerifyForm" class="cloud-small-form"><label for="cloudToken">6-digit email code</label><input id="cloudToken" name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Enter emailed code" required><button class="btn btn-sm" type="submit">Verify & connect</button></form>`:''}</div>`:''}
    ${connected ? `<p class="mini-note">Signed in as ${escapeHtml(session.user.email || session.user.phone || 'your account')}. Each device keeps its own latest backup. Restoring another device’s backup replaces this device’s workspace only after confirmation.</p><div class="cloud-action-row"><button class="btn btn-primary btn-sm" type="button" data-cloud-action="backup">Save to cloud now</button><button class="btn btn-sm" type="button" data-cloud-action="refresh">Refresh backups</button><button class="btn btn-sm" type="button" data-cloud-action="signout">Sign out</button></div>${saved}` : ''}
    <p class="cloud-privacy-note">Online backup is optional. Your products, invoices, customer details and accounting data are uploaded to your Supabase project only after you connect and sign in. This is backup and manual restore, not automatic merging between devices.</p></section>`;
  }
  function paint() {
    const panel=document.getElementById('cloudBackupPanel');
    if(panel){const temp=document.createElement('div');temp.innerHTML=markup();const replacement=temp.firstElementChild;if(replacement)panel.replaceWith(replacement);}
  }
  async function request(path, {method='GET', body, accessToken, preference, signal}={}) {
    if(!config) throw Error('Configure cloud backup first.');
    if(!online()) throw Error('Offline. Changes are safe on this device.');
    const headers={apikey:config.key};
    if(accessToken)headers.Authorization='Bearer '+accessToken;
    if(body!==undefined)headers['Content-Type']='application/json';
    if(preference)headers.Prefer=preference;
    const response=await fetch(config.url+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal});
    const raw=await response.text();
    let json;try{json=raw?JSON.parse(raw):null}catch{json=null}
    if(!response.ok){
      const rawDetail=String(json?.message || json?.msg || json?.error_description || json?.error || 'HTTP '+response.status).slice(0,180);
      const lower=rawDetail.toLowerCase();
      const code=String(json?.error_code||json?.code||'').toLowerCase();
      let detail=rawDetail;
      if(response.status===429||code.includes('rate_limit'))detail='Too many code requests. Wait before using Resend code, then try again.';
      else if(code==='phone_provider_disabled'||lower.includes('unsupported phone provider'))
        detail='Mobile verification is not available: the Supabase Phone provider or SMS service is disabled. The shop owner must enable Phone authentication and configure an SMS provider. You can use Email ID instead.';
      else if(code==='otp_disabled'||lower.includes('signups not allowed for otp'))
        detail='OTP registration is disabled in Supabase. The shop owner must enable new user registration and the selected Email or Phone provider.';
      else if(code.includes('sms')||lower.includes('sms provider')||lower.includes('sms_send'))
        detail='SMS delivery failed. The shop owner must check the Phone provider, SMS service credentials and delivery status in Supabase.';
      else if(code==='email_address_not_authorized'||lower.includes('email address not authorized'))
        detail='Supabase cannot email this address using its default sender. The shop owner must configure custom SMTP to send codes to customers.';
      else if(lower.includes('email provider')||code.includes('email_provider'))
        detail='Email sign-in is disabled. The shop owner must enable Email authentication in Supabase.';
      else if(code.includes('email')&&code.includes('rate'))
        detail='Email sending limit reached. Try later or contact the shop owner to configure custom SMTP.';
      else if(lower.includes('expired')||lower.includes('invalid otp')||lower.includes('token has expired'))
        detail='The verification code is incorrect or expired. Request a new code and try again.';
      else if(!online())detail='You are offline. Connect to the internet and try again.';
      const error=new Error(detail);error.status=response.status;error.code=code;throw error;
    }
    return json;
  }
  async function accessToken() {
    if(!session)throw Error('Please sign in.');
    if(Number(session.expiresAt)>Date.now()+60000)return session.access_token;
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      if(!session?.refresh_token){const err=Error('Session expired. Please sign in again.');err.status=401;throw err;}
      const generation=authGeneration,identity=session.user?.id;
      const result=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
      if(authGeneration!==generation||session?.user?.id!==identity)throw Error('Account changed during session refresh.');
      if(!result?.access_token || !result?.refresh_token || (result.user?.id&&result.user.id!==identity)){const err=Error('Cannot refresh your cloud session. Sign in again.');err.status=401;throw err;}
      session={access_token:result.access_token,refresh_token:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,user:result.user||session.user};
      persist(SESSION_KEY,session);
      return session.access_token;
    })();
    try{return await refreshing}finally{refreshing=null}
  }
  // Validate cached credentials with Supabase Auth, not just localStorage.
  async function validateSession() {
    if(!ready())return null;
    const identity=session.user.id, generation=authGeneration;
    try {
      const token=await accessToken();
      const user=await request('/auth/v1/user',{accessToken:token});
      if(generation!==authGeneration||session?.user?.id!==identity)return null;
      if(!user?.id||user.id!==identity){clearSession();return null;}
      session={...session,user};
      persist(SESSION_KEY,session);
      return {id:user.id,email:user.email||'',phone:user.phone||'',expiresAt:Number(session.expiresAt)};
    } catch(err) {
      if(generation!==authGeneration)return null;
      if([400,401,403].includes(err?.status)){clearSession();return null;}
      throw err;
    }
  }
  async function databaseRequest(path,options={}) {
    // The authenticated REST interface is limited to BillNest database endpoints.
    // Never expose the refresh token, public auth config, or a service key here.
    if(typeof path!=='string'||!/^\/rest\/v1\/(?:bn_[a-z_]+|rpc\/bn_[a-z_]+)(?:\?|$)/.test(path))
      throw Error('Invalid database endpoint.');
    const user=session?.user?.id,epoch=authGeneration;
    if(!ready()||!user)throw Error('Sign in to access the Supabase database.');
    const token=await accessToken();
    if(authGeneration!==epoch||session?.user?.id!==user)throw Error('Account changed during database request.');
    const result=await request(path,{...options,accessToken:token});
    if(authGeneration!==epoch||session?.user?.id!==user)throw Error('Account changed during database request.');
    return result;
  }
  const params = values => new URLSearchParams(values).toString();
  async function listBackups() {
    if(!ready())return;
    try{
      const token=await accessToken();
      const rows=await request('/rest/v1/'+TABLE+'?'+params({select:'device_id,device_name,saved_at,size_bytes',order:'saved_at.desc',limit:'40'}),{accessToken:token});
      list=Array.isArray(rows)?rows.filter(x=>/^[\w-]{12,64}$/.test(x.device_id)):[];
      paint();
    }catch(err){setMessage('Unable to list cloud backups: '+err.message,'error')}
  }
  function schedule(ms=1800){
    if(!ready()||!workspaceReader)return;
    pending=true;
    clearTimeout(timer);
    if(online())timer=setTimeout(()=>{backupNow().catch(()=>{})},ms);
    paintStatusOnly();
  }
  function paintStatusOnly(){const indicator=document.querySelector('#cloudBackupPanel .cloud-backup-status');if(indicator)indicator.textContent=statusLabel()}
  async function backupNow() {
    if(!ready())throw Error('Connect and sign in before cloud saving.');
    if(!online()){setMessage('Offline. Your changes are saved on this device and will upload when connected.','offline');return false}
    if(inFlight){pending=true;return inFlight}
    const snapshot=workspaceReader?.();
    if(!snapshot || snapshot.version!==1)throw Error('Workspace not available yet.');
    const serialized=JSON.stringify(snapshot);
    if(serialized.length>MAX_BACKUP_CHARS){setMessage('Cloud backup too large. Download a JSON backup or reduce the size of embedded logos.','error');return false}
    const capture=dirtySeq,identity=session.user.id,generation=authGeneration;
    busy=true;paintStatusOnly();
    inFlight=(async()=>{
      try{
        const token=await accessToken();
        if(generation!==authGeneration||session?.user?.id!==identity)return false;
        await request('/rest/v1/'+TABLE+'?on_conflict=user_id,device_id',{
          method:'POST',accessToken:token,preference:'resolution=merge-duplicates,return=minimal',body:{user_id:identity,device_id:deviceId,device_name:deviceName(),saved_at:new Date().toISOString(),size_bytes:serialized.length,backup:JSON.parse(serialized)}
        });
        savedSeq=capture;
        pending=dirtySeq!==capture;
        lastSync=new Date().toISOString();
        state='saved';message='';
        return true;
      }catch(err){pending=true;state='error';message='Cloud save failed: '+err.message;return false}
      finally{busy=false;inFlight=null;paint();if(pending&&online()&&state!=='error')schedule(500)}
    })();
    return inFlight;
  }
  async function restore(device) {
    if(!ready()||!/^[\w-]{12,64}$/.test(device))return;
    const record=list.find(x=>x.device_id===device);
    if(!record)return setMessage('Refresh backups to select an existing device.','error');
    if(!confirm('Restore backup from '+(record.device_name||'device')+' saved '+new Date(record.saved_at).toLocaleString()+'? This replaces the local products, invoices, inventory, settings and accounting data. Download a JSON backup first if needed.'))return;
    try{
      const token=await accessToken();
      const rows=await request('/rest/v1/'+TABLE+'?'+params({select:'backup',device_id:'eq.'+device,limit:'1'}),{accessToken:token});
      if(!Array.isArray(rows)||!rows[0]?.backup)throw Error('Cloud backup not found.');
      if(!restoreHandler || restoreHandler(rows[0].backup)!==true)throw Error('Backup could not be applied safely.');
      setMessage('Cloud backup restored to this device. A fresh cloud save is queued.','saved');
    }catch(err){setMessage('Restore failed: '+err.message,'error')}
  }
  async function handleConfig(form) {
    const data=new FormData(form);
    const url=assertConfig(data.get('url'),data.get('key'));
    const key=String(data.get('key')).trim();
    const deviceName=String(data.get('deviceName') || 'My browser').trim().slice(0,60)||'My browser';
    const changed=config&&(config.url!==url||config.key!==key);
    if(changed){session=null;persist(SESSION_KEY,null);authGeneration++;list=[];lastSync=''}
    config={url,key,deviceName};
    if(!persist(CONFIG_KEY,config))throw Error('Browser storage is unavailable.');
    setMessage('Authentication connection saved. Open Login / Sign up in the top bar to create an account or sign in.','local');
    if(changed)window.dispatchEvent(new Event('billnest-auth-changed'));
    if(ready())schedule(250);
  }
  // Google sign-in uses OAuth authorization code with PKCE, not URL-fragment tokens.
  // The verifier stays in sessionStorage and the code is exchanged with Supabase.
  const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  async function startGoogleSignIn(){
    if(!config?.url||!config?.key)throw Error('Google login is not enabled yet. The site owner must configure a Supabase project.');
    if(!online())throw Error('Connect to the internet to sign in with Google.');
    if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw Error('Google login requires a secure HTTPS browser.');
    const callback=new URL('./',location.href);
    if(callback.protocol!=='https:' && callback.hostname!=='localhost')throw Error('Google login requires an HTTPS website.');
    const random=crypto.getRandomValues(new Uint8Array(32));
    const verifier=base64url(random);
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const challenge=base64url(new Uint8Array(hash));
    const pending={verifier,createdAt:Date.now(),projectUrl:config.url,returnHash:location.hash||'#dashboard'};
    try{sessionStorage.setItem(GOOGLE_PKCE_KEY,JSON.stringify(pending))}
    catch{throw Error('Browser session storage is disabled. Enable site storage for Google login.')}
    googleError='';
    const params=new URLSearchParams({provider:'google',redirect_to:callback.origin+callback.pathname,code_challenge:challenge,code_challenge_method:'s256'});
    location.assign(config.url+'/auth/v1/authorize?'+params);
    return true;
  }
  async function finishGoogleSignIn(){
    let pending=null;
    try{pending=JSON.parse(sessionStorage.getItem(GOOGLE_PKCE_KEY)||'null')}catch{}
    if(!pending)return false;
    const url=new URL(location.href);
    const code=url.searchParams.get('code');
    const error=url.searchParams.get('error')||url.searchParams.get('error_code');
    const errorDescription=url.searchParams.get('error_description');
    if(!code&&!error)return false;
    try{sessionStorage.removeItem(GOOGLE_PKCE_KEY)}catch{}
    for(const name of ['code','error','error_code','error_description'])url.searchParams.delete(name);
    history.replaceState(history.state,'',url.pathname+url.search+(pending.returnHash&&/^#[a-z/-]+$/i.test(pending.returnHash)?pending.returnHash:url.hash));
    if(error){
      googleError='Google sign-in was not completed: '+String(errorDescription||error).slice(0,160);
      window.dispatchEvent(new Event('billnest-google-auth-error'));
      return false;
    }
    if(!config||pending.projectUrl!==config.url||!pending.verifier||Date.now()-pending.createdAt>10*60*1000){
      googleError='The Google sign-in request expired or the authentication project changed. Please try again.';
      window.dispatchEvent(new Event('billnest-google-auth-error'));
      return false;
    }
    try{
      const result=await request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:pending.verifier}});
      if(!result?.access_token||!result?.refresh_token||!result?.user?.id)throw Error('Google verification did not return a valid session.');
      session={access_token:result.access_token,refresh_token:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,user:result.user};
      if(!persist(SESSION_KEY,session))throw Error('Unable to save your login session on this device.');
      authGeneration++;list=[];savedSeq=-1;googleError='';
      window.dispatchEvent(new Event('billnest-auth-changed'));
      return true;
    }catch(err){
      googleError='Google sign-in failed: '+String(err?.message||err).slice(0,160);
      window.dispatchEvent(new Event('billnest-google-auth-error'));
      return false;
    }
  }
  async function sendOtp(channel, identifier, mode='signup') {
    if(!config)throw Error('Account creation is not enabled yet. The site owner must configure Supabase authentication.');
    if(!['signup','signin'].includes(mode))throw Error('Choose Create account or Sign in.');
    const target=normalizeOtpContact(channel,identifier);
    await request('/auth/v1/otp',{method:'POST',body:channel==='email'
      ? {email:target,create_user:mode==='signup'}
      : {phone:target,create_user:mode==='signup',channel:'sms'}});
    otpChannel=channel;otpTarget=target;
    setMessage(channel==='email'?'Email code requested. Check inbox and spam. The email template must contain a numeric OTP.':'SMS code requested. Check your messages; delivery depends on the configured SMS provider.','local');
    return {contact:target,channel,mode};
  }
  async function verifyOtp(channel, identifier, code) {
    const target=normalizeOtpContact(channel,identifier),token=String(code||'').replace(/\s+/g,'');
    if(!['email','phone'].includes(channel))throw Error('Select a sign-in method.');
    if(!/^\d{6,8}$/.test(token))throw Error('Enter the 6 to 8 digit verification code.');
    const result=await request('/auth/v1/verify',{method:'POST',body:channel==='email'?{email:target,token,type:'email'}:{phone:target,token,type:'sms'}});
    if(!result?.access_token||!result?.refresh_token||!result?.user?.id)throw Error('Could not complete sign-in.');
    session={access_token:result.access_token,refresh_token:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,user:result.user};
    if(!persist(SESSION_KEY,session)) {session=null;throw Error('Unable to save sign-in to this browser.')}
    otpEmail='';otpTarget='';otpChannel='';authGeneration++;list=[];savedSeq=-1;
    setMessage('Account connected. Local changes will back up automatically while online.','saved');
    window.dispatchEvent(new Event('billnest-auth-changed'));
    return true;
  }
  function clearSession() {
    session=null;persist(SESSION_KEY,null);authGeneration++;list=[];pending=false;clearTimeout(timer);
  }
  function signOut() {
    const token=session?.access_token;
    const target=config;
    clearSession();
    // Revoke the current refresh session when online; local sign-out must not wait.
    if(token&&target&&online()){
      void fetch(target.url+'/auth/v1/logout?scope=local',{
        method:'POST',headers:{apikey:target.key,Authorization:'Bearer '+token},
        cache:'no-store',keepalive:true
      }).catch(()=>{});
    }
    setMessage('Signed out. Offline workspace remains on this device.','local');
    window.dispatchEvent(new Event('billnest-auth-changed'));
  }
  async function sendEmail(form) {
    const data=new FormData(form),email=String(data.get('email')||'').trim();
    if(!validEmail(email))throw Error('Enter a valid email address.');
    await sendOtp('email',email);
    otpEmail=email;
  }
  async function verifyEmail(form) {
    await verifyOtp('email',otpEmail,new FormData(form).get('token'));
  }
  async function handleEvent(event) {
    const form=event.target;
    if(!['cloudConfigForm','cloudOtpForm','cloudVerifyForm'].includes(form?.id))return;
    event.preventDefault();
    try{
      if(form.id==='cloudConfigForm')await handleConfig(form);
      else if(form.id==='cloudOtpForm')await sendEmail(form);
      else await verifyEmail(form);
    }catch(err){setMessage(err.message,'error')}
  }
  document.addEventListener('submit',e=>{void handleEvent(e)});
  document.addEventListener('click',e=>{
    const restoreButton=e.target.closest?.('[data-cloud-restore]');
    if(restoreButton){e.preventDefault();void restore(restoreButton.dataset.cloudRestore);return}
    const button=e.target.closest?.('[data-cloud-action]');
    if(!button)return;
    e.preventDefault();
    const action=button.dataset.cloudAction;
    if(action==='backup')backupNow().then(ok=>{if(ok){setMessage('Current workspace saved to the cloud.','saved');void listBackups()}}).catch(err=>setMessage(err.message,'error'));
    if(action==='refresh')void listBackups();
    if(action==='signout'){
      if(!confirm('Sign out of BillNest on this device? Your saved data will stay on this device.'))return;
      signOut();
    }
  });
  window.addEventListener('online',()=>{if(ready()){setMessage('Internet restored. Uploading locally saved changes…','pending');schedule(300)}});
  window.addEventListener('offline',()=>{if(ready())setMessage('Offline. All changes continue to save on this device.','offline')});
  window.addEventListener('pageshow',()=>{if(ready()&&online())schedule(2200)});
  globalThis.BillNestCloud = {
    settingsMarkup:markup,
    setWorkspaceReader:reader=>{workspaceReader=reader;if(ready()&&online())schedule(2000)},
    setRestoreHandler:handler=>{restoreHandler=handler},
    onSave:()=>{dirtySeq++;schedule(1800)},
    backupNow,
    databaseRequest,
    isConnected:ready,
    getStatus:statusLabel,
    hasAuthConfig:()=>Boolean(config?.url&&config?.key),
    currentAccount:accountInfo,
    validateSession,
    workspaceKey,
    sendOtp,
    verifyOtp,
    signOut,
    startGoogleSignIn,
    getGoogleError:()=>googleError,
    clearGoogleError:()=>{googleError=''},
    normalizeOtpContact
  };
  // The OAuth provider returns here after the user chooses their Google account.
  // Complete the code exchange without allowing an unverified local account.
  void finishGoogleSignIn();
})();
