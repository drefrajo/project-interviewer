import { describe, expect, it } from "vitest";
import { canRemoveProjectMaterial } from "./material_removal_access";

describe("Project Material removal access", () => {
  it("allows either room participant to remove terminal failed material", () => {
    expect(
      canRemoveProjectMaterial({
        material: {
          state: "failed",
          uploaderId: "other-actor",
        },
        actor: { kind: "client", actorId: "current-actor" },
        usedInTurn: false,
      }),
    ).toBe(true);
  });

  it("keeps non-uploader removal restricted for active material", () => {
    expect(
      canRemoveProjectMaterial({
        material: {
          state: "accepted",
          uploaderId: "other-actor",
        },
        actor: { kind: "client", actorId: "current-actor" },
        usedInTurn: false,
      }),
    ).toBe(false);
  });

  it("keeps material already used in an Interview Turn under Freelancer control", () => {
    expect(
      canRemoveProjectMaterial({
        material: {
          state: "failed",
          uploaderId: "other-actor",
        },
        actor: { kind: "client", actorId: "current-actor" },
        usedInTurn: true,
      }),
    ).toBe(false);
  });
});
