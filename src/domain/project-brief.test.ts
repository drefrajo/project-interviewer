import { describe, expect, it, vi } from "vitest";
import {
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "./project-interviewer";
import {
  BRIEF_SECTION_IDS,
  briefSourceKey,
  type BriefGeneratorDraft,
  type ProjectBriefAdapters,
} from "./project-brief";
import {
  localInterviewAgent,
  localInterviewPlanner,
  localInterviewReviewer,
} from "../local/local-interview-adapters";

const draftFromInput = (
  input: Parameters<
    NonNullable<ProjectBriefAdapters["generator"]>["generate"]
  >[0],
): BriefGeneratorDraft => ({
  sections: BRIEF_SECTION_IDS.map((id) => ({
    id,
    title: id.replaceAll("-", " "),
    content:
      id === "executive-summary"
        ? "A concise source-linked discovery brief."
        : "Not established",
    sources:
      id === "executive-summary"
        ? [{ type: "project_description" as const }]
        : [],
    items:
      id === "functional-requirements"
        ? input.findings
            .filter(({ type }) => type === "candidate_requirement")
            .map((finding) => ({
              kind: "requirement" as const,
              text: finding.statement,
              scopeStatus: "open" as const,
              priority: null,
              sources: finding.sources,
              findingId: finding.id,
            }))
        : [],
  })),
  model: "brief-generator-fixture",
  provider: "test",
  usage: {
    inputTokens: 30,
    outputTokens: 20,
    estimatedCostUsd: 0.004,
  },
});

const createBriefHarness = async (overrides?: {
  generator?: ProjectBriefAdapters["generator"];
  language?: "en" | "de";
  skipAnswer?: boolean;
  withMaterial?: boolean;
}) => {
  let id = 0;
  let now = 2_000_000_000_000;
  const materialBytes = new TextEncoder().encode(
    "The launch is planned for October.",
  );
  const dependencies: ProjectInterviewerDependencies = {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => "brief-invite",
      deviceId: () => "generated-device",
    },
    clock: { now: () => ++now },
    inviteTokens: { hash: async (token) => `hash:${token}` },
    interviewPlanner: localInterviewPlanner,
    interviewAgent: localInterviewAgent,
    interviewReviewer: localInterviewReviewer,
    briefGenerator: overrides?.generator ?? {
      generate: async (input) => draftFromInput(input),
    },
    materialFiles: {
      inspect: async () => ({
        size: materialBytes.byteLength,
        contentType: "text/plain",
      }),
      read: async () => materialBytes,
      remove: async () => undefined,
    },
    contentInspector: {
      detect: async () => "text/plain",
    },
    parser: {
      extract: async () => ({
        language: "en",
        method: "plain-text",
        segments: [
          {
            text: "The launch is planned for October.",
            locator: {
              kind: "paragraph",
              label: "Paragraph 1",
              paragraph: 1,
            },
          },
        ],
      }),
    },
    fileAnalyzer: {
      analyze: async () => ({
        summary:
          overrides?.language === "de"
            ? "Die Quelle beschreibt einen Start im Oktober."
            : "The source describes an October launch.",
        summaryLanguage: overrides?.language ?? "en",
        primaryCategory: "timeline",
        secondaryCategories: [],
        confidence: 0.95,
        language: "en",
        summarySources: [
          {
            kind: "paragraph",
            label: "Paragraph 1",
            paragraph: 1,
          },
        ],
        signals: [],
        model: "fixture-material-analyzer",
        provider: "test",
      }),
    },
    embeddings: {
      embed: async (texts) => texts.map(() => [1, 0]),
    },
  };
  const app = createProjectInterviewer(dependencies);
  const freelancer =
    await app.identities.establishFreelancer({
      displayName: "Ada",
    });
  const created = await app.rooms.create(freelancer, {
    title: "Portal",
    clientLabel: "Alpine",
    projectDescription: "A self-service Client portal.",
    briefLanguage: overrides?.language ?? "en",
    freelancerGuidance: "",
  });
  if (overrides?.withMaterial) {
    const material = await app.materials.accept(
      freelancer,
      created.room.id,
      {
        name: "Timeline.txt",
        size: materialBytes.byteLength,
        declaredContentType: "text/plain",
        fileReference: "timeline-file",
        uploader: "freelancer",
      },
    );
    await app.materials.process(
      freelancer,
      created.room.id,
      material.id,
    );
  } else {
    await app.materials.continueWithoutFiles(
      freelancer,
      created.room.id,
    );
  }
  const access = await app.clientAccess.resolveInvite(
    created.inviteToken,
    { deviceId: "client-device" },
  );
  await app.clientAccess.onboard(access.actor, {
    displayName: "Chris",
    interviewLanguage: overrides?.language ?? "en",
    acknowledgedDisclosure: true,
  });
  const started = await app.interviews.start(
    access.actor,
    created.room.id,
  );
  const contextPack = await app.contextPacks.latest(
    access.actor,
    created.room.id,
  );
  if (!overrides?.skipAnswer) {
    await app.interviews.submitAnswer(
      access.actor,
      created.room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "The product must support single sign-on.",
        idempotencyKey: "brief-seed-answer",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
  }
  await app.interviews.finishEarly(access.actor, created.room.id, {
    confirmed: true,
  });
  return {
    app,
    dependencies,
    freelancer,
    client: access.actor,
    room: created.room,
  };
};

describe("Project Brief public service", () => {
  it("prevents a deleted room's in-flight Brief Generator from committing a late draft", async () => {
    let releaseGeneration:
      | ((draft: BriefGeneratorDraft) => void)
      | undefined;
    let generatorInput:
      | Parameters<
          NonNullable<
            ProjectBriefAdapters["generator"]
          >["generate"]
        >[0]
      | undefined;
    const { app, freelancer, room } = await createBriefHarness({
      generator: {
        generate: async (input) => {
          generatorInput = input;
          return new Promise<BriefGeneratorDraft>((resolve) => {
            releaseGeneration = resolve;
          });
        },
      },
    });
    const pending = app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "delete-during-generation",
    });
    const cancelled = expect(pending).rejects.toThrow(/cancelled/i);
    await vi.waitFor(() =>
      expect(
        app.inspectState().briefOperations.at(-1)?.status,
      ).toBe("running"),
    );

    await app.projectHome.lifecycle.delete(freelancer, room.id);
    releaseGeneration?.(draftFromInput(generatorInput!));
    await cancelled;

    const deleted = app.inspectState();
    expect(deleted.briefDrafts).toEqual([]);
    expect(deleted.briefOperations.at(-1)).toMatchObject({
      status: "cancelled",
      errorCode: "project_room_deleted",
    });
  });

  it("persists one idempotent generation operation before AI work and validates the complete default structure", async () => {
    let resolveGeneration:
      | ((draft: BriefGeneratorDraft) => void)
      | undefined;
    const generatorStarted = vi.fn();
    const { app, freelancer, room } = await createBriefHarness({
      generator: {
        generate: async (input) => {
          generatorStarted();
          return new Promise<BriefGeneratorDraft>((resolve) => {
            resolveGeneration = resolve;
          }).then(() => draftFromInput(input));
        },
      },
    });

    const first = app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "brief-generation-1",
    });
    await vi.waitFor(() =>
      expect(generatorStarted).toHaveBeenCalledOnce(),
    );
    expect(app.inspectState().briefOperations).toEqual([
      expect.objectContaining({
        status: "running",
        operationType: "brief_generation",
      }),
    ]);
    const repeated = app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "brief-generation-1",
    });
    const distinctKey = app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "brief-generation-distinct",
    });
    expect(generatorStarted).toHaveBeenCalledOnce();
    resolveGeneration?.({} as BriefGeneratorDraft);

    const [generated, repeatedResult, distinctResult] = await Promise.all([
      first,
      repeated,
      distinctKey,
    ]);
    expect(generated.draft?.id).toBe(repeatedResult.draft?.id);
    expect(generated.draft?.id).toBe(distinctResult.draft?.id);
    expect(app.inspectState().briefDrafts).toHaveLength(1);
    expect(generated.draft?.sections.map(({ id }) => id)).toEqual(
      BRIEF_SECTION_IDS,
    );
    expect(generated.operation).toMatchObject({
      status: "succeeded",
      inputTokens: 30,
      outputTokens: 20,
    });
  });

  it("generates after deliberate immediate early completion using Project Description as direct evidence", async () => {
    const { app, freelancer, room } = await createBriefHarness({
      skipAnswer: true,
    });
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-zero-answer" },
    );
    expect(
      generated.draft?.sections.find(
        ({ id }) => id === "executive-summary",
      )?.sources,
    ).toEqual([{ type: "project_description" }]);
  });

  it("repairs invented requirements and retries provider interruption without duplicating a draft", async () => {
    const generator = {
      generate: vi
        .fn<
          NonNullable<
            ProjectBriefAdapters["generator"]
          >["generate"]
        >()
        .mockImplementationOnce(async (input) => {
          const draft = draftFromInput(input);
          draft.sections
            .find(({ id }) => id === "functional-requirements")!
            .items.push({
              kind: "requirement",
              text: "An invented requirement.",
              scopeStatus: "in_scope",
              priority: null,
              sources: [],
            });
          return draft;
        })
        .mockImplementationOnce(async (input) =>
          draftFromInput(input),
        ),
    };
    const repairedHarness = await createBriefHarness({ generator });
    const repaired = await repairedHarness.app.briefs.generate(
      repairedHarness.freelancer,
      repairedHarness.room.id,
      { idempotencyKey: "repair-brief" },
    );
    expect(repaired.draft).not.toBeNull();
    expect(generator.generate.mock.calls[1]?.[0].repairErrors).toEqual([
      "Project Brief item is invalid or untraceable.",
    ]);

    const interruptedGenerator = {
      generate: vi
        .fn<
          NonNullable<
            ProjectBriefAdapters["generator"]
          >["generate"]
        >()
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockImplementationOnce(async (input) =>
          draftFromInput(input),
        ),
    };
    const interrupted = await createBriefHarness({
      generator: interruptedGenerator,
    });
    await expect(
      interrupted.app.briefs.generate(
        interrupted.freelancer,
        interrupted.room.id,
        { idempotencyKey: "retry-brief" },
      ),
    ).rejects.toThrow(/provider unavailable/i);
    expect(
      await interrupted.app.briefs.get(
        interrupted.freelancer,
        interrupted.room.id,
      ),
    ).toMatchObject({
      draft: null,
      operation: { status: "retryable" },
    });
    const retried =
      await interrupted.app.briefs.retryGeneration(
        interrupted.freelancer,
        interrupted.room.id,
      );
    expect(retried).toMatchObject({
      draft: { revision: 1 },
      operation: { status: "succeeded", attemptCount: 2 },
    });
  });

  it("repairs unsupported substantive section prose instead of accepting an untraceable claim", async () => {
    const generator = {
      generate: vi
        .fn<
          NonNullable<
            ProjectBriefAdapters["generator"]
          >["generate"]
        >()
        .mockImplementationOnce(async (input) => {
          const draft = draftFromInput(input);
          const commercial = draft.sections.find(
            ({ id }) => id === "delivery-and-commercial",
          )!;
          commercial.content =
            "Delivery is guaranteed by 30 June for €20,000.";
          commercial.sources = [];
          return draft;
        })
        .mockImplementationOnce(async (input) =>
          draftFromInput(input),
        ),
    };
    const { app, freelancer, room } = await createBriefHarness({
      generator,
    });
    const repaired = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "repair-prose" },
    );
    expect(repaired.draft).not.toBeNull();
    expect(generator.generate.mock.calls[1]?.[0].repairErrors).toEqual([
      "Project Brief section contains unauthorized evidence.",
    ]);
  });

  it("rejects a fabricated locator for an otherwise authorized material", async () => {
    const generator = {
      generate: vi
        .fn<
          NonNullable<
            ProjectBriefAdapters["generator"]
          >["generate"]
        >()
        .mockImplementationOnce(async (input) => {
          const draft = draftFromInput(input);
          draft.sections
            .find(
              ({ id }) =>
                id === "targets-and-external-constraints",
            )!
            .items.push({
              kind: "target",
              text: "Launch in October.",
              sources: [
                {
                  type: "material",
                  materialId:
                    input.contextPack!.includedMaterialIds[0]!,
                  locator: {
                    kind: "paragraph",
                    label: "Paragraph 999",
                    paragraph: 999,
                  },
                },
              ],
            });
          return draft;
        })
        .mockImplementationOnce(async (input) => {
          const draft = draftFromInput(input);
          draft.sections
            .find(
              ({ id }) =>
                id === "targets-and-external-constraints",
            )!
            .items.push({
              kind: "target",
              text: "Launch in October.",
              sources: [
                {
                  type: "material",
                  materialId:
                    input.contextPack!.includedMaterialIds[0]!,
                  locator: {
                    paragraph: 1,
                    label: "Paragraph 1",
                    kind: "paragraph",
                  },
                },
              ],
            });
          return draft;
        }),
    };
    const { app, freelancer, room } = await createBriefHarness({
      generator,
      withMaterial: true,
      language: "de",
    });
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "fabricated-locator" },
    );
    expect(generated.draft).not.toBeNull();
    expect(generator.generate.mock.calls[1]?.[0].repairErrors).toEqual([
      "Project Brief item is invalid or untraceable.",
    ]);
    const materialSource = generated.draft!.sections
      .flatMap(({ items }) => items)
      .flatMap(({ sources }) => sources)
      .find(({ type }) => type === "material")!;
    if (materialSource.type !== "material") {
      throw new Error("Expected material evidence.");
    }
    await app.materials.remove(
      freelancer,
      room.id,
      materialSource.materialId,
    );
    expect(
      await app.briefs.inspectSource(
        freelancer,
        room.id,
        materialSource,
      ),
    ).toMatchObject({ unavailable: true, text: "" });
    const markdown = await app.briefs.exportMarkdown(
      freelancer,
      room.id,
      { artifactId: generated.draft!.id },
    );
    expect(markdown).toContain(
      "Der zitierte Quellenauszug ist nicht verfügbar.",
    );
    expect(markdown).not.toContain(
      "The cited source excerpt is unavailable.",
    );
  });

  it("supports structured edits, source retention, reclassification, ordering, and warning resolution", async () => {
    const { app, freelancer, room } = await createBriefHarness();
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-edit" },
    );
    const requirement =
      generated.draft!.sections
        .find(({ id }) => id === "functional-requirements")!
        .items[0]!;
    const activityBeforeEdit = (
      await app.rooms.get(freelancer, room.id)
    ).lastActivityAt;

    const editedSection = await app.briefs.updateSection(
      freelancer,
      room.id,
      {
        sectionId: "executive-summary",
        content: "A focused portal for Alpine.",
      },
    );
    expect(
      editedSection.draft?.sections.find(
        ({ id }) => id === "executive-summary",
      )?.content,
    ).toBe("A focused portal for Alpine.");
    expect(
      (await app.rooms.get(freelancer, room.id)).lastActivityAt,
    ).toBeGreaterThan(activityBeforeEdit);
    const sourceTrimmed = await app.briefs.updateSection(
      freelancer,
      room.id,
      {
        sectionId: "executive-summary",
        content: "A focused portal for Alpine.",
        retainSourceKeys: [],
      },
    );
    expect(
      sourceTrimmed.draft?.sections
        .find(({ id }) => id === "executive-summary")
        ?.sources.some(
          ({ type }) => type === "project_description",
        ),
    ).toBe(false);

    const added = await app.briefs.addItem(freelancer, room.id, {
      sectionId: "functional-requirements",
      kind: "requirement",
      text: "Administrators must be able to revoke access.",
      scopeStatus: "in_scope",
    });
    const freelancerItem =
      added.draft!.sections
        .find(({ id }) => id === "functional-requirements")!
        .items.at(-1)!;
    expect(freelancerItem.sources).toEqual([
      expect.objectContaining({ type: "freelancer_edit" }),
    ]);

    const updated = await app.briefs.updateItem(
      freelancer,
      room.id,
      {
        itemId: requirement.id,
        sectionId: "out-of-scope",
        kind: "requirement",
        text: requirement.text,
        scopeStatus: "out_of_scope",
        priority: null,
        retainSourceKeys: requirement.sources.map(briefSourceKey),
      },
    );
    expect(
      updated.draft?.sections
        .find(({ id }) => id === "out-of-scope")
        ?.items.find(({ id }) => id === requirement.id),
    ).toMatchObject({
      scopeStatus: "out_of_scope",
      sources: expect.arrayContaining(requirement.sources),
    });

    const withEdit = await app.briefs.updateItem(
      freelancer,
      room.id,
      {
        itemId: requirement.id,
        sectionId: "out-of-scope",
        kind: "requirement",
        text: `${requirement.text} For workforce identities.`,
        scopeStatus: "out_of_scope",
        priority: null,
        retainSourceKeys: requirement.sources.map(briefSourceKey),
      },
    );
    const editedRequirement = withEdit.draft!.sections
      .find(({ id }) => id === "out-of-scope")!
      .items.find(({ id }) => id === requirement.id)!;
    const editSource = editedRequirement.sources.find(
      ({ type }) => type === "freelancer_edit",
    )!;
    const retainedOnce = await app.briefs.updateItem(
      freelancer,
      room.id,
      {
        itemId: requirement.id,
        sectionId: "out-of-scope",
        kind: "requirement",
        text: editedRequirement.text,
        scopeStatus: "out_of_scope",
        priority: null,
        retainSourceKeys: [briefSourceKey(editSource)],
      },
    );
    const retainedTwice = await app.briefs.updateItem(
      freelancer,
      room.id,
      {
        itemId: requirement.id,
        sectionId: "out-of-scope",
        kind: "requirement",
        text: editedRequirement.text,
        scopeStatus: "out_of_scope",
        priority: null,
        retainSourceKeys: retainedOnce.draft!.sections
          .flatMap(({ items }) => items)
          .find(({ id }) => id === requirement.id)!
          .sources.map(briefSourceKey),
      },
    );
    const onceSources = retainedOnce.draft!.sections
      .flatMap(({ items }) => items)
      .find(({ id }) => id === requirement.id)!.sources;
    expect(onceSources).toContainEqual(editSource);
    expect(
      retainedTwice.draft!.sections
        .flatMap(({ items }) => items)
        .find(({ id }) => id === requirement.id)!.sources,
    ).toEqual(onceSources);

    await app.briefs.moveItem(freelancer, room.id, {
      itemId: freelancerItem.id,
      direction: "up",
    });
    const warnings = (await app.briefs.get(freelancer, room.id))
      .draft!.warnings;
    for (const warning of warnings) {
      await app.briefs.resolveWarning(freelancer, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Explicitly retained for Client review.",
      });
    }
    expect(
      (await app.briefs.get(freelancer, room.id)).draft?.warnings.every(
        ({ status }) => status !== "unresolved",
      ),
    ).toBe(true);
  });

  it("requires explicit review for commercial, timeline, responsibility, feasibility, and materially changed warnings", async () => {
    const { app, freelancer, room } = await createBriefHarness();
    let view = await app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "brief-warning-gates",
    });
    const initialWarnings = view.draft!.warnings.map(
      ({ category, message }) => `${category}:${message}`,
    );
    expect(new Set(initialWarnings).size).toBe(
      initialWarnings.length,
    );
    for (const text of [
      "The budget is fixed at €20,000.",
      "The launch deadline is 30 June.",
      "The Client owns production incident response.",
    ]) {
      view = await app.briefs.addItem(freelancer, room.id, {
        sectionId: "delivery-and-commercial",
        kind: "parameter",
        text,
      });
    }
    view = await app.briefs.addItem(freelancer, room.id, {
      sectionId: "targets-and-external-constraints",
      kind: "target",
      text: "Support 10,000 active users.",
    });
    const categories = new Set(
      view.draft!.warnings.map(({ category }) => category),
    );
    for (const category of [
      "scope",
      "budget",
      "timeline",
      "responsibility",
      "feasibility",
    ] as const) {
      expect([...categories]).toContain(category);
    }
    const scopeWarning = view.draft!.warnings.find(
      ({ category }) => category === "scope",
    )!;
    await app.briefs.resolveWarning(freelancer, room.id, {
      warningId: scopeWarning.id,
      resolution: "acknowledged",
      note: "Explicitly open.",
    });
    const subject = view.draft!.sections
      .flatMap(({ items }) => items)
      .find(({ id }) => id === scopeWarning.subjectId)!;
    const changed = await app.briefs.updateItem(
      freelancer,
      room.id,
      {
        itemId: subject.id,
        sectionId: subject.sectionId,
        kind: subject.kind,
        text: `${subject.text} This wording changed.`,
        ...(subject.scopeStatus
          ? { scopeStatus: subject.scopeStatus }
          : {}),
        priority: subject.priority,
        retainSourceKeys: subject.sources.map(briefSourceKey),
      },
    );
    expect(
      changed.draft!.warnings.find(
        ({ id }) => id === scopeWarning.id,
      )?.status,
    ).toBe("unresolved");
    await expect(
      app.briefs.sendForReview(freelancer, room.id),
    ).rejects.toThrow(/warning/i);
  });

  it("keeps a canonical critical-finding warning after its linked item is reclassified", async () => {
    const { app, dependencies, freelancer, room } =
      await createBriefHarness();
    const initialState = app.inspectState();
    const seed = initialState.discoveryFindings[0]!;
    const gap = {
      ...seed,
      id: "critical-gap-finding",
      type: "gap" as const,
      statement: "Production incident ownership is not established.",
      status: "active" as const,
    };
    initialState.discoveryFindings.push(gap);
    const restored = createProjectInterviewer({
      ...dependencies,
      initialState,
      briefGenerator: {
        generate: async (input) => {
          const draft = draftFromInput(input);
          draft.sections
            .find(
              ({ id }) => id === "gaps-and-contradictions",
            )!
            .items.push({
              kind: "gap",
              text: gap.statement,
              sources: gap.sources,
              findingId: gap.id,
            });
          return draft;
        },
      },
    });
    const actor =
      await restored.identities.resumeFreelancer(
        freelancer.freelancerId,
      );
    const generated = await restored.briefs.generate(
      actor,
      room.id,
      { idempotencyKey: "critical-gap-reclassification" },
    );
    const gapItem = generated.draft!.sections
      .flatMap(({ items }) => items)
      .find(({ findingId }) => findingId === gap.id)!;
    const reclassified = await restored.briefs.updateItem(
      actor,
      room.id,
      {
        itemId: gapItem.id,
        sectionId: "key-decisions",
        kind: "decision",
        text: gapItem.text,
        priority: null,
        retainSourceKeys: gapItem.sources.map(briefSourceKey),
      },
    );
    const canonicalWarning = reclassified.draft!.warnings.find(
      ({ category, subjectId }) =>
        subjectId === gap.id && category === "critical_gap",
    );
    expect(canonicalWarning).toMatchObject({
      category: "critical_gap",
      status: "unresolved",
    });
    for (const warning of reclassified.draft!.warnings.filter(
      ({ id }) => id !== canonicalWarning!.id,
    )) {
      await restored.briefs.resolveWarning(actor, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Explicitly reviewed.",
      });
    }
    await expect(
      restored.briefs.sendForReview(actor, room.id),
    ).rejects.toThrow(/warning/i);
  });

  it("freezes an immutable Review Version and promotes only its included requirements to Proposed", async () => {
    const { app, freelancer, client, room } =
      await createBriefHarness();
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-send" },
    );
    await expect(
      app.briefs.sendForReview(freelancer, room.id),
    ).rejects.toThrow(/warning|scope/i);
    for (const warning of generated.draft!.warnings) {
      await app.briefs.resolveWarning(freelancer, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Shared as an explicit open point.",
      });
    }

    const sent = await app.briefs.sendForReview(
      freelancer,
      room.id,
    );
    await expect(
      app.briefs.generate(freelancer, room.id, {
        idempotencyKey: "second-draft-during-client-review",
      }),
    ).rejects.toThrow(/freelancer review|client review/i);
    expect(sent.visibleReviewVersion).toMatchObject({
      version: 1,
      status: "awaiting_client",
    });
    expect(
      sent.visibleReviewVersion?.sections
        .flatMap(({ items }) => items)
        .find(({ kind }) => kind === "requirement")
        ?.requirementState,
    ).toBe("proposed");
    expect((await app.rooms.get(client, room.id)).phase).toBe(
      "client_review",
    );

    await expect(
      app.briefs.updateSection(freelancer, room.id, {
        sectionId: "executive-summary",
        content: "Private mutation attempt.",
      }),
    ).rejects.toThrow(/not editable|no private editable/i);
    expect(
      (await app.briefs.get(client, room.id)).visibleReviewVersion
        ?.sections.find(({ id }) => id === "executive-summary")
        ?.content,
    ).toBe("A concise source-linked discovery brief.");
  });

  it("keeps archived Project Rooms read-only at every Freelancer brief mutation boundary", async () => {
    const { app, dependencies, freelancer, room } =
      await createBriefHarness();
    await app.briefs.generate(freelancer, room.id, {
      idempotencyKey: "brief-before-archive",
    });
    const archivedState = app.inspectState();
    archivedState.rooms.find(({ id }) => id === room.id)!.phase =
      "archived";
    const restored = createProjectInterviewer({
      ...dependencies,
      initialState: archivedState,
    });
    const restoredFreelancer =
      await restored.identities.resumeFreelancer(
        freelancer.freelancerId,
      );
    await expect(
      restored.briefs.updateSection(restoredFreelancer, room.id, {
        sectionId: "executive-summary",
        content: "Mutation after archival.",
      }),
    ).rejects.toThrow(/read-only/i);
    await expect(
      restored.briefs.generate(restoredFreelancer, room.id, {
        idempotencyKey: "generation-after-archive",
      }),
    ).rejects.toThrow(/read-only/i);
  });

  it("allows one editable Change Request until acknowledgement creates a private revision path", async () => {
    const { app, freelancer, client, room } =
      await createBriefHarness();
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-change" },
    );
    for (const warning of generated.draft!.warnings) {
      await app.briefs.resolveWarning(freelancer, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Open for review.",
      });
    }
    await app.briefs.sendForReview(freelancer, room.id);

    const created = await app.briefs.submitChangeRequest(
      client,
      room.id,
      { text: "Clarify who can revoke access." },
    );
    const edited = await app.briefs.submitChangeRequest(
      client,
      room.id,
      { text: "Clarify who can revoke access and when." },
    );
    expect(created.activeChangeRequest?.id).toBe(
      edited.activeChangeRequest?.id,
    );
    expect(edited.activeChangeRequest?.revisions).toHaveLength(2);

    const acknowledged =
      await app.briefs.acknowledgeChangeRequest(
        freelancer,
        room.id,
      );
    expect(acknowledged).toMatchObject({
      activeChangeRequest: null,
      changeRequests: [
        {
          status: "acknowledged",
          revisions: [{ version: 1 }, { version: 2 }],
        },
      ],
      draft: {
        basedOnReviewVersionId:
          edited.visibleReviewVersion!.id,
      },
    });
    expect((await app.rooms.get(freelancer, room.id)).phase).toBe(
      "freelancer_review",
    );
    await expect(
      app.briefs.submitChangeRequest(client, room.id, {
        text: "A second request against the same version.",
      }),
    ).rejects.toThrow(/new review version/i);
  });

  it("records exact-version approval and keeps it Client-visible while a private reopened draft changes", async () => {
    const { app, freelancer, client, room } =
      await createBriefHarness();
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-approve" },
    );
    for (const warning of generated.draft!.warnings) {
      await app.briefs.resolveWarning(freelancer, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Open for approval.",
      });
    }
    const sent = await app.briefs.sendForReview(
      freelancer,
      room.id,
    );
    const frozenSections = structuredClone(
      sent.visibleReviewVersion!.sections,
    );
    const requirementId = frozenSections
      .flatMap(({ items }) => items)
      .find(({ kind }) => kind === "requirement")!.id;
    const approved = await app.briefs.approve(client, room.id);
    expect(approved.visibleReviewVersion).toMatchObject({
      id: sent.visibleReviewVersion!.id,
      status: "approved",
      approval: {
        displayName: "Chris",
        deviceId: "client-device",
        agreedRequirementIds: [requirementId],
      },
    });
    expect(approved.visibleReviewVersion?.sections).toEqual(
      frozenSections,
    );

    await app.briefs.reopen(freelancer, room.id);
    await app.briefs.updateSection(freelancer, room.id, {
      sectionId: "executive-summary",
      content: "A private revised summary.",
    });
    const frozenMarkdown = await app.briefs.exportMarkdown(
      freelancer,
      room.id,
      { artifactId: sent.visibleReviewVersion!.id },
    );
    expect(frozenMarkdown).toContain(
      "A concise source-linked discovery brief.",
    );
    expect(frozenMarkdown).not.toContain("A private revised summary.");
    const clientView = await app.briefs.get(client, room.id);
    expect(clientView.draft).toBeNull();
    expect(
      clientView.visibleReviewVersion?.sections.find(
        ({ id }) => id === "executive-summary",
      )?.content,
    ).toBe("A concise source-linked discovery brief.");
  });

  it("exports readable Markdown with a source appendix and no raw storage URLs in English or German", async () => {
    for (const language of ["en", "de"] as const) {
      const { app, freelancer, room } = await createBriefHarness({
        language,
      });
      await app.briefs.generate(freelancer, room.id, {
        idempotencyKey: `brief-export-${language}`,
      });
      const markdown = await app.briefs.exportMarkdown(
        freelancer,
        room.id,
        {
          artifactId: (
            await app.briefs.get(freelancer, room.id)
          ).draft!.id,
        },
      );
      expect(markdown).toMatch(
        language === "de"
          ? /Nicht festgestellt|Quellenanhang/i
          : /Not established|Evidence appendix/i,
      );
      expect(markdown).not.toMatch(
        /(?:storage|blob|file):\/\/|_storage/i,
      );
      if (language === "de") {
        expect(markdown).not.toMatch(
          /Project Description|Interview Turn|Freelancer edit|Reason:/,
        );
        expect(markdown).toContain("Projektbeschreibung");
      }
    }
  });

  it("opens sanitized evidence details through the authorized Brief boundary", async () => {
    const { app, freelancer, client, room } =
      await createBriefHarness();
    const generated = await app.briefs.generate(
      freelancer,
      room.id,
      { idempotencyKey: "brief-evidence" },
    );
    const source =
      generated.draft!.sections
        .flatMap(({ items }) => items)
        .find(({ kind }) => kind === "requirement")!.sources[0]!;
    for (const warning of generated.draft!.warnings) {
      await app.briefs.resolveWarning(freelancer, room.id, {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Open for evidence inspection.",
      });
    }
    await app.briefs.sendForReview(freelancer, room.id);

    expect(
      await app.briefs.inspectSource(client, room.id, source),
    ).toMatchObject({
      label: expect.stringMatching(/interview turn/i),
      text: expect.stringMatching(/single sign-on/i),
    });
  });
});
