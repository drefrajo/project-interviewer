import { z } from "zod";
import type {
  DiscoveryInterviewView,
  EvidenceReference,
  InterviewQuestion,
} from "../domain/discovery-interview";
import {
  BRIEF_SECTION_IDS,
  type BriefSource,
  type ProjectBriefView,
} from "../domain/project-brief";
import type {
  AnalysisFeedback,
  ContextPackRevision,
  FileAnalysis,
  ProjectMaterialView,
  SourceLocator,
} from "../domain/project-material";

const language = z.enum(["en", "de"]);
const identifier = z.string().min(1);

export const sourceLocatorSchema = z
  .union([
    z.object({
      kind: z.literal("page"),
      label: identifier,
      page: z.number(),
    }),
    z.object({
      kind: z.literal("slide"),
      label: identifier,
      slide: z.number(),
    }),
    z.object({
      kind: z.literal("sheet"),
      label: identifier,
      sheet: identifier,
      range: z.string().optional(),
    }).transform(({ kind, label, sheet, range }) =>
      range === undefined
        ? { kind, label, sheet }
        : { kind, label, sheet, range },
    ),
    z.object({
      kind: z.literal("image"),
      label: identifier,
      image: z.number(),
    }),
    z.object({
      kind: z.literal("paragraph"),
      label: identifier,
      paragraph: z.number().optional(),
    }).transform(({ kind, label, paragraph }) =>
      paragraph === undefined
        ? { kind, label }
        : { kind, label, paragraph },
    ),
    z.object({
      kind: z.literal("text_range"),
      label: identifier,
      start: z.number(),
      end: z.number(),
    }),
  ]) satisfies z.ZodType<SourceLocator>;

const evidenceReferenceOptions = [
    z.object({ type: z.literal("project_description") }),
    z.object({
      type: z.literal("material"),
      materialId: identifier,
      locator: sourceLocatorSchema,
    }),
    z.object({ type: z.literal("turn"), turnId: identifier }),
    z.object({
      type: z.literal("correction"),
      correctionId: identifier,
    }),
    z.object({
      type: z.literal("analysis_feedback"),
      feedbackId: identifier,
    }),
    z.object({
      type: z.literal("model_inference"),
      description: identifier,
    }),
] as const;
const evidenceReferenceSchema = z.discriminatedUnion(
  "type",
  evidenceReferenceOptions,
) satisfies z.ZodType<EvidenceReference>;

const signalSchema = z.object({
  text: z.string(),
  locator: sourceLocatorSchema,
});
const materialCategory = z.enum([
  "brief",
  "requirements",
  "design/reference",
  "technical",
  "commercial",
  "timeline",
  "other",
]);
const fileAnalysisSchema = z.object({
  id: identifier,
  version: z.number(),
  summary: z.string(),
  summaryLanguage: language,
  summarySources: z.array(sourceLocatorSchema),
  primaryCategory: materialCategory,
  secondaryCategories: z.array(materialCategory),
  confidence: z.number(),
  language: z.enum(["en", "de", "mixed", "unknown"]),
  signals: z.array(signalSchema),
  model: z.string(),
  provider: z.string(),
  processingVersion: z.literal("material-processing-v1"),
  schemaVersion: z.literal("file-analysis-v1"),
  promptVersion: z.literal("software-project-file-analysis-v1"),
  extractionMethod: z.string(),
  analyzedAt: z.number(),
}) satisfies z.ZodType<FileAnalysis>;

export const projectMaterialViewSchema = z
  .object({
    id: identifier,
    roomId: identifier,
    name: z.string(),
    size: z.number(),
    declaredContentType: z.string(),
    actualContentType: z.string().optional(),
    uploaderKind: z.enum(["freelancer", "client"]),
    state: z.enum([
      "accepted",
      "processing",
      "analyzed",
      "unsupported",
      "failed",
    ]),
    stage: z.enum([
      "checking_file",
      "extracting_content",
      "checking_secrets",
      "analyzing",
      "indexing",
      "complete",
    ]),
    active: z.boolean(),
    retryAvailable: z.boolean(),
    includeSuspectedSecrets: z.boolean(),
    suspectedSecrets: z.array(
      z.object({
        kind: z.string(),
        maskedPreview: z.string(),
        locator: sourceLocatorSchema,
      }),
    ),
    extraction: z
      .object({
        language: z.enum(["en", "de", "mixed", "unknown"]),
        method: z.string(),
      })
      .optional(),
    analysis: fileAnalysisSchema.optional(),
    analysisVersions: z.array(fileAnalysisSchema),
    failureCode: z.string().optional(),
    canIncludeSuspectedSecrets: z.boolean(),
    canRemove: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }) satisfies z.ZodType<ProjectMaterialView>;

