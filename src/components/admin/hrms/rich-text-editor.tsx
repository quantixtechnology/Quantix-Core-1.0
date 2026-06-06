"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, TableIcon, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"

const MERGE_TAGS = [
  { label: "Name",      tag: "{{CandidateName}}" },
  { label: "Role",      tag: "{{Designation}}" },
  { label: "Join Date", tag: "{{JoiningDate}}" },
  { label: "Manager",   tag: "{{ReportingManager}}" },
  { label: "Location",  tag: "{{WorkLocation}}" },
  { label: "Dept",      tag: "{{Department}}" },
  { label: "Emp Type",  tag: "{{EmploymentType}}" },
]

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

function ToolBtn({
  active, disabled, title, onClick, children,
}: {
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-3",
        "data-placeholder": placeholder ?? "Start writing…",
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || "")
    }
  }, [value, editor])

  if (!editor) return null

  const insertMergeTag = (tag: string) => {
    editor.chain().focus().insertContent(tag).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
        {/* Text formatting */}
        <ToolBtn
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>

        <Sep />

        {/* Headings */}
        <ToolBtn
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>

        <Sep />

        {/* Lists */}
        <ToolBtn
          title="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>

        <Sep />

        {/* Block elements */}
        <ToolBtn
          title="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          title="Insert Table"
          onClick={insertTable}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolBtn>

        <Sep />

        {/* Merge tags */}
        <div className="flex items-center gap-0.5 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground ml-0.5 shrink-0" />
          {MERGE_TAGS.map((m) => (
            <button
              key={m.tag}
              type="button"
              title={`Insert ${m.tag}`}
              onClick={() => insertMergeTag(m.tag)}
              className="h-6 px-1.5 text-[10px] font-mono rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors border border-amber-200"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor area */}
      <style>{`
        .tiptap-editor [data-placeholder]:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap-editor .prose table { border-collapse: collapse; width: 100%; }
        .tiptap-editor .prose table td,
        .tiptap-editor .prose table th { border: 1px solid #d1d5db; padding: 4px 8px; }
        .tiptap-editor .prose table th { background: #f3f4f6; font-weight: 600; }
        .tiptap-editor .prose hr { border-top: 2px solid #e5e7eb; margin: 1em 0; }
        .tiptap-editor .ProseMirror:focus { outline: none; }
      `}</style>
      <div className="tiptap-editor flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
