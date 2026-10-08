# Show Me · Visual AI Everyday Assistant

**Developed by Lulamile Mkhungela.**

> **Show me what you're dealing with. Tell me what you want to do. I'll help you get it done.**

A camera-first, voice-first, action-oriented assistant for everyday life: the washing
machine with too many buttons, the warning light on the dashboard, a flat tyre, the
thick document someone handed you, the ingredients in your fridge.

Point a phone at the thing, ask in your own words, and get back **a task you can
actually do** — ordered steps, a spoken script for both hands busy, a schematic of
the controls, a shopping list, honest safety calls, and real video only when real
video exists.

It works with **no API key at all** (a genuinely useful offline mode), and with your
own key when you want real vision.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:8787
```

That's it. **No key, no account, no login, no card.** You'll land on the camera-first
home screen; the offline demo engine answers real questions about 14 everyday
situations plus a food/ingredient engine.

There is no sign-up because there is nothing to sign up *to*: no database, no server-side
session, no cookies. Your tasks, photos and settings live in your own browser.

To turn on real vision: **Settings → pick a provider → paste a key → Test connection.**
Gemini has the most generous free tier and needs no credit card:
<https://aistudio.google.com/apikey>.

```bash
npm run build && npm start   # production: serve the built app from the same origin
npm test                     # 86 assertions (67 logic + 19 render), no key needed
npm run typecheck            # tsc --noEmit
```

> Running inside a sandboxed preview iframe with no network access? Only the offline
> demo engine is reachable there. Open the app in a normal browser tab to make real
> model calls.

---

## What it does

| Mode | What you get |
|---|---|
| **Analyse** | Photograph or describe the situation → risk level, what it likely is, what to do |
| **DO** | One step at a time, with a *why* on each step, progress kept as you go, auto-spoken when hands are busy |
| **SHOW ME** | Your photo with the controls that were actually located marked on it — plus labelled schematics when a location can't be claimed |
| **READ** | The full guide in two detail levels (quick / in-depth), searchable and copyable |
| **TELL ME** | A spoken script for the job, chunked for natural delivery |
| **WATCH** | Video *only* when real results exist; otherwise precise, clearly-labelled search links |
| **Food** | "I've got eggs, tomatoes, half an onion" → recipes you can actually cook, blockers vs. nice-to-haves, substitutions, cost estimate, shopping list |
| **Troubleshoot** | A decision tree that asks the single most useful next question and escalates honestly |
| **Library** | Saved tasks, your own reusable knowledge, history, stats — exportable, local-only |

All eleven spoken official South African languages are selectable. South African English
and Afrikaans get full voice support in-browser; the rest route to cloud TTS when a key
exists, and the app **says plainly when it cannot speak a language** rather than pretending.

---

## The honesty contract

This app was designed around the failure modes of the tools that came before it
(see [`docs/RESEARCH-AND-VALIDATION.md`](docs/RESEARCH-AND-VALIDATION.md)). Those
rules are enforced in code and asserted in tests, not just written in a promise:

1. **It never marks a photo it cannot see.** If image analysis didn't locate a
   control, no box is drawn on your photo — you get a labelled generic schematic
   instead, and it says so.
2. **It never invents a video.** No fabricated ids, titles or timestamps. Without a
   real YouTube Data API key, you get labelled search links and a plain notice.
3. **Offline mode says it is offline.** It tells you what it analysed and what it
   didn't.
4. **It never inflates what's missing.** Recipes list true blockers and optional
   extras separately.
5. **It says when there is no safe substitute** — and stops, escalates, or tells you
   to get a professional rather than improvising on live electricity, gas or brakes.
6. **No hard-coded model names.** Models are discovered live from the provider,
   filtered to the ones that can actually see, and cached.

---

## How it compares

The research behind this app is **domain research** — whether the problem is real, who
has it, and what the evidence says works. The short version: **6.8–25% of people read the
manual**, ~1 in 6 who do DIY injure themselves, ~27% of adults read below the level
needed for basic written information, and the instruction-science evidence is specific
about what helps (pictures with words, spoken narration with visuals, one learner-paced
step at a time).

The market survey is a separate appendix, because "who else is doing this" is not the same
question as "is this needed or any good": [`docs/PRIOR-ART.md`](docs/PRIOR-ART.md).

The short version of *that*: every camera AI today is **conversation-first** — Gemini Live
streams your camera into a live chat, Copilot Vision shares your screen with a visible
consent border, Be My AI describes a photo in 36 languages. They answer, and the answer
evaporates. None leaves behind a **persisted, followable task**, and none is built to work
when the signal or the data runs out.

So the niche is specific: **the tool that works offline, holds the sequence for you, costs
nothing to try, and keeps your photos on your phone.**

---

## Architecture

```
browser ──┬─ direct route  ──────────────────────────► provider API   (your key, your device)
          └─ server route  ──► /api/ai/complete ────► provider API   (same-origin fallback)
