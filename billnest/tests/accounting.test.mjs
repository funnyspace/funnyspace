import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceOutstanding,makeAccountingSummary} from '../accounting.mjs';

const product={id:'a',name:'Notebook',sku:'A',cost:50};
const sale={id:'i1',date:'2026-11-19',createdAt:'2026-11-19T10:00:00Z',number:'INV-1',paid:true,payment:'Cash',total:11800,lines:[{productId:'a',name:'Notebook',qty:2,taxable:10000,costTotal:10000}]};
const credit={...sale,id:'i2',number:'INV-2',paid:false,payment:'Credit',total:5900,lines:[{productId:'a',name:'Notebook',qty:1,taxable:5000,costTotal:5000}]};
const entry=(type,amount,extra={})=>({id:type+amount,date:'2026-11-20',createdAt:'2026-11-20T00:00:00Z',type,amount,account:'bank',...extra});

test('paid invoice is counted once in cash and gross sales, not as other income',()=>{
 const s=makeAccountingSummary([sale],[product],{opening:{cash:500,bank:1000},entries:[]});
 assert.deepEqual(s.balances,{cash:12300,bank:1000});
 assert.equal(s.gross.sales,10000);
 assert.equal(s.netProfit,0);
});
test('unpaid credit invoice adds receivable but not cash',()=>{
 const s=makeAccountingSummary([credit],[product],{opening:{cash:0,bank:0},entries:[]});
 assert.equal(s.balances.cash+s.balances.bank,0);
 assert.equal(s.outstanding,5900);
 assert.equal(s.netProfit,0);
});
test('partial receipts settle outstanding without duplicating revenue',()=>{
 const receipt=entry('customer-receipt',2000,{invoiceId:'i2'});
 const s=makeAccountingSummary([credit],[product],{opening:{cash:0,bank:0},entries:[receipt]});
 assert.equal(invoiceOutstanding(credit,[receipt]),3900);
 assert.equal(s.outstanding,3900);
 assert.equal(s.balances.bank,2000);
 assert.equal(s.gross.sales,5000);
 assert.equal(s.netProfit,0);
});
test('fully settled credit with receipts is not counted twice',()=>{
 const paid={...credit,paid:true};
 const receipts=[entry('customer-receipt',3000,{id:'r1',invoiceId:'i2'}),entry('customer-receipt',2900,{id:'r2',invoiceId:'i2'})];
 const s=makeAccountingSummary([paid],[product],{opening:{cash:0,bank:0},entries:receipts});
 assert.equal(s.balances.bank,5900);
 assert.equal(s.outstanding,0);
 assert.equal(s.cashbook.length,2);
});
test('only expenses and other income change P/L, not inventory purchases or owner capital',()=>{
 const entries=[entry('expense',3500,{category:'Rent'}),entry('other-income',800),entry('inventory-purchase',6000),entry('owner-contribution',15000)];
 const s=makeAccountingSummary([sale],[product],{opening:{cash:0,bank:0},entries});
 assert.equal(s.netProfit,-2700);
 assert.equal(s.operatingExpenses,3500);
 assert.equal(s.inventoryPurchases,6000);
 assert.equal(s.balances.bank,6300);
});
test('transfers move funds without creating revenue or expenses',()=>{
 const s=makeAccountingSummary([],[],{opening:{cash:50000,bank:0},entries:[entry('transfer',12500,{account:'cash',toAccount:'bank'})]});
 assert.deepEqual(s.balances,{cash:37500,bank:12500});
 assert.equal(s.netProfit,0);
});
test('date filter changes period net but not current balances or outstanding',()=>{
 const s=makeAccountingSummary([sale,credit],[product],{opening:{cash:0,bank:0},entries:[entry('expense',3000)]},'2026-11-20');
 assert.equal(s.gross.sales,0);
 assert.equal(s.netProfit,-3000);
 assert.equal(s.outstanding,5900);
 assert.equal(s.balances.cash,11800);
});
test('older paid invoices without receipt records remain settled',()=>{
 assert.equal(invoiceOutstanding(sale,[]),0);
 assert.equal(invoiceOutstanding({...sale,paid:false},[]),11800);
});
