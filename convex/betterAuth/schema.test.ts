import { describe, expect, it } from "vitest";
import schema from "./schema";

describe("local Better Auth component schema", () => {
  it("includes the passkey plugin model and lookup indexes", () => {
    const exported = JSON.parse(
      (schema as unknown as { export(): string }).export(),
    ) as {
      tables: Array<{
        tableName: string;
        indexes: Array<{ indexDescriptor: string; fields: string[] }>;
      }>;
    };
    const passkey = exported.tables.find(
      ({ tableName }) => tableName === "passkey",
    );

    expect(passkey).toBeDefined();
    expect(passkey?.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fields: ["userId"] }),
        expect.objectContaining({ fields: ["credentialID"] }),
      ]),
    );
  });
});
