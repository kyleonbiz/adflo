# Owner two-factor recovery plan

**Status: template. Every `[ ]` is blank on purpose. Fill them in, then store the filled copy in the password vault, not in git.**

Staff and the Owner sign in to the Control Center with a password **and** an authenticator code, and the database enforces it
(`aal2`). If the Owner loses the phone with the authenticator and has no other way in, nobody can open the Control Center.
Supabase's authenticator (TOTP) does **not** issue one-time recovery codes, so recovery depends on the paths below being set up
**before** anything goes wrong.

## Paths, strongest first

| # | Path | Set up by | Done |
|---|------|-----------|------|
| 1 | **Second Owner account** with its own authenticator, held by a person you trust ([ name ]) | Sign up at `/signup`, then the first Owner adds them under Control Center → Team as Owner | [ ] |
| 2 | **Second authenticator device** for the same Owner (for example a second phone, or a hardware-backed authenticator), enrolled at the same time as the first | Scan the same enrolment QR on both devices before pressing Verify. Confirm each device produces a working code | [ ] |
| 3 | **Authenticator backup** with export or cloud sync turned on, protected by its own strong passcode | Authenticator app settings. Record which app: [ app name ] | [ ] |
| 4 | **Dashboard reset** by the Supabase project owner: remove the lost factor so the Owner can enrol a new one | Supabase → Authentication → Users → the user → remove the MFA factor. Needs the Supabase account login (which should have its own two-factor) | [ ] |

Path 4 is the last resort and is itself a single point of failure: the Supabase account must have two-factor on, recovery
methods of its own, and a second person who can reach it ([ name ]).

## Where things are kept (fill in; never write the secrets here)

| Item | Where | Who can open it |
|------|-------|-----------------|
| Password vault entry for the Owner login | [ vault name / entry ] | [ names ] |
| Printed or written authenticator setup key (the text under the QR code), sealed | [ location, e.g. fire safe ] | [ names ] |
| Supabase account email and its recovery method | [ vault entry ] | [ names ] |
| Registrar, hosting and email logins | [ vault entry ] | [ names ] |

The setup key lets anyone create the same codes. Treat it like a password: sealed envelope, one place, two people know where.

## If the Owner is locked out

1. Do not delete anything. Note the time and what happened.
2. Try path 2 or 3: another enrolled device or the authenticator backup.
3. Ask the second Owner (path 1) to sign in and, if needed, use Control Center → Team to review access.
4. If neither works, the Supabase project owner uses path 4. Then the Owner signs in with the password, enrols a new authenticator
   at the prompt, and **re-does paths 2 and 3 straight away**.
5. After any lockout: change the Owner password, check Control Center → Monitoring and the staff audit log for activity you do not
   recognise, and record the event in the incident log.

## If the authenticator device is lost or stolen

Treat it as a possible account takeover, not just a lockout. Follow `INCIDENT_PLAN.md`: reset the Owner password, remove the lost
factor (path 4), enrol a new one, and review the audit log.

## Checks

- [ ] Every path above was tested once, on [ date ], by [ name ].
- [ ] A second person knows where the sealed setup key is.
- [ ] The last-owner rule is understood: the database will not remove the only Owner, so the second Owner (path 1) is also the safeguard against losing the only one.
- [ ] Review this plan every [ 6 months ] and whenever staff change.
