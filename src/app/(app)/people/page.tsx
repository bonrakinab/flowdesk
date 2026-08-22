"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
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

type Contact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  notes: string | null;
  tickets: Ticket[];
};

const emptyForm = {
  name: "",
  email: "",
  company: "",
  phone: "",
  notes: "",
};

export default function PeoplePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/contacts");
    if (res.ok) {
      const data: Contact[] = await res.json();
      setContacts(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const selected = contacts.find((c) => c.id === selectedId) || filtered[0] || null;

  const openTickets = contacts.reduce((n, c) => n + c.tickets.length, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      email: form.email || null,
      company: form.company || null,
      phone: form.phone || null,
      notes: form.notes || null,
      ...(editing ? { id: editing } : {}),
    };
    const res = await fetch("/api/contacts", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = await res.json();
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      await load();
      setSelectedId(saved.id || editing);
    }
  }

  function startEdit(c: Contact) {
    setEditing(c.id);
    setForm({
      name: c.name,
      email: c.email || "",
      company: c.company || "",
      phone: c.phone || "",
      notes: c.notes || "",
    });
    setShowForm(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    await fetch("/api/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-6xl">
        <PageHeader
          eyebrow="CRM lite"
          title="People"
          description="Contacts linked to tickets and follow-ups."
          actions={
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              <Plus size={16} />
              Add contact
            </Button>
          }
        />

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatChip label="Contacts" value={contacts.length} />
          <StatChip label="Open follow-ups" value={openTickets} />
          <StatChip
            label="With company"
            value={contacts.filter((c) => c.company).length}
          />
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
                  title={editing ? "Edit contact" : "New contact"}
                  description="Name is required."
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
                    <Field label="Full name">
                      <Input
                        required
                        placeholder="Jordan Lee"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        placeholder="jordan@company.com"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Company">
                      <Input
                        placeholder="Northwind"
                        value={form.company}
                        onChange={(e) =>
                          setForm({ ...form, company: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        placeholder="+1 555 0100"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Notes" className="sm:col-span-2">
                      <Textarea
                        placeholder="Context, preferences, last conversation…"
                        value={form.notes}
                        onChange={(e) =>
                          setForm({ ...form, notes: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit">
                      {editing ? "Save changes" : "Create contact"}
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
          <Panel>
            <div className="animate-pulse space-y-3 py-2">
              <div className="h-4 w-40 rounded bg-stone-200/80" />
              <div className="h-16 rounded-2xl bg-stone-100" />
              <div className="h-16 rounded-2xl bg-stone-100" />
            </div>
          </Panel>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<User size={22} />}
            title="No people yet"
            description="No contacts yet."
            action={
              <Button
                onClick={() => {
                  setShowForm(true);
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                <Plus size={16} />
                Add your first contact
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Panel padded={false} className="overflow-hidden">
              <div className="border-b border-border/70 p-4">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <Input
                    className="pl-9"
                    placeholder="Search people…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <ul className="max-h-[70vh] overflow-auto scrollbar-thin p-2">
                {filtered.map((c) => {
                  const active = (selected?.id || selectedId) === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          active
                            ? "bg-accent-soft/80 shadow-sm"
                            : "hover:bg-stone-900/[0.03]"
                        }`}
                      >
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-semibold ${
                            active
                              ? "bg-accent text-white"
                              : "bg-stone-900/5 text-foreground dark:bg-white/10"
                          }`}
                        >
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {c.company || c.email || "No company"}
                          </div>
                        </div>
                        {c.tickets.length > 0 && (
                          <Badge tone="warm">{c.tickets.length}</Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {selected && (
              <Panel>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-accent to-[#115e59] text-xl font-semibold text-white shadow-[0_12px_30px_rgba(13,148,136,0.35)]">
                      {selected.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
                        {selected.name}
                      </h2>
                      {selected.company && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
                          <Building2 size={14} />
                          {selected.company}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selected.email && (
                          <a
                            href={`mailto:${selected.email}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-foreground hover:border-accent/40 dark:bg-white/5"
                          >
                            <Mail size={12} />
                            {selected.email}
                          </a>
                        )}
                        {selected.phone && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-foreground dark:bg-white/5">
                            <Phone size={12} />
                            {selected.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(selected)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(selected.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {selected.notes && (
                  <div className="mt-6 rounded-2xl border border-border/70 bg-stone-900/[0.02] px-4 py-3 text-sm leading-relaxed text-foreground/90 dark:bg-white/5">
                    {selected.notes}
                  </div>
                )}

                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Open tickets
                    </h3>
                    <Badge tone="accent">{selected.tickets.length}</Badge>
                  </div>
                  {selected.tickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                      No open tickets linked to this person.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selected.tickets.map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/tickets/${t.id}`}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl border border-border/70 bg-white/50 px-4 py-3 transition hover:border-accent/35 hover:bg-accent-soft/40",
                              priorityGlowClass(t.priority, {
                                done: t.status === "Done",
                              })
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium group-hover:text-accent">
                                {t.title}
                              </div>
                            </div>
                            <Badge className={priorityBadgeClass(t.priority)}>
                              {t.priority}
                            </Badge>
                            <Badge>{t.status}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
