-- Supabase's existing automatic-RLS event trigger does not need Data API EXECUTE.
-- Apply only when it exists, so a fresh local database can run this migration.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
   revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
 end if;
end $$;
