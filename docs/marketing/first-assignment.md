# AdFlo AI Marketing Department: First Assignment (CMO memo)

Prepared 2026-11-27. Based on a read of adflo.pro (home, /partners, /privacy, /signup, robots.txt, sitemap.xml) and the repo (README, pilot plan). Competitor and market claims below are **hypotheses for the Research agent to verify**, not findings; I have not researched them yet.

---

## 0. Where I disagree with the brief (read this first)

1. **Ten agents on day one is too many.** An agent is a prompt, a data source and a schedule. The real cost is *your review time*. Launch 5 active agents (CMO, Research, Brand/Content, SEO/Analytics, Partnerships). Social, Acquisition and Retention start as modes of those agents and split out when there is volume (Retention when there are about 15 paying accounts).
2. **"Prioritize scalable channels over individual outreach" is wrong for the first 20 customers.** Until the ICP and the message are proven, founder-led outreach to 100 well-chosen contractors teaches more than any campaign. Scalable channels (SEO, partners, referral) are built *in parallel*, but the first customers come from direct conversations. Automation should make that outreach cheaper (research, drafts, lists), not replace it.
3. **The relay race in section 4 is too linear.** Research, then Brand, then Content, then SEO and so on would take weeks per cycle. Run it as a weekly sprint on **one trade at a time** with agents working in parallel from a shared brief.
4. **$100K ARR in 365 days is a stretch target, not a base case** (math in section 3). Plan for about $80K, push for $100K.
5. **Naming.** The brief says "administrative operations platform." The site, privacy policy and `CLAUDE.md` all say **"administrative management platform."** I use the latter everywhere, and the Brand agent enforces it. Likewise the brief says "inventory management"; the repo's positioning says **equipment and asset tracking** (tools, vehicles, appliances, HVAC units, keys), not an inventory system.
6. **Facebook and LinkedIn are not equal.** Skilled-trades owners live on Facebook groups, YouTube, Reddit and in supplier and association circles. LinkedIn is the right channel for *partners, consultants, bookkeepers and association staff*, not for most owners. Hypothesis to test in the first 30 days.

---

## 1. Review of the current website and positioning

### What is working
- **Positioning discipline is unusually good.** The "not a CRM, not an ERP, not accounting; the administrative layer alongside them" line is repeated on the home page, /partners and pricing. Compliance wording is careful ("organized and aware," "does not guarantee compliance"). Keep it.
- **Clear pricing on the page:** $99 including one seat, $10 per extra seat, $990 per year, "a team of 5 pays $139." Few competitors are this transparent.
- **Addy with explicit guardrails** (never deletes, approves, pays, sends or signs). A trust differentiator and a good story for "AI that doesn't go rogue."
- **A /partners page already exists** with sensible partner types.
- **Privacy is a feature:** no ad cookies, no third-party analytics, no pixels.

