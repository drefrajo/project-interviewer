# Template-Driven Project Interviews

Status: ready-for-agent

## Problem Statement

The Creator needs a low-friction tool for selling fixed-scope website work: create an Interview from concise instructions, send one link, let an AI clarify what the Client wants, and receive an implementation-ready Project Submission.

The Client should not need an account, learn a project-management system, prepare website copy, upload files, or understand the implementation process. The product must stay focused on the shortest path from an invitation to accurate implementation direction.

## Solution

The product uses one small, linear workflow:

1. The Creator signs in, optionally selects an Interview Template, chooses the Client Language and Interview Model, edits non-empty Interview Instructions, and creates an Interview.
2. The Creator sends its unguessable Interview Link to one Client representative.
3. The selected Interview Model conducts a concise conversational Interview under a fixed Interview Policy, using no more structure than the Client needs.
4. When the model has enough information, it produces an implementation-ready Markdown Project Document, including first-draft website copy and explicit placeholders for unknown facts.
5. The Client either requests a document revision or continues.
6. The product generates a first batch of three deliberately distinct Visual Concepts and explains that they are rough directions rather than final designs. While only that batch exists, the Client may request one second batch of three.
7. The Client selects one concept from the available batch or batches, or supplies up to three inspiration links with a required note, and chooses **Submit project**.
8. The resulting Project Submission becomes immutable and visible to both parties. The Creator receives a minimal email notification and can download the handoff.

The application uses React, Convex, Better Auth, the Convex Agent component, the Convex rate-limiter component, OpenRouter, GPT Image 2, and Cloudflare Email Service. It is multi-tenant from the start but launches with allowlisted Creator registration.

## User Stories

