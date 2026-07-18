import { describe, expect, it } from "vitest";
import { projectMaterialViewSchema } from "./hosted-dto-schemas";

const materialDto = {
  id: "material_1",
  roomId: "room_1",
  name: "brief.pdf",
  size: 1_024,
  declaredContentType: "application/pdf",
  actualContentType: "application/pdf",
  uploaderKind: "client",
  state: "accepted",
  stage: "checking_file",
  active: true,
  retryAvailable: false,
  includeSuspectedSecrets: false,
  suspectedSecrets: [],
  analysisVersions: [],
  canIncludeSuspectedSecrets: false,
  canRemove: true,
  createdAt: 1,
  updatedAt: 1,
};

describe("hosted Convex DTO decoding", () => {
  it("accepts the public Project Material contract and strips unknown fields", () => {
    const parsed = projectMaterialViewSchema.parse({
      ...materialDto,
      storageId: "must-not-cross-the-browser-boundary",
    });

    expect(parsed).toMatchObject(materialDto);
    expect(parsed).not.toHaveProperty("storageId");
  });

  it("rejects backend drift instead of casting an invalid domain view", () => {
    expect(() =>
      projectMaterialViewSchema.parse({
        ...materialDto,
        stage: "queued",
      }),
    ).toThrow();
    expect(() =>
      projectMaterialViewSchema.parse({
        ...materialDto,
        analysis: {
          id: "analysis_1",
          version: 1,
          summary: "A factual summary.",
          summaryLanguage: "en",
          summarySources: [
            { kind: "page", label: "Page 1", page: 1 },
          ],
          primaryCategory: "invented-category",
          secondaryCategories: [],
          confidence: 0.8,
          language: "en",
          signals: [],
          model: "model",
          provider: "provider",
          processingVersion: "material-processing-v1",
          schemaVersion: "file-analysis-v1",
          promptVersion: "software-project-file-analysis-v1",
          extractionMethod: "pdf",
          analyzedAt: 1,
        },
      }),
    ).toThrow();
  });
});
