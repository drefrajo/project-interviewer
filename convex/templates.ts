import { action, env, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCreatorProfile } from "./lib/auth";
import { assertLength, MAX_INSTRUCTIONS_LENGTH } from "./lib/domain";
import { clientLanguage } from "./schema";
import { buildOpenRouterTextRequest } from "./lib/provider_requests";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const creator = await requireCreatorProfile(ctx);
    const [builtIn, privateTemplates] = await Promise.all([
      ctx.db
        .query("interviewTemplates")
        .withIndex("by_kind", (q) => q.eq("kind", "built_in"))
        .take(12),
      ctx.db
        .query("interviewTemplates")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", creator._id))
        .order("desc")
        .take(100),
    ]);
    return [...builtIn, ...privateTemplates].map((template) => ({
      _id: template._id,
      kind: template.kind,
      ...(template.builtInKey
        ? { builtInKey: template.builtInKey }
        : {}),
      name: template.name,
      sourceLanguage: template.sourceLanguage,
      instructions: template.instructions,
      updatedAt: template.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sourceLanguage: clientLanguage,
    instructions: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const now = Date.now();
    return await ctx.db.insert("interviewTemplates", {
      kind: "private",
      ownerId: creator._id,
      name: assertLength("Template name", args.name, 120),
      sourceLanguage: args.sourceLanguage,
      instructions: assertLength(
        "Interview Instructions",
        args.instructions,
        MAX_INSTRUCTIONS_LENGTH,
      ),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    templateId: v.id("interviewTemplates"),
    name: v.string(),
    sourceLanguage: clientLanguage,
    instructions: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const template = await ctx.db.get("interviewTemplates", args.templateId);
    if (
      !template ||
      template.kind !== "private" ||
      template.ownerId !== creator._id
    ) {
      throw new Error("Template not found.");
    }
    await ctx.db.patch("interviewTemplates", template._id, {
      name: assertLength("Template name", args.name, 120),
      sourceLanguage: args.sourceLanguage,
      instructions: assertLength(
        "Interview Instructions",
        args.instructions,
        MAX_INSTRUCTIONS_LENGTH,
      ),
      updatedAt: Date.now(),
    });
    return template._id;
  },
});

export const remove = mutation({
  args: { templateId: v.id("interviewTemplates") },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const template = await ctx.db.get("interviewTemplates", args.templateId);
    if (
      !template ||
      template.kind !== "private" ||
      template.ownerId !== creator._id
    ) {
      throw new Error("Template not found.");
    }
    await ctx.db.delete("interviewTemplates", template._id);
    return null;
  },
});

export const translate = action({
  args: {
    instructions: v.string(),
    targetLanguage: clientLanguage,
  },
  handler: async (ctx, args) => {
    await ctx.auth.getUserIdentity().then((identity) => {
      if (!identity) throw new Error("Not authenticated.");
    });
    const instructions = assertLength(
      "Interview Instructions",
      args.instructions,
      MAX_INSTRUCTIONS_LENGTH,
    );
    const request = buildOpenRouterTextRequest({
      apiKey: env.OPENROUTER_API_KEY,
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "Translate the supplied Interview Instructions faithfully. Preserve headings and constraints. Return only the translation.",
        },
        {
          role: "user",
          content: `Target language: ${args.targetLanguage}\n\n${instructions}`,
        },
      ],
      operation: "translation",
    });
    const response = await fetch(request.url, request.init);
    if (!response.ok) {
      throw new Error(`Template translation failed (${response.status}).`);
    }
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("choices" in body) ||
      !Array.isArray(body.choices)
    ) {
      throw new Error("Template translation returned an invalid response.");
    }
    const first = body.choices[0] as
      | { message?: { content?: unknown } }
      | undefined;
    if (typeof first?.message?.content !== "string") {
      throw new Error("Template translation returned no text.");
    }
    return { instructions: first.message.content };
  },
});
