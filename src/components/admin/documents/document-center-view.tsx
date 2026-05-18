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
  ArchiveX, BookOpen,
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
  status: string
  businessName: string
  clientName: string
  contactPhone: string | null
  contactEmail: string | null
  leadId: string | null
  salesTeamMember: string | null
  salesTeamEmail: string | null
  totalAmount: number | null
  pdfVersion: number
  createdBy: string
  createdByName: string | null
  createdAt: string
  deletedAt: string | null
  deletedBy: string | null
}

const DOC_TYPE_OPTIONS = [
  { value: "",            label: "All Types" },
  { value: "QUOTE",       label: "Quote" },
  { value: "PROPOSAL",    label: "Proposal" },
  { value: "AGREEMENT",   label: "Agreement" },
  { value: "INVOICE",     label: "Invoice" },
  { value: "RENEWAL",     label: "Renewal" },
  { value: "ONBOARDING",  label: "Onboarding" },
  { value: "OTHER",       label: "Other" },
]

const STATUS_OPTIONS = [
  { value: "ACTIVE",   label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL",      label: "All" },
]

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  QUOTE:      <FileText      className="h-3.5 w-3.5" />,
  PROPOSAL:   <FileBadge     className="h-3.5 w-3.5" />,
  AGREEMENT:  <FileSignature className="h-3.5 w-3.5" />,
  INVOICE:    <Receipt       className="h-3.5 w-3.5" />,
  RENEWAL:    <RefreshCw     className="h-3.5 w-3.5" />,
  ONBOARDING: <BookOpen      className="h-3.5 w-3.5" />,
  OTHER:      <File          className="h-3.5 w-3.5" />,
}

