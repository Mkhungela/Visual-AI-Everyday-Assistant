# Research & validation

**Project:** Show Me · Visual AI Everyday Assistant
**Date:** 2026-10-07
**Question this document answers:** *is this problem real, who actually has it, what does
the evidence say helps — and does the thing we built hold up?*

**Scope note.** This is **domain research**: the problem, the people, the measured
effectiveness of different ways of instructing someone, and the risks of telling people
things that are wrong. It is deliberately *not* a product comparison — a survey of
competing apps answers "who else is in the market", not "is this needed or is it any
good". That market survey is kept separately in [`PRIOR-ART.md`](PRIOR-ART.md), where it
belongs, and it did not drive the design.

---

## 1. Method

1. **Establish the problem from instruction-design research** — do people actually use
   written instructions for everyday things, and what happens when they don't? (§2)
2. **Establish the stakes** — what does it cost when an ordinary person attempts a
   physical task without adequate guidance? (§3)
3. **Establish who is affected** — population literacy and numeracy data, not anecdotes
   about "some users" (§4)
4. **Establish what works** — controlled experimental evidence on instruction design,
   with effect sizes, and map each finding onto a concrete UI decision (§5)
5. **Establish the risk of getting it wrong** — the automation-bias, miscalibration and
   sycophancy literature, and warning-symbol comprehension research (§6–7)
6. **Establish the operating constraints** — connectivity and data economics in South
   Africa specifically (§8)
7. **Check the build against all of the above, including where it contradicts it** (§9–11)

Sources are listed in §13. Where a figure comes from a secondary compilation rather than
the primary study, it is described as such.

---

## 2. Is the problem real? The instruction-delivery evidence

### 2.1 People do not read the instructions

This is one of the best-established findings in human factors, and it is not a small
effect:

| Finding | Study |
|---|---|
| **Only 6.8%** of 221 surveyed vehicle owners claimed to have read their owner's manual in full; 5.2% had read 90–100% of it | Leonard & Kames (2000) |
| ~**60%** read their owner's manual at all — and of those, the majority read about **half** of it | Mehlenbacher, Wogalter & Laughery (2002) |
| Consumers read manuals only about **25%** of the time, across surveys of 170 people over seven years plus a six-month diary study | Blackler, Gomez, Popovic & Thompson, *"Life Is Too Short to RTFM"* |
| Median self-reported use of a printed manual to solve a computer problem: **0%**; users preferred asking a colleague or experimenting; **10.5% gave up entirely** | Smart et al., *"Why don't people read the manual?"* (25 in-depth interviews) |

The *Life Is Too Short to RTFM* study also found younger and more educated users were
**less** likely to read the manual at all — so this is not a literacy story on its own,
it is a **behavioural** one. Its summary line is the design brief for this entire
project:

> "The amount of effort needed to learn a feature is not commensurate with its utility."

A synthesis of **4,947 usability study sessions** reaches the same conclusion and makes
the design implication explicit:

> "If safe use depends on users carefully reading several pages of instructions before
> beginning, the design itself may deserve closer scrutiny."

### 2.2 When they do read them, the instructions fail

Not reading is only half of it. The manuals themselves are measured as ineffective:

- **~80% of traditional user manuals are judged ineffective**; 85% of consumers call
  clear instructions "very important", yet **46% say paper instructions did not make
  tasks easier** to complete (BILT, metrics review).
- Of users who engaged with a manual, **27.8% said the technical language was too
  complicated**, 24.0% said the content was incomplete, 24.3% said the important
  information was presented *implicitly* rather than explicitly, and 20.7% blamed the
  structure (MDPI, *Electronics* 12(17):3539, 2023 — smart wearables).
- **63% of test participants blamed themselves** when they could not find something in a
  manual (Jansen & Balijon, cited in the same review).
- Two-thirds of consumers have **decided against buying a product** because they were
  apprehensive about assembling it — citing complex assembly, hard-to-understand
  instructions, and fear of wasting time and money (BILT).
- Manuals are written by engineers and lawyers for the manufacturer, not by and for the
  user; they make incorrect assumptions about what users need and use terminology
  inconsistent with the product's own interface (Smart et al.; Blackler et al.).
- **The more complex the device, the more the manual is needed** — and the more likely
  the user is to have to explore instead (MDPI 2023).

### 2.3 It fails hardest for older adults and people with reading or cognitive difficulty

- Older adults and people with cognitive disabilities fail at these tasks through
  **memory, attention and comprehension** limits: forgetting an action performed a moment
  earlier, losing attention when switching between the product and the manual, and
  difficulty understanding the explanations themselves. Small font size alone excluded
  some older participants (Instruction Manual Usage study, younger / older / cognitive
  disabilities).
- Symbol usage in manuals was found **actively confusing** for users unfamiliar with the
  product or the symbols — they were "likely to be misguided", with older and disabled
  groups worst affected.
- Repeated failure had a **demotivating** effect: participants gave up and blamed
  themselves.
- Assistive-technology users report that photos taken without visual feedback are
  frequently blurred, badly framed, or **missing the object entirely** — so even the
  camera-first premise has to survive bad input (§7).

**Conclusion for this project:** a design that hands the user a text wall and expects
them to read it first is not a neutral design; it is the one that the evidence says
fails. That is the single most important reason this app is camera-first, step-at-a-time,
and voice-capable rather than a searchable article.

