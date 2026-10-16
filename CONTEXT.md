# Interview

Interview helps a service provider turn a focused AI conversation with a Client into implementation-ready project direction.

## Language

**Creator**:
The signed-in service provider who creates Interviews and receives their Project Submissions. Each Creator owns their Interviews and private Interview Templates, signs in through either Google or GitHub without linking the two providers, and is identified to Clients by a chosen business/display name and Creator-selected contact email address; an optional Creator privacy-policy URL may also be shown. The OAuth email address remains private account data and is never exposed to Clients automatically.
_Avoid_: Freelancer, owner, administrator

**Interview Policy**:
The fixed, product-owned rules that govern every Interview.
_Avoid_: System prompt, base prompt

**Interview Kind**:
The product-owned behavior and output configuration for one Interview: Website, Privacy, or Custom. It determines the Interview's general purpose and whether Visual Concepts are included; Custom lets the Creator choose that setting.
_Avoid_: Interview type, template type

**Interview Template**:
A reusable prefill for one Interview Kind's Interview Instructions, supplied by the product or kept private to one Creator. It may describe the expected Project Document outline but does not itself govern the Interview workflow or create a structured document schema.
_Avoid_: Project prompt, Discovery Profile

**Built-in Interview Template**:
A product-supplied Interview Template with a localized title, creator-facing description, separately authored German and English instructions, and a fixed or configurable Visual Concepts setting.
_Avoid_: Default prompt, global custom template

**Private Interview Template**:
An Interview Template owned by one Creator and authored in one source language, with a concrete Visual Concepts choice for its Interview Kind.
_Avoid_: User prompt, shared template

**Interview Instructions**:
The non-empty, editable scope, limits, expected Project Document outline, and other project-specific direction applied to one Interview. A template may prefill them, but the resulting text belongs to that Interview.
They also determine discovery depth and handoff detail: a short factual briefing can accept explicit design delegation, while other Creators can request thorough discovery. They do not change the product's review or submission safeguards.
_Avoid_: Project prompt, Freelancer Guidance

**Client Language**:
The language selected for one Interview's Client UI, conversation, Project Document, and concept-selection flow. It is chosen explicitly when creating the Interview rather than being selected by an Interview Template.
_Avoid_: UI language, interview language, document language

**Interview Model**:
The GPT-6.1 Sol language model used for an Interview's conversation, reasoning, Project Document, and image prompts.
_Avoid_: AI role, provider

**Template Translation**:
A Creator-triggered translation of the current Interview Instructions into a different Client Language using GPT-6.1 Sol. It translates the current input text, is private preparation for an Interview, and is never shown to the Client.
_Avoid_: Automatic localization, Client translation

**Interview**:
One AI-guided discovery session with a single Client representative, reached through a shareable link. Its Interview Kind and configuration remain editable until the first Client message and are then frozen; its Interview Model conducts the conversation, decides when discovery is sufficient, writes the Project Document, and prepares Visual Concept prompts only when that Interview includes Visual Concepts.
_Avoid_: Project Room, Discovery Interview, questionnaire

**Interview Link**:
An unguessable bearer link through which a Client starts, resumes, and later views one Interview without an account. A Creator may regenerate it to invalidate the previous link.
_Avoid_: Login link, public project

**Interview Transcript**:
The chronological Client and AI messages exchanged during an Interview. Corrections are new messages, with the latest clear Client statement taking precedence.
_Avoid_: Structured discovery state, answer record

**Interview Plan**:
A private, tentative discovery map created after the first Client reply. It guides later questions but is never shown to the Client, and the latest Client statements always override it.
_Avoid_: Project plan, fixed questionnaire

**Alignment Checkpoint**:
The distinct Interview turn in which the AI recommends and summarizes the current direction for the Client to confirm or adjust before a Project Document can be generated. It is a low-burden safeguard against premature completion, not formal approval.
_Avoid_: Final answer, document preview, approval gate

