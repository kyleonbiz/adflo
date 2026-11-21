# Support policy

- **Support address:** support@adflo.pro (an alias of the main mailbox; replies go out from the same address).
- **Hours:** weekdays, 9am to 5pm Eastern, excluding US holidays.
- **First-response target:** one business day.
- **Urgent issues** (cannot sign in, data looks wrong or missing): note it in the subject line and the ticket priority is set to High in the Control Center. Same target, handled first.
- **How clients reach us:** from Help & Training inside AdFlo (preferred; it creates the ticket and keeps the conversation), or by email to the support address. Requests from inside AdFlo arrive in the queue marked From client, and the team is emailed at the support address. An emailed request is logged by hand as a ticket.
- **Replying:** in the ticket, choose Reply to client (emailed to them and shown in their Help page) or Internal note (staff only). Replying sets the ticket to Waiting on client; a client answer reopens it.
- **Tickets:** log every request in the Control Center support queue. Use Waiting on client while you wait for a reply, and Closed when resolved.

## Status page
- **Public page:** `/status` on the app domain. Shows the app and the sign-in/database service. No sign-in needed, nothing private shown.
- **For uptime monitors:** `/api/status` returns JSON, with HTTP 200 when healthy or slow and 503 when something is down. Point an external uptime monitor at it (see the roadmap item "Add an uptime monitor") and alert your phone on any non-200.
- **Limit:** it is served by the app itself, so if the whole app is down the page is down too. The external monitor is what catches that. If you outgrow this, move to a hosted status page and link it from the footer.