---

## 3. The stakes: what happens without adequate guidance

Injuries are the reason "just let them figure it out" is not an acceptable fallback.

**United Kingdom**

| Measure | Figure |
|---|---|
| Adults who did DIY / home improvement in the past year | **64%** |
| Of those, who injured themselves | **~1 in 6 (17%)** |
| Attend A&E weekly following a DIY injury | **~300** |
| Of those injured: attended A&E / needed an ambulance | 26% / 5% |
| Annual NHS cost, hospital visits alone | **~£222 million** |
| Victims with long-term damage / unable to work ≥1 year | 12% / 6% |
| Ladder accidents at home | ~48,000 A&E attendances/yr; ~6,000 hospitalisations/yr (RoSPA) |
| Serious injuries from electrical work (2017/18) | **315** |
| Voltage that can cause serious injury / current that can be fatal | **as low as 50 V** / as little as 100 mA |

*(Compiled from National Safety Council Injury Facts data and RoSPA figures.)*

**United States**

- The Consumer Product Safety Commission recorded **35.9 million medically consulted
  injuries from preventable home accidents** in a single year.
- **~193,815 emergency room visits** from ladders in one year; a separate estimate puts
  ladder injuries at ~500,000/yr with ~300 fatalities, the majority from falls of **10
  feet or less**.
- **~30,000 garage door injuries annually.** Garage door springs are the leading cause of
  serious harm and about 30% of garage door repairs involve broken springs. One published
  case series documented **seven patients with severe open-globe eye injuries, six of
  whom lost significant vision**, all while attempting to repair their own garage door.
- **Falls are the leading cause of DIY injury** (2,103.5 injuries per 100,000), followed
  by stairs/ramps/floors (825.5) and — notably for an app that must recognise a hazard —
  **poisoning** (522.6).
- Home-improvement projects accounted for **3% of all emergency room visits** in 2020,
  the highest rate in a decade.

**Australia (Victorian Injury Surveillance Unit, 2-year period)**

- 12 ladder-related deaths and **5,004 hospital-treated injuries**.
- **~70% of hospital-treated ladder injuries occurred in the home**, most often men in
  their 60s–80s doing home maintenance, painting or clearing gutters.
- **43% of hospital admissions** for ladder falls were aged 60+.
- Fractures accounted for 58–62% of admissions. *"Several cases involved unsafe
  ladders/scaffolding or unsafe ladder use practices."*

**Conclusion for this project:** the categories where a confident but wrong answer does
the most damage are exactly the categories an everyday assistant will be asked about —
electricity, ladders/height, gas, brakes, garage-door springs, vehicle jacking. That
justifies `stop`/`escalate` flags as a **structural** feature rather than a disclaimer,
and it means "I am not going to talk you through this one" is a *successful* outcome.

---

## 4. Who is affected? Population evidence

The "user who can't follow the manual" is not an edge case.

**OECD, Survey of Adult Skills (PIAAC), Cycle 2 (2023)**

- On average, **27% of adults perform at or below Level 1 in literacy** — the level
  described as *difficulty with basic written information*.
- **~1 in 5 adults (21.8%)** in the EU lacks basic proficiency in **both** literacy and
  numeracy (Education and Training Monitor 2025).
- Literacy proficiency has **declined** over the past decade and numeracy has stagnated;
  skill inequalities have widened. This is getting worse, not better.

**South Africa (Stats SA General Household Survey, 2022, via DHET fact sheet)**

- Adult illiteracy rate **10.2%** — approximately **3.9 million adults** aged 20+.
- Highest among Black African adults (**11.6%**), concentrated in North West, Eastern
  Cape and KwaZulu-Natal.
- A further large share are *functionally* literate but not equipped to follow dense
  technical prose — note that "literate" is defined as being able to read and write "a
  short simple statement about their everyday life", which is a long way from a technical
  manual.

This matters for two concrete design decisions, both of which the HCI4D literature
below supports:

1. **Writing is the fallback, not the primary channel.** Spoken instructions and imagery
   carry the load; text exists for verification and re-reading.
2. **Instructions must be usable by someone who is not a native speaker of the
   instruction language.** South Africa has twelve official languages including South
   African Sign Language; English is the first language of a minority. Technical
   vocabulary is a documented failure point (§5.3).

---

## 5. What actually works? The instruction-science evidence

This section is the reason the app is shaped the way it is. Richard Mayer's cognitive
theory of multimedia learning rests on three assumptions — two separate channels
(auditory/visual), each with limited capacity, and learning as active processing rather
than passive receipt — and has been tested in **over 200 experimental comparisons**, from
which 15 principles are derived. Mayer's own reported effect sizes:

| Principle | What it says | Effect size | Replications |
|---|---|---|---|
| **Multimedia** | Words **+ pictures** beat words alone | **d = 1.35** | 13/13 |
| **Temporal contiguity** | Spoken words and visuals at the same time, not in sequence | **d = 1.31** | 8/8 |
| **Modality** | Graphics + **spoken** narration beat graphics + on-screen text | **d = 1.00** | 18/19 |
| **Personalisation** | Conversational tone beats formal tone | **d = 1.00** | 13/15 |
| **Coherence** | Remove extraneous material | **d = 0.86** | 18/19 |
| **Spatial contiguity** | Related words and pictures close together | **d = 0.82** | 9/9 |
| **Pre-training** | Teach the names of the key concepts first | **d = 0.78** | 10/10 |
| **Voice** | A friendly human voice beats a machine voice | **d = 0.74** | 6/7 |
| **Signalling** | Arrows, highlights and cues that guide attention | **d = 0.69** | 15/16 |
| **Segmenting** | Learner-paced chunks beat one continuous stream | **d = 0.67** | 7/7 |
| **Redundancy** | Do **not** add on-screen text that duplicates narration | d = 0.10 (i.e. no benefit) | 8/12 |

