"use client";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function OnboardingPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setReady(true);
    });

    return () => unsub();
  }, [router]);

  const save = async () => {
    const user = auth.currentUser;
    if (!user) return router.push("/login");

    if (!name.trim()) return alert("Pon tu nombre completo");
    if (!birthday) return alert("Selecciona tu fecha de cumpleaños");

    try {
      setSaving(true);

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          email: user.email,
          birthday,
          role: "user",
          assignedScheduleId: null,
          createdAt: serverTimestamp(),
        },
        { merge: true } // ✅ no pisa campos existentes si luego agregas más
      );

      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar tu registro. Revisa consola.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <Shell title="TriangleRH" subtitle="Cargando sesión...">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando...</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="Completa tu registro para empezar">
      <div style={{ display: "grid", placeItems: "center", minHeight: "72vh" }}>
        <div style={{ width: "min(620px, 100%)" }}>
          <Card>
            <h2 style={{ margin: 0, fontSize: 22 }}>Registro inicial</h2>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              Esto ayuda a RH a asignarte horario, tareas, vacaciones y cumpleaños.
            </p>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Nombre completo</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Aldo Elías Bernal García"
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid var(--stroke)",
                    background: "rgba(255,255,255,.05)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Fecha de cumpleaños</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  style={{
                    width: 220,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid var(--stroke)",
                    background: "rgba(255,255,255,.05)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar y continuar"}
                </Button>

                <Button variant="ghost" onClick={() => router.push("/login")} disabled={saving}>
                  Volver
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
