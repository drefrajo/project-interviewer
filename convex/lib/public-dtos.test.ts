import { describe, expect, it } from "vitest";
import { clientMaterialDto, clientRoomDto } from "./public_dtos";

describe("Client-safe Convex projections", () => {
  it("does not expose Freelancer-only room guidance or Freelancer identity fields", () => {
    expect(
      clientRoomDto({
        _id: "room_1",
        title: "Website",
        clientLabel: "Acme",
        projectDescription: "A launch",
        briefLanguage: "en",
        phase: "discovery",
        interviewReadiness: "ready",
        lastActivityAt: 1,
        freelancerId: "private-owner",
        freelancerGuidance: "Private pricing concern",
        purgeAfter: 2,
      }),
    ).toEqual({
      id: "room_1",
      title: "Website",
      clientLabel: "Acme",
      projectDescription: "A launch",
      briefLanguage: "en",
      phase: "discovery",
      interviewReadiness: "ready",
      lastActivityAt: 1,
    });
  });

  it("does not expose storage IDs or uploader identity", () => {
    expect(
      clientMaterialDto({
        _id: "material_1",
        name: "brief.pdf",
        size: 10,
        declaredContentType: "application/pdf",
        actualContentType: "application/pdf",
        state: "analyzed",
        stage: "complete",
        active: true,
        retryAvailable: false,
        createdAt: 1,
        updatedAt: 2,
        storageId: "private-storage-id",
        uploaderId: "private-uploader",
      }),
    ).not.toHaveProperty("storageId");
    expect(
      clientMaterialDto({ suspectedSecrets: [] }),
    ).not.toHaveProperty("suspectedSecrets");
  });
});
