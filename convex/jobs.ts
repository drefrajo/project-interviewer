import { listMessages, saveMessage } from "@convex-dev/agent";
import { v } from "convex/values";
import {
  env,
  internalAction,
  internalMutation,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { agentComponent } from "./lib/components";
import { generateConceptsInParallel } from "./lib/concept_generation";
import { parseConceptSeeds } from "./lib/concept_seeds";
import { buildInterviewMessages } from "./lib/interview_messages";
import { parseInterviewOutput } from "./lib/interview_output";
import {
  buildConceptSeedMessages,
  buildInterviewPlanMessages,
  buildInterviewPolicy,
  buildProjectDocumentMessages,
  buildProjectDocumentRevisionMessages,
  buildVisualConceptImagePrompt,
} from "./lib/interview_prompts";
import { resolveInterviewTurn } from "./lib/interview_turn";
import {
  buildCloudflareEmailRequest,
  buildOpenRouterImageRequest,
  buildOpenRouterTextRequest,
  type ConceptImageModel,
  type ProviderMessage,
} from "./lib/provider_requests";
import { visualConcept } from "./schema";
import { internalRefs } from "./internal_refs";

type Completion = {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
};

const responseText = async (response: Response) => {
  if (!response.ok) {
    const error = new Error(`Provider request failed (${response.status}).`);
    error.name =
      response.status === 408 || response.status === 429 || response.status >= 500
        ? "TEMPORARY_PROVIDER_ERROR"
        : "PROVIDER_ERROR";
    throw error;
  }
  const body = (await response.json()) as Completion;
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Provider returned no text.");
  }
  return { content, usage: body.usage };
};

const textContent = (message: {
  message?: { role: string; content: unknown } | undefined;
}): ProviderMessage | null => {
  const raw = message.message;
  if (!raw || (raw.role !== "user" && raw.role !== "assistant")) return null;
  const content =
    typeof raw.content === "string"
      ? raw.content
      : Array.isArray(raw.content)
        ? raw.content
            .flatMap((part) =>
              typeof part === "object" &&
              part !== null &&
              "type" in part &&
              part.type === "text" &&
              "text" in part &&
              typeof part.text === "string"
                ? [part.text]
                : [],
            )
            .join("\n")
        : "";
  return content ? { role: raw.role, content } : null;
};

const usagePatch = (
  current: Doc<"interviews">["usage"],
  usage: Completion["usage"],
) => ({
  inputTokens: current.inputTokens + (usage?.prompt_tokens ?? 0),
  outputTokens: current.outputTokens + (usage?.completion_tokens ?? 0),
  estimatedCostUsd: current.estimatedCostUsd + (usage?.cost ?? 0),
});

export const begin = internalMutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview?.operation || interview.operation.status !== "pending") {
      return null;
    }
    const operation = {
      ...interview.operation,
      status: "running" as const,
      attempt: interview.operation.attempt + 1,
      startedAt: Date.now(),
      ...(interview.operation.kind === "concept_generation"
        ? {
            phase:
              (interview.operation.regeneratePrompts === true ||
                (interview.operation.additionalConcepts === true
                  ? interview.concepts.length !== 6
                  : interview.concepts.length !== 3))
                ? ("concept_planning" as const)
                : ("concept_creating" as const),
          }
        : {}),
    };
    await ctx.db.patch("interviews", interview._id, { operation });
    const creator = await ctx.db.get("creatorProfiles", interview.creatorId);
    return creator ? { interview: { ...interview, operation }, creator } : null;
  },
});

