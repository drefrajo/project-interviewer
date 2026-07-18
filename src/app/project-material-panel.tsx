import { useEffect, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type {
  ProjectInterviewer,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import type {
  ContextPackRevision,
  ProjectMaterialView,
} from "../domain/project-material";
import { detectActualContentType } from "../application/material-content-type";
import type { RouteContext } from "./routes";
import { useI18n } from "./i18n";

export const ProjectMaterialPanel = ({
  application,
  actor,
  room,
  readOnly,
  materialFileStore,
  onReadinessChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  readOnly: boolean;
  materialFileStore?: RouteContext["materialFileStore"];
  onReadinessChange?(): void;
}) => {
  const { t } = useI18n();
  const [materials, setMaterials] = useState<ProjectMaterialView[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [contextPack, setContextPack] =
    useState<ContextPackRevision | null>(null);
  const [error, setError] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
    {},
  );
  const [feedbackLocatorIndexes, setFeedbackLocatorIndexes] = useState<
    Record<string, number>
  >({});
  const [overrideAcknowledged, setOverrideAcknowledged] = useState<
    Record<string, boolean>
  >({});
  const [secretOverridesInFlight, setSecretOverridesInFlight] =
    useState<Record<string, boolean>>({});
  const [reanalysisInFlight, setReanalysisInFlight] =
    useState<Record<string, boolean>>({});

  const refresh = async () => {
    const [nextMaterials, nextPack] = await Promise.all([
      application.materials.list(actor, room.id),
      application.contextPacks.latest(actor, room.id),
    ]);
    setMaterials(nextMaterials);
    setContextPack(nextPack);
    onReadinessChange?.();
  };

  const beginProgressPolling = (): number =>
    window.setInterval(() => {
      void application.materials
        .list(actor, room.id)
        .then(setMaterials)
        .catch(() => undefined);
    }, 150);

  useEffect(() => {
    void refresh();
    // The actor and room are stable issued identities for this mounted route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application, actor, room.id]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!materialFileStore || !files.length) return;
    setError("");
    setUploadingFiles(files.map(({ name }) => name));
    const accepted = (
      await Promise.all(
        files.map(async (file) => {
          let fileReference = "";
          try {
            const uploaderId =
              actor.kind === "freelancer"
                ? actor.freelancerId
                : actor.deviceId;
            fileReference = await materialFileStore.save(file, {
              roomId: room.id,
              uploaderId,
              actor,
            });
            const material = await application.materials.accept(
              actor,
              room.id,
              {
                name: file.name,
                size: file.size,
                declaredContentType:
                  file.type || contentTypeFromName(file.name),
                actualContentType: await detectActualContentType(file),
                fileReference,
                uploader: actor.kind,
              },
            );
            setMaterials((current) => [material, ...current]);
            setUploadingFiles((current) => {
              const index = current.indexOf(file.name);
              return index < 0
                ? current
                : current.filter(
                    (_, candidateIndex) => candidateIndex !== index,
                  );
            });
            return material;
          } catch (caught) {
            if (fileReference) {
              const uploaderId =
                actor.kind === "freelancer"
                  ? actor.freelancerId
                  : actor.deviceId;
              await materialFileStore
                .remove(fileReference, {
                  roomId: room.id,
                  uploaderId,
                  actor,
                })
                .catch(() => undefined);
            }
            setError(
              caught instanceof Error
                ? caught.message
                : t("materialUploadFailed"),
            );
            setUploadingFiles((current) => {
              const index = current.indexOf(file.name);
              return index < 0
                ? current
                : current.filter(
                    (_, candidateIndex) => candidateIndex !== index,
                  );
            });
            return null;
          }
        }),
      )
    ).filter((material) => material !== null);
    if (accepted.length) {
      onReadinessChange?.();
    }
    const progressTimer = accepted.length
      ? beginProgressPolling()
      : undefined;
    try {
      await Promise.all(
        accepted.map(async (material) => {
          try {
            const processed = await application.materials.process(
              actor,
              room.id,
              material.id,
            );
            setMaterials((current) =>
              current.map((item) =>
                item.id === processed.id ? processed : item,
              ),
            );
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : t("materialUploadFailed"),
            );
          }
        }),
      );
    } finally {
      if (progressTimer !== undefined) {
        window.clearInterval(progressTimer);
      }
    }
    await refresh();
    event.target.value = "";
  };

  const retry = async (materialId: string) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId
          ? {
              ...material,
              state: "processing",
              stage: "extracting_content",
              retryAvailable: false,
            }
          : material,
      ),
    );
    const progressTimer = beginProgressPolling();
    try {
      await application.materials.retry(actor, room.id, materialId);
    } finally {
      window.clearInterval(progressTimer);
      await refresh();
    }
  };

  const remove = async (materialId: string) => {
    await application.materials.remove(actor, room.id, materialId);
    await refresh();
  };

  const reanalyze = async (materialId: string) => {
    if (actor.kind !== "freelancer" || reanalysisInFlight[materialId]) {
      return;
    }
    setReanalysisInFlight((current) => ({
      ...current,
      [materialId]: true,
    }));
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId
          ? { ...material, state: "processing", stage: "analyzing" }
          : material,
      ),
    );
    const progressTimer = beginProgressPolling();
    try {
      await application.materials.reanalyze(actor, room.id, materialId);
    } finally {
      window.clearInterval(progressTimer);
      setReanalysisInFlight((current) => ({
        ...current,
        [materialId]: false,
      }));
      await refresh();
    }
  };

  const includeSecrets = async (materialId: string) => {
    if (secretOverridesInFlight[materialId]) return;
    setSecretOverridesInFlight((current) => ({
      ...current,
      [materialId]: true,
    }));
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId
          ? {
              ...material,
              state: "processing",
              stage: "analyzing",
              retryAvailable: false,
            }
          : material,
      ),
    );
    const progressTimer = beginProgressPolling();
    try {
      await application.materials.includeSuspectedSecrets(
        actor,
        room.id,
        materialId,
        {
          acknowledgedProviderDisclosure:
            overrideAcknowledged[materialId] === true,
        },
      );
    } finally {
      window.clearInterval(progressTimer);
      setSecretOverridesInFlight((current) => ({
        ...current,
        [materialId]: false,
      }));
      await refresh();
    }
  };

  const addFeedback = async (materialId: string) => {
    const material = materials.find(({ id }) => id === materialId);
    const locators = material ? analysisLocators(material) : [];
    const locator =
      locators[feedbackLocatorIndexes[materialId] ?? 0];
    if (!locator) return;
    await application.materials.addFeedback(actor, room.id, materialId, {
      explanation: feedbackDrafts[materialId] ?? "",
      locator,
    });
    setFeedbackDrafts((current) => ({ ...current, [materialId]: "" }));
    await refresh();
  };

  const continueWithoutFiles = async () => {
    await application.materials.continueWithoutFiles(actor, room.id);
    await refresh();
  };

  return (
    <section
      aria-labelledby="project-material-heading"
      className="border border-line bg-surface p-5 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8"
    >
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div>
          <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">{t("evidenceFirst")}</p>
          <h2 className="mb-2 font-display text-3xl font-extrabold tracking-tight text-ink" id="project-material-heading">{t("material")}</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted">{t("materialPanelIntro")}</p>
        </div>
        {!readOnly ? <label className={`relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f] focus-within:outline focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[#255dff] ${!materialFileStore ? "cursor-not-allowed opacity-50" : ""}`}>
          <FileUp aria-hidden="true" size={18} />
          {t("addMaterial")}
          <input
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
            aria-label={t("addMaterial")}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            disabled={!materialFileStore}
            multiple
            onChange={upload}
            type="file"
          />
        </label> : null}
      </div>

      <p className="mt-5 text-sm leading-6 text-muted">{t("materialLimits")}</p>
      <p className="mt-3 flex items-start gap-2 border-l-[3px] border-coral bg-[#fff1e7] p-3 text-sm leading-6 text-ink">
        <ShieldAlert aria-hidden="true" size={17} />
        {t("imageProviderDisclosure")}
      </p>
      {error ? (
        <div className="mt-4 flex items-center gap-2 border-l-4 border-[#c65033] bg-[#fff1e7] p-3 text-sm font-semibold text-[#852f21]" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {error}
        </div>
      ) : null}

      <div aria-live="polite" className="mt-5 grid gap-3">
        {uploadingFiles.map((name, index) => (
          <article
            className="border border-line bg-[#f8f8f4] p-4"
            key={`${name}-${index}`}
          >
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h3 className="font-display text-base font-bold text-ink">{name}</h3>
              <span className="inline-flex items-center bg-[#eef1ec] px-2 py-1 text-[0.68rem] font-extrabold tracking-[0.05em] text-ink uppercase">
                {t("uploadingMaterial")}
              </span>
            </div>
          </article>
        ))}
        {materials.map((material) => (
          <article className="border border-line bg-[#f8f8f4] p-4" key={material.id}>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="break-all font-display text-base font-bold text-ink">{material.name}</h3>
                <p className="mt-1 text-xs text-muted">
                  {formatBytes(material.size)} ·{" "}
                  {material.uploaderKind === "freelancer"
                    ? t("uploadedByFreelancer")
                    : t("uploadedByClient")}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] font-extrabold tracking-[0.05em] uppercase ${
                material.state === "analyzed"
                  ? "bg-[#e5f3df] text-forest"
                  : ["failed", "unsupported"].includes(material.state)
                    ? "bg-[#fff0ec] text-[#852f21]"
                    : "bg-[#eef1ec] text-ink"
              }`}>
                {material.state === "analyzed" ? (
                  <CheckCircle2 aria-hidden="true" size={15} />
                ) : null}
                {stateLabel(material, t)}
              </span>
            </div>

            {material.analysis ? (
              <div className="mt-4 bg-[#f5f6f0] p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="border border-line bg-white px-2 py-1 text-[0.7rem] font-extrabold uppercase">{material.analysis.primaryCategory}</span>
                  <span className="border border-line bg-white px-2 py-1 text-[0.7rem] font-extrabold uppercase">
                    {Math.round(material.analysis.confidence * 100)}%{" "}
                    {t("confidence")}
                  </span>
                  <span className="border border-line bg-white px-2 py-1 text-[0.7rem] font-extrabold uppercase">{material.analysis.language.toUpperCase()}</span>
                </div>
                <p className="leading-6 text-ink">{material.analysis.summary}</p>
                <div
                  aria-label={t("summarySources")}
                  className="mt-3 mb-3 flex flex-wrap gap-1.5"
                >
                  {material.analysis.summarySources.map(
                    (locator, index) => (
                      <span className="bg-[#e3ede8] px-2 py-1 text-[0.7rem] font-extrabold text-forest" key={`${locator.label}-${index}`}>
                        {locator.label}
                      </span>
                    ),
                  )}
                </div>
                {material.analysis.signals.length ? (
                  <ul className="grid list-none gap-2 p-0">
                    {material.analysis.signals.map((signal) => (
                      <li className="grid gap-1 border-t border-line pt-2 text-sm leading-6 text-ink" key={`${signal.locator.label}-${signal.text}`}>
                        <span className="text-[0.7rem] font-extrabold text-forest">{signal.locator.label}</span>
                        {signal.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {material.suspectedSecrets.length ? (
              <div className="mt-4 flex items-start gap-3 bg-[#fff7dc] p-4">
                <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0 text-[#8d5a18]" />
                <div>
                  <strong className="text-ink">{t("suspectedSecrets")}</strong>
                  <p className="mt-1 text-sm leading-6 text-ink">{t("secretMaskingExplanation")}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-ink">
                    {material.suspectedSecrets.map((secret) => (
                      <li key={`${secret.locator.label}-${secret.maskedPreview}`}>
                        <code>{secret.maskedPreview}</code> ·{" "}
                        {secret.locator.label}
                      </li>
                    ))}
                  </ul>
                  {!material.includeSuspectedSecrets &&
                  material.canIncludeSuspectedSecrets &&
                  !readOnly ? (
                    <>
                      <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-ink">
                        <input
                          className="mt-0.5 size-5 shrink-0"
                          checked={
                            overrideAcknowledged[material.id] === true
                          }
                          onChange={(event) =>
                            setOverrideAcknowledged((current) => ({
                              ...current,
                              [material.id]: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{t("secretOverrideDisclosure")}</span>
                      </label>
                      <button
                        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          !overrideAcknowledged[material.id] ||
                          secretOverridesInFlight[material.id]
                        }
                        onClick={() => void includeSecrets(material.id)}
                        type="button"
                      >
                        {secretOverridesInFlight[material.id]
                          ? t("reprocessingMaterial")
                          : t("includeFlaggedText")}
                      </button>
                    </>
                  ) : material.includeSuspectedSecrets ? (
                    <strong>{t("flaggedTextIncluded")}</strong>
                  ) : null}
                </div>
              </div>
            ) : null}

            {material.state === "analyzed" && !readOnly ? (
              <div className="mt-4 grid items-end gap-3 md:grid-cols-[minmax(12rem,2fr)_minmax(9rem,1fr)_auto]">
                <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
                  <span>{t("analysisFeedback")}</span>
                  <input
                    className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
                    onChange={(event) =>
                      setFeedbackDrafts((current) => ({
                        ...current,
                        [material.id]: event.target.value,
                      }))
                    }
                    placeholder={t("feedbackPlaceholder")}
                    value={feedbackDrafts[material.id] ?? ""}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
                  <span>{t("feedbackSource")}</span>
                  <select
                    className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
                    onChange={(event) =>
                      setFeedbackLocatorIndexes((current) => ({
                        ...current,
                        [material.id]: Number(event.target.value),
                      }))
                    }
                    value={feedbackLocatorIndexes[material.id] ?? 0}
                  >
                    {analysisLocators(material).map(
                      (locator, index) => (
                        <option
                          key={`${locator.label}-${index}`}
                          value={index}
                        >
                          {locator.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!feedbackDrafts[material.id]?.trim()}
                  onClick={() => void addFeedback(material.id)}
                  type="button"
                >
                  {t("addFeedback")}
                </button>
              </div>
            ) : null}

            {!readOnly ? <div className="mt-4 flex flex-wrap justify-end gap-2">
              {actor.kind === "freelancer" &&
              material.state === "analyzed" ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={reanalysisInFlight[material.id]}
                  onClick={() => void reanalyze(material.id)}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={15} />{" "}
                  {t("reanalyze")}
                </button>
              ) : null}
              {material.retryAvailable ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white"
                  onClick={() => void retry(material.id)}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={15} /> {t("retry")}
                </button>
              ) : null}
              {material.canRemove ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#e9b29e] bg-transparent px-4 py-2 text-sm font-bold text-[#852f21] hover:bg-[#fff1e7]"
                  onClick={() => void remove(material.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} /> {t("remove")}
                </button>
              ) : null}
            </div> : null}
          </article>
        ))}
      </div>

      {actor.kind === "client" && !readOnly && ((!materials.length && !uploadingFiles.length) ||
      (room.interviewReadiness === "waiting_for_material" &&
        materials.every(({ state }) =>
          ["analyzed", "unsupported", "failed"].includes(state),
        ))) ? (
        <div className="mt-4 border border-dashed border-[#aeb8b1] p-5 text-center">
          <p className="mb-3 text-sm text-muted">{t("noMaterialYet")}</p>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
            onClick={() => void continueWithoutFiles()}
            type="button"
          >
            {t("continueWithoutFiles")}
          </button>
        </div>
      ) : null}

      {contextPack ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 bg-[#e9efe9] p-4 text-sm text-ink">
          <strong>
            {t("contextPackRevision")} {contextPack.revision}
          </strong>
          <span>{contextPack.reason.replaceAll("_", " ")}</span>
          {contextPack.minimalContextWarning ? (
            <p className="basis-full m-0">{t("minimalContextWarning")}</p>
          ) : null}
          {contextPack.feedback.map((feedback) => (
            <p className="basis-full m-0" key={feedback.id}>
              <strong>{t("analysisFeedback")}:</strong>{" "}
              {feedback.explanation}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const stateLabel = (
  material: ProjectMaterialView,
  t: ReturnType<typeof useI18n>["t"],
): string => {
  if (material.state === "failed") return t("materialFailed");
  if (material.state === "unsupported") return t("materialUnsupported");
  if (material.state === "analyzed") return t("materialAnalyzed");
  const stages = {
    checking_file: "checkingFile",
    extracting_content: "extractingContent",
    checking_secrets: "checkingSecrets",
    analyzing: "analyzingMaterial",
    indexing: "indexingMaterial",
    complete: "materialAnalyzed",
  } as const;
  return t(stages[material.stage]);
};

const contentTypeFromName = (name: string): string => {
  const extension = name.split(".").at(-1)?.toLocaleLowerCase();
  return (
    {
      pdf: "application/pdf",
      docx:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xlsx:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
      md: "text/markdown",
      markdown: "text/markdown",
      csv: "text/csv",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    }[extension ?? ""] ?? "application/octet-stream"
  );
};

const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const analysisLocators = (
  material: ProjectMaterialView,
): NonNullable<ProjectMaterialView["analysis"]>["summarySources"] => {
  const candidates = [
    ...(material.analysis?.summarySources ?? []),
    ...(material.analysis?.signals.map(({ locator }) => locator) ?? []),
  ];
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (locator) =>
          JSON.stringify(locator) === JSON.stringify(candidate),
      ) === index,
  );
};
