import { AlertTriangle } from "lucide-react";
import { WorkingIndicator } from "../working-indicator";
import { secondaryButton } from "./form-controls";

export const OperationFeedback = ({
  operation,
  onRetry,
  language = "en",
  hidePending = false,
}: {
  operation?: { state: "pending" | "failed"; message?: string } | null | undefined;
  onRetry?: () => void;
  language?: "en" | "de";
  hidePending?: boolean;
}) => {
  if (!operation) return null;
  if (operation.state === "pending") {
    if (hidePending) return null;
    return (
      <div className="rounded-box border border-line bg-panel p-4">
        <WorkingIndicator
          label={language === "de" ? "Wird verarbeitet" : "Working"}
          phrases={
            language === "de"
              ? [
                  "Antwort wird vorbereitet…",
                  "Der Gesprächsverlauf wird geprüft…",
                  "Die wichtigsten Details werden zusammengeführt…",
                  "Der nächste Schritt wird formuliert…",
                  "Fast fertig…",
                ]
              : [
                  "Preparing the next step…",
                  "Reviewing the conversation so far…",
                  "Pulling together the key details…",
                  "Shaping the next response…",
                  "Almost there…",
                ]
          }
        />
      </div>
    );
  }
  const fallback =
    language === "de"
      ? "Dieser Schritt konnte nicht abgeschlossen werden."
      : "This step could not be completed.";
  const message =
    operation.message &&
    operation.message !== "Error" &&
    !/^[A-Z0-9_]+$/.test(operation.message)
      ? operation.message
      : fallback;
  return (
    <div
      className="mx-auto mt-4 flex w-full max-w-3xl flex-col items-start gap-3 rounded-lg border border-error-border bg-error-surface p-4 text-error-text"
      role="alert"
    >
      <p className="flex gap-2 font-bold">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        {message}
      </p>
      {onRetry ? (
        <button className={secondaryButton} onClick={onRetry} type="button">
          {language === "de" ? "Erneut versuchen" : "Try again"}
        </button>
      ) : null}
    </div>
  );
};
