"use node";

import { Buffer } from "node:buffer";
import {
  internalActionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import { z } from "zod";
import { BRIEF_SECTION_IDS } from "../src/domain/project-brief";
import {
  createOpenAiCompatibleAdapter,
  type AiRole,
} from "../src/infrastructure/openai-compatible-adapter";
import { AI_ROLE_PROMPTS } from "../src/infrastructure/ai-role-prompts";
import { detectActualContentTypeFromBytes } from "../src/application/material-content-type";
import { localParser } from "../src/local/local-material-adapters";
import {
  findSuspectedSecrets,
  publicSuspectedSecrets,
  redactSegments,
} from "../src/domain/material-safety";
import type {
  AiOperationResult,
  DomainOperationKind,
} from "./lib/ai_contract";
import { internal } from "./typed_api";

type DomainContext = {
  operation: {
    status: string;
    roomId: GenericId<"projectRooms">;
  };
  room: Record<string, unknown>;
  material?: {
    storageId: GenericId<"_storage">;
    name: string;
    declaredContentType: string;
    includeSuspectedSecrets: boolean;
  };
  interview?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  turns?: unknown[];
  corrections?: unknown[];
  events?: unknown[];
  findings?: unknown[];
  contextPack?: Record<string, unknown>;
};

const kindValidator = v.union(
  v.literal("file_analysis"),
  v.literal("interview_planning"),
  v.literal("interview_turn"),
  v.literal("interview_review"),
  v.literal("brief_generation"),
);

const roleByKind: Record<DomainOperationKind, Exclude<AiRole, "embeddings">> = {
  file_analysis: "file_analyzer",
  interview_planning: "interview_planner",
  interview_turn: "interview_agent",
  interview_review: "interview_reviewer",
  brief_generation: "brief_generator",
};

const interviewTools = [
  {
    type: "function",
    function: {
      name: "list_project_material",
      description:
        "List active Project Material in this Project Room. Call this before all other file tools.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_file_summary",
      description:
        "Get the bounded, source-located analysis summary for one listed Project Material.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["materialId"],
        properties: { materialId: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_source_excerpts",
      description:
        "Search active, room-scoped material chunks for short source-located excerpts after reading a summary.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string", minLength: 1, maxLength: 500 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inspect_bounded_content",
      description:
        "Inspect one bounded active chunk returned by search. Never returns a whole raw file.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["chunkId"],
        properties: { chunkId: { type: "string" } },
      },
    },
  },
] as const;

const sourceLocatorOutput = z
  .object({
    kind: z.enum([
      "page",
      "slide",
      "sheet",
      "image",
      "paragraph",
      "text_range",
    ]),
    label: z.string().min(1),
    page: z.number().optional(),
    slide: z.number().optional(),
    sheet: z.string().optional(),
    range: z.string().optional(),
    image: z.number().optional(),
    paragraph: z.number().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
  })
  .strict();
const materialCategoryOutput = z.enum([
  "brief",
  "requirements",
  "design/reference",
  "technical",
  "commercial",
  "timeline",
  "other",
]);
const fileAnalysisOutput = z
  .object({
    summary: z.string().min(1),
    summaryLanguage: z.enum(["en", "de"]).optional(),
    summarySources: z.array(sourceLocatorOutput).min(1).max(8),
    primaryCategory: materialCategoryOutput,
    secondaryCategories: z.array(materialCategoryOutput).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
    signals: z
      .array(
        z
          .object({
            text: z.string().min(1),
            locator: sourceLocatorOutput,
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict();
const coverageAreaOutput = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    rubric: z.string().min(1),
    rationale: z.string().optional(),
    openQuestions: z.array(z.string()).default([]),
    required: z.boolean().default(true),
  })
  .strict();
const interviewPlanOutput = z
  .object({
    coverageAreas: z.array(coverageAreaOutput).min(1),
    knownRisks: z.array(z.string()),
    openGoals: z.array(z.string()),
  })
  .strict();
const nextQuestionOutput = z
  .object({
    id: z.string().optional(),
    text: z.string().min(1),
    coverageAreaId: z.string().min(1),
    kind: z.enum(["primary", "follow_up", "final_anything_else"]),
    reason: z.string().min(1),
  })
  .strict();
const interviewReviewOutput = z
  .object({
    status: z.enum(["completed", "awaiting_confirmation", "active"]),
    blockers: z.array(z.string()),
    completionRationale: z.string().optional(),
  })
  .strict();
const evidenceSourceOutput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project_description") }).strict(),
  z.object({ type: z.literal("turn"), turnId: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("correction"),
      correctionId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("analysis_feedback"),
      feedbackId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("material"),
      materialId: z.string().min(1),
      locator: sourceLocatorOutput,
    })
    .strict(),
  z
    .object({
      type: z.literal("model_inference"),
      description: z.string().min(1),
    })
    .strict(),
]);
const interviewTurnOutput = z
  .object({
    status: z.enum(["active", "awaiting_confirmation", "completed_early"]),
    nextQuestion: nextQuestionOutput.nullish(),
    unresolvedTopics: z.array(z.string()),
    coverageUpdates: z
      .array(
        z
          .object({
            id: z.string().min(1),
            status: z.enum([
              "uncovered",
              "partial",
              "sufficient",
              "not_applicable",
            ]),
            evidence: z.array(evidenceSourceOutput),
            rationale: z.string(),
            openQuestions: z.array(z.string()),
            vagueFollowupCount: z.number().int().min(0).optional(),
          })
          .strict(),
      )
      .default([]),
    findings: z
      .array(
        z
          .object({
            type: z.enum([
              "candidate_requirement",
              "assumption",
              "risk",
              "gap",
              "contradiction",
            ]),
            statement: z.string().min(1),
            sources: z.array(evidenceSourceOutput).min(1),
            status: z
              .enum(["active", "resolved", "explicitly_open"])
              .optional(),
          })
          .strict(),
      )
      .default([]),
    findingStatusUpdates: z
      .array(
        z
          .object({
            id: z.string().min(1),
            status: z.enum([
              "active",
              "resolved",
              "explicitly_open",
              "needs_reassessment",
            ]),
            sources: z.array(evidenceSourceOutput),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
const briefOutput = z
  .object({
    sections: z
      .array(
        z
          .object({
            id: z.enum(BRIEF_SECTION_IDS),
            title: z.string().min(1),
            content: z.string(),
            sources: z.array(evidenceSourceOutput),
            items: z
              .array(
                z
                  .object({
                    id: z.string().optional(),
                    kind: z.enum([
                      "requirement",
                      "target",
                      "parameter",
                      "assumption",
                      "risk",
                      "gap",
                      "contradiction",
                      "decision",
                    ]),
                    text: z.string().min(1),
                    scopeStatus: z
                      .enum(["in_scope", "out_of_scope", "open"])
                      .optional(),
                    priority: z.string().nullable().optional(),
                    findingId: z.string().optional(),
                    sources: z.array(evidenceSourceOutput).min(1),
                  })
                  .strict(),
              )
              .default([]),
          })
          .strict(),
      )
      .min(1),
    warnings: z
      .array(
        z
          .object({
            id: z.string().optional(),
            category: z.enum([
              "feasibility",
              "scope",
              "budget",
              "timeline",
              "responsibility",
              "critical_gap",
              "contradiction",
            ]),
            message: z.string().min(1),
            subjectId: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const outputValidators: Record<DomainOperationKind, z.ZodType> = {
  file_analysis: fileAnalysisOutput,
  interview_planning: interviewPlanOutput,
  interview_turn: interviewTurnOutput,
  interview_review: interviewReviewOutput,
  brief_generation: briefOutput,
};

const schemaNames: Record<DomainOperationKind, string> = {
  file_analysis: "file_analysis",
  interview_planning: "interview_plan",
  interview_turn: "interview_turn",
  interview_review: "interview_review",
  brief_generation: "project_brief",
};

const schemas = Object.fromEntries(
  Object.entries(outputValidators).map(([kind, validator]) => [
    kind,
    {
      name: schemaNames[kind as DomainOperationKind],
      jsonSchema: z.toJSONSchema(validator, {
        target: "draft-7",
        io: "output",
      }) as Record<string, unknown>,
    },
  ]),
) as Record<
  DomainOperationKind,
  { name: string; jsonSchema: Record<string, unknown> }
>;

const validateDomainOutput = (
  kind: DomainOperationKind,
  value: unknown,
) => {
  const parsed = outputValidators[kind].safeParse(value);
  return parsed.success
    ? {
        ok: true as const,
        value: parsed.data as Record<string, unknown>,
      }
    : {
        ok: false as const,
        errors: parsed.error.issues.map(
          (issue) =>
            `${issue.path.join(".") || "response"}: ${issue.message}`,
        ),
      };
};

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing AI environment variable: ${name}`);
  }
  return value;
};

const configuredModels = (): Partial<Record<AiRole, string>> => ({
  file_analyzer: requiredEnvironment("AI_MODEL_FILE_ANALYZER"),
  interview_planner: requiredEnvironment("AI_MODEL_INTERVIEW_PLANNER"),
  interview_agent: requiredEnvironment("AI_MODEL_INTERVIEW_AGENT"),
  interview_reviewer: requiredEnvironment("AI_MODEL_INTERVIEW_REVIEWER"),
  brief_generator: requiredEnvironment("AI_MODEL_BRIEF_GENERATOR"),
  embeddings: requiredEnvironment("AI_MODEL_EMBEDDINGS"),
});

const createAdapter = () =>
  createOpenAiCompatibleAdapter({
    apiKey: requiredEnvironment("OPENROUTER_API_KEY"),
    baseUrl:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    allowedProviders: requiredEnvironment("OPENROUTER_ALLOWED_PROVIDERS")
      .split(",")
      .map((provider) => provider.trim())
      .filter(Boolean),
    models: configuredModels(),
  });

const parseMaterial = async (
  context: GenericActionCtx<GenericDataModel>,
  domain: DomainContext,
  adapter: ReturnType<typeof createAdapter>,
  markProgress: (
    stage:
      | "checking_file"
      | "extracting_content"
      | "checking_secrets"
      | "analyzing"
      | "indexing",
  ) => Promise<void>,
) => {
  if (!domain.material) {
    throw new Error("File-analysis material not found.");
  }
  await markProgress("checking_file");
  const storageUrl = await context.storage.getUrl(domain.material.storageId);
  if (!storageUrl) {
    throw new Error("Material storage object not found.");
  }
  const bytes = new Uint8Array(await (await fetch(storageUrl)).arrayBuffer());
  const actualContentType = await detectActualContentTypeFromBytes(
    domain.material.name,
    domain.material.declaredContentType,
    bytes,
  );
  await markProgress("extracting_content");
  const extraction = await localParser.extract({
    name: domain.material.name,
    contentType: actualContentType,
    bytes,
  });
  await markProgress("checking_secrets");
  const suspectedSecrets = findSuspectedSecrets(extraction.segments);
  const safeSegments = redactSegments(
    extraction.segments,
    suspectedSecrets,
    false,
  );
  const analyzerSegments = redactSegments(
    extraction.segments,
    suspectedSecrets,
    domain.material.includeSuspectedSecrets,
  );
  const chunkSegments = (
    segments: typeof extraction.segments,
  ) => segments.flatMap((segment) => {
    const values: Array<{ text: string; locator: unknown }> = [];
    for (let offset = 0; offset < segment.text.length; offset += 1_200) {
      values.push({
        text: segment.text.slice(offset, offset + 1_200),
        locator: segment.locator,
      });
    }
    return values;
  });
  const chunks = chunkSegments(safeSegments);
  const analyzerChunks = chunkSegments(analyzerSegments);
  await markProgress("analyzing");
  const embeddings = chunks.length
    ? await adapter.embed(
        (domain.material.includeSuspectedSecrets
          ? analyzerChunks
          : chunks
        ).map(({ text }) => text),
      )
    : { vectors: [] };
  const imageContent = actualContentType.startsWith("image/")
    ? [
        {
          type: "image_url",
          image_url: {
            url: `data:${actualContentType};base64,${Buffer.from(bytes).toString("base64")}`,
          },
        },
      ]
    : [];
  return {
    extraction: {
      method: extraction.method,
      language: extraction.language,
      actualContentType,
      suspectedSecrets: publicSuspectedSecrets(suspectedSecrets),
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        embedding: [...(embeddings.vectors[index] ?? [])],
      })),
    },
    evidence: [
      {
        type: "text",
        text: JSON.stringify({
          fileName: domain.material.name,
          actualContentType,
          segments: analyzerSegments,
        }),
      },
      ...imageContent,
    ],
  };
};

export const executeDomainOperation = internalActionGeneric({
  args: {
    operationId: v.id("durableOperations"),
    kind: kindValidator,
    subjectId: v.string(),
  },
  handler: async (context, args): Promise<AiOperationResult> => {
    const domain = (await context.runQuery(
      internal.workflows.loadDomainOperationContext,
      args,
    )) as DomainContext | null;
    if (
      !domain ||
      domain.operation.status === "cancelled" ||
      domain.operation.status === "succeeded"
    ) {
      throw new Error("Operation is no longer active.");
    }
    const adapter = createAdapter();
    const markMaterialProgress = async (
      stage:
        | "checking_file"
        | "extracting_content"
        | "checking_secrets"
        | "analyzing"
        | "indexing",
    ) => {
      if (args.kind !== "file_analysis") return;
      await context.runMutation(internal.workflows.markMaterialProgress, {
        operationId: args.operationId,
        materialId: args.subjectId as GenericId<"projectMaterials">,
        stage,
      });
    };
    const parsed =
      args.kind === "file_analysis"
        ? await parseMaterial(
            context,
            domain,
            adapter,
            markMaterialProgress,
          )
        : undefined;
    const schema = schemas[args.kind];
    const evidence =
      parsed?.evidence ??
      JSON.stringify({
        room: domain.room,
        interview: domain.interview,
        plan: domain.plan,
        turns: domain.turns,
        corrections: domain.corrections,
        events: domain.events,
        findings: domain.findings,
        contextPack: domain.contextPack,
      });
    let retrievalStage = 0;
    const listedMaterialIds = new Set<string>();
    const searchableChunkIds = new Set<string>();
    const requiredString = (
      argumentsValue: Readonly<Record<string, unknown>>,
      key: string,
    ) => {
      const value = argumentsValue[key];
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Interview retrieval tool requires ${key}.`);
      }
      return value.trim();
    };
    const executeInterviewTool =
      args.kind === "interview_turn"
        ? async (
            name: string,
            argumentsValue: Readonly<Record<string, unknown>>,
          ): Promise<unknown> => {
            if (name === "list_project_material") {
              const bundle = await context.runQuery(
                internal.search.interviewEvidenceBundle,
                { roomId: domain.operation.roomId, searchText: "" },
              );
              const results = bundle.stages[0].results;
              for (const item of results) {
                listedMaterialIds.add(item.materialId);
              }
              retrievalStage = Math.max(retrievalStage, 1);
              return { untrustedEvidence: true, results };
            }
            if (name === "get_file_summary") {
              if (retrievalStage < 1) {
                throw new Error(
                  "List Project Material before requesting a file summary.",
                );
              }
              const materialId = requiredString(
                argumentsValue,
                "materialId",
              );
              if (!listedMaterialIds.has(materialId)) {
                throw new Error(
                  "File summary target is not active Project Material in this room.",
                );
              }
              const bundle = await context.runQuery(
                internal.search.interviewEvidenceBundle,
                { roomId: domain.operation.roomId, searchText: "" },
              );
              retrievalStage = Math.max(retrievalStage, 2);
              return {
                untrustedEvidence: true,
                results: bundle.stages[1].results.filter(
                  (summary) => summary.materialId === materialId,
                ),
              };
            }
            if (name === "search_source_excerpts") {
              if (retrievalStage < 2) {
                throw new Error(
                  "Read a file summary before searching source excerpts.",
                );
              }
              const searchText = requiredString(argumentsValue, "query");
              const embedding = await adapter.embed([searchText]);
              const vector = embedding.vectors[0] ?? [];
              const vectorMatches =
                vector.length === 1536
                  ? await context.vectorSearch(
                      "materialChunks",
                      "by_embedding",
                      {
                        vector: [...vector],
                        limit: 8,
                        filter: (query) =>
                          query.eq("roomId", domain.operation.roomId),
                      },
                    )
                  : [];
              const bundle = await context.runQuery(
                internal.search.interviewEvidenceBundle,
                {
                  roomId: domain.operation.roomId,
                  searchText,
                  vectorChunkIds: vectorMatches.map(
                    (result) => result._id,
                  ),
                },
              );
              const results = bundle.stages[2].results;
              for (const result of results) {
                searchableChunkIds.add(result.chunkId);
              }
              retrievalStage = Math.max(retrievalStage, 3);
              return { untrustedEvidence: true, results };
            }
            if (name === "inspect_bounded_content") {
              if (retrievalStage < 3) {
                throw new Error(
                  "Search source excerpts before inspecting bounded content.",
                );
              }
              const chunkId = requiredString(argumentsValue, "chunkId");
              if (!searchableChunkIds.has(chunkId)) {
                throw new Error(
                  "Bounded inspection is limited to a chunk returned by this request's room-scoped search.",
                );
              }
              const result = await context.runQuery(
                internal.search.inspectInterviewChunk,
                {
                  roomId: domain.operation.roomId,
                  chunkId,
                },
              );
              if (!result) {
                throw new Error(
                  "The selected material chunk is no longer active.",
                );
              }
              return result;
            }
            throw new Error(`Unknown Interview Agent tool: ${name}.`);
          }
        : undefined;
    const result = await adapter.structuredChat<Record<string, unknown>>({
      role: roleByKind[args.kind],
      messages: [
        {
          role: "system",
          content:
            AI_ROLE_PROMPTS[roleByKind[args.kind]],
        },
        {
          role: "user",
          content:
            typeof evidence === "string"
              ? evidence
              : evidence,
        },
      ],
      ...(args.kind === "interview_turn"
        ? {
            tools: interviewTools,
            executeTool: executeInterviewTool as NonNullable<
              typeof executeInterviewTool
            >,
            maxToolCalls: 8,
          }
        : {}),
      schema,
      validate: (value) => validateDomainOutput(args.kind, value),
    });
    await markMaterialProgress("indexing");
    return {
      ...result,
      ...(parsed ? { extraction: parsed.extraction } : {}),
    };
  },
});
