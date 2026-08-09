import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_INTERVIEW_TEMPLATES,
  type PrivateInterviewTemplate,
} from "../../domain/interview-templates";
import { InterviewForm } from "./interview-form";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

const privateTemplates: PrivateInterviewTemplate[] = [
  {
    _id: "private-en",
    kind: "private",
    name: "English private template",
    sourceLanguage: "en",
    instructions: "English private instructions",
  },
  {
    _id: "private-de",
    kind: "private",
    name: "German private template",
    sourceLanguage: "de",
    instructions: "Deutsche private Anweisungen",
  },
];
const completeProfile = {
  displayName: "Ready Creator",
  email: "private@example.test",
  contactEmail: "hello@example.test",
  privacyPolicyUrl: "https://example.test/privacy",
};
const singlePageEnglish = BUILT_IN_INTERVIEW_TEMPLATES.find(
  ({ _id }) => _id === "built-in:single-page-business:en",
)!;
const singlePageGerman = BUILT_IN_INTERVIEW_TEMPLATES.find(
  ({ _id }) => _id === "built-in:single-page-business:de",
)!;

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={["/interviews/new"]}>
      <InterviewForm />
    </MemoryRouter>,
  );

describe("Create Interview template language", () => {
  beforeEach(() => {
    convex.useQuery.mockImplementation((reference, args) =>
      args === "skip"
        ? undefined
        : getFunctionName(reference) === "creator_profiles:getCurrent"
          ? completeProfile
          : privateTemplates,
    );
    convex.useMutation.mockReturnValue(vi.fn(async () => null));
    convex.useAction.mockReturnValue(vi.fn(async () => ""));
  });

  it("shows matching built-ins and every private template", async () => {
    const user = userEvent.setup();
    renderForm();
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });

    expect(
      within(templateSelect).getByRole("option", {
        name: "Built-in · Single-page business website · EN",
      }),
    ).toBeInTheDocument();
    expect(
      within(templateSelect).queryByRole("option", {
        name: "Built-in · Single-page business website · DE",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(templateSelect).getByRole("option", {
        name: "Private · English private template · EN",
      }),
    ).toBeInTheDocument();
    expect(
      within(templateSelect).getByRole("option", {
        name: "Private · German private template · DE",
      }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Interview language" }),
      "de",
    );

    expect(
      within(templateSelect).getByRole("option", {
        name: "Built-in · Single-page business website · DE",
      }),
    ).toBeInTheDocument();
    expect(
      within(templateSelect).queryByRole("option", {
        name: "Built-in · Single-page business website · EN",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not expose an interview model selector", () => {
    renderForm();

    expect(
      screen.queryByRole("combobox", { name: "Interview Model" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/privacy routing/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/German-language support is less certain/i),
    ).not.toBeInTheDocument();
  });

  it("translates into the currently selected interview language", async () => {
    const user = userEvent.setup();
    const translate = vi.fn(
      async ({
        targetLanguage,
      }: {
        instructions: string;
        targetLanguage: "en" | "de";
      }) => ({
        instructions:
          targetLanguage === "de"
            ? "Deutsche Übersetzung"
            : "English translation",
      }),
    );
    convex.useAction.mockReturnValue(translate);
    renderForm();

    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.type(instructions, "Source instructions");
    await user.click(
      screen.getByRole("button", { name: "Translate to English" }),
    );

    expect(translate).toHaveBeenLastCalledWith({
      instructions: "Source instructions",
      targetLanguage: "en",
    });
    expect(languageSelect).toHaveValue("en");

    await user.selectOptions(languageSelect, "de");
    await user.click(
      screen.getByRole("button", { name: "Translate to German" }),
    );

    expect(translate).toHaveBeenLastCalledWith({
      instructions: "English translation",
      targetLanguage: "de",
    });
    expect(languageSelect).toHaveValue("de");
  });

  it("switches an untouched built-in to the selected language", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.selectOptions(templateSelect, singlePageEnglish._id);
    expect(instructions).toHaveValue(singlePageEnglish.instructions);

    await user.selectOptions(languageSelect, "de");

    expect(templateSelect).toHaveValue(singlePageGerman._id);
    expect(instructions).toHaveValue(singlePageGerman.instructions);
  });

  it("keeps edited instructions instead of switching their built-in", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.selectOptions(templateSelect, singlePageEnglish._id);
    await user.type(instructions, " with owner edits");
    await user.selectOptions(languageSelect, "de");

    expect(languageSelect).toHaveValue("de");
    expect(templateSelect).toHaveValue("");
    expect(instructions).toHaveValue(
      `${singlePageEnglish.instructions} with owner edits`,
    );
  });

  it("keeps a selected private template across language changes", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.selectOptions(templateSelect, "private-en");
    await user.selectOptions(languageSelect, "de");

    expect(templateSelect).toHaveValue("private-en");
    expect(instructions).toHaveValue("English private instructions");
  });

  it("allows the new Interview form without a privacy policy URL", () => {
    convex.useQuery.mockImplementation((reference, args) =>
      args === "skip"
        ? undefined
        : getFunctionName(reference) === "creator_profiles:getCurrent"
          ? { ...completeProfile, privacyPolicyUrl: undefined }
          : privateTemplates,
    );

    renderForm();

    expect(screen.getByRole("heading", { name: "Prepare an Interview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Interview" })).toBeInTheDocument();
  });
});
