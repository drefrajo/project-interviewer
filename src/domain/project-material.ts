import type { Language, RoomActor } from "./project-interviewer";

export type MaterialCategory =
  | "brief"
  | "requirements"
  | "design/reference"
  | "technical"
  | "commercial"
  | "timeline"
  | "other";

export type SourceLocator =
  | { kind: "page"; label: string; page: number }
  | { kind: "slide"; label: string; slide: number }
  | { kind: "sheet"; label: string; sheet: string; range?: string }
  | { kind: "image"; label: string; image: number }
  | { kind: "paragraph"; label: string; paragraph?: number }
  | { kind: "text_range"; label: string; start: number; end: number };

export const sourceLocatorKey = (locator: SourceLocator): string => {
  switch (locator.kind) {
    case "page":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.page,
      ]);
    case "slide":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.slide,
      ]);
    case "sheet":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.sheet,
        locator.range ?? null,
      ]);
    case "image":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.image,
      ]);
    case "paragraph":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.paragraph ?? null,
      ]);
    case "text_range":
      return JSON.stringify([
        locator.kind,
        locator.label,
        locator.start,
        locator.end,
      ]);
  }
};

export interface MaterialSegment {
  text: string;
  locator: SourceLocator;
}

export interface MaterialExtraction {
  language: Language | "mixed" | "unknown";
  method: string;
  segments: MaterialSegment[];
}

export interface FileAnalysisDraft {
  summary: string;
  summaryLanguage: Language;
  primaryCategory: MaterialCategory;
  secondaryCategories: MaterialCategory[];
  confidence: number;
  language: Language | "mixed" | "unknown";
  summarySources?: SourceLocator[];
  signals: Array<{ text: string; locator: SourceLocator }>;
  model: string;
  provider: string;
}

export interface FileAnalyzerInput {
  fileName: string;
  declaredContentType: string;
  outputLanguage: Language;
  redactedText: string;
  segments: MaterialSegment[];
  isImage: boolean;
  image?: {
    bytes: Uint8Array;
    contentType: string;
  };
  repairErrors?: string[];
}

export interface FileAnalysis extends FileAnalysisDraft {
  id: string;
  version: number;
  summarySources: SourceLocator[];
  processingVersion: "material-processing-v1";
  schemaVersion: "file-analysis-v1";
  promptVersion: "software-project-file-analysis-v1";
  extractionMethod: string;
  analyzedAt: number;
}

export type MaterialState =
  | "accepted"
  | "processing"
  | "analyzed"
  | "unsupported"
  | "failed";

export type MaterialStage =
  | "checking_file"
  | "extracting_content"
  | "checking_secrets"
  | "analyzing"
  | "indexing"
  | "complete";

export interface SuspectedSecret {
  kind: string;
  maskedPreview: string;
  locator: SourceLocator;
}

export interface ProjectMaterial {
  id: string;
  roomId: string;
  name: string;
  size: number;
  declaredContentType: string;
  actualContentType?: string;
  fileReference: string;
  uploaderKind: RoomActor["kind"];
  uploaderId: string;
  state: MaterialState;
  stage: MaterialStage;
  active: boolean;
  retryAvailable: boolean;
  includeSuspectedSecrets: boolean;
  suspectedSecrets: SuspectedSecret[];
  extraction?: Omit<MaterialExtraction, "segments">;
  analysis?: FileAnalysis;
  analysisVersions: FileAnalysis[];
  failureCode?: string;
  createdAt: number;
  updatedAt: number;
}

export type ProjectMaterialView = Omit<
  ProjectMaterial,
  "fileReference" | "uploaderId"
> & {
  canIncludeSuspectedSecrets: boolean;
  canRemove: boolean;
};

export interface AnalysisFeedback {
  id: string;
  roomId: string;
  materialId: string;
  explanation: string;
  actorKind: RoomActor["kind"];
  deviceId?: string;
  locator: SourceLocator;
  createdAt: number;
}

export interface MaterialChunk {
  id: string;
  roomId: string;
  materialId: string;
  text: string;
  locator: SourceLocator;
  language: MaterialExtraction["language"];
  vector: number[];
  active: boolean;
  createdAt: number;
}

export interface ContextPackRevision {
  id: string;
  roomId: string;
  revision: number;
  reason:
    | "material_analyzed"
    | "analysis_feedback_added"
    | "material_removed"
    | "continued_without_material";
  subjectMaterialId?: string;
  globalProjectSummary: string;
  likelyProjectType: string | null;
  notableSignals: FileAnalysis["signals"];
  includedMaterialIds: string[];
  materialSummaries: Array<{
    materialId: string;
    fileName: string;
    summary: string;
    summaryLanguage: Language;
    summarySources: SourceLocator[];
    analysisId: string;
    analysisVersion: number;
    category: MaterialCategory;
    confidence: number;
    signals: FileAnalysis["signals"];
    available: boolean;
  }>;
  feedback: AnalysisFeedback[];
  minimalContextWarning: boolean;
  createdAt: number;
}

export interface ProjectMaterialState {
  projectMaterials: ProjectMaterial[];
  materialSegments: Array<
    MaterialSegment & {
      roomId: string;
      materialId: string;
      language: MaterialExtraction["language"];
      active: boolean;
    }
  >;
  analysisFeedback: AnalysisFeedback[];
  materialChunks: MaterialChunk[];
  contextPackRevisions: ContextPackRevision[];
}

export interface MaterialLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxRoomBytes: number;
}

export const DEFAULT_MATERIAL_LIMITS: MaterialLimits = {
  maxFiles: 20,
  maxFileBytes: 25 * 1024 * 1024,
  maxRoomBytes: 100 * 1024 * 1024,
};

export const supportedMaterialTypes: Record<
  string,
  { contentTypes: string[]; kind: "text" | "document" | "image" }
> = {
  pdf: { contentTypes: ["application/pdf"], kind: "document" },
  docx: {
    contentTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    kind: "document",
  },
  pptx: {
    contentTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    kind: "document",
  },
  xlsx: {
    contentTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    kind: "document",
  },
  csv: { contentTypes: ["text/csv", "application/csv"], kind: "text" },
  txt: { contentTypes: ["text/plain"], kind: "text" },
  md: {
    contentTypes: ["text/markdown", "text/plain"],
    kind: "text",
  },
  markdown: {
    contentTypes: ["text/markdown", "text/plain"],
    kind: "text",
  },
  png: { contentTypes: ["image/png"], kind: "image" },
  jpg: { contentTypes: ["image/jpeg"], kind: "image" },
  jpeg: { contentTypes: ["image/jpeg"], kind: "image" },
  webp: { contentTypes: ["image/webp"], kind: "image" },
};

export const fileExtension = (fileName: string): string =>
  fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "";

export class UnsupportedMaterialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMaterialError";
  }
}
