/** Offline UPI payment intent builder. Amounts are integer paise; this is NOT a payment status verifier. */
export function isValidUpiId(value) {
 const id=String(value??'').trim();
 return id.length<=100 && /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id);
}
export function buildUpiIntent({upiId,payeeName,amountPaise,reference,invoiceNumber}) {
 const pa=String(upiId??'').trim();
 if(!isValidUpiId(pa))throw Error('Enter a valid receiving UPI ID in Store Settings.');
 if(!Number.isSafeInteger(amountPaise)||amountPaise<=0)throw Error('UPI amount must be a positive number of paise.');
 const pn=String(payeeName||'My Store').trim().slice(0,80)||'My Store';
 const ref=String(reference||'').replace(/[^A-Za-z0-9]/g,'').slice(0,30);
 const note=('BillNest invoice '+String(invoiceNumber||'').trim()).slice(0,80);
 const params=new URLSearchParams({pa,pn,am:(amountPaise/100).toFixed(2),cu:'INR',tn:note});
 if(ref)params.set('tr',ref);
 return 'upi://pay?'+params.toString();
}
