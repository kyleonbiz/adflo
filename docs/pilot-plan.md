# Pilot plan: first contractor clients

**Goal:** in 6 weeks, learn whether contractors keep using AdFlo after the first week, and whether 3 or more of them will pay.

AdFlo is an administrative management platform for contractors: records, compliance deadlines, equipment and paperwork in one place, alongside the accounting, payroll and project software they already use.

## Who to recruit (3 to 5 pilots)

- Owner-operated contractors with 2 to 15 people: trades, remodelers, HVAC, plumbing, electrical, landscaping, roofing.
- Must have real admin pain: licenses or insurance that expire, trucks and tools to track, paperwork to keep for clients or inspectors.
- Mix of sizes: at least one solo owner, at least one team with 3 or more seats (to test seat billing).
- People you can reach directly: past clients, friends of friends, trade groups, an accountant or bookkeeper who refers them.
- Avoid: anyone who wants it to replace their accounting or project software.

## The offer

- Free 3-day trial, then a **pilot rate**: $99 a month plus $10 a seat, with the onboarding fee waived or discounted for the first 5.
- In return: a 20-minute call each week for 4 weeks, honest feedback, and a short testimonial if they are happy.
- Pilot terms in writing (length 6 weeks, price, what happens at the end, cancel any time, data export on request).

## Timeline

| Week | What happens |
|---|---|
| 0 | Pick 10 candidates, send outreach, book intro calls. Confirm production is stable (live-site tests are done). |
| 1 | Onboard 3 to 5 pilots using `docs/support/onboarding-runbook.md`. Load their real licenses, insurance, vehicles and tools together on a call. |
| 2 | Watch the Monitoring page and error log daily. Short check-in call with each pilot. |
| 3 | Check-in calls. Note what they ignore and what they ask for. |
| 4 | Check-in calls. Ask the buying question: "Would you pay for this today?" |
| 5 | Fix the top 3 issues pilots raised. Ask for testimonials from happy ones. |
| 6 | Retro. Decide: convert pilots to paid, adjust scope, or change course. Review Supabase, Vercel and Anthropic costs. |

## Onboarding call (45 minutes, per pilot)

1. Sign up and create the workspace together.
2. Add every license, insurance policy and certification with its real expiry date.
3. Add vehicles, key tools and HVAC or appliance units to Equipment.
4. Invite their office person or crew leads (tests seats).
5. Set reminder lead times and confirm renewal emails arrive.
6. Show Addy and the "Needs your attention" feed.
7. Agree the one thing they will do before next week.

## What to measure

| Signal | Good | Worry |
|---|---|---|
| Records added in week 1 | 15 or more | Under 5 |
| Return visits per week | 3 or more | Under 1 |
| Reminder emails opened or acted on | Most | None |
| Teammates invited | 1 or more | Owner alone |
| Asks to keep using it after week 6 | 3 of 5 | 0 or 1 |
| Willing to pay the full price | 2 or more | None |

## Questions for the weekly calls

- What did you open this week, and why?
- What did you expect to find that was not there?
- What did you still do in a spreadsheet, a folder or your head?
- Which deadline or document would have cost you money if you had missed it?
- What would make you tell another contractor about this?

## Outreach message (edit to fit)

> Hi [name], I built a tool that keeps a contractor's licenses, insurance, equipment and paperwork in one place and reminds you before anything expires. It works alongside your accounting and job software, it does not replace them. I am looking for a few contractors to use it for 6 weeks at a pilot rate and tell me what is missing. Could I show it to you for 20 minutes this week?

## Risks and what to do

- **They sign up and go quiet:** book the onboarding call before they sign up, and load their real records together.
- **They want accounting or job features:** say plainly it is the administrative layer next to those tools. Log the request, do not build it.
- **Reminder emails land in spam:** set up SPF, DKIM and DMARC before outreach.
- **Real data issues:** the live-site checks are done, but keep the rollback steps written down.

## Done when

- 3 or more pilots active for 4 weeks.
- A clear yes or no from each on paying.
- A list of the top 5 fixes ranked by how many pilots raised them.
- At least 2 testimonials, or a clear reason there are none.
