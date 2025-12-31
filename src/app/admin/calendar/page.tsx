"use client";
export const dynamic = "force-dynamic";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type EvType = "task" | "vacation" | "birthday" | "schedule";
type Ev = {
  id: string;
  type: EvType;
  date: string;
  title: string;
  subtitle?: string;
};

type UserRow = { uid: string; name: string };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(dateISO: string, delta: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function badgeStyle(type: EvType): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid var(--stroke)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.85)",
    whiteSpace: "nowrap",
  };
  if (type === "vacation") return { ...base, border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.12)" };
  if (type === "birthday") return { ...base, border: "1px solid rgba(236,72,153,.25)", background: "rgba(236,72,153,.12)" };
  if (type === "task") return { ...base, border: "1px solid rgba(59,130,246,.25)", background: "rgba(59,130,246,.12)" };
  if (type === "schedule") return { ...base, border: "1px solid rgba(245,158,11,.25)", background: "rgba(245,158,11,.12)" };
  return base;
}
function label(type: EvType) {
  if (type === "vacation") return "Vacaciones";
  if (type === "birthday") return "Cumpleaños";
  if (type === "task") return "Tarea";
  return "Horario";
}

export default function AdminCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [weekStart, setWeekStart] = useState(() => todayISO());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [filterUid, setFilterUid] = useState<string>("all");

  const [events, setEvents] = useState<Ev[]>([]);

  const loadUsers = async () => {
    const snap = await getDocs(query(collection(db, "users"), limit(300)));
    const list: UserRow[] = snap.docs.map((d) => ({ uid: d.id, name: (d.data().name as string) || "(sin nombre)" }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(list);
  };

  const loadWeek = async (targetUid: string | "all") => {
    const result: Ev[] = [];
    const start = days[0];
    const end = days[6];

    // Cumpleaños del equipo (siempre)
    const teamSnap = await getDocs(query(collection(db, "users"), limit(300)));
    teamSnap.forEach((u) => {
      const data = u.data() as any;
      const b = data.birthday as string | undefined;
      const nm = (data.name as string) || "(sin nombre)";
      if (!b) return;
      const md = b.slice(5);
      for (const day of days) {
        if (day.slice(5) === md) {
          if (targetUid !== "all" && u.id !== targetUid) return;
          result.push({
            id: `team-bday-${u.id}-${day}`,
            type: "birthday",
            date: day,
            title: `🎂 Cumpleaños: ${nm}`,
            subtitle: "Equipo TriangleRH",
          });
        }
      }
    });

    // Vacaciones aprobadas
    if (targetUid === "all") {
      const vsnap = await getDocs(query(collection(db, "vacations"), where("status", "==", "approved"), limit(300)));
      vsnap.forEach((d) => {
        const v = d.data() as any;
        const uid = v.uid as string;
        const startDate = v.startDate as string;
        const endDate = v.endDate as string;
        const nm = (users.find((x) => x.uid === uid)?.name) || uid;

        for (const day of days) {
          if (day >= startDate && day <= endDate) {
            result.push({
              id: `${d.id}-${day}`,
              type: "vacation",
              date: day,
              title: `🏖️ Vacaciones: ${nm}`,
              subtitle: `${startDate} → ${endDate}`,
            });
          }
        }
      });
    } else {
      const vsnap = await getDocs(
        query(
          collection(db, "vacations"),
          where("uid", "==", targetUid),
          where("status", "==", "approved"),
          limit(100)
        )
      );
      const nm = (users.find((x) => x.uid === targetUid)?.name) || targetUid;
      vsnap.forEach((d) => {
        const v = d.data() as any;
        const startDate = v.startDate as string;
        const endDate = v.endDate as string;

        for (const day of days) {
          if (day >= startDate && day <= endDate) {
            result.push({
              id: `${d.id}-${day}`,
              type: "vacation",
              date: day,
              title: `🏖️ Vacaciones: ${nm}`,
              subtitle: `${startDate} → ${endDate}`,
            });
          }
        }
      });
    }

    // Tareas open
    if (targetUid === "all") {
      const tsnap = await getDocs(query(collection(db, "tasks"), where("status", "==", "open"), orderBy("dueDate", "asc"), limit(300)));
      tsnap.forEach((d) => {
        const t = d.data() as any;
        const due = t.dueDate as string;
        if (due < start || due > end) return;
        const nm = (users.find((x) => x.uid === (t.assignedToUid as string))?.name) || (t.assignedToName as string) || t.assignedToUid;
        result.push({
          id: d.id,
          type: "task",
          date: due,
          title: `🧩 ${t.title || "Tarea"} • ${nm}`,
          subtitle: t.description || undefined,
        });
      });
    } else {
      const tsnap = await getDocs(
        query(collection(db, "tasks"), where("status", "==", "open"), where("assignedToUid", "==", targetUid), limit(300))
      );
      const nm = (users.find((x) => x.uid === targetUid)?.name) || targetUid;
      tsnap.forEach((d) => {
        const t = d.data() as any;
        const due = t.dueDate as string;
        if (due < start || due > end) return;
        result.push({
          id: d.id,
          type: "task",
          date: due,
          title: `🧩 ${t.title || "Tarea"} • ${nm}`,
          subtitle: t.description || undefined,
        });
      });
    }

    result.sort((a, b) => (a.date === b.date ? a.type.localeCompare(b.type) : a.date.localeCompare(b.date)));
    setEvents(result);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const usnap = await getDoc(doc(db, "users", user.uid));
      if (!usnap.exists()) return router.push("/onboarding");

      if (usnap.data().role !== "hr_admin") {
        alert("No tienes permisos de RH Admin");
        return router.push("/dashboard");
      }

      await loadUsers();
      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (loading) return;
    loadWeek(filterUid as any).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, weekStart, filterUid, users.length]);

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="RH Admin • Calendario del equipo">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="RH Admin • Calendario del equipo">
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Semana</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Del <b>{days[0]}</b> al <b>{days[6]}</b>
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={filterUid}
                onChange={(e) => setFilterUid(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.05)",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="all">Todos</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name}
                  </option>
                ))}
              </select>

              <Button variant="ghost" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>← Semana</Button>
              <Button variant="ghost" onClick={() => setWeekStart(todayISO())}>Hoy</Button>
              <Button variant="ghost" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>Semana →</Button>

              <Button variant="ghost" onClick={() => router.push("/admin")}>← RH Admin</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Eventos</h3>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {days.map((d) => {
              const dayEvents = events.filter((e) => e.date === d);
              return (
                <div
                  key={d}
                  style={{
                    borderRadius: 16,
                    border: "1px solid var(--stroke)",
                    background: "rgba(255,255,255,.04)",
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{d}</div>

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {dayEvents.length === 0 && (
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin eventos</div>
                    )}

                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid var(--stroke)",
                          background: "rgba(0,0,0,.12)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>{ev.title}</div>
                          {ev.subtitle && (
                            <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                              {ev.subtitle}
                            </div>
                          )}
                        </div>

                        <span style={badgeStyle(ev.type)}>{label(ev.type)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
