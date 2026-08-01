---
status: accepted
---

# Use two pinned Interview Models behind a privacy-gated gateway

Each Creator selects either GPT-5.6 Terra or DeepSeek V4 Flash when creating an Interview, with DeepSeek V4 Flash as the default, and that model remains pinned for the entire conversation, Project Document, revisions, and Visual Concept prompts. After the first Client reply, one bounded medium-reasoning request creates and persists a private, tentative Interview Plan; a separate fast request then produces the next question from that plan. Later interactive turns prioritize responsiveness with low-effort GPT-5.6 Terra or DeepSeek V4 Flash without thinking mode. Initial Project Document generation is a separate request after explicit Client alignment; Project Documents and revisions use GPT-5.6 Terra at medium reasoning or DeepSeek V4 Flash thinking mode at high effort, while Visual Concept prompt generation uses medium reasoning. Creator-triggered Template Translation also uses DeepSeek without thinking. OpenRouter is the single gateway: every request denies data collection, explicitly disables ZDR routing, and fails rather than falling back to another model or a retention-enabled endpoint. Clients receive the exact model name and a concise statement that external providers are used for AI functionality.

GPT Image 2 at medium quality renders Visual Concepts for GPT Interviews, while GPT Image 2 at low quality renders them for DeepSeek Interviews. Both
use the same 3:2 concept framing, while the image model follows the selected
Interview Model's provider path.

The two-model choice is a deliberate launch constraint rather than a general model marketplace.
