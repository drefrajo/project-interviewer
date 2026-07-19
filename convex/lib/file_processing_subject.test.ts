import { describe, expect, it } from "vitest";
import { isFileProcessingSubjectInRoom } from "./file_processing_subject";

describe("File Processing subject access", () => {
  it("allows a Client to retry another participant's failed material", () => {
    expect(
      isFileProcessingSubjectInRoom({
        material: { roomId: "room-1" },
        roomId: "room-1",
      }),
    ).toBe(true);
  });

  it("rejects a material from another Project Room", () => {
    expect(
      isFileProcessingSubjectInRoom({
        material: { roomId: "room-2" },
        roomId: "room-1",
      }),
    ).toBe(false);
  });
});
