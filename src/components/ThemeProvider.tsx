"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

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

// Read theme from localStorage (safe for SSR)
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  return stored === "light" ? "light" : "dark";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from localStorage immediately (matches what inline script set)
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  // Apply theme class to html element (only on platform pages, not marketing)
  const applyThemeClass = useCallback((t: Theme) => {
    const html = document.documentElement;
    const path = window.location.pathname;
    const isPlatformPage = path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/super-admin') || path.startsWith('/login') || path.startsWith('/set-password') || path.startsWith('/reset-password') || path.startsWith('/help');
    
    if (isPlatformPage && t === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else {
      // Marketing pages or dark mode: always use dark (default)
      html.classList.add("dark");
      html.classList.remove("light");
    }

    // Apply brand-specific class for First Mile Coach
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('firstmilecoach')) {
      html.classList.add("brand-firstmile");
    } else {
      html.classList.remove("brand-firstmile");
    }
  }, []);

  // On mount: ensure the class is applied (in case hydration wiped it)
  // Then sync with API (but DON'T override localStorage — localStorage is the source of truth for this device)
  useEffect(() => {
    // Re-apply class after hydration (hydration may have reset it)
    applyThemeClass(theme);

    // Fetch from API only if localStorage has no preference set yet
    // This handles first-time login on a new device
    const hasLocalPreference = localStorage.getItem("theme") !== null;
    if (!hasLocalPreference) {
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
          // Silent fail — use default dark
        }
      };
      fetchTheme();
    }
  }, [applyThemeClass, theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    localStorage.setItem("theme", newTheme);

    // Persist to API (fire-and-forget for cross-device sync)
    fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  }, [applyThemeClass]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
