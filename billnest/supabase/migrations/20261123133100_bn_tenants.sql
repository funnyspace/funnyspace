-- BillNest production database, phase 1 (no automatic migration of browser data).
-- Apply with Supabase CLI migrations after review; do NOT run this against unrelated schemas.
-- All business writes are explicitly authorized server operations. The browser gets SELECT only.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.bn_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id),
  state text not null default '',
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Za-z0-9/-]{1,20}$'),
  next_invoice_no bigint not null default 1 check (next_invoice_no >= 1),
  tax_mode text not null default 'exclusive' check (tax_mode in ('exclusive','inclusive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.bn_shop_members (
  shop_id uuid not null references public.bn_shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','cashier','viewer')),
  created_at timestamptz not null default now(),
  primary key (shop_id,user_id)
);
create index bn_shop_members_user_idx on public.bn_shop_members(user_id,shop_id);

-- Defined in an unexposed schema, owned by the database migration role.
-- It checks the signed-in JWT identity, NOT client-provided user IDs.
create or replace function private.bn_member_role(p_shop uuid)
returns text language sql stable security definer set search_path=''
as $$
  select m.role from public.bn_shop_members m
  where m.shop_id=p_shop and m.user_id=(select auth.uid())
  limit 1
$$;
revoke all on function private.bn_member_role(uuid) from public, anon;
grant execute on function private.bn_member_role(uuid) to authenticated;

create table public.bn_products (
  shop_id uuid not null references public.bn_shops(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  sku text not null check (length(btrim(sku)) between 1 and 80),
  name text not null check (length(btrim(name)) between 1 and 200),
  barcode text not null default '',
  category text not null default '',
  unit text not null default 'pcs',
  price_paise bigint not null check (price_paise >= 0 and price_paise <= 10000000000000),
  cost_paise bigint not null default 0 check (cost_paise >= 0 and cost_paise <= 10000000000000),
  gst_rate numeric(6,3) not null default 0 check (gst_rate between 0 and 100),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_qty integer not null default 0 check (low_stock_qty >= 0),
  expiry_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id,id),
  unique (shop_id,sku)
);
create index bn_products_shop_name_idx on public.bn_products(shop_id,name,id);
create index bn_products_shop_barcode_idx on public.bn_products(shop_id,barcode) where barcode<>'';

create table public.bn_customers (
  shop_id uuid not null references public.bn_shops(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text not null default '',
  email text not null default '',
  state text not null default '',
  gstin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id,id)
);
create index bn_customers_shop_name_idx on public.bn_customers(shop_id,name,id);

create table public.bn_invoices (
  shop_id uuid not null references public.bn_shops(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  invoice_no text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null default '',
  customer_id uuid,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  payment_method text not null check (payment_method in ('Cash','UPI','Card','Bank transfer','Credit')),
  status text not null default 'unpaid' check (status in ('unpaid','part_paid','paid','void')),
  subtotal_paise bigint not null default 0 check (subtotal_paise>=0),
  discount_paise bigint not null default 0 check (discount_paise>=0),
  taxable_paise bigint not null default 0 check (taxable_paise>=0),
  tax_paise bigint not null default 0 check (tax_paise>=0),
  total_paise bigint not null default 0 check (total_paise>=0),
  tax_type text not null default 'intra' check (tax_type in ('intra','inter')),
  business_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  primary key (shop_id,id),
  unique (shop_id,invoice_no),
  unique (shop_id,idempotency_key),
  foreign key (shop_id,customer_id) references public.bn_customers(shop_id,id)
);
create index bn_invoices_shop_issued_idx on public.bn_invoices(shop_id,issued_at desc,id);

create table public.bn_invoice_items (
  shop_id uuid not null,
  id uuid not null default gen_random_uuid(),
  invoice_id uuid not null,
  product_id uuid not null,
  name_snapshot text not null,
  sku_snapshot text not null,
  quantity integer not null check (quantity>0),
  unit_price_paise bigint not null check (unit_price_paise>=0),
  gst_rate numeric(6,3) not null check (gst_rate between 0 and 100),
  discount_paise bigint not null check (discount_paise>=0),
  taxable_paise bigint not null check (taxable_paise>=0),
  tax_paise bigint not null check (tax_paise>=0),
  total_paise bigint not null check (total_paise>=0),
  primary key (shop_id,id),
  foreign key (shop_id,invoice_id) references public.bn_invoices(shop_id,id) on delete restrict,
  foreign key (shop_id,product_id) references public.bn_products(shop_id,id)
);
create index bn_invoice_items_parent_idx on public.bn_invoice_items(shop_id,invoice_id);

create table public.bn_stock_movements (
  shop_id uuid not null,
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  invoice_id uuid,
  change_qty integer not null check (change_qty<>0),
  reason text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (shop_id,id),
  foreign key (shop_id,product_id) references public.bn_products(shop_id,id),
  foreign key (shop_id,invoice_id) references public.bn_invoices(shop_id,id)
);
create index bn_stock_movements_product_idx on public.bn_stock_movements(shop_id,product_id,created_at desc);

create table public.bn_payments (
  shop_id uuid not null,
  id uuid not null default gen_random_uuid(),
  invoice_id uuid not null,
  idempotency_key uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  method text not null check (method in ('Cash','UPI','Card','Bank transfer')),
  reference text not null default '',
  received_by uuid not null references auth.users(id),
  received_at timestamptz not null default now(),
  primary key (shop_id,id),
  unique (shop_id,idempotency_key),
  foreign key (shop_id,invoice_id) references public.bn_invoices(shop_id,id)
);
create index bn_payments_invoice_idx on public.bn_payments(shop_id,invoice_id);

create table public.bn_accounting_entries (
  shop_id uuid not null references public.bn_shops(id),
  id uuid not null default gen_random_uuid(),
  entry_type text not null,
  account text not null check (account in ('cash','bank')),
  amount_paise bigint not null check (amount_paise > 0),
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (shop_id,id)
);
create index bn_accounting_shop_time_idx on public.bn_accounting_entries(shop_id,created_at desc);

-- All tenants are isolated in the database. No table writes by browser roles:
-- writes go through explicitly checked operations in subsequent migrations.
do $$
declare t text;
begin
 foreach t in array array['bn_shops','bn_shop_members','bn_products','bn_customers','bn_invoices',
 'bn_invoice_items','bn_stock_movements','bn_payments','bn_accounting_entries'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from public, anon, authenticated',t);
   execute format('grant select on table public.%I to authenticated',t);
 end loop;
end $$;
create policy bn_shops_read on public.bn_shops for select to authenticated
using ((select private.bn_member_role(id)) is not null);
create policy bn_members_read on public.bn_shop_members for select to authenticated
using ((select private.bn_member_role(shop_id)) is not null);
create policy bn_products_read on public.bn_products for select to authenticated
using ((select private.bn_member_role(shop_id)) is not null);
create policy bn_customers_read on public.bn_customers for select to authenticated
using ((select private.bn_member_role(shop_id)) in ('owner','manager','cashier'));
create policy bn_invoices_read on public.bn_invoices for select to authenticated
using ((select private.bn_member_role(shop_id)) is not null);
create policy bn_items_read on public.bn_invoice_items for select to authenticated
using ((select private.bn_member_role(shop_id)) is not null);
create policy bn_movements_read on public.bn_stock_movements for select to authenticated
using ((select private.bn_member_role(shop_id)) in ('owner','manager','cashier'));
create policy bn_payments_read on public.bn_payments for select to authenticated
using ((select private.bn_member_role(shop_id)) in ('owner','manager','cashier'));
create policy bn_accounting_read on public.bn_accounting_entries for select to authenticated
using ((select private.bn_member_role(shop_id)) in ('owner','manager'));

-- Public schema RPCs are intentionally small. Do not grant EXECUTE to anon or PUBLIC.
create function public.bn_create_shop(p_name text,p_state text default '',p_invoice_prefix text default 'INV')
returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); sid uuid;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Invalid shop name'; end if;
 if coalesce(p_invoice_prefix,'') !~ '^[A-Za-z0-9/-]{1,20}$' then raise exception 'Invalid invoice prefix'; end if;
 insert into public.bn_shops(name,created_by,state,invoice_prefix)
 values (btrim(p_name),actor,left(coalesce(p_state,''),100),p_invoice_prefix) returning id into sid;
 insert into public.bn_shop_members(shop_id,user_id,role) values(sid,actor,'owner');
 return sid;
end $$;
revoke all on function public.bn_create_shop(text,text,text) from public, anon;
grant execute on function public.bn_create_shop(text,text,text) to authenticated;

create function public.bn_upsert_product(
 p_shop_id uuid,p_sku text,p_name text,p_price_paise bigint,
 p_stock_qty integer default null,p_product_id uuid default null,
 p_cost_paise bigint default 0,p_gst_rate numeric default 0,
 p_category text default '',p_unit text default 'pcs',
 p_barcode text default '',p_low_stock_qty integer default 0
) returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); old_stock int; product_id uuid; new_stock int;
begin
 if actor is null or coalesce((select private.bn_member_role(p_shop_id)),'') not in ('owner','manager')
 then raise exception 'Not authorized to modify products' using errcode='42501'; end if;
 if length(btrim(coalesce(p_sku,''))) not between 1 and 80
 or length(btrim(coalesce(p_name,''))) not between 1 and 200
 or p_price_paise is null or p_price_paise<0 or p_price_paise>10000000000000
 or p_cost_paise is null or p_cost_paise<0 or p_cost_paise>10000000000000
 or p_gst_rate is null or p_gst_rate<0 or p_gst_rate>100
 or coalesce(p_low_stock_qty,-1)<0 or (p_stock_qty is not null and p_stock_qty<0)
 then raise exception 'Invalid product fields'; end if;
 if p_product_id is null then
   new_stock:=coalesce(p_stock_qty,0);
   insert into public.bn_products
    (shop_id,sku,name,price_paise,cost_paise,gst_rate,stock_qty,low_stock_qty,category,unit,barcode)
   values (p_shop_id,btrim(p_sku),btrim(p_name),p_price_paise,p_cost_paise,
    p_gst_rate,new_stock,p_low_stock_qty,left(coalesce(p_category,''),120),
    left(coalesce(p_unit,'pcs'),25),left(coalesce(p_barcode,''),80))
   returning id into product_id;
   old_stock:=0;
 else
   select stock_qty into old_stock from public.bn_products
   where shop_id=p_shop_id and id=p_product_id for update;
   if not found then raise exception 'Product not found in shop' using errcode='22023'; end if;
   new_stock:=coalesce(p_stock_qty,old_stock);
   update public.bn_products set
    sku=btrim(p_sku),name=btrim(p_name),price_paise=p_price_paise,cost_paise=p_cost_paise,
    gst_rate=p_gst_rate,stock_qty=new_stock,low_stock_qty=p_low_stock_qty,
    category=left(coalesce(p_category,''),120),unit=left(coalesce(p_unit,'pcs'),25),
    barcode=left(coalesce(p_barcode,''),80),updated_at=now()
   where shop_id=p_shop_id and id=p_product_id;
   product_id:=p_product_id;
 end if;
 if new_stock<>old_stock then
  insert into public.bn_stock_movements(shop_id,product_id,change_qty,reason,created_by)
  values(p_shop_id,product_id,new_stock-old_stock,
   case when p_product_id is null then 'Initial stock' else 'Manual stock adjustment' end,actor);
 end if;
 return product_id;
end $$;
revoke all on function public.bn_upsert_product(uuid,text,text,bigint,integer,uuid,bigint,numeric,text,text,text,integer) from public, anon;
grant execute on function public.bn_upsert_product(uuid,text,text,bigint,integer,uuid,bigint,numeric,text,text,text,integer) to authenticated;

create function public.bn_upsert_customer(
 p_shop_id uuid,p_name text,p_customer_id uuid default null,p_phone text default '',
 p_email text default '',p_state text default '',p_gstin text default ''
) returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); result_id uuid;
begin
 if actor is null or coalesce((select private.bn_member_role(p_shop_id)),'') not in ('owner','manager','cashier')
 then raise exception 'Not authorized to modify customers' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'Invalid customer name'; end if;
 if p_customer_id is null then
  insert into public.bn_customers(shop_id,name,phone,email,state,gstin)
  values(p_shop_id,btrim(p_name),left(coalesce(p_phone,''),40),left(coalesce(p_email,''),200),
   left(coalesce(p_state,''),100),left(coalesce(p_gstin,''),30))
  returning id into result_id;
 else
  update public.bn_customers set name=btrim(p_name),phone=left(coalesce(p_phone,''),40),
   email=left(coalesce(p_email,''),200),state=left(coalesce(p_state,''),100),
   gstin=left(coalesce(p_gstin,''),30),updated_at=now()
  where shop_id=p_shop_id and id=p_customer_id returning id into result_id;
  if result_id is null then raise exception 'Customer not found in shop'; end if;
 end if;
 return result_id;
end $$;
revoke all on function public.bn_upsert_customer(uuid,text,uuid,text,text,text,text) from public, anon;
grant execute on function public.bn_upsert_customer(uuid,text,uuid,text,text,text,text) to authenticated;

-- Avoid granting INSERT, UPDATE, DELETE directly to the frontend.
-- The remaining billing/payment RPCs are defined in the next migration.
