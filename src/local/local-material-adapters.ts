import type {
  FileAnalysisDraft,
  FileAnalyzerInput,
  MaterialExtraction,
  MaterialSegment,
} from "../domain/project-material";

const DATABASE = "project-interviewer-local";
const FILE_STORE = "project-material";

export interface LocalMaterialFileStore {
  save(
    file: File,
    scope: { roomId: string; uploaderId: string },
  ): Promise<string>;
  inspect(
    reference: string,
    scope: {
      roomId: string;
      uploaderId: string;
      claimedSize: number;
      declaredContentType: string;
    },
  ): Promise<{ size: number; contentType: string }>;
  read(
    reference: string,
    scope: { roomId: string; uploaderId: string },
  ): Promise<Uint8Array>;
  remove(
    reference: string,
    scope: { roomId: string; uploaderId: string },
  ): Promise<void>;
}

interface StoredLocalMaterial {
  blob: Blob;
  roomId: string;
  uploaderId: string;
}

export const createLocalMaterialFileStore = (): LocalMaterialFileStore => ({
  async save(file, scope) {
    const reference = crypto.randomUUID();
    const database = await openDatabase();
    await transactionPromise(
      database,
      "readwrite",
      (store) =>
        store.put(
          {
            blob: file,
            roomId: scope.roomId,
            uploaderId: scope.uploaderId,
          } satisfies StoredLocalMaterial,
          reference,
        ),
    );
    return reference;
  },

  async inspect(reference, scope) {
    const stored = await readStoredMaterial(reference);
    requireStoredScope(stored, scope);
    return {
      size: stored.blob.size,
      contentType: stored.blob.type,
    };
  },

  async read(reference, scope) {
    const stored = await readStoredMaterial(reference);
    requireStoredScope(stored, scope);
    return new Uint8Array(await stored.blob.arrayBuffer());
  },

  async remove(reference, scope) {
    const stored = await readStoredMaterial(reference);
    requireStoredScope(stored, scope);
    const database = await openDatabase();
    await transactionPromise(
      database,
      "readwrite",
      (store) => store.delete(reference),
    );
  },
});

const readStoredMaterial = async (
  reference: string,
): Promise<StoredLocalMaterial> => {
  const database = await openDatabase();
  const value = await transactionPromise<StoredLocalMaterial | undefined>(
    database,
    "readonly",
    (store) => store.get(reference),
  );
  if (!value?.blob) {
    throw new Error("Local Project Material is unavailable.");
  }
  return value;
};

const requireStoredScope = (
  stored: StoredLocalMaterial,
  scope: { roomId: string; uploaderId: string },
): void => {
  if (
    stored.roomId !== scope.roomId ||
    stored.uploaderId !== scope.uploaderId
  ) {
    throw new Error("Local Project Material ownership does not match.");
  }
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FILE_STORE)) {
        request.result.createObjectStore(FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionPromise = <T = undefined>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_STORE, mode);
    const request = operation(transaction.objectStore(FILE_STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });

export const localParser = {
  async extract(input: {
    name: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<MaterialExtraction> {
    const extension = input.name.split(".").at(-1)?.toLocaleLowerCase();
    switch (extension) {
      case "txt":
      case "md":
      case "markdown":
        return extractPlainText(input.bytes, "plain-text");
      case "csv":
        return extractCsv(input.bytes);
      case "docx":
        return extractDocx(input.bytes);
      case "xlsx":
        return extractWorkbook(input.bytes);
      case "pptx":
        return extractPresentation(input.bytes);
      case "pdf":
        return extractPdf(input.bytes);
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
        return {
          language: "unknown",
          method: "multimodal-image",
          segments: [],
        };
      default:
        throw new Error("No parser is available for this format.");
    }
  },
};

const extractPlainText = (
  bytes: Uint8Array,
  method: string,
): MaterialExtraction => {
  const text = new TextDecoder().decode(bytes);
  const paragraphs = text
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return {
    language: detectLanguage(text),
    method,
    segments: paragraphs.map((paragraph, index) => ({
      text: paragraph,
      locator: {
        kind: "paragraph",
        label: `Paragraph ${index + 1}`,
        paragraph: index + 1,
      },
    })),
  };
};

const extractCsv = (bytes: Uint8Array): MaterialExtraction => {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split(/\r?\n/gu).filter(Boolean);
  return {
    language: detectLanguage(text),
    method: "csv",
    segments: lines.map((line, index) => ({
      text: line,
      locator: {
        kind: "sheet",
        label: `CSV row ${index + 1}`,
        sheet: "CSV",
        range: `${index + 1}:${index + 1}`,
      },
    })),
  };
};

const extractDocx = async (
  bytes: Uint8Array,
): Promise<MaterialExtraction> => {
  const mammoth = await import("mammoth");
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return extractPlainText(new TextEncoder().encode(value), "docx");
};

const extractWorkbook = async (
  bytes: Uint8Array,
): Promise<MaterialExtraction> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "array" });
  const segments: MaterialSegment[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
    });
    rows.forEach((row, rowIndex) => {
      const text = row.join(" | ").trim();
      if (!text) return;
      segments.push({
        text,
        locator: {
          kind: "sheet",
          label: `${sheetName}!${rowIndex + 1}:${rowIndex + 1}`,
          sheet: sheetName,
          range: `${rowIndex + 1}:${rowIndex + 1}`,
        },
      });
    });
  }
  return {
    language: detectLanguage(segments.map(({ text }) => text).join("\n")),
    method: "xlsx",
    segments,
  };
};

