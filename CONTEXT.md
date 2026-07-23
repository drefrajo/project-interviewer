# Project Interviewer

Project Interviewer helps a software freelancer turn a client's project material and discovery answers into a shared, reviewable description of the intended project.

## Language

**Project Room**:
A workspace created for one client project and shared between its Freelancer and Client.
_Avoid_: Dashboard, portal

**Project Description**:
A short, Client-visible statement of the project as the Freelancer currently understands it, used as initial discovery evidence rather than unquestionable truth.
_Avoid_: Freelancer guidance, project brief

**Project Phase**:
The Project Room's coarse business stage: setup, discovery, Freelancer review, Client review, approved, or archived.
_Avoid_: File status, analysis status

**Freelancer**:
The service provider responsible for creating a Project Room and reviewing its Project Brief.
_Avoid_: Owner, vendor

**Freelancer Workspace**:
The Freelancer's signed-in view of their Project Rooms, current phases, recent activity, and required next actions.
_Avoid_: Project home, admin dashboard

**Client**:
The party invited to a Project Room to provide project material, answer discovery questions, and approve a Project Brief.
_Avoid_: Customer, interviewee

**Invite Link**:
A revocable access grant through which the Client enters and later returns to a Project Room without an account.
_Avoid_: Login link, public link

**Project Material**:
Files supplied by the Client or Freelancer as evidence and background for discovery.
_Avoid_: Attachments, source documents

**File Processing**:
Non-interpretive preparation of Project Material for discovery, including validation, content extraction, and safety checks.
_Avoid_: File analysis

**File Analysis**:
A shallow, factual description of processed Project Material that supplies summaries, categories, source locators, and key signals without performing discovery reasoning.
_Avoid_: File processing, discovery

**Analysis Feedback**:
A human-authored correction or qualification attached to File Analysis without rewriting the underlying Project Material or original analysis.
_Avoid_: Edited summary, reanalysis

**Context Pack**:
A compact, source-linked map of analyzed Project Material used to begin and guide a Discovery Interview; it is evidence for discovery, not the complete project truth.
_Avoid_: Knowledge base, full project context

**Context Pack Revision**:
An immutable snapshot of a Context Pack that records which analyzed Project Material was available to particular interview turns.
_Avoid_: Latest context

**Discovery Profile**:
A domain-specific definition of the language, evidence, interview, and Project Brief expected for a class of projects.
_Avoid_: Prompt, template

**Freelancer Guidance**:
Private project-specific facts, service boundaries, availability, commercial ranges, and areas of emphasis supplied by the Freelancer to guide discovery.
_Avoid_: Freelancer profile, system prompt

**Discovery Interview**:
The AI-guided conversation through which the Client and system clarify the intended project.
_Avoid_: Questionnaire, chat

**Interview Plan**:
An evolving, project-specific map of Coverage Areas, existing evidence, sufficiency criteria, and open discovery goals used to guide a Discovery Interview.
_Avoid_: Question list, script

**Interview Language**:
The language in which the Client conducts a particular Discovery Interview.
_Avoid_: Source language, brief language

**Brief Language**:
The project-specific language in which the Project Brief and Context Pack prose are produced.
_Avoid_: Source language, interview language

**Coverage Area**:
A subject that a Discovery Profile expects the Discovery Interview to address before proposing completion.
_Avoid_: Checklist item, question category

**Interview Turn**:
One small batch of questions from the system and the Client's corresponding answers, associated with the Context Pack Revision available at that time. Every question in the batch must be answered (or explicitly marked as unknown) before the turn is accepted.
_Avoid_: Message, prompt

**Interview Correction**:
A Client statement that supersedes part of an earlier Interview Turn without deleting or rewriting the original answer.
_Avoid_: Edited answer, replacement message

**Discovery Finding**:
A source-linked statement identified during discovery and classified as a Candidate Requirement, Assumption, Risk, Gap, or Contradiction.
_Avoid_: Insight, note

**Candidate Requirement**:
A capability, quality, or constraint suggested by Project Material or the Client but not yet accepted into the Freelancer's proposed scope.
_Avoid_: Requirement, feature request

**Proposed Requirement**:
A Candidate Requirement or Freelancer-authored item included by the Freelancer in a Project Brief sent for Client review.
_Avoid_: Commitment, final requirement

**Agreed Requirement**:
A Proposed Requirement contained in a Client-approved Project Brief version; it records discovery agreement without becoming a contractual commitment.
_Avoid_: Contract term, guarantee

**Target**:
An outcome, budget, or date the Client or Freelancer would prefer to achieve but may trade off.
_Avoid_: Constraint, commitment

**Constraint**:
A boundary a party states cannot move, together with its source and reason; it may still make the proposed project infeasible.
_Avoid_: Target, commitment

**Assumption**:
An unverified belief provisionally treated as true so discovery can proceed.
_Avoid_: Fact, requirement

**Risk**:
An uncertain condition that could harm the project's outcome if it occurs or remains unmanaged.
_Avoid_: Issue, blocker

**Gap**:
Information needed for a sound Project Brief that discovery has not obtained.
_Avoid_: Open task, omission

**Contradiction**:
Two or more incompatible claims found in Project Material or Client answers and retained until the Client resolves or explicitly leaves them open.
_Avoid_: Error, discrepancy

**Responding Device**:
The Client device currently permitted to answer Discovery Interview questions; other devices may observe and explicitly take over that permission.
_Avoid_: Active user, session owner

**Project Brief**:
A versioned description of the intended project produced from Project Material and the Discovery Interview, then reviewed by the Freelancer.
_Avoid_: Contract, statement of work, final requirements

**Brief Draft**:
A mutable Project Brief version visible only to the Freelancer until it is sent for Client review.
_Avoid_: Working document, review version

**Review Version**:
An immutable Project Brief version sent by the Freelancer for the Client to approve or return with a change request.
_Avoid_: Draft, approved brief

**Change Request**:
The Client's requested revisions to one Review Version, editable until the Freelancer acknowledges it and begins a new revision.
_Avoid_: Comment thread, new interview

**Approval**:
The Client's acknowledgement of a specific Project Brief version, which freezes that version without making it a signature or contract.
_Avoid_: Signature, acceptance

**Project Home**:
The phase-aware landing view of a Project Room, showing current progress, available artifacts, next actions, and Shared Resources.
_Avoid_: Dashboard

**Shared Resource**:
A labeled link or non-secret note that the Freelancer makes available to the Client through the Project Home.
_Avoid_: Credential, secret
