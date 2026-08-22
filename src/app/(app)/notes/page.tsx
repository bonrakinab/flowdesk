"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { format, parseISO } from "date-fns";
import { Pin, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Input, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  title: string;
  content: string;
  mood: string | null;
  pinned: boolean;
  folderId: string | null;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  lastEditedBy: { name: string | null } | null;
};

type Folder = { id: string; name: string };

const MOODS: { id: string; label: string; tint: string }[] = [
  { id: "calm", label: "Calm", tint: "rgba(13,148,136,0.08)" },
  { id: "focus", label: "Focus", tint: "rgba(217,119,6,0.08)" },
  { id: "warm", label: "Warm", tint: "rgba(225,29,72,0.06)" },
  { id: "neutral", label: "Neutral", tint: "rgba(28,25,23,0.03)" },
];

function moodTint(mood: string | null) {
  return MOODS.find((m) => m.id === mood)?.tint || MOODS[3].tint;
}

function NoteEditor({
  note,
  onSave,
  onDelete,
  onPin,
}: {
  note: Note;
  onSave: (data: Partial<Note>) => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState(note.title);
  const [mood, setMood] = useState(note.mood);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: note.content ? JSON.parse(note.content) : undefined,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave({ content: JSON.stringify(ed.getJSON()) });
      }, 800);
    },
  });

  useEffect(() => {
    setTitle(note.title);
    setMood(note.mood);
    if (editor && note.content) {
      editor.commands.setContent(JSON.parse(note.content));
    }
  }, [note.id, editor, note.title, note.mood, note.content]);

  return (
    <div
      className="paper-surface flex min-h-[70vh] flex-col rounded-2xl border border-border"
      style={{ backgroundColor: moodTint(mood) }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onSave({ title })}
          className="flex-1 border-0 bg-transparent px-0 text-lg font-semibold focus:ring-0"
        />
        <Button
          variant="ghost"
          className={cn(note.pinned && "text-accent")}
          onClick={onPin}
        >
          <Pin size={16} fill={note.pinned ? "currentColor" : "none"} />
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="px-5 py-2">
        <Label>Mood</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMood(m.id);
                onSave({ mood: m.id });
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs transition",
                mood === m.id
                  ? "bg-accent text-white"
                  : "bg-black/5 hover:bg-black/10"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-5 pb-8 pt-2">
        <EditorContent editor={editor} className="prose prose-stone max-w-none" />
      </div>
      <div className="border-t border-border/60 px-5 py-2 text-xs text-muted">
        {note.lastEditedBy?.name && `Edited by ${note.lastEditedBy.name} · `}
        {format(parseISO(note.updatedAt), "MMM d, h:mm a")}
      </div>
    </div>
  );
}

function NotesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/notes");
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes || []);
      setFolders(data.folders || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const filtered = notes.filter((n) =>
    folderFilter === null
      ? true
      : folderFilter === ""
        ? !n.folderId
        : n.folderId === folderFilter
  );

  const createNote = async () => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled", mood: "neutral" }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      router.push(`/notes?id=${note.id}`);
    }
  };

  const saveNote = async (id: string, data: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...data } : n))
    );
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    router.push("/notes");
  };

  const togglePin = async (note: Note) => {
    const pinned = !note.pinned;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned } : n))
    );
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
  };

  return (
    <div className="atmosphere min-h-full">
      <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-border bg-card/60 p-4 md:w-56 md:border-b-0 md:border-r">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-[family-name:var(--font-display)] text-xl">
              Notes
            </h1>
            <Button variant="ghost" onClick={createNote}>
              <Plus size={16} />
            </Button>
          </div>
          <nav className="space-y-1 text-sm">
            <button
              type="button"
              onClick={() => setFolderFilter(null)}
              className={cn(
                "block w-full rounded-lg px-2 py-1.5 text-left",
                folderFilter === null && "bg-accent/10 text-accent"
              )}
            >
              All notes
            </button>
            <button
              type="button"
              onClick={() => setFolderFilter("")}
              className={cn(
                "block w-full rounded-lg px-2 py-1.5 text-left",
                folderFilter === "" && "bg-accent/10 text-accent"
              )}
            >
              Unfiled
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderFilter(f.id)}
                className={cn(
                  "block w-full rounded-lg px-2 py-1.5 text-left",
                  folderFilter === f.id && "bg-accent/10 text-accent"
                )}
              >
                {f.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col md:flex-row">
          <div className="w-full border-b border-border p-4 md:w-64 md:border-b-0 md:border-r">
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                {filtered.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => router.push(`/notes?id=${n.id}`)}
                    className={cn(
                      "rounded-xl border border-border p-3 text-left transition hover:border-accent/40",
                      selectedId === n.id && "border-accent ring-1 ring-accent/30"
                    )}
                    style={{ backgroundColor: moodTint(n.mood) }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="line-clamp-1 text-sm font-medium">
                        {n.title}
                      </span>
                      {n.pinned && (
                        <Pin size={12} className="shrink-0 text-accent" />
                      )}
                    </div>
                    {n.mood && (
                      <Badge className="mt-1 bg-black/5 text-[10px]">
                        {n.mood}
                      </Badge>
                    )}
                    <div className="mt-1 text-[10px] text-muted">
                      {format(parseISO(n.updatedAt), "MMM d")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 md:p-6">
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                onSave={(data) => saveNote(selected.id, data)}
                onDelete={() => deleteNote(selected.id)}
                onPin={() => togglePin(selected)}
              />
            ) : (
              <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-border">
                <div className="text-center">
                  <p className="text-muted">Select a note or create one</p>
                  <Button className="mt-3" onClick={createNote}>
                    New note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading notes…</p>}>
      <NotesContent />
    </Suspense>
  );
}
