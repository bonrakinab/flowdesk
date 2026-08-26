"use client";

import {
  Suspense,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Mark, mergeAttributes, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { format, parseISO } from "date-fns";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pin,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
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

type TextAlignment = "left" | "center" | "right" | "justify";

const MOODS: { id: string; label: string; tint: string }[] = [
  { id: "calm", label: "Calm", tint: "rgba(13,148,136,0.08)" },
  { id: "focus", label: "Focus", tint: "rgba(217,119,6,0.08)" },
  { id: "warm", label: "Warm", tint: "rgba(225,29,72,0.06)" },
  { id: "neutral", label: "Neutral", tint: "rgba(28,25,23,0.03)" },
];

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const InlineTextStyle = Mark.create({
  name: "textStyle",
  priority: 101,

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily.replace(/["']/g, "") || null,
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
      },
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { fontFamily, fontSize, color, backgroundColor, ...rest } = HTMLAttributes;
    const style = [
      fontFamily ? `font-family: ${fontFamily}` : null,
      fontSize ? `font-size: ${fontSize}` : null,
      color ? `color: ${color}` : null,
      backgroundColor ? `background-color: ${backgroundColor}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    return ["span", mergeAttributes(rest, style ? { style } : {}), 0];
  },
});

const BlockFormatting = Extension.create({
  name: "blockFormatting",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) =>
              attributes.textAlign
                ? { style: `text-align: ${attributes.textAlign}` }
                : {},
          },
        },
      },
    ];
  },
});

function moodTint(mood: string | null) {
  return MOODS.find((m) => m.id === mood)?.tint || MOODS[3].tint;
}

function parseNoteContent(content: string): JSONContent | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as JSONContent;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Older/plain-text notes fall through to a safe paragraph document.
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: content ? [{ type: "text", text: content }] : undefined,
      },
    ],
  };
}

function ToolbarButton({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md border text-foreground transition",
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-transparent hover:border-border hover:bg-black/5",
        disabled && "cursor-not-allowed opacity-35"
      )}
    >
      {children}
    </button>
  );
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
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      InlineTextStyle,
      BlockFormatting,
    ],
    content: parseNoteContent(note.content),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: "true",
        class: "focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave({ content: JSON.stringify(ed.getJSON()) });
      }, 800);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const selectClass =
    "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-accent";

  const textStyleAttributes = editor?.getAttributes("textStyle") || {};
  const currentBlock = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";
  const currentAlignment = editor?.isActive("heading")
    ? editor.getAttributes("heading").textAlign || "left"
    : editor?.getAttributes("paragraph").textAlign || "left";

  function setTextStyleAttribute(
    attribute: "fontFamily" | "fontSize" | "color" | "backgroundColor",
    value: string | null
  ) {
    if (!editor) return;
    const current = editor.getAttributes("textStyle");
    editor
      .chain()
      .focus()
      .setMark("textStyle", { ...current, [attribute]: value })
      .run();
  }

  function setTextAlignment(alignment: TextAlignment | null) {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .command(({ state, tr }) => {
        const { from, to, $from } = state.selection;
        let changed = false;

        const updateNode = (node: typeof $from.parent, pos: number) => {
          if (node.type.name !== "paragraph" && node.type.name !== "heading") {
            return;
          }
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            textAlign: alignment,
          });
          changed = true;
        };

        if (from === to) {
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              updateNode(node, $from.before(depth));
              break;
            }
          }
        } else {
          state.doc.nodesBetween(from, to, (node, pos) => {
            updateNode(node, pos);
          });
        }

        return changed;
      })
      .run();
  }

  function editLink() {
    if (!editor) return;
    const previous = (editor.getAttributes("link").href as string | undefined) || "https://";
    const href = window.prompt("Link URL", previous);
    if (href === null) return;
    const trimmed = href.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  function clearFormatting() {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
    setTextAlignment(null);
  }

  return (
    <div
      className="paper-surface flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border"
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

      <div className="border-b border-border/60 bg-background/55 px-3 py-2 backdrop-blur-sm">
        <div className="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
          <div className="flex min-w-max flex-wrap items-center gap-1 md:min-w-0">
            <select
              aria-label="Paragraph style"
              title="Paragraph style"
              value={currentBlock}
              onChange={(e) => {
                if (!editor) return;
                const value = e.target.value;
                if (value === "paragraph") {
                  editor.chain().focus().setParagraph().run();
                } else {
                  const level = Number(value.slice(1)) as 1 | 2 | 3;
                  editor.chain().focus().setHeading({ level }).run();
                }
              }}
              className={cn(selectClass, "w-28")}
            >
              <option value="paragraph">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            <select
              aria-label="Font family"
              title="Font family"
              value={(textStyleAttributes.fontFamily as string | undefined) || ""}
              onChange={(e) =>
                setTextStyleAttribute("fontFamily", e.target.value || null)
              }
              className={cn(selectClass, "w-36")}
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Font size"
              title="Font size"
              value={(textStyleAttributes.fontSize as string | undefined) || "16px"}
              onChange={(e) => setTextStyleAttribute("fontSize", e.target.value)}
              className={cn(selectClass, "w-20")}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size.replace("px", "")}
                </option>
              ))}
            </select>

            <span className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
              title="Bold"
              active={Boolean(editor?.isActive("bold"))}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Italic"
              active={Boolean(editor?.isActive("italic"))}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Underline"
              active={Boolean(editor?.isActive("underline"))}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Strikethrough"
              active={Boolean(editor?.isActive("strike"))}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={15} />
            </ToolbarButton>

            <label
              className="relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent text-xs font-bold hover:border-border hover:bg-black/5"
              title="Text color"
            >
              A
              <span
                className="absolute bottom-1 left-1 right-1 h-0.5 rounded-full"
                style={{
                  backgroundColor:
                    (textStyleAttributes.color as string | undefined) || "#1c1917",
                }}
              />
              <input
                type="color"
                aria-label="Text color"
                value={(textStyleAttributes.color as string | undefined) || "#1c1917"}
                onChange={(e) => setTextStyleAttribute("color", e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>

            <label
              className="relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent text-[11px] font-semibold hover:border-border hover:bg-black/5"
              title="Highlight color"
            >
              HL
              <span
                className="absolute bottom-1 left-1 right-1 h-1 rounded-sm"
                style={{
                  backgroundColor:
                    (textStyleAttributes.backgroundColor as string | undefined) ||
                    "#fff2a8",
                }}
              />
              <input
                type="color"
                aria-label="Highlight color"
                value={
                  (textStyleAttributes.backgroundColor as string | undefined) ||
                  "#fff2a8"
                }
                onChange={(e) =>
                  setTextStyleAttribute("backgroundColor", e.target.value)
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>

            <span className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
              title="Align left"
              active={currentAlignment === "left"}
              onClick={() => setTextAlignment("left")}
            >
              <AlignLeft size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Align center"
              active={currentAlignment === "center"}
              onClick={() => setTextAlignment("center")}
            >
              <AlignCenter size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Align right"
              active={currentAlignment === "right"}
              onClick={() => setTextAlignment("right")}
            >
              <AlignRight size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Justify"
              active={currentAlignment === "justify"}
              onClick={() => setTextAlignment("justify")}
            >
              <AlignJustify size={15} />
            </ToolbarButton>

            <span className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
              title="Bulleted list"
              active={Boolean(editor?.isActive("bulletList"))}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Numbered list"
              active={Boolean(editor?.isActive("orderedList"))}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Block quote"
              active={Boolean(editor?.isActive("blockquote"))}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={15} />
            </ToolbarButton>

            <span className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
              title="Add or edit link"
              active={Boolean(editor?.isActive("link"))}
              onClick={editLink}
            >
              <Link2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Remove link"
              disabled={!editor?.isActive("link")}
              onClick={() =>
                editor?.chain().focus().extendMarkRange("link").unsetLink().run()
              }
            >
              <Unlink size={15} />
            </ToolbarButton>
            <ToolbarButton title="Clear formatting" onClick={clearFormatting}>
              <Eraser size={15} />
            </ToolbarButton>

            <span className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
              title="Undo"
              disabled={!editor?.can().chain().focus().undo().run()}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              disabled={!editor?.can().chain().focus().redo().run()}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={15} />
            </ToolbarButton>
          </div>
        </div>
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
        <EditorContent
          editor={editor}
          className="max-w-none text-[16px] leading-7 [&_.ProseMirror]:min-h-[52vh] [&_.ProseMirror]:outline-none [&_.ProseMirror_a]:cursor-pointer [&_.ProseMirror_a]:text-accent [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-accent/40 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ol]:my-3 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_ul]:my-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6"
        />
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
