import { useAction, useMutation, useQuery } from "convex/react";
import {
  Copy,
  Download,
  Ellipsis,
  Link2Off,
  Pencil,
  RotateCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  interviewApi,
  type InterviewStatus,
} from "../../infrastructure/interview-api";
import { ConfirmDialog } from "../shared/confirm-dialog";
import {
  dangerButton,
  primaryButton,
  secondaryButton,
  textLink,
} from "../shared/form-controls";
import { OperationFeedback } from "../shared/operation-feedback";
import { ImageLightbox } from "../shared/image-lightbox";
import { SafeMarkdown } from "../shared/safe-markdown";
import { trackEvent } from "../../infrastructure/analytics";
import { VisualDirectionSummary } from "../shared/visual-direction-summary";
import {
  DocumentFeedback,
  SubmissionFeedback,
} from "./interview-feedback";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { InterviewStatusBadge } from "./interview-status-badge";
import {
  conceptsLabel,
  interviewKindLabel,
  resolveInterviewConfiguration,
} from "./interview-kind-picker";

const linkFrom = (
  result: string | { interviewUrl?: string; linkToken?: string },
) => {
  if (typeof result === "string") {
    return result.startsWith("http")
      ? result
      : `${window.location.origin}/i/${result}`;
  }
  return (
    result.interviewUrl ??
    (result.linkToken
      ? `${window.location.origin}/i/${result.linkToken}`
      : undefined)
  );
};

export const shouldShowDetailStep = (status: InterviewStatus) =>
  status !== "not_started" && status !== "submitted";

const menuItemClass =
  "flex w-full items-center gap-2 rounded-field px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-soft";

const OverflowMenu = ({
  items,
  label,
}: {
  items: Array<{
    danger?: boolean;
    icon: LucideIcon;
    label: string;
    onSelect: () => void;
  }>;
  label: string;
}) => {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details?.open) return;
    const close = () => details.removeAttribute("open");
    const onPointerDown = (event: PointerEvent) => {
      if (!details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });
  return (
    <details className="relative shrink-0" ref={ref}>
      <summary
        aria-label={label}
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-field text-muted transition hover:bg-soft-hover hover:text-ink [&::-webkit-details-marker]:hidden"
        title={label}
      >
        <Ellipsis aria-hidden="true" size={18} />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-box border border-line bg-surface p-1 shadow-lg">
        {items.map((item) => (
          <button
            className={`${menuItemClass} ${item.danger ? "text-error-text" : "text-ink"}`}
            key={item.label}
            onClick={() => {
              ref.current?.removeAttribute("open");
              item.onSelect();
            }}
            type="button"
          >
            <item.icon aria-hidden="true" size={15} /> {item.label}
          </button>
        ))}
      </div>
    </details>
  );
};

