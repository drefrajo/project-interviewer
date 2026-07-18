import type {
  DiscoveryFinding,
  EvidenceReference,
  InterviewCorrection,
  InterviewPlan,
  InterviewTurn,
  ModelUsage,
} from "./discovery-interview";
import {
  sourceLocatorKey,
  type ContextPackRevision,
  type SourceLocator,
} from "./project-material";
import type {
  Language,
  ProjectPhase,
  RoomActor,
} from "./project-interviewer";
import {
  replaceProjectBriefMarkdown,
  serializeProjectBriefMarkdown,
} from "./project-brief-markdown";
import {
  BRIEF_SECTION_IDS,
  type BriefSectionId,
} from "./project-brief-sections";

export { BRIEF_SECTION_IDS } from "./project-brief-sections";
export type { BriefSectionId } from "./project-brief-sections";
export type BriefItemKind =
  | "requirement"
  | "target"
  | "parameter"
  | "assumption"
  | "risk"
  | "gap"
  | "contradiction"
  | "decision";
export type ScopeStatus = "in_scope" | "out_of_scope" | "open";
export type RequirementState =
  | "candidate"
  | "proposed"
  | "agreed"
  | "excluded";

export type BriefSource =
  | EvidenceReference
  | {
      type: "project_description";
    }
  | {
      type: "freelancer_edit";
      editId: string;
      description: string;
    };

export interface BriefItemDraft {
  kind: BriefItemKind;
  text: string;
  scopeStatus?: ScopeStatus | undefined;
  priority?: string | null;
  sources: BriefSource[];
  findingId?: string | undefined;
}

export interface BriefSectionDraft {
  id: BriefSectionId;
  title: string;
  content: string;
  sources: BriefSource[];
  items: BriefItemDraft[];
}

export interface BriefGeneratorDraft {
  sections: BriefSectionDraft[];
  model: string;
  provider: string;
  usage?: ModelUsage;
}

export interface BriefGeneratorInput {
  language: Language;
  projectDescription: string;
  contextPack: ContextPackRevision | null;
  plan: InterviewPlan;
  findings: DiscoveryFinding[];
  turns: InterviewTurn[];
  corrections: InterviewCorrection[];
  searchEvidence(
    query: string,
    limit?: number,
  ): Promise<
    Array<{
      materialId: string;
      text: string;
      locator: SourceLocator;
      score: number;
    }>
  >;
  inspectEvidence(
    materialId: string,
    maxCharacters?: number,
  ): Promise<
    Array<{
      materialId: string;
      text: string;
      locator: SourceLocator;
    }>
  >;
  repairErrors?: string[];
}

export interface ProjectBriefAdapters {
  generator?: {
    generate(input: BriefGeneratorInput): Promise<BriefGeneratorDraft>;
  };
}

export interface BriefItem {
  id: string;
  sectionId: BriefSectionId;
  kind: BriefItemKind;
  text: string;
  scopeStatus?: ScopeStatus | undefined;
  priority: string | null;
  sources: BriefSource[];
  findingId?: string | undefined;
  authoredBy: "generator" | "freelancer";
  requirementState?: RequirementState | undefined;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface BriefSection {
  id: BriefSectionId;
  title: string;
  content: string;
  sources: BriefSource[];
  items: BriefItem[];
}

export type BriefWarningCategory =
  | "feasibility"
  | "scope"
  | "budget"
  | "timeline"
  | "responsibility"
  | "critical_gap"
  | "contradiction";

export interface BriefWarning {
  id: string;
  category: BriefWarningCategory;
  message: string;
  subjectId: string;
  status: "unresolved" | "resolved" | "acknowledged";
  note?: string | undefined;
  updatedAt: number;
}

export interface BriefDraft {
  id: string;
  roomId: string;
  revision: number;
  basedOnReviewVersionId?: string | undefined;
  language: Language;
  status: "editing" | "sent";
  /** The source document. Older persisted drafts are projected on read. */
  markdown: string;
  sections: BriefSection[];
  warnings: BriefWarning[];
  createdAt: number;
  updatedAt: number;
}

export interface BriefApproval {
  displayName: string;
  deviceId: string;
  approvedAt: number;
  agreedRequirementIds: string[];
}

export interface ReviewVersion {
  id: string;
  roomId: string;
  sourceDraftId: string;
  version: number;
  language: Language;
  status:
    | "awaiting_client"
    | "change_requested"
    | "approved"
    | "invalidated";
  /** Immutable Markdown sent to the Client. */
  markdown: string;
  sections: BriefSection[];
  sentAt: number;
  approval?: BriefApproval | undefined;
}

export interface ChangeRequestRevision {
  version: number;
  text: string;
  createdAt: number;
}

export interface BriefChangeRequest {
  id: string;
  roomId: string;
  reviewVersionId: string;
  status: "editing" | "acknowledged";
  revisions: ChangeRequestRevision[];
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number | undefined;
}

export interface BriefOperation {
  id: string;
  roomId: string;
  operationType: "brief_generation";
  idempotencyKey: string;
  status: "running" | "retryable" | "succeeded" | "cancelled";
  stage: "generating" | "validating" | "complete";
  attemptCount: number;
  model?: string | undefined;
  provider?: string | undefined;
  promptVersion: "software-project-brief-generator-v1";
  schemaVersion: "project-brief-v1";
  contextPackRevisionId?: string | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  estimatedCostUsd?: number | undefined;
  errorCode?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectBriefState {
  briefDrafts: BriefDraft[];
  reviewVersions: ReviewVersion[];
  briefChangeRequests: BriefChangeRequest[];
  briefOperations: BriefOperation[];
}

export interface ProjectBriefView {
  draft: BriefDraft | null;
  visibleReviewVersion: ReviewVersion | null;
  reviewVersions: ReviewVersion[];
  changeRequests: BriefChangeRequest[];
  activeChangeRequest: BriefChangeRequest | null;
  operation: BriefOperation | null;
}

export interface BriefEvidenceDetail {
  label: string;
  text: string;
  locator?: string;
  reason?: string;
  sequence?: number;
  unavailable?: boolean;
}

export class ProjectBriefStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectBriefStateError";
  }
}