export const analysisFeedbackSchema = z.object({
  id: identifier,
  roomId: identifier,
  materialId: identifier,
  explanation: z.string(),
  actorKind: z.enum(["freelancer", "client"]),
  deviceId: z.string().optional(),
  locator: sourceLocatorSchema,
  createdAt: z.number(),
}) satisfies z.ZodType<AnalysisFeedback>;

export const contextPackRevisionSchema = z
  .object({
    id: identifier,
    roomId: identifier,
    revision: z.number(),
    reason: z.enum([
      "material_analyzed",
      "analysis_feedback_added",
      "material_removed",
      "continued_without_material",
    ]),
    subjectMaterialId: z.string().optional(),
    globalProjectSummary: z.string(),
    likelyProjectType: z.string().nullable(),
    notableSignals: z.array(signalSchema),
    includedMaterialIds: z.array(identifier),
    materialSummaries: z.array(
      z.object({
        materialId: identifier,
        fileName: z.string(),
        summary: z.string(),
        summaryLanguage: language,
        summarySources: z.array(sourceLocatorSchema),
        analysisId: identifier,
        analysisVersion: z.number(),
        category: materialCategory,
        confidence: z.number(),
        signals: z.array(signalSchema),
        available: z.boolean(),
      }),
    ),
    feedback: z.array(analysisFeedbackSchema),
    minimalContextWarning: z.boolean(),
    createdAt: z.number(),
  }) satisfies z.ZodType<ContextPackRevision>;

const questionSchema = z.object({
  id: identifier,
  text: z.string(),
  coverageAreaId: identifier,
  kind: z.enum(["primary", "follow_up", "final_anything_else"]),
  reason: z.string(),
  askedAt: z.number(),
}) satisfies z.ZodType<InterviewQuestion>;
const interviewStatus = z.enum([
  "planning",
  "active",
  "paused",
  "retryable",
  "awaiting_confirmation",
  "completed",
  "completed_early",
]);

export const discoveryInterviewViewSchema = z
  .object({
    id: identifier,
    roomId: identifier,
    language,
    status: interviewStatus,
    respondingDevice: z.boolean(),
    leaseVersion: z.number().nullable(),
    currentQuestion: questionSchema.optional(),
    operationStatus: z.enum(["idle", "running", "retryable"]),
    answerCount: z.number(),
    plan: z
      .object({
        profileId: z.literal("software-project"),
        profileVersion: z.literal("software-project-v1"),
      })
      .optional(),
    coverage: z.array(
      z.object({
        id: identifier,
        label: z.string(),
        status: z.enum([
          "uncovered",
          "partial",
          "sufficient",
          "not_applicable",
        ]),
      }),
    ),
    turns: z.array(
      z.object({
        id: identifier,
        roomId: identifier,
        interviewId: identifier,
        sequence: z.number(),
        question: questionSchema,
        answer: z.string(),
        answerKind: z.enum(["answer", "skip"]),
        idempotencyKey: z.string(),
        contextPackRevisionId: z.string().nullable(),
        contextPackRevision: z.number().nullable(),
        acceptedAt: z.number(),
      }),
    ),
    corrections: z.array(
      z.object({
        id: identifier,
        roomId: identifier,
        interviewId: identifier,
        turnId: identifier,
        correctedAnswer: z.string(),
        reason: z.string(),
        deviceId: z.string(),
        createdAt: z.number(),
      }),
    ),
    findings: z.array(
      z.object({
        id: identifier,
        roomId: identifier,
        interviewId: identifier,
        type: z.enum([
          "candidate_requirement",
          "assumption",
          "risk",
          "gap",
          "contradiction",
        ]),
        statement: z.string(),
        sources: z.array(evidenceReferenceSchema),
        status: z.enum([
          "active",
          "resolved",
          "explicitly_open",
          "needs_reassessment",
        ]),
        createdAt: z.number(),
      }),
    ),
    events: z.array(
      z.object({
        id: identifier,
        roomId: identifier,
        interviewId: identifier,
        type: z.literal("project_material_added"),
        materialId: identifier,
        contextPackRevisionId: identifier,
        contextPackRevision: z.number(),
        createdAt: z.number(),
        handledAtTurnId: z.string().optional(),
      }),
    ),
    unresolvedTopics: z.array(z.string()),
    completionRationale: z.string().optional(),
    incompleteReason: z.string().optional(),
    reviewerBlockers: z.array(z.string()),
    usageReviewTriggered: z.boolean(),
    operation: z
      .object({
        operationType: z.enum([
          "interview_planning",
          "interview_turn",
          "interview_review",
        ]),
        status: z.enum([
          "pending",
          "running",
          "retryable",
          "succeeded",
          "failed",
          "cancelled",
        ]),
        stage: z.string(),
        attemptCount: z.number(),
        model: z.string().optional(),
        provider: z.string().optional(),
        promptVersion: z.string(),
        schemaVersion: z.string(),
        contextPackRevisionId: z.string().optional(),
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        estimatedCostUsd: z.number().optional(),
        latencyMs: z.number().optional(),
        errorCode: z.string().optional(),
      })
      .optional(),
  }) satisfies z.ZodType<DiscoveryInterviewView>;

