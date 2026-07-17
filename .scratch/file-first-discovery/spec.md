# File-First Discovery MVP

Status: Agreed  
Planning completed: 2026-07-17

## Related documentation

- [Domain language](../../CONTEXT.md)
- [Architectural decisions](../../docs/adr/)

The terms in `CONTEXT.md` are canonical. In particular, a Client request is not automatically a Requirement: discovery produces Candidate Requirements, Freelancer review produces Proposed Requirements, and Client Approval produces Agreed Requirements for discovery purposes only.

## Summary

Project Interviewer helps a software Freelancer turn Project Material and a focused AI-guided Discovery Interview into a concise, source-linked Project Brief that both the Freelancer and Client can understand.

The MVP is deliberately file-first:

1. A Freelancer creates a Project Room and shares an Invite Link.
2. The Client supplies Project Material, or explicitly continues without files.
3. The system processes and shallowly analyzes each file.
4. It creates an immutable Context Pack Revision.
5. An Interview Plan guides a focused Discovery Interview.
6. The interview extracts source-linked Candidate Requirements, Assumptions, Risks, Gaps, and Contradictions.
7. A separate Brief Generator creates a structured Brief Draft.
8. The Freelancer edits and sends a frozen Review Version.
9. The Client approves it or submits one Change Request.
10. The Project Room remains available as the Project Home and Shared Resource destination.

The Project Home is not the product thesis. Its MVP purpose is to give the completed project a durable destination for the approved brief and immediately shared links or non-secret notes.

## Product hypothesis

A Freelancer can turn imperfect Client files plus a focused AI interview into a Client-approved Project Brief that is more complete, asks fewer redundant questions, and requires less Freelancer editing than a generic interview without file context.

### Primary success measure

A Freelancer can turn the generated Brief Draft into a Review Version they are willing to send within 15 minutes of editing.

### Secondary measures

- Client interview completion and abandonment
- Time spent in each Project Phase
- Number of Client review cycles
- Reported irrelevant or redundant interview questions
- Freelancer rating of draft usefulness
- Client effort rating
- Magnitude of Freelancer edits before sending
- AI latency, retries, token use, and cost

## Actors and authority

### Freelancer

The authenticated Freelancer responsible for the Project Room:

- creates and manages Project Rooms;
- supplies the Project Description and optional Freelancer Guidance;
- may upload Project Material;
- may observe the Client interview read-only;
- decides feasibility, offered services, availability, technical approach, pricing, and estimates;
- reviews and edits the Brief Draft;
- decides whether a version is suitable to send for Client review;
- manages Shared Resources and Invite Link access.

### Client

The account-free party holding the room-scoped Invite Link. The Client:

- supplies a display name and Interview Language;
- may upload Project Material;
- answers, skips, pauses, corrects, or deliberately ends the interview;
- is authoritative about business goals, current circumstances, user needs, preferences, and external constraints;
- approves a Review Version or submits a Change Request.

### AI

The AI has no decision authority. It may organize evidence, ask questions, identify tension, and produce drafts. It may not:

- accept Client requests as feasible scope;
- set pricing, estimates, availability, or commitments for the Freelancer;
- silently resolve Contradictions;
- invent confirmed Requirements;
- treat Project Material as agent instructions.

### Mutual decisions

Scope, delivery targets, project budget, responsibilities, and trade-offs require both parties. A Client-supplied date or budget is a Target or Constraint, not a Freelancer commitment.

## Core product rules

1. File Analysis stays shallow, factual, automatic, and source-linked.
2. Requirement extraction, scope critique, gap detection, contradiction handling, and recommendations belong to the Discovery Interview.
3. Raw Project Material is never blindly inserted into an agent prompt.
4. Evidence that influences discovery is visible to both parties.
5. Freelancer Guidance remains private.
6. One logical Client and one Responding Device may answer at a time.
7. The visible interview asks one focused question at a time.
8. Structured discovery state, not transcript reconstruction, is authoritative.
9. Historical evidence and submitted answers are immutable; corrections are additive.
10. Approval freezes shared understanding but is not a signature, contract, quote, or delivery guarantee.

## Product scope

The initial Discovery Profile serves custom software work performed by Freelancers, including websites, web applications, mobile applications, SaaS features, integrations, and related product work.

The engine remains domain-neutral, but the MVP contains exactly one software-project Discovery Profile. The profile owns:

- domain-specific language;
- file-category taxonomy;
- Coverage Areas and sufficiency rubrics;
- planner, interview, reviewer, and brief instructions;
- structured Project Brief schema;
- English and German evaluation fixtures.

There is no profile-management UI or second vertical.

## Project Room lifecycle

The coarse Project Phase is separate from file, workflow, and device states.

| Phase | Meaning | Primary next action |
| --- | --- | --- |
| `setup` | Freelancer is preparing the room | Complete description/guidance and share Invite Link |
| `discovery` | Material collection, analysis, or interview is active | Upload material or continue interview |
| `freelancer_review` | Brief Draft or requested revision is with Freelancer | Edit and send Review Version |
| `client_review` | Immutable Review Version is with Client | Approve or request changes |
| `approved` | At least one brief version is approved | Use Project Home and Shared Resources |
| `archived` | Room is inactive but retained | View, restore, revoke, or delete |