const DOC_TYPE_COLORS: Record<string, string> = {
  QUOTE:      "bg-sky-100 text-sky-700 border-sky-200",
  PROPOSAL:   "bg-blue-100 text-blue-700 border-blue-200",
  AGREEMENT:  "bg-violet-100 text-violet-700 border-violet-200",
  INVOICE:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  RENEWAL:    "bg-amber-100 text-amber-700 border-amber-200",
  ONBOARDING: "bg-teal-100 text-teal-700 border-teal-200",
  OTHER:      "bg-slate-100 text-slate-600 border-slate-200",
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

  const [documents, setDocuments]   = useState<DocumentRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [docType, setDocType]       = useState("")
  const [statusFilter, setStatusFilter] = useState("ACTIVE")
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [busy, setBusy]             = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set("search", search)
      if (docType)      params.set("type", docType)
      if (statusFilter) params.set("status", statusFilter)
      params.set("page", String(page))
      params.set("limit", "15")

      const res  = await authFetch(`/api/admin/documents?${params}`)
      const json = await res.json()
      if (json.success) {
        setDocuments(json.data)
        setTotalPages(json.pagination.pages ?? 1)
        setTotal(json.pagination.total ?? 0)
      }
    } catch {
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [search, docType, statusFilter, page])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])
  useEffect(() => { setPage(1) }, [search, docType, statusFilter])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(
      selected.size === documents.length
        ? new Set()
        : new Set(documents.map(d => d.id))
    )
  }

  // ── Soft-archive one or many ──────────────────────────────────────────────
  const archiveOne = async (id: string) => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    try {
      await authFetch(`/api/admin/documents/${id}`, { method: "PATCH" })
      toast.success("Document archived")
      fetchDocuments()
    } catch {
      toast.error("Failed to archive document")
    }
  }

  const archiveBulk = async () => {
    if (!canDelete || selected.size === 0) return
    setBusy(true)
    let failed = 0
    for (const id of selected) {
      try {
        await authFetch(`/api/admin/documents/${id}`, { method: "PATCH" })
      } catch { failed++ }
    }
    setBusy(false)
    setSelected(new Set())
    failed > 0
      ? toast.error(`${failed} archive(s) failed`)
      : toast.success(`${selected.size} document(s) archived`)
    fetchDocuments()
  }

  // ── Hard-delete one (Super Admin) ─────────────────────────────────────────
  const deleteOne = async (id: string) => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    try {
      await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" })
      toast.success("Document permanently deleted")
      fetchDocuments()
    } catch {
      toast.error("Failed to delete document")
    }
  }

  const deleteBulk = async () => {
    if (!canDelete || selected.size === 0) return
    setBusy(true)
    let failed = 0
    for (const id of selected) {
      try {
        await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" })
      } catch { failed++ }
    }
    setBusy(false)
    setSelected(new Set())
    failed > 0
      ? toast.error(`${failed} deletion(s) failed`)
      : toast.success(`${selected.size} document(s) deleted`)
    fetchDocuments()
  }

  const allSelected = documents.length > 0 && selected.size === documents.length
  const anySelected = selected.size > 0

  // ── Stat counts ───────────────────────────────────────────────────────────
  const activeCount   = statusFilter === "ACTIVE"   ? total : null
  const archivedCount = statusFilter === "ARCHIVED"  ? total : null

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Document Center"
        description="Central repository for all generated proposals, quotes, agreements, and business documents"
        icon={Archive}
        action={
          canDelete && anySelected ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={archiveBulk}
                disabled={busy}
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArchiveX className="h-4 w-4" />}
                Archive {selected.size}
              </Button>
              <Button
                variant="destructive" className="gap-2"
                onClick={deleteBulk} disabled={busy}
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete {selected.size}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mt-4 mb-4">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 min-w-[130px]">
          <Archive className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
              {statusFilter === "ALL" ? "Total" : statusFilter === "ACTIVE" ? "Active" : "Archived"}
            </p>
            <p className="text-lg font-bold leading-none">{total}</p>
          </div>
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchDocuments} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Search & Filter Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-xs"
            placeholder="Search by proposal ID, business, phone, lead ID…"
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 sticky top-0 z-10">
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
                {[
                  "ID", "Business Name", "Phone", "Date",
                  "Document Type", "Created By", "Version", "Status",
                  canDelete ? "Actions" : null,
                ].filter(Boolean).map(header => (
                  <th key={header!} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {canDelete && <td className="px-4 py-3"><div className="h-4 w-4 bg-muted animate-pulse rounded" /></td>}
                    {Array.from({ length: canDelete ? 9 : 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-muted animate-pulse rounded" style={{ width: `${50 + (j * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 10 : 9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                        <FileCheck className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {statusFilter === "ARCHIVED" ? "No archived documents" : "No documents yet"}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs text-center">
                        {statusFilter === "ARCHIVED"
                          ? "Archived proposals will appear here."
                          : "Generate and save proposals from the Quote & Proposals builder to see them here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : documents.map((doc, idx) => {
                const isArchived = doc.status === "ARCHIVED"
                return (
                  <tr
                    key={doc.id}
                    className={`border-b transition-colors hover:bg-muted/20 ${
                      selected.has(doc.id)
                        ? "bg-blue-50/60"
                        : isArchived
                        ? "opacity-60 bg-muted/10"
                        : idx % 2 !== 0
                        ? "bg-muted/5"
                        : ""
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

                    {/* ID */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                          {doc.proposalId}
                        </span>
                        {doc.leadId && (
                          <div className="font-mono text-[10px] text-muted-foreground">{doc.leadId}</div>
                        )}
                      </div>
                    </td>

                    {/* Business Name */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-xs text-foreground leading-snug">{doc.businessName}</p>
                        {doc.clientName && (
                          <p className="text-[10px] text-muted-foreground">{doc.clientName}</p>
                        )}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {doc.contactPhone || "—"}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>

                    {/* Document Type */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 font-semibold whitespace-nowrap ${
                          DOC_TYPE_COLORS[doc.documentType] ?? DOC_TYPE_COLORS.OTHER
                        }`}
                      >
                        {DOC_TYPE_ICONS[doc.documentType] ?? DOC_TYPE_ICONS.OTHER}
                        {doc.documentType}
                      </Badge>
                    </td>

                    {/* Created By */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-medium leading-snug">{doc.createdByName || "—"}</p>
                        {doc.salesTeamMember && doc.salesTeamMember !== doc.createdByName && (
                          <p className="text-[10px] text-muted-foreground">{doc.salesTeamMember}</p>
                        )}
                      </div>
                    </td>

                    {/* Version */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        V{doc.pdfVersion}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {isArchived ? (
                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 gap-1">
                          <ArchiveX className="h-3 w-3" />
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                          <FileCheck className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    {canDelete && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!isArchived && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                              title="Archive"
                              onClick={() => archiveOne(doc.id)}
                            >
                              <ArchiveX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Permanently delete"
                            onClick={() => deleteOne(doc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `Showing ${(page - 1) * 15 + 1}–${Math.min(page * 15, total)} of ${total} documents`
              : "No documents"}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2 font-medium">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
