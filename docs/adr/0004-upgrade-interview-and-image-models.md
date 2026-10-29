---
status: accepted
supersedes: 0002 (model and reasoning settings only)
---

# Use GPT-6.1 Sol at low effort and GPT Image 2.5 Flare at medium quality

At the Creator's request, all text operations use `gpt-6.1-sol` with low
reasoning effort: Interview turns, private planning, Project Documents,
revisions, Visual Concept planning and Template Translation. This replaces
the model and split reasoning settings in ADR 0002. The OpenRouter privacy
and fallback contract remains unchanged.

Visual Concepts use `gpt-image-2.5-flare` at the existing medium quality and
3:2 aspect ratio. OpenAI lists Flare and Sunburst as its current image models;
Flare serves new image generation, while Sunburst emphasizes editing precision.
The OpenRouter image catalog supports Flare's medium quality and 3:2 framing.

Stored retired text/image model literals remain valid so existing Interviews
and operations can be read without a data migration. All new writes, public
model disclosures, exports and active requests use the new model settings.

Sources checked 2026-10-13:

- [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [GPT Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)
- [OpenRouter text catalog](https://openrouter.ai/api/v1/models)
- [OpenRouter image catalog](https://openrouter.ai/api/v1/images/models)
