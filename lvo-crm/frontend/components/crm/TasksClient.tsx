"use client";

import { useEffect, useState } from "react";

import { useCrmToast } from "@/components/crm/CrmToast";
import { apiFetch } from "@/lib/api";
import { canMutate, normalizeRole } from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";

export type CrmTask = {
  id: number;
  title: string;
  dueDate: string | null;
  dueHour: number | null;
  dueMinute: number | null;
  done: boolean;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
};

function formatDueLabel(task: CrmTask): string | null {
  if (!task.dueDate) return null;
  if (task.dueHour != null && task.dueMinute != null) {
    const hh = String(task.dueHour).padStart(2, "0");
    const mm = String(task.dueMinute).padStart(2, "0");
    return `${task.dueDate} ${hh}:${mm}`;
  }
  return task.dueDate;
}

function parseDueTimeInput(value: string): { dueHour: number | null; dueMinute: number | null } {
  if (!value) return { dueHour: null, dueMinute: null };
  const [h, m] = value.split(":").map((x) => Number(x));
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    return { dueHour: null, dueMinute: null };
  }
  return { dueHour: h, dueMinute: m };
}

export function TasksClient() {
  const toast = useCrmToast();
  const mutate = canMutate(normalizeRole(readRole()));
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const token = readToken();
    const data = (await apiFetch("/api/tasks", { token })) as CrmTask[] | null;
    setTasks(Array.isArray(data) ? data : []);
  }

  function taskErrorMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (/not found/i.test(msg)) {
      return "Tâche introuvable — la liste a été actualisée (redémarrage API ?).";
    }
    return msg;
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (err) {
        toast.error(taskErrorMessage(err));
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!mutate || !title.trim()) return;
    try {
      const time = dueDate ? parseDueTimeInput(dueTime) : { dueHour: null, dueMinute: null };
      await apiFetch("/api/tasks", {
        method: "POST",
        token: readToken(),
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || null,
          dueHour: time.dueHour,
          dueMinute: time.dueMinute,
        }),
      });
      setTitle("");
      setDueDate("");
      setDueTime("");
      await reload();
      toast.success("Tâche ajoutée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function setTaskDone(task: CrmTask, done: boolean) {
    if (!mutate) return;
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done } : t)));
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        token: readToken(),
        body: JSON.stringify({ done }),
      });
      await reload();
      if (done) toast.success("Tâche terminée");
    } catch (err) {
      setTasks(prev);
      try {
        await reload();
      } catch {
        /* ignore secondary reload failure */
      }
      toast.error(taskErrorMessage(err));
    }
  }

  async function toggleDone(task: CrmTask) {
    await setTaskDone(task, !task.done);
  }

  async function removeTask(id: number) {
    if (!mutate) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE", token: readToken() });
      await reload();
      toast.info("Tâche supprimée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <>
      <header className="pg-hdr mb-4">
        <h1>Mes tâches</h1>
        <p>Suivi personnel — relances, validations et rappels métier.</p>
      </header>

      {mutate ? (
        <form className="fcard mb-4" onSubmit={(e) => void addTask(e)}>
          <div className="fcard-body flex flex-wrap items-end gap-3">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-[var(--navy)]">Intitulé</span>
              <input className="crm-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-[var(--navy)]">Échéance</span>
              <input className="crm-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-[var(--navy)]">Heure</span>
              <input
                className="crm-input"
                type="time"
                value={dueTime}
                disabled={!dueDate}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </label>
            <button type="submit" className="cbtn cbtn-orange cbtn-sm">
              Ajouter
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-sm text-neutral-600">Mode lecture seule — consultation des tâches existantes.</p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-600">Chargement…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ccard">
            <div className="ccard-title">À faire ({open.length})</div>
            {open.length === 0 ? (
              <p className="text-xs text-neutral-600">Rien en attente.</p>
            ) : (
              <ul className="task-list">
                {open.map((t) => {
                  const dueLabel = formatDueLabel(t);
                  return (
                  <li key={t.id} className="task-row">
                    <label className="task-check">
                      <input type="checkbox" checked={t.done} disabled={!mutate} onChange={() => void toggleDone(t)} />
                      <span>{t.title}</span>
                    </label>
                    {dueLabel ? <span className="task-due">{dueLabel}</span> : null}
                    {mutate ? (
                      <>
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          title="Déplacer vers Terminées"
                          onClick={() => void setTaskDone(t, true)}
                        >
                          Terminer
                        </button>
                        <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void removeTask(t.id)}>
                          ×
                        </button>
                      </>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="ccard">
            <div className="ccard-title">Terminées ({done.length})</div>
            {done.length === 0 ? (
              <p className="text-xs text-neutral-600">—</p>
            ) : (
              <ul className="task-list task-list--done">
                {done.map((t) => (
                  <li key={t.id} className="task-row">
                    <label className="task-check">
                      <input type="checkbox" checked={t.done} disabled={!mutate} onChange={() => void toggleDone(t)} />
                      <span>{t.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
