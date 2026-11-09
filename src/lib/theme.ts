export const THEME_STORAGE_KEY = "localform.appearance.theme.v1";

export const THEMES = [
  { id: "original", name: "Originale", colors: ["#020617", "#6366f1", "#e2e8f0"], browserColor: "#020617" },
  { id: "monokai", name: "Monokai", colors: ["#272822", "#a6e22e", "#f92672"], browserColor: "#272822" },
  { id: "tokyo", name: "Tokyo Night", colors: ["#1a1b26", "#7aa2f7", "#bb9af7"], browserColor: "#1a1b26" },
  { id: "nord", name: "Nord Dark", colors: ["#2e3440", "#88c0d0", "#a3be8c"], browserColor: "#2e3440" },
  { id: "frost", name: "Frost", colors: ["#0c1926", "#80c9ec", "#a9c5d7"], browserColor: "#0c1926" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function normalizeTheme(value: unknown): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : "original";
}

export function readTheme(): ThemeId {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "original";
  }
}

export function applyTheme(value: unknown): ThemeId {
  const themeId = normalizeTheme(value);
  const theme = THEMES.find((item) => item.id === themeId)!;
  document.documentElement.dataset.theme = themeId;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.browserColor);
  return themeId;
}

export function saveTheme(value: unknown): ThemeId {
  const themeId = applyTheme(value);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return themeId;
}

export function initializeTheme(): void {
  applyTheme(readTheme());
}
