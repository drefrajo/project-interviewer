import { describe, expect, it } from "vitest";
import schema from "./schema";

describe("Convex schema", () => {
  it("defines each database index field set only once per table", () => {
    const exported = JSON.parse(
      (schema as unknown as { export(): string }).export(),
    ) as {
      tables: Array<{
        tableName: string;
        indexes: Array<{ indexDescriptor: string; fields: string[] }>;
      }>;
    };
    const duplicates = exported.tables.flatMap(
      ({ tableName, indexes }) => {
        const namesByFields = new Map<string, string>();
        return indexes.flatMap((index) => {
          const fieldKey = JSON.stringify(index.fields);
          const previousName = namesByFields.get(fieldKey);
          namesByFields.set(fieldKey, index.indexDescriptor);
          return previousName
            ? [
                {
                  tableName,
                  fields: index.fields,
                  indexNames: [previousName, index.indexDescriptor],
                },
              ]
            : [];
        });
      },
    );

    expect(duplicates).toEqual([]);
  });
});
