import type { ReactNode } from "react";
import {
  dangerButton,
  primaryButton,
  secondaryButton,
} from "./form-controls";

export const ConfirmDialog = ({
  open,
  title,
  children,
  cancelLabel = "Cancel",
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) => {
  if (!open) return null;
  return (
    <div
      aria-labelledby="confirmation-title"
      aria-modal="true"
      className="fixed inset-0 z-30 grid place-items-center bg-overlay p-4"
      role="dialog"
    >
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-box border border-line bg-surface p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-extrabold" id="confirmation-title">
          {title}
        </h2>
        <div className="mt-3 leading-7 text-muted">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className={secondaryButton} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={danger ? dangerButton : primaryButton}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