```

One origin, one port (Express + Vite middleware). Every AI call can take either
route, and the app falls back automatically when a failure looks like CORS or
network rather than a bad key. Keys live in **your** browser's `localStorage` and are
forwarded per request; they are never persisted server-side and never logged.

```
src/
  main.tsx  App.tsx          shell, tabs (home · task · library · settings), onboarding
  state/session.tsx          the one owner of session lifecycle
  lib/
    session.ts               the ONLY place that branches real-model vs. offline
    schema.ts                AnalysisResult, normalisers, risk order, Recipe
    prompts.ts               every message the assistant sends
    knowledge.ts speech.ts capture.ts videos.ts images.ts utils.ts store.ts
    ai/  types · providers · json · client     registry, adapters, tolerant JSON, relay client
    demo/ food · scenarios · engine             offline engine: recipes, 14 guides, analysis
  components/  ui · Visuals · Capture · Home · Session · Library · Settings · ChatDock
server/index.ts              express + vite middleware, /api/{health,ai/complete,models,youtube,fetch}
tests/  run.ts (67)  dom.tsx (19, jsdom, drives the real React tree)
public/ manifest.webmanifest · icon.svg · icon-192.png · icon-512.png
docs/RESEARCH-AND-VALIDATION.md   domain research: the problem, the people, the evidence
docs/PRIOR-ART.md                 market survey appendix (not the research)
```

**Provider-agnostic by design.** Google Gemini, OpenAI, Anthropic, OpenRouter, Groq,
Ollama (on-device) and any custom OpenAI-compatible endpoint. Groq is text-only here
because its free tier has no vision models — the app won't pretend otherwise.

---

## Privacy & security

- **No account, no login, no server.** There is no auth layer, no database, no
  server-side session and no cookie — verified by exhaustive search, not by intention.
  The app is fully usable from a cold, anonymous browser.
- **Keys stay yours.** Stored in the browser only. A server-side key in `.env` is an
  optional *fallback*; a key supplied by the browser always wins. Keys are never
  written to logs or returned in responses (`stripRaw` removes raw upstream bodies).
- **Images stay yours.** Analysis sends the image to *your* chosen provider and
  nowhere else. Nothing is uploaded to this project's server beyond the relay you
  opted into. No 30-day retention window, because there is nothing to retain.
- **"Delete everything" actually deletes.** It clears the saved tasks, your knowledge
  notes, your key, the in-memory task, the photos held in it, the chat, and every
  storage key the app has ever written — including older-version keys that would
  otherwise be rehydrated. Asserted in the render tests.
- **The relay can't be used to probe your network.** `/api/fetch` blocks loopback,
  private ranges, link-local (incl. cloud metadata `169.254.169.254`), `::1`,
  `.local` and `.internal`, with a hard timeout. Seven SSRF probes are asserted in
  `tests/run.ts`.
- **No tracking, no accounts, no analytics.** Export or erase everything from
  Settings.

---

## Testing

```bash
npm test            # both suites
npm run test:logic  # 67 assertions: JSON salvage, schema, food engine, scenarios,
                    # demo engine, videos, utilities, knowledge, live server + SSRF
npm run test:dom    # 19 jsdom render tests against the real React tree
```

The render tests drive the real app from the home screen through to a finished task,
and several exist purely to keep it honest and safe: SHOW ME never claims to have marked
a photo it cannot see, WATCH never fakes a video, a wipe really drops the photos held in
memory, and no old API key survives in storage.

Current status: **86/86 passing**, `tsc --noEmit` clean, `npm run build` succeeds
(179 kB gzip), production boot and preview-proxy hosting verified. Real-model paths are
unverified in the sandbox that built this (no key available) — the full account of what
was and wasn't validated, including the checks that *failed* to prove anything, is in
[`docs/RESEARCH-AND-VALIDATION.md`](docs/RESEARCH-AND-VALIDATION.md).

That document also records **where this build is weaker than the research says it should
be** — including the fact that the voice is synthetic when the evidence favours a human
one, and that the many South African languages this app lists cannot yet be *spoken* to
the user.

---

## Environment

`.env` is **entirely optional** — see [`.env.example`](.env.example).

| Variable | Why you'd set it |
|---|---|
| `PORT`, `HOST` | Change the bind (default `8787`, `0.0.0.0`) |
| `NODE_ENV=production` | Serve built `dist/` instead of the dev server |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Server-held key so users never paste one |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` | Same, other providers |
| `YOUTUBE_API_KEY` | Real video results instead of labelled search links |

---

## Deployment

Requires Node ≥ 20. `npm run build && npm start` serves the SPA and API from one
origin on `PORT` — a single process, single container, no separate static host, no
CORS configuration. Anything that terminates TLS in front of it works.

---

## Author

**Lulamile Mkhungela**
Built and maintained as a personal project — the everyday-problem assistant that works
without an account, without a key, and without a signal.

- Repository: <https://github.com/LulamileMkhungela/Visual-AI-Everyday-Assistant>
- Email: <mkhungela.l@gmail.com>

Contributions, issue reports and field notes from real use are welcome. The most useful
thing you can send is a situation the app got wrong: it is designed to say what it
cannot see, so a case where it claimed more than it should is a bug worth fixing.

---

## License

Copyright © 2026 Lulamile Mkhungela. All rights reserved.

This is a private, unlicensed project — see [`LICENSE`](LICENSE). Third-party product
names referenced in the documentation belong to their owners and appear for comparison
only.