1. As a Creator, I want to sign in with Google or GitHub, so that I can use an existing verified identity.
2. As a Creator, I want my first sign-in provider to remain the provider for my account, so that a matching email cannot silently link or duplicate accounts.
3. As a Creator, I want a clear message when I try the wrong provider, so that I know whether to continue with Google or GitHub.
4. As a Creator, I want registration restricted by a deployment allowlist at launch, so that I can operate the product privately before opening it to others.
5. As a Creator, I want to set a business or display name, so that Clients know who invited them.
6. As a Client, I want to see the Creator's business or display name and verified email address, so that impersonation is harder.
7. As a Creator, I want Interviews, Templates, and Settings in separate top-level tabs, so that account settings do not dominate normal work.
8. As a Creator, I want to create an Interview using only a project name, Client Language, Interview Model, optional template, and Interview Instructions, so that setup is fast.
9. As a Creator, I want the project name shown to the Client, so that the invitation is recognizable.
10. As a Creator, I want Interview Instructions to be required, so that an Interview cannot start without meaningful scope.
11. As a Creator, I want to edit Interview configuration until the first Client message, so that I can fix preparation mistakes without recreating it.
12. As a Creator, I want Interview configuration frozen after the first Client message, so that the Client's conversation cannot be reinterpreted under changed rules.
13. As a Creator, I want a newly created Interview Link to work immediately, so that there is no separate draft or publishing ceremony.
14. As a Creator, I want to copy an Interview Link with one action, so that I can send it through email or another channel.
15. As a Creator, I want to regenerate an Interview Link, so that I can invalidate a link that was exposed to the wrong person.
16. As a Creator, I want the old link invalidated immediately after regeneration, so that access remains under my control.
17. As a Creator, I want Interviews retained until I delete them, so that completed handoffs remain available without archive management.
18. As a Creator, I want deletion to require explicit confirmation, so that I understand it is immediate and irreversible.
19. As a Creator, I want deletion to remove the Interview, Interview Link, transcript, Project Document, Visual Concepts, and Project Submission data, so that no orphaned Client data remains.
20. As a Creator, I want to see Interviews as Not started, In progress, Submitted, or Needs attention, so that I can scan what requires action.
21. As a Creator, I want an In progress Interview to show its current step, so that I can understand progress without opening the transcript.
22. As a Creator, I want to view the live transcript and current artifacts without joining the conversation, so that I can monitor progress without influencing it.
23. As a Creator, I want the transcript visually secondary to the handoff artifacts, so that implementation direction remains the focus.
24. As a Creator, I want to retry a failed AI operation from the dashboard, so that recoverable failures do not require database intervention.
25. As a Creator, I want one ZIP containing the Project Document, Visual Direction, all concepts, and transcript, so that implementation can start immediately.
26. As a Creator, I want individual Markdown and image downloads, so that I can use only the artifact I need.
27. As a Creator, I want to start from a Built-in Interview Template, so that common website offers require little repeated instruction writing.
28. As a Creator, I want built-in templates for a single-page business website, multi-page business website, and campaign landing page, so that the initial product covers its core offers.
29. As a Creator, I want built-in templates separately authored in English and German, so that their instructions are natural in both supported languages.
30. As a Creator, I want built-in templates to remain commercially neutral, so that product defaults do not impose my personal prices or revision policy on other Creators.
31. As a Creator, I want to create, rename, edit, and delete my Private Interview Templates, so that I can reuse my own offers and constraints.
32. As a Creator, I want to save current Interview Instructions as a new Private Interview Template, so that a useful setup becomes reusable.
33. As a Creator, I want a template to prefill rather than govern an Interview, so that I can customize the resulting instructions freely.
34. As a Creator, I want a warning before selecting a template replaces edited instructions, so that setup work is not lost accidentally.
35. As a Creator, I want existing Interviews to retain an instruction snapshot when a template later changes, so that active work remains stable.
36. As a Creator, I want a Private Interview Template to record its source language, so that translation behavior is predictable.
37. As a Creator, I want to trigger Template Translation manually, so that no translation cost or content change occurs without my action.
38. As a Creator, I want Template Translation to use DeepSeek V4 Flash without thinking regardless of the Interview Model, so that translation remains inexpensive.
39. As a Creator, I want language and continuation controls blocked while translation runs, so that I cannot create a mismatched Interview.
40. As a Creator, I want a warning when translating edited instructions, so that I know the current field—not the template's original text—will be translated.
41. As a Creator, I want translated instructions to remain an Interview edit unless I explicitly save a new template, so that translation does not mutate reusable content unexpectedly.
42. As a Creator, I want translation status visible only to me, so that the Client sees a coherent Interview rather than preparation mechanics.
43. As a Creator, I want to choose English or German as the Client Language independently of the template, so that every applicable template can serve either language.
44. As a Client, I want the welcome page, conversation, Project Document, and concept flow in one consistent language, so that I do not need to interpret mixed-language UI.
45. As a Creator, I want to choose GPT-5.6 Terra or DeepSeek V4 Flash per Interview, so that I control the cost and capability tradeoff.
46. As a Creator, I want the selected Interview Model fixed after the Interview begins, so that behavior does not change silently mid-conversation.
47. As a Creator, I want a warning when choosing DeepSeek for German, so that I can account for its less certain documented language support without blocking the choice.
48. As a Creator, I want a warning when DeepSeek may use a compliant route outside Azure or the EU, so that I make an informed privacy decision.
49. As a Client, I want to see the selected model family and a plain-language privacy link before starting, so that I understand which AI processes my responses.
50. As a Client, I want to be warned not to submit sensitive personal data, so that I can participate safely.
51. As a Client, I want to enter through one link without an account or identity form, so that starting the Interview takes almost no effort.
52. As a Client, I want the welcome page to identify the project and Creator, so that I can verify the invitation before responding.
53. As a Client, I want an approximate ten-minute expectation and a short explanation of the document-to-concepts flow, so that I know what participation requires.
54. As a Client, I want to be told that my responses will be shared with the named Creator, so that the audience is clear.
55. As a Client, I want to be told that Visual Concepts are rough directions and not final designs, so that I do not mistake them for promised deliverables.
56. As a Client, I want to start with one obvious action, so that no consent checklist or onboarding form slows me down.
57. As a Client, I want to leave and resume through the same Interview Link on any device, so that I can complete the Interview when convenient.
58. As a Client, I want the latest server state restored when I resume, so that I never depend on one browser's local data.
59. As a Client, I want a four-step Interview, Review, Concepts, and Submitted progress display, so that I understand where I am without being able to skip required steps.
60. As a Client, I want a normal text conversation, so that answering feels familiar rather than like completing a dynamic form.
61. As a Client, I want an initial broad question, so that I can explain the project in my own terms before the AI narrows it.
62. As a Client, I want subsequent batches limited to at most three closely related questions, so that responses remain quick and focused.
63. As a Client, I want detailed or sensitive questions briefly explained, so that I understand why the information matters.
64. As a Client, I want the AI to stop when it has enough implementation-relevant information rather than reaching a fixed question count, so that simple projects remain simple.
65. As a Client, I want optional Suggested Replies that insert editable text without submitting, so that common answers are faster without taking away control.
66. As a Client, I want to correct an earlier answer with an ordinary new message, so that I do not need a special correction workflow.
67. As a Client, I want my latest clear statement to take precedence, so that corrections affect the resulting Project Document.
68. As a Client, I want to paste existing identity text or other useful content into the conversation, so that it can inform the website copy.
69. As a Client, I want to provide public reference URLs while being told they are not read automatically, so that I do not assume the AI inspected them.
70. As a Client, I want the AI to write complete first-draft website copy, so that I am not burdened with copywriting.
71. As a Client, I want supplied identity text reused where appropriate, so that the output remains recognizable as my organization.
72. As a Client, I want the AI never to invent prices, addresses, certifications, testimonials, legal claims, or other business facts, so that plausible wording does not become misinformation.
73. As a Client, I want blocking unknowns asked about and non-blocking unknowns clearly marked, so that progress does not depend on unnecessary answers.
74. As a Client, I want low-risk recommendations and defaults called out for correction, so that the AI can be helpful without hiding assumptions.
75. As a Client, I want one readable Markdown Project Document rather than a structured requirements system, so that I can review the implementation direction directly.
76. As a Client, I want to request Project Document changes using one free-text field, so that revisions remain simple.
77. As a Client, I want each accepted revision to replace the current Project Document, so that there is only one version to understand.
78. As a Client, I want to continue to concepts when the Project Document is good enough, so that review does not become a formal approval process.
79. As a Client, I want a first batch of three visually and structurally distinct concepts generated from the confirmed Project Document, with the option to request one second batch while only the first exists, so that I can choose a meaningful rough direction without being pushed toward more generation when a concept already fits.
80. As a Client, I want each concept to have a name and one-sentence rationale, so that their differences are easy to compare.
81. As a Client, I want each concept to show a polished desktop homepage direction with enough lower-page context, so that I can judge the visual system without mistaking it for a complete site.
82. As a Client, I want successful concepts preserved when another concept generation fails, so that retrying does not waste completed work.
83. As a Client, I want to select the concept I prefer and optionally explain my choice, so that the Creator receives both the direction and nuance.
84. As a Client, I want to reject all concepts and provide up to three inspiration links plus a required note, so that I can supply a better visual reference without requesting endless generations.
85. As a Client, I want the final action called **Submit project**, so that it communicates a complete handoff rather than a narrow design approval.
86. As a Client, I want a clear warning that submission is final, so that I can review my Visual Direction before making the handoff immutable.
87. As a Client, I want the submitted page to show the Project Document, all concepts, my Visual Direction, note, and Creator contact details, so that I can verify what was handed off.
88. As a Client, I want the submitted Interview to be read-only, so that the Creator and I share one stable result.
89. As a Creator, I want a single email when a Project Submission is completed, so that I know when implementation can begin.
90. As a Creator, I want the email to contain only the project name, submitted status, and an authenticated dashboard link, so that private project content is not copied into email.
91. As a Creator, I want notification delivery failure not to block Project Submission, so that email infrastructure cannot trap the Client.
92. As a Creator, I want the dashboard to remain authoritative when email delivery is uncertain, so that retries cannot create duplicate submissions.
93. As a product operator, I want every AI request to require zero data retention, deny data collection, and disable fallback, so that routing never weakens the stated privacy posture.
94. As a product operator, I want an AI operation to fail visibly when no compliant route exists, so that privacy is not traded for availability.
95. As a product operator, I want only aggregate token, cost, timing, and error metadata stored, so that raw prompts and model responses are not duplicated in diagnostic logs.
96. As a product operator, I want generated images stored behind Interview authorization, so that bearer Interview Links are never leaked into image-provider requests.
97. As a product operator, I want AI-starting actions rate-limited per Interview Link, so that public links cannot create unbounded spend.
98. As a product operator, I want hard abuse ceilings for instruction length, message length, message count, document revisions, and note length, so that pathological sessions are bounded without imposing normal completion quotas.
99. As a product operator, I want a global OpenRouter spend ceiling, so that the launch cannot exceed the application-owned budget.
100. As a product operator, I want strict Content Security Policy without `unsafe-inline`, third-party analytics, or wildcard origins, so that the public Client surface has a small browser attack surface.
101. As a product operator, I want Client pages excluded from search indexing and referrer leakage, so that Interview Links are less likely to escape their intended context.
102. As a product operator, I want all rendered Markdown sanitized with raw HTML disabled and safe link handling, so that untrusted content cannot execute in either party's browser.
103. As a product operator, I want temporary AI failures retried twice before requiring human action, so that ordinary provider instability is handled without creating duplicate messages or artifacts.
104. As a product operator, I want concurrent submissions resolved by first-write-wins behavior, so that duplicate tabs cannot corrupt Interview state.
105. As a maintainer, I want README, setup, deployment, architecture, and domain documentation to describe only this product, so that there is one coherent source of truth.

