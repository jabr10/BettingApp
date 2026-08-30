"use client";

import { useEffect, useState } from "react";
import { applyTheme, readDomTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readDomTheme());
  }, []);

  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className="theme-opt light"
        aria-pressed={theme === null ? undefined : theme === "light"}
        aria-label="Switch to light theme"
        onClick={() => choose("light")}
      >
        Light
      </button>
      <button
        type="button"
        className="theme-opt dark"
        aria-pressed={theme === null ? undefined : theme === "dark"}
        aria-label="Switch to dark theme"
        onClick={() => choose("dark")}
      >
        Dark
      </button>
    </div>
  );
}
