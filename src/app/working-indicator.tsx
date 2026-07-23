import { useEffect, useState } from "react";

export const WorkingIndicator = ({
  label,
  phrases,
}: {
  /** Static accessible label for screen readers. */
  label: string;
  /** Friendly phrases rotated while waiting. */
  phrases: readonly string[];
}) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (phrases.length < 2) return undefined;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % phrases.length),
      2_400,
    );
    return () => window.clearInterval(timer);
  }, [phrases.length]);
  return (
    <span className="inline-flex items-center gap-2.5" role="status">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--green)]"
      />
      <span aria-hidden="true">{phrases[index % phrases.length]}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
};
