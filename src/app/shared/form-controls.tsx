import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

const control =
  "min-h-11 w-full rounded-field border border-line bg-surface px-3 py-2 text-ink shadow-sm outline-none transition focus:border-primary";

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="grid gap-1.5 text-sm font-bold text-ink">
    <span>{label}</span>
    {children}
    {hint ? <small className="font-normal leading-5 text-muted">{hint}</small> : null}
  </label>
);

export const TextInput = (
  props: InputHTMLAttributes<HTMLInputElement>,
) => <input {...props} className={`${control} ${props.className ?? ""}`} />;

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => (
  <textarea
    {...props}
    className={`${control} ${props.className ?? ""}`}
    ref={ref}
  />
));
TextArea.displayName = "TextArea";

export const Select = (
  props: SelectHTMLAttributes<HTMLSelectElement>,
) => <select {...props} className={`${control} ${props.className ?? ""}`} />;

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-field bg-action px-4 py-2 text-sm font-semibold text-white transition hover:bg-action-strong disabled:cursor-not-allowed disabled:opacity-55";

export const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-field border border-transparent bg-soft px-4 py-2 text-sm font-semibold text-primary transition hover:bg-soft-hover disabled:cursor-not-allowed disabled:opacity-55";

export const dangerButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-field border border-error-border bg-surface px-4 py-2 text-sm font-semibold text-error-text transition hover:bg-error-surface disabled:cursor-not-allowed disabled:opacity-55";

export const softButton =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-field border border-transparent bg-soft px-3 py-2 text-sm font-semibold text-primary no-underline transition hover:bg-soft-hover";

export const textLink =
  "cursor-pointer font-medium text-primary no-underline transition hover:underline";
