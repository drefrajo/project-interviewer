# Conversational Project Room

Status: Agreed
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

## Summary

Refine the existing File-First Discovery MVP so a Project Room feels like a
focused collaboration space instead of one long implementation-facing page.
The Project Home uses real, persistent tabs; the Discovery Interview reads and
behaves like a normal conversation; and the Project Brief is presented through
one Markdown document interface while retaining the structured discovery and
evidence model behind that interface.

Local, development, and production builds all use the same Convex-backed
runtime and feature set. Deterministic in-process adapters may remain as test
fixtures, but there is no browser `localStorage`/IndexedDB application mode.

The terms in `CONTEXT.md` remain canonical: “owner” means **Freelancer**, the
shared “specification” is the **Project Brief**, and a Client comment requesting
revision is one **Change Request**.

## Experience requirements

### Project Home and navigation

- Replace in-page anchor navigation with accessible tabs that mount one view at
  a time: Overview, Project Material, Discovery Interview, and Project Brief.
- Keep the tabs in their current left-hand desktop location and keep them
  visible while the active panel scrolls. On narrow screens they may become a
  sticky horizontally scrollable tab row.
- Preserve the selected tab in the URL so refresh, history, and next-action
  links open the intended view.
- Put Shared Resources directly in Overview beside the current next action and
  essential project information; do not keep a separate Resources tab.
- Use Tailwind utilities and small reusable variants for presentation wherever
  possible. Keep authored CSS only for global tokens/base rules, print output,
  reduced-motion/animation behavior, file-input accessibility, and prose rules
  that are clearer as CSS.

### Clear next action

- Overview must say who acts next: the current viewer, the other party, or no
  one because the room is complete/read-only.
- When the current viewer can act, show one primary action that opens the
  relevant tab. When they must wait, say exactly what the other party is doing.
- Copy must be correct for both roles in setup, discovery, Freelancer review,
  Client review, approved, and archived phases.
- The Freelancer cannot continue without Project Material. The control is
  absent from the Freelancer UI and the domain/Convex mutation rejects a
  Freelancer call. The Client retains the explicit no-material path.

### Conversational Discovery Interview

- Present system questions, Client answers, processing, corrections, and the
  current composer as one chronological chat transcript.
- Keep the composer visually anchored to the current conversation and use
  conversational button/copy language. Accepted answers remain visibly saved
  while the next turn is generated.
- Hide planning, Coverage Areas, Findings, and system events from the normal
  Client flow. They may remain in a secondary disclosure for Freelancer review
  and debugging without changing their authoritative domain role.
- The Interview Agent acknowledges relevant prior context briefly and asks one
  natural focused question. It avoids questionnaire/category narration while
  preserving the completion reviewer, provenance, corrections, and one-device
  response rules.

### Markdown Project Brief review

- The Freelancer edits the active Brief Draft through one Markdown document,
  with copy and replace/save interactions suitable for editing by an external
  agent.
- The Markdown document is the public interface of the Project Brief module;
  structured sections, findings, Requirement state, warnings, and evidence may
  remain an internal implementation used for validation and provenance.
- The Client sees a neatly rendered immutable Review Version followed directly
  by Approve and one Change Request/comment field.
- A Change Request remains editable until the Freelancer acknowledges it. The
  acknowledgement creates the next private revision path; it does not alter the
  frozen Review Version.
- Markdown export/copy includes readable source references without exposing raw
  storage URLs. Approval still freezes only the reviewed version and is not a
  contract or signature.

### Convex-backed environments

- The browser always creates the hosted Convex runtime. Remove the application
  mode switch and browser-persisted domain adapter.
- Map Vite's non-reserved `local-development`, `development`, and `production`
  modes to the product's local, development, and production deployment labels
  while keeping the same runtime and capabilities in every environment.
- All frontend environments require the public Convex URL and Convex site URL.
  The application site URL and all secrets stay server-side.
- Update scripts, example environments, validation, and setup documentation so
  local work runs Convex plus Vite and exercises authentication, file storage,
  workflows, AI calls, and authorization through the real seams.

## Invariants retained

- Project Phase stays separate from operational state.
- Discovery state and evidence provenance remain application-owned and
  structured; the visible chat is not authoritative storage.
- Review Versions, Interview Turns, and corrections remain immutable.
- File Analysis stays shallow; the interview owns discovery reasoning.
- Candidate, Proposed, and Agreed Requirement transitions remain unchanged.
- Clients remain Invite Link users; Freelancers remain authenticated through
  Better Auth.

## Verification

- Focused domain, Convex contract, hosted runtime, environment, and React tests.
- Full `bun run verify` and `git diff --check`.
- Desktop and narrow-screen rendered inspection of sticky tabs, each active
  panel, chat layout, and Client Project Brief review.
- Two-axis Standards and Spec review against the starting commit.
