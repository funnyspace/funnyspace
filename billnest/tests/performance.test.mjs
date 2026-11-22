import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

// The static project bundles app.js into app.bundle.js at build time.
// Extract the real paging helper so this exercise is not a separate
// reimplementation of the paging algorithm.
const dir=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(dir,'../app.js'),'utf8');
const bundle=readFileSync(resolve(dir,'../app.bundle.js'),'utf8');
const start=source.indexOf('const PAGE_SIZE=40;');
const end=source.indexOf('const productsMap =',start);
assert.ok(start>=0&&end>start,'paging helper should be present in app.js');
const helper=source.slice(start,end);

test('large lists only materialize 40 visible rows',()=>{
 const ui={pages:{}};
 const paginate=new Function('ui',helper+'return pagedRows;')(ui);
 const all=Array.from({length:100_000},(_,id)=>({id}));
 let result=paginate('sales',all);
 assert.equal(result.total,100_000);
 assert.equal(result.visible.length,40);
 assert.equal(result.visible[0].id,0);
 assert.match(result.controls,/Page 1 \/ 2500/);
 ui.pages.sales=2499;
 result=paginate('sales',all);
 assert.equal(result.visible.length,40);
 assert.equal(result.visible[0].id,99_960);
 assert.equal(result.visible.at(-1).id,99_999);
 assert.equal(all.length,100_000,'pagination must not alter stored records');
});

test('paging clamps invalid pages and hides controls for small lists',()=>{
 const ui={pages:{inventory:999_999}};
 const paginate=new Function('ui',helper+'return pagedRows;')(ui);
 const result=paginate('inventory',Array.from({length:62},(_,id)=>id));
 assert.equal(result.page,1);
 assert.deepEqual(result.visible,Array.from({length:22},(_,id)=>id+40));
 assert.equal(paginate('customers',[1,2,3]).controls,'');
});

test('source and browser bundle both retain standard invoice printing',()=>{
 assert.match(source,/data-action="print-invoice"/);
 assert.match(bundle,/data-action="print-invoice"/);
 assert.doesNotMatch(bundle,/data-action="print-bluetooth"/);
 for(const id of ['inventory','billing','sales','customers','profit','cashbook','receivables']){
  assert.ok(source.includes("pagedRows('"+id+"'"),id+' must be paginated');
 }
});