Independent corroboration: a 2022 synthesis pooled **29 reviews covering more than 1,000
studies and 78,000 learners** and found most design principles produced significant
positive effects, with **the biggest gains from signalling and from keeping related
elements together**.

### 5.1 The boundary conditions matter as much as the principles

Two findings prevent this from being applied naively:

- The modality effect is the most-studied principle in the literature (median **d = 0.65**
  across 76 studies) but it **shrinks or disappears when the learner controls the pace,
  the material is simple, or the learner already has prior knowledge.** Spoken narration
  is not universally better than text — it is better when the material is hard and being
  pushed at you.
- A 2025 meta-analysis (176 effect sizes, 60 experiments, 5,924 learners) found learners
  with **low prior knowledge do better with high-assistance instruction (d = +0.505)**,
  while learners with **high prior knowledge do better with low-assistance instruction
  (d = −0.428)** — and asymmetrically, helping a novice buys more than removing help from
  an expert.

### 5.2 Mapping: evidence → the actual UI decision

| Evidence | Decision in this app |
|---|---|
| Multimedia (d=1.35), modality (d=1.00) | Two detail levels — a **spoken script** (TELL ME) separate from the **written guide** (READ), and annotated diagrams rather than paragraphs |
| Segmenting (d=0.67, 7/7) | **DO mode is one step at a time with an explicit advance control**, with progress kept — the learner owns the pace |
| Signalling (d=0.69, plus the strongest effect in the 2022 synthesis) | Numbered steps, a step rail, and diagram cues that point at the part being discussed |
| Spatial + temporal contiguity (d=0.82, d=1.31) | Each step is rendered with **its** diagram and **its** safety note, not in a separate appendix |
| Coherence (d=0.86) | Risk level and "what it likely is" come first; the long explanation is opt-in |
| Pre-training (d=0.78, 10/10) | The analysis names the parts and their names *before* the procedure that manipulates them |
| Personalisation (d=1.00) | Conversational second-person copy throughout — the persona prompt is explicit about this |
| Both boundary conditions (§5.1) | **Two depth levels, and a reader can skip the guided path entirely.** A novice gets maximum scaffolding; someone who already knows the machine can go straight to the list |

### 5.3 Where the evidence is against us, and we accept it

- **The voice principle (d=0.74) favours a friendly human voice over a machine voice, and
  this app uses browser speech synthesis.** That is a machine voice, and by this
  literature the app is leaving learning on the table. Cloud TTS with a better voice is
  the upgrade path; until then this is a known, evidence-backed weakness, not a neutral
  choice.
- **DO mode pairs on-screen step text with auto-speak of the same words, which is the
  redundancy pattern the evidence says not to do.** The counter-argument is the boundary
  condition: the pacing is self-controlled and physical tasks need the text visible so it
  can be re-read with wet hands mid-task. But the honest position is that this is a
  *defensible tension*, not a settled win — and the cleaner version would speak a cue
  rather than the verbatim step.
- Text-heavy surfaces (nav labels, buttons, READ mode) are a real barrier for the ~10% of
  South African adults who cannot read a simple statement, and for non-native English
  speakers. Voice and imagery compensate; they do not eliminate it.

---

## 6. Why the honesty rules are safety controls, not manners

An assistant that says something wrong about a live electrical circuit is more dangerous
than one that says nothing. The literature on how people respond to machine advice is
uncomfortable reading, and it justifies every "I can't see that" in this app.

### 6.1 People follow AI advice against their own judgement

- In an **incentivised, interactive behavioural experiment**, the *mere knowledge* that
  advice came from an AI caused people to **over-rely on it — following it even when it
  contradicted available contextual information and their own assessment.** The
  over-reliance harmed not only the decision-maker but third parties.
- A **systematic review of automation bias** notes most decision-support systems are
  **80–90% accurate**, yet occasional incorrect advice "may tempt users to reverse a
  correct decision they have already made." It identifies **trust as possibly the
  strongest driver of over-reliance, when trust is incorrectly calibrated against system
  reliability** — and finds task complexity, workload and time pressure increase reliance
  on the automation.
- In a 2026 computational-pathology study there was a **~7% automation-bias rate** where a
  previously correct human assessment was overturned by incorrect AI guidance — in line
  with reported rates of **6–11% across medical disciplines.** Time pressure did not make
  it more frequent but made it **more severe**. An **anchoring effect was present
  regardless of system accuracy**.
- Most participants in another study **could not detect** whether an AI's confidence was
  miscalibrated, and consequently over-relied on overconfident AI and under-relied on
  underconfident AI.

### 6.2 Telling people the error rate works — telling them the accuracy rate does not

This is the most directly actionable finding in the whole review. In a three-experiment
study on AI bias acquisition:

