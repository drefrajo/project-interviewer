import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const control =
  "min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink shadow-sm outline-none transition focus:border-forest";

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

export const TextArea = (
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) => <textarea {...props} className={`${control} ${props.className ?? ""}`} />;

export const Select = (
  props: SelectHTMLAttributes<HTMLSelectElement>,
) => <select {...props} className={`${control} ${props.className ?? ""}`} />;

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-55";

export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-extrabold text-ink transition hover:bg-[#f1f3ed] disabled:cursor-not-allowed disabled:opacity-55";

export const dangerButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#e9b29e] bg-white px-4 py-2 text-sm font-extrabold text-[#852f21] transition hover:bg-[#fff1e7] disabled:cursor-not-allowed disabled:opacity-55";

