import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  resolveTheme,
} from "../src/lib/theme";

const ROOT = path.resolve(__dirname, "..");

describe("resolveTheme", () => {
  it("keeps an explicit stored choice over the system preference", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("follows prefers-color-scheme when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(undefined, false)).toBe("dark");
    expect(resolveTheme("nope", true)).toBe("light");
  });
});

describe("theme bootstrap", () => {
  it("sets data-theme from localStorage or prefers-color-scheme before paint", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage.getItem");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: light");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('setAttribute("data-theme"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("colorScheme");
  });

  it("is injected in the root layout head", () => {
    const layout = readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("THEME_BOOTSTRAP_SCRIPT");
    expect(layout).toContain("suppressHydrationWarning");
  });
});

describe("theme surfaces", () => {
  it("defines a real light palette, not only inverted dark tokens", () => {
    const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toMatch(/\[data-theme="light"\][\s\S]*--bg:\s*#f3f5f8/);
    expect(css).toMatch(/\[data-theme="light"\][\s\S]*--bg-elev:\s*#ffffff/);
    expect(css).toContain("--chip-hits-bg");
    expect(css).toContain("--banner-bg");
    expect(css).toContain("--error-bg");
    expect(css).toContain("--skel-1");
    expect(css).toContain("min-height: 44px");
  });

  it("puts an accessible toggle on home and game chrome", () => {
    const toggle = readFileSync(path.join(ROOT, "src/components/ThemeToggle.tsx"), "utf8");
    expect(toggle).toContain("Switch to light theme");
    expect(toggle).toContain("Switch to dark theme");
    expect(toggle).toContain("Color theme");

    const home = readFileSync(path.join(ROOT, "src/components/HomeView.tsx"), "utf8");
    const game = readFileSync(path.join(ROOT, "src/components/GameView.tsx"), "utf8");
    expect(home).toContain("<ThemeToggle");
    expect(game).toContain("<ThemeToggle");
  });
});
