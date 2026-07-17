import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createRoutes } from "./routes";
import {
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "../domain/project-interviewer";

const createTestApplication = () => {
  let id = 0;
  let token = 0;
  const dependencies: ProjectInterviewerDependencies = {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => `test-invite-${++token}`,
      deviceId: () => "browser-device",
    },
    clock: { now: () => 1_800_000_000_000 + id },
    inviteTokens: { hash: async (value) => `digest:${value}` },
  };
  return createProjectInterviewer(dependencies);
};

describe("File-First Discovery application shell", () => {
  it("lets a Freelancer create and open a Project Room from the Workspace", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", { name: /create project room/i }),
    );
    await user.type(screen.getByLabelText(/project title/i), "Alpine Portal");
    await user.type(screen.getByLabelText(/client name or label/i), "Alpine");
    await user.type(
      screen.getByLabelText(/project description/i),
      "A portal for client service requests.",
    );
    await user.selectOptions(screen.getByLabelText(/brief language/i), "de");
    await user.click(screen.getByRole("button", { name: /^create room$/i }));

    expect(
      await screen.findByRole("heading", { name: "Alpine Portal" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/test-invite-1/)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /project room/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add project material here/i),
    ).toBeInTheDocument();
  });

  it("shows disclosure onboarding once and returns the Client to Project Home", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    await application.rooms.create(freelancer, {
      title: "Alpine Portal",
      clientLabel: "Alpine",
      projectDescription: "A portal for client service requests.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const rendered = render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /before you begin/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/third-party ai providers/i)).toHaveLength(2);
    expect(
      screen.getByText(/masked before ai processing by default/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/alpine portal · ada/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/your display name/i), "Casey");
    await user.selectOptions(
      screen.getByLabelText(/interview language/i),
      "de",
    );
    expect(
      screen.getByRole("heading", { name: /bevor sie beginnen/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /ich verstehe/i }));
    await user.click(
      screen.getByRole("button", { name: /projektraum öffnen/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Alpine Portal" }),
    ).toBeInTheDocument();
    const overview = screen.getByRole("main");
    expect(
      within(overview).getByText(/willkommen, casey/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/before you begin/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /freelancer workspace/i }),
    ).not.toBeInTheDocument();

    rendered.unmount();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", {
        name: /freelancer-anmeldung erforderlich/i,
      }),
    ).toBeInTheDocument();
  });
});
