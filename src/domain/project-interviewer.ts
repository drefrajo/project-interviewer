import {
  DEFAULT_MATERIAL_LIMITS,
  sourceLocatorKey,
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
import { normalizeSafeSharedResource } from "./shared-resource-safety";
import {
  createDiscoveryInterviewCoordinator,
  type DiscoveryInterviewState,
  type InterviewAdapters,
} from "./discovery-interview";
import {
  createProjectBriefCoordinator,
  type ProjectBriefAdapters,
  type ProjectBriefState,
} from "./project-brief";

export type Language = "en" | "de";

export type ProjectPhase =
  | "setup"
  | "discovery"
  | "freelancer_review"
  | "client_review"
  | "approved"
  | "archived";

export type ProjectNextAction =
  | "share_invite"
  | "continue_discovery"
  | "review_brief_draft"
  | "review_project_brief"
  | "wait_for_client_review"
  | "use_project_home"
  | "restore_project_room"
  | "view_archived_project_home";

export const projectNextActionFor = (
  phase: ProjectPhase,
  actorKind: RoomActor["kind"],
): ProjectNextAction => {
  if (phase === "archived") {
    return actorKind === "client"
      ? "view_archived_project_home"
      : "restore_project_room";
  }
  if (phase === "client_review") {
    return actorKind === "client"
      ? "review_project_brief"
      : "wait_for_client_review";
  }
  const actions: Record<
    Exclude<ProjectPhase, "archived" | "client_review">,
    ProjectNextAction
  > = {
    setup: "share_invite",
    discovery: "continue_discovery",
    freelancer_review: "review_brief_draft",
    approved: "use_project_home",
  };
  return actions[phase];
};

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
  lastActivityAt: number;
  archivedFromPhase?: Exclude<ProjectPhase, "archived">;
  deletedAt?: number;
  purgeAfter?: number;
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
  | "lastActivityAt"
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

export interface SharedResource {
  id: string;
  roomId: string;
  label: string;
  url?: string;
  note?: string;
  accountIdentifier?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface SharedResourceInput {
  label: string;
  url?: string;
  note?: string;
  accountIdentifier?: string;
}

export interface DeletionRecoveryRecord {
  id: string;
  roomId: string;
  deletedAt: number;
  purgeAfter: number;
  status: "recoverable" | "recovered";
  activeMaterialIds: string[];
  recoveredAt?: number;
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
    DiscoveryInterviewState,
    ProjectBriefState {
  freelancers: FreelancerIdentity[];
  rooms: ProjectRoom[];
  sharedResources: SharedResource[];
  deletionRecoveryRecords: DeletionRecoveryRecord[];
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
  briefGenerator?: ProjectBriefAdapters["generator"];
  deletionRecoveryMs?: number;
  initialState?: ProjectInterviewerSnapshot;
  loadLatestState?: () => ProjectInterviewerSnapshot | undefined;
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

const snapshotWithDefaults = (
  initialState?: ProjectInterviewerSnapshot,
): ProjectInterviewerSnapshot =>
  copy({
    ...(initialState ?? {
      freelancers: [],
      rooms: [],
      auditEvents: [],
    }),
    projectMaterials: initialState?.projectMaterials ?? [],
    sharedResources: initialState?.sharedResources ?? [],
    deletionRecoveryRecords:
      initialState?.deletionRecoveryRecords ?? [],
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
    briefDrafts: initialState?.briefDrafts ?? [],
    reviewVersions: initialState?.reviewVersions ?? [],
    briefChangeRequests: initialState?.briefChangeRequests ?? [],
    briefOperations: initialState?.briefOperations ?? [],
  });

export const createProjectInterviewer = (
  dependencies: ProjectInterviewerDependencies,
) => {
  const initialState = dependencies.initialState;
  const state = snapshotWithDefaults(initialState);
  const materialLimits: MaterialLimits = {
    ...DEFAULT_MATERIAL_LIMITS,
    ...dependencies.materialLimits,
  };
  const deletionRecoveryMs = Math.max(
    1,
    Math.floor(
      dependencies.deletionRecoveryMs ??
        7 * 24 * 60 * 60 * 1_000,
    ),
  );
  if (initialState) {
    for (const room of state.rooms) {
      room.lastActivityAt ??= room.updatedAt;
    }
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
    for (const operation of state.briefOperations) {
      if (operation.status === "running") {
        operation.status = "retryable";
        operation.stage = "complete";
        operation.errorCode = "interrupted_generation";
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

  let lastPersistedState = JSON.stringify(state);
  const persist = () => {
    const snapshot = copy(state);
    dependencies.persist?.(snapshot);
    lastPersistedState = JSON.stringify(snapshot);
  };

  const synchronize = (): void => {
    const latest = dependencies.loadLatestState?.();
    if (!latest) return;
    const incoming = snapshotWithDefaults(latest);
    const serializedIncoming = JSON.stringify(incoming);
    if (serializedIncoming === lastPersistedState) return;
    for (const key of Object.keys(state) as Array<
      keyof ProjectInterviewerSnapshot
    >) {
      const currentRecords = state[key] as unknown[];
      const incomingRecords = incoming[key] as unknown[];
      const recordsHaveIds = [...currentRecords, ...incomingRecords].every(
        (record) =>
          typeof record === "object" &&
          record !== null &&
          "id" in record &&
          typeof record.id === "string",
      );
      if (!recordsHaveIds) {
        currentRecords.splice(
          0,
          currentRecords.length,
          ...copy(incomingRecords),
        );
        continue;
      }
      const incomingIds = new Set(
        incomingRecords.map(
          (record) => (record as { id: string }).id,
        ),
      );
      for (let index = currentRecords.length - 1; index >= 0; index -= 1) {
        const record = currentRecords[index] as { id: string };
        if (!incomingIds.has(record.id)) currentRecords.splice(index, 1);
      }
      for (const incomingRecord of incomingRecords as Array<
        { id: string } & Record<string, unknown>
      >) {
        const existing = currentRecords.find(
          (record) =>
            (record as { id: string }).id === incomingRecord.id,
        ) as Record<string, unknown> | undefined;
        if (!existing) {
          currentRecords.push(copy(incomingRecord));
          continue;
        }
        for (const property of Object.keys(existing)) {
          delete existing[property];
        }
        Object.assign(existing, copy(incomingRecord));
      }
    }
    for (const room of state.rooms) {
      room.lastActivityAt ??= room.updatedAt;
    }
    lastPersistedState = serializedIncoming;
  };

  const touchRoom = (roomId: string): void => {
    const room = state.rooms.find(({ id }) => id === roomId);
    if (room) {
      const now = dependencies.clock.now();
      room.lastActivityAt = now;
      room.updatedAt = now;
    }
  };

  const audit = (
    actor: RoomActor,
    roomId: string,
    action: string,
  ): void => {
    const createdAt = dependencies.clock.now();
    state.auditEvents.push({
      id: dependencies.ids.next("audit"),
      roomId,
      actorKind: actor.kind,
      ...(actor.kind === "client" ? { deviceId: actor.deviceId } : {}),
      action,
      createdAt,
    });
    const room = state.rooms.find(({ id }) => id === roomId);
    if (room) {
      room.lastActivityAt = createdAt;
      room.updatedAt = createdAt;
    }
  };

  const requireFreelancerRoom = (
    actor: FreelancerActor,
    roomId: string,
    includeDeleted = false,
  ): ProjectRoom => {
    requireFreelancer(actor);
    const room = state.rooms.find(
      (candidate) =>
        candidate.id === roomId &&
        candidate.freelancerId === actor.freelancerId &&
        (includeDeleted || candidate.deletedAt === undefined),
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const requireFreelancer = (actor: FreelancerActor): void => {
    synchronize();
    if (
      freelancerSessions.get(actor.sessionId) !== actor.freelancerId ||
      !state.freelancers.some(({ id }) => id === actor.freelancerId)
    ) {
      throw new AuthorizationError();
    }
  };

  const requireRoomActor = (actor: RoomActor, roomId: string): ProjectRoom => {
    synchronize();
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
        candidate.invite.version === actor.inviteVersion &&
        candidate.deletedAt === undefined,
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const requireWritableRoomActor = (
    actor: RoomActor,
    roomId: string,
  ): ProjectRoom => {
    const room = requireRoomActor(actor, roomId);
    if (room.phase === "archived") {
      throw new ValidationError(
        "Archived Project Rooms are read-only.",
      );
    }
    return room;
  };

  const requireSharedResourceManager = (
    actor: RoomActor,
    roomId: string,
  ): ProjectRoom => {
    if (actor.kind !== "freelancer") {
      throw new AuthorizationError(
        "Only the Freelancer can manage Shared Resources.",
      );
    }
    return requireFreelancerRoom(actor, roomId);
  };

  const purgeRoomRecords = (roomId: string): void => {
    const collections: Array<Array<{ roomId: string }>> = [
      state.projectMaterials,
      state.materialSegments,
      state.analysisFeedback,
      state.materialChunks,
      state.contextPackRevisions,
      state.durableOperations,
      state.discoveryInterviews,
      state.interviewPlans,
      state.interviewTurns,
      state.interviewCorrections,
      state.discoveryFindings,
      state.interviewEvents,
      state.respondingDeviceLeases,
      state.interviewOperations,
      state.briefDrafts,
      state.reviewVersions,
      state.briefChangeRequests,
      state.briefOperations,
      state.sharedResources,
      state.auditEvents,
      state.deletionRecoveryRecords,
    ];
    for (const collection of collections) {
      for (let index = collection.length - 1; index >= 0; index -= 1) {
        if (collection[index]?.roomId === roomId) {
          collection.splice(index, 1);
        }
      }
    }
  };

  const findRoomByInvite = async (
    token: string,
  ): Promise<ProjectRoom | undefined> => {
    synchronize();
    const tokenHash = await dependencies.inviteTokens.hash(token);
    synchronize();
    return state.rooms.find(
      (room) =>
        room.invite.status === "active" &&
        room.deletedAt === undefined &&
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
    lastActivityAt: room.lastActivityAt,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    freelancerDisplayName:
      state.freelancers.find(({ id }) => id === room.freelancerId)
        ?.displayName ?? "Freelancer",
    ...(room.client ? { client: copy(room.client) } : {}),
  });

  const normalizeSharedResourceInput = (
    input: SharedResourceInput,
  ): Omit<
    SharedResource,
    "id" | "roomId" | "order" | "createdAt" | "updatedAt"
  > => {
    const result = normalizeSafeSharedResource(input);
    if (!result.accepted) throw new ValidationError(result.reason);
    return result.value;
  };

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
    const now = dependencies.clock.now();
    room.updatedAt = now;
    room.lastActivityAt = now;
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

  const ensureMaterialActive = (
    material: ProjectMaterial,
    operation: DurableOperation,
    operationAttempt: number,
  ): void => {
    synchronize();
    if (
      !material.active ||
      materialProcessingWasCancelled(
        operation,
        operationAttempt,
      )
    ) {
      throw new Error("Project Material was removed during processing.");
    }
  };

  const materialProcessingWasCancelled = (
    operation: DurableOperation,
    expectedAttempt: number,
  ): boolean =>
    !state.durableOperations.some(({ id }) => id === operation.id) ||
    operation.status === "cancelled" ||
    operation.attemptCount !== expectedAttempt;

  const executeMaterialProcessing = async (
    actor: RoomActor,
    room: ProjectRoom,
    material: ProjectMaterial,
    includeSuspectedSecrets: boolean,
    operation: DurableOperation,
  ): Promise<ProjectMaterialView> => {
    operation.status = "running";
    operation.attemptCount += 1;
    const operationAttempt = operation.attemptCount;
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
      ensureMaterialActive(material, operation, operationAttempt);
      const actualContentType = await dependencies.contentInspector.detect({
        name: material.name,
        declaredContentType: material.declaredContentType,
        bytes,
      });
      ensureMaterialActive(material, operation, operationAttempt);
      validateMaterialContentType(material.name, actualContentType);
      material.actualContentType = actualContentType;
      material.updatedAt = dependencies.clock.now();
      persist();
      const extraction = await dependencies.parser.extract({
        name: material.name,
        contentType:
          material.actualContentType ?? material.declaredContentType,
        bytes,
      });
      ensureMaterialActive(material, operation, operationAttempt);
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
        ensureMaterialActive(material, operation, operationAttempt);
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
      ensureMaterialActive(material, operation, operationAttempt);

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
      synchronize();
      if (
        materialProcessingWasCancelled(
          operation,
          operationAttempt,
        )
      ) {
        return toProjectMaterialView(material, actor);
      }
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
          const now = dependencies.clock.now();
          room.updatedAt = now;
          room.lastActivityAt = now;
        }
      },
      persist,
      touchRoom,
      synchronize,
      audit,
    });

  const briefCoordinator = createProjectBriefCoordinator({
    state,
    ids: dependencies.ids,
    clock: dependencies.clock,
    ...(dependencies.briefGenerator
      ? { generator: dependencies.briefGenerator }
      : {}),
    authorize: (actor, roomId) => {
      const room = requireRoomActor(actor, roomId);
      return {
        id: room.id,
        projectDescription: room.projectDescription,
        briefLanguage: room.briefLanguage,
        phase: room.phase,
        ...(room.client
          ? {
              client: {
                displayName: room.client.displayName,
              },
            }
          : {}),
      };
    },
    discovery: (roomId) => {
      const interview = state.discoveryInterviews.find(
        (candidate) => candidate.roomId === roomId,
      );
      const plan = interview
        ? state.interviewPlans.find(
            (candidate) => candidate.id === interview.planId,
          )
        : undefined;
      if (!interview || !plan) {
        throw new ValidationError(
          "A completed Discovery Interview is required.",
        );
      }
      return {
        contextPack:
          state.contextPackRevisions
            .filter((revision) => revision.roomId === roomId)
            .sort(
              (left, right) => right.revision - left.revision,
            )[0] ?? null,
        plan,
        findings: state.discoveryFindings.filter(
          (finding) => finding.interviewId === interview.id,
        ),
        turns: state.interviewTurns
          .filter((turn) => turn.interviewId === interview.id)
          .sort((left, right) => left.sequence - right.sequence),
        corrections: state.interviewCorrections.filter(
          (correction) =>
            correction.interviewId === interview.id,
        ),
        interviewStatus: interview.status,
      };
    },
    ...(dependencies.embeddings
      ? {
          searchEvidence: (
            roomId: string,
            query: string,
            limit = 5,
          ) => searchEvidence(roomId, query, limit),
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
    validateMaterialSource: (roomId, materialId, locator) =>
      state.materialChunks.some(
        (candidate) =>
          candidate.roomId === roomId &&
          candidate.materialId === materialId &&
          candidate.active &&
          sourceLocatorKey(candidate.locator) ===
            sourceLocatorKey(locator),
      ),
    sourceDetail: (roomId, source) => {
      switch (source.type) {
        case "project_description": {
          const room = state.rooms.find(
            (candidate) => candidate.id === roomId,
          );
          return room
            ? {
                label: "Project Description",
                text: room.projectDescription,
              }
            : null;
        }
        case "turn": {
          const turn = state.interviewTurns.find(
            (candidate) =>
              candidate.id === source.turnId &&
              candidate.roomId === roomId,
          );
          return turn
            ? {
                label: `Interview Turn ${turn.sequence}`,
                text: `${turn.question.text}\n\n${turn.answer}`,
                sequence: turn.sequence,
              }
            : null;
        }
        case "correction": {
          const correction = state.interviewCorrections.find(
            (candidate) =>
              candidate.id === source.correctionId &&
              candidate.roomId === roomId,
          );
          return correction
            ? {
                label: "Interview Correction",
                text: correction.correctedAnswer,
                reason: correction.reason,
              }
            : null;
        }
        case "material": {
          const material = state.projectMaterials.find(
            (candidate) =>
              candidate.id === source.materialId &&
              candidate.roomId === roomId,
          );
          const excerpt = state.materialChunks.find(
            (candidate) =>
              candidate.roomId === roomId &&
              candidate.materialId === source.materialId &&
              candidate.active &&
              sourceLocatorKey(candidate.locator) ===
                sourceLocatorKey(source.locator),
          );
          return material
            ? {
                label: `${material.name} · ${source.locator.label}`,
                text: excerpt?.text.slice(0, 2_000) ?? "",
                ...(!excerpt ? { unavailable: true } : {}),
                locator: source.locator.label,
              }
            : null;
        }
        case "analysis_feedback": {
          const feedback = state.analysisFeedback.find(
            (candidate) =>
              candidate.id === source.feedbackId &&
              candidate.roomId === roomId,
          );
          return feedback
            ? {
                label: `Analysis Feedback · ${feedback.locator.label}`,
                text: feedback.explanation,
                locator: feedback.locator.label,
              }
            : null;
        }
        case "model_inference":
          return {
            label: "Model inference",
            text: source.description,
          };
        case "freelancer_edit":
          return {
            label: "Freelancer-authored edit",
            text: source.description,
          };
      }
    },
    setRoomPhase: (roomId, phase) => {
      const room = state.rooms.find(({ id }) => id === roomId);
      if (room) {
        room.phase = phase;
        const now = dependencies.clock.now();
        room.updatedAt = now;
        room.lastActivityAt = now;
      }
    },
    touchRoom,
    synchronize,
    persist,
    audit,
  });

  return {
    identities: {
      async establishFreelancer(input: {
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

      async resumeFreelancer(
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
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
          invite: {
            tokenHash: await dependencies.inviteTokens.hash(inviteToken),
            status: "active",
            version: 1,
          },
        };
        requireFreelancer(actor);
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
      ): Promise<Array<ProjectRoom & { nextAction: ProjectNextAction }>> {
        requireFreelancer(actor);
        const search = filters.search?.trim().toLocaleLowerCase() ?? "";
        return state.rooms
          .filter((room) => room.freelancerId === actor.freelancerId)
          .filter((room) => room.deletedAt === undefined)
          .filter((room) => !filters.phase || room.phase === filters.phase)
          .filter(
            (room) =>
              !search ||
              `${room.title} ${room.clientLabel}`
                .toLocaleLowerCase()
                .includes(search),
          )
          .sort(
            (a, b) => b.lastActivityAt - a.lastActivityAt,
          )
          .map((room) => ({
            ...copy(room),
            nextAction: projectNextActionFor(
              room.phase,
              actor.kind,
            ),
          }));
      },
    },
    projectHome: {
      async get(actor: RoomActor, roomId: string) {
        const room = requireRoomActor(actor, roomId);
        return {
          room: toProjectRoomView(room),
          readOnly:
            room.phase === "archived" && actor.kind === "client",
          nextAction: projectNextActionFor(room.phase, actor.kind),
          resources: copy(
            state.sharedResources
              .filter((resource) => resource.roomId === roomId)
              .sort((left, right) => left.order - right.order),
          ),
          approvedVersions: copy(
            state.reviewVersions
              .filter(
                (version) =>
                  version.roomId === roomId &&
                  version.status === "approved",
              )
              .sort((left, right) => right.version - left.version),
          ),
        };
      },

      resources: {
        async list(
          actor: RoomActor,
          roomId: string,
        ): Promise<SharedResource[]> {
          requireRoomActor(actor, roomId);
          return copy(
            state.sharedResources
              .filter((resource) => resource.roomId === roomId)
              .sort((left, right) => left.order - right.order),
          );
        },

        async create(
          actor: RoomActor,
          roomId: string,
          input: SharedResourceInput,
        ): Promise<SharedResource> {
          requireSharedResourceManager(actor, roomId);
          const normalized = normalizeSharedResourceInput(input);
          const now = dependencies.clock.now();
          const resource: SharedResource = {
            id: dependencies.ids.next("shared_resource"),
            roomId,
            ...normalized,
            order: state.sharedResources.filter(
              (candidate) => candidate.roomId === roomId,
            ).length,
            createdAt: now,
            updatedAt: now,
          };
          state.sharedResources.push(resource);
          audit(actor, roomId, "shared_resource.created");
          persist();
          return copy(resource);
        },

        async update(
          actor: RoomActor,
          roomId: string,
          resourceId: string,
          input: SharedResourceInput,
        ): Promise<SharedResource> {
          requireSharedResourceManager(actor, roomId);
          const resource = state.sharedResources.find(
            (candidate) =>
              candidate.id === resourceId &&
              candidate.roomId === roomId,
          );
          if (!resource) throw new AuthorizationError();
          const normalized = normalizeSharedResourceInput(input);
          delete resource.url;
          delete resource.note;
          delete resource.accountIdentifier;
          Object.assign(
            resource,
            normalized,
            { updatedAt: dependencies.clock.now() },
          );
          audit(actor, roomId, "shared_resource.updated");
          persist();
          return copy(resource);
        },

        async reorder(
          actor: RoomActor,
          roomId: string,
          resourceIds: string[],
        ): Promise<SharedResource[]> {
          requireSharedResourceManager(actor, roomId);
          const resources = state.sharedResources.filter(
            (resource) => resource.roomId === roomId,
          );
          if (
            resourceIds.length !== resources.length ||
            new Set(resourceIds).size !== resources.length ||
            resources.some(
              ({ id }) => !resourceIds.includes(id),
            )
          ) {
            throw new ValidationError(
              "Reordering requires every Shared Resource in this Project Room exactly once.",
            );
          }
          const now = dependencies.clock.now();
          for (const resource of resources) {
            resource.order = resourceIds.indexOf(resource.id);
            resource.updatedAt = now;
          }
          audit(actor, roomId, "shared_resource.reordered");
          persist();
          return copy(
            resources.sort((left, right) => left.order - right.order),
          );
        },

        async remove(
          actor: RoomActor,
          roomId: string,
          resourceId: string,
        ): Promise<void> {
          requireSharedResourceManager(actor, roomId);
          const resource = state.sharedResources.find(
            (candidate) =>
              candidate.id === resourceId &&
              candidate.roomId === roomId,
          );
          if (!resource) throw new AuthorizationError();
          state.sharedResources = state.sharedResources.filter(
            ({ id }) => id !== resource.id,
          );
          state.sharedResources
            .filter((candidate) => candidate.roomId === roomId)
            .sort((left, right) => left.order - right.order)
            .forEach((candidate, order) => {
              candidate.order = order;
              candidate.updatedAt = dependencies.clock.now();
            });
          audit(actor, roomId, "shared_resource.removed");
          persist();
        },
      },
      lifecycle: {
        async archive(
          actor: FreelancerActor,
          roomId: string,
        ): Promise<ProjectRoomView> {
          const room = requireFreelancerRoom(actor, roomId);
          if (room.phase === "archived") {
            throw new ValidationError(
              "The Project Room is already archived.",
            );
          }
          room.archivedFromPhase = room.phase;
          room.phase = "archived";
          const now = dependencies.clock.now();
          room.updatedAt = now;
          room.lastActivityAt = now;
          audit(actor, roomId, "project_room.archived");
          persist();
          return toProjectRoomView(room);
        },

        async restoreArchived(
          actor: FreelancerActor,
          roomId: string,
        ): Promise<ProjectRoomView> {
          const room = requireFreelancerRoom(actor, roomId);
          if (
            room.phase !== "archived" ||
            !room.archivedFromPhase
          ) {
            throw new ValidationError(
              "Only an archived Project Room can be restored.",
            );
          }
          room.phase = room.archivedFromPhase;
          delete room.archivedFromPhase;
          const now = dependencies.clock.now();
          room.updatedAt = now;
          room.lastActivityAt = now;
          audit(actor, roomId, "project_room.restored_from_archive");
          persist();
          return toProjectRoomView(room);
        },

        async delete(
          actor: FreelancerActor,
          roomId: string,
        ): Promise<{
          roomId: string;
          deletedAt: number;
          purgeAfter: number;
        }> {
          const room = requireFreelancerRoom(actor, roomId);
          const deletedAt = dependencies.clock.now();
          const purgeAfter =
            deletedAt + deletionRecoveryMs;
          const activeMaterialIds = state.projectMaterials
            .filter(
              (material) =>
                material.roomId === roomId && material.active,
            )
            .map(({ id }) => id);
          room.deletedAt = deletedAt;
          room.purgeAfter = purgeAfter;
          room.invite.status = "revoked";
          room.updatedAt = deletedAt;
          room.lastActivityAt = deletedAt;
          for (const operation of state.durableOperations) {
            if (
              operation.roomId === roomId &&
              ["pending", "running", "retryable"].includes(
                operation.status,
              )
            ) {
              operation.status = "cancelled";
              operation.stage = "complete";
              operation.errorCode = "project_room_deleted";
              operation.updatedAt = deletedAt;
            }
          }
          for (const operation of state.interviewOperations) {
            if (
              operation.roomId === roomId &&
              !["succeeded", "failed", "cancelled"].includes(
                operation.status,
              )
            ) {
              operation.status = "cancelled";
              operation.stage = "complete";
              operation.errorCode = "project_room_deleted";
              operation.updatedAt = deletedAt;
            }
          }
          for (const operation of state.briefOperations) {
            if (
              operation.roomId === roomId &&
              !["succeeded", "cancelled"].includes(operation.status)
            ) {
              operation.status = "cancelled";
              operation.stage = "complete";
              operation.errorCode = "project_room_deleted";
              operation.updatedAt = deletedAt;
            }
          }
          for (const material of state.projectMaterials) {
            if (material.roomId === roomId) {
              material.active = false;
              material.retryAvailable = false;
              material.updatedAt = deletedAt;
            }
          }
          state.deletionRecoveryRecords.push({
            id: dependencies.ids.next("deletion_recovery"),
            roomId,
            deletedAt,
            purgeAfter,
            status: "recoverable",
            activeMaterialIds,
          });
          audit(actor, roomId, "project_room.deleted");
          persist();
          return { roomId, deletedAt, purgeAfter };
        },

        async listRecentlyDeleted(
          actor: FreelancerActor,
        ): Promise<
          Array<
            ProjectRoomView & {
              deletedAt: number;
              purgeAfter: number;
            }
          >
        > {
          requireFreelancer(actor);
          return state.rooms
            .filter(
              (room) =>
                room.freelancerId === actor.freelancerId &&
                room.deletedAt !== undefined &&
                room.purgeAfter !== undefined,
            )
            .sort(
              (left, right) =>
                (right.deletedAt ?? 0) -
                (left.deletedAt ?? 0),
            )
            .map((room) => ({
              ...toProjectRoomView(room),
              deletedAt: room.deletedAt!,
              purgeAfter: room.purgeAfter!,
            }));
        },

        async recover(
          actor: FreelancerActor,
          roomId: string,
        ): Promise<ProjectRoomView> {
          const room = requireFreelancerRoom(actor, roomId, true);
          if (
            room.deletedAt === undefined ||
            room.purgeAfter === undefined
          ) {
            throw new ValidationError(
              "Only a recently deleted Project Room can be recovered.",
            );
          }
          const now = dependencies.clock.now();
          if (now >= room.purgeAfter) {
            throw new ValidationError(
              "The Project Room recovery period has ended.",
            );
          }
          const record = state.deletionRecoveryRecords
            .filter(
              (candidate) =>
                candidate.roomId === roomId &&
                candidate.status === "recoverable",
            )
            .sort(
              (left, right) =>
                right.deletedAt - left.deletedAt,
            )[0];
          if (record) {
            record.status = "recovered";
            record.recoveredAt = now;
          }
          delete room.deletedAt;
          delete room.purgeAfter;
          room.invite.status = "active";
          for (const material of state.projectMaterials) {
            if (material.roomId === roomId) {
              const shouldReactivate =
                record?.activeMaterialIds.includes(material.id) ??
                material.active;
              material.active = shouldReactivate;
              if (
                shouldReactivate &&
                material.state === "processing"
              ) {
                material.state = "failed";
                material.stage = "complete";
                material.retryAvailable = true;
                material.failureCode = "interrupted_processing";
              }
              material.updatedAt = now;
            }
          }
          const cancelledInterviewIds = new Set(
            state.interviewOperations
              .filter(
                (operation) =>
                  operation.roomId === roomId &&
                  operation.status === "cancelled",
              )
              .map(({ interviewId }) => interviewId),
          );
          for (const interview of state.discoveryInterviews) {
            if (cancelledInterviewIds.has(interview.id)) {
              interview.status = "retryable";
              interview.operationStatus = "retryable";
              interview.updatedAt = now;
            }
          }
          room.updatedAt = now;
          room.lastActivityAt = now;
          audit(actor, roomId, "project_room.recovered");
          persist();
          return toProjectRoomView(room);
        },

        async reopenDiscovery(
          actor: FreelancerActor,
          roomId: string,
        ): Promise<void> {
          const room = requireFreelancerRoom(actor, roomId);
          if (room.phase === "archived") {
            throw new ValidationError(
              "Restore the archived Project Room before reopening discovery.",
            );
          }
          const interview = state.discoveryInterviews.find(
            (candidate) => candidate.roomId === roomId,
          );
          if (
            !interview ||
            !["completed", "completed_early"].includes(
              interview.status,
            )
          ) {
            throw new ValidationError(
              "Only completed discovery can be reopened.",
            );
          }
          const plan = state.interviewPlans.find(
            (candidate) => candidate.id === interview.planId,
          );
          if (!plan) {
            throw new ValidationError(
              "The existing Interview Plan is unavailable.",
            );
          }
          const area =
            plan.coverageAreas.find(
              ({ status }) =>
                status === "uncovered" || status === "partial",
            ) ?? plan.coverageAreas[0];
          if (!area) {
            throw new ValidationError(
              "The existing Interview Plan has no Coverage Areas.",
            );
          }
          const now = dependencies.clock.now();
          interview.status = "active";
          interview.operationStatus = "idle";
          interview.currentQuestion = {
            id: dependencies.ids.next("question"),
            text:
              interview.language === "de"
                ? `Die Klärung wurde wieder geöffnet. Was sollten wir bei „${area.label}“ als Nächstes ergänzen oder korrigieren?`
                : `Discovery was reopened. What should we add or correct next for “${area.label}”?`,
            coverageAreaId: area.id,
            kind: "follow_up",
            reason:
              "The Freelancer reopened discovery to continue the existing Interview Plan.",
            askedAt: now,
          };
          delete interview.completionRationale;
          delete interview.incompleteReason;
          interview.reviewerBlockers = [];
          interview.updatedAt = now;
          plan.updatedAt = now;
          for (const review of state.reviewVersions) {
            if (
              review.roomId === roomId &&
              review.status !== "approved"
            ) {
              review.status = "invalidated";
            }
          }
          room.phase = "discovery";
          room.updatedAt = now;
          room.lastActivityAt = now;
          audit(actor, roomId, "interview.reopened");
          persist();
        },

        async purgeExpired(): Promise<string[]> {
          synchronize();
          const now = dependencies.clock.now();
          const expired = state.rooms.filter(
            (room) =>
              room.deletedAt !== undefined &&
              room.purgeAfter !== undefined &&
              room.purgeAfter <= now,
          );
          const purged: string[] = [];
          for (const room of expired) {
            const materials = state.projectMaterials.filter(
              (material) => material.roomId === room.id,
            );
            await Promise.all(
              materials.map((material) =>
                dependencies.materialFiles?.remove(
                  material.fileReference,
                  {
                    roomId: material.roomId,
                    uploaderId: material.uploaderId,
                  },
                ),
              ),
            );
            purgeRoomRecords(room.id);
            state.rooms = state.rooms.filter(
              (record) => record.id !== room.id,
            );
            for (const [sessionId, session] of clientSessions) {
              if (session.roomId === room.id) {
                clientSessions.delete(sessionId);
              }
            }
            purged.push(room.id);
          }
          if (purged.length) persist();
          return purged;
        },
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
        if (room.phase !== "archived") room.phase = "discovery";
        const now = dependencies.clock.now();
        room.updatedAt = now;
        room.lastActivityAt = now;
        audit(actor, room.id, "client.onboarded");
        persist();
        return toProjectRoomView(room);
      },

      async rotateInvite(
        actor: FreelancerActor,
        roomId: string,
      ): Promise<{ inviteToken: string; inviteVersion: number }> {
        requireFreelancerRoom(actor, roomId);
        const inviteToken = dependencies.ids.inviteToken();
        const tokenHash =
          await dependencies.inviteTokens.hash(inviteToken);
        const room = requireFreelancerRoom(actor, roomId);
        room.invite = {
          tokenHash,
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
        const room = requireWritableRoomActor(actor, roomId);
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
        const currentRoom = requireWritableRoomActor(actor, roomId);
        validateMaterialInput(currentRoom, {
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
        currentRoom.interviewReadiness = "waiting_for_material";
        currentRoom.updatedAt = dependencies.clock.now();
        audit(actor, roomId, "project_material.uploaded");
        persist();
        return toProjectMaterialView(material, actor);
      },

      async process(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ): Promise<ProjectMaterialView> {
        const room = requireWritableRoomActor(actor, roomId);
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
        const room = requireWritableRoomActor(actor, roomId);
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
        const room = requireWritableRoomActor(actor, roomId);
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
        const room = requireWritableRoomActor(actor, roomId);
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
        touchRoom(roomId);
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
        const room = requireWritableRoomActor(actor, roomId);
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
            requireWritableRoomActor(actor, roomId);
            await dependencies.materialFiles?.remove(
              material.fileReference,
              {
                roomId: material.roomId,
                uploaderId: material.uploaderId,
              },
            );
            requireWritableRoomActor(actor, roomId);
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
        const room = requireWritableRoomActor(actor, roomId);
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
        const now = dependencies.clock.now();
        room.updatedAt = now;
        room.lastActivityAt = now;
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
    briefs: briefCoordinator,
    inspectState: (): ProjectInterviewerSnapshot => copy(state),
  };
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
