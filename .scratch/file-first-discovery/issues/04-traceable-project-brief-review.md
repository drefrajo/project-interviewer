# 04 — Traceable Project Brief review

**What to build:** Completed or deliberately ended discovery generates a concise traceable Brief Draft that the Freelancer can edit into an immutable Review Version for Client approval or one editable Change Request, with correct Candidate/Proposed/Agreed transitions.

**Blocked by:** 03 — File-aware Discovery Interview.

**Status:** ready-for-agent

## Authorized public test seams

- Project Brief service commands/queries for generation, structured edits, sending, change requests, acknowledgement/revision, approval, and reopening.
- Brief Generator adapter and schema-validation boundary.
- Accessible Freelancer editor, Client review, evidence inspection, print, and Markdown export interactions.

## Acceptance criteria

- [ ] Separate idempotent Brief Generator uses structured state and bounded evidence, emits the required software-project structure, and labels unsupported sections `Not established`.
- [ ] Brief Draft supports structured text/item editing, reorder/reclassify/scope, evidence retention, and Freelancer-authored material without AI section regeneration.
- [ ] Unresolved feasibility, scope, budget, timeline, responsibility, critical Gap, and Contradiction warnings must be resolved or explicitly acknowledged before send.
- [ ] Review Versions are immutable; their Candidate Requirements become Proposed, and Approval makes only that frozen version's items Agreed for discovery purposes.
- [ ] Client may approve or maintain one Change Request editable until acknowledgement; acknowledgement freezes history and creates a new private revision path.
- [ ] Approved history remains visible; reopening creates a private draft while the Client sees the last approved version.
- [ ] Print/PDF-friendly output and Markdown export preserve readable evidence appendices without raw storage URLs.
- [ ] Focused tests cover unsupported claims, provenance, lifecycle immutability, one-change-request rule, and English/German output.

