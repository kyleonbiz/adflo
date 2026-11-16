-- Onboarding guide: three more steps so the checklist covers setting a client up from start to finish.
-- Existing ticks stay as they are; the new steps are simply not ticked yet.
alter table public.client_checklist drop constraint if exists client_checklist_step_check;
alter table public.client_checklist add constraint client_checklist_step_check
  check (step in ('details', 'workspace', 'owner_invited', 'welcome_sent', 'agreement_sent', 'plan_set', 'first_login', 'live'));
