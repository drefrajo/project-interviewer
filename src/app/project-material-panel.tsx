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
import { detectActualContentType } from "../local/local-material-adapters";
import type { RouteContext } from "./routes";
import { useI18n } from "./i18n";

export const ProjectMaterialPanel = ({
  application,
  actor,
  room,
  materialFileStore,
  onReadinessChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
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
      className="material-panel"
      id="material"
    >
      <div className="material-heading">
        <div>
          <p className="eyebrow">{t("evidenceFirst")}</p>
          <h2 id="project-material-heading">{t("material")}</h2>
          <p>{t("materialPanelIntro")}</p>
        </div>
        <label className={`button primary file-button ${!materialFileStore ? "disabled" : ""}`}>
          <FileUp aria-hidden="true" size={18} />
          {t("addMaterial")}
          <input
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
            aria-label={t("addMaterial")}
            disabled={!materialFileStore}
            multiple
            onChange={upload}
            type="file"
          />
        </label>
      </div>

      <p className="material-limits">{t("materialLimits")}</p>
      <p className="provider-disclosure">
        <ShieldAlert aria-hidden="true" size={17} />
        {t("imageProviderDisclosure")}
      </p>
      {error ? (
        <div className="inline-alert error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {error}
        </div>
      ) : null}

      <div aria-live="polite" className="material-list">
        {uploadingFiles.map((name, index) => (
          <article
            className="material-item"
            key={`${name}-${index}`}
          >
            <div className="material-item-heading">
              <h3>{name}</h3>
              <span className="operation-state">
                {t("uploadingMaterial")}
              </span>
            </div>
          </article>
        ))}
        {materials.map((material) => (
          <article className="material-item" key={material.id}>
            <div className="material-item-heading">
              <div>
                <h3>{material.name}</h3>
                <p>
                  {formatBytes(material.size)} ·{" "}
                  {material.uploaderKind === "freelancer"
                    ? t("uploadedByFreelancer")
                    : t("uploadedByClient")}
                </p>
              </div>
              <span className={`operation-state state-${material.state}`}>
                {material.state === "analyzed" ? (
                  <CheckCircle2 aria-hidden="true" size={15} />
                ) : null}
                {stateLabel(material, t)}
              </span>
            </div>

            {material.analysis ? (
              <div className="analysis-result">
                <div className="analysis-meta">
                  <span>{material.analysis.primaryCategory}</span>
                  <span>
                    {Math.round(material.analysis.confidence * 100)}%{" "}
                    {t("confidence")}
                  </span>
                  <span>{material.analysis.language.toUpperCase()}</span>
                </div>
                <p>{material.analysis.summary}</p>
                <div
                  aria-label={t("summarySources")}
                  className="source-chips"
                >
                  {material.analysis.summarySources.map(
                    (locator, index) => (
                      <span key={`${locator.label}-${index}`}>
                        {locator.label}
                      </span>
                    ),
                  )}
                </div>
                {material.analysis.signals.length ? (
                  <ul className="signal-list">
                    {material.analysis.signals.map((signal) => (
                      <li key={`${signal.locator.label}-${signal.text}`}>
                        <span>{signal.locator.label}</span>
                        {signal.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {material.suspectedSecrets.length ? (
              <div className="secret-warning">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>{t("suspectedSecrets")}</strong>
                  <p>{t("secretMaskingExplanation")}</p>
                  <ul>
                    {material.suspectedSecrets.map((secret) => (
                      <li key={`${secret.locator.label}-${secret.maskedPreview}`}>
                        <code>{secret.maskedPreview}</code> ·{" "}
                        {secret.locator.label}
                      </li>
                    ))}
                  </ul>
                  {!material.includeSuspectedSecrets &&
                  material.canIncludeSuspectedSecrets ? (
                    <>
                      <label className="check-row compact">
                        <input
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
                        className="button ghost"
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

            {material.state === "analyzed" ? (
              <div className="feedback-form">
                <label className="field">
                  <span>{t("analysisFeedback")}</span>
                  <input
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
                <label className="field">
                  <span>{t("feedbackSource")}</span>
                  <select
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
                  className="button ghost"
                  disabled={!feedbackDrafts[material.id]?.trim()}
                  onClick={() => void addFeedback(material.id)}
                  type="button"
                >
                  {t("addFeedback")}
                </button>
              </div>
            ) : null}

            <div className="material-actions">
              {material.retryAvailable ? (
                <button
                  className="button ghost"
                  onClick={() => void retry(material.id)}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={15} /> {t("retry")}
                </button>
              ) : null}
              {material.canRemove ? (
                <button
                  className="button ghost danger"
                  onClick={() => void remove(material.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} /> {t("remove")}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {(!materials.length && !uploadingFiles.length) ||
      (room.interviewReadiness === "waiting_for_material" &&
        materials.every(({ state }) =>
          ["analyzed", "unsupported", "failed"].includes(state),
        )) ? (
        <div className="no-material">
          <p>{t("noMaterialYet")}</p>
          <button
            className="button ghost"
            onClick={() => void continueWithoutFiles()}
            type="button"
          >
            {t("continueWithoutFiles")}
          </button>
        </div>
      ) : null}

      {contextPack ? (
        <div className="context-pack-summary">
          <strong>
            {t("contextPackRevision")} {contextPack.revision}
          </strong>
          <span>{contextPack.reason.replaceAll("_", " ")}</span>
          {contextPack.minimalContextWarning ? (
            <p>{t("minimalContextWarning")}</p>
          ) : null}
          {contextPack.feedback.map((feedback) => (
            <p key={feedback.id}>
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
