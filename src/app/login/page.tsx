"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const login = async () => {
    try {
      setLoading(true);

      const res = await signInWithPopup(auth, googleProvider);
      const email = res.user.email || "";

      // ✅ Solo @transfer.com
      if (!email.toLowerCase().endsWith("@transfer.com")) {
        await auth.signOut();
        alert("Solo correos @transfer.com pueden acceder.");
        return;
      }

      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      alert("Error al iniciar sesión. Revisa consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="TriangleRH" subtitle="Acceso seguro para colaboradores @transfer.com">
      <div style={{ display: "grid", placeItems: "center", minHeight: "72vh" }}>
        <div style={{ width: "min(560px, 100%)" }}>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>Iniciar sesión</h2>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                  Control de horarios, entradas/salidas, Home Office con ubicación, tareas, vacaciones y cumpleaños.
                </p>
              </div>

              <div
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>Requisito</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  Solo se permite acceso con correo <b style={{ color: "rgba(255,255,255,.88)" }}>@transfer.com</b>.
                </div>
              </div>

              <Button onClick={login} disabled={loading} style={{ width: "100%", marginTop: 6 }}>
                {loading ? "Autenticando..." : "Entrar con Google"}
              </Button>

              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                Tip: si luego marcas <b>Home Office</b>, el navegador pedirá permiso para obtener ubicación.
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                Triangle Soluciones ✦ TriangleRH
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
