"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Archive, Search, Trash2, RefreshCw, FileText, FileCheck,
  FileBadge, FileSignature, Receipt, File, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentRecord {
  id: string
  proposalId: string
  documentType: string
  businessName: string
  clientName: string
  contactPhone: string | null
  contactEmail: string | null
  salesTeamMember: string | null
  salesTeamEmail: string | null
  totalAmount: number | null
  pdfVersion: number
  createdBy: string
  createdByName: string | null
  createdAt: string
}

const DOC_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "QUOTE", label: "Quote" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "AGREEMENT", label: "Agreement" },
  { value: "RENEWAL", label: "Renewal" },
  { value: "INVOICE", label: "Invoice" },
  { value: "OTHER", label: "Other" },
]

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  QUOTE:     <FileText    className="h-3.5 w-3.5" />,
  PROPOSAL:  <FileBadge   className="h-3.5 w-3.5" />,
  AGREEMENT: <FileSignature className="h-3.5 w-3.5" />,
  RENEWAL:   <RefreshCw   className="h-3.5 w-3.5" />,
  INVOICE:   <Receipt     className="h-3.5 w-3.5" />,
  OTHER:     <File        className="h-3.5 w-3.5" />,
}

const DOC_TYPE_COLORS: Record<string, string> = {
  QUOTE:     "bg-sky-100 text-sky-700 border-sky-200",
  PROPOSAL:  "bg-blue-100 text-blue-700 border-blue-200",
  AGREEMENT: "bg-violet-100 text-violet-700 border-violet-200",
  RENEWAL:   "bg-amber-100 text-amber-700 border-amber-200",
  INVOICE:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  OTHER:     "bg-slate-100 text-slate-600 border-slate-200",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatINR(val: number | null) {
  if (!val) return "—"
  return `₹${val.toLocaleString("en-IN")}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Center View
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentCenterView() {
  const { permissions } = useAuthStore()
  const canDelete = (permissions as string[]).includes("documents:delete")

  const [documents, setDocuments]       = useState<DocumentRecord[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState("")
  const [docType, setDocType]           = useState("")
  const [page, setPage]                 = useState(1)
  const [totalPages, setTotalPages]     = useState(1)
  const [total, setTotal]               = useState(0)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [deleting, setDeleting]         = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)  params.set("search", search)
      if (docType) params.set("type", docType)
      params.set("page", String(page))
      params.set("limit", "15")

      const res  = await authFetch(`/api/admin/documents?${params}`)
      const json = await res.json()
      if (json.success) {
        setDocuments(json.data)
        setTotalPages(json.pagination.pages)
        setTotal(json.pagination.total)
      }
    } catch {
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [search, docType, page])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1) }, [search, docType])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === documents.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(documents.map(d => d.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    if (selected.size === 0) return
    setDeleting(true)
    let failed = 0
    for (const id of selected) {
      try {
        await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" })
      } catch {
        failed++
      }
    }
    setDeleting(false)
    setSelected(new Set())
    if (failed > 0) toast.error(`${failed} deletion(s) failed`)
    else toast.success(`${selected.size} document(s) deleted`)
    fetchDocuments()
  }

  const handleDeleteOne = async (id: string) => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    try {
      await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" })
      toast.success("Document deleted")
      fetchDocuments()
    } catch {
      toast.error("Failed to delete document")
    }
  }

  const allSelected = documents.length > 0 && selected.size === documents.length
  const anySelected = selected.size > 0

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Document Center"
        description="Centralized repository for all generated proposals, quotes, and agreements"
        icon={Archive}
        action={
          canDelete && anySelected ? (
            <Button
              variant="destructive" className="gap-2"
              onClick={handleBulkDelete} disabled={deleting}
            >
              {deleting
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
              {deleting ? "Deleting…" : `Delete ${selected.size} Selected`}
            </Button>
          ) : undefined
        }
      />

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mt-4 mb-4">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <Archive className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Documents</p>
            <p className="text-lg font-bold leading-none">{total}</p>
          </div>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchDocuments} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-xs"
            placeholder="Search by proposal ID, business name, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {canDelete && (
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Business Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Document Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created By</th>
                {canDelete && (
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {canDelete && <td className="px-4 py-3"><div className="h-4 w-4 bg-muted animate-pulse rounded" /></td>}
                    {Array.from({ length: canDelete ? 8 : 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-muted animate-pulse rounded" style={{ width: `${60 + (j * 10) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 9 : 8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                        <FileCheck className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">No documents yet</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Generate and save proposals from the Quote &amp; Proposals builder to see them here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : documents.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className={`border-b transition-colors hover:bg-muted/30 ${
                    selected.has(doc.id) ? "bg-blue-50/60" : idx % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  {canDelete && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="rounded border-border cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {doc.proposalId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-xs text-foreground">{doc.businessName}</p>
                      {doc.clientName && <p className="text-[10px] text-muted-foreground">{doc.clientName}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {doc.contactPhone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 font-semibold ${DOC_TYPE_COLORS[doc.documentType] ?? DOC_TYPE_COLORS.OTHER}`}
                    >
                      {DOC_TYPE_ICONS[doc.documentType] ?? DOC_TYPE_ICONS.OTHER}
                      {doc.documentType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {formatINR(doc.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-medium">{doc.createdByName || "—"}</p>
                      {doc.salesTeamMember && doc.salesTeamMember !== doc.createdByName && (
                        <p className="text-[10px] text-muted-foreground">{doc.salesTeamMember}</p>
                      )}
                    </div>
                  </td>
                  {canDelete && (
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteOne(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 shrink-0">
            <p className="text-xs text-muted-foreground">
              Showing {documents.length} of {total} documents
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2 font-medium">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