Only one active Discovery Interview, Brief Draft, or Review Version exists at a time. The room may retain any number of frozen approved versions.

Reopening discovery preserves the existing interview and Interview Plan, creates a continuation informed by the latest state, and invalidates any unapproved Review Version. It does not erase prior answers or branch into a second interview.

## Freelancer experience

### Freelancer Workspace

After sign-in, the Freelancer sees a simple list of Project Rooms with:

- project title;
- Client label;
- Project Phase;
- last activity;
- next required action.

The workspace supports create, open, search, phase filter, archive, restore, delete, and Recently Deleted. It is not a kanban board, calendar, or portfolio analytics product.

### Create Project Room

Required inputs:

- project title;
- Client name or label;
- Project Description;
- Brief Language;
- software-project Discovery Profile.

The Project Description is Client-visible and should be roughly one to three short paragraphs describing what the Freelancer currently understands. It is initial evidence, not unquestionable truth.

Optional Freelancer Guidance may include:

- services offered;
- explicit exclusions;
- known project facts;
- earliest availability;
- budget floor or expected range;
- delivery constraints;
- areas the interview should emphasize.

Freelancer Guidance is project-specific, private, and not an account-wide Freelancer profile.

### Share room

The Freelancer generates and shares an unguessable Invite Link. The product does not send an invitation email in the MVP.

The Freelancer may upload Project Material before or after sharing the link.

## Client experience

### First visit

The first Invite Link visit shows:

- project and Freelancer identity;
- short explanation of the process;
- who can view the files and interview;
- third-party AI processing disclosure;
- supported formats and limits;
- warning about secrets and default redaction behavior;
- display-name input;
- Interview Language selection;
- one concise acknowledgement.

After onboarding, the Client enters the phase-aware Project Home and proceeds to Project Material.

### Repeat visits

The same Invite Link always opens the Project Home rather than forcing the Client into the interview.

The home presents the most relevant next action:

- incomplete discovery: `Continue interview`;
- Client review: `Review Project Brief`;
- approved: approved brief and Shared Resources;
- archived: read-only home while the link remains active.

The first onboarding flow may redirect automatically. Subsequent visits do not.

### Client navigation

The minimal views are:

- Overview
- Project Material
- Discovery Interview
- Project Brief
- Shared Resources

Unavailable sections explain when they become available rather than disappearing. Mobile layouts may use cards or a menu instead of persistent tabs.

## Authentication and access

### Freelancer identity

Use Better Auth integrated with Convex.

Supported methods:

- initial account creation through Google or GitHub OAuth;
- standalone passkey sign-in after registration.

Passkeys are primary sign-in methods, not second factors. A Freelancer may unlink the final OAuth provider only after registering at least two passkeys. The last remaining authentication method cannot be removed.

Recovery codes, password login, email codes, organizations, and support-assisted recovery are outside the MVP.

Provider linking is explicit from an authenticated account. Accounts are not automatically merged merely because OAuth providers report the same email.

### Client access

- Clients do not have accounts.
- Possession of the Invite Link grants room-scoped Client access.
- Invite tokens are hashed at rest and excluded from logs and analytics.
- A link has no automatic expiry while the room is active.
- The Freelancer may rotate or revoke it at any time.
- The same active link permits later Project Home access.
- Revocation immediately prevents new reads, writes, uploads, takeovers, and AI operations authorized by that link.

Client Approval records the supplied display name, device, and timestamp but is not strong identity verification.

### Responding Device

The first device to press `Start` or `Resume interview` receives response permission. Merely loading the link never claims it.

- A persistent device identifier is shared by tabs on that device.
- The Responding Device maintains a heartbeat.
- Other devices see the live transcript and current operation read-only.
- Another device may explicitly take over after a warning.
- Takeover invalidates the old device's unsubmitted local draft.
- The server accepts only one answer for the current question.
- Repeated tabs or clicks cannot double-submit.

## Project Material

### Supported formats

- PDF
- DOCX
- PPTX
- XLSX
- CSV
- TXT
- Markdown
- PNG
- JPEG
- WebP

Excluded:

- archives;
- audio or video;
- design-tool project files;
- source-code repositories;
- raw repository trees.

Clients may export unsupported material to PDF or images.

### Initial limits

- 20 files per Project Room
- 25 MB per file
- 100 MB total per Project Room

Limits are developer-configurable and validated before upload where possible.

### No-file path

Project Material is encouraged but not required. The Client may explicitly choose `I don't have project files`.

If neither Project Material nor Freelancer Guidance exists, both parties are warned that discovery begins with minimal context and may take longer. The Discovery Profile still supplies Coverage Areas.

### Upload permissions and visibility

- Both Freelancer and Client may upload.
- Each file records its uploader.
- All Project Material influencing discovery is visible to both parties by filename, uploader, analysis, and authorized source excerpt.
- Hidden evidence files do not exist in the MVP; private constraints belong in Freelancer Guidance.

