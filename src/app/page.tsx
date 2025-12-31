"use client";
export const dynamic = "force-dynamic";
import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <Shell title="TriangleRH" subtitle="Control inteligente de horarios y RH">
      <div
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ width: "min(680px, 100%)" }}>
          <Card>
            <div style={{ display: "grid", gap: 14, textAlign: "center" }}>
              <h1 style={{ fontSize: 34, margin: 0, letterSpacing: 0.4 }}>
                TriangleRH
              </h1>

              <p style={{ margin: 0, color: "var(--muted)", fontSize: 15 }}>
                Control de horarios, entradas y salidas, Home Office con ubicación,
                tareas, vacaciones y calendario.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                <Button onClick={() => (window.location.href = "/login")}>
                  Iniciar sesión
                </Button>

                <Button variant="ghost" onClick={() => (window.location.href = "/login")}>
                  Acceso colaboradores
                </Button>
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(255,255,255,.55)",
                }}
              >
                Triangle Soluciones ✦ Plataforma interna de RH
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
