import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser-like DOM to exercise stateful application flow in Node.
const nodes=new Map();
function node(selector){
 if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){return false},contains(){return false}},addEventListener(){},focus(){},scrollTo(){}});
 return nodes.get(selector);
}
const listeners={};
globalThis.document={querySelector:sel=>node(sel),addEventListener:(name,fn)=>listeners[name]=fn};
globalThis.window={scrollTo(){},addEventListener(){},print(){}};
globalThis.confirm=()=>true;
const items=new Map();
globalThis.localStorage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};
await import('../app.js');
function clickAction(action,id){listeners.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action,id},preventDefault(){}}:null},preventDefault(){}})}
function clickGo(page){listeners.click({target:{closest:selector=>selector==='[data-go]'?{dataset:{go:page}}:null},preventDefault(){}})}
test('dashboard renders sample stock and sales',()=>{assert.match(node('#main').innerHTML,/exploring a demo workspace/);assert.match(node('#main').innerHTML,/Recent invoices/)});
test('inventory screen lists stock entries',()=>{clickGo('inventory');assert.match(node('#main').innerHTML,/A4 Notebook/);assert.match(node('#main').innerHTML,/Marker Set/)});
test('billing generates invoice and subtracts stock',()=>{
 clickGo('billing');const savedBefore=items.get('billnest-workspace-v1');assert.equal(savedBefore,undefined);
 const app=nodes.get('#main').innerHTML; const id=app.match(/data-action="add-to-cart" data-id="([a-z0-9-]+)"/)[1];
 clickAction('add-to-cart',id);assert.match(node('#main').innerHTML,/1 items/);
 clickAction('save-invoice');const db=JSON.parse(items.get('billnest-workspace-v1'));assert.equal(db.invoices.length,6);
 assert.equal(db.invoices.at(-1).lines[0].productId,id);
 assert.equal(db.invoices.at(-1).number,'INV-0006');assert.equal(db.products.find(p=>p.id===id).stock,70);
 assert.match(node('#modalLayer').innerHTML,/INVOICE/);
});
test('can clear demo to an empty workspace',()=>{clickAction('reset-data');const db=JSON.parse(items.get('billnest-workspace-v1'));assert.equal(db.invoices.length,0);assert.equal(db.products.length,0);assert.equal(db.demo,false);assert.match(node('#main').innerHTML,/No invoices yet/)});
