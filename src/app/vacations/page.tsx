"use client";
export const dynamic = "force-dynamic";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
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

function isValidRange(start: string, end: string) {
  if (!start || !end) return false;
  return new Date(start).getTime() <= new Date(end).getTime();
}
function buildDays(start: string, end: string) {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");

  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}
export default function VacationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; email: string; uid: string } | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const loadMine = async (uid: string) => {
    const q = query(
      collection(db, "vacations"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);
      if (!usnap.exists()) return router.push("/onboarding");

      const name = usnap.data().name || "";
      const email = user.email || "";
      setProfile({ name, email, uid: user.uid });

      await loadMine(user.uid);
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const submit = async () => {
    if (!profile) return;
    if (!isValidRange(startDate, endDate)) return alert("Rango de fechas inválido (inicio debe ser <= fin).");

    try {
      setSaving(true);
const days = buildDays(startDate, endDate);
      await addDoc(collection(db, "vacations"), {
        uid: profile.uid,
        userName: profile.name,
        userEmail: profile.email,
        startDate,
        endDate,
         days,
        reason: reason.trim() || null,
        status: "pending",
        createdAt: serverTimestamp(),
        reviewedByUid: null,
        reviewedAt: null,
        reviewNote: null,
      });

      setStartDate("");
      setEndDate("");
      setReason("");
      await loadMine(profile.uid);

      alert("Solicitud enviada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo enviar. Revisa consola.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="Vacaciones">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="Vacaciones • Solicitud y estatus">
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <h2 style={{ margin: 0, fontSize: 20 }}>Solicitar vacaciones</h2>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
            RH revisará tu solicitud. El estatus cambiará a Aprobada/Rechazada.
          </p>

          <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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

            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Motivo (opcional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. viaje familiar, trámite, etc."
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

          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enviando..." : "Enviar solicitud"}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              ← Volver
            </Button>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Mis solicitudes</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {items.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {v.startDate} <span style={{ opacity: 0.6 }}>→</span> {v.endDate}
                  </div>
                  {v.reason && <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>{v.reason}</div>}
                  {v.reviewNote && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Nota RH: {v.reviewNote}</div>}
                </div>

                <Badge status={v.status as Status} />
              </div>
            ))}

            {items.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Aún no has enviado solicitudes.</div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
