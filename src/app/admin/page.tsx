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
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Segment = { start: string; end: string };

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        color: "rgba(255,255,255,.86)",
        background: "rgba(255,255,255,.06)",
        border: "1px solid var(--stroke)",
      }}
    >
      {text}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Crear horario
  const [name, setName] = useState("");
  const [useSecondSegment, setUseSecondSegment] = useState(true);
  const [seg1Start, setSeg1Start] = useState("07:00");
  const [seg1End, setSeg1End] = useState("14:00");
  const [seg2Start, setSeg2Start] = useState("16:00");
  const [seg2End, setSeg2End] = useState("19:00");

  // Data
  const [schedules, setSchedules] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const schedulesById = useMemo(() => {
    const map = new Map<string, any>();
    schedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [schedules]);

  const loadSchedules = async () => {
    const q = query(collection(db, "schedules"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const loadUsers = async () => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

      await loadSchedules();
      await loadUsers();
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const createSchedule = async () => {
    if (!name.trim()) return alert("Ponle un nombre al horario");

    const segments: Segment[] = [{ start: seg1Start, end: seg1End }];
    if (useSecondSegment) segments.push({ start: seg2Start, end: seg2End });

    await addDoc(collection(db, "schedules"), {
      name: name.trim(),
      segments,
      active: true,
      createdAt: serverTimestamp(),
    });

    setName("");
    await loadSchedules();
    alert("Horario creado ✅");
  };

  const assignScheduleToUser = async (userId: string, scheduleId: string | null) => {
    await updateDoc(doc(db, "users", userId), {
      assignedScheduleId: scheduleId,
    });
    await loadUsers();
  };

  if (loading) return <p style={{ padding: 24, color: "var(--muted)" }}>Cargando RH Admin...</p>;

  return (
    <Shell title="TriangleRH" subtitle="Panel RH • Horarios • Asignación por usuario">
      <div style={{ display: "grid", gap: 14 }}>
        {/* Top bar */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>RH Admin</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Crea horarios y asígnalos a colaboradores en segundos.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Badge text={`Horarios: ${schedules.length}`} />
              <Badge text={`Usuarios: ${users.length}`} />
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                ← Volver a Dashboard
              </Button>
            </div>
          </div>
        </Card>

        {/* Crear horario */}
        <Card>
          <h3 style={{ marginTop: 0 }}>Crear horario</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="Nombre del horario (ej. Partido 7-14 y 16-19)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 14,
                border: "1px solid var(--stroke)",
                background: "rgba(255,255,255,.05)",
                color: "var(--text)",
                outline: "none",
              }}
            />

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Segmento 1</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="time" value={seg1Start} onChange={(e) => setSeg1Start(e.target.value)} />
                  <span style={{ opacity: 0.6 }}>—</span>
                  <input type="time" value={seg1End} onChange={(e) => setSeg1End(e.target.value)} />
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>Segmento 2</div>
                  <label style={{ fontSize: 12, color: "var(--muted)" }}>
                    <input
                      type="checkbox"
                      checked={useSecondSegment}
                      onChange={(e) => setUseSecondSegment(e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    Turno partido
                  </label>
                </div>

                {useSecondSegment ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                    <input type="time" value={seg2Start} onChange={(e) => setSeg2Start(e.target.value)} />
                    <span style={{ opacity: 0.6 }}>—</span>
                    <input type="time" value={seg2End} onChange={(e) => setSeg2End(e.target.value)} />
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                    Desactivado. Se usará solo un segmento.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={createSchedule}>Crear horario</Button>
              <Button variant="ghost" onClick={loadSchedules}>
                Recargar horarios
              </Button>
            </div>
          </div>
        </Card>

        {/* Horarios existentes */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Horarios existentes</h3>
            <Button variant="ghost" onClick={loadSchedules}>
              Refresh
            </Button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {schedules.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{s.name}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                  {s.segments?.map((seg: any, idx: number) => (
                    <div key={idx}>
                      Segmento {idx + 1}: <b style={{ color: "rgba(255,255,255,.88)" }}>{seg.start}</b> —{" "}
                      <b style={{ color: "rgba(255,255,255,.88)" }}>{seg.end}</b>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>ID: {s.id}</div>
              </div>
            ))}
          </div>

          {schedules.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
              Aún no hay horarios. Crea el primero arriba.
            </div>
          )}
        </Card>

        {/* Usuarios + asignación */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Usuarios (asignar horario)</h3>
            <Button variant="ghost" onClick={loadUsers}>
              Refresh
            </Button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {users.map((u) => {
              const assigned = u.assignedScheduleId ? schedulesById.get(u.assignedScheduleId)?.name : null;

              return (
                <div
                  key={u.id}
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
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontWeight: 900 }}>{u.name || "(sin nombre)"}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{u.email}</div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                      Actual: <b style={{ color: "rgba(255,255,255,.86)" }}>{assigned || "Sin horario"}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={u.assignedScheduleId ?? ""}
                      onChange={(e) => assignScheduleToUser(u.id, e.target.value ? e.target.value : null)}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid var(--stroke)",
                        background: "rgba(255,255,255,.05)",
                        color: "var(--text)",
                        outline: "none",
                        minWidth: 260,
                      }}
                    >
                      <option value="">(Sin horario)</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <Button variant="ghost" onClick={() => assignScheduleToUser(u.id, null)}>
                      Quitar
                    </Button>
                    <Button variant="ghost" onClick={() => router.push("/admin/vacations")}>
  🏖️ Vacaciones RH
</Button>
<Button variant="ghost" onClick={() => router.push("/admin/tasks")}>
  🧩 Tareas RH
</Button>
<Button variant="ghost" onClick={() => router.push("/admin/calendar")}>
  📅 Calendario del equipo
</Button>

                  </div>
                </div>
              );
            })}
          </div>

          {users.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
              No hay usuarios aún. Entra con un usuario, completa onboarding y volverán a aparecer aquí.
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
