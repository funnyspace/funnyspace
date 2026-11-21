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

import {summarizeProfit} from '../logic.mjs';
const costed={id:'costed',sku:'COST',name:'Costed Product',price:100,cost:70,gst:18,stock:10,unit:'pcs'};
test('profit snapshots purchase cost and excludes GST after invoice discount',()=>{
 const inv=calculateInvoice([{productId:costed.id,qty:2}],{[costed.id]:costed},10,{taxMode:'exclusive'},{});
 assert.equal(inv.lines[0].unitCost,7000);
 assert.equal(inv.lines[0].costTotal,14000);
 assert.equal(inv.lines[0].taxable,18000);
 const stat=summarizeProfit([{date:'2026-11-21',...inv}],[costed]);
 assert.equal(stat.sales,18000);
 assert.equal(stat.cost,14000);
 assert.equal(stat.profit,4000);
 assert.equal(stat.margin,4000/18000*100);
 assert.equal(stat.estimatedLines,0);
});
test('GST-inclusive prices yield profit from pre-GST taxable sales',()=>{
 const product={...costed,price:118,cost:90,stock:5};
 const inv=calculateInvoice([{productId:costed.id,qty:1}],{[costed.id]:product},0,{taxMode:'inclusive'},{});
 const stat=summarizeProfit([{date:'2026-11-21',...inv}],[product]);
 assert.equal(stat.sales,10000);
 assert.equal(stat.cost,9000);
 assert.equal(stat.profit,1000);
});
test('gross loss is negative when purchase cost exceeds net sale',()=>{
 const product={...costed,cost:150};
 const inv=calculateInvoice([{productId:costed.id,qty:1}],{[costed.id]:product});
 const stat=summarizeProfit([{date:'2026-11-21',...inv}],[product]);
 assert.equal(stat.profit,-5000);
 assert.equal(stat.productRows[0].profit,-5000);
});
test('historical cost snapshots ignore later edited purchase costs',()=>{
 const inv=calculateInvoice([{productId:costed.id,qty:1}],{[costed.id]:costed});
 const invoice={date:'2026-11-21',...inv};
 assert.equal(summarizeProfit([invoice],[{...costed,cost:200}]).profit,3000);
});
test('older invoices use current cost as estimates but missing deleted items remain partial',()=>{
 const old={date:'2026-11-21',lines:[{productId:'costed',sku:'COST',name:'Costed Product',qty:1,taxable:10000},{productId:'removed',sku:'REM',name:'Removed Product',qty:1,taxable:10000}]};
 const stat=summarizeProfit([old],[costed]);
 assert.equal(stat.sales,20000);
 assert.equal(stat.recognizedSales,10000);
 assert.equal(stat.cost,7000);
 assert.equal(stat.profit,3000);
 assert.equal(stat.estimatedLines,1);
 assert.equal(stat.missingCostLines,1);
 assert.equal(stat.productRows.find(p=>p.productId==='removed').missingCostLines,1);
});
test('profit date filters and zero-sales products',()=>{
 const inv1=calculateInvoice([{productId:'costed',qty:1}],{costed});
 const old={date:'2026-10-01',...inv1};
 const fresh={date:'2026-11-21',...inv1};
 const untouched={id:'untouched',sku:'NEW',name:'New Product',price:200,cost:100,stock:12};
 const stat=summarizeProfit([old,fresh],[costed,untouched],'2026-11-01');
 assert.equal(stat.sales,10000);
 assert.equal(stat.profit,3000);
 assert.equal(stat.productRows.find(p=>p.productId==='untouched').qty,0);
});