**Suggested Reply**:
An optional, AI-proposed shortcut that inserts editable text into the Client's ordinary response composer without submitting it.
_Avoid_: Form field, structured answer, required choice

**Client**:
The party invited to an Interview to clarify what they want. One Client representative responds on the party's behalf.
_Avoid_: Customer, interviewee, end user

**Project Document**:
The implementation-ready Markdown description of what the Client wants, produced through an Interview according to its Interview Kind and Interview Instructions. A Website Project Document may include complete first-draft website copy based on Client-supplied facts; a Privacy Project Document is a privacy data mapping and policy-preparation aid, not legal advice. Unknown facts and evidence gaps are clearly marked rather than invented.
_Avoid_: Project Brief, result document, specification

**Document Review**:
The Client step in which the current Project Document may receive free-text change feedback or, when the Interview includes Visual Concepts, be continued to the Visual Concepts step. Each revision replaces the current document; the Client does not edit it directly and no version history is kept.
_Avoid_: Approval, version review

**Visual Concept**:
One of up to six deliberately distinct, AI-generated images offered to the Client after a Project Document is confirmed when the Interview includes Visual Concepts: a first batch of three, plus a second batch of three the Client may request while only the first batch exists. It communicates only a rough visual direction and is never a final design or implementation promise.
_Avoid_: Mockup, final design, website design

**Visual Direction**:
The Client's selected Visual Concept, or up to three inspiration links when none fits, with explicit preferences describing what to keep and what to leave out or adjust. Before Project Submission, the Client reviews and confirms the displayed style basis and preferences; the server records that exact summary and confirmation time. The Creator's scope and requirements remain authoritative, and the direction is a rough style agreement rather than a final design. Historical submissions may contain only a selection and note. It exists only for an Interview that includes Visual Concepts.
_Avoid_: Approval, final design

**Project Submission**:
The single immutable completed handoff produced by an Interview, containing the Project Document and Interview Transcript, plus generated Visual Concepts and the Client's Visual Direction when that Interview includes them. After submission the Client may only view it.
_Avoid_: Project approval, final requirements

**Interview Retention Deadline**:
The scheduled permanent deletion time for an Interview and all of its content. A completed Interview is deleted 24 calendar months after Project Submission; an incomplete Interview is deleted 24 calendar months after the most recent Creator or Client activity. Background AI work, notifications, reads, and exports do not extend it.
_Avoid_: Archive date, recovery window

## Monetization

**Interview Pass**:
A non-expiring entitlement that pays for one complete Interview after the Client deliberately starts it, including its conversation, Project Document, revisions, the optional Visual Concepts flow, Project Submission, and storage/downloads until the Interview Retention Deadline.
_Avoid_: Token, credit, message allowance

**Pass Balance**:
The Creator's separate available and reserved Interview Pass counts after grants, reservations, releases, starts, refunds, disputes, and manual adjustments.
_Avoid_: Wallet, quota, subscription balance

**Introductory Pass**:
The one non-expiring Interview Pass granted to every Creator once, including Creators who existed before monetization.
_Avoid_: Trial, free trial, coupon

**Pass Purchase**:
A confirmed one-time purchase of an allowlisted Interview Pass pack through Stripe Managed Payments.
_Avoid_: Subscription, invoice, usage charge

**Pass Reservation**:
The Creator-authorized, atomic hold of exactly one available Interview Pass the first time an Interview Link is copied or shared. A reserved link is usable for the welcome page, but the pass is not consumed until the Client deliberately starts.
_Avoid_: Activation, publish, unlock

**Interview Start**:
The Client's deliberate action that atomically converts a valid Interview Pass reservation into a consumed pass before any billable AI work. Repeated starts have exactly-once effects.
_Avoid_: Page view, preview, first crawler request

**Pass Ledger**:
The append-only record of every Interview Pass grant, reservation hold, reservation release, start consumption, refund, dispute adjustment, and operator adjustment used to explain available, reserved, and consumed state.
_Avoid_: Activity log, audit log