const briefSourceSchema = z
  .discriminatedUnion("type", [
    ...evidenceReferenceOptions,
    z.object({
      type: z.literal("freelancer_edit"),
      editId: identifier,
      description: z.string(),
    }),
  ]) satisfies z.ZodType<BriefSource>;
const sectionId = z.enum(BRIEF_SECTION_IDS);
const itemSchema = z.object({
  id: identifier,
  sectionId,
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
  text: z.string(),
  scopeStatus: z.enum(["in_scope", "out_of_scope", "open"]).optional(),
  priority: z.string().nullable(),
  sources: z.array(briefSourceSchema),
  findingId: z.string().optional(),
  authoredBy: z.enum(["generator", "freelancer"]),
  requirementState: z
    .enum(["candidate", "proposed", "agreed", "excluded"])
    .optional(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
const sectionSchema = z.object({
  id: sectionId,
  title: z.string(),
  content: z.string(),
  sources: z.array(briefSourceSchema),
  items: z.array(itemSchema),
});
const warningSchema = z.object({
  id: identifier,
  category: z.enum([
    "feasibility",
    "scope",
    "budget",
    "timeline",
    "responsibility",
    "critical_gap",
    "contradiction",
  ]),
  message: z.string(),
  subjectId: identifier,
  status: z.enum(["unresolved", "resolved", "acknowledged"]),
  note: z.string().optional(),
  updatedAt: z.number(),
});
const draftSchema = z.object({
  id: identifier,
  roomId: identifier,
  revision: z.number(),
  basedOnReviewVersionId: z.string().optional(),
  language,
  status: z.enum(["editing", "sent"]),
  markdown: z.string(),
  sections: z.array(sectionSchema),
  warnings: z.array(warningSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});
const reviewSchema = z.object({
  id: identifier,
  roomId: identifier,
  sourceDraftId: identifier,
  version: z.number(),
  language,
  status: z.enum([
    "awaiting_client",
    "change_requested",
    "approved",
    "invalidated",
  ]),
  markdown: z.string(),
  sections: z.array(sectionSchema),
  sentAt: z.number(),
  approval: z
    .object({
      displayName: z.string(),
      deviceId: z.string(),
      approvedAt: z.number(),
      agreedRequirementIds: z.array(identifier),
    })
    .optional(),
});
const changeRequestSchema = z.object({
  id: identifier,
  roomId: identifier,
  reviewVersionId: identifier,
  status: z.enum(["editing", "acknowledged"]),
  revisions: z.array(
    z.object({
      version: z.number(),
      text: z.string(),
      createdAt: z.number(),
    }),
  ),
  createdAt: z.number(),
  updatedAt: z.number(),
  acknowledgedAt: z.number().optional(),
});
const briefOperationSchema = z.object({
  id: identifier,
  roomId: identifier,
  operationType: z.literal("brief_generation"),
  idempotencyKey: z.string(),
  status: z.enum(["running", "retryable", "succeeded", "cancelled"]),
  stage: z.enum(["generating", "validating", "complete"]),
  attemptCount: z.number(),
  model: z.string().optional(),
  provider: z.string().optional(),
  promptVersion: z.literal("software-project-brief-generator-v1"),
  schemaVersion: z.literal("project-brief-v1"),
  contextPackRevisionId: z.string().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  estimatedCostUsd: z.number().optional(),
  errorCode: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const projectBriefViewSchema = z
  .object({
    draft: draftSchema.nullable(),
    visibleReviewVersion: reviewSchema.nullable(),
    reviewVersions: z.array(reviewSchema),
    changeRequests: z.array(changeRequestSchema),
    activeChangeRequest: changeRequestSchema.nullable(),
    operation: briefOperationSchema.nullable(),
  }) satisfies z.ZodType<ProjectBriefView>;
