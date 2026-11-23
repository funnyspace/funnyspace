import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'cloud-backup.js'),'utf8');

function connectAuth(fetch){
 const storage=new Map();
 const localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
 };
 const globalThis={BILLNEST_AUTH_CONFIG:{
  url:'https://test-project.supabase.co',
  key:'sb_publishable_test_public'
 }};
 runInNewContext(source,{
  globalThis,localStorage,
  sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  navigator:{onLine:true},
  crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
  window:{addEventListener(){},dispatchEvent(){}},
  document:{addEventListener(){},querySelector(){return null},getElementById(){return null}},
  URL,URLSearchParams,fetch,Event:class{constructor(type){this.type=type}},
  setTimeout,clearTimeout,console
 },{filename:'cloud-backup.js'});
 return globalThis.BillNestCloud;
}

const reply=(status,data)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(data)});

test('disabled phone provider gives actionable delivery error rather than claiming SMS sent',async()=>{
 const calls=[];
 const cloud=connectAuth(async(url,args)=>{
  calls.push({url,args});
  return reply(400,{error_code:'phone_provider_disabled',msg:'Unsupported phone provider'});
 });
 await assert.rejects(cloud.sendOtp('phone','9876543210','signup'),err=>
  err.status===400&&err.code==='phone_provider_disabled'&&
  /Phone provider or SMS service is disabled/.test(err.message)&&
  /use Email ID instead/.test(err.message));
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/\/auth\/v1\/otp$/);
 assert.equal(JSON.parse(calls[0].args.body).phone,'+919876543210');
 assert.equal(JSON.parse(calls[0].args.body).create_user,true);
});

test('disabled OTP signups provide owner configuration instructions',async()=>{
 const cloud=connectAuth(async()=>reply(422,{error_code:'otp_disabled',msg:'Signups not allowed for otp'}));
 await assert.rejects(cloud.sendOtp('email','person@example.com','signup'),/owner must enable new user registration/);
});

test('default email sender authorization error explicitly calls for custom SMTP',async()=>{
 const cloud=connectAuth(async()=>reply(422,{error_code:'email_address_not_authorized',msg:'Email address not authorized'}));
 await assert.rejects(cloud.sendOtp('email','person@example.com','signup'),/configure custom SMTP/);
});

test('successful email OTP registration posts create_user=true and preserves original input',async()=>{
 const calls=[];
 const cloud=connectAuth(async(url,args)=>{
  calls.push({url,args});
  return reply(200,{});
 });
 const result=await cloud.sendOtp('email','  HELLO@example.com  ','signup');
 assert.equal(result.contact,'hello@example.com');
 assert.equal(result.channel,'email');
 assert.equal(JSON.parse(calls[0].args.body).create_user,true);
 assert.equal(JSON.parse(calls[0].args.body).email,'hello@example.com');
});
