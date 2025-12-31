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
  where,
  limit,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Shell } from "@/components/ui/Shell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type UserRow = { uid: string; name: string; email: string };
type TaskRow = {
  id: string;
  assignedToUid: string;
  assignedToName?: string;
  title: string;
  description?: string | null;
  dueDate: string;
  status: "open" | "done";
  createdByUid: string;
};

export default function AdminTasksPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [filterUid, setFilterUid] = useState<string>("all");

  // form
  const [assignedToUid, setAssignedToUid] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // list
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const userMap = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.uid, u));
    return m;
  }, [users]);

  const loadUsers = async () => {
    // Simple: trae todos los users (si son muchos, luego paginamos)
    const snap = await getDocs(query(collection(db, "users"), limit(200)));
    const list: UserRow[] = snap.docs.map((d) => ({
      uid: d.id,
      name: (d.data().name as string) || "(sin nombre)",
      email: (d.data().email as string) || "",
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(list);
    if (!assignedToUid && list.length) setAssignedToUid(list[0].uid);
  };

  const loadTasks = async (uidFilter: string) => {
    const base = collection(db, "tasks");

    // Para evitar índices raros: armamos queries simples
    // - "all": solo orderBy(dueDate) + where(status==open) (puede pedir índice simple, casi nunca)
    // - por usuario: where(assignedToUid==X) + where(status==open) (sin orderBy) y ordenamos en cliente
    if (uidFilter === "all") {
      const q = query(base, where("status", "==", "open"), orderBy("dueDate", "asc"), limit(200));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TaskRow[];
      setTasks(rows);
      return;
    }

    const q = query(base, where("status", "==", "open"), where("assignedToUid", "==", uidFilter), limit(200));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TaskRow[];

    // orden en cliente por dueDate
    rows.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    setTasks(rows);
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

      setAdminUid(user.uid);

      await loadUsers();
      await loadTasks("all");

      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const createTask = async () => {
    if (!assignedToUid) return alert("Selecciona un colaborador.");
    if (!title.trim()) return alert("Pon un título.");
    if (!dueDate) return alert("Pon fecha límite.");

    try {
      setSaving(true);

      const u = userMap.get(assignedToUid);
      await addDoc(collection(db, "tasks"), {
        assignedToUid,
        assignedToName: u?.name || null,
        title: title.trim(),
        description: description.trim() || null,
        dueDate, // YYYY-MM-DD
        status: "open",
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setDescription("");
      setDueDate("");

      await loadTasks(filterUid);
      alert("Tarea creada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo crear. Revisa consola.");
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (taskId: string) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: "done",
        doneAt: serverTimestamp(),
      });
      await loadTasks(filterUid);
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como done.");
    }
  };

  if (loading) {
    return (
      <Shell title="TriangleRH" subtitle="RH Admin • Tareas">
        <p style={{ padding: 24, color: "var(--muted)" }}>Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="TriangleRH" subtitle="RH Admin • Tareas">
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Crear tarea</h2>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Se mostrará en el calendario del colaborador.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={() => router.push("/admin")}>
                ← Volver a RH Admin
              </Button>
              <Button variant="ghost" onClick={() => router.push("/calendar")}>
                📅 Ver mi calendario
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Asignar a</label>
              <select
                value={assignedToUid}
                onChange={(e) => setAssignedToUid(e.target.value)}
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
              >
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} {u.email ? `(${u.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Fecha límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar incidencias, enviar evidencia, etc."
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

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles extra…"
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

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={createTask} disabled={saving}>
              {saving ? "Creando..." : "Crear tarea"}
            </Button>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>Tareas pendientes</h3>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Filtra por colaborador y marca como done.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={filterUid}
                onChange={async (e) => {
                  const v = e.target.value;
                  setFilterUid(v);
                  await loadTasks(v);
                }}
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

              <Button variant="ghost" onClick={() => loadTasks(filterUid)}>
                ↻ Actualizar
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {tasks.map((t) => {
              const u = userMap.get(t.assignedToUid);
              return (
                <div
                  key={t.id}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid var(--stroke)",
                    background: "rgba(255,255,255,.04)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{t.title}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                        Asignado a: <b>{u?.name || t.assignedToName || t.assignedToUid}</b> • Límite: <b>{t.dueDate}</b>
                      </div>
                      {t.description && (
                        <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                          {t.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          border: "1px solid rgba(59,130,246,.25)",
                          background: "rgba(59,130,246,.12)",
                          color: "rgba(255,255,255,.85)",
                        }}
                      >
                        Pendiente
                      </span>

                      <Button onClick={() => markDone(t.id)}>
                        ✅ Done
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {tasks.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No hay tareas pendientes para este filtro.
              </div>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