## Implementation Decisions

- Adopt the canonical vocabulary in the domain glossary: Creator, Client, Interview Policy, Interview Template, Built-in Interview Template, Private Interview Template, Interview Instructions, Client Language, Interview Model, Template Translation, Interview, Interview Link, Interview Transcript, Suggested Reply, Project Document, Document Review, Visual Concept, Visual Direction, and Project Submission.
- Use three application-owned Convex tables:
  - `creatorProfiles` owns the Creator's auth identity reference and business/display name.
  - `interviewTemplates` owns Built-in and Creator-private template content, source language, ownership, and timestamps.
  - `interviews` owns the immutable configuration snapshot after start, Interview Link capability state, current product step, current Project Document, up to six bounded Visual Concept records across at most two batches, Visual Direction, Project Submission state, aggregate usage, and the current asynchronous operation/error state.
- Store each Interview Transcript in one Convex Agent component thread rather than duplicating messages in application tables.
- Store generated Visual Concept images in Convex storage and expose them only through authorized application reads.
- Use Better Auth with Google and GitHub OAuth. Do not support passkeys or account linking. Associate an account with the provider used on first registration; when the other provider presents the same verified email, show which provider owns the account instead of linking or creating a duplicate.
- Permit registration only for identities in deployment configuration during the private launch. Do not build an allowlist administration interface.
- Build a small authorized Convex API around Creator-owned Interview and template operations, Client bearer-link operations, Agent messages, Project Document review, Visual Direction, Project Submission, downloads, and deletion.
- Have React call the small Convex API directly. Use one Convex-backed browser runtime in every environment and no parallel local application mode.
- Keep only pure supporting modules where they deepen a real boundary: prompt construction and validation, status projection, safe Markdown rendering, and Project Submission ZIP assembly.
- Use deployment configuration—not product UI—for registration allowlists, built-in templates, supported languages, model routing/privacy requirements, provider credentials, and spend ceilings.
- Make the Creator application a simple tabbed interface with Interviews, Templates, and Settings. Settings contains only the editable business/display name and read-only verified email identity.
- Limit Interview creation to project name, explicit Client Language, explicit Interview Model, optional template, and non-empty Interview Instructions.
- Make selecting a template copy its content into Interview Instructions. Replacing non-pristine instructions requires confirmation. Later template changes never affect an existing Interview.
- Ship the three agreed Built-in Interview Templates with separately maintained English and German text. Treat Private Interview Templates as single-source-language content owned by one Creator, with no sharing, tags, versions, marketplace, or automatic mutation.
- Make Template Translation an explicit action over the current Interview Instructions. It always uses DeepSeek V4 Flash without thinking. Disable language and continuation controls while it runs. If the field differs from the selected template or a prior translation, warn that the current field is the translation source. Translation changes only the field; saving it as a template requires a separate action.
- Create and activate an unguessable Interview Link immediately with the Interview. The link is a bearer capability for start, resume, and read-only final viewing. Regeneration invalidates the prior capability. Links do not expire automatically.
- Freeze project name, Client Language, Interview Model, and Interview Instructions atomically with the first accepted Client message.
- Present Not started, In progress with a secondary step, Submitted, and Needs attention as computed dashboard labels rather than an additional business state machine.
- Use four linear Client steps: Interview, Review, Concepts, and Submitted. The server validates every transition; the UI does not permit step jumping.
- Show a minimal welcome page with project name, Creator business/display name and verified email, approximate duration, flow explanation, model family, privacy link, sensitive-data warning, sharing disclosure, and the rough-concept disclaimer. Require no Client name, account, checkbox, or separate consent form.
- Use a mobile-first chronological text transcript and one ordinary composer. The model may offer at most four Suggested Replies; selecting one inserts editable text and never submits it.
- Instruct the Interview Model to begin broadly and then ask at most three tightly related questions per message. Most ordinary website Interviews should finish in roughly five to eight batches, but sufficiency—not a count—determines completion.
- Treat all Creator and Client text as untrusted content below the fixed Interview Policy. The model must not reveal hidden policy or accept instructions to leave the narrow Interview workflow.
- Allow existing content to be pasted into Interview Instructions or Client messages. Store public URLs as text but do not crawl them, retrieve them, or claim they were read. Explicitly tell the Client when a supplied link was not inspected.
- Make the selected Interview Model responsible for the conversation, sufficiency decision, Project Document, revisions, and three separate Visual Concept prompts for each generated batch. Do not introduce separate planner, completion reviewer, evidence, finding, coverage, or document-generator roles.
- Use GPT-5.6 Terra at medium reasoning or DeepSeek V4 Flash with thinking at high effort for the full Interview. The model selected at creation remains pinned and never falls back to the other model.
- Route text, translation, and image requests through OpenRouter. Every request must require zero data retention, deny data collection, and disable provider/model fallback. If no compliant route is available, fail the operation.
- Permit a privacy-compliant DeepSeek route outside Azure or the EU only after the Creator acknowledges the warning. Also show a non-blocking Creator-only warning for German DeepSeek Interviews. Do not expose routing implementation details to Clients.
- Produce a single current Markdown Project Document. Its outline comes from Interview Instructions rather than a structured schema. For website work, it includes complete first-draft copy derived from supplied facts, identifies recommendations, asks for blocking facts, and leaves conspicuous placeholders for non-blocking unknown facts. It never invents factual or legal claims.
- Make Document Review a loop with **Request changes** and **Continue to concepts**. A free-text change request invokes the pinned Interview Model and replaces the current Project Document. There is no direct editing, version history, approval semantics, or separate Creator review gate.
- Generate a first batch of exactly three named, structurally and stylistically distinct Visual Concepts only after the Client continues from Document Review. While only that first batch exists and is ready, allow the Client to request one second batch of exactly three. Generate one prompt per concept using the pinned Interview Model, then render each independently with GPT Image 2 at 1536×1024.
- Frame each Visual Concept as a polished desktop homepage direction showing approximately the first viewport plus enough lower-page context to reveal the system. Do not present it as a full responsive design, wireframe, implementation, or final deliverable.
- Preserve successfully generated concepts when one fails. Retry only missing/failed concepts. Do not offer a third batch after six concepts exist; a first-batch retry removes the second batch and makes the second-batch option available again once the replacement first batch is ready.
- Require either one selected Visual Concept with an optional explanatory note or one to three valid HTTP(S) inspiration links with a required explanatory note.
- Make **Submit project** create the Interview's one immutable Project Submission atomically. First valid submission wins; later concurrent attempts receive current server state. After submission, the Client experience is read-only.
- Include the current Project Document, all generated Visual Concepts, Visual Direction, note, and complete Interview Transcript in the Project Submission. Do not create multiple submissions or post-submission revision workflows.
- Let the Creator download a ZIP containing readable Markdown/text metadata and original concept images, as well as individual Project Document, transcript, Visual Direction, and image files.
- Send one minimal Creator notification through the Cloudflare Email Service REST API after Project Submission commits. Include a stable Project Submission identifier in application delivery state and the email header. Retry definite failures twice; treat an ambiguous timeout as delivery unknown rather than risking a duplicate. Email failure never changes the submitted state.
- Use one scheduled, idempotent asynchronous operation at a time per Interview. Save the triggering input and pending operation transactionally before scheduling work. Retry temporary AI/image failures twice with the same pinned configuration; then expose **Try again** to the Client and Needs attention/retry to the Creator.
- Disable the active composer/action while its operation is pending. For concurrent Client writes, accept the first valid write and require other tabs to refresh to the resulting server state.
- Apply generous per-Interview-Link rate limits only to actions that can start billable AI/image work. Enforce hard ceilings of 50,000 characters for Interview Instructions, 10,000 characters for a Client message or document change request, 2,000 characters for a Visual Direction note, 60 Client messages, and 10 Project Document revisions.
- Record only aggregate token/cost totals and operational timing/error metadata needed to operate the product. Do not add activity, audit, evidence, raw provider-response, or prompt-log tables. Ensure logs never contain bearer Interview Links.
- Host the static React/Vite application on Cloudflare, use Convex for application/backend/storage/Agent/auth-component integration, OpenRouter for model access, and Cloudflare Email Service for notifications. Do not add a custom server, database, queue, object store, or Worker solely for email.
- Apply a strict Content Security Policy with no `unsafe-inline`, no wildcard sources where exact origins are possible, no inline styles, no style blocks, and no inline-script assumptions. Adapt React components accordingly. Permit only the exact application, Convex, auth, and authorized generated-image origins required at runtime.
- Set Client routes to `noindex` and a strict referrer policy. Do not add third-party analytics or scripts.
- Render Markdown with raw HTML disabled, sanitization enabled, safe HTTP(S)-only URL handling, and secure external-link behavior.
- Keep README, setup, launch, architecture, environment, data-model, and domain documentation limited to the product and architecture described by this specification.

