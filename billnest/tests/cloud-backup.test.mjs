import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./cloud-backup.js',import.meta.url),'utf8');

function setup(){
 const items=new Map();
 const listeners={};
 const reports=[];
 const remote=[];
 const navigator={onLine:true};
 const ctx={
  URL,URLSearchParams,Date,Math,JSON,RegExp,Number,String,Boolean,
  navigator,crypto:{randomUUID:()=> 'c0c4ca42-2f61-40ab-a09c-65533a83da0b'},
  localStorage:{getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)},
  document:{addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn),getElementById:()=>null,querySelector:()=>null},
  window:{addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},
  FormData:class {constructor(form){this.vals=form.vals};get(key){return this.vals[key]??null}},
  confirm:()=>true,
  console,
  setTimeout,clearTimeout,
  fetch:async(url,req)=>{
   reports.push({url,req});
   const path=String(url);
   let body= req.body ? JSON.parse(req.body) : null;
   let value=null;
   if(path.includes('/auth/v1/otp'))value={};
   else if(path.includes('/auth/v1/verify'))value={access_token:'test_access',refresh_token:'test_refresh',expires_in:3600,user:{id:'user-uuid',email:'test@example.com'}};
   else if(path.includes('/rest/v1/billnest_cloud_backups')&&req.method==='POST'){
    remote.splice(0,remote.length,{...body});
   }else if(path.includes('select=device_id%2Cdevice_name%2Csaved_at%2Csize_bytes'))value=remote.map(r=>({device_id:r.device_id,device_name:r.device_name,saved_at:r.saved_at,size_bytes:r.size_bytes}));
   else if(path.includes('/rest/v1/billnest_cloud_backups')&&path.includes('select=backup'))value=remote.map(r=>({backup:r.backup}));
   else throw Error('Unexpected '+url+' '+req.method);
   return {ok:true,status:200,text:async()=>value===null?'':JSON.stringify(value)};
  },
 };
 ctx.globalThis=ctx;
 vm.createContext(ctx);
 vm.runInContext(source,ctx,{filename:'cloud-backup.js'});
 const emit=(event,obj)=>{for(const fn of listeners[event]||[])fn(obj)};
 const form=(id,vals)=>emit('submit',{target:{id,vals},preventDefault(){}});
 return {ctx,items,reports,remote,navigator,form,emit};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('online cloud backup signs in and auto-uploads after save, offline saves queue',async()=>{
 const x=setup();
 const db={version:1,products:[],invoices:[],customers:[],movements:[],settings:{nextInvoice:1}};
 x.ctx.BillNestCloud.setWorkspaceReader(()=>db);
 assert.match(x.ctx.BillNestCloud.settingsMarkup(),/Local only/);
 x.form('cloudConfigForm',{url:'https://project.supabase.co',key:'sb_publishable_example_public',deviceName:'Shop Phone'});
 await delay(30);
 assert.equal(JSON.parse(x.items.get('billnest-cloud-config-v1')).deviceName,'Shop Phone');
 x.form('cloudOtpForm',{email:'test@example.com'});
 await delay(30);
 x.form('cloudVerifyForm',{token:'123456'});
 await delay(1700);
 assert.equal(x.remote.length,1,'one cloud snapshot per signed-in device');
 assert.equal(x.remote[0].user_id,'user-uuid');
 assert.equal(x.remote[0].backup.settings.nextInvoice,1);
 assert.equal(x.remote[0].device_name,'Shop Phone');
 assert.ok(x.reports.some(r=>r.url.includes('/auth/v1/verify')));
 const oldPosts=x.reports.filter(r=>r.req.method==='POST'&&r.url.includes('/rest/v1/')).length;
 x.navigator.onLine=false;
 db.settings.nextInvoice=2;
 x.ctx.BillNestCloud.onSave();
 await delay(100);
 assert.equal(x.reports.filter(r=>r.req.method==='POST'&&r.url.includes('/rest/v1/')).length,oldPosts,'offline never uploads');
 x.navigator.onLine=true;
 x.emit('online',{});
 await delay(500);
 assert.equal(x.remote[0].backup.settings.nextInvoice,2,'queued backup uploads after reconnect');
 assert.ok(x.reports.some(r=>r.req.headers.Authorization==='Bearer test_access'));
});

test('cloud connection refuses secret keys and never silently restores',async()=>{
 const x=setup();
 const db={version:1,products:[],invoices:[],customers:[],movements:[],settings:{nextInvoice:8}};
 let restoreCalls=0;
 x.ctx.BillNestCloud.setWorkspaceReader(()=>db);
 x.ctx.BillNestCloud.setRestoreHandler(()=>{restoreCalls++;return true});
 x.form('cloudConfigForm',{url:'https://project.supabase.co',key:'sb_secret_unsafe',deviceName:'device'});
 await delay(30);
 assert.equal(x.items.has('billnest-cloud-config-v1'),false);
 assert.equal(restoreCalls,0);
});