### Processing pipeline

File Processing and File Analysis are distinct:

1. authorize upload;
2. store raw file in Convex File Storage;
3. validate size, extension, and actual content type;
4. extract normalized content in a Convex Node action through a parser adapter;
5. run deterministic suspected-secret scanning on extractable text;
6. redact suspected spans from outbound AI input by default;
7. run shallow LLM File Analysis through the configured AI adapter;
8. create source-located chunks and embeddings;
9. update the Context Pack Revision.

Initial parsers run inside the application infrastructure. A document-parsing SaaS is not part of the MVP.

Images are disclosed as being sent in full to the configured multimodal provider. The MVP does not gate image processing on OCR because OCR neither applies to every image nor proves the absence of visual secrets.

### Secret handling

Shared Resources categorically prohibit passwords, API keys, tokens, or other secrets.

For Project Material:

- upload and extraction never fail solely because a secret is suspected;
- deterministic patterns and entropy checks identify likely text spans;
- suspicious spans are masked in outbound AI input by default;
- the rest of the file is analyzed immediately;
- the uploader sees safely masked matches and a warning;
- the uploader may explicitly include flagged text in AI analysis;
- the override is audited and discloses that OpenRouter and a routed provider receive the text;
- the workflow never forces delete/re-upload merely to continue;
- users are encouraged to sanitize or remove genuine secrets.

Automated detection is a safety feature, not a guarantee.

### Analysis states

Each uploaded file reaches one terminal state:

- `analyzed`
- `unsupported`
- `failed`

The interview may start after every current file is terminal. Failed files do not block forever: the Client can retry, remove, or deliberately continue without them.

### File Analysis contract

File Analysis is shallow and factual. It returns:

- short file summary;
- primary category;
- optional secondary categories;
- confidence;
- source-located key signals;
- language and extraction metadata;
- processing/model/schema versions.

Software-profile categories:

- `brief`
- `requirements`
- `design/reference`
- `technical`
- `commercial`
- `timeline`
- `other`

`Other` is valid; the analyzer does not force a guess.

File Analysis must not perform:

- deep requirement extraction;
- gap analysis;
- contradiction detection;
- scope critique;
- feasibility judgment;
- final recommendations.

Signals remain source-scoped. For example, “Proposal.pdf states a €10,000 budget” is evidence, not automatically project truth.

### Provenance

Every summary claim and key signal retains the best available locator:

- page;
- slide;
- sheet/cell range;
- image;
- paragraph or text range.

### Analysis Feedback

Either party may flag File Analysis as inaccurate with a short explanation. The feedback:

- is human-authored and source-linked;
- joins the next Context Pack Revision immediately;
- remains alongside the original analysis;
- does not rewrite Project Material or the original output;
- does not automatically spend another AI call.

The Freelancer may explicitly request reanalysis later.

### Late Project Material

Project Material may be added between interview questions.

1. The next answer is temporarily unavailable while the new file is processed.
2. Successful analysis creates a new Context Pack Revision.
3. The transcript shows a system event.
4. The next agent call receives a typed `ProjectMaterialAdded` event with file identity and revision.
5. The agent checks whether the material answers or changes the open topic.
6. Earlier Interview Turns retain their original Context Pack Revision.

The interview does not restart and the agent does not blindly summarize the whole file to the Client.

### Removal

- Before the interview starts, the uploader may remove their file.
- After a file informs an Interview Turn, removal requires the Freelancer.
- Removal creates a new Context Pack Revision.
- File-derived content is purged from future retrieval.
- Historical references remain but are marked unavailable.
- Affected findings are flagged for Freelancer review.
- Transcript history is never rewritten.

### Raw file access

The MVP does not expose raw Convex storage URLs or provide raw-file downloads. Storage IDs stay server-side. Both parties use authorized summaries and excerpts.

## Context Pack

The Context Pack is a compact evidence map, not the full project context.

Each immutable revision contains:

- global project summary;
- analyzed file list;
- source-linked file summaries;
- inferred categories and confidence;
- source-scoped key signals;
- likely project type when obvious;
- notable project signals;
- Analysis Feedback;
- revision reason and included material IDs.

Every Interview Turn records the revision it used.

Cross-file synthesis may summarize themes but may not label or resolve Contradictions before the interview.

## Retrieval and file-inspection tools

The Interview Agent receives the current Context Pack directly and may escalate through:

1. list Project Material;
2. get file summary;
3. search source-located excerpts;
4. inspect bounded relevant content.

Retrieval uses application-owned chunks with full-text and multilingual vector indexes. Search is always scoped to one Project Room and active Project Material.

Tool output is bounded, source-located, and treated as untrusted evidence. Raw file content is never wholesale prompt context.

## Discovery Interview

### Interview Plan

At the start of discovery, an Interview Planner creates an internal structured plan from:

- Discovery Profile;
- Project Description;
- current Context Pack;
- Freelancer Guidance.

