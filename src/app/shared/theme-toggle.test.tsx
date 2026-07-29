import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getInitialTheme } from "./theme";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  applyTheme("light");
});

describe("ThemeToggle", () => {
  it("toggles dark mode and persists the preference", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(toggle);

    expect(document.documentElement).toHaveClass("dark");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Switch to light mode");
  });

  it("updates when the system preference changes", async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      addEventListener: (
        _event: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.add(listener);
      },
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      removeEventListener: (
        _event: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.delete(listener);
      },
      removeListener: () => undefined,
    } as unknown as MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery);
    render(<ThemeToggle />);

    listeners.forEach((listener) =>
      listener({
        matches: true,
        media: "(prefers-color-scheme: dark)",
      } as MediaQueryListEvent),
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });
    expect(getInitialTheme()).toBe("light");
  });
});
