# Concept selection improvements and evaluation

The three fictional clients who began without a preferred palette, font or layout all reached an explicit visual choice after comparing actual rendered concepts. Each gave concrete preferences that the Creator can apply. The UI and server now require those preferences and a separate style review before an immutable Project Submission. These results support a real-client pilot; simulated agreement does not establish how often humans will change their minds.

## Changes

Discovery now establishes the desired impression, brand constraints and exclusions while leaving exploratory colours, typography and layout open. English and German Website templates distinguish required constraints, tentative recommendations and delegated choices. Concept planning asks for three materially different art directions within the same content and service scope.

Selecting an image reveals two required questions: what to keep, and what to leave out or adjust. A client can explicitly state that nothing needs changing. The next action reviews the selected image, its description and the client's exact words. A separate **Confirm this style and submit** action records the summary with a server timestamp. The server reconstructs that summary rather than accepting client-authored confirmation metadata. The Creator view and Markdown export retain it. Existing submissions remain readable; document-only Interviews retain their flow.

Another batch remains available after a tentative selection. “None of these fit” states that no style is agreed and offers annotated inspiration links with the same keep/avoid and confirmation requirements. Changing the choice clears preferences; a changed concept or pending operation invalidates an open review. Failed concepts cannot be submitted. Selecting or saving a draft alone cannot submit.

The confirmation explains that imagery and example wording are illustrative and that style preferences do not expand project features. Service restrictions and commercial terms remain configurable Creator Interview Instructions. No drefrajo package is embedded in production prompts, templates or confirmation logic.

## Live clients

| Client | Uncertainty and website goal | Discovery turns | Pixel-based choice and useful adjustment |
| --- | --- | --- | --- |
| Lina, Radraum Linz | First bicycle repair website; practical, friendly and trustworthy; no palette, font, layout or references | 14 | **Ruhige Werkstattklarheit**: light surfaces, dark green, readable type, top navigation and repair photography. Replace the generated slanted wordmark with her existing black wordmark. |
| Theo, English tutor | Adults should understand the offer and arrange a trial; cannot choose between formal, modern and friendly unseen | 10 | **Warm Personal Welcome**: cream, green, large serif headings, portrait beside the introduction and prominent trial action. Keep practical details from becoming too faint. |
| Amira, Ink & Place | Personal, crafted and professional; serves business events and weddings; no predetermined visual style | 16 | **Open Correspondence**: pale/dark green, serif headings, generous spacing and enquiry strip. Remove repeated navigation and prevent the large wedding image from dominating the business identity. |

All three confirmed the exact reviewed summary in a separate simulated review call. None was instructed to select the first option or accept a least-bad option. Amira selected the third concept. All preferred their first batch, so live rejection of all six images was not observed; rejection and reference paths were checked with deterministic tests.

Lina and Amira used the private drefrajo scope from the earlier evaluation. Theo used another Creator's configurable **Swift Sites EUR950** service. His document retained that price, exclusions and delivery arrangement without importing drefrajo payment stages or launch promises.

The documents contained complete first-draft marketing copy, visitor actions and asset roles. Palette, fonts and composition remained explicitly open until concept selection. Remaining dependencies were supplied files, legal text, access and handoff routing. Lina's document also explicitly flagged publication permission for her wordmark. These dependencies must be resolved through the agreed handoff; they are not permission to publish placeholders.

## What testing caught

The initial pilot exposed a workflow deadlock: the model waited for rendered style approval before returning ready, although the application only renders concepts after Project Document review. It repeatedly aligned or paused without generating the document. The pilot recordings are preserved in ignored `.scratch/runtime/concept-selection-pilot`.

Prompt version 6 now receives the actual `includesVisualConcepts` setting from the production job. It describes discovery → Project Document → review → rendered concepts → final style confirmation. Discovery readiness requires content/scope alignment, desired impression and real constraints; open style exploration and separately agreed file delivery must not block the next stage. A production-job regression test checks this wiring. The corrected three simulations completed in 10–16 model turns.

Manual inspection of all nine images found visible differences in palette, type and composition: photographic split introductions, side navigation, centred introductions and different enquiry treatments. The client's keep/avoid descriptions matched visible features. The generated imagery was illustrative rather than an exact rendering of supplied assets. Some images included unwanted details, including the invented wordmark and repeated navigation; collecting explicit adjustments made those differences actionable. A concept is still a rough direction, not a pixel-perfect final design or a complete mobile specification.

## Evidence and limits

The live runner used production policy, planning, message construction, output parsing, alignment handling, Project Document generation, concept seeds, image prompts and provider request builders. Text calls used GPT-6.1 Sol at low effort; nine PNGs used GPT Image 2.5 Flare at medium quality and 3:2. Private factual profiles were supplied only to the simulated Clients. Separate multimodal Client calls received the actual PNG pixels and concept descriptions, followed by the exact confirmation summary. OpenAI documents Sol's [image input support](https://developers.openai.com/api/docs/models/gpt-6.1-sol) and [image inputs in model requests](https://developers.openai.com/api/docs/guides/images-vision).

The three new offline replays clicked the real React component with the recorded choices and preferences, then called real Convex capability lookup and submission mutations. They proved that the UI displayed the same summary that the server stored, content/scope stayed intact, explicit confirmation was required and submissions became read-only. These replays begin at the concept stage; the live runner does not drive a hosted Interview or billing. Four earlier full Convex pipeline replays also still pass with the new submission contract.

Verification passed:

- **313 repository tests** across 65 files.
- **3 new UI-to-Convex replay cases** and **4 earlier full pipeline replay cases**, offline.
- TypeScript, ESLint, production build and production security/header validation.
- Desktop and 390px mobile browser checks: readable review, scrollable long confirmation, reachable adjust/confirm actions and confirmed summary. The preview used the actual component; local-only callbacks avoided hosted effects.
- Production bundle scan: no fictional clients, evaluation marker or development API key. No production source imports `.scratch`.

Fixtures, manual runners, replay configuration and preview entry remain under `.scratch/concept-selection`; generated transcripts, documents, images and screenshots remain under ignored `.scratch/runtime/concept-selection`. No deployment, hosted data mutation, email or real pass consumption occurred. The temporary development key was removed after evaluation.

Human completion time, interpretation of rough concepts and eventual design satisfaction remain unmeasured. The interviewer and simulated Clients use the same model family, which can make simulations more agreeable than humans. The strongest evidence here is the concrete preference capture and enforced review contract, not the 3/3 acceptance count. The next useful validation is a small real-client pilot with a check that clients can explain their choice in their own words.

## Inspect or repeat

Full transcripts, Project Documents and confirmed summaries: [Lina](../runtime/concept-selection/lina.md), [Theo](../runtime/concept-selection/theo.md), [Amira](../runtime/concept-selection/amira.md). Companion JSON files retain plans, turns, concept seeds, choices and usage. Rendered images use `<client>-concept_<n>.png` in the same directory.

The manual runner needs the development key in `/tmp/interviewer-openrouter-key`; acquire it privately, never commit it, and remove it after the run. Run `bun .scratch/concept-selection/run.ts`, optionally followed by one client ID. Existing recordings can resume missing work. Archive recordings before changing prompts; do not overwrite a run with a different prompt version.

The new replays need those recordings and make no network requests:

```sh
bunx vitest run --config .scratch/concept-selection/replay.config.ts
```

![Actual concepts in the local comparison screen](../runtime/concept-selection/screenshots/style-comparison.jpg)

![Mobile review with reachable adjustment and confirmation actions](../runtime/concept-selection/screenshots/style-review-mobile.jpg)
