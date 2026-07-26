import type { AgentComponent } from "@convex-dev/agent";
import type { ComponentApi as AgentComponentApi } from "@convex-dev/agent/_generated/component.js";
import type { ComponentApi as RateLimiterComponentApi } from "@convex-dev/rate-limiter/_generated/component.js";
import { componentsGeneric } from "convex/server";

const components = componentsGeneric();

export const agentComponent =
  components.agent as unknown as AgentComponent & AgentComponentApi;
export const rateLimiterComponent =
  components.rateLimiter as unknown as RateLimiterComponentApi;