The plan contains:

- project-specific Coverage Areas;
- existing evidence;
- sufficiency criteria;
- open goals;
- known Risks, Gaps, or potential tensions.

It is not a fixed or prewritten question list. It evolves with the interview.

The planner has a separate developer-controlled model configuration. It may use a stronger model than the File Analyzer if evaluation shows that the one-time cost improves downstream coverage and reduces wasted questions.

### Coverage

Each Coverage Area has:

- profile-defined rubric;
- status: `uncovered`, `partial`, `sufficient`, or `not applicable`;
- evidence;
- rationale;
- open questions.

A Gap can count as addressed when the Client genuinely cannot answer, provided the uncertainty and consequence are explicit. “Sufficient” does not mean every unknown has disappeared.

### Turn behavior

Each visible turn asks one focused question.

The agent:

- avoids information plainly available in current evidence;
- uses a concise bridge from the prior answer;
- asks one precise follow-up when an answer is vague or incomplete;
- records a Gap or Assumption and moves on if the follow-up remains unresolved;
- may revisit critical issues near completion;
- never traps the Client in a loop;
- stays in the selected Interview Language unless the Client explicitly switches.

Target experience:

- roughly 15–25 minutes;
- roughly 12–20 primary questions;
- follow-ups as needed.

These are UX targets, not completion rules.

### Structured state

Every turn atomically updates:

- current question and accepted answer;
- Context Pack Revision;
- Coverage Area deltas;
- Discovery Findings;
- unresolved topics;
- reason for the next question;
- completion assessment;
- model/prompt/schema metadata.

The transcript is not the only memory.

### Discovery Findings

Allowed types:

- Candidate Requirement
- Assumption
- Risk
- Gap
- Contradiction

Every finding links to one or more:

- file locators;
- Interview Turns;
- Interview Corrections;
- Analysis Feedback;
- explicit model inference marker.

Model inference is never represented as a Client statement.

### Requirements and feasibility

Client-supplied capabilities, qualities, or constraints begin as Candidate Requirements.

The Interview Agent may:

- distinguish Target from Constraint;
- ask why a boundary is hard;
- ask what can flex among scope, quality, cost, and timing;
- flag internal tension;
- record a Risk or Gap for Freelancer review.

It may not:

- claim to know the Freelancer's availability or price;
- declare a project feasible or infeasible on the Freelancer's behalf;
- convert “€10 and two weeks” into agreed budget or delivery.

### Contradictions

The agent presents conflicting claims neutrally with their sources and asks the Client to resolve them. It preserves:

- original incompatible claims;
- resolution or explicit non-resolution;
- supporting Interview Turn.

It never silently chooses one source.

### Client controls

- `Skip`: records an unresolved Gap.
- `Pause`: persists all submitted state.
- `Finish early`: requires confirmation and produces a visibly incomplete Brief Draft.
- `Correct an earlier answer`: creates an immutable Interview Correction.

Submitted Interview Turns never mutate. A correction marks affected findings and coverage for reassessment, while the original answer remains visible as superseded.

### Completion review

The Interview Agent proposes completion only when:

- required Coverage Areas are sufficient, not applicable, or explicitly unresolved;
- important Contradictions are resolved or explicitly open;
- no unacknowledged blocking omission remains.

A separate read-only Interview Reviewer runs:

- when the Interview Agent proposes completion; or
- at the soft 40-answer usage checkpoint.

The reviewer sees structured state, Context Pack, and profile rubric. It returns missing or weak areas but cannot edit domain state or speak to the Client.

Final completion requires:

1. Agent sufficiency assessment;
2. reviewer finding no unacknowledged blocker;
3. final “anything else?” question;
4. Client confirmation.

Forty answered turns never terminates the interview. It triggers review and an internal usage warning; quality controls completion. Ordinary rate limits still prevent rapid abuse.

## Project Brief

### Generation

A separate Brief Generator runs after interview completion or deliberate early finish. It consumes:

- latest Context Pack Revision;
- structured Interview Plan and coverage;
- source-linked Discovery Findings;
- relevant interview history.

It may inspect bounded evidence but may not create a new confirmed Requirement.

If it notices a new conclusion, it surfaces it as an inference or Gap for Freelancer review.

### Default structure

1. Executive summary
2. Project goals and measurable success signals
3. Users and stakeholders
4. In scope
5. Out of scope
6. Functional Requirements
7. Quality requirements and constraints
8. UX, content, and design expectations
9. Data and integrations
10. Client targets and external constraints
11. Freelancer-confirmed delivery/commercial parameters
12. Still-open trade-offs
13. Assumptions
14. Risks
15. Gaps and unresolved Contradictions
16. Key decisions
17. Evidence appendix

Unsupported sections say `Not established`; the generator does not invent filler.

### Requirement quality

- One independently understandable capability, quality, or constraint per item.
- Testable when evidence supports that precision.
- No invented acceptance criteria.
- Separate scope status: `in scope`, `out of scope`, or `open`.
- Record priority only when established; otherwise `not established`.
- This is a discovery brief, not a backlog or implementation specification.

