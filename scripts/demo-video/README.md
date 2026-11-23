# Demo videos

One short clip per AdFlo module, plus a full tour, recorded from the real app with a fictional contractor
("Summit Comfort HVAC LLC"). Nothing here is real customer data.

| Script | What it does |
|---|---|
| `seed.mjs` | The fictional contractor's licenses, invoices, contacts, vendors and projects. |
| `scenes.mjs` | One scene per module: what to click and type, and the caption text. Edit this to change a video. |
| `record.mjs` | Drives the app with Playwright and records `out/<module>.webm`, with caption times measured live. |
| `build.mjs` | Adds a title card, captions and an end card: `out/final/<module>.mp4` and `out/final/adflo-tour.mp4`. |

```bash
# 1. Start the app in development mode with sample data (no database needed)
NEXT_PUBLIC_E2E_SEED=1 NEXT_PUBLIC_LIVE_INDUSTRIES=all NEXT_PUBLIC_SUPABASE_URL= \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3200

# 2. Record every module (or name some: record.mjs licenses equipment)
DEMO_URL=http://localhost:3200 node scripts/demo-video/record.mjs

# 3. Build the finished videos (about 6 minutes for everything; name modules to build only those)
node scripts/demo-video/build.mjs
```

Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is not at `/opt/pw-browsers/chromium`. Set `DEMO_CTA` to change the
end-card button text (default "Start free at adflo.com"). Needs ffmpeg and the Inter font.

The clips have captions and no audio. Record a voiceover from the caption text in `scenes.mjs` and lay it over
the clip in any editor.

## Notes
- Addy runs on its built-in rules here, so the clip shows the draft flow (Addy opens a form to review), not AI answers.
- Equipment and Activity scenes add records on camera, so those records only exist for that recording.
