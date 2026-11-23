# Support policy

- **Support address:** support@adflo.pro (an alias of the main mailbox; replies go out from the same address).
- **Hours:** weekdays, 9am to 5pm Eastern, excluding US holidays.
- **First-response target:** one business day.
- **Urgent issues** (cannot sign in, data looks wrong or missing): note it in the subject line and the ticket priority is set to High in the Control Center. Same target, handled first.
- **Tickets:** log every request in the Control Center support queue. Use Waiting on client while you wait for a reply, and Closed when resolved.
- **In-app requests:** clients open requests from Help & Training > Open support (Question, Problem or Request). Each gets a number like AF-12 and lands in the queue as Open. Reply from the ticket's Conversation section: the client sees it in the app and by email, and an open ticket moves to Waiting on client. Their reply moves it back to Open. Notes are internal and are never shown to clients. Tickets staff log themselves stay internal. New requests and client replies also email SUPPORT_NOTIFY_EMAIL (default support@adflo.pro) and show on the Control center bell.

## Status page
- **Public page:** `/status` on the app domain. Shows the app and the sign-in/database service. No sign-in needed, nothing private shown.
- **For uptime monitors:** `/api/status` returns JSON, with HTTP 200 when healthy or slow and 503 when something is down. Point an external uptime monitor at it (see the roadmap item "Add an uptime monitor") and alert your phone on any non-200.
- **Limit:** it is served by the app itself, so if the whole app is down the page is down too. The external monitor is what catches that. If you outgrow this, move to a hosted status page and link it from the footer.
