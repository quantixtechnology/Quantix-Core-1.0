"use client"

import { useEffect, useState } from "react"
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Node as TiptapNode } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, TableIcon, Tag, Scissors, Settings2, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Merge tags ───────────────────────────────────────────────────────────────

const MERGE_TAGS = [
  { label: "Name",      tag: "{{CandidateName}}" },
  { label: "Role",      tag: "{{Designation}}" },
  { label: "Join Date", tag: "{{JoiningDate}}" },
  { label: "Manager",   tag: "{{ReportingManager}}" },
  { label: "Location",  tag: "{{WorkLocation}}" },
  { label: "Dept",      tag: "{{Department}}" },
  { label: "Emp Type",  tag: "{{EmploymentType}}" },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

interface PageBreakViewProps {
  node: { attrs: { spaceBefore: number; spaceAfter: number } }
  updateAttributes: (attrs: { spaceBefore?: number; spaceAfter?: number }) => void
  deleteNode: () => void
  editor: { isEditable: boolean }
}

// ─── Page Break Node View ─────────────────────────────────────────────────────
//
// Renders a rich visual separator inside the TipTap editor.
// spaceBefore / spaceAfter are editor-only attrs — they never appear in the
// stored {{PAGE_BREAK}} token output (see renderHTML below).

function PageBreakNodeView({ node, updateAttributes, deleteNode, editor }: PageBreakViewProps) {
  const [showSettings, setShowSettings] = useState(false)
  const spaceBefore = node.attrs.spaceBefore ?? 40
  const spaceAfter  = node.attrs.spaceAfter  ?? 40
  const editable    = editor.isEditable

  return (
    <NodeViewWrapper contentEditable={false} className="pb-wrapper">

      {/* ── Space before ──────────────────────────────────────────────────── */}
      <div className="pb-space pb-space-before" style={{ height: spaceBefore }}>
        <span className="pb-space-label">↑ {spaceBefore}px before break</span>
      </div>

      {/* ── Main visual block ─────────────────────────────────────────────── */}
      <div className="pb-block">

        {/* "Page 1 ends" row */}
        <div className="pb-edge pb-edge-top">
          <div className="pb-rule" />
          <span className="pb-edge-label">Page 1 Ends Here</span>
          <div className="pb-rule" />
        </div>

        {/* Center: badge + paper-gap strip */}
        <div className="pb-core">
          <div className="pb-badge">
            <Scissors className="pb-badge-icon" />
            <span>PAGE BREAK</span>
          </div>
          <div className="pb-gap-strip" title="Visual representation of the physical page gap" />
        </div>

        {/* "Page 2 starts" row */}
        <div className="pb-edge pb-edge-bottom">
          <div className="pb-rule" />
          <span className="pb-edge-label">Page 2 Starts Below</span>
          <div className="pb-rule" />
        </div>

        {/* Settings gear — only visible when editable */}
        {editable && (
          <button
            className="pb-gear"
            title="Page break settings"
            onMouseDown={e => { e.preventDefault(); setShowSettings(s => !s) }}
          >
            <Settings2 size={11} />
          </button>
        )}
      </div>

      {/* ── Settings panel (inline, toggles on gear click) ────────────────── */}
      {showSettings && (
        <div className="pb-panel">
          <div className="pb-panel-hd">
            <span>Page Break Settings</span>
            <button onMouseDown={e => { e.preventDefault(); setShowSettings(false) }}>✕</button>
          </div>
          <div className="pb-panel-body">
            <p className="pb-panel-hint">
              Space values affect the editor preview only — they are not stored
              in the template and do not change print or PDF output.
            </p>
            <div className="pb-field">
              <label>Space Before</label>
              <div className="pb-numfield">
                <input
                  type="number"
                  value={spaceBefore}
                  min={0}
                  max={300}
                  step={8}
                  onChange={e =>
                    updateAttributes({ spaceBefore: Math.max(0, Number(e.target.value)) })
                  }
                />
                <span className="pb-unit">px</span>
              </div>
            </div>
            <div className="pb-field">
              <label>Space After</label>
              <div className="pb-numfield">
                <input
                  type="number"
                  value={spaceAfter}
                  min={0}
                  max={300}
                  step={8}
                  onChange={e =>
                    updateAttributes({ spaceAfter: Math.max(0, Number(e.target.value)) })
                  }
                />
                <span className="pb-unit">px</span>
              </div>
            </div>
          </div>
          <div className="pb-panel-ft">
            <button
              className="pb-delete"
              onMouseDown={e => {
                e.preventDefault()
                deleteNode()
                setShowSettings(false)
              }}
            >
              <Trash2 size={10} />
              Delete Page Break
            </button>
          </div>
        </div>
      )}

      {/* ── Space after ───────────────────────────────────────────────────── */}
      <div className="pb-space pb-space-after" style={{ height: spaceAfter }}>
        <span className="pb-space-label">↓ {spaceAfter}px after break</span>
      </div>

    </NodeViewWrapper>
  )
}

// ─── Page Break TipTap Extension ─────────────────────────────────────────────
//
// priority: 200 ensures parseHTML runs before StarterKit's paragraph rule,
// so <p>{{PAGE_BREAK}}</p> is captured as a pageBreak node, not a paragraph.

const PageBreakExtension = TiptapNode.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,      // non-editable; cursor goes before/after but not inside
  selectable: true, // can be selected and deleted with the keyboard
  draggable: false,
  priority: 200,

  addAttributes() {
    return {
      spaceBefore: { default: 40 },
      spaceAfter:  { default: 40 },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'p',
        getAttrs: (el) => {
          const text = (el as HTMLElement).textContent?.trim()
          // Return {} (match) only for <p>{{PAGE_BREAK}}</p>; false = skip
          return text === '{{PAGE_BREAK}}' ? {} : false
        },
      },
    ]
  },

  renderHTML() {
    // spaceBefore / spaceAfter are deliberately omitted — they are editor-only
    // and must never appear in the stored template content.
    return ['p', {}, '{{PAGE_BREAK}}']
  },

  addNodeView() {
    // Cast needed: ReactNodeViewRenderer expects its own internal prop type,
    // but PageBreakNodeView uses a narrower typed interface for clarity.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ReactNodeViewRenderer(PageBreakNodeView as React.ComponentType<any>)
  },
})

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      PageBreakExtension,
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

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
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
        <ToolBtn
          title="Insert Page Break — content below starts on a new page in Print and PDF"
          onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}
        >
          <Scissors className="h-3.5 w-3.5" />
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

      {/* ── Editor ───────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Existing editor styles ──────────────────────────────────────── */
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

        /* ── Page Break Node View ────────────────────────────────────────── */

        /* Outer wrapper — no default margin so spaceBefore/spaceAfter are exact */
        .tiptap-editor .pb-wrapper {
          display: block;
          user-select: none;
        }

        /* ── Space before / after (striped "paper edge" zones) ────────────── */
        .tiptap-editor .pb-space {
          position: relative;
          min-height: 8px;
          background: repeating-linear-gradient(
            45deg,
            #f8fafc 0px, #f8fafc 5px,
            #f1f5f9 5px, #f1f5f9 10px
          );
        }
        .tiptap-editor .pb-space-label {
          position: absolute;
          right: 10px;
          bottom: 3px;
          font-size: 9px;
          font-family: 'Courier New', monospace;
          color: #94a3b8;
          letter-spacing: 0.04em;
          pointer-events: none;
        }
        .tiptap-editor .pb-space-after .pb-space-label {
          bottom: auto;
          top: 3px;
        }

        /* ── Main block ──────────────────────────────────────────────────── */
        .tiptap-editor .pb-block {
          position: relative;
          border: 1.5px dashed #94a3b8;
          border-radius: 4px;
          background: #f8fafc;
          cursor: default;
        }
        .tiptap-editor .ProseMirror-selectednode .pb-block,
        .tiptap-editor .pb-block:focus-within {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        /* ── Edge rows (top = Page 1 ends, bottom = Page 2 starts) ─────── */
        .tiptap-editor .pb-edge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
        }
        .tiptap-editor .pb-rule {
          flex: 1;
          height: 1px;
          background: #cbd5e1;
        }
        .tiptap-editor .pb-edge-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #64748b;
          white-space: nowrap;
        }

        /* ── Center: badge + paper-gap strip ────────────────────────────── */
        .tiptap-editor .pb-core {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 2px 16px 6px;
        }
        .tiptap-editor .pb-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #1e3a8a;
          color: #fff;
          padding: 3px 12px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .tiptap-editor .pb-badge-icon {
          width: 10px;
          height: 10px;
          flex-shrink: 0;
        }
        /* Striped strip representing the physical paper gap */
        .tiptap-editor .pb-gap-strip {
          width: 100%;
          height: 10px;
          border-radius: 2px;
          background: repeating-linear-gradient(
            90deg,
            #e2e8f0 0px, #e2e8f0 6px,
            #f1f5f9 6px, #f1f5f9 12px
          );
          opacity: 0.9;
        }

        /* ── Gear settings button ────────────────────────────────────────── */
        .tiptap-editor .pb-gear {
          position: absolute;
          top: 5px;
          right: 7px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 2px 3px;
          border-radius: 3px;
          line-height: 1;
          transition: color 0.15s, background 0.15s;
        }
        .tiptap-editor .pb-gear:hover {
          color: #334155;
          background: #e2e8f0;
        }

        /* ── Settings panel ──────────────────────────────────────────────── */
        .tiptap-editor .pb-panel {
          margin-top: 1px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10);
          font-size: 11px;
          overflow: hidden;
        }
        .tiptap-editor .pb-panel-hd {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }
        .tiptap-editor .pb-panel-hd button {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          font-size: 13px;
          line-height: 1;
          padding: 0 2px;
        }
        .tiptap-editor .pb-panel-hd button:hover { color: #374151; }
        .tiptap-editor .pb-panel-body {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tiptap-editor .pb-panel-hint {
          font-size: 9.5px;
          color: #94a3b8;
          line-height: 1.45;
          margin: 0 0 4px;
          font-style: italic;
        }
        .tiptap-editor .pb-field {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .tiptap-editor .pb-field label {
          font-size: 11px;
          color: #374151;
          font-weight: 500;
          cursor: default;
        }
        .tiptap-editor .pb-numfield {
          display: flex;
          align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 3px;
          overflow: hidden;
          background: #fff;
        }
        .tiptap-editor .pb-numfield input {
          width: 52px;
          border: none;
          outline: none;
          padding: 3px 6px;
          font-size: 11px;
          color: #0f172a;
          background: transparent;
          text-align: right;
        }
        .tiptap-editor .pb-unit {
          font-size: 9px;
          color: #94a3b8;
          padding: 0 6px 0 2px;
          font-family: monospace;
        }
        .tiptap-editor .pb-panel-ft {
          padding: 6px 12px 10px;
          border-top: 1px solid #f1f5f9;
        }
        .tiptap-editor .pb-delete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          width: 100%;
          padding: 5px 8px;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 3px;
          color: #dc2626;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.02em;
        }
        .tiptap-editor .pb-delete:hover {
          background: #fecaca;
          border-color: #fca5a5;
        }
      `}</style>

      <div className="tiptap-editor flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
