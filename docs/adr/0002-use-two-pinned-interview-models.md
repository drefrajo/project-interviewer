---
status: accepted
---

# Use two pinned Interview Models behind a privacy-gated gateway

Each Creator selects either GPT-5.6 Terra or DeepSeek V4 Flash when creating an Interview, with DeepSeek V4 Flash as the default, and that model remains pinned for the entire conversation, Project Document, revisions, and Visual Concept prompts. GPT-5.6 Terra uses medium reasoning throughout; DeepSeek V4 Flash uses thinking mode at high effort throughout; only Creator-triggered Template Translation uses DeepSeek without thinking. OpenRouter is the single gateway and every request must require zero data retention, deny data collection, and fail rather than fall back to the other model or a retention-enabled endpoint. Clients receive the exact model name and a concise statement that external providers are used for AI functionality.

GPT Image 2 is the fixed renderer for the three medium-quality 1536×1024 Visual Concepts regardless of the selected Interview Model. This keeps image quality comparable while allowing the two language models to be evaluated on the product's core discovery work.

The two-model choice is a deliberate launch constraint rather than a general model marketplace.
