/**
 * BillNest optional cloud backup for its static GitHub Pages site.
 * Local-first: save locally, then upload one latest snapshot per signed-in device.
 * Cloud restore is always explicit. Never share a service_role / secret key here.
 */
(() => {
  'use strict';
  const CONFIG_KEY = 'billnest-cloud-config-v1';
  const SESSION_KEY = 'billnest-cloud-session-v1';
  const DEVICE_KEY = 'billnest-cloud-device-v1';
  const MAX_BACKUP_CHARS = 8_000_000;
  const TABLE = 'billnest_cloud_backups';
  const read = key => {try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }};
  const persist = (key, value) => {try { if(value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }};
  const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '') && String(value).length <= 200;
  const uuid = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'bn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId || !/^[\w-]{12,64}$/.test(deviceId)) {deviceId = uuid();try{localStorage.setItem(DEVICE_KEY,deviceId)}catch{}}
  // Public project identifiers may be deployed by the site owner. Never embed service_role keys.
  const deployedConfig = globalThis.BILLNEST_AUTH_CONFIG || {};
  let config = read(CONFIG_KEY) || null;
  if (deployedConfig.url && deployedConfig.key) {
    try {
      config = {url:assertConfig(deployedConfig.url,deployedConfig.key),key:deployedConfig.key,deviceName:config?.deviceName||'My browser'};
    } catch (err) {console.error('Invalid BillNest public auth configuration',err);config=null}
  }
  let session = read(SESSION_KEY) || null;
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
  const accountInfo = () => session?.user ? {id:session.user.id,email:session.user.email||'',phone:session.user.phone||''} : null;
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
  async function request(path, {method='GET', body, accessToken, preference}={}) {
    if(!config) throw Error('Configure cloud backup first.');
    if(!online()) throw Error('Offline. Changes are safe on this device.');
    const headers={apikey:config.key};
    if(accessToken)headers.Authorization='Bearer '+accessToken;
    if(body!==undefined)headers['Content-Type']='application/json';
    if(preference)headers.Prefer=preference;
    const response=await fetch(config.url+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
    const raw=await response.text();
    let json;try{json=raw?JSON.parse(raw):null}catch{json=null}
    if(!response.ok){const detail=String(json?.message || json?.msg || json?.error_description || json?.error || 'HTTP '+response.status).slice(0,180);throw Error(detail)}
    return json;
  }
  async function accessToken() {
    if(!session)throw Error('Please sign in.');
    if(Number(session.expiresAt)>Date.now()+60000)return session.access_token;
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      if(!session?.refresh_token)throw Error('Session expired. Please sign in again.');
      const result=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
      if(!result?.access_token || !result?.refresh_token)throw Error('Cannot refresh your cloud session. Sign in again.');
      session={access_token:result.access_token,refresh_token:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,user:result.user||session.user};
      persist(SESSION_KEY,session);
      return session.access_token;
    })();
    try{return await refreshing}finally{refreshing=null}
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
    setMessage('Connection saved. Sign in by email to enable automatic backup.','local');
    if(ready())schedule(250);
  }
  async function sendOtp(channel, identifier) {
    if(!config)throw Error('Sign-in is not configured yet. The app owner must connect Supabase first.');
    if(!['email','phone'].includes(channel))throw Error('Choose email or mobile number.');
    const target=String(identifier||'').trim();
    if(channel==='email'&&!validEmail(target))throw Error('Enter a valid email address.');
    if(channel==='phone'&&!/^\\+[1-9]\\d{7,14}$/.test(target))throw Error('Enter your mobile number with country code, such as +919876543210.');
    await request('/auth/v1/otp',{method:'POST',body:channel==='email'?{email:target,create_user:true}:{phone:target,create_user:true}});
    otpChannel=channel;otpTarget=target;
    setMessage(channel==='email'?'Check your email for the sign-in code.':'Check your mobile for the SMS code.','local');
    return true;
  }
  async function verifyOtp(channel, identifier, code) {
    const target=String(identifier||'').trim(),token=String(code||'').trim();
    if(!['email','phone'].includes(channel))throw Error('Select a sign-in method.');
    if(!/^\\d{6,8}$/.test(token))throw Error('Enter the 6 to 8 digit verification code.');
    const result=await request('/auth/v1/verify',{method:'POST',body:channel==='email'?{email:target,token,type:'email'}:{phone:target,token,type:'sms'}});
    if(!result?.access_token||!result?.refresh_token||!result?.user?.id)throw Error('Could not complete sign-in.');
    session={access_token:result.access_token,refresh_token:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,user:result.user};
    if(!persist(SESSION_KEY,session)) {session=null;throw Error('Unable to save sign-in to this browser.')}
    otpEmail='';otpTarget='';otpChannel='';authGeneration++;list=[];savedSeq=-1;
    setMessage('Account connected. Local changes will back up automatically while online.','saved');
    window.dispatchEvent(new Event('billnest-auth-changed'));
    return true;
  }
  function signOut() {
    session=null;persist(SESSION_KEY,null);authGeneration++;list=[];pending=false;clearTimeout(timer);
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
    isConnected:ready,
    getStatus:statusLabel,
    hasAuthConfig:()=>Boolean(config?.url&&config?.key),
    currentAccount:accountInfo,
    workspaceKey,
    sendOtp,
    verifyOtp,
    signOut
  };
})();
