# 01 — Tabbed Tailwind Project Home

Status: resolved
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

## What to build

Configure Tailwind and replace the room's anchor page with sticky accessible
tabs. Overview contains role-aware next-action guidance, important room data,
Invite/Lifecycle controls where applicable, and Shared Resources. Enforce the
Client-only no-material path in the UI, domain, and Convex.

## Acceptance criteria

- [x] Overview, Project Material, Discovery Interview, and Project Brief are
      actual keyboard-accessible tabs with URL-backed selection.
- [x] Desktop sidebar and mobile tab row remain visible while panel content
      scrolls; only the active panel is mounted.
- [x] Shared Resources appears in Overview and there is no Resources tab.
- [x] Next-action copy names the responsible party and links actionable viewers
      to the correct tab.
- [x] Freelancer cannot see or invoke continue-without-material; Client can.
- [x] Project Home/shell/material/resources/workspace styling uses Tailwind
      utilities wherever practical, leaving only justified CSS.
- [x] Focused React, domain, and Convex tests cover the behavior.

## Verification

- `bun run typecheck`
- `bunx vitest run src/domain/project-material.test.ts src/domain/discovery-interview.test.ts src/domain/project-home.test.ts` (48 passing)
- `bunx vite build`
- `git diff --check`

`bun run lint` is currently blocked by two unrelated unused imports in the
in-progress Project Brief slice (`project-brief-panel.tsx` and
`project-brief-markdown.ts`).

## Comments

- Follow-up: the authenticated Freelancer can now retrieve and copy the current
  Invite Link whenever they reopen the Overview. Convex retains the token
  encrypted and room-bound, clears it on rotation/revocation, and continues to
  exchange only its hash. Pre-existing hash-only links remain valid but require
  one rotation before Convex can display them again.