export const completeText = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    kind: v.union(
      v.literal("interview_response"),
      v.literal("document_revision"),
    ),
    interviewTurnKind: v.optional(
      v.union(
        v.literal("question"),
        v.literal("alignment"),
        v.literal("ready"),
        v.literal("document"),
      ),
    ),
    assistantContent: v.optional(v.string()),
    projectDocument: v.optional(v.string()),
    suggestedReplies: v.optional(v.array(v.string())),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      !interview?.operation ||
      interview.operation.kind !== args.kind ||
      interview.operation.status !== "running"
    ) {
      return null;
    }
    if (args.kind === "interview_response" && args.assistantContent) {
      await saveMessage(ctx, agentComponent, {
        threadId: interview.agentThreadId,
        message: { role: "assistant", content: args.assistantContent },
        agentName: "Project Interviewer",
      });
    }
    await ctx.db.patch("interviews", interview._id, {
      ...(args.projectDocument
        ? {
            projectDocument: args.projectDocument,
            step: "review" as const,
            suggestedReplies: [],
            alignmentAskedAtClientMessageCount: undefined,
          }
        : args.kind === "interview_response"
          ? {
              suggestedReplies: args.suggestedReplies ?? [],
              alignmentAskedAtClientMessageCount:
                args.interviewTurnKind === "alignment"
                  ? interview.clientMessageCount
                  : undefined,
            }
          : {}),
      operation: undefined,
      usage: usagePatch(interview.usage, {
        prompt_tokens: args.inputTokens,
        completion_tokens: args.outputTokens,
        cost: args.estimatedCostUsd,
      }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const saveInterviewPlan = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    interviewPlan: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      interview?.operation?.kind !== "interview_response" ||
      interview.operation.status !== "running" ||
      interview.clientMessageCount !== 1 ||
      interview.interviewPlan
    ) {
      return null;
    }
    await ctx.db.patch("interviews", interview._id, {
      interviewPlan: args.interviewPlan,
      usage: usagePatch(interview.usage, {
        prompt_tokens: args.inputTokens,
        completion_tokens: args.outputTokens,
        cost: args.estimatedCostUsd,
      }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const setConceptGenerationPhase = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    phase: v.union(
      v.literal("concept_planning"),
      v.literal("concept_creating"),
    ),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      interview?.operation?.kind !== "concept_generation" ||
      interview.operation.status !== "running"
    ) {
      return null;
    }
    await ctx.db.patch("interviews", interview._id, {
      operation: { ...interview.operation, phase: args.phase },
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const completeConcepts = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    concepts: v.array(visualConcept),
    hasFailure: v.boolean(),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      !interview?.operation ||
      interview.operation.kind !== "concept_generation" ||
      interview.operation.status !== "running"
    ) {
      return null;
    }
    await ctx.db.patch("interviews", interview._id, {
      concepts: args.concepts,
      operation: args.hasFailure
        ? {
            ...interview.operation,
            status:
              interview.operation.attempt < 3
                ? ("pending" as const)
                : ("failed" as const),
            errorCode: "CONCEPT_GENERATION_FAILED",
          }
        : undefined,
      updatedAt: Date.now(),
    });
    if (args.hasFailure && interview.operation.attempt < 3) {
      await ctx.scheduler.runAfter(1000, internalRefs.jobs.runPending, {
        interviewId: interview._id,
      });
    }
    return null;
  },
});

export const completeEmail = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    delivery: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("unknown"),
    ),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview?.submission) return null;
    const attempts = interview.submission.emailAttempts + 1;
    const retry =
      args.delivery === "failed" &&
      attempts < 3 &&
      interview.operation?.kind === "email_notification";
    await ctx.db.patch("interviews", interview._id, {
      submission: {
        ...interview.submission,
        emailDelivery: retry ? "pending" : args.delivery,
        emailAttempts: attempts,
      },
      operation: retry
        ? {
            kind: "email_notification",
            status: "pending",
            attempt: attempts,
          }
        : undefined,
      updatedAt: Date.now(),
    });
    if (retry) {
      await ctx.scheduler.runAfter(1000, internalRefs.jobs.runPending, {
        interviewId: interview._id,
      });
    }
    return null;
  },
});

