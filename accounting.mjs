/** Bookkeeping reports in integer paise. Cashbook is not a statutory double-entry ledger. */
import {summarizeProfit} from './logic.mjs';

export const ACCOUNT_TYPES = Object.freeze({
  expense:'Operating expense', 'other-income':'Other income', 'inventory-purchase':'Inventory purchase',
  'owner-contribution':'Owner contribution', 'owner-drawing':'Owner drawing', transfer:'Transfer', 'customer-receipt':'Invoice receipt'
});
export const ACCOUNT_NAMES = Object.freeze({cash:'Cash',bank:'Bank / UPI / Card'});
const allowed = Object.keys(ACCOUNT_TYPES);
const asInt = n => Number.isSafeInteger(n) ? n : 0;
export function invoiceOutstanding(invoice, entries=[]) {
  const total=Math.max(0,asInt(invoice?.total));
  const receipts=entries.filter(e=>e.type==='customer-receipt'&&e.invoiceId===invoice?.id);
  const received=receipts.length ? receipts.reduce((s,e)=>s+Math.max(0,asInt(e.amount)),0) : (invoice?.paid ? total : 0);
  return Math.max(0,total-received);
}
export function makeAccountingSummary(invoices=[], products=[], accounting={}, from='0001-01-01') {
  const list=Array.isArray(accounting?.entries)?accounting.entries:[];
  const cashbook=[];
  const opening={cash:asInt(accounting?.opening?.cash),bank:asInt(accounting?.opening?.bank)};
  const running={...opening};
  const due=[];
  const customers=new Map();
  const receiptsByInvoice=new Map();
  for(const e of list)if(e.type==='customer-receipt')receiptsByInvoice.set(e.invoiceId,(receiptsByInvoice.get(e.invoiceId)||0)+1);
  for(const inv of invoices){
    if(!inv||!Number.isSafeInteger(inv.total))continue;
    const outstanding=invoiceOutstanding(inv,list);
    if(outstanding>0){
      due.push({...inv,outstanding});
      const key=String(inv.customer?.id||inv.customer?.name||'walk-in');
      const c=customers.get(key)||{id:key,name:String(inv.customer?.name||'Walk-in customer'),outstanding:0,invoices:0};
      c.outstanding+=outstanding;c.invoices++;customers.set(key,c);
    }
    if(inv.paid&&!receiptsByInvoice.get(inv.id)){
      // Old and pay-at-checkout invoices were settled when created. No manual duplicate entry.
      const account=inv.payment==='Cash'?'cash':'bank';
      cashbook.push({id:`sale-${inv.id}`,date:inv.date,createdAt:inv.createdAt||'',account,
        type:'invoice-sale',label:`Invoice ${String(inv.number||'')} paid`,inflow:inv.total,outflow:0,cash:account==='cash'?inv.total:0,bank:account==='bank'?inv.total:0,auto:true});
    }
  }
  let operatingExpenses=0,otherIncome=0,inventoryPurchases=0;
  const byCategory=new Map();
  for(const e of list){
    if(!e||!allowed.includes(e.type)||!['cash','bank'].includes(e.account)||!Number.isSafeInteger(e.amount)||e.amount<=0)continue;
    const amount=e.amount;
    if(e.date>=from){
      if(e.type==='expense'){
        operatingExpenses+=amount;
        const category=String(e.category||'Other expense');byCategory.set(category,(byCategory.get(category)||0)+amount);
      }
      if(e.type==='other-income')otherIncome+=amount;
      if(e.type==='inventory-purchase')inventoryPurchases+=amount;
    }
    const income=['other-income','owner-contribution','customer-receipt'].includes(e.type);
    const transfer=e.type==='transfer';
    const cash=transfer?(e.account==='cash'?-amount:amount):(e.account==='cash'?(income?amount:-amount):0);
    const bank=transfer?(e.account==='bank'?-amount:amount):(e.account==='bank'?(income?amount:-amount):0);
    if(transfer && (e.toAccount===e.account||!['cash','bank'].includes(e.toAccount)))continue;
    cashbook.push({id:e.id,date:e.date,createdAt:e.createdAt||'',account:e.account,type:e.type,
      label:String(e.description||ACCOUNT_TYPES[e.type]),inflow:income?amount:0,outflow:income?0:amount,
      cash,bank,auto:false,invoiceId:e.invoiceId||'',category:e.category||''});
  }
  for(const row of cashbook){running.cash+=row.cash;running.bank+=row.bank}
  const gross=summarizeProfit(invoices,products,from);
  cashbook.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))||b.id.localeCompare(a.id));
  due.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const debtors=Array.from(customers.values()).sort((a,b)=>b.outstanding-a.outstanding);
  return {
    balances:running,opening, cashbook, outstanding:due.reduce((s,i)=>s+i.outstanding,0),unpaidInvoices:due,
    debtors, otherIncome, operatingExpenses, inventoryPurchases,
    expenseCategories:Array.from(byCategory.entries()).sort((a,b)=>b[1]-a[1]),
    gross, netProfit:gross.profit+otherIncome-operatingExpenses,
    /* Invoices with unknown costs make net profit incomplete. */
    incomplete: gross.missingCostLines>0, estimated:gross.estimatedLines>0
  };
}
