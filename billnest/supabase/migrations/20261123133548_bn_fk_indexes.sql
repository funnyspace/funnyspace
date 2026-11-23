-- Index the eight foreign keys identified by Supabase's database performance advisor.
create index if not exists bn_shops_created_by_idx on public.bn_shops(created_by);
create index if not exists bn_invoices_issued_by_idx on public.bn_invoices(issued_by);
create index if not exists bn_invoices_customer_fk_idx on public.bn_invoices(shop_id,customer_id);
create index if not exists bn_invoice_items_product_fk_idx on public.bn_invoice_items(shop_id,product_id);
create index if not exists bn_stock_movements_invoice_fk_idx on public.bn_stock_movements(shop_id,invoice_id);
create index if not exists bn_stock_movements_created_by_idx on public.bn_stock_movements(created_by);
create index if not exists bn_payments_received_by_idx on public.bn_payments(received_by);
create index if not exists bn_accounting_entries_created_by_idx on public.bn_accounting_entries(created_by);
