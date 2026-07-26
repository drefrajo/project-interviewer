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
      <div className="rounded-lg border border-line bg-white p-4">
        <WorkingIndicator
          label={language === "de" ? "Wird verarbeitet" : "Working"}
          phrases={
            language === "de"
              ? ["Antwort wird vorbereitet…", "Fast fertig…"]
              : ["Preparing the next step…", "Almost there…"]
          }
        />
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-[#e9b29e] bg-[#fff1e7] p-4 text-[#852f21]"
      role="alert"
    >
      <p className="flex gap-2 font-bold">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        {operation.message ??
          (language === "de"
            ? "Dieser Schritt konnte nicht abgeschlossen werden."
            : "This step could not be completed.")}
      </p>
      {onRetry ? (
        <button className={secondaryButton} onClick={onRetry} type="button">
          {language === "de" ? "Erneut versuchen" : "Try again"}
        </button>
      ) : null}
    </div>
  );
};
