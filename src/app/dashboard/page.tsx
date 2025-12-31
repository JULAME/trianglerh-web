"use client";
export const dynamic = "force-dynamic";
import { onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  orderBy,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Mode = "office" | "homeoffice";
type Segment = { start: string; end: string };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesFromHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesFromDate(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

async function getGeo(): Promise<{ lat: number; lng: number }> {
  return await new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("No geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function DashboardPage() {
  const router = useRouter();
const [tasks, setTasks] = useState<any[]>([]);
const [tasksLoading, setTasksLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [name, setName] = useState("");
  const [role, setRole] = useState<"user" | "hr_admin">("user");

  const [mode, setMode] = useState<Mode>("office");

  const date = useMemo(() => todayISO(), []);

  const [scheduleName, setScheduleName] = useState<string>("");
  const [scheduleSegments, setScheduleSegments] = useState<Segment[]>([]);

  const [todayAttendanceId, setTodayAttendanceId] = useState<string>("");
  const [checkInAt, setCheckInAt] = useState<Date | null>(null);
  const [checkOutAt, setCheckOutAt] = useState<Date | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // ✅ progreso se actualiza cada minuto mientras el día está abierto
  useEffect(() => {
    if (!checkInAt || checkOutAt) return;
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, [checkInAt, checkOutAt]);

  const isOnApprovedVacation = async (uid: string, dateISO: string) => {
    // Evitamos índices raros: traemos aprobadas y filtramos en cliente
    const vsnap = await getDocs(
      query(
        collection(db, "vacations"),
        where("uid", "==", uid),
        where("status", "==", "approved"),
        limit(50)
      )
    );

    for (const d of vsnap.docs) {
      const v = d.data() as any;
      const startDate = v.startDate as string;
      const endDate = v.endDate as string;
      if (dateISO >= startDate && dateISO <= endDate) return true;
    }
    return false;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      // ✅ user profile
      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);

      if (!usnap.exists()) {
        router.push("/onboarding");
        return;
      }

      const udata = usnap.data() as any;
      setName(udata.name || "");
      setRole((udata.role as "user" | "hr_admin") || "user");
      setMode((udata.defaultMode as Mode) || "office");

      // ✅ horario asignado
      if (udata.assignedScheduleId) {
        const sref = doc(db, "schedules", udata.assignedScheduleId);
        const ssnap = await getDoc(sref);
        if (ssnap.exists()) {
          const sdata = ssnap.data() as any;
          setScheduleName(sdata.name || "Horario");
          setScheduleSegments((sdata.segments || []) as Segment[]);
        } else {
          setScheduleName("");
          setScheduleSegments([]);
        }
      } else {
        setScheduleName("");
        setScheduleSegments([]);
      }

      // ✅ asistencia de hoy (un doc por día)
      const attId = `${user.uid}_${date}`;
      setTodayAttendanceId(attId);

      const attSnap = await getDoc(doc(db, "attendance", attId));
      if (attSnap.exists()) {
        const data = attSnap.data() as any;
        setCheckInAt(data.checkInAt?.toDate?.() ?? null);
        setCheckOutAt(data.checkOutAt?.toDate?.() ?? null);
      } else {
        setCheckInAt(null);
        setCheckOutAt(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router, date]);

  const enableNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return alert("No hay sesión");

    try {
      if (!("Notification" in window)) {
        alert("Este navegador no soporta notificaciones.");
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("Permiso de notificaciones no concedido.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = await getClientMessaging();
      if (!messaging) {
        alert("FCM no soportado en este navegador.");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FB_VAPID_KEY;
      if (!vapidKey) {
        alert("Falta NEXT_PUBLIC_FB_VAPID_KEY en .env.local");
        return;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (!token) {
        alert("No se pudo obtener token.");
        return;
      }

      await setDoc(doc(db, "users", user.uid, "fcmTokens", token), {
        token,
        createdAt: serverTimestamp(),
      });

      alert("Notificaciones activadas ✅");
    } catch (e) {
      console.error(e);
      alert("Error activando notificaciones. Revisa consola.");
    }
    const tq = query(
  collection(db, "tasks"),
  where("assignedToUid", "==", user.uid),
  where("status", "==", "open"),
  orderBy("createdAt", "desc"),
  limit(20)
);

const unsubTasks = onSnapshot(tq, (snap) => {
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  setTasks(list);
  setTasksLoading(false);
});

return () => unsubTasks();
  };

  const registerCheckIn = async () => {
    const user = auth.currentUser;
    if (!user) return router.push("/login");
    if (checkInAt) return; // ya hay entrada

    const onVacation = await isOnApprovedVacation(user.uid, date);
    if (onVacation) {
      alert("No puedes registrar asistencia: estás de vacaciones aprobadas 🏖️");
      return;
    }

    try {
      setSavingAttendance(true);

      let location: { lat: number; lng: number } | null = null;
      if (mode === "homeoffice") {
        location = await getGeo();
      }

      await setDoc(
        doc(db, "attendance", todayAttendanceId),
        {
          uid: user.uid,
          email: user.email || null,
          date,
          checkInAt: serverTimestamp(),
          checkInMode: mode,
          checkInLocation: location,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCheckInAt(new Date()); // UI instantánea
      alert("Entrada registrada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar entrada.");
    } finally {
      setSavingAttendance(false);
    }
  };

  const registerCheckOut = async () => {
    const user = auth.currentUser;
    if (!user) return router.push("/login");
    if (!checkInAt) return alert("Primero registra tu entrada.");
    if (checkOutAt) return; // ya hay salida

    const onVacation = await isOnApprovedVacation(user.uid, date);
    if (onVacation) {
      alert("No puedes registrar asistencia: estás de vacaciones aprobadas 🏖️");
      return;
    }

    try {
      setSavingAttendance(true);

      await updateDoc(doc(db, "attendance", todayAttendanceId), {
        checkOutAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCheckOutAt(new Date());
      alert("Salida registrada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar salida.");
    } finally {
      setSavingAttendance(false);
    }
  };

  const scheduledMinutesTotal = useMemo(() => {
    if (!scheduleSegments?.length) return 0;
    return scheduleSegments.reduce((acc, seg) => {
      const s = minutesFromHHMM(seg.start);
      const e = minutesFromHHMM(seg.end);
      return acc + Math.max(0, e - s);
    }, 0);
  }, [scheduleSegments]);

  const workedMinutes = useMemo(() => {
    if (!checkInAt) return 0;
    const startMin = minutesFromDate(checkInAt);
    const endMin = checkOutAt ? minutesFromDate(checkOutAt) : minutesFromDate(new Date());
    return Math.max(0, endMin - startMin);
  }, [checkInAt, checkOutAt, tick]);

  const progressPct = useMemo(() => {
    if (scheduledMinutesTotal <= 0) return 0;
    return clamp((workedMinutes / scheduledMinutesTotal) * 100, 0, 100);
  }, [workedMinutes, scheduledMinutesTotal]);

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="Dashboard">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="Dashboard">
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Hola{ name ? `, ${name}` : "" } 👋</h2>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                Fecha de hoy: <b>{date}</b>
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="ghost" onClick={enableNotifications}>
                🔔 Activar notificaciones
              </Button>

              <Button variant="ghost" onClick={() => router.push("/calendar")}>
                📅 Calendario
              </Button>

              <Button variant="ghost" onClick={() => router.push("/vacations")}>
                🏖️ Vacaciones
              </Button>

              {role === "hr_admin" && (
                <Button variant="ghost" onClick={() => router.push("/admin")}>
                  RH Admin →
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Mi horario</h3>
          {scheduleName ? (
            <>
              <div style={{ fontWeight: 900 }}>{scheduleName}</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                {scheduleSegments.length
                  ? scheduleSegments.map((s, i) => (
                      <span key={i} style={{ marginRight: 10 }}>
                        <b>{s.start}</b>–<b>{s.end}</b>
                      </span>
                    ))
                  : "Sin segmentos"}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Aún no tienes horario asignado.</div>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Registro de asistencia</h3>

          <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Modo:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                disabled={!!checkInAt} // ✅ ya no cambies modo si ya checaste
                style={{
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.05)",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="office">Oficina</option>
                <option value="homeoffice">Home Office</option>
              </select>
            </div>

            <Button onClick={registerCheckIn} disabled={savingAttendance || !!checkInAt}>
              {checkInAt ? "Entrada registrada ✅" : "Registrar entrada"}
            </Button>

            <Button
              variant="ghost"
              onClick={registerCheckOut}
              disabled={savingAttendance || !checkInAt || !!checkOutAt}
            >
              {checkOutAt ? "Salida registrada ✅" : "Registrar salida"}
            </Button>

            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {checkInAt ? `Entrada: ${checkInAt.toLocaleTimeString()}` : "Entrada: —"}{" "}
              •{" "}
              {checkOutAt ? `Salida: ${checkOutAt.toLocaleTimeString()}` : "Salida: —"}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Progreso del día</h3>

          {!checkInAt ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Aún no registras entrada.</p>
          ) : (
            <>
              <p style={{ margin: "6px 0 12px", color: "var(--muted)", fontSize: 13 }}>
                Trabajado: <b>{Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m</b>{" "}
                de{" "}
                <b>{Math.floor(scheduledMinutesTotal / 60)}h {scheduledMinutesTotal % 60}m</b>
                {checkOutAt ? " • (Día cerrado ✅)" : ""}
              </p>

              <div
                style={{
                  height: 14,
                  borderRadius: 999,
                  border: "1px solid var(--stroke)",
                  background: "rgba(255,255,255,.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg, rgba(99,102,241,.9), rgba(236,72,153,.85), rgba(245,158,11,.85))",
                  }}
                />
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                {Math.round(progressPct)}% del día
              </div>
            </>
          )}
        </Card>
      </div>
      <Card className="tri-card">
  <div className="tri-card-header">
    <div>
      <h3 style={{ marginTop: 0 }}>🧩 Tareas pendientes</h3>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
        Solo tus tareas abiertas
      </p>
    </div>
    <span className="tri-badge">{tasks.length}</span>
  </div>

  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
    {tasksLoading ? (
      <div className="muted">Cargando…</div>
    ) : tasks.length === 0 ? (
      <div className="muted">No tienes tareas pendientes ✅</div>
    ) : (
      tasks.map((t) => (
        <div
          key={t.id}
          style={{
            border: "1px solid var(--stroke)",
            background: "var(--panel2)",
            borderRadius: 16,
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 900 }}>{t.title}</div>
            {t.description && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {t.description}
              </div>
            )}
            {t.dueDate && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                📌 Vence: <b>{t.dueDate}</b>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            onClick={async () => {
              const u = auth.currentUser;
              if (!u) return;
              await updateDoc(doc(db, "tasks", t.id), {
                status: "done",
                doneAt: serverTimestamp(),
                doneByUid: u.uid,
                updatedAt: serverTimestamp(),
              });
            }}
          >
            ✅ Marcar concluida
          </Button>
        </div>
      ))
    )}
  </div>
</Card>

    </Shell>
  );
}