const extractPresentation = async (
  bytes: Uint8Array,
): Promise<MaterialExtraction> => {
  const { default: JSZip } = await import("jszip");
  const archive = await JSZip.loadAsync(bytes);
  const slideNames = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right));
  const segments: MaterialSegment[] = [];
  for (const name of slideNames) {
    const slide = slideNumber(name);
    const xml = await archive.file(name)?.async("text");
    if (!xml) continue;
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/gu)]
      .map((match) => decodeXml(match[1] ?? ""))
      .join(" ")
      .trim();
    if (text) {
      segments.push({
        text,
        locator: { kind: "slide", label: `Slide ${slide}`, slide },
      });
    }
  }
  return {
    language: detectLanguage(segments.map(({ text }) => text).join("\n")),
    method: "pptx",
    segments,
  };
};

const extractPdf = async (
  bytes: Uint8Array,
): Promise<MaterialExtraction> => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const segments: MaterialSegment[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (text) {
      segments.push({
        text,
        locator: {
          kind: "page",
          label: `Page ${pageNumber}`,
          page: pageNumber,
        },
      });
    }
  }
  return {
    language: detectLanguage(segments.map(({ text }) => text).join("\n")),
    method: "pdf",
    segments,
  };
};

export const localFileAnalyzer = {
  async analyze(input: FileAnalyzerInput): Promise<FileAnalysisDraft> {
    const availableText = input.segments
      .map(({ text }) => text)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
    const sourceLanguage = detectLanguage(availableText);
    const languageMismatch =
      (sourceLanguage === "de" && input.outputLanguage === "en") ||
      (sourceLanguage === "en" && input.outputLanguage === "de") ||
      sourceLanguage === "mixed";
    const summary = input.isImage
      ? input.outputLanguage === "de"
        ? `${input.fileName} ist ein Bild im Projektmaterial. Für eine visuelle Dateianalyse muss OpenRouter konfiguriert werden.`
        : `${input.fileName} is an image supplied as Project Material. Configure OpenRouter for visual File Analysis.`
      : languageMismatch
        ? input.outputLanguage === "de"
          ? "Die Quelle liegt in einer anderen Sprache vor. Die ursprüngliche Formulierung bleibt in den verknüpften Quellenauszügen erhalten."
          : "The source is in another language. Its original wording remains available in the source-linked excerpts."
        : input.outputLanguage === "de"
        ? availableText
          ? `Quellenauszug: ${availableText.slice(0, 260)}`
          : "Es konnte kein extrahierbarer Text festgestellt werden."
        : availableText
          ? `Source excerpt: ${availableText.slice(0, 260)}`
          : "No extractable text was established.";
    const imageLocator = {
      kind: "image" as const,
      label: "Image 1",
      image: 1,
    };
    const primaryCategory = categorize(
      `${input.fileName} ${availableText}`,
    );
    return {
      summary,
      summaryLanguage: input.outputLanguage,
      summarySources: input.isImage
        ? [imageLocator]
        : input.segments.slice(0, 3).map(({ locator }) => locator),
      primaryCategory,
      secondaryCategories: [],
      confidence: input.isImage ? 0.25 : 0.65,
      language: sourceLanguage,
      signals: input.isImage
        ? [
            {
              text:
                input.outputLanguage === "de"
                  ? "Das Bild wurde als Projektmaterial bereitgestellt."
                  : "The image was supplied as Project Material.",
              locator: imageLocator,
            },
          ]
        : input.segments
            .filter(({ text }) => text.trim())
            .slice(0, 5)
            .map(({ text, locator }) => ({
              text: text.slice(0, 220),
              locator,
            })),
      model: "local-deterministic-file-analyzer",
      provider: "local",
    };
  },
};