## Testing Decisions

- Tests must protect externally observable behavior, an authorization/privacy boundary, or irreversible data behavior. Do not add tests merely because a module exists, do not test private implementation details, and do not repeat the same behavior at multiple layers.
- Use the existing highest runtime seam as the primary prior art: a Playwright browser test against the real React application and Convex development deployment. Keep one deterministic end-to-end happy path that proves a Creator can create an Interview, a Client can complete the Interview and Document Review, select a Visual Direction, submit the project, and the Creator can see and download the Project Submission. Replace external AI, image, and email calls at their narrow Convex boundary so the test is reliable and inexpensive.
- Add only focused Convex-boundary tests that cannot be proven safely or deterministically by the single browser flow. The necessary cases are Creator ownership, invalidated Interview Links, first-write-wins submission/idempotency, and irreversible cascading deletion. Combine related assertions into as few scenarios as practical.
- Add one small provider-request contract test because privacy flags and pinned model/reasoning configuration are invisible in the UI and materially affect the product promise. It should cover OpenRouter zero-retention/data-collection/fallback requirements and the minimal Cloudflare Email payload without making network calls.
- Verify strict CSP without `unsafe-inline` as part of the production-build/browser check rather than through component-level duplicates.
- Treat real-provider output quality as an opt-in launch evaluation, not a broad permanent test matrix. Before launch, exercise English and German once with each Interview Model and inspect one three-concept image run. Keep this outside the ordinary deterministic test suite unless a concrete regression proves automation is necessary.
- Retain only one accessibility pass over the main Client flow at mobile and desktop widths, integrated into the browser verification rather than duplicated across component tests.

