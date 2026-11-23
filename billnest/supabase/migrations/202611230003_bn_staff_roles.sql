-- Shop membership changes are owner-authorized. A staff member must already
-- have an authenticated and verified Supabase account to be assigned a role.
-- Owner ownership cannot be granted or removed through these functions.
create function public.bn_add_existing_member(
 p_shop_id uuid,p_email text,p_role text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); target uuid;
begin
 if actor is null or (select private.bn_member_role(p_shop_id)) is distinct from 'owner' then
  raise exception 'Only shop owners can manage staff' using errcode='42501'; end if;
 if p_role not in ('manager','cashier','viewer') or p_role is null
 then raise exception 'Invalid staff role'; end if;
 if coalesce(length(btrim(p_email)),0) not between 3 and 200
 then raise exception 'Invalid email'; end if;
 select id into target from auth.users
 where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null
 limit 1;
 if target is null then
  raise exception 'Staff member must register and verify email before being added'; end if;
 if target=actor then raise exception 'Owner role cannot be modified'; end if;
 insert into public.bn_shop_members as member(shop_id,user_id,role)
 values(p_shop_id,target,p_role)
 on conflict (shop_id,user_id) do update set
 role=case when member.role='owner' then member.role else excluded.role end;
 return target;
end $$;
revoke all on function public.bn_add_existing_member(uuid,text,text) from public, anon;
grant execute on function public.bn_add_existing_member(uuid,text,text) to authenticated;

create function public.bn_remove_member(p_shop_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); affected integer;
begin
 if actor is null or (select private.bn_member_role(p_shop_id)) is distinct from 'owner' then
  raise exception 'Only shop owners can manage staff' using errcode='42501'; end if;
 if p_user_id=actor then raise exception 'Owner cannot remove themself'; end if;
 delete from public.bn_shop_members
 where shop_id=p_shop_id and user_id=p_user_id and role<>'owner';
 get diagnostics affected=row_count;
 return affected>0;
end $$;
revoke all on function public.bn_remove_member(uuid,uuid) from public, anon;
grant execute on function public.bn_remove_member(uuid,uuid) to authenticated;