interface BriefRoomContext {
  id: string;
  projectDescription: string;
  briefLanguage: Language;
  phase: ProjectPhase;
  client?: { displayName: string };
}

interface DiscoverySnapshot {
  contextPack: ContextPackRevision | null;
  plan: InterviewPlan;
  findings: DiscoveryFinding[];
  turns: InterviewTurn[];
  corrections: InterviewCorrection[];
  interviewStatus: string;
}

interface CoordinatorDependencies {
  state: ProjectBriefState;
  ids: { next(prefix: string): string };
  clock: { now(): number };
  generator?: ProjectBriefAdapters["generator"];
  authorize(actor: RoomActor, roomId: string): BriefRoomContext;
  discovery(roomId: string): DiscoverySnapshot;
  searchEvidence?(
    roomId: string,
    query: string,
    limit?: number,
  ): ReturnType<BriefGeneratorInput["searchEvidence"]>;
  inspectEvidence?(
    roomId: string,
    materialId: string,
    maxCharacters?: number,
  ): ReturnType<BriefGeneratorInput["inspectEvidence"]>;
  validateMaterialSource(
    roomId: string,
    materialId: string,
    locator: SourceLocator,
  ): boolean;
  sourceDetail(
    roomId: string,
    source: BriefSource,
  ): BriefEvidenceDetail | null;
  setRoomPhase(roomId: string, phase: ProjectPhase): void;
  touchRoom(roomId: string): void;
  synchronize(): void;
  persist(): void;
  audit(actor: RoomActor, roomId: string, action: string): void;
}

const copy = <T>(value: T): T => structuredClone(value);

const generationWasCancelled = (
  operation: BriefOperation,
  expectedAttempt: number,
): boolean =>
  operation.status === "cancelled" ||
  operation.attemptCount !== expectedAttempt;

const activeDraft = (
  state: ProjectBriefState,
  roomId: string,
): BriefDraft | undefined =>
  state.briefDrafts
    .filter(
      (draft) =>
        draft.roomId === roomId && draft.status === "editing",
    )
    .sort((left, right) => right.revision - left.revision)[0];

const latestReview = (
  state: ProjectBriefState,
  roomId: string,
): ReviewVersion | undefined =>
  state.reviewVersions
    .filter(
      (version) =>
        version.roomId === roomId &&
        version.status !== "invalidated",
    )
    .sort((left, right) => right.version - left.version)[0];

const operationFor = (
  state: ProjectBriefState,
  roomId: string,
): BriefOperation | undefined =>
  state.briefOperations
    .filter((operation) => operation.roomId === roomId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];

const documentFor = (
  artifact: Pick<BriefDraft, "language" | "sections"> & {
    markdown?: string;
  },
): string =>
  artifact.markdown?.trim() || serializeProjectBriefMarkdown(artifact);

const draftWithDocument = (draft: BriefDraft): BriefDraft => ({
  ...draft,
  markdown: documentFor(draft),
});

const reviewWithDocument = (review: ReviewVersion): ReviewVersion => ({
  ...review,
  markdown: documentFor(review),
});

const toView = (
  state: ProjectBriefState,
  actor: RoomActor,
  roomId: string,
): ProjectBriefView => {
  const review = latestReview(state, roomId);
  const changeRequest = review
    ? state.briefChangeRequests.find(
        (request) =>
          request.reviewVersionId === review.id &&
          request.status === "editing",
      )
    : undefined;
  return copy({
    draft:
      actor.kind === "freelancer"
        ? activeDraft(state, roomId)
          ? draftWithDocument(activeDraft(state, roomId)!)
          : null
        : null,
    visibleReviewVersion: review ? reviewWithDocument(review) : null,
    reviewVersions: state.reviewVersions
      .filter(
        (version) =>
          version.roomId === roomId &&
          (actor.kind === "freelancer" ||
            version.status !== "invalidated"),
      )
      .sort((left, right) => right.version - left.version)
      .map(reviewWithDocument),
    changeRequests: state.briefChangeRequests
      .filter(
        (request) =>
          request.roomId === roomId &&
          (actor.kind === "freelancer" ||
            state.reviewVersions.some(
              (review) =>
                review.id === request.reviewVersionId &&
                review.status !== "invalidated",
            )),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt),
    activeChangeRequest: changeRequest ?? null,
    operation: operationFor(state, roomId) ?? null,
  });
};

export const briefSourceKey = (source: BriefSource): string => {
  switch (source.type) {
    case "turn":
      return `turn:${source.turnId}`;
    case "correction":
      return `correction:${source.correctionId}`;
    case "material":
      return `material:${source.materialId}:${sourceLocatorKey(source.locator)}`;
    case "analysis_feedback":
      return `feedback:${source.feedbackId}`;
    case "model_inference":
      return `inference:${source.description}`;
    case "freelancer_edit":
      return `edit:${source.editId}`;
    case "project_description":
      return "project-description";
  }
};

const unsupportedContent = (content: string): boolean =>
  ["not established", "nicht festgestellt"].includes(
    content.trim().toLocaleLowerCase(),
  );

const nonSubstantiveContent = (content: string): boolean =>
  unsupportedContent(content) ||
  [
    "see the source-linked items below.",
    "siehe die quellengestützten punkte unten.",
    "detailed sources are listed here on export.",
    "detaillierte quellen werden beim export hier aufgeführt.",
  ].includes(content.trim().toLocaleLowerCase());

