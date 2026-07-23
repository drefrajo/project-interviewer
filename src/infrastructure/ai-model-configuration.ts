import type { AiRole } from "./openai-compatible-adapter";

/**
 * Source-owned AI model policy.
 *
 * Changing the embedding model or dimensions requires re-embedding stored
 * material and migrating the Convex vector index. Keeping both values here
 * makes that compatibility boundary explicit and reviewable.
 */
export const EMBEDDING_CONFIGURATION = {
  model: "openai/text-embedding-3-small",
  dimensions: 1536,
} as const;

export const AI_MODELS = {
  // All chat roles use OpenAI models with strict json_schema support.
  // Luna is fast and cost-efficient with strict json_schema support.
  // GPT-5 mini handles file analysis at the lowest cost.
  file_analyzer: "openai/gpt-5-mini",
  interview_planner: "openai/gpt-5.6-luna",
  interview_agent: "openai/gpt-5.6-luna",
  interview_reviewer: "openai/gpt-5.6-luna",
  brief_generator: "openai/gpt-5.6-luna",
  embeddings: EMBEDDING_CONFIGURATION.model,
} as const satisfies Record<AiRole, string>;
