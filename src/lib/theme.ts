export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/** Stored choice wins. If the user has never chosen, follow prefers-color-scheme. */
export function resolveTheme(stored: string | null | undefined, prefersLight: boolean): Theme {
  return isTheme(stored) ? stored : prefersLight ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readDomTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * Runs in <head> before paint so the first frame matches localStorage or
 * prefers-color-scheme. Keep this a single expression string (no imports).
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.remove("light","dark");r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;
