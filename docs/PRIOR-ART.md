# Prior art — how the market is already served

**This is an appendix, not the research.** The domain research — whether the problem
is real, who has it, and what the evidence says actually helps — is in
[`RESEARCH-AND-VALIDATION.md`](RESEARCH-AND-VALIDATION.md). This file exists only so a
reader can see where the app sits among existing products. Nothing here drove a design
decision except the four lessons recorded at the end.

Sourced from vendor documentation and third-party write-ups, October 2026. No
competitor was benchmarked hands-on; the claims are theirs and their reviewers'.

---

## 1. Camera-first assistants

| Product | What it does | Documented limits |
|---|---|---|
| **Google Gemini Live** | Streams camera or screen into a live conversation. **Guided Vision** (1 Oct 2026) gives real-time audio description plus proactive verbal reframing cues ("pan slowly to the right"), built with the blind and low-vision community | A conversation: the output is speech held in your head, on a live cloud connection. Nothing persists |
| **Apple Visual Intelligence / Siri AI** | Point at a poster, create calendar events; device access to Messages, Mail, Photos, Calendar; on-device + Private Cloud Compute | Region-gated (notably the EU); acts *on your data*, which a web app cannot |
| **Microsoft Copilot Vision** | Opt-in screen or camera share during a voice conversation; can highlight parts of the shared screen | *"Not an autonomous assistant that can click buttons or operate a PC."* Cloud-bound. Consumer experience sits outside enterprise data protection. Screen input discarded per session, but the voice transcript is kept |
| **ChatGPT Advanced Voice / GPT-Live** | Best-in-class conversation quality | GPT-Live launched **without** camera or screen sharing — video was "coming soon" |
| **Be My AI (Be My Eyes)** | GPT-4V description of a photo, 36–185 languages, free, with a human volunteer behind it | Its **own terms say it can make mistakes and "hallucinate"**; images go to OpenAI and are retained up to **30 days**; requires an internet connection |
| **Seeing AI, Lookout, Envision** | Reading, scene description, object finding tuned for blind and low-vision users | Performance collapses in poor light and on cluttered scenes; varies by device hardware |

**Shared shape:** all conversation-first. The answer arrives, then evaporates.

## 2. Adjacent families

- **Evidence synthesis — Elicit, Consensus.** ~138M / 200M+ papers; extraction tables;
  Consensus Meter. Both charge for *traceability* — links to the exact sentence or
  figure behind a claim.
- **Source-grounded study tools — NotebookLM.** Answers strictly from supplied sources
  with passage-level citations; one source set becomes audio overviews, video overviews,
  mind maps, flashcards, quizzes.
- **Screenshot → artefact — Visily, Uizard, v0.** Reviews are blunt: *"a lookalike, not
  your real interface, so interactions and data still have to be rebuilt"*, and output
  quality drops on niche work (the *average pattern* ceiling). Free tiers are thin
  (Uizard: 3 generations/month).
- **Spatial grounding — Overture, HERE.** *"LLMs return illegitimate URLs for major
  brands 34% of the time."* *"AI can describe the world, but it cannot reliably compute
  how the world works."*

## 3. Where the gap is

| | Gemini Live | Copilot Vision | Be My AI | **Show Me** |
|---|---|---|---|---|
| Output | Spoken conversation | Spoken + highlights | A description | **A task: steps, script, schematic, list** |
| Survives the session | No | No (discarded) | 30-day server retention | **Saved in your browser** |
| Works with no internet | No | No | No | **Yes — labelled offline engine** |
| Account required | Yes | Yes | Yes | **None** |

Every product above is conversation-first. None leaves behind a **persisted, followable
task** — ordered steps with a reason each, a spoken script for both hands busy, a
schematic when a control cannot be located, a shopping list, progress you can hand to
someone else or return to later.

## 4. The four lessons that did drive design

1. **Never draw what you cannot see.** The screenshot-to-wireframe family shows what
   happens when a model redraws from memory: you get a plausible average. Hence a generic
   schematic (`Step.diagram`) instead of a fabricated annotation box — and the schematics
   render even when there is no photo.
2. **Anything fabricable must be structurally unfabricable.** No invented video ids,
   titles or timestamps; no hard-coded model names.
3. **Never let the user hit a dead end** (Be My Eyes' volunteer fallback). Ours is a
   scripted offline engine.
4. **Bound the claim.** The leading vision assistant's own terms admit hallucination.
   Every claim this app makes about a photo is labelled with what it was based on.

---

## Sources

- Guided Vision in Gemini Live (1 Oct 2026): <https://blog.google/innovation-and-ai/products/gemini-app/guided-vision-gemini-live/>
- Gemini Live camera/screen sharing on Android: <https://www.android.com/articles/gemini-on-android/>
- Siri AI vs ChatGPT vs Gemini (iOS 27): <https://andrew.ooo/answers/siri-ai-vs-chatgpt-vs-gemini-app-iphone-ios-27-september-2026/>
- Copilot Vision launch: <https://www.theverge.com/news/685963/microsoft-copilot-vision-windows-launch>
- Copilot Vision privacy boundaries: <https://windowsforum.com/threads/copilot-vision-on-windows-11-opt-in-screen-sharing-with-clear-privacy-boundaries.416490/>
- M365 Copilot Vision limits and retention: <https://windowsforum.com/news/microsoft-365-copilot-vision-adds-screen-sharing-in-july-2026.439300/>
- GPT-Live vs Gemini Live: <https://apidog.com/blog/gpt-live-vs-gemini-live/>
- Be My AI launch: <https://www.maginative.com/article/be-my-eyes-releases-ai-powered-visual-assistant-for-blind-and-low-vision-users/>
- Be My AI hallucination warning and retention: <https://www.kaspersky.com/blog/be-my-eyes-ai-safety-for-visually-impaired/55611/>
- Be My AI terms and human fallback: <https://www.careerpartner.in/from-asking-others-to-asking-ai-how-visual-ai-is-expanding-independence-for-blind-and-low-vision-people/>
- Accessibility tool limits: <https://aithinkerlab.com/ai-accessibility-tools-for-blind-users-2026/>
- Elicit: <https://www.therundown.ai/tools/elicit> · Consensus: <https://www.krishangtechnolab.com/blog/consensus-ai-guide/> · NotebookLM: <https://paperguide.ai/blog/notebooklm-alternatives/>
- Visily / Uizard limits: <https://alloy.app/library/wireframing-software>, <https://uxcrush.com/best-ai-wireframe-generators>
- Overture Maps: <https://overturemaps.org/blog/2026/open-spatial-location-grounding-for-ai/> · HERE: <https://www.traffictechnologytoday.com/news/artificial-intelligence-ai/here-technologies-launches-location-reasoning-to-ground-ai-in-real-world-spatial-data.html>
