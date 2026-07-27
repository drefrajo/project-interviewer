import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewTemplate } from "../../infrastructure/interview-api";
import { InterviewForm } from "./interview-form";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

const templates: InterviewTemplate[] = [
  {
    _id: "built-in-en",
    builtInKey: "single-page-business",
    kind: "built_in",
    name: "Single-page business website",
    sourceLanguage: "en",
    instructions: "English built-in instructions",
  },
  {
    _id: "built-in-de",
    builtInKey: "single-page-business",
    kind: "built_in",
    name: "Single-page business website",
    sourceLanguage: "de",
    instructions: "Deutsche Standardanweisungen",
  },
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

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={["/interviews/new"]}>
      <InterviewForm />
    </MemoryRouter>,
  );

describe("Create Interview template language", () => {
  beforeEach(() => {
    convex.useQuery.mockImplementation((_reference, args) =>
      args === "skip" ? undefined : templates,
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
      screen.getByRole("combobox", { name: "Client Language" }),
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

  it("defaults to DeepSeek V4 Flash without routing warnings", () => {
    renderForm();

    expect(
      screen.getByRole("combobox", { name: "Interview Model" }),
    ).toHaveValue("deepseek-v4-flash");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/privacy-compliant DeepSeek route/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/German-language support is less certain/i),
    ).not.toBeInTheDocument();
  });

  it("translates into the currently selected Client Language", async () => {
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
      name: "Client Language",
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
      name: "Client Language",
    });
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.selectOptions(templateSelect, "built-in-en");
    expect(instructions).toHaveValue("English built-in instructions");

    await user.selectOptions(languageSelect, "de");

    expect(templateSelect).toHaveValue("built-in-de");
    expect(instructions).toHaveValue("Deutsche Standardanweisungen");
  });

  it("keeps edited instructions instead of switching their built-in", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Client Language",
    });
    const templateSelect = screen.getByRole("combobox", {
      name: /^Optional Interview Template/,
    });
    const instructions = screen.getByRole("textbox", {
      name: /^Interview Instructions/,
    });

    await user.selectOptions(templateSelect, "built-in-en");
    await user.type(instructions, " with owner edits");
    await user.selectOptions(languageSelect, "de");

    expect(languageSelect).toHaveValue("de");
    expect(templateSelect).toHaveValue("");
    expect(instructions).toHaveValue(
      "English built-in instructions with owner edits",
    );
  });

  it("keeps a selected private template across language changes", async () => {
    const user = userEvent.setup();
    renderForm();
    const languageSelect = screen.getByRole("combobox", {
      name: "Client Language",
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
});
