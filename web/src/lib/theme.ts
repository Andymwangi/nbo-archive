/*
  The storefront and desk are light unless the visitor switches to dark. The choice lives in a
  plain (not httpOnly) cookie so the switch can set it in the browser, and the server reads it to
  render the right theme from the first byte, with no flash of the wrong one.
*/

export const THEME_COOKIE = "nbo_theme";
export const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export const themeColors: Record<Theme, string> = {
  light: "#eee8dc",
  dark: "#17150f",
};

export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
