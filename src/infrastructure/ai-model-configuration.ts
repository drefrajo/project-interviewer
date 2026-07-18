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
  file_analyzer: "openai/gpt-5-mini",
  interview_planner: "openai/gpt-5",
  interview_agent: "openai/gpt-5",
  interview_reviewer: "anthropic/claude-sonnet-4",
  brief_generator: "openai/gpt-5",
  embeddings: EMBEDDING_CONFIGURATION.model,
} as const satisfies Record<AiRole, string>;