### Strongest marketing opportunities
1. **The cost of a missed renewal is a concrete, emotional hook.** A lapsed license, a certificate of insurance that expired before a job, an uninsured vehicle. "Know what expires before it costs you a job" is a much stronger contractor message than "organize your administration."
2. **The true competitor is the status quo** (spreadsheets, a shared drive, a glovebox, the owner's head, the spouse who does the books), not another SaaS. That is a cheap, content-friendly market to educate.
3. **Partner-led distribution.** Bookkeepers, insurance agents (they chase certificates of insurance and renewals), trade associations and supply houses already sit on the pain and already talk to hundreds of contractors. One good partner is worth 20 cold leads.
4. **Per-trade, per-state search intent** (for example "[state] electrical license renewal reminder," "certificate of insurance tracker for subcontractors," "tool and vehicle tracking for small contractors"). Low volume each, low competition, high intent, and the site has none of these pages.
5. **Property managers as a second wedge** (vendor insurance, HVAC units, keys, inspections). The site already serves them; keep as phase two so the message does not blur.
6. **Addy as a demo hook.** "Invoice Acme $1,200 due Friday" is a 10-second clip that sells.

### Weaknesses (be honest)
| # | Weakness | Why it matters | Fix |
|---|---|---|---|
| 1 | **Site has 3 indexable pages** (/, /partners, /privacy). Nav items are in-page anchors; no /pricing, /features, per-trade pages, blog, about or terms. | There is almost nothing for Google to rank or for a partner to link to. | Build per-trade landing pages, a real /pricing page, a resource hub, /about, /terms. Highest-leverage SEO work. |
| 2 | **3-day, no-card trial.** | Value shows up *after* records are loaded (the pilot plan assumes a 45-minute onboarding call). Three days is too short for a renewal-tracking tool. Most trials will expire before the owner has uploaded a single license. | Test a longer trial or "trial plus assisted load." This is a product decision for you; I recommend an experiment, not a unilateral change. |
| 3 | **Audience blur.** The home page "Who it's for" lists operations managers, administrative departments, multi-department organizations, professional services. The demo form offers 201 to 1,000+ employee sizes. | Dilutes the contractor focus and invites enterprise leads you cannot serve at $99. | Contractor-only language on the home page; move other segments to later pages; trim company-size options. |
| 4 | **"Schedule a demo" as a primary CTA** on a $99 self-serve product. | A human demo for every lead does not scale and caps growth at your calendar. | Self-serve first; demo offered as guided onboarding for qualified leads. |
| 5 | **No social proof.** No testimonials, logos, numbers or case studies. | The biggest conversion lever for a trust-based product with unknown brand. | Make pilots produce testimonials and one short case study (the pilot plan already asks for them). |
| 6 | **Generic copy** in places (the templated "Best for" lines, "Work smarter. Get more done." on signup/login, "Better-controlled operations"). | Reads like every SaaS. | Brand agent rewrite toward contractor-specific, concrete language. |
| 7 | **"Priority support" and onboarding offered as included features** with a one-person team. | Promise-capacity mismatch. | Confirm you can deliver, or reword. |
| 8 | **Invoicing is the product feature closest to accounting.** | Risks pulling positioning toward QuickBooks territory, which the brief says to avoid. | Never lead with invoices in marketing; keep them under "administrative documents." |
| 9 | **Measurement conflicts with the privacy policy** ("no third-party analytics or tracking cookies"). | A standard GA4 and ad-pixel setup would contradict your own policy. | Use privacy-friendly or first-party measurement (section 5). This is a real constraint on the Analytics agent. |
| 10 | **Onboarding fee of $300 to $500** sits next to a "free trial, no card" message. | Friction and mixed signals. | Keep it optional and framed as "we load your records for you." Consider waiving for the first 10 customers. |

---

## 2. Positioning guardrails (enforced by the Brand agent on every asset)

- **One-line definition:** "AdFlo is the administrative management platform for contractors: your licenses, insurance, equipment and paperwork in one place, with reminders so nothing lapses. It works alongside your accounting, payroll and project software."
- **Always:** administrative management platform; administrative layer; works alongside; organized and aware of deadlines; equipment and asset tracking.
- **Never:** CRM, ERP, accounting, bookkeeping, inventory system, job management, field service, "guarantees compliance," "never miss a deadline," legal or tax advice, "Business Administrative Services," and any invented stat or testimonial.
- **Hard rule:** if a draft makes AdFlo sound like a replacement for QuickBooks, Jobber, ServiceTitan or Procore, the Brand agent rejects it. A banned-phrase lint plus an LLM reviewer runs before anything reaches you.

---

## 3. Revenue math from your actual pricing

Pricing: $99/month includes 1 seat; +$10/month per additional seat. Annual: $990 + $100 per extra seat.

| Average seats per account | Revenue per account / month | Accounts for $100K ARR (MRR $8,333) |
|---|---|---|
| 1 (solo) | $99 | 85 |
| 3 | $119 | 70 |
| 3.5 (planning assumption) | $124 | **67** |
| 5 | $139 | 60 |

Annual-plan discounts (two months free) shave about 1 to 2 accounts' worth off the real number. **Planning figure: about 70 paying accounts at about 3.5 seats.** Seats are a weak lever (a seat adds $10): one extra *account* is worth about 12 seats, so marketing should chase accounts, not seat expansion.

### Scenarios (model: 3% monthly churn, ARPA $124, gross adds per month)
| Scenario | Gross adds, months 1 to 12 | Accounts at day 365 | ARR at day 365 |
|---|---|---|---|
| **Stretch** (what $100K needs) | 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12 (88 total) | about 78 | about $117K (crosses $100K in month 11) |
| **Base** (about 70% of stretch) | roughly 60 total | about 55 | about $82K |
| **Floor** (about 50%) | roughly 44 total | about 39 | about $58K |

### Milestones
| Day | Paying accounts (stretch / base) | ARR (stretch / base) | Non-revenue milestone |
|---|---|---|---|
| 30 | 1 to 2 / 1 | about $1.5K | ICP defined; pilots live; measurement in place; first 3 trade pages published |
| 60 | 4 / 3 | about $6K / $4K | 3 pilots paying; 2 testimonials; 10 partner conversations; first organic impressions |
| 90 | 8 / 6 | about $12K / $9K | 1 active partner sending referrals; repeatable outreach loop; 10+ indexed pages; weekly digest running |
| 180 | 25 / 17 | about $37K / $26K | 3 to 5 active partners; 20+ pages; first non-brand search signups; documented trial-to-paid funnel |
| 365 | 67 to 78 / 55 | $100K+ / about $82K | Organic and partner channels produce more than half of new accounts; logo churn under 3% per month |

### Funnel this implies at about 12 new accounts/month (month 12)
At 15% trial-to-paid (needs assisted onboarding) and 3% visitor-to-trial: about 80 trials per month, about 2,700 qualified visits per month. Believable only by month 9 or later through partners plus SEO. Before that, the numbers come from direct conversations.

### Unit economics guardrails
- Target blended CAC under **$300** (include your time at a stated hourly value); payback under 3 months.
- Illustrative LTV at 3% monthly churn and about 85% gross margin: about $3.5K. Churn is the number to defend: 5% churn cuts that to about $2.1K and makes $100K ARR need about 40% more gross adds.
- **Paid ads: off** until a channel has a proven landing-page conversion rate and a payback under 3 months. A test budget cap of $300 per month, only with your approval.

---

## 4. Department structure

```
                         YOU (Founder / Board)
              approves: publishing, outreach, spend, pricing, commitments
                                  |
                        CMO AGENT (weekly plan, priorities, conflicts, exec report)
        ______________________|______________________________________
        |                |                  |                  |
  INTELLIGENCE       POSITIONING &      DEMAND              FEEDBACK LOOP
  Market Research    CONTENT            SEO & Organic       Analytics (always on)
  Agent              Brand Agent        Partnership/BD      Retention & Success
                     Content Agent      Acquisition         (later)
                     Social/Community   (later split)
                     (later split)
```

**Phase 1 (days 1 to 90) runs 5 active agents:** CMO, Research, Brand+Content, SEO+Analytics, Partnerships. Acquisition work (conversion, outreach plans) is a mode of CMO+Partnerships; Social is a mode of Content (drafts only, you post); Retention is a mode of Analytics until there are about 15 accounts.

### Shared operating system (all agents)
- **Shared memory:** one Supabase schema (`mkt_*` tables) in the existing project or a separate one: `mkt_briefs`, `mkt_findings`, `mkt_content_items`, `mkt_prospects`, `mkt_experiments`, `mkt_metrics_daily`, `mkt_approvals`, `mkt_runs`. Agents read each other's outputs from here, not from chat.
- **Every initiative has a one-page brief:** objective, metric, target, owner agent, deadline, cost, approval needed, kill criterion. No brief, no work. (This implements "every campaign must have a purpose.")
- **Approval queue:** every outward action enters `mkt_approvals` with status `draft`, `approved`, `rejected` or `done`. Nothing leaves without `approved`. A good home for the UI is the existing Control center.
- **Evidence rule:** every claim in an asset carries a source link or is marked "internal assumption." No invented statistics, testimonials or customers.
- **Weekly cadence:** Mon research and monitoring run; Tue CMO plan; Wed to Thu production; Fri digest and your approval session (about 60 to 90 minutes per week is the budget).

### Agent charters

**1. CMO.** *Mission:* turn $100K ARR into monthly objectives and the right weekly work. *Outputs:* quarterly and monthly objectives, weekly priority list (max 5), resource allocation, conflict log, weekly exec summary, monthly strategy review. *Decision rules:* kill an initiative that misses its kill criterion twice; reject work with no metric; resolve conflicts (for example Content wants volume, Brand wants precision) with a written recommendation to you. *KPIs:* percent of initiatives with metric and target (100%), plan-versus-actual on milestones, spend versus budget. *Authority:* none external.

**2. Market Research & Intelligence.** *Mission:* actionable intelligence, not reports. *Standing work:* top 10 admin pains per trade with sources (forums, Reddit, Facebook groups, state licensing board pages, association guides); competitor and substitute map (spreadsheets, Drive, Jobber/Housecall Pro/ServiceTitan add-ons, certificate-of-insurance trackers, asset trackers; verify each); state-by-state license and insurance renewal rules for target states; segment sizing; monthly trend note. *Output format:* every finding ends with "So what for AdFlo" and a recommended action. *KPIs:* findings adopted by other agents per month; interview leads generated. *Guardrail:* no scraping behind logins, no private groups, respects terms of service and robots.txt.

**3. Brand & Positioning.** *Mission:* one voice; contractor-specific messaging. *Outputs:* messaging house (ICP, problem, promise, proof, objections), per-trade value propositions, claim library with approved wording, banned-phrase list, review verdict on every asset (pass, revise, block). *KPIs:* percent of assets passing first review; message-test results (A/B on trade pages and outreach). *Guardrail:* the section 2 rules; compliance wording is always "organized and aware," never "guaranteed."

**4. Content Marketing.** *Mission:* useful first. *Outputs:* 2 pillar guides per month, 4 short how-tos, per-trade checklists (license renewal calendar, subcontractor insurance file checklist), email onboarding content, release notes. Social derivatives come from the same piece. *Gate:* a piece only gets written if it has a target query or a named distribution channel (SEO brief or partner use). *KPIs:* organic entrances per piece at 90 days; signups attributed; partner reuse. *Guardrail:* no state-specific legal claims without a linked source; add "check your state board" language.

**5. SEO & Organic Growth.** *Mission:* make AdFlo findable by contractors who search for administrative help. *Outputs:* keyword and intent map (trade x state x problem), page plan with priority order, technical fixes (sitemap with real pages, titles, meta, schema, internal links), monthly opportunity list from Search Console. *KPIs:* indexed pages, non-brand impressions and clicks, signups from organic. *Expectation:* 6 to 9 months to meaningful traffic; the first 90 days are about shipping the pages.

**6. Social Media & Community.** *Mission:* earned presence, not noise. *Outputs:* a calendar of 2 to 3 posts per week (Facebook, LinkedIn, YouTube shorts if you will record), a list of communities with rules summary, daily "worth replying to" digest of threads (you or a human replies). *Hard rules:* no auto-posting, no fake accounts, no comment-bombing, no link-dropping in groups that ban it, disclose affiliation. *KPIs:* saves and shares, profile visits, referral signups; not follower count.

**7. Partnerships & Business Development.** *Mission:* reach networks of contractors. *Priority partners:* bookkeepers and accountants serving trades, commercial insurance agents, trade associations and local chapters, supply houses, trade schools, licensing-exam prep providers, contractor coaches and educators. *Outputs:* ranked prospect list with fit rationale and a named contact role, tailored partner pitch, co-marketing ideas (checklists, webinars, a "renewal calendar" co-branded), referral terms *proposal* for you to decide. *KPIs:* conversations, active partners, referred signups and paid accounts per partner. *Guardrail:* proposes only; terms, money and exclusivity are yours (the site already promises referral terms are "in writing, never assumed").

**8. Customer Acquisition (mode, then own agent).** *Mission:* convert attention into trials into paid accounts. *Outputs:* conversion audit of the home page and signup flow, a trial-to-paid experiment backlog (trial length, assisted onboarding, "load my first 10 records" prompt), outreach scripts, demo flow, lead lists from public business data. *KPIs:* visitor to trial, trial to activated (15 or more records in week 1, matching the pilot plan), activated to paid, CAC. *Guardrail:* no sending without your approval; respect CAN-SPAM and local rules; opt-out in every message.

**9. Customer Retention & Success (starts at about 15 accounts; before that, Analytics runs the checks).** *Mission:* keep accounts and grow adoption. *Outputs:* onboarding sequence, activation checklist, cancellation-reason survey and churn tags, at-risk signals (no login in 14 days, no records added, no reminders opened), educational resources. *KPIs:* week-1 activation, 30-day retention, monthly logo churn under 3%.

**10. Marketing Analytics.** *Mission:* one honest scoreboard. *Outputs:* weekly digest (traffic, signups, activation, paid, MRR, CAC, per-channel results, anomalies), experiment readouts with a recommendation, underperforming-channel flags. *KPIs:* data freshness; every initiative has a measured result. *Guardrail:* privacy-first measurement only (section 5).

---

## 5. Technology stack (lean, target under about $150/month before paid acquisition)

| Need | Recommendation | Cost | Note |
|---|---|---|---|
| Agent runtime | Claude scheduled tasks / Claude Agent SDK jobs, one prompt per agent | usage-based | You already run Claude Code sessions. Start with scheduled tasks; move heavy jobs to the Agent SDK later. |
| Shared memory and approval queue | Supabase tables (`mkt_*`) plus a Control center page | $0 incremental | Dogfoods AdFlo's own admin UI. |
| Hosting and site | Existing Next.js on Vercel | existing | Add pages and a content section (MDX) in the same repo. |
| Web analytics | Privacy-first and cookieless (Plausible or self-hosted Umami) plus first-party events in Supabase (signup, record added, activation) | about $0 to $19 | Consistent with the privacy policy. **Do not** install GA4 or ad pixels without updating the policy. |
| Search data | Google Search Console and Bing Webmaster Tools; Google Keyword Planner | free | Add a low-cost Ahrefs/Semrush seat only when free data stops answering questions. |
| Email | Existing Google Workspace for 1:1 sending; a transactional or newsletter tool (for example Resend or Buttondown) for lifecycle email | $0 to $20 | Do not cold-blast from the main domain. If cold outreach scales, use a separate sending domain with your approval. |
| Prospect tracking | Supabase table or Google Sheets (connector available) | $0 | Internal pipeline only, not a product feature. |
| Social scheduling | Buffer or Meta Business Suite free tiers, drafts only | $0 | You press publish. |
| Billing and revenue data | Your billing provider's reporting (confirm which: I did not see this) | existing | Needed for true MRR, churn, CAC. |
| Competitor monitoring | A scheduled fetch-and-diff of competitor pricing and changelog pages, plus search alerts | $0 | Public pages only. |
| Reporting | Weekly digest as an email and a Control center page | $0 | |

---

## 6. Automation matrix

**Automate fully (internal only, no external effect):** scheduled research runs; competitor page diffs; Search Console opportunity pulls; keyword clustering; content briefs; first drafts; brand and claim linting; prospect list building from public sources; weekly KPI digest; experiment readouts.

**Automate to a draft, you approve (anything leaving AdFlo):** blog posts and site pages (publish); social posts; partner pitches and outreach emails; lifecycle emails; community replies; press or directory submissions; testimonials and case studies (also need the customer's written OK).

**Stays under your control:** pricing and discounts; any money spent; partner terms, referral percentages, exclusivity; claims about compliance, security or legal effect; customer data usage in marketing; hiring contractors or agencies; brand identity changes; anything that commits AdFlo.

### What to automate first (ranked by value per effort)
1. **Weekly marketing digest** (needs signup and activation events first). It is the CMO's heartbeat.
2. **Measurement plumbing** (privacy-first analytics plus Supabase events). Nothing else can be judged without it.
3. **SEO opportunity and keyword map**, then content briefs. Feeds the longest-lead channel.
4. **Partner and prospect list builder** with fit scoring (feeds your direct outreach).
5. **Competitor and trend monitor** (weekly).
6. **Content drafting pipeline** with Brand lint.
7. Social drafting and community digest.
8. Retention signals (once accounts exist).

---

## 7. First 90 days

Ideal customer profile for the first sprint (from the pilot plan): owner-operated contractors with 2 to 15 people in trades with licensing and insurance burdens (electrical, HVAC, plumbing, roofing, general and remodeling). **Pick 1 trade and 1 to 2 states** for the first wave, then expand. I recommend the trade with the heaviest license and insurance renewal burden and an accessible association, to be chosen by Research in week 1.

### Days 1 to 30: Foundation
| Initiative | Owner | Measurable objective |
|---|---|---|
| Define ICP and the first trade/state wedge; 15 customer-discovery conversations | Research + you | ICP one-pager; 15 calls; ranked top 10 pains |
| Run the pilot plan (3 to 5 contractors) | You + Acquisition | 3 pilots onboarded; at least 15 records each in week 1 |
| Measurement | Analytics | Signup, activation and paid events live; privacy-compliant dashboard; baseline numbers |
| Messaging house and claim library | Brand | Approved by you; banned-phrase lint running |
| Site fixes: real /pricing, 3 trade landing pages, /about, /terms, sitemap and metadata, trimmed audience copy, demo-form sizes | SEO + Brand + Content | Pages live; sitemap lists 8+ URLs; Search Console verified |
| Trial experiment decision (3 days vs longer vs assisted load) | Acquisition + you | Decision memo with the data to review at day 60 |
| Competitor and substitute map; state renewal-rule sheet | Research | Verified, sourced; shared via `mkt_findings` |
| Partner target list (top 50) and pitch | Partnerships | 50 ranked; 10 pitches approved |
| Weekly digest v1 | Analytics + CMO | Delivered every Friday |

### Days 31 to 60: First proof
| Initiative | Owner | Measurable objective |
|---|---|---|
| Founder-led outreach to 100 ICP contractors (agent-researched lists, your-approved messages) | Acquisition + you | 100 sent; reply rate above 10%; 15 trials started; 3 paying |
| Partner outreach: 10 conversations | Partnerships + you | 10 conversations; 2 agree to a pilot (checklist, webinar, intro) |
| 2 pillar guides and 4 how-tos, each tied to a query or partner use | Content + SEO | 6 published; indexed within 14 days; each has a named distribution plan |
| First case study and 2 testimonials from pilots | Content + you | Written permission; published |
| Social and community presence (2 to 3 posts per week, 3 to 5 target communities) | Social/Content | Posts live; zero spam flags; track referral signups |
| Trial-to-paid experiment 1 | Acquisition | Statistically meaningful readout or extend to day 90 |
| Competitor monitor automated | Research | Weekly diff arrives without prompting |

### Days 61 to 90: Make it repeatable
| Initiative | Owner | Measurable objective |
|---|---|---|
| Add trade 2 (or state 2) pages and outreach using the proven template | All | Same playbook, less effort per output; track time per asset |
| First active referral partner | Partnerships | At least 1 partner sending referrals; at least 3 referred trials |
| Conversion work on home, signup and onboarding (copy, first-run checklist, onboarding email series) | Acquisition + Retention | Trial-to-activated up at least 25% vs baseline |
| SEO expansion: trade x problem pages and a hub | SEO + Content | 10+ pages indexed; first non-brand impressions growing week over week |
| Retention basics: cancellation survey, at-risk flags | Analytics | Active before account 15 |
| Day 90 review: scorecard and channel decision | CMO | Kill, keep or double down on each channel; revised 6-month plan |

**Day 90 targets:** 6 to 8 paying accounts, about $9K to $12K ARR, 1 active partner, 10+ indexed pages, one repeatable outreach loop, documented trial-to-paid rate. **Spend: about $0 to $150 per month**, no paid ads.

### Kill criteria (examples)
- A channel with 30 or more touches and no reply or trial is paused and re-diagnosed.
- A content piece with no organic or partner use by day 90 is not followed with more of that type.
- A partner with no referral after 60 days of active support drops to low priority.

---

## 8. What I need from you (to start Week 1)

1. How many pilots and paying customers exist today, and any early revenue? (This resets the milestones.)
2. Which billing provider is live, and where do signups and activation events get recorded today?
3. Which trade and which state(s) should we aim at first? (If no preference, Research recommends one in week 1.)
4. How many hours per week can you give to approvals and outreach? (I planned for 60 to 90 minutes of approvals plus a few outreach hours.)
5. Are you willing to test a longer trial or assisted onboarding? It is the largest conversion lever I see.

Nothing will be published, sent, spent or committed without your explicit approval.