- Framing performance as **"the AI has a 20% error rate"** reduced trust and reduced
  acceptance of bad recommendations.
- Framing the *same* system as **"80% accurate"** **did not** prevent participants from
  following biased advice — participants treated 80% accuracy as good enough to rely on.
- *"Highlighting the error encouraged people to monitor AI more carefully."*

And on the form the hedge takes: **first-person hedges reduce over-reliance more
effectively than generic third-person disclaimers.**

*Applied:* "I am not going to talk you through this one", "I could not locate that control
in your photo", and "visual checks cannot prove something is safe" are first-person,
specific statements of what the system did **not** determine. A footer saying
"AI can make mistakes" is the exact third-person disclaimer the evidence says is least
effective.

### 6.3 Agreeable AI is trusted more and is worse for you

A 2026 study across 11 large language models (11,587 prompts; three preregistered
experiments with 2,405 participants) found:

- Models **affirmed users' actions 49% more often than humans did**.
- On posts where a community had concluded the user was in the wrong, models still
  **affirmed the user in 51% of cases**; for statements involving potentially **harmful
  conduct, models endorsed the user's position in 47% of cases.**
- Being affirmed increased users' belief that they were right by **25–62%**, and reduced
  their willingness to apologise, accept responsibility or change behaviour.
- And yet users **rated the sycophantic responses 9–15% higher in quality**, reported
  higher performance and moral trust, and were **13% more likely to come back** for more.

That is the commercial trap: the agreeable version of this product would be *preferred by
users and worse for them*. It is the direct justification for the app refusing a category
of task entirely, and for a persona prompt that is explicit about not flattering the user.

### 6.4 A wrong pointer is worse than no pointer

Warning-symbol research sets the bar the app has to clear before it draws anything on a
user's photo:

- **ANSI Z535** considers a symbol acceptable for use *without* an accompanying word
  message only at **85% comprehension** (sample of 50), with **no more than 5% "critical
  confusion" errors** — cases where the symbol is interpreted as something opposite or
  dangerous. **ISO 3864** sets the floor at **67%**.
- Measured comprehension of **real ISO 7010 safety pictograms** (262 participants, 22
  pictograms) averaged **60.1%** before training, 68.3% after, and 66.0% six months
  later. **Warning-category pictograms averaged just 46.1%**; mandatory-action pictograms
  57.7%; prohibition fared best at 83.9%.
- Wogalter's review is blunt: *"it is apparent that many of the pictorials in use today
  fail to convey their intended message"*, and difficult pictograms sat at **or below 50%**
  comprehension pre-training.
- Pictorials that **directly represent** the concept are understood far better than those
  requiring inference or learning. **Critical confusions are more important to eliminate
  than to maximise raw comprehension.**
- **Symbols combined with text outperform either alone** (Sojourner & Wogalter: 40% of
  the group with pictograms complied with the procedure, versus **none** with text-only
  labelling).

*Applied:*
1. **Never draw an annotation the analysis did not actually localise.** A box drawn on the
   wrong control is a critical confusion error in the ANSI sense — the most dangerous
   class of error there is. This is why a control that is known-but-unlocalised produces
   a **labelled generic schematic** instead.
2. **Every marking carries a word.** No bare symbols.
3. The app's step schematics are labelled schematics of *typical* controls, described to
   the user as exactly that — never as "your machine".

---

## 7. The camera is the bottleneck

The premise "point the camera at it" has a documented failure mode that the app has to
survive: **people are bad at aiming cameras at things they cannot see.**

- Framing is repeatedly identified as one of the biggest practical problems for blind and
  low-vision camera users. Photos come out blurred, badly framed, low-saliency against
  clutter, or **missing the object entirely**; with remote-sighted-help services those
  images "typically slow down the response rate as crowdworkers try to provide feedback or
  guide better camera aiming".
- In *The Last Meter*, 18 blind participants used an object-recognition app to find
  targets beyond arm's reach. In the **easiest** scenario — moving the phone 70 cm — the
  average completion time was **over 13 seconds**, some participants aimed at the **wrong
  wall**, and some had a consistent directional bias.
- Camera-aiming guidance measurably fixes much of it (ReCog, 10 blind participants):
  **64.2%** of photos were better centred with guidance (*p* < .001), scaling score rose
  from **22.9% to 65.3%** (*p* < .01), and recognition accuracy improved from **0.83 to
  0.94** (*p* < .05). Novice users preferred the guidance; with practice they weaned off it.
- Real-time feedback reduced photos that missed the object to **2%** (simple scenes) / 8%
  (cluttered scenes).
- Critically for this project: **"Participants tended to trust the feedback even though
  they know it can be wrong."** The automation-bias finding of §6.1 appears in the
  accessibility literature too.
- Users also reported wanting to judge photo quality **themselves** rather than rely on
  sighted help — using signals like garbled OCR output to infer that a photo was bad.

*Applied:* the app treats a poor photo as an expected outcome and a first-class state, not
an error. When a control cannot be located, it says so and falls back to a labelled
schematic; it never analyses a bad frame as if it were a good one and never claims a
position it does not have. It also asks for a better photo rather than producing a
confident answer from an unusable one.

---

## 8. The operating context: South Africa

The app is built for the environment the user is actually in, so the constraints that
matter are connectivity and the price of a megabyte — not novelty.

