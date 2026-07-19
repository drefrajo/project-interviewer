class TextExtractionDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
}

class TextExtractionPath2D {
  addPath() {}
}

export const ensurePdfTextExtractionRuntime = (): void => {
  const globals = globalThis as unknown as Record<string, unknown>;
  if (typeof globals.DOMMatrix !== "function") {
    globals.DOMMatrix = TextExtractionDOMMatrix;
  }
  if (typeof globals.Path2D !== "function") {
    globals.Path2D = TextExtractionPath2D;
  }
};

export const loadPdfJsTextRuntime = async () => {
  ensurePdfTextExtractionRuntime();
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const globals = globalThis as unknown as Record<string, unknown>;
  if (!globals.pdfjsWorker) {
    globals.pdfjsWorker = worker;
  }
  return import("pdfjs-dist/legacy/build/pdf.mjs");
};
