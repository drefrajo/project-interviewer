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
const creatorLanguage = vi.hoisted(() => ({
  useCreatorLanguage: vi.fn((): "en" | "de" => "en"),
}));

vi.mock("convex/react", () => convex);
vi.mock("./creator-language", () => creatorLanguage);

const privateTemplates: PrivateInterviewTemplate[] = [
  {
    _id: "private-en",
    kind: "private",
    name: "English private template",
    sourceLanguage: "en",
    instructions: "English private instructions",
    interviewKind: "website",
    visualConceptsMode: "included",
    includesVisualConcepts: true,
    description: "For web projects",
  },
  {
    _id: "private-de",
    kind: "private",
    name: "German private template",
    sourceLanguage: "de",
    instructions: "Deutsche private Anweisungen",
    interviewKind: "privacy",
    visualConceptsMode: "excluded",
    includesVisualConcepts: false,
    description: "For data mapping",
  },
];
const completeProfile = {
  displayName: "Ready Creator",
  email: "private@example.test",
  contactEmail: "hello@example.test",
  privacyPolicyUrl: "https://example.test/privacy",
};
const websiteEnglish = BUILT_IN_INTERVIEW_TEMPLATES.find(
  ({ _id }) => _id === "built-in:website:en",
)!;
const websiteGerman = BUILT_IN_INTERVIEW_TEMPLATES.find(
  ({ _id }) => _id === "built-in:website:de",
)!;

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={["/interviews/new"]}>
      <InterviewForm />
    </MemoryRouter>,
  );

describe("Create Interview template language", () => {
  beforeEach(() => {
    creatorLanguage.useCreatorLanguage.mockReturnValue("en");
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

  it("defaults the Interview language to the Creator UI language", () => {
    creatorLanguage.useCreatorLanguage.mockReturnValue("de");
    renderForm();

    expect(
      screen.getByRole("combobox", { name: "Interview-Sprache" }),
    ).toHaveValue("de");
  });

  it("shows matching built-ins and every private template", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByText("Start with a template"));
    const templatePicker = screen.getByRole("group", {
      name: "Optional Interview Template",
    });

    expect(within(templatePicker).getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByDisplayValue("built-in:website:en")).toBeInTheDocument();
    expect(screen.getByDisplayValue("built-in:privacy:en")).toBeInTheDocument();
    expect(screen.getByDisplayValue("built-in:custom:en")).toBeInTheDocument();
    expect(screen.getAllByText(/Visual Concepts: included/)).toHaveLength(2);
    expect(screen.getAllByText(/Visual Concepts: not included/)).toHaveLength(2);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Interview language" }),
      "de",
    );

    expect(screen.getByDisplayValue("built-in:website:de")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("built-in:website:en")).not.toBeInTheDocument();
  });

  it("exposes Custom's concept toggle but no interview model selector", () => {
    renderForm();

    expect(
      screen.queryByRole("combobox", { name: "Interview Model" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Include Visual Concepts/ })).toBeInTheDocument();
    expect(screen.queryByText(/privacy routing/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/German-language support is less certain/i),
    ).not.toBeInTheDocument();
  });

  it("keeps Interview Instructions content at normal weight", () => {
    renderForm();

    expect(
      screen.getByRole("textbox", { name: /^Interview Instructions/ }),
    ).toHaveClass("font-normal");
  });

  it("uses a scroll-free, non-resizable editor that grows with its content", async () => {
    const user = userEvent.setup();
    renderForm();
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });
    Object.defineProperty(instructions, "scrollHeight", {
      configurable: true,
      value: 640,
    });

    expect(instructions).toHaveClass("overflow-hidden", "resize-none");

    await user.type(instructions, "A longer brief.");

    expect(instructions).toHaveStyle({ height: "640px" });
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
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.click(screen.getByDisplayValue(websiteEnglish._id));
    expect(instructions).toHaveValue(websiteEnglish.instructions);

    await user.selectOptions(languageSelect, "de");

    expect(screen.getByDisplayValue(websiteGerman._id)).toBeChecked();
    expect(instructions).toHaveValue(websiteGerman.instructions);
  });

  it("keeps edited instructions instead of switching their built-in", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.click(screen.getByDisplayValue(websiteEnglish._id));
    await user.type(instructions, " with owner edits");
    await user.selectOptions(languageSelect, "de");

    expect(languageSelect).toHaveValue("de");
    expect(screen.getByDisplayValue("built-in:website:de")).not.toBeChecked();
    expect(instructions).toHaveValue(
      `${websiteEnglish.instructions} with owner edits`,
    );
  });

  it("keeps a selected private template across language changes", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Interview language",
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.click(screen.getByDisplayValue("private-en"));
    await user.selectOptions(languageSelect, "de");

    expect(screen.getByDisplayValue("private-en")).toBeChecked();
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

  it("saves the Custom kind and concrete concept choice", async () => {
    const user = userEvent.setup();
    const createInterview = vi.fn(async () => "interview_1");
    convex.useMutation.mockImplementation((reference) =>
      getFunctionName(reference) === "interviews:create"
        ? createInterview
        : vi.fn(async () => null),
    );
    renderForm();

    await user.type(screen.getByRole("textbox", { name: "Project name" }), "Data review");
    await user.type(
      screen.getByRole("textbox", { name: /^Interview Instructions/ }),
      "Ask about the process and produce a concise handoff.",
    );
    await user.click(screen.getByRole("checkbox", { name: /Include Visual Concepts/ }));
    await user.click(screen.getByRole("button", { name: "Create Interview" }));

    expect(createInterview).toHaveBeenCalledWith({
      projectName: "Data review",
      clientLanguage: "en",
      instructions: "Ask about the process and produce a concise handoff.",
      interviewKind: "custom",
      includesVisualConcepts: true,
    });
  });

  it("records the built-in template origin when creating from a built-in", async () => {
    const user = userEvent.setup();
    const createInterview = vi.fn(async () => "interview_9");
    convex.useMutation.mockImplementation((reference) =>
      getFunctionName(reference) === "interviews:create"
        ? createInterview
        : vi.fn(async () => null),
    );
    renderForm();

    await user.click(screen.getByDisplayValue(websiteEnglish._id));
    await user.type(screen.getByRole("textbox", { name: "Project name" }), "New site");
    await user.click(screen.getByRole("button", { name: "Create Interview" }));

    expect(createInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "New site",
        builtInTemplateKey: "website",
      }),
    );
  });
});
