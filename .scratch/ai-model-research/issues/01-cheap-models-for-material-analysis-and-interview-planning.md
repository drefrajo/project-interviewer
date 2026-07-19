# 01 — Cheap AI models for Project Material analysis and first-turn planning

**Type:** research
**Status:** resolved
**Research date:** 2026-07-19

## Question

Which currently available, inexpensive models are suitable for this repository's Project Material analysis and first-turn interview planning, preferably through OpenRouter, and what is a sensible default with a premium upgrade path?

## Recommendation

Use `google/gemini-3.1-flash-lite` as the default for both `file_analyzer` and `interview_planner`, starting with low or medium thinking for analysis and medium/high thinking for planning. It is generally available, accepts text, images, video, audio, and PDFs, has a 1M-token input limit, supports function calling and structured outputs, and is priced at $0.25/M input and $1.50/M output. Google positions it specifically for low-latency, high-volume, lightweight agentic and document-processing work. Sources: [Google model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenRouter model page](https://openrouter.ai/google/gemini-3.1-flash-lite).

Keep a role-based upgrade path rather than moving every role to a premium model:

1. Upgrade `interview_planner`, and later `interview_agent`/`interview_reviewer`, to `google/gemini-3-flash-preview` when first-turn question quality or nuanced gap/contradiction handling is insufficient. It is still relatively cheap at $0.50/M input and $3/M output, retains 1M context and PDF/multimodal support, and Google describes it as its most intelligent model built for speed. It is preview software, so pin and evaluate the exact model identifier before production use. Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenRouter model page](https://openrouter.ai/google/gemini-3-flash-preview).
2. Use `openai/gpt-5.4-mini` as the premium alternative when structured reasoning, tool use, or instruction-following quality matters more than cost. It supports structured outputs, function calling, text/image input, and a 400K context window at $0.75/M input and $4.50/M output. It does not list PDF as a native input modality, but this repository's local parser already converts PDFs to source-located text. Sources: [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [OpenRouter model page](https://openrouter.ai/openai/gpt-5.4-mini).
3. Reserve `anthropic/claude-sonnet-5` for the hardest planning/review/brief cases or an explicit high-quality tier. OpenRouter lists text, image, and file input, 1M context, and $2/M input and $10/M output; Anthropic describes it as its most agentic Sonnet model. This is a large cost jump and should be justified by evaluation results, not used as the baseline. Sources: [Anthropic announcement](https://www.anthropic.com/news/claude-sonnet-5), [OpenRouter Anthropic catalog](https://openrouter.ai/anthropic).

For an extreme budget mode, `google/gemini-2.5-flash-lite` is the fallback for `file_analyzer`: $0.10/M input, $0.40/M output, 1M context, multimodal/PDF input, structured outputs, and function calling. It is a good high-throughput extractor, but its provider description explicitly targets lightweight tasks and it is a weaker choice for nuanced first-turn planning. Sources: [Google model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite), [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenRouter model page](https://openrouter.ai/google/gemini-2.5-flash-lite).

## Repository fit

The application has five structured-output chat roles: file analysis, interview planning, interview turns, interview review, and brief generation. Its adapter sends OpenAI-compatible `chat/completions` requests with JSON Schema output, optional tools, and OpenRouter provider preferences. The model policy now uses `google/gemini-3.1-flash-lite` for file analysis and interview planning, while retaining the stronger existing models for later interview, review, and brief roles. See [the model policy](../../../src/infrastructure/ai-model-configuration.ts), [the OpenRouter adapter](../../../src/infrastructure/openai-compatible-adapter.ts), and [the AI operation boundary](../../../convex/ai.ts).

The material path is important to the comparison:

- PDFs, documents, spreadsheets, and other supported files are parsed locally into source-located segments and 1,200-character chunks before the file-analysis call.
- Only standalone image files are currently passed as an image part to the model. A PDF is not currently sent as a native PDF part; its extracted text is sent instead.
- The interview planner receives serialized Project Room/context-pack evidence, not the raw file. The interview agent uses bounded list → summary → search → inspection tools.

Therefore native PDF support is a valuable future-proofing advantage and helps if parsing quality needs a fallback, but it is not required for the current path. More important today are multilingual instruction following, reliable JSON Schema output, tool calls, long-context handling, and low latency.

## Comparison

Prices are provider list prices per 1 million tokens in USD, before caching, routing differences, and any tool charges. They are a snapshot; verify before changing production configuration.

| Model | OpenRouter slug | Price input / output | Context | Multimodal and PDF support | Structured/tool support | Fit and trade-off |
|---|---|---:|---:|---|---|---|
| Gemini 2.5 Flash-Lite | `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | 1M | Text, image, video, audio, PDF | Google lists function calling and structured outputs | Cheapest useful option; optimized for speed and simple extraction. Use for high-volume file analysis or a budget tier, not as the first choice for subtle planning. |
| Gemini 3.1 Flash-Lite | `google/gemini-3.1-flash-lite` | $0.25 / $1.50 | 1M | Text, image, video, audio, PDF | Function calling, structured outputs, thinking | Best default balance. GA, low-cost, long-context, and explicitly aimed at lightweight agentic/document work. Medium/high thinking can trade latency and output cost for better planning. |
| OpenAI GPT-5 mini | `openai/gpt-5-mini` | $0.25 / $2.00 | 400K | Text and image; no PDF listed on the OpenAI model page | Function calling and structured outputs | Cheap, strong structured-reasoning alternative and close to the repository's current analyzer choice. Less context and no native PDF modality; local parsing makes that acceptable. |
| Gemini 3 Flash Preview | `google/gemini-3-flash-preview` | $0.50 / $3.00 | 1M | Text, image, audio, video, PDF | Structured output, tool use, thinking, caching | Best first premium step for the planner/agent: Google describes near-Pro reasoning, multi-turn/tool-use strength, and better multimodal reliability than Gemini 2.5 Flash. Preview lifecycle is the main risk. |
| OpenAI GPT-5.4 mini | `openai/gpt-5.4-mini` | $0.75 / $4.50 | 400K | Text and image; no PDF listed on the OpenAI model page | Function calling and structured outputs | Higher-cost mini with stronger reasoning/tool-use positioning. Good targeted upgrade for planning/review when JSON/tool reliability is the bottleneck; smaller context and narrower native modalities than Gemini. |
| Anthropic Claude Sonnet 5 | `anthropic/claude-sonnet-5` | $2.00 / $10.00* | 1M | OpenRouter lists text, image, and file input | Reasoning and agent/tool positioning | High-quality escalation for difficult ambiguity, long-horizon planning, review, or brief generation. Too expensive for routine file analysis. *Anthropic's announcement says the $2/$10 introductory price runs through 2026-08-31, then becomes $3/$15. Confirm the OpenRouter listing at rollout. |

### Illustrative request cost

For 100K input tokens and 10K output tokens, using list prices and no caching:

| Model | Approximate cost |
|---|---:|
| Gemini 2.5 Flash-Lite | $0.014 |
| Gemini 3.1 Flash-Lite | $0.040 |
| GPT-5 mini | $0.045 |
| Gemini 3 Flash Preview | $0.080 |
| GPT-5.4 mini | $0.120 |
| Claude Sonnet 5 at introductory price | $0.300 |

The output side matters for interview turns because Google explicitly includes thinking tokens in its output price; reasoning settings can therefore increase billed output. Prompt caching can materially reduce repeated context costs, but the exact benefit depends on provider routing and cache hits.

## Latency and quality considerations

There is no durable model-only latency ranking: OpenRouter routes across providers and exposes live provider-level latency, throughput, uptime, and data policy. Its routing documentation says default routing prioritizes price and can fall back after provider outages; it also supports sorting by throughput/latency and requiring providers to support every requested parameter. Use those controls when the first-turn UX needs predictable responsiveness. Sources: [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [OpenRouter model performance pages](https://openrouter.ai/google/gemini-3.1-flash-lite/providers).

The current OpenRouter snapshot shows the practical trade-off: Gemini 3.1 Flash-Lite has fast provider options and a 1M context window; Gemini 3 Flash Preview costs roughly twice as much on input and output but is positioned for materially stronger reasoning/tool use; GPT-5.4 mini is more expensive again but is explicitly positioned for reasoning, coding, and subagents; Sonnet 5 is the highest-cost option here and should be reserved for cases where quality gains pay for themselves. These are provider descriptions and routing observations, not a substitute for this repository's own evaluation fixtures.

For this product, run a small model bake-off against at least:

- source-locator fidelity and secret/prompt-injection resistance in file analysis;
- first-question naturalness, one-question-at-a-time behavior, and avoidance of already-known facts;
- coverage-area selection, contradiction detection, and bounded follow-up quality;
- strict JSON Schema validity and tool-call compliance;
- English/German behavior;
- p50/p95 end-to-end latency and cost per completed interview.

## OpenRouter privacy and routing constraint

The repository already requests `zdr: true` and `data_collection: "deny"`. Keep both constraints. OpenRouter documents that ZDR routes only to endpoints with a zero-data-retention policy and that Google AI Studio endpoints are removed when the Google ZDR model-group restriction is enabled; Vertex endpoints remain eligible. It also documents `require_parameters: true` for filtering out providers that cannot honor requested JSON/tool parameters. Sources: [OpenRouter ZDR](https://openrouter.ai/docs/guides/features/zdr), [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

This means the Gemini default should be tested on the actual ZDR-eligible Vertex route, not only in AI Studio. Before rollout, verify that the selected endpoint supports JSON Schema output and tools for the exact request shape. If the ZDR filter leaves too few healthy providers, prefer a fixed, approved provider order or a different model rather than silently relaxing privacy settings.

## Suggested rollout policy

1. Bake off `google/gemini-3.1-flash-lite`, `google/gemini-3-flash-preview`, and `openai/gpt-5.4-mini` using the repository's existing evaluation fixtures.
2. Start production with `google/gemini-3.1-flash-lite` for `file_analyzer` and `interview_planner`; use medium thinking for the planner and cap output tokens.
3. If planning quality is the limiting factor, move only `interview_planner` to `google/gemini-3-flash-preview`. Upgrade `interview_agent`, `interview_reviewer`, or `brief_generator` only when their role-specific evals show a gain.
4. Keep `google/gemini-2.5-flash-lite` as a low-cost file-analysis fallback, subject to the same ZDR and structured-output checks.
5. Offer `openai/gpt-5.4-mini` or `anthropic/claude-sonnet-5` as a premium workspace/operation tier for difficult projects, with cost and model metadata retained in the existing operation records.

## Primary sources

- [Google Gemini 3.1 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Google Gemini 2.5 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite)
- [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI GPT-5 mini model page](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [OpenAI GPT-5.4 mini model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [OpenRouter Gemini 3.1 Flash-Lite](https://openrouter.ai/google/gemini-3.1-flash-lite)
- [OpenRouter Gemini 2.5 Flash-Lite](https://openrouter.ai/google/gemini-2.5-flash-lite)
- [OpenRouter Gemini 3 Flash Preview](https://openrouter.ai/google/gemini-3-flash-preview)
- [OpenRouter GPT-5 mini](https://openrouter.ai/openai/gpt-5-mini)
- [OpenRouter GPT-5.4 mini](https://openrouter.ai/openai/gpt-5.4-mini)
- [Anthropic: Introducing Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5)
- [OpenRouter Anthropic model catalog](https://openrouter.ai/anthropic)
- [OpenRouter Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
