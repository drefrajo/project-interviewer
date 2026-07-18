/**
 * Credential-free Convex API typing.
 *
 * The module graph yields the same function-reference types as generated
 * Convex API output without requiring a selected deployment during local
 * builds. Production codegen can coexist with this source-owned contract.
 */
import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from "convex/server";
import type * as briefs from "./briefs";
import type * as deletion from "./deletion";
import type * as interviews from "./interviews";
import type * as invites from "./invites";
import type * as materials from "./materials";
import type * as operations from "./operations";
import type * as projectHome from "./project-home";
import type * as rooms from "./rooms";
import type * as search from "./search";
import type * as workflows from "./workflows";

type FullApi = ApiFromModules<{
  briefs: typeof briefs;
  deletion: typeof deletion;
  interviews: typeof interviews;
  invites: typeof invites;
  materials: typeof materials;
  operations: typeof operations;
  "project-home": typeof projectHome;
  rooms: typeof rooms;
  search: typeof search;
  workflows: typeof workflows;
}>;

export const api = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "public">
>;
export const internal = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "internal">
>;
