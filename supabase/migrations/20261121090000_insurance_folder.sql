-- An Insurance folder in Documents: a new document category ('insurance'), a standard Insurance folder for every new workspace,
-- and one for every workspace that already exists.
--
-- 1. The two category checks gain 'insurance'.
-- 2. The functions that make a new workspace's standard folders (create_workspace, control_provision_workspace) get the Insurance
--    folder, and the document search function (dms_query_documents) learns to match the word "insurance". They are changed in place
--    from their current definitions (so nothing else about them can drift), and only if they have not been changed already.
-- 3. Every workspace without an Insurance folder gets one. A workspace that already made its own folder with that name keeps it.

alter table public.document_folders drop constraint if exists document_folders_default_category_check;
alter table public.document_folders add constraint document_folders_default_category_check
  check (default_category in ('invoice', 'receipt', 'tax', 'contract', 'hr', 'insurance', 'other'));
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (category in ('invoice', 'receipt', 'tax', 'contract', 'hr', 'insurance', 'other'));

do $body$
declare def text; fixed text; r record;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('create_workspace', 'control_provision_workspace', 'dms_query_documents')
  loop
    def := pg_get_functiondef(r.oid);
    if r.proname = 'dms_query_documents' then
      fixed := replace(def, 'when ''hr'' then ''hr document'' else ''other'' end', 'when ''hr'' then ''hr document'' when ''insurance'' then ''insurance'' else ''other'' end');
    else
      fixed := regexp_replace(def, '\(ws, ''HR Documents'', ''rose'', true, ''hr'', (null|uid)\)', '(ws, ''HR Documents'', ''rose'', true, ''hr'', \1), (ws, ''Insurance'', ''sky'', true, ''insurance'', \1)');
    end if;
    if fixed is distinct from def then execute fixed; end if;
  end loop;
end $body$;

insert into public.document_folders (workspace_id, name, color, is_system, default_category, created_by)
select w.id, 'Insurance', 'sky', true, 'insurance', null
from public.workspaces w
where not exists (select 1 from public.document_folders f where f.workspace_id = w.id and lower(f.name) = 'insurance');
