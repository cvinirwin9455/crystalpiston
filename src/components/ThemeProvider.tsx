"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // On mount: read from localStorage first (instant), then fetch from API (persistent)
  useEffect(() => {
    // 1. Check localStorage for instant theme application (no flash)
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      applyThemeClass(stored);
    }

    // 2. Fetch from API for the authoritative preference (syncs across devices)
    const fetchTheme = async () => {
      try {
        const res = await fetch("/api/notification-preferences");
        if (res.ok) {
          const data = await res.json();
          const apiTheme: Theme = data.theme === "light" ? "light" : "dark";
          setThemeState(apiTheme);
          applyThemeClass(apiTheme);
          localStorage.setItem("theme", apiTheme);
        }
      } catch (err) {
        // Silent fail — use localStorage/default
      }
    };
    fetchTheme();
    setMounted(true);
  }, []);

  const applyThemeClass = (t: Theme) => {
    const html = document.documentElement;
    if (t === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
      html.classList.remove("light");
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    localStorage.setItem("theme", newTheme);

    // Persist to API (fire-and-forget)
    fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
