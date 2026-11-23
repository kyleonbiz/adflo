# Demo video

Records a ~1 minute screen walkthrough of AdFlo using a fictional contractor, "Summit Comfort HVAC LLC".
Nothing here is real customer data.

```bash
# 1. Start the app in development mode with sample data (no database needed)
NEXT_PUBLIC_E2E_SEED=1 NEXT_PUBLIC_LIVE_INDUSTRIES=all NEXT_PUBLIC_SUPABASE_URL= \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3200

# 2. Record (writes scripts/demo-video/out/adflo-demo.webm)
DEMO_URL=http://localhost:3200 node scripts/demo-video/record.mjs

# 3. Optional MP4
ffmpeg -i scripts/demo-video/out/adflo-demo.webm -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart scripts/demo-video/out/adflo-demo.mp4
```

Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is not at `/opt/pw-browsers/chromium`.

## Voiceover script (about 60 seconds, matches the footage)

| Time | On screen | Say |
|---|---|---|
| 0:00 | Dashboard | "Running a contracting business means a mountain of paperwork. AdFlo is the administrative management platform that keeps it organized." |
| 0:10 | Needs your attention | "Everything that's late or due soon lands in one place." |
| 0:14 | Licenses & Renewals | "Licenses, insurance and certifications, with the documents you still need and reminders before anything expires." |
| 0:27 | Equipment | "Every tool, truck and unit: serial number, where it's kept, who has it, and when it's due for service." |
| 0:45 | Calendar | "Every deadline, from every part of your business, in one calendar." |
| 0:52 | Invoices | "Track what you're owed and chase overdue payments." |
| 0:58 | Dashboard | "AdFlo works alongside your accounting and project software and handles the administration they don't. Start free at adflo.com." |

Timings drift by a few seconds when the app is slow; adjust the pauses in `record.mjs`.
