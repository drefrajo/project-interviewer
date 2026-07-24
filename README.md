# Project Interviewer

Project Interviewer turns a short AI conversation with a Client into an implementation-ready website Project Submission.

A Creator configures an Interview, sends its account-free Interview Link, and receives:

- a Markdown Project Document with first-draft website copy;
- three distinct Visual Concepts;
- the Client's selected Visual Direction or inspiration links; and
- the Interview Transcript.

The application is a React/Vite SPA backed by Convex. Better Auth provides Google and GitHub sign-in, OpenRouter provides the two pinned Interview Models and image generation, and Cloudflare Email Service sends submission notifications.

## Local development

```sh
bun install
bunx convex dev --once
```

Configure the selected Convex deployment, then run Convex and Vite in separate terminals:

```sh
bun run convex:dev
```

```sh
bun run dev
```

Open `http://localhost:5173`.

See [setup](docs/setup.md), [launch readiness](docs/launch-readiness.md), the [domain glossary](CONTEXT.md), and the [product specification](.scratch/template-driven-interviews/spec.md).
