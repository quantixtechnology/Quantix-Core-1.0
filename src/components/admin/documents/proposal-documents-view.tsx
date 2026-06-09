"use client"

import { useState, useEffect, useCallback, type ComponentType } from "react"
import { createPortal } from "react-dom"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Archive, Search, Trash2, RefreshCw, FileCheck,
  ArchiveX, ChevronLeft, ChevronRight, Download, FileBadge,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

// ─── Lazy types — no static import of quote-proposal-view ────────────────────
interface ProposalForm {
  clientName: string; businessName: string; mobile: string; email: string
  subscriptionAmount: string; subscriptionCycle: string; subscriptionNotes: string
  implementationAmount: string; implementationNotes: string
  iosAppAmount: string; iosAppCycle: string; iosAppNotes: string
  addOnsAmount: string; addOnsCycle: string; addOnsDescription: string; addOnsNotes: string
  discountAmount: string; planTier: "STANDARD" | "PRO"; storeCount: string
  enabledWorkflows: string[]; salesTeamMember: string; salesTeamEmail: string
  executiveSummary: string
}
interface BankDetails {
  accountName: string; bankName: string; accountNumber: string; ifsc: string
  upiId: string; branch: string; qrUrl: string; active: boolean
}
type ProposalDocumentComponent = ComponentType<{
  form: ProposalForm; proposalId: string; proposalDate: string; bankDetails?: BankDetails | null
}>

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProposalRecord {
  id: string
  proposalId: string
  documentType: string
  status: string
  businessName: string
  clientName: string
  contactPhone: string | null
  salesTeamMember: string | null
  createdByName: string | null
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: "ACTIVE",   label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL",      label: "All" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── PDF portal — rendered off-screen, triggers print on ready ───────────────

interface PDFPreviewPortalProps {
  form: ProposalForm
  proposalId: string
  proposalDate: string
  bankDetails: BankDetails | null
  DocComponent: ProposalDocumentComponent
  onReady: () => void
}

function PDFPreviewPortal({ form, proposalId, proposalDate, bankDetails, DocComponent, onReady }: PDFPreviewPortalProps) {
  useEffect(() => {
    const t = setTimeout(onReady, 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (typeof document === "undefined") return null
  return createPortal(
    <div
      id="pd-pdf-portal"
      style={{ position: "fixed", top: "-9999px", left: "-9999px", pointerEvents: "none" }}
    >
      <DocComponent form={form} proposalId={proposalId} proposalDate={proposalDate} bankDetails={bankDetails} />
    </div>,
    document.body,
  )
}

// ─── Main View ───────────────────────────────────────────────────────────────

const PROPOSAL_ADMIN_ROLES = new Set(["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN", "SALES_MANAGER"])

export function ProposalDocumentsView() {
  const { user, permissions } = useAuthStore()
  const canDelete    = (permissions as string[]).includes("proposals:delete")
  const isAdminView  = PROPOSAL_ADMIN_ROLES.has((user as { role?: string } | null)?.role ?? "")

  const [proposals, setProposals]   = useState<ProposalRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [statusFilter, setStatusFilter] = useState("ACTIVE")
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [busy, setBusy]             = useState(false)

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [pdfPortalData, setPdfPortalData] = useState<{
    form: ProposalForm; proposalId: string; proposalDate: string; DocComponent: ProposalDocumentComponent
  } | null>(null)

  // Fetch payment config / QR for PDF generation
  useEffect(() => {
    authFetch("/api/admin/payment-config")
      .then(r => r.json())
      .then(json => { if (json.success) setBankDetails(json.data) })
      .catch(() => { /* optional */ })
  }, [])

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("type", "PROPOSAL")
      if (search)       params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      params.set("page", String(page))
      params.set("limit", "15")

      const res  = await authFetch(`/api/admin/documents?${params}`)
      const json = await res.json()
      if (json.success) {
        setProposals(json.data)
        setTotalPages(json.pagination.pages ?? 1)
        setTotal(json.pagination.total ?? 0)
      }
    } catch {
      toast.error("Failed to load proposal documents")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { fetchProposals() }, [fetchProposals])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(
      selected.size === proposals.length
        ? new Set()
        : new Set(proposals.map(p => p.id))
    )
  }

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownload = async (doc: ProposalRecord) => {
    if (downloadingId) return
    setDownloadingId(doc.id)
    try {
      const mod = await import("@/components/admin/leads/quote-proposal-view")
      const DocComponent = mod.ProposalDocument as ProposalDocumentComponent

      const res  = await authFetch(`/api/admin/documents/${doc.id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Failed to fetch document")

      const snapshot = json.data.formSnapshot
      let form: ProposalForm
      try {
        form = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot
      } catch {
        throw new Error("Invalid document snapshot")
      }

      const proposalDate = new Date(json.data.createdAt).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })

      setPdfPortalData({ form, proposalId: doc.proposalId, proposalDate, DocComponent })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download")
      setDownloadingId(null)
    }
  }

  const handlePdfReady = () => {
    const portal = document.getElementById("pd-pdf-portal")
    const preview = portal?.querySelector("#proposal-preview")
    if (!preview || !pdfPortalData) {
      setDownloadingId(null)
      setPdfPortalData(null)
      return
    }
    const style = `
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #proposal-preview > div + div { page-break-before: always; }
    `
    const win = window.open("", "_blank")
    if (!win) {
      toast.error("Allow popups to download PDF")
    } else {
      win.document.write(`<!DOCTYPE html><html><head><title>Proposal ${pdfPortalData.proposalId}</title><style>${style}</style></head><body>${preview.outerHTML}</body></html>`)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); win.close() }, 400)
    }
    setPdfPortalData(null)
    setDownloadingId(null)
  }

  // ── Archive / Delete ──────────────────────────────────────────────────────
  const archiveOne = async (id: string) => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    try {
      await authFetch(`/api/admin/documents/${id}`, { method: "PATCH" })
      toast.success("Proposal archived")
      fetchProposals()
    } catch {
      toast.error("Failed to archive proposal")
    }
  }

  const archiveBulk = async () => {
    if (!canDelete || selected.size === 0) return
    setBusy(true)
    let failed = 0
    for (const id of selected) {
      try { await authFetch(`/api/admin/documents/${id}`, { method: "PATCH" }) }
      catch { failed++ }
    }
    setBusy(false)
    setSelected(new Set())
    failed > 0 ? toast.error(`${failed} archive(s) failed`) : toast.success(`${selected.size} proposal(s) archived`)
    fetchProposals()
  }

  const deleteOne = async (id: string) => {
    if (!canDelete) { toast.error("Insufficient permissions"); return }
    try {
      await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" })
      toast.success("Proposal permanently deleted")
      fetchProposals()
    } catch {
      toast.error("Failed to delete proposal")
    }
  }

  const deleteBulk = async () => {
    if (!canDelete || selected.size === 0) return
    setBusy(true)
    let failed = 0
    for (const id of selected) {
      try { await authFetch(`/api/admin/documents/${id}`, { method: "DELETE" }) }
      catch { failed++ }
    }
    setBusy(false)
    setSelected(new Set())
    failed > 0 ? toast.error(`${failed} deletion(s) failed`) : toast.success(`${selected.size} proposal(s) deleted`)
    fetchProposals()
  }

  const allSelected = proposals.length > 0 && selected.size === proposals.length
  const anySelected = selected.size > 0

  // 6 data cols + download + optional checkbox + optional actions
  const colCount = 6 + 1 + (canDelete ? 1 : 0)

  return (
    <div className="flex flex-col h-full">

      {/* Off-screen PDF render portal */}
      {pdfPortalData && (
        <PDFPreviewPortal
          form={pdfPortalData.form}
          proposalId={pdfPortalData.proposalId}
          proposalDate={pdfPortalData.proposalDate}
          bankDetails={bankDetails}
          DocComponent={pdfPortalData.DocComponent}
          onReady={handlePdfReady}
        />
      )}

      <PageHeader
        title="Proposal Documents"
        description={
          isAdminView
            ? "All saved proposal PDFs — search, download, and manage archived documents"
            : "Your saved proposal PDFs — search, download, and manage your documents"
        }
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

      {/* Stats + refresh row */}
      <div className="flex items-center gap-3 mt-4 mb-4">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 min-w-[140px]">
          <FileBadge className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
              {statusFilter === "ALL" ? "Total" : statusFilter === "ACTIVE" ? "Active" : "Archived"}
            </p>
            <p className="text-lg font-bold leading-none">{total}</p>
          </div>
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchProposals} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-xs"
            placeholder="Search by proposal ID, business name, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

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

      {/* Table */}
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
                  "Proposal ID", "Business Name", "Phone",
                  "Date", "Created By", "Status",
                  "Download",
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
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-muted animate-pulse rounded" style={{ width: `${50 + (j * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : proposals.length === 0 ? (
                <tr>
                  <td colSpan={colCount + (canDelete ? 1 : 0)} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                        <FileCheck className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {statusFilter === "ARCHIVED"
                          ? "No archived proposals"
                          : isAdminView
                          ? "No proposal documents available"
                          : "You haven't saved any proposals yet"}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs text-center">
                        {statusFilter === "ARCHIVED"
                          ? "Archived proposals will appear here."
                          : "Save proposals from the Quote & Proposals builder to see them here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : proposals.map((doc, idx) => {
                const isArchived    = doc.status === "ARCHIVED"
                const isDownloading = downloadingId === doc.id
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

                    {/* Proposal ID */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                        {doc.proposalId}
                      </span>
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

                    {/* Created By */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-medium leading-snug">{doc.createdByName || "—"}</p>
                        {doc.salesTeamMember && doc.salesTeamMember !== doc.createdByName && (
                          <p className="text-[10px] text-muted-foreground">{doc.salesTeamMember}</p>
                        )}
                      </div>
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

                    {/* Download */}
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleDownload(doc)}
                        disabled={isDownloading || !!downloadingId}
                      >
                        {isDownloading
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                        {isDownloading ? "…" : "PDF"}
                      </Button>
                    </td>

                    {/* Actions (delete-gated) */}
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `Showing ${(page - 1) * 15 + 1}–${Math.min(page * 15, total)} of ${total} proposals`
              : "No proposal documents"}
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
