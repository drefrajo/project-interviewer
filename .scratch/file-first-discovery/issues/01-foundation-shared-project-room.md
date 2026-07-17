# 01 — Foundation and shared Project Room

**What to build:** A Freelancer can run the responsive application locally, enter through the development identity boundary, create a Project Room with the canonical setup fields, generate a secure Invite Link, and share a phase-aware Project Home where a Client can complete first-visit onboarding and return later.

**Blocked by:** None — can start immediately.

**Status:** resolved

**Starting commit:** `01cbf0e68c1853e5168160d572a95583d48f15dc`

## Authorized public test seams

- Domain service API for Freelancer identity, Project Room creation, Invite Link rotation/revocation, and Client onboarding.
- Browser routes and accessible user interactions for the Freelancer Workspace and Invite Link entry.
- Authorization resolver that maps a Freelancer session or hashed Invite Link plus device to one room-scoped actor.

## Acceptance criteria

- [x] Bun/Vite/React/TypeScript project builds with a phone-first, keyboard-complete English/German shell and visible focus/reduced-motion handling.
- [x] Convex schema and environment-separated configuration represent the canonical room, access, operation, and audit roots without exposing raw storage identifiers.
- [x] Local development mode persists data and supports the same public domain operations without external credentials.
- [x] Freelancer can create, search, filter, open, archive-ready Project Rooms with title, Client label, Project Description, Brief Language, software-project profile, and private Freelancer Guidance.
- [x] Secure Invite Links are unguessable, hashed at rest, rotatable, revocable, and never included in logs/analytics.
- [x] Client first visit shows disclosure, limits, secret warning, display name, Interview Language, and acknowledgement; repeat visits land on Project Home.
- [x] Project Home uses canonical phase-aware navigation and explains unavailable sections.
- [x] Focused tests, typecheck, lint, and production build pass.

## Answer

Delivered the credential-free local foundation and the Convex production schema roots. The public service issues opaque actor sessions, revalidates room-scoped access, persists only Invite Link hashes, and projects Client-safe room data. The responsive application covers the Freelancer Workspace, Project Room creation, first-visit disclosure/onboarding, repeat Project Home entry, phase/readiness-aware navigation, and complete English/German copy.

Verification:

- `bun run test -- src/domain/project-room.test.ts src/app/app.test.tsx` — 7 passed
- `bun run typecheck` — passed
- `bun run lint` — passed
- `bun run build` — passed
- `$code-review` Standards — no actionable findings
- `$code-review` Spec — no actionable findings