const validateGeneratorDraft = (
  draft: BriefGeneratorDraft,
  discovery: DiscoverySnapshot,
  validateMaterialSource: (
    materialId: string,
    locator: SourceLocator,
  ) => boolean,
): string => {
  if (
    draft.sections.length !== BRIEF_SECTION_IDS.length ||
    draft.sections.some(
      (section, index) =>
        section.id !== BRIEF_SECTION_IDS[index] ||
        !section.title.trim() ||
        !section.content.trim() ||
        section.content.length > 8_000 ||
        section.items.length > 80,
    )
  ) {
    return "Project Brief does not contain the required default structure.";
  }
  const turnIds = new Set(discovery.turns.map(({ id }) => id));
  const correctionIds = new Set(
    discovery.corrections.map(({ id }) => id),
  );
  const findingIds = new Set(discovery.findings.map(({ id }) => id));
  const materialIds = new Set(
    discovery.contextPack?.includedMaterialIds ?? [],
  );
  const feedbackIds = new Set(
    discovery.contextPack?.feedback.map(({ id }) => id) ?? [],
  );
  const authorized = (source: BriefSource): boolean => {
    switch (source.type) {
      case "project_description":
        return true;
      case "turn":
        return turnIds.has(source.turnId);
      case "correction":
        return correctionIds.has(source.correctionId);
      case "material":
        return (
          materialIds.has(source.materialId) &&
          Boolean(source.locator.label.trim()) &&
          validateMaterialSource(
            source.materialId,
            source.locator,
          )
        );
      case "analysis_feedback":
        return feedbackIds.has(source.feedbackId);
      case "model_inference":
        return Boolean(source.description.trim());
      case "freelancer_edit":
        return false;
    }
  };
  for (const section of draft.sections) {
    if (
      section.sources.some((source) => !authorized(source)) ||
      (!nonSubstantiveContent(section.content) &&
        section.sources.length === 0)
    ) {
      return "Project Brief section contains unauthorized evidence.";
    }
    for (const item of section.items) {
      const linkedFinding = item.findingId
        ? discovery.findings.find(
            ({ id }) => id === item.findingId,
          )
        : undefined;
      if (
        !item.text.trim() ||
        item.text.length > 2_000 ||
        ![
          "requirement",
          "target",
          "parameter",
          "assumption",
          "risk",
          "gap",
          "contradiction",
          "decision",
        ].includes(item.kind) ||
        item.sources.length === 0 ||
        item.sources.some((source) => !authorized(source)) ||
        (item.findingId && !findingIds.has(item.findingId)) ||
        (item.kind === "requirement" && !item.scopeStatus)
      ) {
        return "Project Brief item is invalid or untraceable.";
      }
      if (
        item.kind === "requirement" &&
        (!linkedFinding ||
          linkedFinding.type !== "candidate_requirement" ||
          linkedFinding.status === "resolved" ||
          !linkedFinding.sources.every((findingSource) =>
            item.sources.some(
              (itemSource) =>
                briefSourceKey(itemSource) ===
                briefSourceKey(findingSource),
            ),
          ))
      ) {
        return "Generated requirements must map to a source-linked Candidate Requirement.";
      }
      if (
        item.sources.some(
          (source) => source.type === "model_inference",
        ) &&
        !["assumption", "risk", "gap"].includes(item.kind)
      ) {
        return "Generated commitments and parameters require direct evidence, not model inference.";
      }
    }
  }
  return "";
};

const warningCategories = (
  text: string,
  fallback?: BriefWarningCategory,
): BriefWarningCategory[] => {
  const normalized = text.toLocaleLowerCase();
  const categories = new Set<BriefWarningCategory>();
  if (/budget|cost|price|€|\$|kosten|preis/.test(normalized)) {
    categories.add("budget");
  }
  if (
    /deadline|timeline|date|launch|frist|termin|zeitplan/.test(
      normalized,
    )
  ) {
    categories.add("timeline");
  }
  if (
    /responsib|owner|owns|decides|zuständig|verantwort|accountab/.test(
      normalized,
    )
  ) {
    categories.add("responsibility");
  }
  if (fallback) categories.add(fallback);
  return [...categories];
};

const warningCategory = (
  finding: DiscoveryFinding,
): BriefWarningCategory => {
  if (finding.type === "contradiction") return "contradiction";
  if (finding.type === "gap") return "critical_gap";
  return "feasibility";
};

const refreshWarnings = (
  draft: BriefDraft,
  findings: DiscoveryFinding[],
  now: number,
): void => {
  const previous = new Map(
    draft.warnings.map((warning) => [warning.id, warning]),
  );
  const next: BriefWarning[] = [];
  const addWarning = (
    category: BriefWarningCategory,
    subjectId: string,
    message: string,
  ) => {
    const id = `warning:${category}:${subjectId}`;
    const prior = previous.get(id);
    next.push(
      prior && prior.message === message
        ? prior
        : {
            id,
            category,
            message,
            subjectId,
            status: "unresolved",
            updatedAt: now,
          },
    );
  };
  const allItems = draft.sections.flatMap(({ items }) => items);
  const canonicalFindingIds = new Set(
    findings
      .filter(
        ({ type, status }) =>
          ["risk", "gap", "contradiction"].includes(type) &&
          ["active", "explicitly_open"].includes(status),
      )
      .map(({ id }) => id),
  );
  for (const item of allItems) {
    if (
      item.kind === "requirement" &&
      item.scopeStatus === "open"
    ) {
      addWarning(
        "scope",
        item.id,
        `Scope remains open: ${item.text}`,
      );
    }
    if (
      item.findingId &&
      canonicalFindingIds.has(item.findingId)
    ) {
      continue;
    }
    const fallback =
      item.kind === "target" || item.kind === "risk"
        ? "feasibility"
        : item.kind === "gap"
          ? "critical_gap"
          : item.kind === "contradiction"
            ? "contradiction"
            : undefined;
    for (const category of warningCategories(item.text, fallback)) {
      addWarning(
        category,
        item.id,
        `Explicit review required: ${item.text}`,
      );
    }
  }
  for (const finding of findings.filter(
    ({ type, status }) =>
      ["risk", "gap", "contradiction"].includes(type) &&
      ["active", "explicitly_open"].includes(status),
  )) {
    const fallback = warningCategory(finding);
    for (const category of warningCategories(
      finding.statement,
      fallback,
    )) {
      addWarning(category, finding.id, finding.statement);
    }
  }
  draft.warnings = next;
};

const sectionFor = (
  draft: BriefDraft,
  sectionId: BriefSectionId,
): BriefSection => {
  const section = draft.sections.find(({ id }) => id === sectionId);
  if (!section) {
    throw new ProjectBriefStateError(
      "The Project Brief section was not found.",
    );
  }
  return section;
};