### Candidate → proposed → agreed

1. Interview extracts Candidate Requirements.
2. Freelancer review excludes, marks out of scope, edits, or promotes them.
3. Items in a Review Version are Proposed Requirements.
4. Client Approval makes them Agreed Requirements for discovery purposes.

None of these transitions creates contractual commitments.

### Concision and readability

The compact brief should take about 5–10 minutes to read, usually around 1,000–2,000 words when the project warrants it.

- Client-facing language remains understandable.
- Technical detail may assume more Freelancer knowledge but must not become gratuitous.
- Evidence and detail use progressive disclosure.
- The brief is not long for its own sake.

### Provenance

Complete traceability is retained internally.

The review UI shows unobtrusive source chips opening:

- relevant Interview Turn;
- file excerpt;
- Analysis Feedback;
- Freelancer-authored edit.

Exports keep the main document readable and move detailed citations to the evidence appendix.

### Explicit exclusions from generated content

Unless supplied and mutually established, the brief contains no:

- binding quote;
- delivery guarantee;
- legal term;
- invented budget;
- detailed technical architecture;
- task-level implementation plan.

### Freelancer editing

The Brief Draft uses a structured editor. The Freelancer may:

- edit free text within sections;
- add, remove, reorder, or reclassify items;
- change scope status;
- resolve or acknowledge feasibility flags;
- retain or remove evidence links;
- add Freelancer-authored material.

No arbitrary page builder or AI-assisted section regeneration exists in the MVP.

Before sending, the UI highlights unresolved:

- feasibility;
- scope;
- budget;
- timeline;
- responsibility;
- critical Gap or Contradiction.

The Freelancer resolves each or explicitly acknowledges it remains open. `Send for Client review` means the complete version is suitable to propose as shared understanding, not that it is a legal guarantee.

### Client review

A Review Version is immutable.

The Client can:

- inspect source evidence, Project Material, File Analysis, and read-only transcript;
- approve;
- submit one Change Request.

The Change Request remains editable until the Freelancer clicks `Acknowledge and begin revision`. That action freezes its version history and returns the room to Freelancer review. A new Change Request becomes possible only against the next Review Version.

### Approval and reopening

Approval:

- records the exact Review Version, display name, device, and timestamp;
- freezes it;
- leaves prior approved versions accessible;
- is not a signature or contract.

Editing an approved brief creates a private Brief Draft based on it. The Client continues seeing the last approved version until a new Review Version is sent.

### Exports

- print-friendly/PDF export;
- Markdown export.

DOCX, Notion, and integration-specific exports are outside the MVP.

## Project Home and Shared Resources

The Project Home is available throughout the room lifecycle.

Shared Resources:

- may be added in any Project Phase;
- appear to the Client immediately;
- are managed only by the Freelancer;
- support label, URL, non-secret note, and optional non-secret username/account identifier;
- may be reordered or removed without reopening the brief.

Passwords, API keys, tokens, or other secrets are never valid Shared Resources. Use an external password manager.

The Project Home does not include tasks, chat, calendars, integrations, or project-management features.

## Multilingual behavior

Tested MVP languages:

- English, default and fallback;
- German.

The Client selects Interview Language during onboarding. The Freelancer selects Brief Language per project, defaulting to Interview Language.

Project Material may mix languages.

- Source chunks and excerpts remain in their original language.
- A multilingual embedding model supports cross-language retrieval.
- Context Pack prose and Project Brief use Brief Language.
- The Interview Agent uses Interview Language.
- UI copy is localized for English and German.

English and German share identical hard safety, traceability, authorization, and non-fabrication gates. English may reasonably outperform German on softer quality scoring; launch evaluation uses an absolute usefulness threshold for each language rather than demanding score parity.

## Accessibility and responsive design

Uploading, interviewing, reviewing, and approving must work in modern mobile and desktop browsers.

Requirements:

- phone-first responsive layouts;
- keyboard-complete operation;
- screen-reader labels;
- live-region operation/progress updates;
- visible focus;
- reduced-motion support;
- WCAG 2.2 AA color and interaction targets.

## Responsive AI experience

Accepted uploads and answers appear immediately and persist before expensive AI work begins.

Visible workflow states include:

- Uploading
- Checking file
- Extracting content
- Analyzing
- Preparing interview
- Reviewing your answer
- Checking project material
- Preparing the next question
- Generating brief
- Taking longer than expected
- Retry available

These are real workflow stages, not generated chain-of-thought narration.

Target latency, not SLA:

- upload/answer visibly accepted within 500 ms;
- typical next question median under 8 seconds;
- typical next question 95th percentile under 20 seconds;
- `Taking longer than expected` after 15 seconds;
- typical file analysis under 60 seconds per file;
- typical Brief Draft under 60 seconds.

LLM latency is variable. Missed targets never lose state or imply failure. The user may safely navigate away and return.

No token-by-token question streaming exists initially. The structured turn is generated, validated, committed, and then revealed atomically.

No email or push notifications exist in the MVP.