export const InterviewDetailPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const { interviewId = "" } = useParams();
  const navigate = useNavigate();
  const interview = useQuery(interviewApi.interviews.get, { interviewId });
  const transcript = useQuery(
    interviewApi.transcripts.listForCreator,
    interview ? { interviewId } : "skip",
  );
  const getDownload = useAction(interviewApi.downloads.getManifest);
  const rotate = useMutation(interviewApi.interviews.rotateLink);
  const reserveLink = useMutation(interviewApi.interviews.reserveLink);
  const deactivate = useMutation(interviewApi.interviews.deactivate);
  const retry = useMutation(interviewApi.interviews.retry);
  const remove = useMutation(interviewApi.interviews.remove);
  const balance = useQuery(interviewApi.billing.getBalance, {});
  const [rotatedUrl, setRotatedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [instructionsCopied, setInstructionsCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReservation, setConfirmReservation] = useState(false);
  const [confirmDeactivation, setConfirmDeactivation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const interviewUrl = useMemo(
    () =>
      rotatedUrl ||
      interview?.interviewUrl ||
      (interview?.linkToken
        ? `${window.location.origin}/i/${interview.linkToken}`
        : ""),
    [interview, rotatedUrl],
  );
  const passState = interview?.passState ?? "unreserved";

  if (interview === undefined) {
    return <DetailLoading label={text.form.formLoading} />;
  }
  if (interview === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">
          {text.detail.unavailable}
        </h1>
      </main>
    );
  }

  const configuration = resolveInterviewConfiguration(interview);

  const perform = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const retentionDate = interview.retentionExpiresAt
    ? new Intl.DateTimeFormat(
        language === "de" ? "de-DE" : "en-GB",
        { dateStyle: "long" },
      ).format(interview.retentionExpiresAt)
    : undefined;
  const linkIsNextStep = interview.status === "not_started";
  const hasExportableContent =
    Boolean(interview.projectDocument) || (transcript?.length ?? 0) > 0;
  const submitted = interview.status === "submitted";

  const linkSection = (
    <section
      className={`rounded-box border p-4 sm:p-5 ${
        linkIsNextStep ? "border-forest/30 bg-soft" : "border-line bg-panel"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold">
            {text.detail.interviewLink}
          </h2>
          {passState !== "consumed" ? (
            <p className="mt-1 text-sm font-bold text-muted">
              {passState === "unreserved"
                ? text.detail.reservationTitle
                : text.detail.reservationReady}
            </p>
          ) : null}
        </div>
        {passState === "unreserved" ? (
          balance === undefined ? (
            <p className="text-sm font-bold text-muted" role="status">
              {text.detail.checkingBalance}
            </p>
          ) : balance && balance.availablePasses > 0 ? (
            <button
              className={`${primaryButton} shrink-0`}
              disabled={busy}
              onClick={() => setConfirmReservation(true)}
              type="button"
            >
              {text.detail.reserveAndCopyLink}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-error-text">
                {text.detail.insufficientBalance}
              </p>
              <Link className={secondaryButton} to="/billing">
                {text.detail.buyPasses}
              </Link>
            </div>
          )
        ) : (
          <OverflowMenu
            items={[
              {
                icon: RotateCw,
                label: text.detail.regenerateLink,
                onSelect: () =>
                  void perform(async () => {
                    if (!window.confirm(text.detail.confirmRegenerate)) {
                      return;
                    }
                    const result = await rotate({ interviewId });
                    setRotatedUrl(linkFrom(result) ?? "");
                    setCopied(false);
                    trackEvent("interview_link_regenerated");
                  }),
              },
              ...(passState === "reserved"
                ? [
                    {
                      danger: true,
                      icon: Link2Off,
                      label: text.detail.deactivateInterview,
                      onSelect: () => setConfirmDeactivation(true),
                    },
                  ]
                : []),
            ]}
            label={text.detail.moreActions}
          />
        )}
      </div>
      {passState === "unreserved" ? (
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          {text.detail.reservationDescription}
        </p>
      ) : null}
      {passState !== "consumed" ? (
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          {text.detail.linkDescription}
        </p>
      ) : null}
      {interviewUrl ? (
        <code className="mt-3 block overflow-x-auto rounded-lg bg-soft-strong p-3 text-sm">
          {interviewUrl}
        </code>
      ) : (
        <p className="mt-3 text-sm font-bold text-muted">
          {text.detail.linkUnavailable}
        </p>
      )}
      {passState !== "unreserved" ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            className={primaryButton}
            disabled={!interviewUrl}
            onClick={async () => {
              await navigator.clipboard.writeText(interviewUrl);
              setCopied(true);
              trackEvent("interview_link_copied");
            }}
            type="button"
          >
            <Copy aria-hidden="true" size={17} />{" "}
            {copied ? text.detail.copied : text.detail.copyLink}
          </button>
        </div>
      ) : null}
    </section>
  );

  const instructionsSection = (
    <section className="rounded-box border border-line bg-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">
            {text.detail.instructions}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {text.detail.instructionsDescription}
          </p>
        </div>
        <button
          className={secondaryButton}
          onClick={() =>
            void perform(async () => {
              await navigator.clipboard.writeText(interview.instructions);
              setInstructionsCopied(true);
            })
          }
          type="button"
        >
          <Copy aria-hidden="true" size={17} />
          {instructionsCopied
            ? text.detail.copied
            : text.detail.copyInstructions}
        </button>
      </div>
      <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-soft p-4 font-sans text-sm leading-6">
        {interview.instructions}
      </pre>
    </section>
  );

  const artifactsSection = (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold">
            {text.detail.handoffArtifacts}
          </h2>
          <p className="mt-2 text-muted">{text.detail.handoffDescription}</p>
        </div>
        <button
          className={primaryButton}
          disabled={busy || !hasExportableContent}
          onClick={() =>
            void perform(async () => {
              const manifest = await getDownload({ interviewId });
              const anchor = document.createElement("a");
              anchor.href = manifest.url;
              anchor.download = manifest.filename;
              anchor.click();
              trackEvent("interview_exported");
            })
          }
          title={hasExportableContent ? undefined : text.detail.exportPending}
          type="button"
        >
          <Download aria-hidden="true" size={17} /> {text.detail.exportEverything}
        </button>
      </div>
      {interview.projectDocument ? (
        <div className="mt-6">
          <h3 className="mb-3 font-display text-2xl font-extrabold">
            {text.detail.projectDocument}
          </h3>
          {submitted ? null : (
            <DocumentFeedback interviewId={interviewId} language={language} />
          )}
          <div className="mt-3 [&_h1]:text-2xl [&_h1]:leading-snug">
            <SafeMarkdown markdown={interview.projectDocument} />
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-box border border-dashed border-line p-5 text-muted">
          {text.detail.documentPending}
        </p>
      )}
      {configuration.includesVisualConcepts && interview.concepts?.length ? (
        <div className="mt-7">
          <h3 className="font-display text-2xl font-extrabold">
            {text.detail.visualConcepts}
          </h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {interview.concepts.map((concept) => (
              <figure className="overflow-hidden rounded-box border border-line bg-panel" key={concept.id}>
                {concept.imageUrl ? (
                  <ImageLightbox
                    alt={`${concept.name}, ${text.detail.roughVisualDirection}`}
                    closeLabel={text.detail.closeImage}
                    openLabel={text.detail.viewImage}
                    src={concept.imageUrl}
                  />
                ) : (
                  <div className="grid aspect-[3/2] place-items-center bg-soft px-5 text-center text-muted">
                    {concept.state === "failed"
                      ? text.detail.generationFailed
                      : text.detail.generating}
                  </div>
                )}
                <figcaption className="p-4">
                  <strong>{concept.name}</strong>
                  {concept.description ? (
                    <p className="mt-1 text-sm leading-6 text-muted"><span className="block font-semibold">{text.detail.conceptPlanningNote}</span>{concept.description}</p>
                  ) : null}
                  {concept.imageUrl ? (
                    <a
                      className={`${textLink} mt-3 inline-flex items-center gap-1 text-sm`}
                      download={`${concept.id}.png`}
                      href={concept.imageUrl}
                    >
                      <Download aria-hidden="true" size={15} /> {text.detail.downloadImage}
                    </a>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      {configuration.includesVisualConcepts && interview.visualDirection ? (
        <section className="mt-7 rounded-box border border-line bg-panel p-5">
          <h3 className="font-display text-xl font-extrabold">
            {text.detail.visualDirection}
          </h3>
          <VisualDirectionSummary
            concepts={interview.concepts ?? []}
            direction={interview.visualDirection}
            language={language}
          />
        </section>
      ) : null}
    </section>
  );

  const emailNotification =
    submitted && interview.operation ? (
      <section className="rounded-box border border-line bg-panel p-5">
        <p className="font-display text-lg font-extrabold">
          {text.detail.emailNotification}
        </p>
        <p className="mt-2 leading-7 text-muted">
          {interview.operation.state === "pending"
            ? text.detail.emailPending
            : interview.operation.message ===
                "EMAIL_CONFIGURATION_MISSING"
              ? text.detail.emailMissing
              : text.detail.emailFailed}
        </p>
        {interview.operation.state === "failed" ? (
          <button
            className={`${secondaryButton} mt-4`}
            disabled={busy}
            onClick={() =>
              void perform(() => retry({ interviewId }))
            }
            type="button"
          >
            <RotateCw aria-hidden="true" size={16} /> {text.detail.retryNotification}
          </button>
        ) : null}
      </section>
    ) : null;

  const transcriptEntries = transcript ?? [];
  const transcriptSection = transcriptEntries.length ? (
    <details className="mt-10 rounded-box border border-line bg-panel p-5">
      <summary className="cursor-pointer font-display text-xl font-extrabold">
        {text.detail.transcript}
      </summary>
      <ol className="mt-5 space-y-4">
        {transcriptEntries.map((message) => (
          <li className="border-l-4 border-line pl-4" key={message.id}>
            <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
              {message.role}
            </p>
            <div className="mt-1 whitespace-pre-wrap leading-7">{message.content}</div>
          </li>
        ))}
      </ol>
    </details>
  ) : null;

  const retentionNote = retentionDate ? (
    <details className="mt-8 rounded-box border border-line bg-panel p-5">
      <summary className="cursor-pointer text-sm font-bold text-muted">
        {text.detail.retentionSummary(retentionDate)}
      </summary>
      <p className="mt-3 max-w-3xl leading-7 text-muted">
        {text.detail.retentionDescription(retentionDate)}
      </p>
    </details>
  ) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <header className="flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <InterviewStatusBadge
              language={language}
              passState={passState}
              status={interview.status}
            />
            {shouldShowDetailStep(interview.status) ? (
              <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                {text.interviews.step[interview.step]}
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-4xl font-extrabold">
            {interview.projectName}
          </h1>
          <p className="mt-3 text-muted">
            {text.detail.language[interview.clientLanguage]} · {interviewKindLabel(
              configuration.interviewKind,
              language,
            )} · {conceptsLabel(configuration.includesVisualConcepts, language)} · GPT-6.1 Sol
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!interview.configurationFrozen ? (
            <Link className={secondaryButton} to={`/interviews/${interviewId}/edit`}>
              <Pencil aria-hidden="true" size={17} /> {text.detail.editConfiguration}
            </Link>
          ) : null}
          <button
            className={dangerButton}
            onClick={() => setConfirmDelete(true)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={17} /> {text.detail.delete}
          </button>
        </div>
      </header>
      {error ? (
        <p className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
          {error}
        </p>
      ) : null}
      {submitted ? (
        <>
          <div className="mt-9">{artifactsSection}</div>
          {emailNotification ? <div className="mt-7">{emailNotification}</div> : null}
          <div className="mt-7">
            <SubmissionFeedback interviewId={interviewId} language={language} />
          </div>
          <div className="mt-9">{linkSection}</div>
          <div className="mt-7">{instructionsSection}</div>
        </>
      ) : (
        <>
          {interview.operation ? (
            <div className="mt-7">
              <OperationFeedback
                language={language}
                onRetry={() => void perform(() => retry({ interviewId }))}
                operation={interview.operation}
              />
            </div>
          ) : null}
          <div className="mt-7">{linkSection}</div>
          <div className="mt-7">{instructionsSection}</div>
          <div className="mt-9">{artifactsSection}</div>
        </>
      )}
      {transcriptSection}
      {retentionNote}
      <ConfirmDialog
        cancelLabel={text.common.cancel}
        confirmLabel={text.detail.deletePermanent}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void perform(async () => {
            await remove({
              interviewId,
              confirmation: interview.projectName,
            });
            navigate("/interviews");
            trackEvent("interview_deleted");
          })
        }
        open={confirmDelete}
        title={text.detail.confirmDelete}
      >
        <p>
          {text.detail.deleteDescription}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        cancelLabel={text.common.cancel}
        confirmLabel={text.detail.reserveAndCopyLink}
        onCancel={() => setConfirmReservation(false)}
        onConfirm={() =>
          void perform(async () => {
            const result = await reserveLink({ interviewId });
            const url = linkFrom(result);
            if (url) {
              setRotatedUrl(url);
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }
            setConfirmReservation(false);
            trackEvent("interview_reserved");
          })
        }
        open={confirmReservation}
        title={text.detail.reservationConfirmTitle}
      >
        <p>
          {text.detail.reservationConfirmDescription(
            balance?.availablePasses ?? 0,
          )}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        cancelLabel={text.common.cancel}
        confirmLabel={text.detail.deactivateInterview}
        onCancel={() => setConfirmDeactivation(false)}
        onConfirm={() =>
          void perform(async () => {
            await deactivate({ interviewId });
            setRotatedUrl("");
            setCopied(false);
            setConfirmDeactivation(false);
            trackEvent("interview_deactivated");
          })
        }
        open={confirmDeactivation}
        title={text.detail.confirmDeactivate}
      >
        <p>{text.detail.deactivateDescription}</p>
      </ConfirmDialog>
    </main>
  );
};

const DetailLoading = ({ label }: { label: string }) => (
  <main className="grid min-h-96 place-items-center" id="main-content">
    <p className="font-bold text-muted" role="status">
      {label}
    </p>
  </main>
);
