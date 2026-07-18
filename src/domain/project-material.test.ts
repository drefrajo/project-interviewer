import { describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  ValidationError,
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
  type ProjectInterviewerSnapshot,
} from "./project-interviewer";
import type {
  FileAnalysisDraft,
  MaterialExtraction,
} from "./project-material";
import {
  UnsupportedMaterialError,
  sourceLocatorKey,
  type SourceLocator,
} from "./project-material";
import {
  findSuspectedSecrets,
  publicSuspectedSecrets,
} from "./material-safety";

const createDependencies = (options?: {
  extraction?: MaterialExtraction | Error;
  analysis?: FileAnalysisDraft;
}) => {
  let id = 0;
  let now = 1_800_000_000_000;
  const analyzedInputs: string[] = [];
  const files = new Map<string, Uint8Array>();
  files.set(
    "file-ref",
    new TextEncoder().encode(
      "The portal launches in October. API_KEY=sk_test_12345678901234567890",
    ),
  );
  const defaultExtraction: MaterialExtraction = {
    language: "en",
    method: "plain-text",
    segments: [
      {
        text: "The portal launches in October. API_KEY=sk_test_12345678901234567890",
        locator: { kind: "paragraph", label: "Paragraph 1" },
      },
    ],
  };
  const defaultAnalysis: FileAnalysisDraft = {
    summary: "The source describes an October portal launch.",
    summaryLanguage: "en",
    primaryCategory: "brief",
    secondaryCategories: ["timeline"],
    confidence: 0.92,
    language: "en",
    signals: [
      {
        text: "The source states an October launch target.",
        locator: { kind: "paragraph", label: "Paragraph 1" },
      },
    ],
    model: "fixture-analyzer",
    provider: "test",
  };
  const dependencies: ProjectInterviewerDependencies = {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => `invite_${id}`,
      deviceId: () => "device_client",
    },
    clock: { now: () => ++now },
    inviteTokens: { hash: async (value) => `hash:${value}` },
    materialFiles: {
      inspect: async (_reference, scope) => ({
        size: scope.claimedSize,
        contentType: scope.declaredContentType,
      }),
      read: async (reference) => files.get(reference) ?? new Uint8Array(),
      remove: async (reference) => void files.delete(reference),
    },
    contentInspector: {
      detect: async ({ name, declaredContentType }) =>
        name.endsWith(".pdf") ? "application/pdf" : declaredContentType,
    },
    parser: {
      extract: vi.fn(async () => {
        if (options?.extraction instanceof Error) throw options.extraction;
        return options?.extraction ?? defaultExtraction;
      }),
    },
    fileAnalyzer: {
      analyze: vi.fn(async (input) => {
        analyzedInputs.push(input.redactedText);
        return options?.analysis ?? defaultAnalysis;
      }),
    },
    embeddings: {
      embed: async (texts) => texts.map((_, index) => [index + 0.1, 0.2]),
    },
  };
  return { dependencies, analyzedInputs };
};

const createRoom = async (dependencies: ProjectInterviewerDependencies) => {
  const app = createProjectInterviewer(dependencies);
  const freelancer = await app.identities.establishFreelancer({
    displayName: "Ada",
  });
  const created = await app.rooms.create(freelancer, {
    title: "Portal",
    clientLabel: "Alpine",
    projectDescription: "A Client portal.",
    briefLanguage: "en",
    freelancerGuidance: "",
  });
  return {
    app,
    freelancer,
    room: created.room,
    inviteToken: created.inviteToken,
  };
};

