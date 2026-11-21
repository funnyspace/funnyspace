import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidUpiId,buildUpiIntent} from '../upi.mjs';
test('UPI QR contains payee VPA, exact rupees, currency and invoice reference',()=>{
 const url=buildUpiIntent({upiId:'shop@okbank',payeeName:'Test Retail Shop',amountPaise:12345,reference:'invoice-abc-001',invoiceNumber:'INV-0001'});
 assert.ok(url.startsWith('upi://pay?'));
 const p=new URLSearchParams(url.split('?')[1]);
 assert.deepEqual([p.get('pa'),p.get('pn'),p.get('am'),p.get('cu'),p.get('tr')],['shop@okbank','Test Retail Shop','123.45','INR','invoiceabc001']);
 assert.match(p.get('tn'),/INV-0001/);
});
test('UPI ID verification and amount restrictions prevent fake payment QRs',()=>{
 assert.equal(isValidUpiId(''),false);
 assert.equal(isValidUpiId('invalidupi'),false);
 assert.equal(isValidUpiId('abc@upi'),true);
 assert.equal(isValidUpiId(' a.b-c@okhdfcbank '),true);
 for(const upiId of ['', 'merchant', 'bad@'])assert.throws(()=>buildUpiIntent({upiId,payeeName:'X',amountPaise:100,reference:'1'}));
 for(const amountPaise of [0,-1,1.5,Infinity,NaN])assert.throws(()=>buildUpiIntent({upiId:'shop@upi',payeeName:'X',amountPaise,reference:'1'}));
});
test('Indian rupee amounts preserve paise without rounding errors',()=>{
 const parts=new URLSearchParams(buildUpiIntent({upiId:'me@upi',amountPaise:10001,reference:'a'}).split('?')[1]);
 assert.equal(parts.get('am'),'100.01');
});
