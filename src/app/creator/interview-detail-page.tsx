import { useAction, useMutation, useQuery } from "convex/react";
import {
  Copy,
  Download,
  Pencil,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  interviewApi,
} from "../../infrastructure/interview-api";
import { ConfirmDialog } from "../shared/confirm-dialog";
import {
  dangerButton,
  primaryButton,
  secondaryButton,
} from "../shared/form-controls";
import { OperationFeedback } from "../shared/operation-feedback";
import { ImageLightbox } from "../shared/image-lightbox";
import { SafeMarkdown } from "../shared/safe-markdown";
import {
  visualDirectionMarkdown,
  VisualDirectionSummary,
} from "../shared/visual-direction-summary";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";

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

const downloadText = (filename: string, content: string) => {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const InterviewDetailPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const { interviewId = "" } = useParams();
  const navigate = useNavigate();
  const interview = useQuery(interviewApi.interviews.get, { interviewId });
  const transcript = useQuery(interviewApi.transcripts.listForCreator, {
    interviewId,
  });
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <header className="flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {text.interviews.status[interview.status]} · {text.interviews.step[interview.step]}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold">
            {interview.projectName}
          </h1>
          <p className="mt-3 text-muted">
            {text.detail.language[interview.clientLanguage]} · GPT-5.6 Terra
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
      <section className="mt-7 rounded-xl border border-forest/30 bg-soft p-5">
        <h2 className="font-display text-2xl font-extrabold">
          {passState === "unreserved"
            ? text.detail.reservationTitle
            : text.detail.reservationReady}
        </h2>
        <p className="mt-2 max-w-3xl leading-7 text-muted">
          {passState === "unreserved"
            ? text.detail.reservationDescription
            : passState === "consumed"
              ? text.detail.passConsumed
              : text.detail.reservationReady}
        </p>
        {passState === "unreserved" ? (
          balance === undefined ? (
            <p className="mt-4 text-sm font-bold text-muted" role="status">
              {text.detail.checkingBalance}
            </p>
          ) : balance && balance.availablePasses > 0 ? (
            <button
              className={`${primaryButton} mt-4`}
              disabled={busy}
              onClick={() => setConfirmReservation(true)}
              type="button"
            >
              {text.detail.reserveAndCopyLink}
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-error-text">
                {text.detail.insufficientBalance}
              </p>
              <Link className={secondaryButton} to="/billing">
                {text.detail.buyPasses}
              </Link>
            </div>
          )
        ) : passState === "reserved" ? (
          <button
            className={`${secondaryButton} mt-4`}
            disabled={busy}
            onClick={() => setConfirmDeactivation(true)}
            type="button"
          >
            {text.detail.deactivateInterview}
          </button>
        ) : null}
      </section>
      <section className="mt-7 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-extrabold">
          {text.detail.interviewLink}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {text.detail.linkDescription}
        </p>
        {interviewUrl ? (
          <code className="mt-4 block overflow-x-auto rounded-lg bg-soft p-3 text-sm">
            {interviewUrl}
          </code>
        ) : (
          <p className="mt-4 text-sm font-bold text-muted">
            {text.detail.linkUnavailable}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className={primaryButton}
            disabled={!interviewUrl}
            onClick={async () => {
              await navigator.clipboard.writeText(interviewUrl);
              setCopied(true);
            }}
            type="button"
          >
          <Copy aria-hidden="true" size={17} /> {copied ? text.detail.copied : text.detail.copyLink}
          </button>
          <button
            className={secondaryButton}
            disabled={busy || !interviewUrl}
            onClick={() =>
              void perform(async () => {
                if (
                  !window.confirm(
                    text.detail.confirmRegenerate,
                  )
                ) {
                  return;
                }
                const result = await rotate({ interviewId });
                setRotatedUrl(linkFrom(result) ?? "");
                setCopied(false);
              })
            }
            type="button"
          >
            <RotateCw aria-hidden="true" size={17} /> {text.detail.regenerateLink}
          </button>
        </div>
      </section>
      <section className="mt-7 rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold">
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
      <div className="mt-7">
        {interview.status === "submitted" && interview.operation ? (
          <section className="rounded-xl border border-line bg-surface p-5">
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
        ) : (
          <OperationFeedback
            language={language}
            onRetry={() => void perform(() => retry({ interviewId }))}
            operation={interview.operation}
          />
        )}
      </div>
      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold">
              {text.detail.handoffArtifacts}
            </h2>
            <p className="mt-2 text-muted">
              {text.detail.handoffDescription}
            </p>
          </div>
          {interview.status === "submitted" ? (
            <button
              className={primaryButton}
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const manifest = await getDownload({ interviewId });
                  const anchor = document.createElement("a");
                  anchor.href = manifest.url;
                  anchor.download = manifest.filename;
                  anchor.click();
                })
              }
              type="button"
            >
              <Download aria-hidden="true" size={17} /> {text.detail.downloadZip}
            </button>
          ) : null}
        </div>
        {interview.projectDocument ? (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-extrabold">
                {text.detail.projectDocument}
              </h3>
              <button
                className={secondaryButton}
                onClick={() =>
                  downloadText(
                    `${interview.projectName}-project-document.md`,
                    interview.projectDocument ?? "",
                  )
                }
                type="button"
              >
                <Download aria-hidden="true" size={16} /> {text.detail.downloadMarkdown}
              </button>
            </div>
            <SafeMarkdown markdown={interview.projectDocument} />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-line p-5 text-muted">
            {text.detail.documentPending}
          </p>
        )}
        {interview.concepts?.length ? (
          <div className="mt-7">
            <h3 className="font-display text-2xl font-extrabold">
              {text.detail.visualConcepts}
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {interview.concepts.map((concept) => (
                <figure className="overflow-hidden rounded-xl border border-line bg-surface" key={concept.id}>
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
                      <p className="mt-1 text-sm leading-6 text-muted">{concept.description}</p>
                    ) : null}
                    {concept.imageUrl ? (
                      <a
                        className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-forest"
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
        {interview.visualDirection ? (
          <section className="mt-7 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-extrabold">
                {text.detail.visualDirection}
              </h3>
              <button
                className={secondaryButton}
                onClick={() =>
                  downloadText(
                    `${interview.projectName}-visual-direction.md`,
                    visualDirectionMarkdown(
                      interview.visualDirection!,
                      interview.concepts ?? [],
                    ),
                  )
                }
                type="button"
              >
                <Download aria-hidden="true" size={16} /> {text.detail.downloadMarkdown}
              </button>
            </div>
            <VisualDirectionSummary
              concepts={interview.concepts ?? []}
              direction={interview.visualDirection}
              language={language}
            />
          </section>
        ) : null}
      </section>
      <details className="mt-10 rounded-xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-display text-2xl font-extrabold">
          {text.detail.transcript}
        </summary>
        <div className="mt-4 flex justify-end">
          <button
            className={secondaryButton}
            onClick={() =>
              downloadText(
                `${interview.projectName}-transcript.md`,
                (transcript ?? [])
                  .map(
                    (message) =>
                    `## ${message.role === "client" ? text.detail.client : text.detail.interviewModel}\n\n${message.content}`,
                  )
                  .join("\n\n"),
              )
            }
            type="button"
          >
          <Download aria-hidden="true" size={16} /> {text.detail.downloadMarkdown}
          </button>
        </div>
        <ol className="mt-5 space-y-4">
          {(transcript ?? []).map((message) => (
            <li className="border-l-4 border-line pl-4" key={message.id}>
              <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
                {message.role}
              </p>
              <div className="mt-1 whitespace-pre-wrap leading-7">{message.content}</div>
            </li>
          ))}
        </ol>
      </details>
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