function requireFreelancer(
  actor: RoomActor,
): asserts actor is Extract<RoomActor, { kind: "freelancer" }> {
  if (actor.kind !== "freelancer") {
    throw new ProjectBriefStateError(
      "Only the Freelancer can edit the Project Brief.",
    );
  }
}

const editableDraft = (
  dependencies: CoordinatorDependencies,
  actor: RoomActor,
  roomId: string,
): {
  draft: BriefDraft;
  discovery: DiscoverySnapshot;
} => {
  requireFreelancer(actor);
  const room = dependencies.authorize(actor, roomId);
  if (room.phase !== "freelancer_review") {
    throw new ProjectBriefStateError(
      room.phase === "archived"
        ? "Archived Project Rooms are read-only."
        : "The Project Brief is not editable in this room phase.",
    );
  }
  const draft = activeDraft(dependencies.state, roomId);
  if (!draft) {
    throw new ProjectBriefStateError(
      "No private editable Brief Draft is available.",
    );
  }
  return { draft, discovery: dependencies.discovery(roomId) };
};

const mutableRoom = (
  dependencies: CoordinatorDependencies,
  actor: RoomActor,
  roomId: string,
): BriefRoomContext => {
  const room = dependencies.authorize(actor, roomId);
  if (room.phase === "archived") {
    throw new ProjectBriefStateError(
      "Archived Project Rooms are read-only.",
    );
  }
  return room;
};

const cloneSectionsForState = (
  sections: BriefSection[],
  requirementState: "candidate" | "proposed" | "agreed",
  now: number,
): BriefSection[] =>
  copy(sections).map((section) => ({
    ...section,
    items: section.items.map((item, order) => ({
      ...item,
      sectionId: section.id,
      order,
      ...(item.kind === "requirement"
        ? { requirementState }
        : {}),
      updatedAt: now,
    })),
  }));

