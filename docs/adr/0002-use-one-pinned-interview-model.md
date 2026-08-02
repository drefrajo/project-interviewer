---
status: accepted
---

# Use one pinned GPT-5.6 Terra Interview Model behind a privacy-gated gateway

GPT-5.6 Terra is the sole Interview Model. It remains fixed for the entire
conversation, Project Document, revisions, concept planning, and Template
Translation. Interactive Interview turns use low reasoning effort; planning,
documents, revisions, concept planning, and translation use medium effort.

OpenRouter is the single gateway: every request denies data collection,
explicitly disables ZDR routing, and fails rather than falling back to another
model or a retention-enabled endpoint. Clients receive the exact model name and
a concise statement that external providers are used for AI functionality.

GPT Image 2 at low quality renders Visual Concepts. It uses the same 3:2
concept framing, while the image model remains separate from the text-model
provider path.

The application no longer exposes a model selector. The schema temporarily
accepts the retired model value only so existing stored Interviews continue to
validate; all new writes and subsequent operations use GPT-5.6 Terra.
