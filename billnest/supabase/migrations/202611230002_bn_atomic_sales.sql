-- BillNest phase 2: trusted, atomic invoice and receipt operations.
-- All mutations execute in one PostgreSQL transaction per RPC invocation.
-- Do not connect existing local checkout to this until monetary reconciliation tests pass.

create function public.bn_issue_invoice(
 p_shop_id uuid,
 p_idempotency_key uuid,
 p_items jsonb,
 p_payment_method text,
 p_customer_id uuid default null,
 p_discount_percent numeric default 0
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=auth.uid();
 shop_row public.bn_shops%rowtype;
 customer_row public.bn_customers%rowtype;
 prod public.bn_products%rowtype;
 item jsonb;
 line_qty int;
 pid uuid;
 invoice_id uuid;
 invoice_number text;
 fingerprint text;
 existing record;
 line_gross bigint; line_discount bigint; line_net bigint;
 line_taxable bigint; line_tax bigint; line_total bigint;
 sum_gross bigint:=0; sum_discount bigint:=0; sum_taxable bigint:=0;
 sum_tax bigint:=0; sum_total bigint:=0;
 tax_type text:='intra';
begin
 if actor is null or coalesce((select private.bn_member_role(p_shop_id)),'') not in ('owner','manager','cashier')
 then raise exception 'Not permitted to create invoices' using errcode='42501'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key is required'; end if;
 if p_payment_method not in ('Cash','UPI','Card','Bank transfer','Credit') or p_payment_method is null
 then raise exception 'Invalid payment method'; end if;
 if p_discount_percent is null or p_discount_percent<0 or p_discount_percent>100
 then raise exception 'Discount must be between 0 and 100'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Items must be an array'; end if;
 if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Invoice requires 1 to 200 items'; end if;
 fingerprint:=md5(p_shop_id::text||'|'||p_items::text||'|'||coalesce(p_customer_id::text,'')
  ||'|'||p_payment_method||'|'||p_discount_percent::text);
 -- Shop counter lock serializes invoice numbering and idempotency-key reuse.
 select * into shop_row from public.bn_shops where id=p_shop_id for update;
 if not found then raise exception 'Shop not found'; end if;
 select id,invoice_no,request_fingerprint,total_paise into existing
 from public.bn_invoices where shop_id=p_shop_id and idempotency_key=p_idempotency_key;
 if found then
  if existing.request_fingerprint<>fingerprint then
   raise exception 'Idempotency key used for a different invoice' using errcode='23505';
  end if;
  return jsonb_build_object('id',existing.id,'invoice_no',existing.invoice_no,
    'total_paise',existing.total_paise,'already_exists',true);
 end if;
 if p_customer_id is not null then
  select * into customer_row from public.bn_customers
  where shop_id=p_shop_id and id=p_customer_id;
  if not found then raise exception 'Customer does not belong to this shop'; end if;
  if btrim(coalesce(shop_row.state,''))<>'' and btrim(coalesce(customer_row.state,''))<>''
   and lower(btrim(shop_row.state))<>lower(btrim(customer_row.state))
  then tax_type:='inter'; end if;
 end if;
 invoice_number:=shop_row.invoice_prefix||'-'||lpad(shop_row.next_invoice_no::text,4,'0');
 update public.bn_shops set next_invoice_no=next_invoice_no+1,updated_at=now() where id=p_shop_id;
 insert into public.bn_invoices(
  shop_id,invoice_no,idempotency_key,request_fingerprint,customer_id,issued_by,
  payment_method,tax_type,business_snapshot,customer_snapshot
 ) values (
  p_shop_id,invoice_number,p_idempotency_key,fingerprint,p_customer_id,actor,
  p_payment_method,tax_type,
  jsonb_build_object('name',shop_row.name,'state',shop_row.state,
    'tax_mode',shop_row.tax_mode,'invoice_prefix',shop_row.invoice_prefix),
  case when p_customer_id is null then '{}'::jsonb else
    jsonb_build_object('name',customer_row.name,'state',customer_row.state,
      'phone',customer_row.phone,'gstin',customer_row.gstin) end
 ) returning id into invoice_id;
 for item in select value from jsonb_array_elements(p_items)
 loop
  if jsonb_typeof(item) <> 'object'
   or (item->>'product_id') is null
   or (item->>'quantity') is null
  then raise exception 'Invalid invoice line'; end if;
  pid:=(item->>'product_id')::uuid;
  line_qty:=(item->>'quantity')::integer;
  if line_qty not between 1 and 100000 then raise exception 'Invalid invoice quantity'; end if;
  select * into prod from public.bn_products where shop_id=p_shop_id and id=pid for update;
  if not found or prod.archived then raise exception 'Product is unavailable in this shop'; end if;
  if prod.stock_qty < line_qty then raise exception 'Insufficient stock: %',prod.name; end if;
  line_gross:=prod.price_paise * line_qty;
  line_discount:=round(line_gross::numeric * p_discount_percent / 100)::bigint;
  line_net:=line_gross-line_discount;
  if shop_row.tax_mode='inclusive' then
   line_taxable:=round(line_net::numeric*100/(100+prod.gst_rate))::bigint;
   line_tax:=line_net-line_taxable;
   line_total:=line_net;
  else
   line_taxable:=line_net;
   line_tax:=round(line_taxable::numeric*prod.gst_rate/100)::bigint;
   line_total:=line_taxable+line_tax;
  end if;
  update public.bn_products set stock_qty=stock_qty-line_qty,updated_at=now()
    where shop_id=p_shop_id and id=pid;
  insert into public.bn_invoice_items(
   shop_id,invoice_id,product_id,name_snapshot,sku_snapshot,quantity,
   unit_price_paise,gst_rate,discount_paise,taxable_paise,tax_paise,total_paise
  ) values (
   p_shop_id,invoice_id,pid,prod.name,prod.sku,line_qty,prod.price_paise,
   prod.gst_rate,line_discount,line_taxable,line_tax,line_total
  );
  insert into public.bn_stock_movements(shop_id,product_id,invoice_id,change_qty,reason,created_by)
  values(p_shop_id,pid,invoice_id,-line_qty,'Invoice '||invoice_number,actor);
  sum_gross:=sum_gross+line_gross;
  sum_discount:=sum_discount+line_discount;
  sum_taxable:=sum_taxable+line_taxable;
  sum_tax:=sum_tax+line_tax;
  sum_total:=sum_total+line_total;
 end loop;
 update public.bn_invoices set
  subtotal_paise=sum_gross,discount_paise=sum_discount,
  taxable_paise=sum_taxable,tax_paise=sum_tax,total_paise=sum_total
 where shop_id=p_shop_id and id=invoice_id;
 return jsonb_build_object('id',invoice_id,'invoice_no',invoice_number,
  'total_paise',sum_total,'tax_paise',sum_tax,'already_exists',false);
end $$;
revoke all on function public.bn_issue_invoice(uuid,uuid,jsonb,text,uuid,numeric) from public, anon;
grant execute on function public.bn_issue_invoice(uuid,uuid,jsonb,text,uuid,numeric) to authenticated;

create function public.bn_record_payment(
 p_shop_id uuid,p_invoice_id uuid,p_idempotency_key uuid,
 p_amount_paise bigint,p_method text,p_reference text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); invoice_row public.bn_invoices%rowtype;
 paid_so_far bigint; result_id uuid; prev public.bn_payments%rowtype;
 new_paid bigint;
begin
 if actor is null or coalesce((select private.bn_member_role(p_shop_id)),'') not in ('owner','manager','cashier')
 then raise exception 'Not permitted to record payments' using errcode='42501'; end if;
 if p_idempotency_key is null or p_amount_paise is null or p_amount_paise<=0
 or p_method not in ('Cash','UPI','Card','Bank transfer') or p_method is null
 then raise exception 'Invalid payment request'; end if;
 select * into invoice_row from public.bn_invoices
  where shop_id=p_shop_id and id=p_invoice_id for update;
 if not found or invoice_row.status='void' then raise exception 'Invoice not payable'; end if;
 select * into prev from public.bn_payments
  where shop_id=p_shop_id and idempotency_key=p_idempotency_key;
 if found then
  if prev.invoice_id<>p_invoice_id or prev.amount_paise<>p_amount_paise or prev.method<>p_method
  then raise exception 'Idempotency key reused for another payment' using errcode='23505'; end if;
  return jsonb_build_object('id',prev.id,'already_exists',true);
 end if;
 select coalesce(sum(amount_paise),0) into paid_so_far from public.bn_payments
  where shop_id=p_shop_id and invoice_id=p_invoice_id;
 new_paid:=paid_so_far+p_amount_paise;
 if new_paid>invoice_row.total_paise then raise exception 'Payment exceeds outstanding balance'; end if;
 insert into public.bn_payments(shop_id,invoice_id,idempotency_key,amount_paise,method,reference,received_by)
 values(p_shop_id,p_invoice_id,p_idempotency_key,p_amount_paise,p_method,left(coalesce(p_reference,''),200),actor)
 returning id into result_id;
 update public.bn_invoices set status=case when new_paid=total_paise then 'paid' else 'part_paid' end
 where shop_id=p_shop_id and id=p_invoice_id;
 return jsonb_build_object('id',result_id,'already_exists',false,'paid_paise',new_paid);
end $$;
revoke all on function public.bn_record_payment(uuid,uuid,uuid,bigint,text,text) from public, anon;
grant execute on function public.bn_record_payment(uuid,uuid,uuid,bigint,text,text) to authenticated;
