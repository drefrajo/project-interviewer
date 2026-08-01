# Project Interviewer

Project Interviewer helps a service provider turn a focused AI interview with a Client into implementation-ready project direction.

## Language

**Creator**:
The signed-in service provider who creates Interviews and receives their Project Submissions. Each Creator owns their Interviews and private Interview Templates, signs in through either Google or GitHub without linking the two providers, and is identified to Clients by a chosen business/display name together with the verified email address from their account.
_Avoid_: Freelancer, owner, administrator

**Interview Policy**:
The fixed, product-owned rules that govern every Interview.
_Avoid_: System prompt, base prompt

**Interview Template**:
A reusable prefill for Interview Instructions, supplied by the product or kept private to one Creator. It may describe the expected Project Document outline but does not create a structured document schema.
_Avoid_: Project prompt, Discovery Profile

**Built-in Interview Template**:
A product-supplied Interview Template with separately authored German and English instructions.
_Avoid_: Default prompt, global custom template

**Private Interview Template**:
An Interview Template owned by one Creator and authored in one source language.
_Avoid_: User prompt, shared template

**Interview Instructions**:
The non-empty, editable scope, limits, expected Project Document outline, and other project-specific direction applied to one Interview. A template may prefill them, but the resulting text belongs to that Interview.
_Avoid_: Project prompt, Freelancer Guidance

**Client Language**:
The language selected for one Interview's Client UI, conversation, Project Document, and concept-selection flow. It is chosen explicitly when creating the Interview rather than being selected by an Interview Template.
_Avoid_: UI language, interview language, document language

**Interview Model**:
The language model selected when creating an Interview and used for its conversation, reasoning, Project Document, and image prompts. The selection is fixed for that Interview and never silently falls back to the other model.
_Avoid_: AI role, provider

**Template Translation**:
A Creator-triggered translation of the current Interview Instructions into a different Client Language using DeepSeek V4 Flash. It translates the current input text, is private preparation for an Interview, and is never shown to the Client.
_Avoid_: Automatic localization, Client translation

**Interview**:
One AI-guided discovery session with a single Client representative, reached through a shareable link. Its configuration remains editable until the first Client message and is then frozen; its Interview Model conducts the conversation, decides when discovery is sufficient, writes the Project Document, and prepares the Visual Concept prompts.
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
The implementation-ready Markdown description of what the Client wants, produced through an Interview according to its Interview Instructions. For a website project it includes complete first-draft website copy based on Client-supplied facts and clearly marks any unknown facts rather than inventing them.
_Avoid_: Project Brief, result document, specification

**Document Review**:
The Client step in which the current Project Document may receive free-text change feedback or be continued to Visual Concepts. Each revision replaces the current document; the Client does not edit it directly and no version history is kept.
_Avoid_: Approval, version review

**Visual Concept**:
One of three deliberately distinct, AI-generated website images offered to the Client after the Project Document is confirmed, with one optional additional batch of three that must explore territory not covered by the first batch. It communicates only a rough visual direction and is never a final design or implementation promise.
_Avoid_: Mockup, final design, website design

**Visual Direction**:
The Client's selected Visual Concept or, when none fits, up to three inspiration links, together with an optional explanatory note.
_Avoid_: Approval, final design

**Project Submission**:
The single immutable completed handoff produced by an Interview, containing the Project Document, all generated Visual Concepts, the Client's Visual Direction, and the Interview Transcript. After submission the Client may only view it.
_Avoid_: Project approval, final requirements
