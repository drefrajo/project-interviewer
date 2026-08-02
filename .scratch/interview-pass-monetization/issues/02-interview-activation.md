# Interview pass reservation and Client-link gating

Status: ready-for-agent
Type: task

Add reservation-on-share and consumption-on-Start, with atomic one-pass hold,
pre-start release, existing Interview treatment, and link rotation without
another reservation.

## Comments

- 2026-08-02: Implemented while preserving configuration editing until the
  first accepted Client message and moving billing consumption to deliberate
  Client Start.
- 2026-08-02: Deterministic Convex tests cover concurrent reservation and
  Start, existing Interviews, link rotation, Client gating, and deletion/
  deactivation release.
