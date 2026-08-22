"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderKanban, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  StatChip,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { priorityGlowClass, priorityBadgeClass } from "@/lib/priority";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

type Project = {
  id: string;
  name: string;
  color: string;
  status: string;
  description: string | null;
  _count: { tickets: number };
  tickets: Ticket[];
};

const emptyForm = {
  name: "",
  color: "#0d9488",
  status: "active",
  description: "",
};

const PRESET_COLORS = [
  "#0d9488",
  "#c2410c",
  "#0284c7",
  "#e11d48",
  "#7c3aed",
  "#059669",
  "#ca8a04",
  "#334155",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      color: form.color,
      status: form.status,
      description: form.description || null,
      ...(editing ? { id: editing } : {}),
    };
    const res = await fetch("/api/projects", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      load();
    }
  }

  function startEdit(p: Project) {
    setEditing(p.id);
    setForm({
      name: p.name,
      color: p.color,
      status: p.status,
      description: p.description || "",
    });
    setShowForm(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this project?")) return;
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const activeCount = projects.filter((p) => p.status === "active").length;
  const ticketCount = projects.reduce((n, p) => n + p._count.tickets, 0);

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Areas of life"
          title="Projects"
          description="Areas with colors and open tickets."
          actions={
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              <Plus size={16} />
              New project
            </Button>
          }
        />

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatChip label="Projects" value={projects.length} />
          <StatChip label="Active" value={activeCount} />
          <StatChip label="Linked tickets" value={ticketCount} />
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6"
            >
              <Panel>
                <PanelHeader
                  title={editing ? "Edit project" : "Create project"}
                  description="Color shows on the board and calendar."
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowForm(false);
                        setEditing(null);
                      }}
                    >
                      <X size={16} />
                    </Button>
                  }
                />
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        required
                        placeholder="Home renovations"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={form.status}
                        onChange={(e) =>
                          setForm({ ...form, status: e.target.value })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="done">Done</option>
                      </Select>
                    </Field>
                    <Field label="Accent color" className="sm:col-span-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm({ ...form, color: c })}
                            className={cn(
                              "h-9 w-9 rounded-xl border-2 transition",
                              form.color === c
                                ? "border-stone-900 scale-105 shadow-md"
                                : "border-transparent opacity-90 hover:opacity-100"
                            )}
                            style={{ background: c }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                        <Input
                          type="color"
                          value={form.color}
                          onChange={(e) =>
                            setForm({ ...form, color: e.target.value })
                          }
                          className="h-9 w-14 cursor-pointer p-1"
                        />
                      </div>
                    </Field>
                    <Field label="Description" className="sm:col-span-2">
                      <Textarea
                        placeholder="What belongs in this lane?"
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">
                      {editing ? "Save changes" : "Create project"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowForm(false);
                        setEditing(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-3xl bg-stone-200/50"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={22} />}
            title="No projects yet"
            description="No projects yet."
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus size={16} />
                Create project
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Panel className="h-full !p-0 overflow-hidden">
                  <div
                    className="h-2 w-full"
                    style={{ background: p.color }}
                  />
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md"
                          style={{ background: p.color }}
                        >
                          <FolderKanban size={20} />
                        </div>
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
                            {p.name}
                          </h3>
                          {p.description && (
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {p.description}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              tone={
                                p.status === "active"
                                  ? "accent"
                                  : p.status === "done"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {p.status}
                            </Badge>
                            <Badge>{p._count.tickets} tickets</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => remove(p.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>

                    {p.tickets.length > 0 && (
                      <div className="mt-5 space-y-1.5 border-t border-border/70 pt-4">
                        {p.tickets.slice(0, 4).map((t) => (
                          <Link
                            key={t.id}
                            href={`/tickets/${t.id}`}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition hover:bg-stone-900/[0.03]",
                              priorityGlowClass(t.priority, {
                                done: t.status === "Done",
                              })
                            )}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: p.color }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {t.title}
                            </span>
                            <Badge className={priorityBadgeClass(t.priority)}>
                              {t.priority}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
