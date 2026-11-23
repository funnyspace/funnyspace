-- Execute with: cd billnest && supabase test db
-- Runs inside a rollback transaction against local Supabase only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select plan(21);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bn_test_1111@example.invalid','',now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bn_test_2222@example.invalid','',now(),now())
on conflict(id) do nothing;

create temp table bn_test_ids(kind text primary key,id uuid not null) on commit drop;
grant select,insert,update on bn_test_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into bn_test_ids values('a_shop',public.bn_create_shop('Tenant Test A','Bihar'));
insert into bn_test_ids values('a_product',public.bn_upsert_product(
  (select id from bn_test_ids where kind='a_shop'),'A-101','Notebook',20000,2));

select is((select count(*)::integer from public.bn_shops),1,'Alice sees only her shop');
select is((select count(*)::integer from public.bn_products),1,'Alice sees her product');
select is((select stock_qty from public.bn_products where id=(select id from bn_test_ids where kind='a_product')),2,'Opening stock is tracked');
select is((select count(*)::integer from public.bn_stock_movements),1,'Initial stock creates audit movement');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into bn_test_ids values('b_shop',public.bn_create_shop('Tenant Test B','Jharkhand'));
select is((select count(*)::integer from public.bn_shops),1,'Bob cannot see Alice shop');
select is((select count(*)::integer from public.bn_products),0,'Bob cannot see Alice product');
select is((select count(*)::integer from public.bn_shop_members),1,'Bob cannot inspect Alice shop membership');

select throws_ok(
 $$select public.bn_upsert_product(
   (select id from bn_test_ids where kind='a_shop'),'CROSS','Hacked item',100,1)$$,
 '42501', 'Not authorized to modify products',
 'Bob cannot write products into Alice shop');
select throws_ok(
 $$insert into public.bn_products(shop_id,sku,name,price_paise)
   values((select id from bn_test_ids where kind='b_shop'),'DIRECT','Bypass',100)$$,
 '42501', 'permission denied for table bn_products',
 'Direct client INSERT is denied even for own shop');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select count(*)::integer from public.bn_products),1,'Alice still cannot see other shops products');
select lives_ok($$select public.bn_issue_invoice(
 (select id from bn_test_ids where kind='a_shop'),
 'aaaa0000-0000-4000-8000-000000000001',
 jsonb_build_array(jsonb_build_object('product_id',(select id from bn_test_ids where kind='a_product'),'quantity',1)),
 'Cash')$$,'Alice can issue an atomic sale');

select is((select stock_qty from public.bn_products where id=(select id from bn_test_ids where kind='a_product')),1,
 'Sale reduces stock by one');
select lives_ok($$select public.bn_issue_invoice(
 (select id from bn_test_ids where kind='a_shop'),
 'aaaa0000-0000-4000-8000-000000000001',
 jsonb_build_array(jsonb_build_object('product_id',(select id from bn_test_ids where kind='a_product'),'quantity',1)),
 'Cash')$$,'Invoice retry with same idempotency key succeeds');
select is((select count(*)::integer from public.bn_invoices),1,
 'Invoice retry does not duplicate the sale');
select is((select stock_qty from public.bn_products where id=(select id from bn_test_ids where kind='a_product')),1,
 'Invoice retry cannot deduct stock twice');
select throws_ok($$select public.bn_issue_invoice(
 (select id from bn_test_ids where kind='a_shop'),
 'aaaa0000-0000-4000-8000-000000000002',
 jsonb_build_array(jsonb_build_object('product_id',(select id from bn_test_ids where kind='a_product'),'quantity',2)),
 'Cash')$$, 'P0001','Insufficient stock: Notebook','Overselling is rejected');

select lives_ok($$select public.bn_record_payment(
 (select id from bn_test_ids where kind='a_shop'),
 (select id from public.bn_invoices limit 1),
 'bbbb0000-0000-4000-8000-000000000001',
 20000,'Cash')$$,'Payment records against the authorized invoice');
select is((select status from public.bn_invoices limit 1),'paid','Full payment marks invoice paid');
select lives_ok($$select public.bn_record_payment(
 (select id from bn_test_ids where kind='a_shop'),
 (select id from public.bn_invoices limit 1),
 'bbbb0000-0000-4000-8000-000000000001',
 20000,'Cash')$$,'Payment idempotency prevents duplicate receipts');
select is((select count(*)::integer from public.bn_payments),1,'Retry does not duplicate the payment');
select throws_ok($$select public.bn_record_payment(
 (select id from bn_test_ids where kind='a_shop'),
 (select id from public.bn_invoices limit 1),
 'bbbb0000-0000-4000-8000-000000000002',
 1,'Cash')$$,'P0001','Payment exceeds outstanding balance','Overpayment is rejected');

select * from finish();
rollback;
