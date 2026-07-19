import { describe, expect, it } from "vitest";
import { normalizeContextRevisionReason } from "./context_pack_commit";

describe("Context Pack revision reasons", () => {
  it("stores the public material-analysis reason expected by clients", () => {
    expect(normalizeContextRevisionReason("file_analysis_completed")).toBe(
      "material_analyzed",
    );
  });
});
