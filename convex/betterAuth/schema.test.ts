import { describe, expect, it } from "vitest";
import schema from "./schema";

describe("local Better Auth component schema", () => {
  it("supports OAuth sessions without account-linking or passkey tables", () => {
    const exported = JSON.parse(
      (schema as unknown as { export(): string }).export(),
    ) as {
      tables: Array<{
        tableName: string;
        documentType: {
          type: "object";
          value: Record<string, { optional?: boolean }>;
        };
      }>;
    };
    const names = exported.tables.map(({ tableName }) => tableName);
    expect(names).toContain("user");
    expect(names).toContain("account");
    expect(names).toContain("session");
    expect(names).not.toContain("passkey");
    const user = exported.tables.find(({ tableName }) => tableName === "user");
    expect(user?.documentType.value.provider).toEqual(
      expect.objectContaining({ optional: true }),
    );
  });
});
