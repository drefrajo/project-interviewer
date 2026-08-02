import { Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";

export const ImageLightbox = ({
  alt,
  closeLabel,
  openLabel,
  src,
}: {
  alt: string;
  closeLabel: string;
  openLabel: string;
  src: string;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        aria-label={`${openLabel}: ${alt}`}
        className="group relative block w-full cursor-zoom-in text-left"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img alt={alt} className="aspect-[3/2] w-full object-cover" src={src} />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-2 text-xs font-extrabold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 aria-hidden="true" size={14} />
          {openLabel}
        </span>
      </button>
      {open ? (
        <div
          aria-label={alt}
          aria-modal="true"
          className="fixed inset-0 z-40 grid place-items-center bg-black/85 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="dialog"
        >
          <button
            aria-label={closeLabel}
            className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={22} />
          </button>
          <img
            alt={alt}
            className="max-h-[calc(100vh-2rem)] max-w-full object-contain sm:max-h-[calc(100vh-4rem)]"
            src={src}
          />
        </div>
      ) : null}
    </>
  );
};
