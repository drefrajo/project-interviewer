# Interview

Interview turns a short AI conversation with a Client into an implementation-ready website Project Submission.

A Creator configures an Interview, sends its account-free Interview Link, and receives:

- a Markdown Project Document with first-draft website copy;
- three distinct Visual Concepts;
- the Client's selected Visual Direction or inspiration links; and
- the Interview Transcript.

The application is a React/Vite SPA backed by Convex. Better Auth provides Google and GitHub sign-in, OpenRouter provides GPT-5.6 Terra and image generation, and Cloudflare Email Service sends submission notifications.

## Local development

```sh
bun install
bun run convex:dev
```

`bun run convex:dev` starts a local Convex deployment and watches the backend
without pushing code to a Convex Cloud development deployment. Configure the
local server-only values from [setup](docs/setup.md) before the first run.

Run Convex and Vite in separate terminals:

```sh
bun run convex:dev
```

```sh
bun run dev
```

Open `http://localhost:5173`.

Run the deterministic repository gate before handing off a change:

```sh
bun run verify
```

It runs the automated behavior and boundary tests, TypeScript, ESLint, and the
production build/security-header validation. It does not contact paid AI,
image, or email providers and does not deploy hosted state.

See [setup](docs/setup.md), [deployment](docs/deployment.md), [launch readiness](docs/launch-readiness.md), the [feedback loop](docs/feedback-loop.md), the [domain glossary](CONTEXT.md), and the [product specification](.scratch/template-driven-interviews/spec.md).

## Contributing

Issues and pull requests are welcome. Direct write access and merging are
reserved for maintainers. See [contribution guidelines](CONTRIBUTING.md).

## License

Licensed under the [MIT License](LICENSE).
