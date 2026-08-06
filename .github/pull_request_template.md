## Release Checklist

- [ ] `bun run verify` passes locally.
- [ ] This PR targets `development`, unless it is the promotion PR from `development` to `master`.
- [ ] For a promotion PR to `master`, the hosted development Worker and shared Convex deployment were tested.
- [ ] Any data migration is explicit, idempotent, chunked, and documented separately from the normal deploy.
