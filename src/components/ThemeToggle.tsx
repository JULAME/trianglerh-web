"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("tri_theme") as Theme | null);
    const initial = saved || "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tri_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <Button variant="ghost" onClick={toggle}>
      {theme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro"}
    </Button>
  );
}
