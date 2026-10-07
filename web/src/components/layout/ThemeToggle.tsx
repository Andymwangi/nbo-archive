"use client";

import { useState } from "react";

import { Icon } from "@/components/primitives/Icon";
import { copy } from "@/content/copy";
import { THEME_COOKIE, THEME_MAX_AGE_SECONDS, type Theme, themeColors } from "@/lib/theme";

/*
  Light by default. The switch flips the page at once by changing data-theme on <html>, and
  remembers the choice in a cookie the server reads on the next visit, so the page never flashes
  the wrong theme while loading. The icon shows where the switch goes: the moon in daylight.
*/
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE_SECONDS}; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[next]);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? copy.theme.toDark : copy.theme.toLight}
      title={next === "dark" ? copy.theme.toDark : copy.theme.toLight}
      className="grid size-11 shrink-0 place-items-center text-ink-muted hover:text-ink"
    >
      <Icon name={next === "dark" ? "moon" : "sun"} size={20} />
    </button>
  );
}