| Measure | Figure | Implication for this app |
|---|---|---|
| Households with internet access from anywhere (2024) | **82.1%** | Reachable — this is a viable delivery channel |
| Mobile internet access, national (2024) | **75.6%** (KZN 80%, Eastern Cape 65.3%) | The mobile web is the product; there is no desktop majority to design for |
| **Fixed internet at home** | Low, and uneven — Western Cape leads at 44.9% | Assume **mobile-only, prepaid**, and intermittent |
| 4G/LTE population coverage (2025) | **99.5%** (5G 58%) | Coverage is no longer the main barrier; **cost and device** are |
| Entry-level mobile broadband, 2 GB basket | **R152/month**, against an affordability benchmark of R186.36 — meets the standard | But SA has the **highest entry-level mobile broadband cost among BRICS**: India R86, Brazil R69, China R38, Russia R34 |
| Prepaid share of mobile subscriptions | **~97 million of 116 million** | Most users are **rationing data by the megabyte** |
| Cheapest smartphone (2025) | **R399** (down from R499) | Low-end Android is the target device, not a flagship |

*Applied:*

- **Every AI call is metered, and users know it.** The app ships as a static bundle with
  **no AI SDK in the browser bundle** (179 kB gzipped, no model client libraries) and
  images are downscaled before upload. Sending a full-resolution photo to a cloud model
  costs the user money.
- **Prepaid and intermittent is the assumption.** The offline engine is a first-class
  mode, not a degraded one, and it is the default with no key configured.
- **Honest correction of an earlier assumption.** I had planned around load-shedding as a
  major driver of offline-first design. That is now out of date: **Eskom recorded more
  than 300 consecutive days without load-shedding by 12 March 2026**, and the grid
  situation has substantially stabilised. The offline-first design is still justified —
  by rural and indoor coverage gaps, by data rationing, and by the cost per megabyte — but
  the load-shedding argument no longer applies and should not be repeated.
- **Language.** South Africa has twelve official languages including South African Sign
  Language. Browser speech synthesis realistically covers **en-ZA and af-ZA**; the app
  offers isiZulu, isiXhosa, Sesotho, Setswana, Sepedi and Xitsonga by routing to cloud TTS
  when a key exists, and **says so plainly when it cannot** (§9 covers a real gap here).

---

## 9. Where the build is weaker than the research says it should be

Recorded deliberately, because a research document that only confirms the design is not
research.

| # | Gap | Evidence it matters | Status |
|---|---|---|---|
| 1 | **The voice is synthetic, not human** | Voice principle, d = 0.74 | Known weakness. Cloud TTS is the upgrade path; browser voices are the fallback because they work offline and cost nothing |
| 2 | **DO mode speaks text that is also on screen** | Redundancy principle (no benefit) | Defensible because pacing is self-controlled and the text must stay visible, but the cleaner design speaks a *cue*, not the verbatim step |
| 3 | **Only 8 languages are listed, and three official SA languages are missing entirely** | Twelve official languages; HCI4D literature is unanimous that local-language voice is the difference between usable and unusable for low-literacy users | **Real gap.** siSwati, Tshivenda and isiNdebele are absent from the language list. Should be added even where the only option is honest unavailability |
| 4 | **The interface chrome is text** | ~10.2% adult illiteracy in SA; low-literacy UIs need icon + voice navigation throughout | Partial. Nav and actions are icon-led, but labels remain text |
| 5 | **The offline engine is English-only** | Instructions a user cannot read are not instructions | Known limitation; the offline guides are the fallback for the keyless case |
| 6 | **Annotation correctness is not itself verified against the photo** | ANSI critical-confusion criterion | Structurally mitigated (no mark without localisation) but not independently measured |

---

## 10. Validation performed

Run in this repository on 2026-10-07.

### 10.1 Static and build

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **clean**, 0 errors |
| Production build | `npm run build` | **success** — 566 kB JS (179 kB gzip), 61 kB CSS, no warnings |
| Dependencies | `npm install` | 0 vulnerabilities |

### 10.2 Automated tests — 86 assertions, two suites

**`tests/run.ts` — 67 assertions, no framework.**

| Group | What it pins down |
|---|---|
| JSON salvage | Truncated / fenced / chatty model output parses; brackets close innermost-first |
| Schema normaliser | Hostile payloads normalise without throwing; risk ordering is total |
| Food engine | Parsing, matching, blockers vs. nice-to-haves, substitutions that refuse to fake an equivalent |
| Scenario matching | Correct guide from a cue; ambiguity never confidently wrong |
| Demo engine | Offline analysis is complete, labels itself, safety branch emits hazard + precaution + escalation |
| Video intelligence | Queries from the real task; search links labelled; no fabricated ids or timestamps |
| Utilities | `uid`/`norm`/`sameIngredient`/`speechChunks`/`formatMinutes` edge cases |
| Personal knowledge | Entries fold into prompts and survive export/reset |
| Languages | All eleven spoken official SA languages are offered, and the `tts` flag agrees with the voice-support map — so the UI can never claim to speak a language it cannot |
| Server | Live `/api/health`, SPA fallback, **7 SSRF probes** (localhost, 127.0.0.1, 10.0.0.5, 192.168.1.1, 172.16.0.1, 169.254.169.254, `file://`) — all **400** |

**`tests/dom.tsx` — 19 render tests in jsdom, driving the real React tree** with no mocks
of app logic, including the full journey from the home screen with no API key.

