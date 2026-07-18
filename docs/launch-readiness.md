# Launch readiness

## Machine-verifiable gates

Run the complete local gate:

```sh
bun run verify
```

This runs the full test suite, the versioned fixture evaluation, TypeScript,
ESLint, and a production build. The evaluation report is written to
`.scratch/file-first-discovery/evaluation-report.json`; a failed gate exits
non-zero.

The `file-first-discovery-eval-v1` corpus contains only synthetic,
de-identified inputs and expectations. The runner executes those inputs
through the public domain application and deterministic local adapters, then
derives its observations from persisted Project Material, retrieval results,
Interview Turns, Discovery Findings, Project Brief items, lifecycle state, and
operational metadata. It covers website, SaaS feature, mobile application, and
integration projects, plus every difficult-path scenario in the MVP
specification. Five fixtures mirror the planned human pilots: no files,
German, conflicting Project Material, late upload, and an unrealistic
constraint.

The report is deliberately threshold-based:

- File Analysis requires at least 95% source-supported factual claims, zero
  deep scope statements, safe prompt-injection handling, and secret masking.
- Retrieval requires at least 90% top-five hits, complete cross-language
  observations, and zero cross-room results.
- Interview checks evidence reuse, critical gaps, bounded follow-ups,
  request/agreement separation, corrections, late material, and immutable
  accepted history.
- Brief checks zero unsupported agreed requirements, complete substantive
  traceability, prominent critical issues, no invented commitments, and
  readability.
- Language requires the same machine safety, retrieval, and traceability gates
  in English and German. Absolute human usefulness remains pending.
- State and security checks turns, link revocation, responding-device
  takeover, idempotent retries, cascading deletion/recovery, quotas,
  throttling, the soft 40-turn checkpoint, bounded attempts, AI metadata, and
  scrubbed audits.

The automated browser/domain tests also exercise the complete local core flow.
The rendered accessibility gate drives the production build in headless
Chrome at 1280×720 and 390×844 without opening a network port. It verifies
keyboard-only skip navigation, Project Room creation, Project Material upload,
Interview operation, Project Brief review, and Client Approval. It also checks
accessible control names, live regions, actual overflow across those states,
multiple computed WCAG 2.2 AA contrast surfaces and every visible interaction
target, visible focus, reduced motion on an animated card, reachable phone
navigation, and German document language.

## Human-only pilot gate

Machine completion does not claim that generated discovery is useful to real
Freelancers and Clients. Before a public launch, complete these five projects
with representative users and record both parties' judgment:

1. A project with no files.
2. A German-language project.
3. A project with conflicting Project Material.
4. A project where material is uploaded late.
5. A project with an unrealistic budget or timeline.

For each pilot, confirm that evidence was understood, questions were
non-redundant, contradictions and gaps were surfaced, and the final brief was
useful without inventing commitments. Re-run `bun run verify` after any
resulting product change.

## Credential and deployment gate

Local mode requires no external service. Hosted launch still requires:

- Convex project and deploy key;
- Google and GitHub OAuth applications;
- at least two production passkeys tested on the HTTPS domain;
- OpenRouter account, API key, selected models, provider allowlist, and
  verified zero-data-retention behavior;
- Cloudflare account and approved production deployment;
- final privacy, retention, monitoring, and incident-response review.

Follow [setup.md](setup.md) for the exact variables and commands. No paid
account creation, production mutation, or deployment is performed by the
machine gate.
