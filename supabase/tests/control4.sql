-- Control Center step 4 tests: agreements.
\set own '''00000000-0000-4000-8000-000000000091'''
\set sup '''00000000-0000-4000-8000-000000000092'''
\set bil '''00000000-0000-4000-8000-000000000093'''
-- The link secrets (43 URL-safe characters, as newToken() makes them). Only their SHA-256 is stored.
\set r1 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
\set r2 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
reset role;
select encode(sha256(convert_to(:'r1', 'utf8')), 'hex') as h1, encode(sha256(convert_to(:'r2', 'utf8')), 'hex') as h2 \gset
insert into auth.users (id, email) values (:own, 'own4@staff.test'), (:sup, 'sup4@staff.test'), (:bil, 'bil4@staff.test');
insert into public.staff_members (user_id, role, display_name, email) values (:own, 'owner', 'Own4', 'own4@staff.test'), (:sup, 'support', 'Sup4', 'sup4@staff.test'), (:bil, 'billing', 'Bil4', 'bil4@staff.test');
insert into public.clients (name) values ('Epsilon LLC');

select t.as_staff(:sup::uuid);
select t.fails('support cannot publish an agreement', $$select public.control_publish_agreement('Terms', 'text')$$, 'Only the Owner');
select t.fails('nobody inserts templates directly', $$insert into public.agreement_templates (title, version, body) values ('x', 1, 'y')$$);

select t.as_staff(:own::uuid);
select t.ok('first publish is version 1', public.control_publish_agreement('Terms of Service', 'v1 text') is not null);
select t.ok('second publish is version 2', t.count($$select 1 from public.agreement_templates where title = 'Terms of Service'$$) = 1 and public.control_publish_agreement('terms of service', 'v2 text') is not null);
select t.ok('versions are 1 and 2', t.count($$select 1 from public.agreement_templates where title = 'Terms of Service' and version in (1, 2)$$) = 2);
select t.fails('templates cannot be edited', $$update public.agreement_templates set body = 'changed'$$);
select t.fails('templates cannot be deleted', $$delete from public.agreement_templates$$);

select t.as_staff(:sup::uuid);
select t.ok('support sends an agreement', public.control_send_agreement((select id from public.clients where name = 'Epsilon LLC'), (select id from public.agreement_templates where title = 'Terms of Service' and version = 2), :'h1') is not null);
select t.ok('sending ticks the onboarding step', t.count($$select 1 from public.client_checklist c join public.clients k on k.id = c.client_id where k.name = 'Epsilon LLC' and c.step = 'agreement_sent'$$) = 1);
select t.fails('the same link cannot be reused', format($$select public.control_send_agreement((select id from public.clients where name = 'Epsilon LLC'), (select id from public.agreement_templates limit 1), %L)$$, :'h1'));
select t.fails('a link secret must be a sha-256 hex', format($$select public.control_send_agreement((select id from public.clients where name = 'Epsilon LLC'), (select id from public.agreement_templates limit 1), %L)$$, 'short'));
select t.fails('agreements cannot be written directly', format($$update public.agreements_sent set accepted_at = now()$$));

select t.as_staff(:bil::uuid);
select t.fails('billing cannot send', format($$select public.control_send_agreement((select id from public.clients where name = 'Epsilon LLC'), (select id from public.agreement_templates limit 1), %L)$$, :'h2'), 'Not allowed');
select t.ok('billing can read what was sent', t.count('select 1 from public.agreements_sent') = 1);
select t.ok('billing cannot use the stored hash to accept for the client',
  public.agreement_public_accept((select token_hash from public.agreements_sent limit 1), 'Forger Name', 'forger@e.co') = false
  and t.count('select 1 from public.agreements_sent where accepted_at is not null') = 0);

select t.as_anon();
select t.fails('anon cannot read the tables', 'select 1 from public.agreements_sent');
select t.ok('anon sees the agreement with the right secret', t.count($$select 1 from public.agreement_public_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') where title = 'Terms of Service' and version = 2 and client_name = 'Epsilon LLC' and accepted_at is null$$) = 1);
select t.ok('anon sees nothing for a wrong secret', t.count($$select 1 from public.agreement_public_view('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')$$) = 0);
select t.ok('the stored hash is no credential: it shows nothing', t.count(format($$select 1 from public.agreement_public_view(%L)$$, :'h1')) = 0);
select t.ok('...and cannot accept', public.agreement_public_accept(:'h1', 'Pat Lee', 'pat@e.co') = false);
select t.ok('a malformed secret is refused', public.agreement_public_accept('short', 'Pat Lee', 'pat@e.co') = false and public.agreement_public_accept(null, 'Pat Lee', 'pat@e.co') = false);
select t.ok('a secret with the wrong length is refused', public.agreement_public_accept(repeat('A', 44), 'Pat Lee', 'pat@e.co') = false);
select t.ok('acceptance needs a real name', public.agreement_public_accept(:'r1', 'X', 'a@b.co') = false);
select t.ok('acceptance needs a real email', public.agreement_public_accept(:'r1', 'Pat Lee', 'nope') = false);
select t.ok('acceptance by a wrong secret fails', public.agreement_public_accept(:'r2', 'Pat Lee', 'pat@e.co') = false);
select t.ok('client accepts', public.agreement_public_accept(:'r1', 'Pat Lee', 'Pat@E.co') = true);
select t.ok('a second acceptance is refused', public.agreement_public_accept(:'r1', 'Someone Else', 'x@e.co') = false);
select t.ok('the view now shows who accepted', t.count($$select 1 from public.agreement_public_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') where accepted_name = 'Pat Lee'$$) = 1);

select t.as_staff(:own::uuid);
select t.ok('acceptance is recorded with the email', t.count($$select 1 from public.agreements_sent where accepted_email = 'pat@e.co'$$) = 1);
select t.ok('acceptance appears in the audit log, without the secret', t.count($$select 1 from public.staff_audit_log where action = 'agreement.update' and detail ? 'accepted_at' and not (detail ? 'token_hash')$$) = 1);
select t.ok('the timeline shows the agreement', t.count($$select 1 from public.control_client_timeline((select id from public.clients where name = 'Epsilon LLC')) where action like 'agreement.%'$$) >= 2);

reset role;
update public.agreements_sent set expires_at = now() - interval '1 day', accepted_at = null where token_hash = :'h1';
select t.as_anon();
select t.ok('an expired link cannot be accepted', public.agreement_public_accept(:'r1', 'Pat Lee', 'pat@e.co') = false);
select t.ok('...and is reported as expired', t.count($$select 1 from public.agreement_public_view('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') where expired$$) = 1);
reset role;
\echo ALL CONTROL4 TESTS PASSED
