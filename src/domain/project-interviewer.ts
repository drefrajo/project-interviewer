import {
  DEFAULT_MATERIAL_LIMITS,
  UnsupportedMaterialError,
  fileExtension,
  supportedMaterialTypes,
  type AnalysisFeedback,
  type ContextPackRevision,
  type FileAnalysisDraft,
  type FileAnalysis,
  type FileAnalyzerInput,
  type MaterialExtraction,
  type MaterialLimits,
  type MaterialSegment,
  type ProjectMaterial,
  type ProjectMaterialState,
  type ProjectMaterialView,
  type SourceLocator,
} from "./project-material";
import {
  cosineSimilarity,
  findSuspectedSecrets,
  fullTextScore,
  publicSuspectedSecrets,
  redactModelText,
  redactSegments,
} from "./material-safety";
import {
  createDiscoveryInterviewCoordinator,
  type DiscoveryInterviewState,
  type InterviewAdapters,
} from "./discovery-interview";

export type Language = "en" | "de";

export type ProjectPhase =
  | "setup"
  | "discovery"
  | "freelancer_review"
  | "client_review"
  | "approved"
  | "archived";

export interface FreelancerActor {
  kind: "freelancer";
  freelancerId: string;
  sessionId: string;
}

export interface ClientActor {
  kind: "client";
  roomId: string;
  deviceId: string;
  inviteVersion: number;
  sessionId: string;
}

export type RoomActor = FreelancerActor | ClientActor;

export interface ProjectRoom {
  id: string;
  freelancerId: string;
  title: string;
  clientLabel: string;
  projectDescription: string;
  briefLanguage: Language;
  discoveryProfileId: "software-project";
  freelancerGuidance: string;
  phase: ProjectPhase;
  interviewReadiness: "waiting_for_material" | "ready";
  createdAt: number;
  updatedAt: number;
  invite: {
    tokenHash: string;
    status: "active" | "revoked";
    version: number;
  };
  client?: {
    displayName: string;
    interviewLanguage: Language;
    acknowledgedAt: number;
  };
}

export type ProjectRoomView = Pick<
  ProjectRoom,
  | "id"
  | "title"
  | "clientLabel"
  | "projectDescription"
  | "briefLanguage"
  | "discoveryProfileId"
  | "phase"
  | "interviewReadiness"
  | "createdAt"
  | "updatedAt"
  | "client"
> & { freelancerDisplayName: string };

export interface AuditEvent {
  id: string;
  roomId: string;
  actorKind: RoomActor["kind"];
  deviceId?: string;
  action: string;
  createdAt: number;
}

export interface DurableOperation {
  id: string;
  roomId: string;
  operationType: "file_processing";
  idempotencyKey: string;
  status:
    | "pending"
    | "running"
    | "retryable"
    | "succeeded"
    | "failed"
    | "cancelled";
  stage: string;
  attemptCount: number;
  model?: string;
  provider?: string;
  promptVersion: string;
  schemaVersion: string;
  contextPackRevisionId?: string;
  errorCode?: string;
  createdAt: number;
  updatedAt: number;
}

interface FreelancerIdentity {
  id: string;
  displayName: string;
  createdAt: number;
}

export interface ProjectInterviewerSnapshot
  extends ProjectMaterialState,
    DiscoveryInterviewState {
  freelancers: FreelancerIdentity[];
  rooms: ProjectRoom[];
  auditEvents: AuditEvent[];
  durableOperations: DurableOperation[];
}

export interface ProjectInterviewerDependencies {
  ids: {
    next(prefix: string): string;
    inviteToken(): string;
    deviceId(): string;
  };
  clock: {
    now(): number;
  };
  inviteTokens: {
    hash(token: string): Promise<string>;
  };
  materialFiles?: {
    inspect(
      reference: string,
      scope: {
        roomId: string;
        uploaderId: string;
        claimedSize: number;
        declaredContentType: string;
      },
    ): Promise<{ size: number; contentType: string }>;
    read(
      reference: string,
      scope: { roomId: string; uploaderId: string },
    ): Promise<Uint8Array>;
    remove(
      reference: string,
      scope: { roomId: string; uploaderId: string },
    ): Promise<void>;
  };
  contentInspector?: {
    detect(input: {
      name: string;
      declaredContentType: string;
      bytes: Uint8Array;
    }): Promise<string>;
  };
  parser?: {
    extract(input: {
      name: string;
      contentType: string;
      bytes: Uint8Array;
    }): Promise<MaterialExtraction>;
  };
  fileAnalyzer?: {
    analyze(input: FileAnalyzerInput): Promise<FileAnalysisDraft>;
  };
  embeddings?: {
    embed(texts: string[]): Promise<number[][]>;
  };
  materialLimits?: Partial<MaterialLimits>;
  materialWorkerLimit?: number;
  materialChunkCharacters?: number;
  interviewPlanner?: InterviewAdapters["planner"];
  interviewAgent?: InterviewAdapters["agent"];
  interviewReviewer?: InterviewAdapters["reviewer"];
  initialState?: ProjectInterviewerSnapshot;
  persist?: (snapshot: ProjectInterviewerSnapshot) => void;
}