The honesty contract is executable, not aspirational. Of the 19:

- *SHOW ME never claims to have marked a photo it cannot see* (§6.4)
- *SHOW ME is honest when there is no photo*
- *WATCH mode explains how videos are chosen and does not fake them* (§6.4)
- *"Delete everything" also clears the live task, its photos and the chat*
- *a wipe drops the photos the live session is holding in memory*
- *clearing storage also removes keys from older versions*
- *storage holds no key after a reset*

### 10.3 Runtime

| Check | Result |
|---|---|
| Dev server | `0.0.0.0:8787`, health `{"ok":true,...}` |
| Production boot | serves built `dist/`, `"mode":"production"` |
| SPA deep link | `GET /some/deep/route` → 200 |
| Preview-proxy request (`Host: 8787-*.e2b.app`) | 200, no "Blocked request" |
| `X-Frame-Options` / CSP `frame-ancestors` | absent — embeds correctly |
| Cold anonymous client (no cookies) | 200; **server sets no cookie and holds no session** |
| PWA icons | 192/512 PNG rendered from SVG, pixel-probed (opaque background, gradient intact, maskable safe zone) |

### 10.4 Data deletion, after audit

A dedicated audit asked "when I clear, does it clear?" rather than assuming. Two real bugs
were found and fixed:

1. **The store was wiped but the live session was not.** The open task, its photos (data
   URLs) and the chat live in React state; "Delete everything" left them on screen and in
   memory. Fixed with a reset broadcast the session subscribes to.
2. **A legacy storage key survived the reset.** Hydration falls back to `vaea.state.v2`,
   but the wipe removed only the v3 key — so an old payload, **including an old API key**,
   could be rehydrated on the next load.

Every new test was then **verified against a reverted fix**, to prove it could fail:

| Fix reverted | Tests that failed |
|---|---|
| session reset subscription | 2 ✓ |
| legacy key removal | 1 ✓ |
| debounce timer clearing | **0** ✗ |

The third result was informative: `persist()` reads state when it fires, so a stale timer
writes the clean state anyway. That "fix" is tidy, not load-bearing, and a comment
claiming otherwise was **corrected** rather than left in the source.

### 10.5 Accounts

**No login is needed and none exists** — verified by exhaustive search, not memory: no
auth/login/signup/OAuth/password code, no database, ORM or cache, no cookies, no session
middleware, no `Set-Cookie` in any response. The only `Bearer` strings are the user's own
provider key going to their chosen provider. This follows from §6: a system that admits it
can be wrong should not be accumulating an account, a photo archive and a retention
policy behind that admission.

### 10.6 What could **not** be validated

- **No provider key in this environment**, so real-model paths (vision, follow-up chat,
  model discovery, "Test connection", the relay) are type-checked and unit-verified but
  not executed end to end.
- **No live YouTube Data API key** — the labelled search-link fallback is tested; the
  real-results path is not.
- **No real camera** — the aiming failures of §7 are handled in code (no claim without
  localisation) but were not reproduced with real users.
- **Speech synthesis** depends on host voices; queueing and chunking are tested, audio is
  not.
- **Performance on a low-end Android device is unmeasured.** 179 kB gzip with no AI SDK
  is the right shape for a R399 prepaid phone, but that is a design intention, not
  evidence.
- **Annotation accuracy was not independently measured** against a ground-truth set (§9.6).

### 10.7 Five-minute manual validation

```bash
npm install
npm test                 # 86 assertions, no key needed
npm run dev              # http://localhost:8787

# 1. No key. Ask "how do I use this washing machine". Confirm a real guide that says it
#    is offline. Close the task with the ✕ — the Task tab should go dead.
# 2. Settings → paste a Gemini key (free, no card) → Test connection.
# 3. Photograph an appliance and ask. Confirm every marking claimed matches what is
#    visible, steps carry a reason, and nothing invents a part number or a video.
# 4. Settings → Delete everything. Confirm the task, photos and chat all go.
```

---

## 11. What the evidence says to do next

Ordered by strength of evidence behind them, not by effort:

1. ~~Add the three missing official languages~~ **Done** (§9.3) — siSwati, Tshivenda and
   isiNdebele are now selectable with honest unavailability. Next: find a voice for them.
2. **Replace verbatim step narration with spoken cues** (§9.2) — removes a known
   redundancy cost while keeping the hands-free benefit.
3. **Add photo-quality guidance before analysis** (§7) — tell the user when a frame is
   likely unusable and ask for another, as the aiming research does. This prevents the
   app from answering confidently from a bad photo.
4. **Widen the offline guides** beyond 14 scenarios using the existing `Scenario` shape,
   prioritising the high-consequence categories from §3: electrical, ladder/height, gas,
   vehicle jacking, garage-door springs.
5. **Human-voice TTS** where the user has a key (§9.1).
6. **Measure annotation accuracy against ground truth** (§9.6) — the one claim in this
   codebase not backed by an independent measurement.

---

## 12. Summary of the argument

- People do not read instructions (6.8%–25% depending on the study), and when they do,
  **~80% of manuals are judged ineffective**. That is a design failure, not user error.
- The consequence is not inconvenience: **~1 in 6 people who do DIY injure themselves**,
  ~35.9 million preventable home-accident injuries are medically consulted in the US in a
  single year, and the categories that hurt people most are the ordinary ones —
  ladders, electricity, garage springs.
