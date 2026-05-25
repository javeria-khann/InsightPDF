"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useEffect(() => {
    const stored = localStorage.getItem("insightpdf-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("insightpdf-theme", next ? "dark" : "light");
  }

  return (
    <Button
      aria-label="Toggle theme"
      variant="outline"
      size="icon"
      type="button"
      onClick={toggleTheme}
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
