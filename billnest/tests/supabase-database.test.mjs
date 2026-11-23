import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=name=>readFileSync(resolve(root,name),'utf8');

test('shop database panel reads only the selected authenticated tenant',async()=>{
 const calls=[],cache=new Map(),events={};
 const shopId='bbaabbaa-aaaa-4aaa-8aaa-bbaabbaabbaa';
 const accountId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const cloud={
  hasAuthConfig:()=>true,
  currentAccount:()=>({id:accountId,email:'shop@example.com'}),
  databaseRequest:async(path)=>{
   calls.push(path);
   if(path.includes('/bn_shops?'))return [{id:shopId,name:'Shop <script>unsafe</script>',state:'Bihar'}];
   if(path.includes('/bn_shop_members?'))return [{shop_id:shopId,role:'owner'}];
   if(path.includes('/bn_products?'))return [{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sku:'A1',name:'<img src=x>',price_paise:12900,stock_qty:1}];
   throw Error('Unknown test path');
  }
 };
 const shared={BillNestCloud:cloud};
 vm.runInNewContext(source('shop-database.js'),{
  globalThis:shared,
  document:{getElementById:()=>null,addEventListener:(name,fn)=>{events[name]=fn}},
  window:{addEventListener:()=>{}},
  localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)},
  FormData:class{},
  encodeURIComponent
 });
 assert.ok(shared.BillNestDatabase.settingsMarkup().includes('Supabase shop database'));
 await shared.BillNestDatabase.refresh();
 const html=shared.BillNestDatabase.settingsMarkup();
 assert.match(html,/Shop &lt;script&gt;unsafe&lt;\/script&gt;/);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.match(html,/₹129.00/);
 assert.equal(shared.BillNestDatabase.readOnlyStatus().products,1);
 assert.ok(calls.some(path=>path.includes('shop_id=eq.'+shopId)));
 assert.ok(calls.every(path=>path.startsWith('/rest/v1/bn_')));
 assert.equal(cache.size,0,'fetch must not mutate existing local workspace');
});

test('database API rejects unauthorized endpoints and unconfigured login',async()=>{
 const storage=new Map(),shared={BILLNEST_AUTH_CONFIG:{url:'',key:''}};
 const events={};
 const memory={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 vm.runInNewContext(source('cloud-backup.js'),{
  globalThis:shared,localStorage:memory,sessionStorage:memory,
  crypto:{randomUUID:()=>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
  navigator:{onLine:true},
  window:{addEventListener:(event,fn)=>{events[event]=fn},dispatchEvent:()=>{}},
  document:{addEventListener:()=>{},querySelector:()=>null},
  URL,URLSearchParams,console,setTimeout,clearTimeout,
  Event:class{constructor(type){this.type=type}}
 });
 await assert.rejects(shared.BillNestCloud.databaseRequest('/rest/v1/billnest_cloud_backups'),/Invalid database endpoint/);
 await assert.rejects(shared.BillNestCloud.databaseRequest('/rest/v1/bn_products'),/Sign in/);
});

test('server-side database migrations require tenant RLS and explicit RPC grants',()=>{
 const a=source('supabase/migrations/202611230001_bn_tenants.sql');
 const b=source('supabase/migrations/202611230002_bn_atomic_sales.sql');
 const c=source('supabase/migrations/202611230003_bn_staff_roles.sql');
 for(const table of ['bn_shops','bn_shop_members','bn_products','bn_customers','bn_invoices',
  'bn_invoice_items','bn_stock_movements','bn_payments','bn_accounting_entries']){
   assert.ok(a.includes('create table public.'+table+' '),table+' table required');
  }
 assert.match(a,/enable row level security/);
 assert.match(a,/grant select on table/);
 assert.match(a,/private\.bn_member_role/);
 assert.match(b,/for update/);
 assert.match(b,/idempotency_key/);
 assert.match(b,/Insufficient stock/);
 assert.match(c,/email_confirmed_at is not null/);
 for(const sql of [a,b,c]){
  assert.doesNotMatch(sql,/bn_member_role\(p_shop_id\)\) not in/,'NULL roles must be explicitly denied');
 }
 assert.match(a,/coalesce\(\(select private\.bn_member_role\(p_shop_id\)\),''\) not in/);
 assert.match(c,/is distinct from 'owner'/);
 assert.ok(source('supabase/tests/tenant_rls.sql').includes('Bob cannot see Alice product'));
});

test('cloud UI and auth assets are loaded before bundled app',()=>{
 const html=source('index.html');
 const sw=source('sw.js');
 assert.ok(html.indexOf('cloud-backup.js?v=33')<html.indexOf('shop-database.js?v=1'));
 assert.ok(html.indexOf('shop-database.js?v=1')<html.indexOf('app.bundle.js?v=33'));
 assert.match(sw,/billnest-shell-v33/);
 assert.match(sw,/shop-database\.js\?v=1/);
 assert.match(source('app.bundle.js'),/BillNestDatabase\?\.settingsMarkup/);
 assert.match(source('app.bundle.js'),/Print \/ Save as PDF/);
});