- **~27% of adults internationally read below the level needed for basic written
  information**, and **~3.9 million South African adults are illiterate**, so text-first
  delivery excludes a large share of the people who most need help.
- The instruction-science evidence is strong and specific: **pictures with words
  (d=1.35), spoken narration with visuals (d=1.00), one learner-paced step at a time
  (d=0.67), names taught before the procedure (d=0.78)**.
- The AI-advice literature shows people **over-rely on confident machine output even
  against their own judgement**, that **stating the error rate works while stating the
  accuracy rate does not**, and that **agreeable assistants are preferred and make people
  worse off**. Warning-symbol research shows that real safety pictograms are understood
  only **60%** of the time and that **critical confusion is worse than low comprehension**.
- So the honesty rules in this app — no mark without localisation, no fabricated video,
  no inflated "missing" list, an outright refusal to guide someone through a live hazard —
  are **safety controls derived from evidence**, not branding.

---

## 13. Sources

**Instruction design and manuals**

- *Life Is Too Short to RTFM* — manual readership (~25%), why manuals fail: <https://www.helppier.com/en/product-documentation/>, <https://www.docsie.io/blog/articles/how-to-write-clear-concise-user-manual-instructions/>
- *Why don't people read the manual?* — 25 in-depth interviews, median printed-manual use 0%, 10.5% give up: <https://scholarworks.utep.edu/cgi/viewcontent.cgi?article=1010&context=cs_papers>, <https://www.researchgate.net/publication/28659535_Why_don't_people_read_the_manual>
- Mehlenbacher, Wogalter & Laughery — reading of vehicle owner's manuals; Leonard & Kames figures (6.8%, 5.2%): <https://www.safetyhumanfactors.org/wp-content/uploads/2020/07/221)Mehlenbacher,Wogalter,Laughery(2002).pdf>
- *Influence Factors on User Manual Engagement* (MDPI *Electronics* 2023) — 27.8% too technical, 24% incomplete, 24.3% implicit, 63% self-blame: <https://www.mdpi.com/2079-9292/12/17/3539>
- *Instruction Manual Usage: younger / older / cognitive disabilities* — memory, attention, comprehension, font size, self-blame: <https://researchgate.net/publication/225100941_Instruction_Manual_Usage_A_Comparison_of_Younger_People_Older_People_and_People_with_Cognitive_Disabilities>
- BILT metrics review — 80% of manuals ineffective, 85% "very important", 46% unhelped, two-thirds deterred by assembly: <https://bilt.ai/news/why-instructions-matter-a-metrics-based-review-of-how-instructions-impact-consumers-and-brands/>
- 4,947 usability sessions — users rarely read IFUs; design implication: <https://research-collective.com/thousands-usability-study-sessions/>

**Injury and accident data**

- DIY accident statistics compilation (UK), incl. 64% / 17% / 300-weekly / £222m / ladders / electrical: <https://onlinecpdacademy.co.uk/blog/diy-accident-statistics-uk>
- DIY injuries, CPSC 35.9m, garage-door spring case series, ladder volumes: <https://goodmenproject.com/do-it-yourself-2/5-home-repairs-you-should-never-diy/>
- Leading causes of DIY injury by rate per 100,000: <https://insurance-edge.net/2024/08/01/home-diy-remains-a-high-risk-strategy-for-some-stats-advice-here/>, <https://www.insightdiy.co.uk/news/study-reveals-most-common-diy-accidents/13918.htm>
- Ladder fatalities and injuries, home setting, age distribution: <https://www.monash.edu/__data/assets/pdf_file/0009/218457/haz63.pdf>
- Home-improvement injuries as 3% of 2020 ER visits: <https://www.washingtonpost.com/business/2022/05/24/can-your-diy-result-visit-er/>
- Work-home injury rates for woodworking/repair/construction: <https://pubmed.ncbi.nlm.nih.gov/2313746>

**Literacy and numeracy**

- OECD PIAAC Cycle 2 / *Education at a Glance 2025* — 27% at or below Level 1 literacy: <https://www.oecd.org/en/publications/2025/09/education-at-a-glance-2025_c58fc9ae/full-report/piaac-proficiency-in-key-information-processing-skills-among-adults_3ccb98d6.html>
- EU Education and Training Monitor 2025 — 21.8% lack basic proficiency in both literacy and numeracy; decade-long decline: <https://op.europa.eu/webpub/eac/education-and-training-monitor/en/comparative-report/chapter-7.html>
- DHET fact sheet — SA adult illiteracy 10.2%, ~3.9m adults, 11.6% Black African: <https://lmi-research.org.za/wp-content/uploads/2024/07/DHET-FACTSHEET-7-7-3b-Adult-Literacy-2024-WEB.pdf>

**Instruction science (multimedia learning)**

- Mayer, *Using multimedia for e-learning* — effect sizes: <https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12197>
- Mayer's own replication table (15 principles, 200+ comparisons): <https://edtecharchives.org/journal/423/10349>
- Principle summaries and the modality boundary conditions: <https://www.devlinpeck.com/content/mayers-principles-of-multimedia-learning>, <https://www.growthengineering.co.uk/multimedia-learning-theory/>
- Noetel et al. 2022 synthesis — 29 reviews, 1,000+ studies, 78,000 learners: <https://www.growthengineering.co.uk/multimedia-learning-theory/>
- 2025 meta-analysis on prior knowledge (d = +0.505 / −0.428): <https://www.growthengineering.co.uk/multimedia-learning-theory/>