## Technical architecture

### Tooling

- Bun and Bunx for JavaScript/TypeScript operations
- TypeScript
- Vite React SPA
- shadcn/ui
- Cloudflare Workers static SPA hosting with history fallback
- no Cloudflare-specific application APIs, preserving Netlify/Vercel portability

### Backend

Convex provides:

- database and reactive queries;
- File Storage;
- queries and mutations;
- Node actions;
- durable Workflow/Workpool execution;
- full-text search;
- native vector search;
- scheduled deletion;
- deployment logs and usage limits.

Convex remains the system of record. Workflow/UI libraries never become domain-state authorities.

### AI boundary

All AI roles call an application-owned OpenAI-compatible adapter supporting the broadly portable subset needed for:

- chat;
- tool calls;
- structured output;
- embeddings;
- multimodal input.

OpenRouter is the initial gateway.

The OpenRouter adapter:

- sends `zdr: true`;
- sends `data_collection: "deny"`;
- permits provider fallback only among developer-allowed ZDR endpoints for the configured model;
- records the actual model/provider used;
- does not dynamically query or verify provider policy metadata.

Deployment configuration is responsible for selecting models/providers that meet no-train/ZDR expectations.

End users cannot select models or edit prompts. Only the application developer changes role configuration.

### AI roles

- File Analyzer
- Interview Planner
- Interview Agent
- Interview Reviewer
- Brief Generator
- Embedding model

Roles are configured independently but may initially share one capable multilingual structured-output model. The planner can later use a more advanced model when evaluation proves value. The File Analyzer is the first candidate for a cheaper model because its task is shallow and factual.

Every model change must pass English/German fixture evaluation before production.

### Prompt and schema versioning

Every AI operation stores:

- operation type;
- model and routed provider;
- prompt/Discovery Profile version;
- schema version;
- Context Pack Revision;
- token usage;
- latency;
- attempt count;
- success/failure.

Raw prompts are not duplicated into logs.

Structured output is validated before domain writes. One automated repair attempt may receive validation errors. A second failure becomes a terminal retryable operation. Invalid partial state is never committed.

### Durable workflows

File analysis and brief generation use durable Convex workflows with idempotent steps and bounded retries.

Interview answer flow:

1. mutation authorizes Responding Device and current question;
2. answer and pending operation commit atomically;
3. asynchronous workflow invokes tools/LLM;
4. validated state delta and exactly one next question commit atomically;
5. reactive UI receives the result.

An ambiguous network failure never causes a second committed answer or question.

### Concurrency

- Different files process concurrently with a small developer-configurable worker limit.
- Only one AI operation may mutate an interview at once.
- An answer must match the current question, Context Pack Revision, and Responding Device.
- Late Project Material finishes processing before the next answer is accepted.
- Brief generation requires stable completed interview state.
- Repeated actions reuse the existing idempotent operation.

### Parsing

An application-owned parser adapter runs in Convex Node actions.

Initial local parsers cover the supported text/document formats. Images use the configured multimodal model after the product disclosure.

Extraction failure enters the ordinary failed-file path rather than silently falling back to uncontrolled raw prompt injection.

### Retrieval

Application-owned source chunks remain canonical.

- full-text index for exact language/term matches;
- multilingual vector index for semantic/cross-language matches;
- room and active-material filters on every search;
- search only from authorized Convex actions;
- source locators preserved in results.

The Convex Agent or RAG components may help at an edge but cannot own canonical interview or retrieval state.

## Persistence model

Canonical groups:

### Identity and access

- Better Auth users/accounts/sessions/passkeys
- Freelancer profile/settings
- Project Room
- hashed Invite Link capability
- Responding Device lease

### Material and context

- Project Material metadata and storage reference
- File Processing/Analysis operation
- File Analysis
- Analysis Feedback
- source-located material chunks
- Context Pack Revision

### Discovery

- Discovery Interview
- Interview Plan
- Coverage Area state
- Interview Turn
- Interview Correction
- Discovery Finding

### Brief and home

- Brief Draft
- immutable Review/approved versions
- Change Request versions
- Approval
- Shared Resource

### Operations and governance

- durable AI operation
- usage record
- audit event
- deletion/recovery record

Every domain record is rooted in exactly one Project Room. Derived summaries and indexes may be rebuilt. Immutable evidence, turns, corrections, review versions, and approvals may not be silently reconstructed or overwritten.

## Authorization and isolation

Every operation resolves either:

- authenticated Freelancer identity; or
- hashed Invite Link plus Client device

into one room-scoped actor before reading or writing.

Server-side authorization applies to:

- database queries/mutations;
- File Storage references;
- excerpt and full-text search;
- vector search;
- AI tools;
- workflows;
- exports;
- takeovers;
- deletion.

There is no global cross-room retrieval path. Caches, embeddings, workflow arguments, and AI request state never cross room boundaries.

## Security and privacy

