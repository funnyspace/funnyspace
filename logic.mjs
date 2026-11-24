/** Pure billing calculations. All monetary values returned are integer paise. */
export const toPaise = value => Math.round((Number(value) || 0) * 100);
export const rupees = paise => (Number(paise || 0) / 100);
export const money = paise => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(rupees(paise));
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
/** Expiry is a local calendar date, not a timestamp. The alert begins at day 30. */
export function expiryStatus(expiryDate, reference=today()) {
  if (!expiryDate) return {state:'none',days:null};
  const toDay = value => {
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const [y,m,d]=value.split('-').map(Number);
    if(y<1000||y>9999)return null;
    const stamp=Date.UTC(y,m-1,d);
    if(!Number.isFinite(stamp))return null;
    const check=new Date(stamp);
    return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d?stamp:null;
  };
  const date=toDay(expiryDate),now=toDay(reference);
  if(date===null||now===null)return {state:'invalid',days:null};
  const days=Math.round((date-now)/86400000);
  return {state:days<0?'expired':days<=30?'soon':'ok',days};
}

export const safeNum = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
export function calculateInvoice(items, productMap, discountPercent = 0, settings = {}, customer = {}) {
  const discount = Math.min(100,Math.max(0,safeNum(discountPercent)));
  const inclusive = settings.taxMode === 'inclusive';
  const lines = [];
  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) throw new Error('One of the products no longer exists.');
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity for ' + product.name);
    if (qty > product.stock) throw new Error(`Only ${product.stock} ${product.unit || 'units'} available for ${product.name}.`);
    const unit = toPaise(product.price);
    if (unit < 0) throw new Error('Invalid price for ' + product.name);
    const rate = Math.max(0,safeNum(product.gst));
    const original = unit * qty;
    const discounted = Math.round(original * (100 - discount) / 100);
    const taxable = inclusive ? Math.round(discounted * 100 / (100 + rate)) : discounted;
    const tax = inclusive ? discounted - taxable : Math.round(taxable * rate / 100);
    const total = inclusive ? discounted : taxable + tax;
    // Snapshot purchase cost so later price/cost edits do not rewrite past profits.
    const unitCost = toPaise(Math.max(0,safeNum(product.cost)));
    lines.push({productId:product.id,sku:product.sku,name:product.name,unit:product.unit || 'pcs',qty,unitPrice:unit,unitCost,costTotal:unitCost*qty,gst:rate,original,discount:original-discounted,taxable,tax,total});
  }
  const totals = lines.reduce((a,l) => ({list:a.list+l.original,discount:a.discount+l.discount,taxable:a.taxable+l.taxable,tax:a.tax+l.tax,total:a.total+l.total}), {list:0,discount:0,taxable:0,tax:0,total:0});
  const source = (settings.state || '').toLowerCase().trim();
  const destination = (customer.state || settings.state || '').toLowerCase().trim();
  const taxType = source && destination ? (source === destination ? 'intra' : 'inter') : 'unspecified';
  const cgst = taxType === 'intra' ? Math.floor(totals.tax / 2) : 0;
  const sgst = taxType === 'intra' ? totals.tax - cgst : 0;
  const igst = taxType === 'inter' ? totals.tax : 0;
  return {lines, ...totals, cgst, sgst, igst, taxType, inclusive, discountPercent:discount};
}

export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function csvEncode(rows) {
  return rows.map(row => row.map(v => {
    const text = String(v ?? '');
    // Defuse spreadsheet formulas in user-entered text before exporting.
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"','""') + '"';
  }).join(',')).join('\r\n');
}

/** Gross P/L from invoiced sales, excluding GST and operating expenses. Amounts in paise.
 * For invoices created before cost snapshots, use the current product cost only as
 * an estimate. An archived product with no cost is marked incomplete instead of
 * silently treating its cost as zero. Never modify stored invoices while reading.
 */
export function summarizeProfit(invoices,products=[],start='0001-01-01') {
  const catalog = Array.isArray(products)?products:Object.values(products||{});
  const productMap = new Map(catalog.map(p=>[String(p.id),p]));
  const rows = new Map();
  for (const p of catalog) rows.set(String(p.id),{
    productId:String(p.id),name:String(p.name||'Unnamed product'),sku:String(p.sku||''),qty:0,
    sales:0,recognizedSales:0,cost:0,profit:0,estimatedLines:0,missingCostLines:0
  });
  let sales=0,recognizedSales=0,cost=0,estimatedLines=0,missingCostLines=0,units=0;
  for (const inv of invoices||[]) {
    if (!inv || String(inv.date||'')<start || !Array.isArray(inv.lines)) continue;
    for (const line of inv.lines) {
      const qty=Number(line.qty);
      if (!Number.isFinite(qty)||qty<=0)continue;
      const id=String(line.productId||line.sku||line.name||'unknown');
      const product=productMap.get(String(line.productId));
      const row=rows.get(id)||{productId:id,name:String(line.name||'Unknown product'),sku:String(line.sku||''),qty:0,sales:0,recognizedSales:0,cost:0,profit:0,estimatedLines:0,missingCostLines:0};
      if (!rows.has(id))rows.set(id,row);
      const taxable=Number.isFinite(Number(line.taxable))?Math.round(Number(line.taxable)):0;
      row.qty+=qty;row.sales+=taxable;sales+=taxable;units+=qty;
      let lineCost;
      const validCost = v => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
      if (validCost(line.costTotal))lineCost=line.costTotal;
      else if (validCost(line.unitCost))lineCost=Math.round(line.unitCost*qty);
      else if (product && Number.isFinite(Number(product.cost)) && Number(product.cost)>=0) {
        lineCost=toPaise(product.cost)*qty;
        row.estimatedLines++;estimatedLines++;
      } else {
        row.missingCostLines++;missingCostLines++;continue;
      }
      row.recognizedSales+=taxable;row.cost+=lineCost;row.profit+=taxable-lineCost;
      recognizedSales+=taxable;cost+=lineCost;
    }
  }
  const productRows=Array.from(rows.values()).sort((a,b)=>b.sales-a.sales || a.name.localeCompare(b.name));
  return {sales,recognizedSales,cost,profit:recognizedSales-cost,margin:recognizedSales?((recognizedSales-cost)/recognizedSales*100):null,units,estimatedLines,missingCostLines,productRows};
}
