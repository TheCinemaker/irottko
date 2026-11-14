-- =====================================================================
--  011 – SECURITY DEFINER függvények keményítése. Többször is futtatható.
--
--  Minden SECURITY DEFINER függvényünk (a tulajdonos jogaival fut) explicit
--  search_path-et kap: előbb pg_catalog, aztán public – így egy esetleg
--  máshol létrehozott, azonos nevű objektum sem kerülhet elé.
--  (Gyakorlati kockázat eddig sem volt: az anon/authenticated nem hozhat
--  létre semmit a public sémában – ezt az utolsó lekérdezés ellenőrzi.)
--  Csak a meglévő függvények beállítása változik, a működésük nem.
-- =====================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    execute format('alter function %s set search_path = pg_catalog, public', f.sig);
    raise notice 'search_path rögzítve: %', f.sig;
  end loop;
end $$;

-- Ellenőrzés 1: a SECURITY DEFINER függvények, tulajdonosuk és beállításuk.
-- Elvárt: owner = postgres, config = {"search_path=pg_catalog, public"},
-- anon_exec = true CSAK a get_event_public-nál.
select p.oid::regprocedure                       as function,
       pg_get_userbyid(p.proowner)               as owner,
       p.proconfig                               as config,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
 order by 1;

-- Ellenőrzés 2: a public séma – senki ne hozhasson létre benne objektumot.
-- Elvárt: create = false mindkettőnél.
select r as role,
       has_schema_privilege(r, 'public', 'usage')  as usage,
       has_schema_privilege(r, 'public', 'create') as "create"
  from unnest(array['anon', 'authenticated']) as r;