export const fail = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    errorCode: v.string(),
    ambiguous: v.boolean(),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview?.operation) return null;
    if (interview.operation.kind === "email_notification" && args.ambiguous) {
      if (interview.submission) {
        await ctx.db.patch("interviews", interview._id, {
          submission: {
            ...interview.submission,
            emailDelivery: "unknown",
            emailAttempts: interview.submission.emailAttempts + 1,
          },
          operation: undefined,
          updatedAt: Date.now(),
        });
      }
      return null;
    }
    const retry = interview.operation.attempt < 3;
    await ctx.db.patch("interviews", interview._id, {
      operation: {
        ...interview.operation,
        status: retry ? "pending" : "failed",
        errorCode: args.errorCode,
      },
      updatedAt: Date.now(),
    });
    if (retry) {
      await ctx.scheduler.runAfter(1000, internalRefs.jobs.runPending, {
        interviewId: interview._id,
      });
    }
    return null;
  },
});

const runInterview = async (
  ctx: ActionCtx,
  interview: Doc<"interviews">,
) => {
  const transcript = await listMessages(ctx, agentComponent, {
    threadId: interview.agentThreadId,
    paginationOpts: { numItems: 120, cursor: null },
    excludeToolMessages: true,
    statuses: ["success"],
  });
  const transcriptMessages = [...transcript.page]
    .reverse()
    .flatMap((message) => {
      const text = textContent(message);
      return text ? [text] : [];
    });
  const createPlan =
    interview.clientMessageCount === 1 && !interview.interviewPlan;
  let interviewPlan = interview.interviewPlan;
  if (createPlan) {
    const planRequest = buildOpenRouterTextRequest({
      apiKey: env.OPENROUTER_API_KEY,
      model: interview.model,
      operation: "interview_plan",
      messages: buildInterviewPlanMessages({
        instructions: interview.instructions,
        transcript: transcriptMessages,
      }),
    });
    const generatedPlan = await (async () => {
      try {
        return await responseText(
          await fetch(planRequest.url, planRequest.init),
        );
      } catch {
        return null;
      }
    })();
    if (generatedPlan) {
      interviewPlan = generatedPlan.content.trim().slice(0, 6000) || undefined;
      if (interviewPlan) {
        await ctx.runMutation(internalRefs.jobs.saveInterviewPlan, {
          interviewId: interview._id,
          interviewPlan,
          inputTokens: generatedPlan.usage?.prompt_tokens ?? 0,
          outputTokens: generatedPlan.usage?.completion_tokens ?? 0,
          estimatedCostUsd: generatedPlan.usage?.cost ?? 0,
        });
      }
    }
  }
  const request = buildOpenRouterTextRequest({
    apiKey: env.OPENROUTER_API_KEY,
    model: interview.model,
    operation: "interview",
    messages: buildInterviewMessages(
      buildInterviewPolicy({
        clientLanguage: interview.clientLanguage,
        instructions: interview.instructions,
        alignmentAsked:
          interview.alignmentAskedAtClientMessageCount !== undefined,
        ...(interviewPlan ? { interviewPlan } : {}),
      }),
      interview.clientLanguage,
      transcriptMessages,
    ),
  });
  const generated = await responseText(await fetch(request.url, request.init));
  const parsed = parseInterviewOutput(generated.content);
  const turn = resolveInterviewTurn(
    parsed.kind,
    interview.alignmentAskedAtClientMessageCount !== undefined,
  );
  if (turn === "reply") {
    await ctx.runMutation(internalRefs.jobs.completeText, {
      interviewId: interview._id,
      kind: "interview_response",
      interviewTurnKind: parsed.kind,
      assistantContent: parsed.content,
      suggestedReplies: parsed.suggestedReplies,
      inputTokens: generated.usage?.prompt_tokens ?? 0,
      outputTokens: generated.usage?.completion_tokens ?? 0,
      estimatedCostUsd: generated.usage?.cost ?? 0,
    });
    return;
  }
  const documentRequest = buildOpenRouterTextRequest({
    apiKey: env.OPENROUTER_API_KEY,
    model: interview.model,
    operation: "document",
    messages: buildProjectDocumentMessages({
      instructions: interview.instructions,
      transcript: transcriptMessages,
    }),
  });
  const document = await responseText(
    await fetch(documentRequest.url, documentRequest.init),
  );
  await ctx.runMutation(internalRefs.jobs.completeText, {
    interviewId: interview._id,
    kind: "interview_response",
    interviewTurnKind: parsed.kind,
    assistantContent: parsed.content,
    suggestedReplies: [],
    projectDocument: document.content,
    inputTokens:
      (generated.usage?.prompt_tokens ?? 0) +
      (document.usage?.prompt_tokens ?? 0),
    outputTokens:
      (generated.usage?.completion_tokens ?? 0) +
      (document.usage?.completion_tokens ?? 0),
    estimatedCostUsd:
      (generated.usage?.cost ?? 0) + (document.usage?.cost ?? 0),
  });
};

