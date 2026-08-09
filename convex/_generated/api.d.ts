/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as client from "../client.js";
import type * as creator_profiles from "../creator_profiles.js";
import type * as crons from "../crons.js";
import type * as downloads from "../downloads.js";
import type * as downloads_data from "../downloads_data.js";
import type * as http from "../http.js";
import type * as internal_refs from "../internal_refs.js";
import type * as interviews from "../interviews.js";
import type * as jobs from "../jobs.js";
import type * as legal from "../legal.js";
import type * as lib_agent_message from "../lib/agent_message.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_capability_crypto from "../lib/capability_crypto.js";
import type * as lib_components from "../lib/components.js";
import type * as lib_concept_generation from "../lib/concept_generation.js";
import type * as lib_concept_seeds from "../lib/concept_seeds.js";
import type * as lib_creator_identity from "../lib/creator_identity.js";
import type * as lib_delete_interview from "../lib/delete_interview.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_environment from "../lib/environment.js";
import type * as lib_interview_messages from "../lib/interview_messages.js";
import type * as lib_interview_output from "../lib/interview_output.js";
import type * as lib_interview_prompts from "../lib/interview_prompts.js";
import type * as lib_interview_turn from "../lib/interview_turn.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_pass_accounting from "../lib/pass_accounting.js";
import type * as lib_provider_json from "../lib/provider_json.js";
import type * as lib_provider_requests from "../lib/provider_requests.js";
import type * as lib_retention from "../lib/retention.js";
import type * as lib_stripe_catalog from "../lib/stripe_catalog.js";
import type * as lib_stripe_provider from "../lib/stripe_provider.js";
import type * as lib_stripe_webhook from "../lib/stripe_webhook.js";
import type * as local_dev from "../local_dev.js";
import type * as retention from "../retention.js";
import type * as templates from "../templates.js";
import type * as transcripts from "../transcripts.js";
import type * as typed_api from "../typed_api.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  billing: typeof billing;
  client: typeof client;
  creator_profiles: typeof creator_profiles;
  crons: typeof crons;
  downloads: typeof downloads;
  downloads_data: typeof downloads_data;
  http: typeof http;
  internal_refs: typeof internal_refs;
  interviews: typeof interviews;
  jobs: typeof jobs;
  legal: typeof legal;
  "lib/agent_message": typeof lib_agent_message;
  "lib/auth": typeof lib_auth;
  "lib/capability_crypto": typeof lib_capability_crypto;
  "lib/components": typeof lib_components;
  "lib/concept_generation": typeof lib_concept_generation;
  "lib/concept_seeds": typeof lib_concept_seeds;
  "lib/creator_identity": typeof lib_creator_identity;
  "lib/delete_interview": typeof lib_delete_interview;
  "lib/domain": typeof lib_domain;
  "lib/environment": typeof lib_environment;
  "lib/interview_messages": typeof lib_interview_messages;
  "lib/interview_output": typeof lib_interview_output;
  "lib/interview_prompts": typeof lib_interview_prompts;
  "lib/interview_turn": typeof lib_interview_turn;
  "lib/oauth": typeof lib_oauth;
  "lib/pass_accounting": typeof lib_pass_accounting;
  "lib/provider_json": typeof lib_provider_json;
  "lib/provider_requests": typeof lib_provider_requests;
  "lib/retention": typeof lib_retention;
  "lib/stripe_catalog": typeof lib_stripe_catalog;
  "lib/stripe_provider": typeof lib_stripe_provider;
  "lib/stripe_webhook": typeof lib_stripe_webhook;
  local_dev: typeof local_dev;
  retention: typeof retention;
  templates: typeof templates;
  transcripts: typeof transcripts;
  typed_api: typeof typed_api;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
