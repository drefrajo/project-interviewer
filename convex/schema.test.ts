import { describe, expect, it } from "vitest";
import schema from "./schema";

describe("application schema", () => {
  it("owns exactly the three domain tables from the refactor", () => {
    const exported = JSON.parse(
      (schema as unknown as { export(): string }).export(),
    ) as { tables: Array<{ tableName: string }> };
    expect(exported.tables.map(({ tableName }) => tableName).sort()).toEqual([
      "creatorProfiles",
      "interviewTemplates",
      "interviews",
    ]);
  });
});