describe("Project Material public service", () => {
  it("rejects a stale cross-instance upload inspection that finishes after room deletion", async () => {
    const { dependencies } = createDependencies();
    let persisted: ProjectInterviewerSnapshot | undefined;
    let releaseInspection:
      | ((result: { size: number; contentType: string }) => void)
      | undefined;
    dependencies.loadLatestState = () => persisted;
    dependencies.persist = (snapshot) => {
      persisted = structuredClone(snapshot);
    };
    dependencies.materialFiles = {
      ...dependencies.materialFiles!,
      inspect: async () =>
        new Promise((resolve) => {
          releaseInspection = resolve;
        }),
    };
    const { app, freelancer, room } = await createRoom(dependencies);
    const pending = app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    const rejected = expect(pending).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await vi.waitFor(() =>
      expect(releaseInspection).toBeTypeOf("function"),
    );

    const { dependencies: secondDependencies } = createDependencies();
    secondDependencies.initialState = persisted!;
    secondDependencies.loadLatestState = () => persisted;
    secondDependencies.persist = (snapshot) => {
      persisted = structuredClone(snapshot);
    };
    const second = createProjectInterviewer(secondDependencies);
    const secondFreelancer =
      await second.identities.resumeFreelancer(
        freelancer.freelancerId,
      );
    await second.projectHome.lifecycle.delete(
      secondFreelancer,
      room.id,
    );
    releaseInspection?.({
      size: 74,
      contentType: "text/plain",
    });

    await rejected;
    expect(app.inspectState().projectMaterials).toEqual([]);
    expect(app.inspectState().rooms[0]).toMatchObject({
      deletedAt: expect.any(Number),
      invite: { status: "revoked" },
    });
  });

  it("prevents deleted-room file analysis from committing late and restores the material as retryable", async () => {
    const { dependencies } = createDependencies();
    let persisted: ProjectInterviewerSnapshot | undefined;
    dependencies.loadLatestState = () => persisted;
    dependencies.persist = (snapshot) => {
      persisted = structuredClone(snapshot);
    };
    let releaseAnalysis:
      | ((analysis: FileAnalysisDraft) => void)
      | undefined;
    dependencies.fileAnalyzer = {
      analyze: async () =>
        new Promise<FileAnalysisDraft>((resolve) => {
          releaseAnalysis = resolve;
        }),
    };
    const { app, freelancer, room } = await createRoom(dependencies);
    const accepted = await app.materials.accept(
      freelancer,
      room.id,
      {
        name: "Brief.txt",
        size: 74,
        declaredContentType: "text/plain",
        fileReference: "file-ref",
        uploader: "freelancer",
      },
    );
    const pending = app.materials.process(
      freelancer,
      room.id,
      accepted.id,
    );
    await vi.waitFor(() =>
      expect(
        app.inspectState().durableOperations[0]?.status,
      ).toBe("running"),
    );

    const { dependencies: secondDependencies } = createDependencies();
    secondDependencies.initialState = persisted!;
    secondDependencies.loadLatestState = () => persisted;
    secondDependencies.persist = (snapshot) => {
      persisted = structuredClone(snapshot);
    };
    const second = createProjectInterviewer(secondDependencies);
    const secondFreelancer =
      await second.identities.resumeFreelancer(
        freelancer.freelancerId,
      );
    await second.projectHome.lifecycle.delete(
      secondFreelancer,
      room.id,
    );
    releaseAnalysis?.({
      summary: "This late analysis must not be committed.",
      summaryLanguage: "en",
      primaryCategory: "brief",
      secondaryCategories: [],
      confidence: 1,
      language: "en",
      signals: [],
      model: "delayed-analyzer",
      provider: "test",
    });
    await pending;

    expect(app.inspectState().projectMaterials[0]).toMatchObject({
      active: false,
      state: "processing",
    });
    expect(app.inspectState().durableOperations[0]).toMatchObject({
      status: "cancelled",
      errorCode: "project_room_deleted",
    });
    await app.projectHome.lifecycle.recover(freelancer, room.id);
    expect(app.inspectState().projectMaterials[0]).toMatchObject({
      active: true,
      state: "failed",
      retryAvailable: true,
      failureCode: "interrupted_processing",
    });
  });

  it("canonicalizes source locators independently of object property order", () => {
    const canonical: SourceLocator = {
      kind: "paragraph",
      label: "Paragraph 1",
      paragraph: 1,
    };
    const reordered = JSON.parse(
      '{"paragraph":1,"label":"Paragraph 1","kind":"paragraph"}',
    ) as SourceLocator;
    expect(sourceLocatorKey(reordered)).toBe(
      sourceLocatorKey(canonical),
    );
  });

  it("never treats punctuation inside a generic high-entropy token as a public assignment prefix", () => {
    const matches = findSuspectedSecrets([
      {
        text: "ABCD1234EFGH5678IJKL9012=MNOP",
        locator: { kind: "paragraph", label: "Paragraph 1" },
      },
    ]);

    const [warning] = publicSuspectedSecrets(matches);
    expect(warning?.maskedPreview).toBe("ABCD…MNOP");
    expect(warning?.maskedPreview).not.toContain(
      "ABCD1234EFGH5678IJKL9012",
    );
  });

  it("accepts first, masks suspected secrets, then commits shallow analysis and a Context Pack Revision", async () => {
    const { dependencies, analyzedInputs } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);

    const accepted = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    expect(accepted).toMatchObject({
      state: "accepted",
      stage: "checking_file",
    });

    const analyzed = await app.materials.process(
      freelancer,
      room.id,
      accepted.id,
    );

    expect(analyzed).toMatchObject({
      state: "analyzed",
      stage: "complete",
      analysis: {
        primaryCategory: "brief",
        processingVersion: "material-processing-v1",
      },
    });
    expect(analyzed.suspectedSecrets).toEqual([
      expect.objectContaining({
        maskedPreview: "API_KEY=sk_t…7890",
      }),
    ]);
    expect(analyzedInputs[0]).not.toContain("sk_test_12345678901234567890");
    expect(analyzedInputs[0]).toContain("[REDACTED SUSPECTED SECRET]");
    expect(await app.contextPacks.latest(freelancer, room.id)).toMatchObject({
      revision: 1,
      reason: "material_analyzed",
      includedMaterialIds: [accepted.id],
      materialSummaries: [
        {
          materialId: accepted.id,
          analysisId: expect.any(String),
          analysisVersion: 1,
          summaryLanguage: "en",
          summarySources: [
            { kind: "paragraph", label: "Paragraph 1" },
          ],
          available: true,
          category: "brief",
          confidence: 0.92,
          fileName: "Brief.txt",
          signals: expect.any(Array),
          summary: expect.any(String),
        },
      ],
    });
    expect(app.inspectState().durableOperations).toEqual([
      expect.objectContaining({
        operationType: "file_processing",
        status: "succeeded",
        stage: "complete",
        attemptCount: 1,
        contextPackRevisionId: expect.any(String),
      }),
    ]);
  });

  it("reuses an in-flight idempotent processing operation", async () => {
    const { dependencies } = createDependencies();
    const analyze = dependencies.fileAnalyzer?.analyze;
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    const [first, repeated] = await Promise.all([
      app.materials.process(freelancer, room.id, material.id),
      app.materials.process(freelancer, room.id, material.id),
    ]);

    expect(first).toEqual(repeated);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(app.inspectState().durableOperations).toHaveLength(1);
  });

  it("recovers interrupted persisted processing as an explicit retry path", async () => {
    const firstSetup = createDependencies();
    const { app, freelancer, room } = await createRoom(
      firstSetup.dependencies,
    );
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    const snapshot = app.inspectState();
    const interrupted = snapshot.projectMaterials.find(
      ({ id }) => id === material.id,
    );
    if (!interrupted) throw new Error("fixture material is missing");
    interrupted.state = "processing";
    interrupted.stage = "analyzing";
    snapshot.durableOperations.push({
      id: "operation_interrupted",
      roomId: room.id,
      operationType: "file_processing",
      idempotencyKey: `file_processing:${room.id}:${material.id}:masked`,
      status: "running",
      stage: "analyzing",
      attemptCount: 1,
      promptVersion: "software-project-file-analysis-v1",
      schemaVersion: "file-analysis-v1",
      createdAt: 1,
      updatedAt: 1,
    });
    const restoredDependencies = createDependencies().dependencies;
    restoredDependencies.initialState = snapshot;

    const restored = createProjectInterviewer(restoredDependencies);

    expect(restored.inspectState().projectMaterials[0]).toMatchObject({
      state: "failed",
      retryAvailable: true,
      failureCode: "interrupted_processing",
    });
    expect(restored.inspectState().durableOperations[0]).toMatchObject({
      status: "retryable",
      errorCode: "interrupted_processing",
    });
    const restoredFreelancer =
      await restored.identities.resumeFreelancer(
        freelancer.freelancerId,
      );
    await expect(
      restored.materials.retry(
        restoredFreelancer,
        room.id,
        material.id,
      ),
    ).resolves.toMatchObject({ state: "analyzed" });
    expect(restored.inspectState().durableOperations[0]).toMatchObject({
      status: "succeeded",
      attemptCount: 2,
    });
  });

  it("audits an explicit secret override and reanalyzes with the flagged text", async () => {
    const { dependencies, analyzedInputs } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);

    await app.materials.includeSuspectedSecrets(
      freelancer,
      room.id,
      material.id,
      { acknowledgedProviderDisclosure: true },
    );

    expect(analyzedInputs.at(-1)).toContain(
      "sk_test_12345678901234567890",
    );
    expect(
      app
        .inspectState()
        .auditEvents.some(
          ({ action }) => action === "project_material.secret_override",
        ),
    ).toBe(true);
    expect(
      app.inspectState().projectMaterials[0]?.analysisVersions,
    ).toHaveLength(2);
  });

  it("lets the Freelancer request a new analysis while retaining prior versions", async () => {
    const { dependencies } = createDependencies();
    const analyze = dependencies.fileAnalyzer?.analyze;
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);

    const reanalyzed = await app.materials.reanalyze(
      freelancer,
      room.id,
      material.id,
    );

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(reanalyzed.analysisVersions).toHaveLength(2);
    expect(reanalyzed.analysis?.version).toBe(2);
    expect(
      app
        .inspectState()
        .auditEvents.some(
          ({ action }) => action === "project_material.reanalysis_requested",
        ),
    ).toBe(true);
  });

  it("rejects Client-requested reanalysis at the public domain boundary", async () => {
    const { dependencies } = createDependencies();
    const { app, freelancer, room, inviteToken } =
      await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);
    const client = (
      await app.clientAccess.resolveInvite(inviteToken, {
        deviceId: "client-device",
      })
    ).actor;

    await expect(
      app.materials.reanalyze(
        client as unknown as typeof freelancer,
        room.id,
        material.id,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("masks repeated and short credentials everywhere, including provider output", async () => {
    const locatorOne = {
      kind: "paragraph" as const,
      label: "Paragraph 1",
    };
    const locatorTwo = {
      kind: "paragraph" as const,
      label: "Paragraph 2",
    };
    const { dependencies, analyzedInputs } = createDependencies({
      extraction: {
        language: "en",
        method: "plain-text",
        segments: [
          { text: "password=tenant:abc123", locator: locatorOne },
          { text: "password=tenant:abc123", locator: locatorTwo },
        ],
      },
      analysis: {
        summary: "The value tenant:abc123 grants access.",
        summaryLanguage: "en",
        primaryCategory: "technical",
        secondaryCategories: [],
        confidence: 0.8,
        language: "en",
        signals: [
          {
            text: "Credential tenant:abc123 is present.",
            locator: locatorOne,
          },
        ],
        model: "fixture-analyzer",
        provider: "test",
      },
    });
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "credentials.txt",
      size: 32,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    const analyzed = await app.materials.process(
      freelancer,
      room.id,
      material.id,
    );

    expect(analyzedInputs[0]).not.toContain("tenant:abc123");
    expect(analyzedInputs[0]?.match(/REDACTED/gu)).toHaveLength(2);
    expect(analyzed.suspectedSecrets).toHaveLength(2);
    expect(
      analyzed.suspectedSecrets[0]?.maskedPreview,
    ).not.toContain("tenant:");
    expect(analyzed.analysis?.summary).not.toContain("tenant:abc123");
    expect(analyzed.analysis?.signals[0]?.text).not.toContain(
      "tenant:abc123",
    );
  });

  it("adds Analysis Feedback to a new revision without another analyzer call", async () => {
    const { dependencies } = createDependencies();
    const analyze = dependencies.fileAnalyzer?.analyze;
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);
    const activityBeforeFeedback = (
      await app.rooms.get(freelancer, room.id)
    ).lastActivityAt;

    await app.materials.addFeedback(freelancer, room.id, material.id, {
      explanation: "October is only a preference, not a fixed deadline.",
      locator: { kind: "paragraph", label: "Paragraph 1" },
    });
    expect(
      (await app.rooms.get(freelancer, room.id)).lastActivityAt,
    ).toBeGreaterThan(activityBeforeFeedback);

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(await app.contextPacks.latest(freelancer, room.id)).toMatchObject({
      revision: 2,
      reason: "analysis_feedback_added",
      feedback: [
        expect.objectContaining({
          explanation: "October is only a preference, not a fixed deadline.",
        }),
      ],
    });
  });

  it("uses the failed terminal path and can deliberately continue without files", async () => {
    const { dependencies } = createDependencies({
      extraction: new Error("corrupt document"),
    });
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.pdf",
      size: 12,
      declaredContentType: "application/pdf",
      actualContentType: "application/pdf",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    expect(
      await app.materials.process(freelancer, room.id, material.id),
    ).toMatchObject({ state: "failed", retryAvailable: true });

    const pack = await app.materials.continueWithoutFiles(
      freelancer,
      room.id,
    );
    expect(pack).toMatchObject({
      revision: 1,
      reason: "continued_without_material",
      minimalContextWarning: true,
    });
    expect(await app.rooms.get(freelancer, room.id)).toMatchObject({
      interviewReadiness: "ready",
    });
  });

  it("uses the unsupported terminal path for a supported container with unsupported content", async () => {
    const { dependencies } = createDependencies({
      extraction: new UnsupportedMaterialError("encrypted PDF"),
    });
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "encrypted.pdf",
      size: 12,
      declaredContentType: "application/pdf",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    await expect(
      app.materials.process(freelancer, room.id, material.id),
    ).resolves.toMatchObject({
      state: "unsupported",
      retryAvailable: false,
    });
  });

  it("rejects fabricated image provenance after one repair attempt", async () => {
    const { dependencies } = createDependencies({
      extraction: {
        language: "unknown",
        method: "multimodal-image",
        segments: [],
      },
      analysis: {
        summary: "An uploaded wireframe.",
        summaryLanguage: "en",
        summarySources: [
          { kind: "image", label: "Image 999", image: 999 },
        ],
        primaryCategory: "design/reference",
        secondaryCategories: [],
        confidence: 0.7,
        language: "unknown",
        signals: [],
        model: "fixture-analyzer",
        provider: "test",
      },
    });
    const analyze = dependencies.fileAnalyzer?.analyze;
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "wireframe.png",
      size: 10,
      declaredContentType: "image/png",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    await expect(
      app.materials.process(freelancer, room.id, material.id),
    ).resolves.toMatchObject({
      state: "failed",
      retryAvailable: true,
    });
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("accepts the canonical uploaded-image locator end to end", async () => {
    const { dependencies } = createDependencies({
      extraction: {
        language: "unknown",
        method: "multimodal-image",
        segments: [],
      },
      analysis: {
        summary: "The image is a supplied wireframe.",
        summaryLanguage: "en",
        summarySources: [
          { kind: "image", label: "Image 1", image: 1 },
        ],
        primaryCategory: "design/reference",
        secondaryCategories: [],
        confidence: 0.7,
        language: "unknown",
        signals: [
          {
            text: "The image contains a wireframe.",
            locator: { kind: "image", label: "Image 1", image: 1 },
          },
        ],
        model: "fixture-analyzer",
        provider: "test",
      },
    });
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "wireframe.png",
      size: 10,
      declaredContentType: "image/png",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    await expect(
      app.materials.process(freelancer, room.id, material.id),
    ).resolves.toMatchObject({
      state: "analyzed",
      analysis: {
        summarySources: [
          { kind: "image", label: "Image 1", image: 1 },
        ],
      },
    });
  });

  it("rejects unbounded analyzer output after one repair attempt", async () => {
    const { dependencies } = createDependencies({
      analysis: {
        summary: `The source says ${"x".repeat(700)}`,
        summaryLanguage: "en",
        primaryCategory: "brief",
        secondaryCategories: [],
        confidence: 0.8,
        language: "en",
        signals: [],
        model: "fixture-analyzer",
        provider: "test",
      },
    });
    const analyze = dependencies.fileAnalyzer?.analyze;
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "oversized-analysis.txt",
      size: 10,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });

    await expect(
      app.materials.process(freelancer, room.id, material.id),
    ).resolves.toMatchObject({
      state: "failed",
      retryAvailable: true,
    });
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("rejects a storage reference that is not bound to the room and uploader", async () => {
    const { dependencies } = createDependencies();
    if (!dependencies.materialFiles) {
      throw new Error("fixture storage is missing");
    }
    dependencies.materialFiles.inspect = async () => {
      throw new AuthorizationError("storage scope mismatch");
    };
    const { app, freelancer, room } = await createRoom(dependencies);

    await expect(
      app.materials.accept(freelancer, room.id, {
        name: "Brief.txt",
        size: 10,
        declaredContentType: "text/plain",
        fileReference: "another-room-ref",
        uploader: "freelancer",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("enforces format, signature, count, size, and room authorization before accepting bytes", async () => {
    const { dependencies } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);
    const other = await app.identities.establishFreelancer({
      displayName: "Grace",
    });

    await expect(
      app.materials.accept(freelancer, room.id, {
        name: "payload.exe",
        size: 10,
        declaredContentType: "application/octet-stream",
        fileReference: "file-ref",
        uploader: "freelancer",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      app.materials.accept(freelancer, room.id, {
        name: "Brief.pdf",
        size: 10,
        declaredContentType: "application/pdf",
        actualContentType: "application/zip",
        fileReference: "file-ref",
        uploader: "freelancer",
      }),
    ).rejects.toThrow(/content type/i);
    await expect(
      app.materials.list(other, room.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("enforces developer-configured per-file, count, and total-room limits", async () => {
    const { dependencies } = createDependencies();
    dependencies.materialLimits = {
      maxFiles: 2,
      maxFileBytes: 10,
      maxRoomBytes: 12,
    };
    if (dependencies.materialFiles) {
      const inspect = dependencies.materialFiles.inspect;
      dependencies.materialFiles.inspect = async (reference, scope) =>
        reference === "oversized-ref"
          ? {
              size: 11,
              contentType: scope.declaredContentType,
            }
          : inspect(reference, scope);
    }
    const { app, freelancer, room } = await createRoom(dependencies);

    await expect(
      app.materials.accept(freelancer, room.id, {
        name: "large.txt",
        size: 1,
        declaredContentType: "text/plain",
        fileReference: "oversized-ref",
        uploader: "freelancer",
      }),
    ).rejects.toThrow(/no larger/i);
    await app.materials.accept(freelancer, room.id, {
      name: "first.txt",
      size: 7,
      declaredContentType: "text/plain",
      fileReference: "first-ref",
      uploader: "freelancer",
    });
    await expect(
      app.materials.accept(freelancer, room.id, {
        name: "second.txt",
        size: 6,
        declaredContentType: "text/plain",
        fileReference: "second-ref",
        uploader: "freelancer",
      }),
    ).rejects.toThrow(/room limit/i);

    const countSetup = createDependencies();
    countSetup.dependencies.materialLimits = {
      maxFiles: 1,
      maxFileBytes: 10,
      maxRoomBytes: 100,
    };
    const countRoom = await createRoom(countSetup.dependencies);
    await countRoom.app.materials.accept(
      countRoom.freelancer,
      countRoom.room.id,
      {
        name: "first.txt",
        size: 5,
        declaredContentType: "text/plain",
        fileReference: "first-ref",
        uploader: "freelancer",
      },
    );
    await expect(
      countRoom.app.materials.accept(
        countRoom.freelancer,
        countRoom.room.id,
        {
          name: "second.txt",
          size: 5,
          declaredContentType: "text/plain",
          fileReference: "second-ref",
          uploader: "freelancer",
        },
      ),
    ).rejects.toThrow(/at most 1 file/i);
  });

  it("retrieves only active source-located evidence from the authorized room", async () => {
    const { dependencies } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);

    expect(
      await app.retrieval.search(freelancer, room.id, {
        query: "October launch",
        limit: 5,
      }),
    ).toEqual([
      expect.objectContaining({
        materialId: material.id,
        locator: { kind: "paragraph", label: "Paragraph 1" },
      }),
    ]);
    await expect(
      app.retrieval.search(freelancer, room.id, {
        query: "October",
        limit: -10,
      }),
    ).resolves.toEqual([]);
  });

  it("keeps semantic retrieval multilingual, bounded, and isolated by room", async () => {
    const longGermanText =
      "Der Start soll im Oktober sein. ".repeat(100);
    const { dependencies } = createDependencies({
      extraction: {
        language: "de",
        method: "plain-text",
        segments: [
          {
            text: longGermanText,
            locator: { kind: "paragraph", label: "Absatz 1" },
          },
        ],
      },
      analysis: {
        summary: "The source proposes an October project launch.",
        summaryLanguage: "en",
        primaryCategory: "timeline",
        secondaryCategories: [],
        confidence: 0.8,
        language: "de",
        signals: [
          {
            text: "Die Quelle nennt Oktober als Start.",
            locator: { kind: "paragraph", label: "Absatz 1" },
          },
        ],
        model: "fixture-analyzer",
        provider: "test",
      },
    });
    dependencies.embeddings = {
      embed: async (texts) => texts.map(() => [1, 0]),
    };
    const { app, freelancer, room } = await createRoom(dependencies);
    const secondRoom = (
      await app.rooms.create(freelancer, {
        title: "Other",
        clientLabel: "Other Client",
        projectDescription: "An unrelated project.",
        briefLanguage: "en",
        freelancerGuidance: "",
      })
    ).room;
    const first = await app.materials.accept(freelancer, room.id, {
      name: "Zeitplan.txt",
      size: 100,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    const second = await app.materials.accept(
      freelancer,
      secondRoom.id,
      {
        name: "Other.txt",
        size: 100,
        declaredContentType: "text/plain",
        fileReference: "file-ref",
        uploader: "freelancer",
      },
    );
    await Promise.all([
      app.materials.process(freelancer, room.id, first.id),
      app.materials.process(freelancer, secondRoom.id, second.id),
    ]);

    const results = await app.retrieval.search(freelancer, room.id, {
      query: "launch date",
      limit: 20,
    });

    expect(results.length).toBeGreaterThan(1);
    expect(results.every(({ materialId }) => materialId === first.id)).toBe(
      true,
    );
    expect(results.every(({ text }) => text.length <= 1_200)).toBe(true);
  });

  it("cannot resurrect chunks when material is removed during analysis", async () => {
    const { dependencies } = createDependencies();
    let releaseAnalysis: ((draft: FileAnalysisDraft) => void) | undefined;
    const analysisStarted = new Promise<void>((resolve) => {
      dependencies.fileAnalyzer = {
        analyze: () =>
          new Promise<FileAnalysisDraft>((release) => {
            releaseAnalysis = release;
            resolve();
          }),
      };
    });
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    const processing = app.materials.process(
      freelancer,
      room.id,
      material.id,
    );
    await analysisStarted;
    await expect(
      app.materials.continueWithoutFiles(freelancer, room.id),
    ).rejects.toThrow(/wait for current/i);
    const removeFile = dependencies.materialFiles?.remove;
    const removeSpy = removeFile
      ? vi.spyOn(dependencies.materialFiles!, "remove")
      : undefined;
    const removal = app.materials.remove(
      freelancer,
      room.id,
      material.id,
    );
    const repeatedRemoval = app.materials.remove(
      freelancer,
      room.id,
      material.id,
    );
    releaseAnalysis?.({
      summary: "Removed material.",
      summaryLanguage: "en",
      primaryCategory: "brief",
      secondaryCategories: [],
      confidence: 0.8,
      language: "en",
      signals: [],
      model: "fixture",
      provider: "test",
    });
    const [, firstRevision, repeatedRevision] = await Promise.all([
      processing,
      removal,
      repeatedRemoval,
    ]);
    expect(repeatedRevision).toEqual(firstRevision);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    expect(
      app
        .inspectState()
        .materialChunks.filter(
          ({ materialId, active }) =>
            materialId === material.id && active,
        ),
    ).toHaveLength(0);
    expect(
      await app.retrieval.search(freelancer, room.id, {
        query: "October",
      }),
    ).toHaveLength(0);
    expect(app.inspectState().durableOperations[0]).toMatchObject({
      status: "succeeded",
    });
  });

  it("keeps material active when raw-file deletion fails", async () => {
    const { dependencies } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);
    const material = await app.materials.accept(freelancer, room.id, {
      name: "Brief.txt",
      size: 74,
      declaredContentType: "text/plain",
      fileReference: "file-ref",
      uploader: "freelancer",
    });
    await app.materials.process(freelancer, room.id, material.id);
    if (!dependencies.materialFiles) {
      throw new Error("fixture storage is missing");
    }
    dependencies.materialFiles.remove = async () => {
      throw new Error("storage unavailable");
    };

    await expect(
      app.materials.remove(freelancer, room.id, material.id),
    ).rejects.toThrow(/storage unavailable/i);

    expect(await app.materials.list(freelancer, room.id)).toEqual([
      expect.objectContaining({ id: material.id, active: true }),
    ]);
    expect(
      await app.retrieval.search(freelancer, room.id, {
        query: "October",
      }),
    ).toHaveLength(1);
  });

  it("returns the original subject revision for a repeated completed removal", async () => {
    const { dependencies } = createDependencies();
    const { app, freelancer, room } = await createRoom(dependencies);
    const first = await app.materials.accept(freelancer, room.id, {
      name: "first.txt",
      size: 10,
      declaredContentType: "text/plain",
      fileReference: "first-ref",
      uploader: "freelancer",
    });
    const second = await app.materials.accept(freelancer, room.id, {
      name: "second.txt",
      size: 10,
      declaredContentType: "text/plain",
      fileReference: "second-ref",
      uploader: "freelancer",
    });

    const firstRemoval = await app.materials.remove(
      freelancer,
      room.id,
      first.id,
    );
    const secondRemoval = await app.materials.remove(
      freelancer,
      room.id,
      second.id,
    );
    const repeatedFirstRemoval = await app.materials.remove(
      freelancer,
      room.id,
      first.id,
    );

    expect(firstRemoval.subjectMaterialId).toBe(first.id);
    expect(secondRemoval.subjectMaterialId).toBe(second.id);
    expect(repeatedFirstRemoval).toEqual(firstRemoval);
  });
});
