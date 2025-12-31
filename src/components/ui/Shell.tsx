"use client";

import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Shell({ title, subtitle, children }: Props) {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--stroke)",
          background: "var(--panel)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* TITULO */}
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
          {subtitle && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* ACCIONES (AQUÍ VA LO QUE NO ENTENDÍAS) */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ThemeToggle />
        </div>
      </header>

      {/* CONTENIDO */}
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