const runDocumentRevision = async (
  ctx: ActionCtx,
  interview: Doc<"interviews">,
) => {
  if (!interview.projectDocument || !interview.operation?.input) {
    throw new Error("Project Document revision input is missing.");
  }
  const request = buildOpenRouterTextRequest({
    apiKey: env.OPENROUTER_API_KEY,
    model: interview.model,
    operation: "document",
    messages: buildProjectDocumentRevisionMessages({
      instructions: interview.instructions,
      projectDocument: interview.projectDocument,
      feedback: interview.operation.input,
    }),
  });
  const generated = await responseText(await fetch(request.url, request.init));
  await ctx.runMutation(internalRefs.jobs.completeText, {
    interviewId: interview._id,
    kind: "document_revision",
    projectDocument: generated.content,
    inputTokens: generated.usage?.prompt_tokens ?? 0,
    outputTokens: generated.usage?.completion_tokens ?? 0,
    estimatedCostUsd: generated.usage?.cost ?? 0,
  });
};

const conceptSeeds = async (
  interview: Doc<"interviews">,
  idOffset = 0,
) => {
  if (!interview.projectDocument) {
    throw new Error("Project Document is missing.");
  }
  const request = buildOpenRouterTextRequest({
    apiKey: env.OPENROUTER_API_KEY,
    model: interview.model,
    operation: "concept_prompt",
    messages: buildConceptSeedMessages({
      clientLanguage: interview.clientLanguage,
      instructions: interview.instructions,
      projectDocument: interview.projectDocument,
      ...(idOffset > 0 ? { existingConcepts: interview.concepts } : {}),
    }),
  });
  const generated = await responseText(await fetch(request.url, request.init));
  return parseConceptSeeds(generated.content, idOffset);
};

