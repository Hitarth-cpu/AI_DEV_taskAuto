"use client";
import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) ?? "dark";
    apply(stored);
    setTheme(stored);
  }, []);

  const apply = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
  };

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    apply(next);
  };

  return [theme, toggle];
}
