"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChefHat,
  ClipboardList,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
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
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  kind: "shopping" | "meal" | "chore";
  title: string;
  items: string[];
  note: string | null;
  user: { id: string; name: string | null; color: string };
};

const KIND_META: Record<
  Template["kind"],
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  shopping: { label: "Shopping list", icon: ShoppingCart },
  meal: { label: "Meal plan", icon: ChefHat },
  chore: { label: "Chore", icon: ClipboardList },
};

const emptyForm = {
  kind: "shopping" as Template["kind"],
  title: "",
  itemsText: "",
  note: "",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const items = form.itemsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        title: form.title.trim(),
        items,
        note: form.note || null,
      }),
    });
    if (res.ok) {
      setForm(emptyForm);
      setShowForm(false);
      await load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch("/api/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function apply(id: string) {
    setApplyingId(id);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, apply: true }),
      });
      if (res.ok) {
        const ticket = await res.json();
        router.push(`/tickets/${ticket.id}`);
      }
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="page-canvas mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Reusable"
          title="Templates"
          description="Reusable checklists that create a ticket when applied."
          actions={
            <Button
              onClick={() => {
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              <Plus size={16} />
              New template
            </Button>
          }
        />

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
                  title="New template"
                  description="Add one item per line."
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowForm(false)}
                    >
                      <X size={16} />
                    </Button>
                  }
                />
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Kind">
                      <Select
                        value={form.kind}
                        onChange={(e) =>
                          setForm({ ...form, kind: e.target.value as Template["kind"] })
                        }
                      >
                        <option value="shopping">Shopping list</option>
                        <option value="meal">Meal plan</option>
                        <option value="chore">Chore</option>
                      </Select>
                    </Field>
                    <Field label="Title">
                      <Input
                        required
                        placeholder="Weekly groceries"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Items"
                    hint="Each line becomes a checklist item when applied"
                  >
                    <Textarea
                      placeholder={"Milk\nEggs\nBread"}
                      value={form.itemsText}
                      onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
                      className="min-h-32"
                    />
                  </Field>
                  <Field label="Note (optional)">
                    <Input
                      placeholder="Extra context…"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit">Create template</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowForm(false)}
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
            </div>
          </Panel>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} />}
            title="No templates yet"
            description="No templates yet."
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus size={16} />
                Create your first template
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => {
              const meta = KIND_META[t.kind];
              const Icon = meta.icon;
              return (
                <Panel key={t.id} className="flex flex-col">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                        <Icon size={16} />
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{t.title}</div>
                        <Badge tone="neutral" className="mt-1">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="text-muted hover:text-danger p-1"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {t.items.length > 0 && (
                    <ul className="mb-3 space-y-1 text-sm text-muted">
                      {t.items.slice(0, 5).map((item, i) => (
                        <li key={i} className={cn("truncate")}>
                          · {item}
                        </li>
                      ))}
                      {t.items.length > 5 && (
                        <li className="text-xs">+{t.items.length - 5} more</li>
                      )}
                    </ul>
                  )}
                  {t.note && (
                    <p className="mb-3 text-xs text-muted leading-relaxed">{t.note}</p>
                  )}
                  <Button
                    variant="soft"
                    className="mt-auto w-full"
                    onClick={() => apply(t.id)}
                    disabled={applyingId === t.id}
                  >
                    {applyingId === t.id ? "Applying…" : "Apply → create ticket"}
                  </Button>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