export interface CreateProjectRoomInput {
  title: string;
  clientLabel: string;
  projectDescription: string;
  briefLanguage: Language;
  freelancerGuidance: string;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this Project Room.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const copy = <T>(value: T): T => structuredClone(value);

export const createProjectInterviewer = (
  dependencies: ProjectInterviewerDependencies,
) => {
  const initialState = dependencies.initialState;
  const state: ProjectInterviewerSnapshot = copy({
    ...(
      initialState ?? {
      freelancers: [],
      rooms: [],
      auditEvents: [],
      }
    ),
    projectMaterials: initialState?.projectMaterials ?? [],
    materialSegments: initialState?.materialSegments ?? [],
    analysisFeedback: initialState?.analysisFeedback ?? [],
    materialChunks: initialState?.materialChunks ?? [],
    contextPackRevisions: initialState?.contextPackRevisions ?? [],
    durableOperations: initialState?.durableOperations ?? [],
    discoveryInterviews: initialState?.discoveryInterviews ?? [],
    interviewPlans: initialState?.interviewPlans ?? [],
    interviewTurns: initialState?.interviewTurns ?? [],
    interviewCorrections: initialState?.interviewCorrections ?? [],
    discoveryFindings: initialState?.discoveryFindings ?? [],
    interviewEvents: initialState?.interviewEvents ?? [],
    respondingDeviceLeases:
      initialState?.respondingDeviceLeases ?? [],
    interviewOperations: initialState?.interviewOperations ?? [],
  });
  const materialLimits: MaterialLimits = {
    ...DEFAULT_MATERIAL_LIMITS,
    ...dependencies.materialLimits,
  };
  if (initialState) {
    for (const material of state.projectMaterials) {
      material.analysisVersions ??= material.analysis
        ? [copy(material.analysis)]
        : [];
      if (
        material.active &&
        ["accepted", "processing"].includes(material.state)
      ) {
        material.state = "failed";
        material.stage = "complete";
        material.retryAvailable = true;
        material.failureCode = "interrupted_processing";
        material.updatedAt = dependencies.clock.now();
      }
    }
    for (const operation of state.durableOperations) {
      if (["pending", "running"].includes(operation.status)) {
        operation.status = "retryable";
        operation.stage = "complete";
        operation.errorCode = "interrupted_processing";
        operation.updatedAt = dependencies.clock.now();
      }
    }
  }
  const materialProcessingPromises = new Map<
    string,
    Promise<ProjectMaterialView>
  >();
  const materialRemovalLocks = new Set<string>();
  const materialRemovalPromises = new Map<
    string,
    Promise<ContextPackRevision>
  >();
  const materialWorkerLimit = Math.max(
    1,
    Math.floor(dependencies.materialWorkerLimit ?? 3),
  );
  const materialChunkCharacters = Math.max(
    200,
    Math.floor(dependencies.materialChunkCharacters ?? 1_200),
  );
  let activeMaterialWorkers = 0;
  const waitingMaterialWorkers: Array<() => void> = [];
  const acquireMaterialWorker = (): Promise<() => void> =>
    new Promise((resolve) => {
      const start = () => {
        activeMaterialWorkers += 1;
        resolve(() => {
          activeMaterialWorkers -= 1;
          waitingMaterialWorkers.shift()?.();
        });
      };
      if (activeMaterialWorkers < materialWorkerLimit) start();
      else waitingMaterialWorkers.push(start);
    });
  const freelancerSessions = new Map<string, string>();
  const clientSessions = new Map<
    string,
    {
      roomId: string;
      deviceId: string;
      inviteVersion: number;
      tokenHash: string;
    }
  >();

  const persist = () => dependencies.persist?.(copy(state));

  const audit = (
    actor: RoomActor,
    roomId: string,
    action: string,
  ): void => {
    state.auditEvents.push({
      id: dependencies.ids.next("audit"),
      roomId,
      actorKind: actor.kind,
      ...(actor.kind === "client" ? { deviceId: actor.deviceId } : {}),
      action,
      createdAt: dependencies.clock.now(),
    });
  };

  const requireFreelancerRoom = (
    actor: FreelancerActor,
    roomId: string,
  ): ProjectRoom => {
    requireFreelancer(actor);
    const room = state.rooms.find(
      (candidate) =>
        candidate.id === roomId &&
        candidate.freelancerId === actor.freelancerId,
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const requireFreelancer = (actor: FreelancerActor): void => {
    if (
      freelancerSessions.get(actor.sessionId) !== actor.freelancerId ||
      !state.freelancers.some(({ id }) => id === actor.freelancerId)
    ) {
      throw new AuthorizationError();
    }
  };

  const requireRoomActor = (actor: RoomActor, roomId: string): ProjectRoom => {
    if (actor.kind === "freelancer") {
      return requireFreelancerRoom(actor, roomId);
    }
    const session = clientSessions.get(actor.sessionId);
    const room = state.rooms.find(
      (candidate) =>
        candidate.id === roomId &&
        session?.roomId === roomId &&
        session.deviceId === actor.deviceId &&
        session.inviteVersion === actor.inviteVersion &&
        session.tokenHash === candidate.invite.tokenHash &&
        actor.roomId === roomId &&
        candidate.invite.status === "active" &&
        candidate.invite.version === actor.inviteVersion,
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const findRoomByInvite = async (
    token: string,
  ): Promise<ProjectRoom | undefined> => {
    const tokenHash = await dependencies.inviteTokens.hash(token);
    return state.rooms.find(
      (room) =>
        room.invite.status === "active" &&
        room.invite.tokenHash === tokenHash,
    );
  };

  const toProjectRoomView = (room: ProjectRoom): ProjectRoomView => ({
    id: room.id,
    title: room.title,
    clientLabel: room.clientLabel,
    projectDescription: room.projectDescription,
    briefLanguage: room.briefLanguage,
    discoveryProfileId: room.discoveryProfileId,
    phase: room.phase,
    interviewReadiness: room.interviewReadiness,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    freelancerDisplayName:
      state.freelancers.find(({ id }) => id === room.freelancerId)
        ?.displayName ?? "Freelancer",
    ...(room.client ? { client: copy(room.client) } : {}),
  });

  const toProjectMaterialView = (
    material: ProjectMaterial,
    actor: RoomActor,
  ): ProjectMaterialView => {
    const result = copy(material) as Partial<ProjectMaterial>;
    delete result.fileReference;
    delete result.uploaderId;
    return {
      ...(result as Omit<
        ProjectMaterial,
        "fileReference" | "uploaderId"
      >),
      canIncludeSuspectedSecrets: actorOwnsMaterial(actor, material),
      canRemove:
        actor.kind === "freelancer" ||
        actorOwnsMaterial(actor, material),
    };
  };

  const actorOwnsMaterial = (
    actor: RoomActor,
    material: ProjectMaterial,
  ): boolean =>
    (actor.kind === "freelancer" &&
      material.uploaderKind === "freelancer" &&
      material.uploaderId === actor.freelancerId) ||
    (actor.kind === "client" &&
      material.uploaderKind === "client" &&
      material.uploaderId === actor.deviceId);

  const requireMaterial = (
    actor: RoomActor,
    roomId: string,
    materialId: string,
  ): ProjectMaterial => {
    requireRoomActor(actor, roomId);
    const material = state.projectMaterials.find(
      (candidate) =>
        candidate.id === materialId &&
        candidate.roomId === roomId &&
        candidate.active,
    );
    if (!material) throw new ValidationError("Project Material was not found.");
    return material;
  };

  const updateInterviewReadiness = (room: ProjectRoom): void => {
    const active = state.projectMaterials.filter(
      (material) => material.roomId === room.id && material.active,
    );
    room.interviewReadiness =
      active.length > 0 &&
      active.every(({ state: materialState }) =>
        ["analyzed", "unsupported"].includes(materialState),
      )
        ? "ready"
        : "waiting_for_material";
    room.updatedAt = dependencies.clock.now();
  };

  const createContextPackRevision = (
    room: ProjectRoom,
    reason: ContextPackRevision["reason"],
    minimalContextWarning = false,
    subjectMaterialId?: string,
  ): ContextPackRevision => {
    const analyzedMaterials = state.projectMaterials.filter(
      (material) =>
        material.roomId === room.id &&
        material.state === "analyzed" &&
        material.analysis,
    );
    const activeAnalyzed = analyzedMaterials.filter(
      (material) => material.active,
    );
    const previousRevision = state.contextPackRevisions
      .filter(({ roomId }) => roomId === room.id)
      .reduce((highest, revision) => Math.max(highest, revision.revision), 0);
    const revision: ContextPackRevision = {
      id: dependencies.ids.next("context_pack"),
      roomId: room.id,
      revision: previousRevision + 1,
      reason,
      ...(subjectMaterialId ? { subjectMaterialId } : {}),
      globalProjectSummary: buildGlobalProjectSummary(
        room,
        activeAnalyzed,
      ),
      likelyProjectType: activeAnalyzed.length
        ? inferLikelyProjectType(activeAnalyzed)
        : null,
      notableSignals: activeAnalyzed.flatMap(
        (material) => material.analysis?.signals.slice(0, 3) ?? [],
      ),
      includedMaterialIds: activeAnalyzed.map(({ id }) => id),
      materialSummaries: analyzedMaterials.map((material) => ({
        materialId: material.id,
        fileName: material.name,
        summary: material.analysis?.summary ?? "",
        summaryLanguage:
          material.analysis?.summaryLanguage ?? room.briefLanguage,
        summarySources: copy(
          material.analysis?.summarySources ?? [],
        ),
        analysisId: material.analysis?.id ?? "",
        analysisVersion: material.analysis?.version ?? 0,
        category: material.analysis?.primaryCategory ?? "other",
        confidence: material.analysis?.confidence ?? 0,
        signals: copy(material.analysis?.signals ?? []),
        available: material.active,
      })),
      feedback: copy(
        state.analysisFeedback.filter(
          ({ roomId }) => roomId === room.id,
        ),
      ),
      minimalContextWarning,
      createdAt: dependencies.clock.now(),
    };
    state.contextPackRevisions.push(revision);
    return revision;
  };

  const validateMaterialInput = (
    room: ProjectRoom,
    input: {
      name: string;
      size: number;
      declaredContentType: string;
      actualContentType?: string;
    },
  ): void => {
    const extension = fileExtension(input.name);
    const supported = supportedMaterialTypes[extension];
    if (!supported) {
      throw new ValidationError(
        "This Project Material format is not supported.",
      );
    }
    if (
      !supported.contentTypes.includes(input.declaredContentType) ||
      (input.actualContentType &&
        !supported.contentTypes.includes(input.actualContentType))
    ) {
      throw new ValidationError(
        "The file content type does not match its supported extension.",
      );
    }
    if (input.size <= 0 || input.size > materialLimits.maxFileBytes) {
      throw new ValidationError(
        `Each file must be no larger than ${materialLimits.maxFileBytes} bytes.`,
      );
    }
    const active = state.projectMaterials.filter(
      (material) => material.roomId === room.id && material.active,
    );
    if (active.length >= materialLimits.maxFiles) {
      throw new ValidationError(
        `A Project Room supports at most ${materialLimits.maxFiles} files.`,
      );
    }
    const totalBytes = active.reduce(
      (total, material) => total + material.size,
      0,
    );
    if (totalBytes + input.size > materialLimits.maxRoomBytes) {
      throw new ValidationError(
        `Project Material exceeds the ${materialLimits.maxRoomBytes} byte room limit.`,
      );
    }
  };

  const validateMaterialContentType = (
    name: string,
    actualContentType: string,
  ): void => {
    const supported = supportedMaterialTypes[fileExtension(name)];
    if (!supported?.contentTypes.includes(actualContentType)) {
      throw new UnsupportedMaterialError(
        "The stored file signature does not match its extension.",
      );
    }
  };

  const ensureMaterialActive = (material: ProjectMaterial): void => {
    if (!material.active) {
      throw new Error("Project Material was removed during processing.");
    }
  };

  const executeMaterialProcessing = async (
    actor: RoomActor,
    room: ProjectRoom,
    material: ProjectMaterial,
    includeSuspectedSecrets: boolean,
    operation: DurableOperation,
  ): Promise<ProjectMaterialView> => {
    operation.status = "running";
    operation.attemptCount += 1;
    operation.stage = "extracting_content";
    operation.updatedAt = dependencies.clock.now();
    material.state = "processing";
    material.stage = "extracting_content";
    material.updatedAt = dependencies.clock.now();
    persist();

    try {
      if (
        !dependencies.materialFiles ||
        !dependencies.contentInspector ||
        !dependencies.parser ||
        !dependencies.fileAnalyzer ||
        !dependencies.embeddings
      ) {
        throw new Error("Project Material adapters are not configured.");
      }
      const bytes = await dependencies.materialFiles.read(
        material.fileReference,
        {
          roomId: material.roomId,
          uploaderId: material.uploaderId,
        },
      );
      ensureMaterialActive(material);
      const actualContentType = await dependencies.contentInspector.detect({
        name: material.name,
        declaredContentType: material.declaredContentType,
        bytes,
      });
      ensureMaterialActive(material);
      validateMaterialContentType(material.name, actualContentType);
      material.actualContentType = actualContentType;
      const extraction = await dependencies.parser.extract({
        name: material.name,
        contentType:
          material.actualContentType ?? material.declaredContentType,
        bytes,
      });
      ensureMaterialActive(material);
      if (!extraction.segments.length && !material.declaredContentType.startsWith("image/")) {
        throw new Error("No extractable content was found.");
      }
      const isImage =
        material.declaredContentType.startsWith("image/");
      const sourceLocators: SourceLocator[] = isImage
        ? [{ kind: "image", label: "Image 1", image: 1 }]
        : extraction.segments.map(({ locator }) => locator);

      material.stage = "checking_secrets";
      operation.stage = "checking_secrets";
      operation.updatedAt = dependencies.clock.now();
      material.updatedAt = dependencies.clock.now();
      persist();
      const suspectedSecrets = findSuspectedSecrets(extraction.segments);
      const safeSegments = redactSegments(
        extraction.segments,
        suspectedSecrets,
        false,
      );
      const analyzerSegments = redactSegments(
        extraction.segments,
        suspectedSecrets,
        includeSuspectedSecrets,
      );

      material.stage = "analyzing";
      operation.stage = "analyzing";
      operation.updatedAt = dependencies.clock.now();
      material.updatedAt = dependencies.clock.now();
      persist();
      const analyzerInput: FileAnalyzerInput = {
        fileName: material.name,
        declaredContentType: material.declaredContentType,
        outputLanguage: room.briefLanguage,
        redactedText: analyzerSegments
          .map(({ locator, text }) => `[${locator.label}] ${text}`)
          .join("\n"),
        segments: analyzerSegments,
        isImage,
        ...(isImage
          ? {
              image: {
                bytes,
                contentType:
                  material.actualContentType ??
                  material.declaredContentType,
              },
            }
          : {}),
      };
      let draft: FileAnalysisDraft | undefined;
      let validationError = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        draft = await dependencies.fileAnalyzer.analyze({
          ...analyzerInput,
          ...(validationError
            ? { repairErrors: [validationError] }
            : {}),
        });
        ensureMaterialActive(material);
        operation.model = draft.model;
        operation.provider = draft.provider;
        try {
          validateAnalysisDraft(
            draft,
            sourceLocators,
            isImage,
            room.briefLanguage,
          );
          validationError = "";
          break;
        } catch (error) {
          validationError =
            error instanceof Error ? error.message : "Invalid File Analysis";
        }
      }
      if (!draft || validationError) {
        throw new Error(
          `File Analysis schema validation failed: ${validationError}`,
        );
      }
      material.stage = "indexing";
      operation.stage = "indexing";
      operation.updatedAt = dependencies.clock.now();
      material.updatedAt = dependencies.clock.now();
      persist();
      const chunkedSegments = safeSegments.flatMap((segment) =>
        chunkMaterialSegment(segment, materialChunkCharacters),
      );
      const vectors = await dependencies.embeddings.embed(
        chunkedSegments.map(({ text }) => text),
      );
      ensureMaterialActive(material);

      state.materialSegments = state.materialSegments.filter(
        (segment) => segment.materialId !== material.id,
      );
      state.materialChunks = state.materialChunks.filter(
        (chunk) => chunk.materialId !== material.id,
      );
      safeSegments.forEach((segment) => {
        state.materialSegments.push({
          ...copy(segment),
          roomId: room.id,
          materialId: material.id,
          language: extraction.language,
          active: true,
        });
      });
      chunkedSegments.forEach((segment, index) => {
        state.materialChunks.push({
          id: dependencies.ids.next("material_chunk"),
          roomId: room.id,
          materialId: material.id,
          text: segment.text,
          locator: copy(segment.locator),
          language: extraction.language,
          vector: vectors[index] ?? [],
          active: true,
          createdAt: dependencies.clock.now(),
        });
      });

      const safeSignals = draft.signals.map((signal) => ({
        ...copy(signal),
        text: redactModelText(signal.text, suspectedSecrets),
      }));
      material.extraction = {
        language: extraction.language,
        method: extraction.method,
      };
      const summarySources = draft.summarySources?.length
        ? draft.summarySources
        : draft.signals.length
          ? draft.signals
              .map(({ locator }) => locator)
              .slice(0, 3)
          : safeSegments
              .map(({ locator }) => locator)
              .slice(0, 1);
      const analysis: FileAnalysis = {
        ...copy(draft),
        id: dependencies.ids.next("file_analysis"),
        version: material.analysisVersions.length + 1,
        summary: redactModelText(draft.summary, suspectedSecrets),
        summarySources: copy(summarySources),
        signals: safeSignals,
        processingVersion: "material-processing-v1",
        schemaVersion: "file-analysis-v1",
        promptVersion: "software-project-file-analysis-v1",
        extractionMethod: extraction.method,
        analyzedAt: dependencies.clock.now(),
      };
      material.analysis = analysis;
      material.analysisVersions.push(copy(analysis));
      material.suspectedSecrets =
        publicSuspectedSecrets(suspectedSecrets);
      material.includeSuspectedSecrets = includeSuspectedSecrets;
      delete material.failureCode;
      material.retryAvailable = false;
      material.state = "analyzed";
      material.stage = "complete";
      material.updatedAt = dependencies.clock.now();
      updateInterviewReadiness(room);
      const contextPack = createContextPackRevision(
        room,
        "material_analyzed",
        false,
        material.id,
      );
      discoveryCoordinator.recordMaterialAdded({
        roomId: room.id,
        materialId: material.id,
        contextPack,
      });
      operation.status = "succeeded";
      operation.stage = "complete";
      operation.contextPackRevisionId = contextPack.id;
      delete operation.errorCode;
      operation.updatedAt = dependencies.clock.now();
      persist();
      return toProjectMaterialView(material, actor);
    } catch (error) {
      state.materialSegments = state.materialSegments.filter(
        (segment) => segment.materialId !== material.id,
      );
      state.materialChunks = state.materialChunks.filter(
        (chunk) => chunk.materialId !== material.id,
      );
      if (!material.active) {
        operation.status = "cancelled";
        operation.stage = "complete";
        operation.errorCode = "material_removed";
        operation.updatedAt = dependencies.clock.now();
        material.retryAvailable = false;
        material.failureCode = "material_removed";
        material.updatedAt = dependencies.clock.now();
        persist();
        return toProjectMaterialView(material, actor);
      }
      material.state =
        error instanceof UnsupportedMaterialError ? "unsupported" : "failed";
      material.stage = "complete";
      material.failureCode =
        error instanceof UnsupportedMaterialError
          ? "unsupported_content"
          : "extraction_or_analysis_failed";
      material.retryAvailable = material.state === "failed";
      material.updatedAt = dependencies.clock.now();
      operation.status =
        error instanceof UnsupportedMaterialError ? "failed" : "retryable";
      operation.stage = "complete";
      operation.errorCode = material.failureCode;
      operation.updatedAt = dependencies.clock.now();
      updateInterviewReadiness(room);
      persist();
      return toProjectMaterialView(material, actor);
    }
  };

  const processMaterial = (
    actor: RoomActor,
    room: ProjectRoom,
    material: ProjectMaterial,
    includeSuspectedSecrets: boolean,
  ): Promise<ProjectMaterialView> => {
    if (materialRemovalLocks.has(material.id)) {
      return Promise.reject(
        new ValidationError("Project Material removal is in progress."),
      );
    }
    if (
      material.state === "analyzed" &&
      material.includeSuspectedSecrets === includeSuspectedSecrets
    ) {
      return Promise.resolve(toProjectMaterialView(material, actor));
    }
    const idempotencyKey = [
      "file_processing",
      room.id,
      material.id,
      includeSuspectedSecrets ? "include_flagged" : "masked",
    ].join(":");
    const existingPromise =
      materialProcessingPromises.get(idempotencyKey);
    if (existingPromise) return existingPromise;
    const now = dependencies.clock.now();
    const operation =
      state.durableOperations.find(
        (candidate) => candidate.idempotencyKey === idempotencyKey,
      ) ??
      {
        id: dependencies.ids.next("operation"),
        roomId: room.id,
        operationType: "file_processing" as const,
        idempotencyKey,
        status: "pending" as const,
        stage: "checking_file",
        attemptCount: 0,
        promptVersion: "software-project-file-analysis-v1",
        schemaVersion: "file-analysis-v1",
        createdAt: now,
        updatedAt: now,
      };
    if (!state.durableOperations.includes(operation)) {
      state.durableOperations.push(operation);
      persist();
    }
    const promise = (async () => {
      const releaseWorker = await acquireMaterialWorker();
      try {
        return await executeMaterialProcessing(
          actor,
          room,
          material,
          includeSuspectedSecrets,
          operation,
        );
      } finally {
        releaseWorker();
      }
    })();
    materialProcessingPromises.set(idempotencyKey, promise);
    void promise.then(
      () => materialProcessingPromises.delete(idempotencyKey),
      () => materialProcessingPromises.delete(idempotencyKey),
    );
    return promise;
  };

  const searchEvidence = async (
    roomId: string,
    query: string,
    requestedLimit = 5,
  ): Promise<
    Array<{
      materialId: string;
      text: string;
      locator: ProjectMaterialState["materialChunks"][number]["locator"];
      score: number;
    }>
  > => {
    if (!dependencies.embeddings) {
      throw new Error("Embedding adapter is not configured.");
    }
    const [queryVector = []] = await dependencies.embeddings.embed([
      query,
    ]);
    const finiteLimit = Number.isFinite(requestedLimit)
      ? Math.floor(requestedLimit)
      : 5;
    const limit = Math.max(0, Math.min(finiteLimit, 20));
    return state.materialChunks
      .filter((chunk) => chunk.roomId === roomId && chunk.active)
      .map((chunk) => ({
        materialId: chunk.materialId,
        text: chunk.text,
        locator: copy(chunk.locator),
        score:
          fullTextScore(query, chunk.text) * 2 +
          cosineSimilarity(queryVector, chunk.vector),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  };

  const discoveryCoordinator =
    createDiscoveryInterviewCoordinator({
      state,
      ids: dependencies.ids,
      clock: dependencies.clock,
      ...(dependencies.interviewPlanner
        ? { planner: dependencies.interviewPlanner }
        : {}),
      ...(dependencies.interviewAgent
        ? { agent: dependencies.interviewAgent }
        : {}),
      ...(dependencies.interviewReviewer
        ? { reviewer: dependencies.interviewReviewer }
        : {}),
      authorize: (actor, roomId) => {
        const room = requireRoomActor(actor, roomId);
        return {
          id: room.id,
          projectDescription: room.projectDescription,
          freelancerGuidance: room.freelancerGuidance,
          ...(room.client
            ? {
                clientInterviewLanguage:
                  room.client.interviewLanguage,
              }
            : {}),
          phase: room.phase,
        };
      },
      latestContextPack: (roomId) =>
        state.contextPackRevisions
          .filter((revision) => revision.roomId === roomId)
          .sort(
            (left, right) => right.revision - left.revision,
          )[0] ?? null,
      contextPackById: (id) =>
        state.contextPackRevisions.find(
          (revision) => revision.id === id,
        ) ?? null,
      ...(dependencies.embeddings
        ? {
            retrieveEvidence: async (
              roomId: string,
              query: string,
              requestedLimit = 5,
            ) => searchEvidence(roomId, query, requestedLimit),
            inspectEvidence: async (
              roomId: string,
              materialId: string,
              requestedCharacters = 2_000,
            ) => {
              let remaining = Math.max(
                0,
                Math.min(Math.floor(requestedCharacters), 4_000),
              );
              const excerpts: Array<{
                materialId: string;
                text: string;
                locator: ProjectMaterialState["materialChunks"][number]["locator"];
              }> = [];
              for (const chunk of state.materialChunks.filter(
                (candidate) =>
                  candidate.roomId === roomId &&
                  candidate.materialId === materialId &&
                  candidate.active,
              )) {
                if (remaining <= 0) break;
                const text = chunk.text.slice(0, remaining);
                remaining -= text.length;
                excerpts.push({
                  materialId,
                  text,
                  locator: copy(chunk.locator),
                });
              }
              return excerpts;
            },
          }
        : {}),
      materialReady: (roomId) =>
        state.rooms.find(({ id }) => id === roomId)
          ?.interviewReadiness === "ready",
      setRoomPhase: (roomId, phase) => {
        const room = state.rooms.find(({ id }) => id === roomId);
        if (room) {
          room.phase = phase;
          room.updatedAt = dependencies.clock.now();
        }
      },
      persist,
      audit,
    });

  return {
    identities: {
      async createDevelopmentFreelancer(input: {
        displayName: string;
      }): Promise<FreelancerActor> {
        const displayName = input.displayName.trim();
        if (!displayName) {
          throw new ValidationError("A Freelancer display name is required.");
        }
        const identity: FreelancerIdentity = {
          id: dependencies.ids.next("freelancer"),
          displayName,
          createdAt: dependencies.clock.now(),
        };
        state.freelancers.push(identity);
        const sessionId = dependencies.ids.next("freelancer_session");
        freelancerSessions.set(sessionId, identity.id);
        persist();
        return {
          kind: "freelancer",
          freelancerId: identity.id,
          sessionId,
        };
      },

      async resumeDevelopmentFreelancer(
        freelancerId: string,
      ): Promise<FreelancerActor> {
        if (!state.freelancers.some(({ id }) => id === freelancerId)) {
          throw new AuthorizationError();
        }
        const sessionId = dependencies.ids.next("freelancer_session");
        freelancerSessions.set(sessionId, freelancerId);
        return { kind: "freelancer", freelancerId, sessionId };
      },
    },
    rooms: {
      async create(
        actor: FreelancerActor,
        input: CreateProjectRoomInput,
      ): Promise<{ room: ProjectRoom; inviteToken: string }> {
        requireFreelancer(actor);
        const required = [
          input.title,
          input.clientLabel,
          input.projectDescription,
        ];
        if (required.some((value) => !value.trim())) {
          throw new ValidationError(
            "Title, Client label, and Project Description are required.",
          );
        }

        const inviteToken = dependencies.ids.inviteToken();
        const now = dependencies.clock.now();
        const room: ProjectRoom = {
          id: dependencies.ids.next("room"),
          freelancerId: actor.freelancerId,
          title: input.title.trim(),
          clientLabel: input.clientLabel.trim(),
          projectDescription: input.projectDescription.trim(),
          briefLanguage: input.briefLanguage,
          discoveryProfileId: "software-project",
          freelancerGuidance: input.freelancerGuidance.trim(),
          phase: "setup",
          interviewReadiness: "waiting_for_material",
          createdAt: now,
          updatedAt: now,
          invite: {
            tokenHash: await dependencies.inviteTokens.hash(inviteToken),
            status: "active",
            version: 1,
          },
        };
        state.rooms.push(room);
        audit(actor, room.id, "project_room.created");
        persist();
        return { room: copy(room), inviteToken };
      },

      async get(actor: RoomActor, roomId: string): Promise<ProjectRoomView> {
        return toProjectRoomView(requireRoomActor(actor, roomId));
      },

      async list(
        actor: FreelancerActor,
        filters: { search?: string; phase?: ProjectPhase } = {},
      ): Promise<Array<ProjectRoom & { nextAction: string }>> {
        requireFreelancer(actor);
        const search = filters.search?.trim().toLocaleLowerCase() ?? "";
        return state.rooms
          .filter((room) => room.freelancerId === actor.freelancerId)
          .filter((room) => !filters.phase || room.phase === filters.phase)
          .filter(
            (room) =>
              !search ||
              `${room.title} ${room.clientLabel}`
                .toLocaleLowerCase()
                .includes(search),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((room) => ({
            ...copy(room),
            nextAction: nextActionFor(room),
          }));
      },
    },
    clientAccess: {
      async resolveInvite(
        inviteToken: string,
        input: { deviceId?: string },
      ): Promise<{
        actor: ClientActor;
        room: ProjectRoomView;
        onboardingRequired: boolean;
        client?: ProjectRoom["client"];
      }> {
        const room = await findRoomByInvite(inviteToken);
        if (!room) {
          throw new AuthorizationError(
            "This Invite Link is invalid or has been revoked.",
          );
        }
        const actor: ClientActor = {
          kind: "client",
          roomId: room.id,
          deviceId: input.deviceId ?? dependencies.ids.deviceId(),
          inviteVersion: room.invite.version,
          sessionId: dependencies.ids.next("client_session"),
        };
        clientSessions.set(actor.sessionId, {
          roomId: room.id,
          deviceId: actor.deviceId,
          inviteVersion: room.invite.version,
          tokenHash: room.invite.tokenHash,
        });
        return {
          actor,
          room: toProjectRoomView(room),
          onboardingRequired: !room.client,
          ...(room.client ? { client: copy(room.client) } : {}),
        };
      },

      async onboard(
        actor: ClientActor,
        input: {
          displayName: string;
          interviewLanguage: Language;
          acknowledgedDisclosure: boolean;
        },
      ): Promise<ProjectRoomView> {
        const room = requireRoomActor(actor, actor.roomId);
        if (room.client) {
          throw new ValidationError(
            "Client onboarding is already complete for this Project Room.",
          );
        }
        if (!input.displayName.trim() || !input.acknowledgedDisclosure) {
          throw new ValidationError(
            "Display name and the processing acknowledgement are required.",
          );
        }
        room.client = {
          displayName: input.displayName.trim(),
          interviewLanguage: input.interviewLanguage,
          acknowledgedAt: dependencies.clock.now(),
        };
        room.phase = "discovery";
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "client.onboarded");
        persist();
        return toProjectRoomView(room);
      },

      async rotateInvite(
        actor: FreelancerActor,
        roomId: string,
      ): Promise<{ inviteToken: string; inviteVersion: number }> {
        const room = requireFreelancerRoom(actor, roomId);
        const inviteToken = dependencies.ids.inviteToken();
        room.invite = {
          tokenHash: await dependencies.inviteTokens.hash(inviteToken),
          status: "active",
          version: room.invite.version + 1,
        };
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "invite.rotated");
        persist();
        return {
          inviteToken,
          inviteVersion: room.invite.version,
        };
      },

      async revokeInvite(
        actor: FreelancerActor,
        roomId: string,
      ): Promise<void> {
        const room = requireFreelancerRoom(actor, roomId);
        room.invite.status = "revoked";
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "invite.revoked");
        persist();
      },
    },
    materials: {
      async accept(
        actor: RoomActor,
        roomId: string,
        input: {
          name: string;
          size: number;
          declaredContentType: string;
          actualContentType?: string;
          fileReference: string;
          uploader: RoomActor["kind"];
        },
      ): Promise<ProjectMaterialView> {
        const room = requireRoomActor(actor, roomId);
        if (input.uploader !== actor.kind) {
          throw new AuthorizationError();
        }
        validateMaterialInput(room, input);
        if (!dependencies.materialFiles) {
          throw new Error("Project Material storage is not configured.");
        }
        const uploaderId =
          actor.kind === "freelancer"
            ? actor.freelancerId
            : actor.deviceId;
        const stored = await dependencies.materialFiles.inspect(
          input.fileReference,
          {
            roomId,
            uploaderId,
            claimedSize: input.size,
            declaredContentType: input.declaredContentType,
          },
        );
        validateMaterialInput(room, {
          ...input,
          size: stored.size,
          ...(stored.contentType
            ? { actualContentType: stored.contentType }
            : {}),
        });
        const now = dependencies.clock.now();
        const material: ProjectMaterial = {
          id: dependencies.ids.next("material"),
          roomId,
          name: input.name.trim(),
          size: stored.size,
          declaredContentType: input.declaredContentType,
          ...(input.actualContentType
            ? { actualContentType: input.actualContentType }
            : {}),
          fileReference: input.fileReference,
          uploaderKind: actor.kind,
          uploaderId,
          state: "accepted",
          stage: "checking_file",
          active: true,
          retryAvailable: false,
          includeSuspectedSecrets: false,
          suspectedSecrets: [],
          analysisVersions: [],
          createdAt: now,
          updatedAt: now,
        };
        state.projectMaterials.push(material);
        room.interviewReadiness = "waiting_for_material";
        room.updatedAt = dependencies.clock.now();
        audit(actor, roomId, "project_material.uploaded");
        persist();
        return toProjectMaterialView(material, actor);
      },

      async process(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ): Promise<ProjectMaterialView> {
        const room = requireRoomActor(actor, roomId);
        const material = requireMaterial(actor, roomId, materialId);
        return processMaterial(
          actor,
          room,
          material,
          material.includeSuspectedSecrets,
        );
      },

      async retry(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ): Promise<ProjectMaterialView> {
        const room = requireRoomActor(actor, roomId);
        const material = requireMaterial(actor, roomId, materialId);
        if (material.state !== "failed") {
          throw new ValidationError(
            "Only failed Project Material can be retried.",
          );
        }
        return processMaterial(
          actor,
          room,
          material,
          material.includeSuspectedSecrets,
        );
      },

      async includeSuspectedSecrets(
        actor: RoomActor,
        roomId: string,
        materialId: string,
        input: { acknowledgedProviderDisclosure: boolean },
      ): Promise<ProjectMaterialView> {
        const room = requireRoomActor(actor, roomId);
        const material = requireMaterial(actor, roomId, materialId);
        if (!input.acknowledgedProviderDisclosure) {
          throw new ValidationError(
            "Provider disclosure acknowledgement is required.",
          );
        }
        if (!material.suspectedSecrets.length) {
          throw new ValidationError(
            "No suspected secrets are available to include.",
          );
        }
        if (!actorOwnsMaterial(actor, material)) {
          throw new AuthorizationError(
            "Only the uploader may include suspected secrets.",
          );
        }
        const idempotencyKey = [
          "file_processing",
          room.id,
          material.id,
          "include_flagged",
        ].join(":");
        const existing =
          materialProcessingPromises.get(idempotencyKey);
        if (existing) return existing;
        audit(actor, roomId, "project_material.secret_override");
        persist();
        return processMaterial(actor, room, material, true);
      },

      async addFeedback(
        actor: RoomActor,
        roomId: string,
        materialId: string,
        input: { explanation: string; locator: SourceLocator },
      ): Promise<AnalysisFeedback> {
        const room = requireRoomActor(actor, roomId);
        const material = requireMaterial(actor, roomId, materialId);
        if (material.state !== "analyzed") {
          throw new ValidationError(
            "Analysis Feedback requires analyzed Project Material.",
          );
        }
        if (!input.explanation.trim()) {
          throw new ValidationError(
            "Analysis Feedback needs a short explanation.",
          );
        }
        const availableLocators = [
          ...(material.analysis?.summarySources ?? []),
          ...(material.analysis?.signals.map(({ locator }) => locator) ??
            []),
        ];
        if (
          !availableLocators.some(
            (locator) =>
              JSON.stringify(locator) ===
              JSON.stringify(input.locator),
          )
        ) {
          throw new ValidationError(
            "Analysis Feedback must reference an analyzed source.",
          );
        }
        const feedback: AnalysisFeedback = {
          id: dependencies.ids.next("analysis_feedback"),
          roomId,
          materialId,
          explanation: input.explanation.trim(),
          actorKind: actor.kind,
          ...(actor.kind === "client" ? { deviceId: actor.deviceId } : {}),
          locator: copy(input.locator),
          createdAt: dependencies.clock.now(),
        };
        state.analysisFeedback.push(feedback);
        createContextPackRevision(
          room,
          "analysis_feedback_added",
          false,
          material.id,
        );
        persist();
        return copy(feedback);
      },

      async list(
        actor: RoomActor,
        roomId: string,
      ): Promise<ProjectMaterialView[]> {
        requireRoomActor(actor, roomId);
        return state.projectMaterials
          .filter(
            (material) => material.roomId === roomId && material.active,
          )
          .sort((left, right) => right.createdAt - left.createdAt)
          .map((material) => toProjectMaterialView(material, actor));
      },

      async remove(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ): Promise<ContextPackRevision> {
        const room = requireRoomActor(actor, roomId);
        const removalKey = `${roomId}:${materialId}`;
        const existingRemoval =
          materialRemovalPromises.get(removalKey);
        if (existingRemoval) return existingRemoval;
        const material = state.projectMaterials.find(
          (candidate) =>
            candidate.id === materialId &&
            candidate.roomId === roomId,
        );
        if (!material) {
          throw new ValidationError("Project Material was not found.");
        }
        if (!material.active) {
          const priorRevision = state.contextPackRevisions
            .filter(
              (revision) =>
                revision.roomId === roomId &&
                revision.reason === "material_removed" &&
                revision.subjectMaterialId === materialId,
            )
            .sort((left, right) => right.revision - left.revision)[0];
          if (!priorRevision) {
            throw new ValidationError(
              "Project Material is already unavailable.",
            );
          }
          return copy(priorRevision);
        }
        const actorOwnsUpload = actorOwnsMaterial(actor, material);
        if (!actorOwnsUpload && actor.kind !== "freelancer") {
          throw new AuthorizationError(
            "Only the uploader or Freelancer may remove this Project Material.",
          );
        }
        const removal = (async (): Promise<ContextPackRevision> => {
          materialRemovalLocks.add(materialId);
          try {
            const inFlight = [
              ...materialProcessingPromises.entries(),
            ]
              .filter(([key]) => key.includes(`:${materialId}:`))
              .map(([, promise]) => promise);
            await Promise.all(inFlight);
            await dependencies.materialFiles?.remove(
              material.fileReference,
              {
                roomId: material.roomId,
                uploaderId: material.uploaderId,
              },
            );
            material.active = false;
            material.updatedAt = dependencies.clock.now();
            for (const segment of state.materialSegments) {
              if (segment.materialId === materialId) {
                segment.active = false;
              }
            }
            for (const chunk of state.materialChunks) {
              if (chunk.materialId === materialId) {
                chunk.active = false;
              }
            }
            updateInterviewReadiness(room);
            const revision = createContextPackRevision(
              room,
              "material_removed",
              false,
              material.id,
            );
            audit(actor, roomId, "project_material.removed");
            persist();
            return copy(revision);
          } finally {
            materialRemovalLocks.delete(materialId);
          }
        })();
        materialRemovalPromises.set(removalKey, removal);
        void removal.then(
          () => materialRemovalPromises.delete(removalKey),
          () => materialRemovalPromises.delete(removalKey),
        );
        return removal;
      },

      async continueWithoutFiles(
        actor: RoomActor,
        roomId: string,
      ): Promise<ContextPackRevision> {
        const room = requireRoomActor(actor, roomId);
        if (
          state.projectMaterials.some(
            (material) =>
              material.roomId === roomId &&
              material.active &&
              ["accepted", "processing"].includes(material.state),
          )
        ) {
          throw new ValidationError(
            "Wait for current Project Material processing to finish.",
          );
        }
        room.interviewReadiness = "ready";
        room.updatedAt = dependencies.clock.now();
        const hasGuidance = Boolean(room.freelancerGuidance.trim());
        const activeAnalyzed = state.projectMaterials.some(
          (material) =>
            material.roomId === roomId &&
            material.active &&
            material.state === "analyzed",
        );
        const revision = createContextPackRevision(
          room,
          "continued_without_material",
          !hasGuidance && !activeAnalyzed,
        );
        persist();
        return copy(revision);
      },
    },
    contextPacks: {
      async latest(
        actor: RoomActor,
        roomId: string,
      ): Promise<ContextPackRevision | null> {
        requireRoomActor(actor, roomId);
        const revisions = state.contextPackRevisions
          .filter((revision) => revision.roomId === roomId)
          .sort((left, right) => right.revision - left.revision);
        return revisions[0] ? copy(revisions[0]) : null;
      },
    },
    retrieval: {
      async search(
        actor: RoomActor,
        roomId: string,
        input: { query: string; limit?: number },
      ): Promise<
        Array<{
          materialId: string;
          text: string;
          locator: ProjectMaterialState["materialChunks"][number]["locator"];
          score: number;
        }>
      > {
        requireRoomActor(actor, roomId);
        return searchEvidence(
          roomId,
          input.query,
          input.limit ?? 5,
        );
      },
    },
    interviews: discoveryCoordinator,
    inspectState: (): ProjectInterviewerSnapshot => copy(state),
  };
};

const nextActionFor = (room: ProjectRoom): string => {
  const actions: Record<ProjectPhase, string> = {
    setup: "Share Invite Link",
    discovery: "Continue discovery",
    freelancer_review: "Review Brief Draft",
    client_review: "Wait for Client review",
    approved: "Open Project Home",
    archived: "Restore Project Room",
  };
  return actions[room.phase];
};

const chunkMaterialSegment = (
  segment: MaterialSegment,
  maxCharacters: number,
): MaterialSegment[] => {
  const chunks: MaterialSegment[] = [];
  let remaining = segment.text.trim();
  while (remaining.length > maxCharacters) {
    const candidate = remaining.slice(0, maxCharacters);
    const lastWhitespace = candidate.search(/\s+\S*$/u);
    const splitAt =
      lastWhitespace >= Math.floor(maxCharacters * 0.6)
        ? lastWhitespace
        : maxCharacters;
    chunks.push({
      text: remaining.slice(0, splitAt).trim(),
      locator: copy(segment.locator),
    });
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) {
    chunks.push({
      text: remaining,
      locator: copy(segment.locator),
    });
  }
  return chunks;
};

const inferLikelyProjectType = (
  materials: ProjectMaterial[],
): string | null => {
  const evidence = materials
    .flatMap((material) => [
      material.analysis?.summary ?? "",
      ...(material.analysis?.signals.map(({ text }) => text) ?? []),
    ])
    .join(" ")
    .toLocaleLowerCase();
  if (/\b(?:website|webseite|homepage)\b/u.test(evidence)) {
    return "website";
  }
  if (/\b(?:saas|web app|webapp|portal)\b/u.test(evidence)) {
    return "web application";
  }
  if (/\b(?:mobile app|ios|android|mobil-app)\b/u.test(evidence)) {
    return "mobile application";
  }
  if (/\b(?:integration|schnittstelle|api integration)\b/u.test(evidence)) {
    return "integration";
  }
  return null;
};

const buildGlobalProjectSummary = (
  room: ProjectRoom,
  materials: ProjectMaterial[],
): string => {
  const analyzedSummaries = materials
    .map((material) => material.analysis?.summary.trim() ?? "")
    .filter(Boolean);
  if (analyzedSummaries.length) {
    return room.briefLanguage === "de"
      ? `Zusammenfassung der Projektbelege: ${analyzedSummaries.join(" ")}`
      : `Project evidence summary: ${analyzedSummaries.join(" ")}`;
  }
  const descriptionLooksGerman =
    /\b(?:der|die|das|und|für|mit|soll|projekt)\b/iu.test(
      room.projectDescription,
    );
  const descriptionLooksEnglish =
    /\b(?:the|and|for|with|should|project)\b/iu.test(
      room.projectDescription,
    );
  const languageMismatch =
    (room.briefLanguage === "en" &&
      descriptionLooksGerman &&
      !descriptionLooksEnglish) ||
    (room.briefLanguage === "de" &&
      descriptionLooksEnglish &&
      !descriptionLooksGerman);
  if (languageMismatch) {
    return room.briefLanguage === "de"
      ? "Die Projektbeschreibung liegt in einer anderen Sprache vor und bleibt als Ausgangsbeleg verfügbar."
      : "The Project Description is in another language and remains available as source evidence.";
  }
  return room.briefLanguage === "de"
    ? `Projektbeschreibung: ${room.projectDescription}`
    : `Project Description: ${room.projectDescription}`;
};

const validateAnalysisDraft = (
  draft: FileAnalysisDraft,
  sourceLocators: SourceLocator[],
  isImage: boolean,
  outputLanguage: Language,
): void => {
  const allowedCategories = new Set([
    "brief",
    "requirements",
    "design/reference",
    "technical",
    "commercial",
    "timeline",
    "other",
  ]);
  if (
    !draft.summary.trim() ||
    draft.summary.length > 600 ||
    draft.summaryLanguage !== outputLanguage ||
    (detectProseLanguage(draft.summary) !== "unknown" &&
      detectProseLanguage(draft.summary) !== outputLanguage) ||
    (isImage && !draft.summarySources?.length) ||
    (draft.summarySources?.length ?? 0) > 5 ||
    !allowedCategories.has(draft.primaryCategory) ||
    draft.secondaryCategories.some(
      (category) => !allowedCategories.has(category),
    ) ||
    draft.secondaryCategories.length > 3 ||
    !Number.isFinite(draft.confidence) ||
    draft.confidence < 0 ||
    draft.confidence > 1 ||
    draft.signals.length > 8 ||
    draft.signals.some(
      (signal) =>
        !signal.text.trim() ||
        signal.text.length > 400 ||
        !signal.locator.label.trim(),
    ) ||
    [...(draft.summarySources ?? []), ...draft.signals.map(({ locator }) => locator)]
      .some(
        (locator) =>
          !sourceLocators.some(
            (source) =>
              JSON.stringify(source) === JSON.stringify(locator),
          ),
      )
  ) {
    throw new ValidationError("File Analysis did not match its schema.");
  }
};

const detectProseLanguage = (
  text: string,
): Language | "unknown" => {
  const german =
    text.match(
      /\b(?:der|die|das|und|für|mit|ist|soll|quelle|projekt)\b/giu,
    )?.length ?? 0;
  const english =
    text.match(
      /\b(?:the|and|for|with|is|should|source|project)\b/giu,
    )?.length ?? 0;
  if (german === english) return "unknown";
  return german > english ? "de" : "en";
};

export type ProjectInterviewer = ReturnType<typeof createProjectInterviewer>;
