import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInvoice,csvEncode,toPaise,today,escapeHtml} from '../logic.mjs';
const p={p1:{id:'p1',name:'Pen',sku:'PEN',price:100,stock:5,gst:18,unit:'pcs'}};
const cart=[{productId:'p1',qty:2}];
test('exclusive same-state GST totals and stock-independent calculation',()=>{
 const r=calculateInvoice(cart,p,10,{taxMode:'exclusive',state:'Bihar'},{state:'Bihar'});
 assert.deepEqual([r.list,r.discount,r.taxable,r.tax,r.total],[20000,2000,18000,3240,21240]);
 assert.equal(r.cgst,1620);assert.equal(r.sgst,1620);assert.equal(r.igst,0);
});
test('interstate tax is IGST',()=>{const r=calculateInvoice(cart,p,0,{state:'Bihar'},{state:'Assam'});assert.equal(r.igst,3600);assert.equal(r.taxType,'inter')});
test('inclusive GST extracts tax without adding it twice',()=>{const r=calculateInvoice([{productId:'p1',qty:1}],p,0,{taxMode:'inclusive'},{});assert.equal(r.total,10000);assert.equal(r.taxable,8475);assert.equal(r.tax,1525)});
test('never allows overselling stock',()=>assert.throws(()=>calculateInvoice([{productId:'p1',qty:6}],p),/Only 5/));
test('rejects negative or fractional qty',()=>{assert.throws(()=>calculateInvoice([{productId:'p1',qty:0}],p));assert.throws(()=>calculateInvoice([{productId:'p1',qty:1.5}],p));});
test('escaping and CSV injection prevention',()=>{assert.equal(escapeHtml('<b>'), '&lt;b&gt;');assert.match(csvEncode([['=IMPORTXML(1)','abc"def']]),/^"'=IMPORTXML/)});
test('paise conversion',()=>assert.equal(toPaise(1.235),124));
test('local today format',()=>assert.match(today(new Date(2026,10,18)),/^2026-11-18$/));