export const createProjectBriefCoordinator = (
  dependencies: CoordinatorDependencies,
) => {
  const generationPromises = new Map<
    string,
    Promise<ProjectBriefView>
  >();
  const persistRoom = (roomId: string): void => {
    dependencies.touchRoom(roomId);
    dependencies.persist();
  };

  const executeGeneration = async (
    actor: Extract<RoomActor, { kind: "freelancer" }>,
    room: BriefRoomContext,
    operation: BriefOperation,
  ): Promise<ProjectBriefView> => {
    operation.status = "running";
    operation.stage = "generating";
    operation.attemptCount += 1;
    const operationAttempt = operation.attemptCount;
    operation.updatedAt = dependencies.clock.now();
    persistRoom(room.id);
    try {
      const discovery = dependencies.discovery(room.id);
      if (
        !["completed", "completed_early"].includes(
          discovery.interviewStatus,
        )
      ) {
        throw new ProjectBriefStateError(
          "Discovery must be completed before generating a Project Brief.",
        );
      }
      if (!dependencies.generator) {
        throw new ProjectBriefStateError(
          "The Brief Generator is not configured.",
        );
      }
      let generated: BriefGeneratorDraft | undefined;
      let validationError = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        generated = await dependencies.generator.generate({
          language: room.briefLanguage,
          projectDescription: room.projectDescription,
          contextPack: copy(discovery.contextPack),
          plan: copy(discovery.plan),
          findings: copy(discovery.findings),
          turns: copy(discovery.turns),
          corrections: copy(discovery.corrections),
          searchEvidence: async (query, limit = 5) =>
            dependencies.searchEvidence?.(
              room.id,
              query,
              limit,
            ) ?? [],
          inspectEvidence: async (
            materialId,
            maxCharacters = 2_000,
          ) =>
            dependencies.inspectEvidence?.(
              room.id,
              materialId,
              maxCharacters,
            ) ?? [],
          ...(validationError
            ? { repairErrors: [validationError] }
            : {}),
        });
        dependencies.synchronize();
        const currentOperation =
          dependencies.state.briefOperations.find(
            ({ id }) => id === operation.id,
          );
        if (
          !currentOperation ||
          generationWasCancelled(operation, operationAttempt)
        ) {
          throw new ProjectBriefStateError(
            "Project Brief generation was cancelled.",
          );
        }
        operation.model = generated.model;
        operation.provider = generated.provider;
        operation.stage = "validating";
        operation.updatedAt = dependencies.clock.now();
        validationError = validateGeneratorDraft(
          generated,
          discovery,
          (materialId, locator) =>
            dependencies.validateMaterialSource(
              room.id,
              materialId,
              locator,
            ),
        );
        if (!validationError) break;
      }
      if (!generated || validationError) {
        throw new ProjectBriefStateError(
          `Project Brief validation failed: ${validationError}`,
        );
      }
      const now = dependencies.clock.now();
      const revision =
        dependencies.state.briefDrafts
          .filter(({ roomId }) => roomId === room.id)
          .reduce(
            (highest, draft) => Math.max(highest, draft.revision),
            0,
          ) + 1;
      const draft: BriefDraft = {
        id: dependencies.ids.next("brief_draft"),
        roomId: room.id,
        revision,
        language: room.briefLanguage,
        status: "editing",
        markdown: "",
        sections: generated.sections.map((section) => ({
          id: section.id,
          title: section.title.trim(),
          content: section.content.trim(),
          sources: copy(section.sources),
          items: section.items.map((item, order) => ({
            id: dependencies.ids.next("brief_item"),
            sectionId: section.id,
            kind: item.kind,
            text: item.text.trim(),
            ...(item.scopeStatus
              ? { scopeStatus: item.scopeStatus }
              : {}),
            priority: item.priority?.trim() || null,
            sources: copy(item.sources),
            ...(item.findingId
              ? { findingId: item.findingId }
              : {}),
            authoredBy: "generator",
            ...(item.kind === "requirement"
              ? { requirementState: "candidate" as const }
              : {}),
            order,
            createdAt: now,
            updatedAt: now,
          })),
        })),
        warnings: [],
        createdAt: now,
        updatedAt: now,
      };
      draft.markdown = serializeProjectBriefMarkdown(draft);
      refreshWarnings(draft, discovery.findings, now);
      dependencies.state.briefDrafts.push(draft);
      operation.status = "succeeded";
      operation.stage = "complete";
      if (generated.usage?.inputTokens !== undefined) {
        operation.inputTokens = generated.usage.inputTokens;
      }
      if (generated.usage?.outputTokens !== undefined) {
        operation.outputTokens = generated.usage.outputTokens;
      }
      if (generated.usage?.estimatedCostUsd !== undefined) {
        operation.estimatedCostUsd =
          generated.usage.estimatedCostUsd;
      }
      operation.updatedAt = dependencies.clock.now();
      delete operation.errorCode;
      dependencies.audit(actor, room.id, "project_brief.generated");
      persistRoom(room.id);
      return toView(dependencies.state, actor, room.id);
    } catch (error) {
      dependencies.synchronize();
      const currentOperation =
        dependencies.state.briefOperations.find(
          ({ id }) => id === operation.id,
        );
      if (
        !currentOperation ||
        generationWasCancelled(operation, operationAttempt)
      ) {
        dependencies.persist();
        throw error;
      }
      operation.status = "retryable";
      operation.stage = "complete";
      operation.errorCode = "brief_generation_failed";
      operation.updatedAt = dependencies.clock.now();
      persistRoom(room.id);
      throw error;
    }
  };

  return {
    async get(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      dependencies.authorize(actor, roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async generate(
      actor: RoomActor,
      roomId: string,
      input: { idempotencyKey: string },
    ): Promise<ProjectBriefView> {
      requireFreelancer(actor);
      const room = mutableRoom(dependencies, actor, roomId);
      const inFlight = generationPromises.get(roomId);
      if (inFlight) return inFlight;
      const existing = dependencies.state.briefOperations.find(
        (operation) =>
          operation.roomId === roomId &&
          operation.idempotencyKey === input.idempotencyKey,
      );
      if (existing?.status === "succeeded") {
        return toView(dependencies.state, actor, roomId);
      }
      if (room.phase !== "freelancer_review") {
        throw new ProjectBriefStateError(
          "Project Brief generation is only available during Freelancer review.",
        );
      }
      const unresolvedReview = latestReview(
        dependencies.state,
        roomId,
      );
      if (
        unresolvedReview &&
        ["awaiting_client", "change_requested"].includes(
          unresolvedReview.status,
        ) &&
        !activeDraft(dependencies.state, roomId)
      ) {
        throw new ProjectBriefStateError(
          "Resolve the current Client review before generating another Project Brief.",
        );
      }
      if (activeDraft(dependencies.state, roomId) && !existing) {
        return toView(dependencies.state, actor, roomId);
      }
      const operation: BriefOperation =
        existing ?? {
          id: dependencies.ids.next("brief_operation"),
          roomId,
          operationType: "brief_generation",
          idempotencyKey: input.idempotencyKey,
          status: "running",
          stage: "generating",
          attemptCount: 0,
          promptVersion: "software-project-brief-generator-v1",
          schemaVersion: "project-brief-v1",
          ...(dependencies.discovery(roomId).contextPack?.id
            ? {
                contextPackRevisionId:
                  dependencies.discovery(roomId).contextPack!.id,
              }
            : {}),
          createdAt: dependencies.clock.now(),
          updatedAt: dependencies.clock.now(),
        };
      if (!existing) {
        dependencies.state.briefOperations.push(operation);
        persistRoom(roomId);
      }
      const promise = executeGeneration(actor, room, operation).finally(
        () => generationPromises.delete(roomId),
      );
      generationPromises.set(roomId, promise);
      return promise;
    },

    async retryGeneration(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      requireFreelancer(actor);
      const room = mutableRoom(dependencies, actor, roomId);
      if (room.phase !== "freelancer_review") {
        throw new ProjectBriefStateError(
          "Project Brief generation is only retryable during Freelancer review.",
        );
      }
      const inFlight = generationPromises.get(roomId);
      if (inFlight) return inFlight;
      const operation = operationFor(dependencies.state, roomId);
      if (!operation || operation.status !== "retryable") {
        throw new ProjectBriefStateError(
          "Project Brief generation is not retryable.",
        );
      }
      const promise = executeGeneration(actor, room, operation).finally(
        () => generationPromises.delete(roomId),
      );
      generationPromises.set(roomId, promise);
      return promise;
    },

    async updateSection(
      actor: RoomActor,
      roomId: string,
      input: {
        sectionId: BriefSectionId;
        content: string;
        retainSourceKeys?: string[];
      },
    ): Promise<ProjectBriefView> {
      const { draft } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      if (!input.content.trim()) {
        throw new ProjectBriefStateError(
          "Project Brief section content is required.",
        );
      }
      const section = sectionFor(draft, input.sectionId);
      const retained = new Set(input.retainSourceKeys ?? []);
      const sourceCount = section.sources.length;
      if (input.retainSourceKeys) {
        section.sources = section.sources.filter((source) =>
          retained.has(briefSourceKey(source)),
        );
      }
      const changed =
        section.content !== input.content.trim() ||
        sourceCount !== section.sources.length;
      section.content = input.content.trim();
      if (changed) {
        const editId = dependencies.ids.next("brief_edit");
        section.sources.push({
          type: "freelancer_edit",
          editId,
          description: `Freelancer edited ${section.title}.`,
        });
      }
      draft.updatedAt = dependencies.clock.now();
      draft.markdown = serializeProjectBriefMarkdown(draft);
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async updateMarkdown(
      actor: RoomActor,
      roomId: string,
      input: { markdown: string },
    ): Promise<ProjectBriefView> {
      const { draft, discovery } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      const now = dependencies.clock.now();
      const replacement = replaceProjectBriefMarkdown(draft, input.markdown, {
        nextId: dependencies.ids.next,
        now,
      });
      draft.sections = replacement.sections;
      draft.markdown = replacement.markdown;
      refreshWarnings(draft, discovery.findings, now);
      draft.updatedAt = now;
      dependencies.audit(actor, roomId, "project_brief.markdown_updated");
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async addItem(
      actor: RoomActor,
      roomId: string,
      input: {
        sectionId: BriefSectionId;
        kind: BriefItemKind;
        text: string;
        scopeStatus?: ScopeStatus;
        priority?: string | null;
      },
    ): Promise<ProjectBriefView> {
      const { draft, discovery } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      if (!input.text.trim()) {
        throw new ProjectBriefStateError("Brief item text is required.");
      }
      if (input.kind === "requirement" && !input.scopeStatus) {
        throw new ProjectBriefStateError(
          "A requirement needs an explicit scope status.",
        );
      }
      const section = sectionFor(draft, input.sectionId);
      const now = dependencies.clock.now();
      const editId = dependencies.ids.next("brief_edit");
      section.items.push({
        id: dependencies.ids.next("brief_item"),
        sectionId: section.id,
        kind: input.kind,
        text: input.text.trim(),
        ...(input.scopeStatus
          ? { scopeStatus: input.scopeStatus }
          : {}),
        priority: input.priority?.trim() || null,
        sources: [
          {
            type: "freelancer_edit",
            editId,
            description: "Freelancer-authored Brief item.",
          },
        ],
        authoredBy: "freelancer",
        ...(input.kind === "requirement"
          ? { requirementState: "candidate" }
          : {}),
        order: section.items.length,
        createdAt: now,
        updatedAt: now,
      });
      refreshWarnings(draft, discovery.findings, now);
      draft.updatedAt = now;
      draft.markdown = serializeProjectBriefMarkdown(draft);
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async updateItem(
      actor: RoomActor,
      roomId: string,
      input: {
        itemId: string;
        sectionId: BriefSectionId;
        kind: BriefItemKind;
        text: string;
        scopeStatus?: ScopeStatus;
        priority?: string | null;
        retainSourceKeys?: string[];
      },
    ): Promise<ProjectBriefView> {
      const { draft, discovery } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      const currentSection = draft.sections.find(({ items }) =>
        items.some(({ id }) => id === input.itemId),
      );
      const item = currentSection?.items.find(
        ({ id }) => id === input.itemId,
      );
      if (!currentSection || !item || !input.text.trim()) {
        throw new ProjectBriefStateError(
          "The Project Brief item was not found.",
        );
      }
      if (input.kind === "requirement" && !input.scopeStatus) {
        throw new ProjectBriefStateError(
          "A requirement needs an explicit scope status.",
        );
      }
      const retained = new Set(input.retainSourceKeys ?? []);
      const sourceCount = item.sources.length;
      if (input.retainSourceKeys) {
        item.sources = item.sources.filter((source) =>
          retained.has(briefSourceKey(source)),
        );
      }
      const normalizedPriority = input.priority?.trim() || null;
      if (
        item.text !== input.text.trim() ||
        item.kind !== input.kind ||
        item.sectionId !== input.sectionId ||
        item.scopeStatus !== input.scopeStatus ||
        item.priority !== normalizedPriority ||
        sourceCount !== item.sources.length
      ) {
        item.sources.push({
          type: "freelancer_edit",
          editId: dependencies.ids.next("brief_edit"),
          description: "Freelancer edited a generated Brief item.",
        });
      }
      item.text = input.text.trim();
      item.kind = input.kind;
      if (input.scopeStatus) item.scopeStatus = input.scopeStatus;
      else delete item.scopeStatus;
      item.priority = normalizedPriority;
      if (input.kind === "requirement") {
        item.requirementState = "candidate";
      } else {
        delete item.requirementState;
      }
      item.updatedAt = dependencies.clock.now();
      if (currentSection.id !== input.sectionId) {
        currentSection.items = currentSection.items.filter(
          ({ id }) => id !== item.id,
        );
        const target = sectionFor(draft, input.sectionId);
        item.sectionId = target.id;
        item.order = target.items.length;
        target.items.push(item);
      }
      for (const section of draft.sections) {
        section.items.forEach((candidate, order) => {
          candidate.order = order;
        });
      }
      refreshWarnings(
        draft,
        discovery.findings,
        dependencies.clock.now(),
      );
      draft.updatedAt = dependencies.clock.now();
      draft.markdown = serializeProjectBriefMarkdown(draft);
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async moveItem(
      actor: RoomActor,
      roomId: string,
      input: { itemId: string; direction: "up" | "down" },
    ): Promise<ProjectBriefView> {
      const { draft } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      const section = draft.sections.find(({ items }) =>
        items.some(({ id }) => id === input.itemId),
      );
      const index =
        section?.items.findIndex(({ id }) => id === input.itemId) ??
        -1;
      if (!section || index < 0) {
        throw new ProjectBriefStateError(
          "The Project Brief item was not found.",
        );
      }
      const target = input.direction === "up" ? index - 1 : index + 1;
      if (target >= 0 && target < section.items.length) {
        const [item] = section.items.splice(index, 1);
        section.items.splice(target, 0, item!);
        section.items.forEach((candidate, order) => {
          candidate.order = order;
        });
      }
      draft.updatedAt = dependencies.clock.now();
      draft.markdown = serializeProjectBriefMarkdown(draft);
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async removeItem(
      actor: RoomActor,
      roomId: string,
      input: { itemId: string },
    ): Promise<ProjectBriefView> {
      const { draft, discovery } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      for (const section of draft.sections) {
        section.items = section.items.filter(
          ({ id }) => id !== input.itemId,
        );
        section.items.forEach((candidate, order) => {
          candidate.order = order;
        });
      }
      refreshWarnings(
        draft,
        discovery.findings,
        dependencies.clock.now(),
      );
      draft.updatedAt = dependencies.clock.now();
      draft.markdown = serializeProjectBriefMarkdown(draft);
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async resolveWarning(
      actor: RoomActor,
      roomId: string,
      input: {
        warningId: string;
        resolution: "resolved" | "acknowledged";
        note: string;
      },
    ): Promise<ProjectBriefView> {
      const { draft } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      const warning = draft.warnings.find(
        ({ id }) => id === input.warningId,
      );
      if (!warning || !input.note.trim()) {
        throw new ProjectBriefStateError(
          "A warning and resolution note are required.",
        );
      }
      warning.status = input.resolution;
      warning.note = input.note.trim();
      warning.updatedAt = dependencies.clock.now();
      draft.updatedAt = warning.updatedAt;
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async sendForReview(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      const { draft, discovery } = editableDraft(
        dependencies,
        actor,
        roomId,
      );
      refreshWarnings(
        draft,
        discovery.findings,
        dependencies.clock.now(),
      );
      if (
        draft.warnings.some(({ status }) => status === "unresolved")
      ) {
        throw new ProjectBriefStateError(
          "Resolve or acknowledge every Project Brief warning before sending.",
        );
      }
      const now = dependencies.clock.now();
      const version =
        dependencies.state.reviewVersions
          .filter(({ roomId: candidate }) => candidate === roomId)
          .reduce(
            (highest, candidate) =>
              Math.max(highest, candidate.version),
            0,
          ) + 1;
      const review: ReviewVersion = {
        id: dependencies.ids.next("review_version"),
        roomId,
        sourceDraftId: draft.id,
        version,
        language: draft.language,
        status: "awaiting_client",
        markdown: documentFor(draft),
        sections: cloneSectionsForState(
          draft.sections,
          "proposed",
          now,
        ),
        sentAt: now,
      };
      dependencies.state.reviewVersions.push(review);
      draft.status = "sent";
      draft.updatedAt = now;
      dependencies.setRoomPhase(roomId, "client_review");
      dependencies.audit(actor, roomId, "project_brief.sent");
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async submitChangeRequest(
      actor: RoomActor,
      roomId: string,
      input: { text: string },
    ): Promise<ProjectBriefView> {
      const room = mutableRoom(dependencies, actor, roomId);
      if (actor.kind !== "client" || !input.text.trim()) {
        throw new ProjectBriefStateError(
          "Only the Client can submit a Change Request.",
        );
      }
      const review = latestReview(dependencies.state, roomId);
      if (!review || review.status === "approved") {
        throw new ProjectBriefStateError(
          "No Review Version is available for a Change Request.",
        );
      }
      const prior = dependencies.state.briefChangeRequests.find(
        ({ reviewVersionId }) => reviewVersionId === review.id,
      );
      if (prior?.status === "acknowledged") {
        throw new ProjectBriefStateError(
          "A new Review Version is required before another Change Request.",
        );
      }
      const now = dependencies.clock.now();
      const request: BriefChangeRequest =
        prior ?? {
          id: dependencies.ids.next("change_request"),
          roomId,
          reviewVersionId: review.id,
          status: "editing",
          revisions: [],
          createdAt: now,
          updatedAt: now,
        };
      request.revisions.push({
        version: request.revisions.length + 1,
        text: input.text.trim(),
        createdAt: now,
      });
      request.updatedAt = now;
      review.status = "change_requested";
      if (!prior) {
        dependencies.state.briefChangeRequests.push(request);
      }
      dependencies.audit(actor, room.id, "change_request.saved");
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async acknowledgeChangeRequest(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      requireFreelancer(actor);
      mutableRoom(dependencies, actor, roomId);
      const review = latestReview(dependencies.state, roomId);
      const request = review
        ? dependencies.state.briefChangeRequests.find(
            (candidate) =>
              candidate.reviewVersionId === review.id &&
              candidate.status === "editing",
          )
        : undefined;
      if (!review || !request) {
        throw new ProjectBriefStateError(
          "No editable Change Request is available.",
        );
      }
      const now = dependencies.clock.now();
      request.status = "acknowledged";
      request.acknowledgedAt = now;
      request.updatedAt = now;
      const revision =
        dependencies.state.briefDrafts
          .filter(({ roomId: candidate }) => candidate === roomId)
          .reduce(
            (highest, candidate) =>
              Math.max(highest, candidate.revision),
            0,
          ) + 1;
      const draft: BriefDraft = {
        id: dependencies.ids.next("brief_draft"),
        roomId,
        revision,
        basedOnReviewVersionId: review.id,
        language: review.language,
        status: "editing",
        markdown: documentFor(review),
        sections: cloneSectionsForState(
          review.sections,
          "candidate",
          now,
        ),
        warnings: [],
        createdAt: now,
        updatedAt: now,
      };
      draft.markdown = serializeProjectBriefMarkdown(draft);
      refreshWarnings(
        draft,
        dependencies.discovery(roomId).findings,
        now,
      );
      dependencies.state.briefDrafts.push(draft);
      dependencies.setRoomPhase(roomId, "freelancer_review");
      dependencies.audit(
        actor,
        roomId,
        "change_request.acknowledged",
      );
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async approve(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      const room = mutableRoom(dependencies, actor, roomId);
      if (actor.kind !== "client") {
        throw new ProjectBriefStateError(
          "Only the Client can approve a Review Version.",
        );
      }
      const review = latestReview(dependencies.state, roomId);
      if (!review || review.status !== "awaiting_client") {
        throw new ProjectBriefStateError(
          "The latest Review Version is not available for approval.",
        );
      }
      if (
        dependencies.state.briefChangeRequests.some(
          ({ reviewVersionId }) => reviewVersionId === review.id,
        )
      ) {
        throw new ProjectBriefStateError(
          "A Review Version with a Change Request cannot be approved.",
        );
      }
      const now = dependencies.clock.now();
      review.status = "approved";
      review.approval = {
        displayName: room.client?.displayName ?? "Client",
        deviceId: actor.deviceId,
        approvedAt: now,
        agreedRequirementIds: review.sections
          .flatMap(({ items }) => items)
          .filter(
            (item) =>
              item.kind === "requirement" &&
              item.requirementState === "proposed",
          )
          .map(({ id }) => id),
      };
      dependencies.setRoomPhase(roomId, "approved");
      dependencies.audit(actor, roomId, "project_brief.approved");
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async reopen(
      actor: RoomActor,
      roomId: string,
    ): Promise<ProjectBriefView> {
      requireFreelancer(actor);
      mutableRoom(dependencies, actor, roomId);
      const review = latestReview(dependencies.state, roomId);
      if (!review || review.status !== "approved") {
        throw new ProjectBriefStateError(
          "Only an approved Project Brief can be reopened.",
        );
      }
      const now = dependencies.clock.now();
      const revision =
        dependencies.state.briefDrafts
          .filter(({ roomId: candidate }) => candidate === roomId)
          .reduce(
            (highest, candidate) =>
              Math.max(highest, candidate.revision),
            0,
          ) + 1;
      const draft: BriefDraft = {
        id: dependencies.ids.next("brief_draft"),
        roomId,
        revision,
        basedOnReviewVersionId: review.id,
        language: review.language,
        status: "editing",
        markdown: documentFor(review),
        sections: cloneSectionsForState(
          review.sections,
          "candidate",
          now,
        ),
        warnings: [],
        createdAt: now,
        updatedAt: now,
      };
      draft.markdown = serializeProjectBriefMarkdown(draft);
      refreshWarnings(
        draft,
        dependencies.discovery(roomId).findings,
        now,
      );
      dependencies.state.briefDrafts.push(draft);
      dependencies.setRoomPhase(roomId, "freelancer_review");
      dependencies.audit(actor, roomId, "project_brief.reopened");
      persistRoom(roomId);
      return toView(dependencies.state, actor, roomId);
    },

    async exportMarkdown(
      actor: RoomActor,
      roomId: string,
      input: { artifactId: string },
    ): Promise<string> {
      dependencies.authorize(actor, roomId);
      const draft =
        actor.kind === "freelancer"
          ? dependencies.state.briefDrafts.find(
              (candidate) =>
                candidate.roomId === roomId &&
                candidate.id === input.artifactId,
            )
          : undefined;
      const review = dependencies.state.reviewVersions.find(
        (candidate) =>
          candidate.roomId === roomId &&
          candidate.id === input.artifactId,
      );
      const artifact = review ?? draft;
      if (!artifact) {
        throw new ProjectBriefStateError(
          "No Project Brief is available for export.",
        );
      }
      const sources = new Map<string, BriefSource>();
      for (const section of artifact.sections) {
        for (const source of section.sources) {
          sources.set(briefSourceKey(source), source);
        }
        for (const item of section.items) {
          for (const source of item.sources) {
            sources.set(briefSourceKey(source), source);
          }
        }
      }
      const sourceNumbers = new Map(
        [...sources.keys()].map((key, index) => [key, index + 1]),
      );
      const citation = (sourceList: BriefSource[]): string => {
        const numbers = sourceList
          .map((source) => sourceNumbers.get(briefSourceKey(source)))
          .filter((value): value is number => value !== undefined);
        return numbers.length
          ? ` [${numbers.map((number) => `E${number}`).join(", ")}]`
          : "";
      };
      const lines: string[] = [];
      for (const section of artifact.sections) {
        lines.push(
          `## ${section.title}`,
          "",
          `${section.content}${citation(section.sources)}`,
          "",
        );
        for (const item of section.items) {
          lines.push(`- ${item.text}${citation(item.sources)}`);
        }
        if (section.items.length) lines.push("");
      }
      lines.push(
        artifact.language === "de"
          ? "## Quellenanhang"
          : "## Evidence appendix",
        "",
      );
      let index = 0;
      for (const source of sources.values()) {
        index += 1;
        const detail = dependencies.sourceDetail(roomId, source);
        const german = artifact.language === "de";
        const label =
          source.type === "material"
            ? detail?.label ?? source.locator.label
            : source.type === "project_description"
              ? german
                ? "Projektbeschreibung"
                : "Project Description"
              : source.type === "turn"
                ? `${german ? "Interview-Antwort" : "Interview Turn"}${detail?.sequence ? ` ${detail.sequence}` : ""}`
                : source.type === "correction"
                  ? german
                    ? "Interview-Korrektur"
                    : "Interview Correction"
                  : source.type === "analysis_feedback"
                    ? german
                      ? "Analysefeedback"
                      : "Analysis Feedback"
                    : source.type === "model_inference"
                      ? german
                        ? "Schlussfolgerung"
                        : "Inference"
                      : german
                        ? "Freelancer-Bearbeitung"
                        : "Freelancer edit";
        const locator = detail?.locator ? ` · ${detail.locator}` : "";
        const detailText =
          detail?.unavailable
            ? german
              ? "Der zitierte Quellenauszug ist nicht verfügbar."
              : "The cited source excerpt is unavailable."
            : source.type === "freelancer_edit"
              ? german
                ? "Vom Freelancer bearbeiteter Inhalt."
                : "Content edited by the Freelancer."
              : detail?.text;
        const reason = detail?.reason
          ? ` ${german ? "Begründung" : "Reason"}: ${detail.reason}`
          : "";
        const excerpt = `${detailText ?? ""}${reason}`
          .replaceAll(/\s+/g, " ")
          .trim()
          .slice(0, 800);
        lines.push(
          `${index}. ${label}${locator}${excerpt ? ` — ${excerpt}` : ""}`,
        );
      }
      return lines.join("\n").trim();
    },

    async inspectSource(
      actor: RoomActor,
      roomId: string,
      source: BriefSource,
    ): Promise<BriefEvidenceDetail> {
      dependencies.authorize(actor, roomId);
      const artifacts =
        actor.kind === "freelancer"
          ? [
              ...dependencies.state.briefDrafts.filter(
                (draft) => draft.roomId === roomId,
              ),
              ...dependencies.state.reviewVersions.filter(
                (review) => review.roomId === roomId,
              ),
            ]
          : dependencies.state.reviewVersions.filter(
              (review) => review.roomId === roomId,
            );
      const requestedKey = briefSourceKey(source);
      const referenced = artifacts.some(({ sections }) =>
        sections.some(
          (section) =>
            section.sources.some(
              (candidate) =>
                briefSourceKey(candidate) === requestedKey,
            ) ||
            section.items.some(({ sources }) =>
              sources.some(
                (candidate) =>
                  briefSourceKey(candidate) === requestedKey,
              ),
            ),
        ),
      );
      const detail = referenced
        ? dependencies.sourceDetail(roomId, source)
        : null;
      if (!detail) {
        throw new ProjectBriefStateError(
          "The Project Brief source is unavailable.",
        );
      }
      return copy(detail);
    },
  };
};

export type ProjectBriefCoordinator = ReturnType<
  typeof createProjectBriefCoordinator
>;