const imageBlob = async (
  prompt: string,
  imageModel: ConceptImageModel,
) => {
  const request = buildOpenRouterImageRequest({
    apiKey: env.OPENROUTER_API_KEY,
    imageModel,
    prompt,
  });
  let response: Response;
  try {
    response = await fetch(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    const error = new Error("Image generation request failed.");
    error.name = "IMAGE_GENERATION_REQUEST_FAILED";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Image generation failed (${response.status}).`);
    error.name =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
        ? `TEMPORARY_IMAGE_PROVIDER_ERROR_${response.status}`
        : `IMAGE_PROVIDER_ERROR_${response.status}`;
    throw error;
  }
  const body = (await response.json()) as {
    data?: Array<{ b64_json?: unknown; url?: unknown }>;
  };
  const image = body.data?.[0];
  if (typeof image?.b64_json === "string") {
    const bytes = Uint8Array.from(atob(image.b64_json), (value) =>
      value.charCodeAt(0),
    );
    return new Blob([bytes], { type: "image/png" });
  }
  if (typeof image?.url === "string") {
    const fetched = await fetch(image.url);
    if (!fetched.ok) {
      const error = new Error("Generated image could not be stored.");
      error.name = "IMAGE_RESULT_FETCH_FAILED";
      throw error;
    }
    return await fetched.blob();
  }
  const error = new Error("Image provider returned no image.");
  error.name = "IMAGE_PROVIDER_EMPTY_RESPONSE";
  throw error;
};

const runConceptGeneration = async (
  ctx: ActionCtx,
  interview: Doc<"interviews">,
) => {
  const projectDocument = interview.projectDocument;
  if (!projectDocument) {
    throw new Error("Project Document is missing.");
  }
  const additionalConcepts = interview.operation?.additionalConcepts === true;
  const regeneratePrompts = interview.operation?.regeneratePrompts === true;
  const seeds = additionalConcepts
    ? interview.concepts.length === 6 && !regeneratePrompts
      ? interview.concepts
          .filter((concept) => Number.parseInt(concept.id.replace("concept_", ""), 10) > 3)
          .map(({ id, name, rationale, prompt }) => ({
            id,
            name,
            rationale,
            prompt,
          }))
      : await conceptSeeds(interview, 3)
    : interview.concepts.length === 3 && !regeneratePrompts
      ? interview.concepts.map(({ id, name, rationale, prompt }) => ({
          id,
          name,
          rationale,
          prompt,
        }))
      : await conceptSeeds(interview);
  const imageModel: ConceptImageModel =
    interview.operation?.imageModel ??
    (interview.model === "deepseek-v4-flash"
      ? "gpt-image-2-low"
      : "gpt-image-2");
  await ctx.runMutation(internalRefs.jobs.setConceptGenerationPhase, {
    interviewId: interview._id,
    phase: "concept_creating",
  });
  const existing = new Map(interview.concepts.map((item) => [item.id, item]));
  const generated = await generateConceptsInParallel(
    seeds,
    existing,
    async (seed) =>
      ctx.storage.store(
        await imageBlob(
          buildVisualConceptImagePrompt({
            instructions: interview.instructions,
            projectDocument,
            conceptPrompt: seed.prompt,
            conceptIndex: Number.parseInt(seed.id.replace("concept_", ""), 10),
            ...(additionalConcepts
              ? {
                  existingConcepts: [
                    ...interview.concepts.slice(0, 3),
                    ...seeds.filter((concept) => concept.id !== seed.id),
                  ],
                }
              : {}),
          }),
          imageModel,
        ),
      ),
  );
  const concepts = additionalConcepts
    ? [
        ...interview.concepts.filter(
          (concept) => !generated.concepts.some((item) => item.id === concept.id),
        ),
        ...generated.concepts,
      ]
    : generated.concepts;
  await ctx.runMutation(internalRefs.jobs.completeConcepts, {
    interviewId: interview._id,
    concepts,
    hasFailure: generated.hasFailure,
  });
};

const runEmail = async (
  ctx: ActionCtx,
  interview: Doc<"interviews">,
  creator: Doc<"creatorProfiles">,
) => {
  if (!interview.submission) throw new Error("Project Submission is missing.");
  const dashboardUrl = `${env.SITE_URL}/interviews/${interview._id}`;
  const request = buildCloudflareEmailRequest({
    apiUrl: env.CLOUDFLARE_EMAIL_API_URL,
    apiToken: env.CLOUDFLARE_EMAIL_API_TOKEN,
    from: env.EMAIL_FROM,
    to: creator.email,
    projectName: interview.projectName,
    dashboardUrl,
    submissionId: interview.submission.id,
  });
  const response = await fetch(request.url, request.init);
  await ctx.runMutation(internalRefs.jobs.completeEmail, {
    interviewId: interview._id,
    delivery: response.ok ? "sent" : "failed",
  });
};

export const runPending = internalAction({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const pending: {
      interview: Doc<"interviews">;
      creator: Doc<"creatorProfiles">;
    } | null = await ctx.runMutation(internalRefs.jobs.begin, args);
    if (!pending) return null;
    try {
      switch (pending.interview.operation?.kind) {
        case "interview_response":
          await runInterview(ctx, pending.interview);
          break;
        case "document_revision":
          await runDocumentRevision(ctx, pending.interview);
          break;
        case "concept_generation":
          await runConceptGeneration(ctx, pending.interview);
          break;
        case "email_notification":
          await runEmail(ctx, pending.interview, pending.creator);
          break;
      }
    } catch (error) {
      const code =
        error instanceof Error && error.name
          ? error.name.slice(0, 80)
          : "OPERATION_FAILED";
      await ctx.runMutation(internalRefs.jobs.fail, {
        interviewId: args.interviewId,
        errorCode: code,
        ambiguous: code === "EMAIL_DELIVERY_UNKNOWN",
      });
    }
    return null;
  },
});
