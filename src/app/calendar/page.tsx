"use client";
export const dynamic = "force-dynamic";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
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
  date: string; // YYYY-MM-DD
  title: string;
  subtitle?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayISO() {
  return iso(new Date());
}

function addDaysISO(dateISO: string, delta: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return iso(d);
}

/** Lunes=0 ... Domingo=6 */
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

/** Primer día visible del grid mensual (empieza lunes) */
function startOfMonthGrid(monthISO: string) {
  const d = new Date(monthISO + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dow = mondayIndex(first.getDay());
  first.setDate(first.getDate() - dow);
  return first;
}

/** 42 días (6 semanas) para grid mensual */
function buildMonthDays(monthISO: string) {
  const start = startOfMonthGrid(monthISO);
  const out: string[] = [];
  for (let i = 0; i < 42; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    out.push(iso(dd));
  }
  return out;
}

function isSameMonth(monthCursorISO: string, dayISO: string) {
  return monthCursorISO.slice(0, 7) === dayISO.slice(0, 7);
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
  if (type === "vacation")
    return {
      ...base,
      border: "1px solid rgba(34,197,94,.25)",
      background: "rgba(34,197,94,.12)",
    };
  if (type === "birthday")
    return {
      ...base,
      border: "1px solid rgba(236,72,153,.25)",
      background: "rgba(236,72,153,.12)",
    };
  if (type === "task")
    return {
      ...base,
      border: "1px solid rgba(59,130,246,.25)",
      background: "rgba(59,130,246,.12)",
    };
  if (type === "schedule")
    return {
      ...base,
      border: "1px solid rgba(245,158,11,.25)",
      background: "rgba(245,158,11,.12)",
    };
  return base;
}

function label(type: EvType) {
  if (type === "vacation") return "Vacaciones";
  if (type === "birthday") return "Cumpleaños";
  if (type === "task") return "Tarea";
  return "Horario";
}

export default function CalendarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("user");
  const [uid, setUid] = useState<string>("");
  const [name, setName] = useState<string>("");

  // Vista
  const [view, setView] = useState<"month" | "week">("month");

  // Semana
  const [weekStart, setWeekStart] = useState(() => todayISO());
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart]
  );

  // Mes
  const [monthCursor, setMonthCursor] = useState(() => todayISO());
  const monthDays = useMemo(() => buildMonthDays(monthCursor), [monthCursor]);
  const monthLabel = useMemo(() => {
    const d = new Date(monthCursor + "T00:00:00");
    return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }, [monthCursor]);

  const [events, setEvents] = useState<Ev[]>([]);

  /** Carga eventos para un rango dado de días (array YYYY-MM-DD) */
  const loadForDays = async (userUid: string, days: string[]) => {
    const start = days[0];
    const end = days[days.length - 1];

    const result: Ev[] = [];

    // 0) User base (nombre/role/horario)
    const usnap = await getDoc(doc(db, "users", userUid));
    if (usnap.exists()) {
      const udata = usnap.data() as any;
      setName((udata.name as string) || "");
      setRole((udata.role as string) || "user");
    }

    // 1) Cumpleaños del usuario
    if (usnap.exists()) {
      const b = (usnap.data() as any).birthday as string | undefined;
      const nm = ((usnap.data() as any).name as string) || "";
      if (b) {
        const md = b.slice(5); // MM-DD
        for (const d of days) {
          if (d.slice(5) === md) {
            result.push({
              id: `birthday-${userUid}-${d}`,
              type: "birthday",
              date: d,
              title: "🎉 Tu cumpleaños",
              subtitle: nm ? nm : undefined,
            });
          }
        }
      }
    }

    // 2) Cumpleaños del equipo (en el rango visible)
    const teamSnap = await getDocs(query(collection(db, "users"), limit(300)));
    teamSnap.forEach((u) => {
      const data = u.data() as any;
      const b = data.birthday as string | undefined;
      const nm = (data.name as string) || "(sin nombre)";
      if (!b) return;

      const md = b.slice(5); // MM-DD
      for (const d of days) {
        if (d.slice(5) === md) {
          if (u.id === userUid) continue; // ya existe "tu cumple"
          result.push({
            id: `team-bday-${u.id}-${d}`,
            type: "birthday",
            date: d,
            title: `🎂 Cumpleaños: ${nm}`,
            subtitle: "Equipo TriangleRH",
          });
        }
      }
    });

    // 3) Vacaciones aprobadas (del usuario, expandimos dentro del rango visible)
    const vq = query(
      collection(db, "vacations"),
      where("uid", "==", userUid),
      where("status", "==", "approved"),
      limit(80)
    );
    const vsnap = await getDocs(vq);
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
            title: "🏖️ Vacaciones aprobadas",
            subtitle: `${startDate} → ${endDate}`,
          });
        }
      }
    });

    // 4) Tareas del usuario (por dueDate dentro del rango)
    // Si te pide índice en Firestore: creamos composite (assignedToUid + status + dueDate)
    const tq = query(
      collection(db, "tasks"),
      where("assignedToUid", "==", userUid),
      where("status", "==", "open"),
      orderBy("dueDate", "asc"),
      limit(300)
    );
    const tsnap = await getDocs(tq);
    tsnap.forEach((d) => {
      const t = d.data() as any;
      const due = t.dueDate as string;
      if (due >= start && due <= end) {
        result.push({
          id: d.id,
          type: "task",
          date: due,
          title: `🧩 ${t.title || "Tarea"}`,
          subtitle: t.description || undefined,
        });
      }
    });

    // 5) Horario informativo (cada día del rango)
    if (usnap.exists() && (usnap.data() as any).assignedScheduleId) {
      const sid = (usnap.data() as any).assignedScheduleId as string;
      const s = await getDoc(doc(db, "schedules", sid));
      if (s.exists()) {
        const segs = (s.data() as any).segments as { start: string; end: string }[] | undefined;
        const schedName = ((s.data() as any).name as string) || "Horario";
        const subtitle = segs?.length
          ? segs.map((x) => `${x.start}-${x.end}`).join(" · ")
          : "Sin segmentos";

        for (const day of days) {
          result.push({
            id: `schedule-${sid}-${day}`,
            type: "schedule",
            date: day,
            title: `⏰ ${schedName}`,
            subtitle,
          });
        }
      }
    }

    // Orden final
    result.sort((a, b) => (a.date === b.date ? a.type.localeCompare(b.type) : a.date.localeCompare(b.date)));
    setEvents(result);
  };

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const usnap = await getDoc(doc(db, "users", user.uid));
      if (!usnap.exists()) return router.push("/onboarding");

      setUid(user.uid);
      setRole(((usnap.data() as any).role as string) || "user");
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  // Cargar según vista
  useEffect(() => {
    if (!uid) return;

    if (view === "week") {
      loadForDays(uid, weekDays).catch(console.error);
    } else {
      // month
      loadForDays(uid, monthDays).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, view, weekStart, monthCursor]);

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="Calendario unificado">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="Calendario unificado">
      <div style={{ display: "grid", gap: 14 }}>
        {/* Header controles */}
        <Card className="tri-card">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, textTransform: "capitalize" }}>
                {view === "month" ? monthLabel : "Semana"}
              </h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                {name ? `Usuario: ${name} • ` : ""}
                {view === "month" ? "Vista mensual (cuadros)" : `Del ${weekDays[0]} al ${weekDays[6]}`}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={() => setView(view === "month" ? "week" : "month")}>
                {view === "month" ? "📅 Semana" : "🗓️ Mes"}
              </Button>

              {view === "week" ? (
                <>
                  <Button variant="ghost" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
                    ← Semana
                  </Button>
                  <Button variant="ghost" onClick={() => setWeekStart(todayISO())}>
                    Hoy
                  </Button>
                  <Button variant="ghost" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
                    Semana →
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const d = new Date(monthCursor + "T00:00:00");
                      d.setMonth(d.getMonth() - 1);
                      setMonthCursor(iso(d));
                    }}
                  >
                    ←
                  </Button>
                  <Button variant="ghost" onClick={() => setMonthCursor(todayISO())}>
                    Hoy
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const d = new Date(monthCursor + "T00:00:00");
                      d.setMonth(d.getMonth() + 1);
                      setMonthCursor(iso(d));
                    }}
                  >
                    →
                  </Button>
                </>
              )}

              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                ← Dashboard
              </Button>
            </div>
          </div>
        </Card>

        {/* Vista mensual en cuadros */}
        {view === "month" ? (
          <Card className="tri-card">
            {/* Encabezados */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 10,
                fontSize: 12,
                color: "var(--muted)",
                fontWeight: 900,
              }}
            >
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} style={{ paddingLeft: 8 }}>
                  {d}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 10,
              }}
            >
              {monthDays.map((day) => {
                const dayEventsAll = events.filter((e) => e.date === day);
                const dayEvents = dayEventsAll.slice(0, 4);
                const extra = Math.max(0, dayEventsAll.length - dayEvents.length);

                return (
                  <div
                    key={day}
                    style={{
                      borderRadius: 16,
                      border: "1px solid var(--stroke)",
                      background: isSameMonth(monthCursor, day) ? "var(--panel)" : "rgba(255,255,255,.03)",
                      padding: 10,
                      minHeight: 128,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 900, fontSize: 13, opacity: isSameMonth(monthCursor, day) ? 1 : 0.55 }}>
                        {day.slice(8, 10)}
                      </div>

                      {day === todayISO() && (
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid var(--stroke)",
                            fontSize: 11,
                            background: "rgba(255,255,255,.06)",
                          }}
                        >
                          Hoy
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {dayEvents.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--muted)", opacity: 0.8 }}>—</div>
                      ) : (
                        dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            title={ev.subtitle ? `${ev.title}\n${ev.subtitle}` : ev.title}
                            style={{
                              fontSize: 12,
                              padding: "6px 8px",
                              borderRadius: 12,
                              border: "1px solid var(--stroke)",
                              background: "rgba(0,0,0,.10)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ev.title}
                          </div>
                        ))
                      )}

                      {extra > 0 && (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>+{extra} más…</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* Vista semanal tipo lista (tu original, pero ya limpia) */
          <Card className="tri-card">
            <h3 style={{ marginTop: 0 }}>Eventos</h3>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {weekDays.map((d) => {
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
        )}
      </div>
    </Shell>
  );
}