## Out of Scope

- File uploads, document extraction, OCR, file summaries, embeddings, retrieval, Context Packs, and Project Material.
- URL crawling, website scraping, web research, or reading private Google Drive content.
- Shared Resources, credential sharing, password management, or integrations for transferring source material.
- Client accounts, Client identity collection, multiple Client respondents, response-device ownership, and explicit takeover flows.
- Creator teams, organizations, roles, shared ownership, account linking, passkeys, recovery codes, or support-assisted recovery.
- Creator intervention in an active Interview, manual message injection, structured findings, coverage dashboards, evidence provenance, or AI planning/reviewer roles.
- Creator-side Project Document editing, version history, formal approvals, contracts, signatures, or post-submission revisions inside the product.
- A third or later concept batch, final responsive designs, implemented websites, logos, brand identity generation, or arbitrary non-website concept pipelines.
- Automatic template translation, shared templates, template tags, template versions, a template marketplace, or templates selecting Client Language.
- More Client Languages than English and German.
- More Interview Models than GPT-5.6 Terra and DeepSeek V4 Flash, model changes after start, automatic fallback, or Client-selected models.
- PDF, Word, Google Docs, Google Drive, email-attachment, or live-document exports.
- Interview expiry, reminders, abandonment automation, archive/trash/recovery, duplication/cloning, or multiple Project Submissions.
- Product branding customization, custom Creator domains, custom email domains, or white-label Client pages.
- Public registration, subscriptions, billing, per-Interview Stripe Managed Payments, quotas, Creator-supplied provider keys, or an administration UI.
- Product analytics, third-party telemetry, activity feeds, audit logs, raw prompt logging, or diagnostic provider-response retention.
- Voice, audio, camera, screen sharing, rich-text editing, reactions, and dynamic form questions.
- A custom application server, custom database, external queue, separate object store, or Cloudflare Worker added only to send email.

## Further Notes

- ADR-0001 records the template-driven Interview architecture.
- ADR-0002 records the two pinned Interview Models, reasoning modes, privacy routing, and fixed image renderer.
- Product and operational documentation use the same domain vocabulary and describe only the system defined here.
- “Good enough” means the Project Document gives the Creator enough accurate direction and first-draft copy to begin implementation immediately, while visibly separating unknown Client facts from model recommendations.