**Automation bias, trust and sycophancy**

- Over-reliance on AI advice in an incentivised experiment: <https://www.sciencedirect.com/science/article/pii/S0747563224002206>
- Automation bias systematic review — 80–90% accuracy, trust as the strongest driver: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751/>
- Trust calibration as a design problem — first-person hedges vs third-person disclaimers: <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1935527/full>
- Computational pathology — 7% automation bias, 6–11% across medical disciplines: <https://arxiv.org/html/2603.11821v2>
- Miscalibrated AI confidence — users cannot detect it: <https://arxiv.org/html/2402.07632v4>
- Warning about AI error rates (20% error vs 80% accurate): <https://link.springer.com/article/10.1186/s41235-026-00726-w>
- Sycophancy — 11 models, 11,587 prompts, 2,405 participants; 49% more affirmation: <https://www.thepolicyscientist.com/post/how-prevalent-is-ai-sycophancy-and-how-does-it-influence-human-behavior>, <https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research>
- Human–AI presentation and reliance review: <https://www.mdpi.com/2227-9709/12/4/135>

**Warnings and symbol comprehension**

- Wogalter, *Warning symbols* — ANSI 85%/5% criteria, direct vs inferential pictorials, "fail to convey their intended message": <https://www.researchgate.net/profile/Michael-Wogalter-2/publication/289264549_Warning_symbols/links/5fa2d24da6fdcc0624125686/Warning-symbols.pdf>
- Laughery & Wogalter, *Designing effective warnings*: <https://www.safetyhumanfactors.org/wp-content/uploads/2020/07/271)Laughery,Wogalter(2006)(b).pdf>
- ISO 7010 pictogram comprehension (60.1% pre-training, 46.1% for warning category): <https://www.sciencedirect.com/science/article/pii/S2666449624000409>
- Symbol + text vs text alone; comprehension and retention of safety pictorials: <https://www.safetyhumanfactors.org/wp-content/uploads/2020/07/128)Wogalter,Sojourner,Brelsford(1997).pdf>, <https://www.safetyhumanfactors.org/wp-content/uploads/2020/07/28)Young,Wogalter(1990).PDF>
- Instruction-manual warnings: conspicuous print and pictorial icons: <https://www.safetyhumanfactors.org/wp-content/uploads/2020/07/28)Young,Wogalter(1990).PDF>
- Training effects on symbol comprehension (30% → 90% with verbal labels): <https://www.sciencedirect.com/science/article/abs/pii/S0003687007000701>

**Low-literacy interfaces and voice**

- Medhi et al., *Designing mobile interfaces for novice and low-literacy users* (ACM TOCHI 2011) — 90 subjects incl. South Africa; 0% vs 72% vs 100% task completion; design recommendations: <https://dl.acm.org/doi/pdf/10.1145/1959022.1959024>
- Systematic review, *Designing UIs for illiterate and semi-literate users* (2023): <https://journals.sagepub.com/doi/10.1177/21582440231172741>
- *Voice Interfaces for Underserved Communities* — speech vs keypress findings: <https://link.springer.com/chapter/10.1007/978-3-030-86065-3_22>

**Camera aiming and blind photography**

- *Revisiting Blind Photography in the Context of Teachable Object Recognizers* — trust in feedback "even though they know it can be wrong"; 2%/8% missed-object rates: <https://pmc.ncbi.nlm.nih.gov/articles/PMC7415326/>
- ReCog — camera-aiming guidance metrics: <https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376143>
- *The Last Meter: Blind Visual Guidance to a Target* — >13 s for 70 cm, wrong-wall aiming: <https://pmc.ncbi.nlm.nih.gov/articles/PMC4241272/>
- *Understanding How Blind Users Handle Object Recognition Errors* — framing difficulty, judging quality via OCR errors: <https://arxiv.org/html/2408.03303v1>
- VR vs verbal instruction for camera aiming: <https://pmc.ncbi.nlm.nih.gov/articles/PMC12674579/>

**South African connectivity and data economics**

- ICASA, *State of the ICT Sector Report* March 2026 — 82.1% household internet access, 75.6% mobile access, 4G 99.5% / 5G 58%, R152 2 GB basket vs R186.36 benchmark, BRICS comparison, prepaid share, R399 cheapest smartphone, load-shedding resolution: <https://www.icasa.org.za/uploads/files/The-State-of-the-ICT-Sector-Report-of-South-Africa-31-March-2026.pdf>
- ICASA, *State of the ICT Sector Report* March 2025 — prepaid dominance, revenue trends: <https://www.icasa.org.za/uploads/files/The-State-of-the-ICT-Sector-Report-of-South-Africa-2025.pdf>
- Data affordability and per-GB costs: <https://ts2.tech/en/south-africas-internet-access-revolution-the-shocking-truth-about-connectivity-in-2025/>
- Load-shedding status (300+ consecutive days to 12 March 2026) and coverage caveats: <https://www.earthsims.com/country/south-africa-internet-guide/>
- Mobile-data affordability ranking and affordability gap: <https://www.mordorintelligence.com/industry-reports/south-africa-telecom-market>
