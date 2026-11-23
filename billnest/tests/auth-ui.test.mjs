import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const authSource=readFileSync(resolve(root,'auth-ui.js'),'utf8');
const html=()=>readFileSync(resolve(root,'index.html'),'utf8');
const css=()=>readFileSync(resolve(root,'auth-ui.css'),'utf8');
const sw=()=>readFileSync(resolve(root,'sw.js'),'utf8');

function mount(){
 const listeners=new Map();
 let count=0;
 const sentCodes=[];
 const verifiedCodes=[];
 const elements={};
 const layer={
  hidden:true,innerHTML:'',
  addEventListener(event,handler){listeners.set('layer:'+event,handler)},
  querySelector(selector){
   if(selector==='.billnest-auth-message')return null;
   if(selector==='.billnest-auth-content')return {append(){}};
   return {focus(){},disabled:false};
  },
  querySelectorAll(){return []}
 };
 const button={
  innerHTML:'',type:'',
  addEventListener(event,handler){listeners.set('button:'+event,handler)},
  setAttribute(){}
 };
 const cloud={
  currentAccount:()=>null,
  hasAuthConfig:()=>true,
  workspaceKey:()=> 'billnest-test',
  getGoogleError:()=>null,
  async sendOtp(channel,contact,mode){
   sentCodes.push({channel,contact,mode});
   return {channel,contact:channel==='phone'?'+919876543210':contact,mode};
  },
  async verifyOtp(channel,contact,otp){
   verifiedCodes.push({channel,contact,otp});
   return true;
  }
 };
 const doc={
  querySelector(selector){return selector==='.top-actions'?{prepend(){}}:null},
  createElement(){
   count++;
   if(count<=2)return count===1?layer:button;
   return {className:'',setAttribute(){},textContent:''};
  },
  body:{append(){},classList:{add(){},remove(){}}},
  addEventListener(event,handler){listeners.set('document:'+event,handler)},
  activeElement:{focus(){}}
 };
 const storage={getItem(){return null}};
 const context={
  globalThis:{BillNestCloud:cloud},
  document:doc,
  window:{addEventListener(){},dispatchEvent(){}},
  localStorage:storage,
  location:{hash:''},
  setTimeout(){return 1},
  clearTimeout(){},
  confirm(){return true},
  FormData:class{constructor(form){this.form=form}get(field){return this.form.values[field]}}
 };
 runInNewContext(authSource,context,{filename:'auth-ui.js'});
 function click(selector,dataset={}){
  const target={closest(query){if(query!=='button')return null;return {matches:check=>check===selector,dataset,disabled:false}}};
  listeners.get('layer:click')({target});
 }
 async function submit(id,values){
  const form={id,values,querySelector(){return {disabled:false}}};
  await listeners.get('layer:submit')({target:form,preventDefault(){}});
 }
 return {layer,cloud,click,submit,sentCodes,verifiedCodes,open:()=>listeners.get('button:click')()};
}

test('sign-in modal follows the approved mobile design',()=>{
 const app=mount();app.open();
 const markup=app.layer.innerHTML;
 assert.match(markup,/id="billnestAuthTitle">Sign in/);
 assert.match(markup,/billnest-auth-subtitle">Email ID or mobile number/);
 assert.match(markup,/data-auth-tab="email"/);
 assert.match(markup,/data-auth-tab="phone" aria-selected="true"/);
 assert.match(markup,/for="billnestAuthContact">Mobile number/);
 assert.match(markup,/type="tel" inputmode="tel" autocomplete="tel"/);
 assert.match(markup,/Send login code/);
 assert.doesNotMatch(markup,/Continue with Google|billnest-auth-google|billnest-auth-or/);
 assert.doesNotMatch(markup,/placeholder="9876543210|\+919876543210|India \+91 by default/);
 assert.doesNotMatch(markup,/billnest-auth-mode/);
 assert.ok(markup.indexOf('class="billnest-auth-switch"')>markup.indexOf('class="billnest-auth-content"'));
 assert.match(markup,/data-auth-mode="signup">Create account/);
});

test('switching to signup and email keeps a centered footer switch',()=>{
 const app=mount();app.open();
 app.click('[data-auth-mode]',{authMode:'signup'});
 assert.match(app.layer.innerHTML,/id="billnestAuthTitle">Create account/);
 assert.match(app.layer.innerHTML,/Send registration code/);
 assert.match(app.layer.innerHTML,/data-auth-mode="signin">Already have an account\? Sign in/);
 app.click('[data-auth-tab]',{authTab:'email'});
 assert.match(app.layer.innerHTML,/for="billnestAuthContact">Email ID/);
 assert.match(app.layer.innerHTML,/type="email" inputmode="email" autocomplete="email"/);
 assert.doesNotMatch(app.layer.innerHTML,/Mobile number \(India/);
 app.click('[data-auth-mode]',{authMode:'signin'});
 assert.match(app.layer.innerHTML,/id="billnestAuthTitle">Sign in/);
 assert.match(app.layer.innerHTML,/data-auth-mode="signup">Create account/);
});

test('OTP request and verification continue to work without Google UI',async()=>{
 const app=mount();app.open();
 await app.submit('billnestAuthSend',{contact:'9876543210'});
 assert.deepEqual(app.sentCodes,[{channel:'phone',contact:'9876543210',mode:'signin'}]);
 assert.match(app.layer.innerHTML,/id="billnestAuthVerify"/);
 assert.match(app.layer.innerHTML,/Verify and sign in/);
 await app.submit('billnestAuthVerify',{otp:'123456'});
 assert.deepEqual(app.verifiedCodes,[{channel:'phone',contact:'+919876543210',otp:'123456'}]);
 assert.equal(app.layer.hidden,true);
});

test('new sign-in assets are versioned consistently for PWA installs',()=>{
 assert.match(html(),/auth-ui\.css\?v=4/);
 assert.match(html(),/auth-ui\.js\?v=4/);
 assert.match(sw(),/billnest-shell-v36/);
 assert.match(sw(),/auth-ui\.css\?v=4/);
 assert.match(sw(),/auth-ui\.js\?v=4/);
 assert.match(css(),/\.billnest-auth-switch\{margin-top:auto/);
 assert.doesNotMatch(css(),/\.billnest-auth-google/);
});