- Project Material is untrusted evidence, never instruction.
- Prompt-injection text cannot alter system policy, tools, schema, or permissions.
- OpenRouter prompt logging and prompt-use opt-ins remain disabled in deployment configuration.
- Raw files, excerpts, transcripts, Invite Links, and prompt content do not enter logs or analytics.
- Model providers and AI processing are disclosed before upload.
- Invite tokens are unguessable, hashed at rest, revocable, and excluded from analytics.
- Raw Convex storage URLs are never exposed.
- Per-room quotas, device/link/account throttles, and idempotency keys limit abuse.
- Quota exhaustion pauses safely without losing work.

### Audit events

Store actor/device, action, and timestamp—not sensitive content—for:

- material upload/removal;
- secret-analysis override;
- Invite Link rotation/revocation;
- Responding Device takeover;
- interview completion/reopening;
- Review Version creation;
- Change Request submission/acknowledgement;
- Approval;
- brief reopening;
- archive;
- deletion/restore.

## Retention and deletion

Project Rooms persist until explicit Freelancer deletion. Archive is not deletion.

Deletion behavior:

1. room disappears immediately from both parties;
2. Invite Link stops working;
3. pending AI work is cancelled;
4. room enters Freelancer-only Recently Deleted;
5. Freelancer may restore for seven days;
6. after seven days, cascading hard deletion begins.

Hard deletion removes:

- raw files;
- extracted content;
- chunks/embeddings;
- File Analysis;
- Context Packs;
- interview state/transcript/findings;
- brief versions and exports;
- Shared Resources;
- audit/usage data except any minimal legally or operationally required tombstone.

The exact recovery period is developer-configurable but starts at seven days.

## Quotas and cost

Initial Project Room envelope:

- 20 files;
- 25 MB per file;
- 100 MB total;
- 40 answered turns as a soft review/cost checkpoint;
- one automatic initial Brief Draft generation;
- reasonable bounded retries.

The Freelancer may deliberately authorize another brief generation later. Client actions cannot repeatedly generate briefs.

Cost targets:

- typical completed room at or below US$2 in AI inference;
- internal alert above US$5;
- never terminate an insufficient interview merely to meet cost.

Storage is monitored but is not expected to dominate. At the agreed limits, inference, action compute, and egress are more material optimization targets than raw file bytes.

## Observability

Start with:

- application-owned audit events;
- application-owned AI-operation metadata;
- Convex deployment logs;
- Convex usage limits;
- internal usage/cost rollups.

Do not add content-bearing product analytics in the MVP. Add a scrubbed exception tracker only if pilot diagnostics prove Convex tooling insufficient.

## Evaluation

### Fixture policy

Use versioned synthetic and deliberately de-identified fixtures. Production Client content never enters evaluation by default.

Fixture set covers:

- website;
- SaaS feature;
- mobile application;
- integration;
- no Project Material;
- no Freelancer Guidance;
- German interview;
- mixed English/German material;
- conflicting files;
- missing information;
- unrealistic budget/timeline;
- late file;
- corrected answer;
- failed file;
- prompt-injection content;
- suspected secret;
- multi-device observer/takeover.

### Stage gates

#### File Analysis

- At least 95% of sampled factual claims supported by their cited source.
- No seeded deep scope critique, contradiction resolution, or invented recommendation.

#### Retrieval

- Relevant evidence appears in the first five results for at least 90% of fixture queries.
- Cross-language queries find relevant source-language evidence.
- No result can cross a Project Room boundary.

#### Interview

- No question asks for information plainly available in the current evidence.
- Seeded critical Contradictions and Gaps are surfaced.
- Vague answers receive bounded follow-up.
- Client requests do not become agreed scope.
- Late material and corrections affect subsequent reasoning without rewriting history.

#### Brief

- Zero unsupported Agreed Requirements.
- Every substantive claim is traceable.
- Unresolved critical items remain prominent.
- No invented price, deadline, architecture, or legal commitment.
- Core brief remains within the agreed readability target.

#### Language

- English and German each pass the same hard safety and traceability gates.
- Each language meets an absolute human usefulness threshold.
- English may score higher; parity is not a launch requirement.

#### State and security

- No lost or duplicated answer/next question.
- Invite Link revocation blocks subsequent access.
- Device takeover cannot double-submit.
- Workflow retry is idempotent.
- Deletion and recovery follow lifecycle.

### Production feedback

Optional, terse feedback:

- Client question relevance thumbs-up/down;
- Client end-of-interview effort;
- Freelancer draft usefulness;
- missing/incorrect section report;
- time from Brief Draft to Review Version.

Content is not copied into analytics.

## Pilot and launch criteria

Run at least five end-to-end pilot projects:

1. no-file project;
2. German project;
3. conflicting-material project;
4. late-upload project;
5. unrealistic-constraint project.

For each, the Freelancer must be able to send a satisfactory Review Version after no more than the targeted 15 minutes of editing.

### Launch blockers

The MVP must not launch with:

- cross-room data leakage;
- unsupported confirmed brief claims;
- lost or duplicated Interview Turns;
- unrecoverable workflow state;
- broken Invite Link revocation;
- broken deletion boundary;
- inability to complete the core flow on mobile;
- inability to complete the core flow in English or German.

