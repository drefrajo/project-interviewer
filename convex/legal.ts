import type { ActionCtx } from "./_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internalRefs } from "./internal_refs";
import { requireCreatorProfile, requireIdentity } from "./lib/auth";

const legalVersionsUrl = "https://drefrajo.dev/versions";

const legalVersion = v.object({
  version: v.number(),
  sha256: v.string(),
});

const legalStatus = v.object({
  accepted: v.boolean(),
  terms: legalVersion,
  dpa: legalVersion,
});

const acceptanceSnapshot = v.union(
  v.object({
    termsVersion: v.number(),
    dpaVersion: v.number(),
    termsHash: v.string(),
    dpaHash: v.string(),
  }),
  v.null(),
);

const acceptanceArgs = {
  termsVersion: v.number(),
  dpaVersion: v.number(),
  termsHash: v.string(),
  dpaHash: v.string(),
};

export type LegalDocumentVersion = {
  version: number;
  sha256: string;
};

export type LegalVersions = {
  terms: LegalDocumentVersion;
  dpa: LegalDocumentVersion;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseDocumentVersion = (
  value: unknown,
  documentName: "terms" | "dpa",
): LegalDocumentVersion => {
  if (!isRecord(value)) {
    throw new Error(`The legal versions response has no valid ${documentName}.`);
  }

  const version = value.version;
  const sha256 = value.sha256;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    typeof sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(sha256)
  ) {
    throw new Error(`The legal versions response has an invalid ${documentName}.`);
  }

  return { version, sha256: sha256.toLowerCase() };
};

export const parseLegalVersions = (payload: unknown): LegalVersions => {
  if (!isRecord(payload)) {
    throw new Error("The legal versions response is not an object.");
  }

  return {
    terms: parseDocumentVersion(payload.terms, "terms"),
    dpa: parseDocumentVersion(payload.dpa, "dpa"),
  };
};

const fetchLegalVersions = async (): Promise<LegalVersions> => {
  const response = await fetch(legalVersionsUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Could not load the current legal document versions.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Could not read the current legal document versions.");
  }
  return parseLegalVersions(payload);
};

const requireActionIdentity = async (ctx: ActionCtx) => {
  await requireIdentity(ctx);
};

export const latestAcceptance = internalQuery({
  args: {},
  returns: acceptanceSnapshot,
  handler: async (ctx) => {
    const creator = await requireCreatorProfile(ctx);
    const records = await ctx.db
      .query("legalAcceptances")
      .withIndex("by_account_id", (q) => q.eq("account_id", creator._id))
      .order("desc")
      .take(1);
    const record = records[0];
    return record
      ? {
          termsVersion: record.terms_version,
          dpaVersion: record.dpa_version,
          termsHash: record.terms_hash,
          dpaHash: record.dpa_hash,
        }
      : null;
  },
});

export const recordAcceptance = internalMutation({
  args: acceptanceArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const records = await ctx.db
      .query("legalAcceptances")
      .withIndex("by_account_id", (q) => q.eq("account_id", creator._id))
      .order("desc")
      .take(1);
    const latest = records[0];
    if (
      latest?.terms_version === args.termsVersion &&
      latest.dpa_version === args.dpaVersion &&
      latest.terms_hash === args.termsHash &&
      latest.dpa_hash === args.dpaHash
    ) {
      return null;
    }

    await ctx.db.insert("legalAcceptances", {
      account_id: creator._id,
      accepted_at: Date.now(),
      terms_version: args.termsVersion,
      dpa_version: args.dpaVersion,
      terms_hash: args.termsHash,
      dpa_hash: args.dpaHash,
    });
    return null;
  },
});

export const getStatus = action({
  args: {},
  returns: legalStatus,
  handler: async (ctx) => {
    await requireActionIdentity(ctx);
    const versions = await fetchLegalVersions();
    const latest = await ctx.runQuery(internalRefs.legal.latestAcceptance, {});
    return {
      accepted:
        latest !== null &&
        latest.termsVersion === versions.terms.version &&
        latest.dpaVersion === versions.dpa.version &&
        latest.termsHash === versions.terms.sha256 &&
        latest.dpaHash === versions.dpa.sha256,
      ...versions,
    };
  },
});

export const acceptCurrent = action({
  args: {},
  returns: legalStatus,
  handler: async (ctx) => {
    await requireActionIdentity(ctx);
    const versions = await fetchLegalVersions();
    await ctx.runMutation(internalRefs.legal.recordAcceptance, {
      termsVersion: versions.terms.version,
      dpaVersion: versions.dpa.version,
      termsHash: versions.terms.sha256,
      dpaHash: versions.dpa.sha256,
    });
    return { accepted: true, ...versions };
  },
});
