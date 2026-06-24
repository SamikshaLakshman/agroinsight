/**
 * AgroInsight - Theme Context
 * =============================
 * Light/dark mode toggle. Persists preference in localStorage (this is a
 * UI preference, not an auth token, so localStorage is fine here) and
 * applies the .dark class to the document root, which every component's
 * CSS reacts to via the .dark selector defined in index.css.
 */

import { useEffect, useState } from "react";
import { ThemeContext } from "./theme-context";

function getInitialTheme() {
  const stored = localStorage.getItem("agroinsight_theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("agroinsight_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
