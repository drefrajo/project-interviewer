import { betterAuth } from "better-auth/minimal";
import { createAuthOptions } from "../auth";

/**
 * Static Better Auth instance used only by the schema generator.
 * Runtime options and environment validation live in ../auth.ts.
 */
export const auth = betterAuth({
  ...createAuthOptions({} as never),
});
