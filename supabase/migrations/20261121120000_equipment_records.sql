-- Equipment and assets: another service saved to the workspace. Access is unchanged: members read; editors and above write.
alter table public.workspace_records drop constraint workspace_records_kind_check;
alter table public.workspace_records add constraint workspace_records_kind_check check (kind in (
  'licenses', 'projects', 'invoices', 'vendors', 'contacts', 'equipment',
  'todos', 'reminders', 'signing', 'packets', 'schedules', 'projecttypes',
  'settings', 'setup', 'chains'));

alter table public.workspace_record_sets drop constraint workspace_record_sets_kind_check;
alter table public.workspace_record_sets add constraint workspace_record_sets_kind_check check (kind in (
  'licenses', 'projects', 'invoices', 'vendors', 'contacts', 'equipment',
  'todos', 'reminders', 'signing', 'packets', 'schedules', 'projecttypes',
  'settings', 'setup', 'chains'));