Minor category/summary errors may ship only when visible, correctable through Analysis Feedback, and measured.

## Implementation milestones

### 1. Foundation

Deliver:

- Bun/Vite React/shadcn SPA;
- Cloudflare Workers static deployment;
- Convex schema and environment separation;
- Better Auth Google/GitHub/passkey flow;
- Freelancer Workspace;
- Project Room creation;
- Project Description and Freelancer Guidance;
- Invite Link authorization, rotation, and revocation;
- phase-aware Project Home shell.

Exit criterion: Freelancer can create a room, share it, Client can onboard, and both see the same phase-aware room state.

### 2. Project Material

Deliver:

- direct authorized upload;
- format/size validation;
- parser adapter;
- text secret scanning/redaction/override;
- durable File Processing and File Analysis workflow;
- per-file progress/failure/retry;
- source-located summaries and signals;
- Analysis Feedback;
- chunks, full-text/vector retrieval;
- Context Pack Revision generation.

Exit criterion: representative English/German files become inspectable, source-linked Context Packs, including failure and no-file paths.

### 3. Discovery

Deliver:

- Interview Plan and coverage rubrics;
- Responding Device lease/takeover;
- persisted Interview Turns;
- structured findings and provenance;
- staged file tools;
- late material event/revision handling;
- skips, pause/resume, early finish;
- Interview Corrections;
- completion reviewer;
- responsive operation states and retries.

Exit criterion: Client completes a resumable file-aware interview without redundant seeded questions; findings and coverage are inspectable and source-linked.

### 4. Brief

Deliver:

- separate Brief Generator;
- software-project schema;
- structured Brief Draft editor;
- candidate/proposed/agreed transition;
- feasibility/open-item warnings;
- Review Version;
- editable-until-acknowledged Change Request;
- Approval;
- reopen/version lifecycle;
- PDF/print and Markdown export.

Exit criterion: Freelancer sends a traceable brief, Client requests changes or approves, and approved versions remain frozen.

### 5. Project Home

Deliver:

- final phase-aware navigation;
- approved-version history;
- Shared Resource CRUD and live Client visibility;
- archive/restore/delete entry points;
- Freelancer workspace next-action polish.

Exit criterion: approved room functions as the intended durable homebase without project-management scope.

### 6. Hardening and pilot

Deliver:

- seven-day deletion recovery and cascading purge;
- quotas, cost telemetry, and audit events;
- adversarial authorization/prompt-injection tests;
- English/German fixture evaluation;
- mobile and WCAG 2.2 AA verification;
- latency/retry instrumentation;
- five required pilot scenarios.

Exit criterion: all launch blockers, stage gates, and pilot-readiness criteria pass.

## Explicitly out of scope

- Freelancer teams, collaborators, or ownership transfer
- Multiple named Client participants
- Simultaneous Client respondents
- Client accounts
- Billing/subscriptions
- Email or push notifications
- E-signatures or contractual status
- Credential fields in Shared Resources
- Raw-file downloads
- Audio/video/archive/design-source/repository ingestion
- More than one Discovery Profile
- User-configurable models or prompts
- AI-assisted brief editing
- Inline threaded comments
- Tasks, chat, calendars, or project-management features
- External project integrations
- MCP server exposure
- Recovery codes or support-assisted account recovery
- Rich DOCX/Notion export

## Risks and mitigations

### File diversity

Risk: parsing quality varies across PDFs, slides, spreadsheets, and images.  
Mitigation: adapter boundary, explicit failure state, source locators, visible analysis, Analysis Feedback, and no silent raw-file fallback.

### LLM variability and latency

Risk: provider/model output and response times vary.  
Mitigation: durable workflows, atomic persistence, real progress states, schema validation/repair, role-specific evaluation, and safe resumability.

### German quality

Risk: German output may underperform English.  
Mitigation: dedicated German fixtures, multilingual embeddings, original-language chunks, same hard safety gates, and independent usefulness threshold.

### Client-proposed infeasibility

Risk: the brief presents Client desires as Freelancer commitments.  
Mitigation: explicit authority model, Candidate/Proposed/Agreed progression, feasibility flags, Freelancer review, and separate Targets/Constraints.

### Capability-link leakage

Risk: a forwarded link grants room access.  
Mitigation: unguessable hashed tokens, room scoping, rotation/revocation, no raw storage URLs, no Shared Resource secrets, and audit events.

### Secret disclosure

Risk: Project Material contains credentials.  
Mitigation: clear warning, deterministic text detection, default outbound redaction, explicit audited override, ZDR/no-train configuration, and dedicated-password-manager guidance.

### Passkey lockout

Risk: a passkey-only Freelancer loses all authenticators.  
Mitigation: require two passkeys before unlinking final OAuth and warn that MVP recovery is unavailable.

### Growing retained data

Risk: long-lived Project Homes accumulate files and derived data.  
Mitigation: metering, explicit archive/delete controls, seven-day recovery, and cascading purge; revisit retention from observed cost.
