"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Status = "pending" | "approved" | "rejected";

function Badge({ status }: { status: Status }) {
  const map: Record<Status, React.CSSProperties> = {
    pending: { background: "rgba(255,140,0,.14)", border: "1px solid rgba(255,140,0,.25)" },
    approved: { background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.25)" },
    rejected: { background: "rgba(239,68,68,.14)", border: "1px solid rgba(239,68,68,.25)" },
  };
  const label = status === "pending" ? "Pendiente" : status === "approved" ? "Aprobada" : "Rechazada";
  return (
    <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, color: "rgba(255,255,255,.86)", ...map[status] }}>
      {label}
    </span>
  );
}

export default function AdminVacationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState<string>("");

  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async (mode: "pending" | "all") => {
    const base = collection(db, "vacations");

    const q =
      mode === "pending"
        ? query(base, where("status", "==", "pending"), orderBy("createdAt", "desc"))
        : query(base, orderBy("createdAt", "desc"));

    const snap = await getDocs(q);
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);
      if (!usnap.exists()) return router.push("/onboarding");
      if (usnap.data().role !== "hr_admin") {
        alert("No tienes permisos de RH Admin");
        return router.push("/dashboard");
      }

      setAdminUid(user.uid);
      await load("pending");
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const setStatus = async (vacId: string, status: Status) => {
    try {
      await updateDoc(doc(db, "vacations", vacId), {
        status,
        reviewedByUid: adminUid,
        reviewedAt: serverTimestamp(),
        reviewNote: (note[vacId] || "").trim() || null,
      });

      await load(tab);
      alert(status === "approved" ? "Aprobada ✅" : status === "rejected" ? "Rechazada ✅" : "Actualizada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar. Revisa consola.");
    }
  };

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="RH Admin • Vacaciones">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="RH Admin • Vacaciones">
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Solicitudes de vacaciones</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Aprueba/rechaza y agrega una nota si quieres.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button
                variant={tab === "pending" ? "primary" : "ghost"}
                onClick={async () => {
                  setTab("pending");
                  await load("pending");
                }}
              >
                Pendientes
              </Button>
              <Button
                variant={tab === "all" ? "primary" : "ghost"}
                onClick={async () => {
                  setTab("all");
                  await load("all");
                }}
              >
                Todas
              </Button>
              <Button variant="ghost" onClick={() => router.push("/admin")}>
                ← Volver a RH Admin
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Listado</h3>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {items.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {v.userName || "(sin nombre)"}{" "}
                      <span style={{ opacity: 0.6, fontWeight: 600 }}>•</span>{" "}
                      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{v.userEmail}</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontWeight: 900 }}>{v.startDate}</span>{" "}
                      <span style={{ opacity: 0.6 }}>→</span>{" "}
                      <span style={{ fontWeight: 900 }}>{v.endDate}</span>
                    </div>
                    {v.reason && <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>Motivo: {v.reason}</div>}
                  </div>

                  <Badge status={v.status as Status} />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={note[v.id] ?? ""}
                    onChange={(e) => setNote((prev) => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder="Nota RH (opcional)"
                    style={{
                      flex: 1,
                      minWidth: 240,
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid var(--stroke)",
                      background: "rgba(255,255,255,.05)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />

                  <Button onClick={() => setStatus(v.id, "approved")} disabled={v.status !== "pending"}>
                    Aprobar
                  </Button>

                  <Button variant="ghost" onClick={() => setStatus(v.id, "rejected")} disabled={v.status !== "pending"}>
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No hay solicitudes {tab === "pending" ? "pendientes" : ""}.
              </div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