export const localEmbeddings = {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array.from<number>({ length: 32 }).fill(0);
      for (const token of text.toLocaleLowerCase().match(/\p{L}+/gu) ?? []) {
        const canonical = multilingualCanonicalToken(token);
        let hash = 0;
        for (const character of canonical) {
          hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
        }
        vector[hash % vector.length] =
          (vector[hash % vector.length] ?? 0) + 1;
      }
      const norm = Math.sqrt(
        vector.reduce((total, value) => total + value ** 2, 0),
      );
      return norm ? vector.map((value) => value / norm) : vector;
    });
  },
};

const multilingualCanonicalToken = (token: string): string =>
  ({
    anforderung: "requirement",
    anforderungen: "requirement",
    requirement: "requirement",
    requirements: "requirement",
    start: "launch",
    launch: "launch",
    lancierung: "launch",
    termin: "date",
    termine: "date",
    date: "date",
    deadline: "deadline",
    frist: "deadline",
    budget: "budget",
    kosten: "budget",
    cost: "budget",
    costs: "budget",
    kunde: "client",
    kundin: "client",
    client: "client",
    integration: "integration",
    schnittstelle: "integration",
    risiko: "risk",
    risiken: "risk",
    risk: "risk",
    risks: "risk",
    oktober: "october",
    october: "october",
  })[token] ?? token;

export const detectActualContentType = async (file: File): Promise<string> =>
  detectActualContentTypeFromBytes(
    file.name,
    file.type,
    new Uint8Array(await file.arrayBuffer()),
  );

export const detectActualContentTypeFromBytes = async (
  name: string,
  declaredContentType: string,
  bytes: Uint8Array,
): Promise<string> => {
  const header = bytes.slice(0, 16);
  const ascii = new TextDecoder("latin1").decode(header);
  if (ascii.startsWith("%PDF")) return "application/pdf";
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "image/png";
  }
  if (header[0] === 0xff && header[1] === 0xd8) return "image/jpeg";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii.startsWith("PK")) {
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(bytes);
    if (archive.file("word/document.xml")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (archive.file("ppt/presentation.xml")) {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    if (archive.file("xl/workbook.xml")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    return "application/zip";
  }
  const extension = name.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "csv") return "text/csv";
  if (extension === "md" || extension === "markdown") {
    return "text/markdown";
  }
  if (extension === "txt") return "text/plain";
  return declaredContentType || "application/octet-stream";
};

const categorize = (
  text: string,
): FileAnalysisDraft["primaryCategory"] => {
  const value = text.toLocaleLowerCase();
  if (/(price|budget|cost|€|\$)/u.test(value)) return "commercial";
  if (/(deadline|timeline|launch|milestone|termin)/u.test(value)) {
    return "timeline";
  }
  if (/(api|database|architecture|integration|technical)/u.test(value)) {
    return "technical";
  }
  if (/(wireframe|mockup|design|brand|layout)/u.test(value)) {
    return "design/reference";
  }
  if (/(must|shall|requirement|anforderung)/u.test(value)) {
    return "requirements";
  }
  return "brief";
};

const detectLanguage = (
  text: string,
): MaterialExtraction["language"] => {
  const german = (text.match(/\b(?:der|die|das|und|für|mit|ist|soll)\b/giu) ?? [])
    .length;
  const english = (text.match(/\b(?:the|and|for|with|is|should|must)\b/giu) ?? [])
    .length;
  if (!german && !english) return "unknown";
  if (german && english) return "mixed";
  return german > english ? "de" : "en";
};

const slideNumber = (name: string): number =>
  Number(name.match(/slide(\d+)\.xml$/u)?.[1] ?? 0);

const decodeXml = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
