/** Pure billing calculations. All monetary values returned are integer paise. */
export const toPaise = value => Math.round((Number(value) || 0) * 100);
export const rupees = paise => (Number(paise || 0) / 100);
export const money = paise => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(rupees(paise));
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    lines.push({productId:product.id,sku:product.sku,name:product.name,unit:product.unit || 'pcs',qty,unitPrice:unit,gst:rate,original,discount:original-discounted,taxable,tax,total});
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
