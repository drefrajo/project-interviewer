import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const systemThemeQuery = "(prefers-color-scheme: dark)";

export const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  return window.matchMedia(systemThemeQuery).matches
    ? "dark"
    : "light";
};

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export const initializeTheme = () => {
  const theme = getInitialTheme();
  applyTheme(theme);
  return theme;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    const mediaQuery = window.matchMedia(systemThemeQuery);
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
};
