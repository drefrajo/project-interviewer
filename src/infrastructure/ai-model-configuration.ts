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
  // Gemini providers reject the nested source-locator JSON schema with
  // HTTP 400, and Claude models before 4.5 silently ignore response_format.
  // The roles below must therefore stay on providers verified to honor
  // strict structured outputs for the app's schemas.
  file_analyzer: "openai/gpt-5-mini",
  interview_planner: "google/gemini-3.1-flash-lite",
  interview_agent: "openai/gpt-5",
  interview_reviewer: "anthropic/claude-sonnet-4.5",
  brief_generator: "openai/gpt-5",
  embeddings: EMBEDDING_CONFIGURATION.model,
} as const satisfies Record<AiRole, string>;
