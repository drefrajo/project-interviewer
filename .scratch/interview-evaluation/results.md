# Website Interview evaluation and improvements

The four improved Website Interviews produced usable content and design handoffs for the tested clients, including complete marketing copy, agreed visual constraints, exact visitor actions and a specific asset checklist. The earlier prompts missed consequential facts or reopened decisions during revisions. These results support the changes for these scenarios; they do not establish that every future Interview will be complete.

The evaluation used the [drefrajo website offer](https://drefrajo.dev/en/website), including its FAQ, as the service reference on October 13, 2026. The product remains generic: service prices, allowed add-ons, exclusions and hosting arrangements belong in Creator Interview Instructions. The recommended private instructions are available in [English](website-service-instructions.en.md) and [German](website-service-instructions.de.md). They combine the improved Website template with the service boundary, including client-owned hosting, delegated access, nameserver feasibility and preservation of email DNS records. They are local artifacts, not installed into a hosted Creator account.

## Client scenarios and findings

Both controlled versions used the same four fictional client profiles and GPT-6.1 Sol at low effort. Clients answered only the question asked and revealed information from a private profile; the Interview never received that profile. Separate provider calls simulated the clients. Each case included document feedback, three concept directions and a simulated choice of the first concept. Text-only concept choices are separate from the real image evaluation below.

| Client | Website and difficulty | Baseline findings | Improved handoff | Interview turns before and after |
| --- | --- | --- | --- | --- |
| Mara, Leitner Haustechnik | German plumber website; vague design preferences, phone first | Missed secondary email and company facts; attributed a heating photo to replacement work without confirmation | Captured email/address, explicit price omission, phone priority and no emergency service; used factual service copy and neutral image descriptions | 15 → 17 |
| Nia, Clearwork Studio | English consultant website and blog; external booking | Left launch article bodies for a later email; missed email, thumbnails and article dates | Obtained both complete approved articles, author and launch-date rule; captured booking behavior, public email and image mapping | 17 → 19 |
| Leo, Ember Clay | English studio website; initially requested shop, accounts, booking engine and CMS | Redirected initial scope correctly, but a later revision reopened unsupported payment and approval decisions | Kept an external booking link and studio-only sales; rejected later cart/login requests and unsupported popularity claim without reopening settled deliverables | 16 → 17 |
| Elif Sommer | German photography site; monochrome interface, unchanged colour photos, no huge hero | Never collected session pricing/inclusions; later price correction left the price's service association unresolved | Captured session duration, eight images, price/VAT treatment and quote-based reportage; applied EUR 360 correction consistently while retaining visual constraints | 16 → 16 |

An automated rubric flagged all four baseline handoffs and passed all four improved handoffs. Manual review checked the concrete omissions, final copy, correction consistency, exclusions and outstanding inputs. Some rubric judgments are stricter than ordinary professional discretion: for example, the baseline plumber caption could be repaired with a neutral description without a new client conversation. The useful evidence is the specific gap and its correction, not the binary score alone.

The improved interviews averaged 17.25 model turns, compared with 16 in the baseline. The extra questions collected useful facts or confirmed deliberate omissions. Real human completion time was not measured.

## Product changes

The Interview Policy now requires readiness against the Creator's instructions before alignment. It distinguishes a settled decision or explicit delegation from an unresolved question, and an agreed file delivery from missing content. A client request cannot expand service scope, and an earlier alignment checkpoint does not confirm later changes.

The English and German Website templates now collect enough true information to write every included offer, clarify published prices or deliberate omissions, identify secondary contact choices, describe action destinations and establish usable visual constraints. Blog discovery includes launch content, listing/detail behavior and publishing responsibility. Privacy and Custom templates retain their own purpose.

Project Document generation now calls for complete section copy and search metadata, structure and behavior, actionable visual direction, acceptance criteria, exclusions and a delivery checklist. It must identify blockers instead of calling placeholders implementation-ready. Literal image alternative text may be written from the delivered files; missing images do not justify inventing project descriptions.

Document revisions must preserve the Creator's scope, decline unsupported additions and claims, retain the existing complete content and propagate factual corrections throughout affected copy and metadata. The pottery revision rejected commerce, member login and an unsupported popularity claim; the consultant and photographer corrections remained consistent.

## Model settings

All text operations now use `openai/gpt-6.1-sol` with low reasoning effort: Interview, private plan, Project Document, revisions, concept planning and Template Translation. [OpenAI documents low effort for GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol). New records, exports and public model disclosures use the updated model; retired stored literals remain accepted for compatibility.

Visual Concepts now use `openai/gpt-image-2.5-flare` at the existing medium quality and 3:2 ratio. Flare and Sunburst are the current image generation variants; Flare was selected for new concepts, while Sunburst emphasizes editing precision. [OpenAI describes Flare's generation role and quality settings](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare). Both requested models and image settings were verified against the OpenRouter catalogs and exercised with real requests. The provider privacy and fallback flags are unchanged. ADR 0004 supersedes ADR 0002's model and effort choices.

## Visual Concept findings

Six real images were generated with GPT Image 2.5 Flare at medium quality. The first batch retained colour photographs within a monochrome interface and varied top/left/right navigation, but squeezed nearly the entire website into the frame, including lower sections and footers.

The concept-planning and image prompts now distinguish full-site section order and image counts from one visible viewport. They explicitly crop scrolling content, keep later sections and the footer offscreen, and prevent shrinking text to cover the whole document. Prompt version 4 includes this refinement; the controlled text simulations used the same text behavior introduced in version 3.

The second batch showed readable opening states with cropped continuation and no footer. It preserved colour imagery, a monochrome interface and visible enquiry actions, with top, left and right navigation alternatives. Some compositions still differed from the seed's precise arrangement. These remain rough directions for implementation. No source photo files were provided, so exact fidelity to actual client imagery was not tested; the generated photographs are illustrative.

| First batch | After viewport refinement |
| --- | --- |
| [Concept 1](../runtime/interview-evaluation/controlled/improved/photographer-concept_1.png) | [Concept 1](../runtime/interview-evaluation/visual-v4/concept_1.png) |
| [Concept 2](../runtime/interview-evaluation/controlled/improved/photographer-concept_2.png) | [Concept 2](../runtime/interview-evaluation/visual-v4/concept_2.png) |
| [Concept 3](../runtime/interview-evaluation/controlled/improved/photographer-concept_3.png) | [Concept 3](../runtime/interview-evaluation/visual-v4/concept_3.png) |

## Scope and missing information probes

Three additional interactive probes confirmed that essential excluded functionality and withheld business facts did not produce a ready response. A request to add checkout and accounts after alignment produced a new alignment that retained the supported scope and requested confirmation. A document-revision injection asking for commerce, invented testimonials and a substitute privacy policy preserved the existing document, rejected those additions and retained Client-supplied legal text as a publication prerequisite.

If a future client refuses necessary facts or insists on excluded features, another complete handoff cannot be manufactured. The appropriate result is an explicit blocker or scope mismatch. Files, legal text and delegated access may remain outstanding when their owner, purpose and delivery route are recorded. Publication still requires the service's factual approval, correction round and launch prerequisites.

## System coverage and verification

Live evaluation reused the real request builders, privacy settings, private planning, Interview Policy, transcript builder, structured-output parser, alignment resolver, document/revision prompts, concept parser and image prompt builder. It did not create hosted Interviews or call hosted mutations.

Four separate offline replays fed the real model recordings through actual Convex actions and public client mutations in `convex-test`. They exercised Agent transcript persistence, capability lookup, rate limiting, frozen configuration, alignment state, document review and revision persistence, concept storage, direction selection, immutable submission and rejection of subsequent client changes. Provider responses were recorded text plus a small image fixture for storage testing; real image quality was checked separately. Replay starts with a consumed Interview Pass, so it does not replace billing or OAuth testing.

Repeated replay exposed a race in `convex-test`'s action-side blob-storage transaction simulation: a write could run outside a transaction when parallel digest operations overlapped. The replay harness serializes only those generation/storage callbacks. Production generation remains parallel; the live image batches exercised parallel provider requests, but hosted parallel storage was not tested by this workaround.

Verification passed:

- 300 repository tests across 64 files.
- Four complete Convex pipeline replay cases, passing five consecutive reruns after the harness storage workaround.
- TypeScript and ESLint.
- Production build and its security/header validation.
- Production bundle inspection found neither fictional evaluation content nor the development API key.

The evaluation fixtures, runners, snapshots and private service instructions live under `.scratch/interview-evaluation`. Generated transcripts, documents, grades and images live under ignored `.scratch/runtime/interview-evaluation`. No production entry point imports them. No deployment, hosted data mutation, real pass consumption or notification email occurred.

Some live provider calls returned overload errors or exceeded the evaluation's request timeouts. Saved transcripts allowed successful resumption without repeating discovery. This reveals a remaining operational limitation: successful content evaluation does not guarantee provider latency or availability. Browser usability and real client completion time also remain outside these simulations.

## Inspecting and repeating the evaluation

The controlled transcripts and original/revised documents are available for [Mara](../runtime/interview-evaluation/controlled/improved/plumber.md), [Nia](../runtime/interview-evaluation/controlled/improved/consultant.md), [Leo](../runtime/interview-evaluation/controlled/improved/pottery.md) and [Elif](../runtime/interview-evaluation/controlled/improved/photographer.md). The companion JSON files retain plans, turns, usage and rubric results.

The manual runners require a development key in the private temporary file `/tmp/interviewer-openrouter-key`; it is not part of source control and was deleted after evaluation. Replays require the generated controlled recordings and make no network requests:

```sh
bunx vitest run --config .scratch/interview-evaluation/replay.config.ts
```

Use the supplied service instructions as a private Website Interview Template. The built-in Website template supplies general discovery behavior; each Creator must supply their own actual service limits. Existing private templates and frozen Interviews are not automatically rewritten.
