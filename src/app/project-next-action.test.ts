import { describe, expect, it } from "vitest";
import { projectAttentionFor } from "./project-next-action";

describe("Project Home next-action guidance", () => {
  it("directs the Client in setup to Project Material", () => {
    expect(
      projectAttentionFor(
        { phase: "setup", interviewReadiness: "waiting_for_material" },
        "client",
        "en",
      ),
    ).toMatchObject({
      actor: "client",
      targetTab: "material",
      label: "Open Project Material",
    });
  });

  it("names the Client as responsible while the Freelancer waits in discovery", () => {
    const attention = projectAttentionFor(
      { phase: "discovery", interviewReadiness: "ready" },
      "freelancer",
      "en",
    );
    expect(attention).toMatchObject({
      actor: "client",
      title: "Waiting for the Client to continue discovery.",
    });
    expect(attention).not.toHaveProperty("targetTab");
  });

  it("sends each reviewing party to the Project Brief", () => {
    expect(
      projectAttentionFor(
        { phase: "freelancer_review", interviewReadiness: "ready" },
        "freelancer",
        "en",
      ),
    ).toMatchObject({ targetTab: "brief" });
    expect(
      projectAttentionFor(
        { phase: "client_review", interviewReadiness: "ready" },
        "client",
        "en",
      ),
    ).toMatchObject({ targetTab: "brief" });
  });
});
