import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from "convex/server";
import type * as auth from "./auth";
import type * as client from "./client";
import type * as creatorProfiles from "./creator_profiles";
import type * as downloads from "./downloads";
import type * as downloadsData from "./downloads_data";
import type * as interviews from "./interviews";
import type * as jobs from "./jobs";
import type * as legal from "./legal";
import type * as localDev from "./local_dev";
import type * as templates from "./templates";
import type * as transcripts from "./transcripts";

type FullApi = ApiFromModules<{
  auth: typeof auth;
  client: typeof client;
  "creator_profiles": typeof creatorProfiles;
  downloads: typeof downloads;
  "downloads_data": typeof downloadsData;
  interviews: typeof interviews;
  jobs: typeof jobs;
  legal: typeof legal;
  "local_dev": typeof localDev;
  templates: typeof templates;
  transcripts: typeof transcripts;
}>;

export const api = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "public">
>;
export const internal = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "internal">
>;
