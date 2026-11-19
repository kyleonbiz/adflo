# Sign-in emails (Supabase Auth)

The emails the app sends itself (agreements, invitations, welcome, reminders, shared documents) are branded in code, in
`src/lib/mail/layout.ts`. The emails Supabase Auth sends (confirm email, reset password, and so on) are set in the Supabase
dashboard, so these HTML files carry the same look for them.

Paste each file in **Supabase dashboard > Authentication > Emails (Templates)**, and set the subject:

| Template | File | Subject |
| --- | --- | --- |
| Confirm sign up | `confirm-signup.html` | Confirm your email address |
| Invite user | `invite-user.html` | You have been invited to AdFlo |
| Magic link | `magic-link.html` | Your AdFlo sign-in link |
| Reset password | `reset-password.html` | Reset your AdFlo password |
| Change email address | `change-email.html` | Confirm your new email address |

They use Supabase's `{{ .ConfirmationURL }}` variable, so nothing else needs filling in. The logo loads from
`https://www.adflo.pro/logo-wordmark-light.png`.
