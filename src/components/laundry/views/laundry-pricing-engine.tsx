"use client"

// Masters → Pricing Engine. Enterprise rule management on top of the existing
// (untouched) Billing Resolver. List + wizard + simulator + conflict detection
// + audit history. The resolver remains the single source of truth for pricing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Loader2, Plus, Search, MoreHorizontal, Pencil, Copy, Archive, ArchiveRestore,
  Trash2, Eye, Power, IndianRupee, Calculator, ArrowUpDown, ChevronLeft, ChevronRight, History,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { PricingRuleWizard } from "./pricing/pricing-rule-wizard"
import { PricingSimulator } from "./pricing/pricing-simulator"
import {
  PRICING_TYPES, CUSTOMER_TYPES, STATUSES, typeLabel, inr, scopeSummary,
  statusBadgeClass, type Rule, type Ref, type RuleAudit,
} from "./pricing/pricing-shared"

const PAGE_SIZE = 20
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—")

export function LaundryPricingEngine() {
  const { currentBusinessId, user } = useAuthStore()
  const actor = useMemo(() => ({ id: user?.id, name: user?.name }), [user])

  const [rules, setRules] = useState<Rule[]>([])
  const [total, setTotal] = useState(0)
  const [masters, setMasters] = useState<{ services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }>({ services: [], garments: [], cats: [], stores: [] })
  const [loading, setLoading] = useState(true)

  // Toolbar / query state
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("ALL")
  const [customerType, setCustomerType] = useState("ALL")
  const [pricingType, setPricingType] = useState("ALL")
  const [sortBy, setSortBy] = useState("priority")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [qInput, setQInput] = useState("")

  // Dialog state
  const [wizard, setWizard] = useState<{ mode: "create" | "edit" | "duplicate"; rule: Rule | null } | null>(null)
  const [viewRule, setViewRule] = useState<Rule | null>(null)
  const [history, setHistory] = useState<RuleAudit[] | null>(null)
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null)

  const loadMasters = useCallback(async () => {
    if (!currentBusinessId) return
    const qs = `businessId=${encodeURIComponent(currentBusinessId)}`
    const [s, g, c, st] = await Promise.all([
      fetch(`/api/laundry/services?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/garments?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/categories?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/businesses/${currentBusinessId}/stores`).then((r) => r.json()).catch(() => []),
    ])
    setMasters({
      services: s.success ? s.data : [],
      garments: g.success ? g.data : [],
      cats: c.success ? c.data : [],
      stores: Array.isArray(st) ? st.map((x: { id: string; storeName: string }) => ({ id: x.id, storeName: x.storeName, name: x.storeName })) : [],
    })
  }, [currentBusinessId])

  const loadRules = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        businessId: currentBusinessId, q, status, customerType, pricingType,
        sortBy, sortDir, page: String(page), pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/laundry/pricing?${params.toString()}`).then((r) => r.json())
      setRules(res.success ? res.data : [])
      setTotal(res.total || 0)
    } catch { setRules([]) } finally { setLoading(false) }
  }, [currentBusinessId, q, status, customerType, pricingType, sortBy, sortDir, page])

  useEffect(() => { loadMasters() }, [loadMasters])
  useEffect(() => { loadRules() }, [loadRules])

  // Debounced search
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => { setPage(1); setQ(qInput) }, 300)
    return () => { if (qTimer.current) clearTimeout(qTimer.current) }
  }, [qInput])

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortBy(col); setSortDir("desc") }
  }

  const patchStatus = async (rule: Rule, newStatus: string) => {
    const res = await fetch(`/api/laundry/pricing/${rule.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, actorId: actor.id, actorName: actor.name }),
    })
    const json = await res.json()
    if (!res.ok || json.success === false) { toast.error(json.error || "Update failed"); return }
    toast.success(`Rule ${typeLabel(newStatus).toLowerCase()}`)
    loadRules()
  }

  const doDelete = async () => {
    if (!deleteRule) return
    const res = await fetch(`/api/laundry/pricing/${deleteRule.id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok || json.success === false) { toast.error(json.error || "Delete failed"); setDeleteRule(null); return }
    toast.success("Rule deleted"); setDeleteRule(null); loadRules()
  }

  const openView = async (rule: Rule) => {
    setViewRule(rule); setHistory(null)
    try {
      const json = await fetch(`/api/laundry/pricing/${rule.id}?history=1`).then((r) => r.json())
      if (json.success) setHistory(json.history || [])
    } catch { setHistory([]) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const SortHead = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="whitespace-nowrap">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(col)}>
        {children}<ArrowUpDown className={`h-3 w-3 ${sortBy === col ? "text-sky-600" : "opacity-40"}`} />
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><IndianRupee className="h-5 w-5 text-sky-600" /> Pricing Engine</h2>
          <p className="text-sm text-muted-foreground">Configure every pricing rule. The Billing Resolver applies the most specific, highest-priority active rule.</p>
        </div>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Pricing Rules</TabsTrigger>
          <TabsTrigger value="simulator" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Pricing Simulator</TabsTrigger>
        </TabsList>

        {/* ── Rules tab ── */}
        <TabsContent value="rules" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search rules, service, garment, category…" className="pl-9 h-9" value={qInput} onChange={(e) => setQInput(e.target.value)} />
            </div>
            <FilterSelect value={status} onChange={(v) => { setPage(1); setStatus(v) }} all="All Status" options={STATUSES.map((s) => ({ value: s, label: typeLabel(s) }))} />
            <FilterSelect value={customerType} onChange={(v) => { setPage(1); setCustomerType(v) }} all="All Customers" options={CUSTOMER_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} />
            <FilterSelect value={pricingType} onChange={(v) => { setPage(1); setPricingType(v) }} all="All Types" options={PRICING_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} />
            <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white h-9" onClick={() => setWizard({ mode: "create", rule: null })}>
              <Plus className="h-3.5 w-3.5" /> New Rule
            </Button>
          </div>

          <Card><CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : rules.length === 0 ? (
              <div className="text-center py-16">
                <IndianRupee className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">{q || status !== "ALL" || customerType !== "ALL" || pricingType !== "ALL" ? "No rules match your filters" : "No pricing rules yet"}</p>
                <p className="text-xs text-muted-foreground mt-1">{q || status !== "ALL" ? "Try clearing filters." : "Create your first rule to start billing orders."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead col="name">Rule</SortHead>
                      <TableHead>Scope</TableHead>
                      <SortHead col="pricingType">Type</SortHead>
                      <SortHead col="price">Base Price</SortHead>
                      <SortHead col="gstPercent">GST</SortHead>
                      <SortHead col="priority">Priority</SortHead>
                      <TableHead className="whitespace-nowrap">Effective</TableHead>
                      <SortHead col="status">Status</SortHead>
                      <SortHead col="updatedAt">Last Modified</SortHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id} className={r.status === "ARCHIVED" ? "opacity-60" : ""}>
                        <TableCell className="font-medium max-w-[180px] truncate">{r.name || <span className="text-muted-foreground italic">Unnamed</span>}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{scopeSummary(r)}</TableCell>
                        <TableCell><Badge variant="outline">{typeLabel(r.pricingType)}</Badge></TableCell>
                        <TableCell className="font-medium tabular-nums">{inr(r.price)}</TableCell>
                        <TableCell className="tabular-nums">{r.gstPercent}%</TableCell>
                        <TableCell className="tabular-nums">{r.priority}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.effectiveFrom)} → {fmtDate(r.effectiveTo)}</TableCell>
                        <TableCell><Badge variant="outline" className={statusBadgeClass(r.status)}>{typeLabel(r.status)}</Badge></TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(r.updatedAt)}{r.modifiedByName ? ` · ${r.modifiedByName}` : ""}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openView(r)}><Eye className="h-4 w-4 mr-2" /> View &amp; History</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWizard({ mode: "edit", rule: r })}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setWizard({ mode: "duplicate", rule: r })}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {r.status !== "ARCHIVED" && (
                                r.status === "ACTIVE"
                                  ? <DropdownMenuItem onClick={() => patchStatus(r, "INACTIVE")}><Power className="h-4 w-4 mr-2" /> Deactivate</DropdownMenuItem>
                                  : <DropdownMenuItem onClick={() => patchStatus(r, "ACTIVE")}><Power className="h-4 w-4 mr-2" /> Activate</DropdownMenuItem>
                              )}
                              {r.status === "ARCHIVED"
                                ? <DropdownMenuItem onClick={() => patchStatus(r, "INACTIVE")}><ArchiveRestore className="h-4 w-4 mr-2" /> Restore</DropdownMenuItem>
                                : <DropdownMenuItem onClick={() => patchStatus(r, "ARCHIVED")}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteRule(r)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent></Card>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="px-2">Page {page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Simulator tab ── */}
        <TabsContent value="simulator">
          {currentBusinessId && <PricingSimulator businessId={currentBusinessId} masters={masters} />}
        </TabsContent>
      </Tabs>

      {/* Wizard */}
      {wizard && currentBusinessId && (
        <PricingRuleWizard
          open
          mode={wizard.mode}
          rule={wizard.rule}
          businessId={currentBusinessId}
          masters={masters}
          actor={actor}
          onClose={() => setWizard(null)}
          onSaved={loadRules}
        />
      )}

      {/* View + Audit History */}
      <Dialog open={!!viewRule} onOpenChange={(o) => !o && setViewRule(null)}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewRule?.name || "Pricing Rule"}</DialogTitle>
            <DialogDescription>{viewRule && scopeSummary(viewRule)}</DialogDescription>
          </DialogHeader>
          {viewRule && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type" value={typeLabel(viewRule.pricingType)} />
                <Field label="Status" value={typeLabel(viewRule.status)} />
                <Field label="Base Price" value={inr(viewRule.price)} />
                <Field label="GST" value={`${viewRule.gstPercent}%`} />
                <Field label="Priority" value={String(viewRule.priority)} />
                <Field label="Version" value={`v${viewRule.version}`} />
                {viewRule.minCharge != null && <Field label="Min Charge" value={inr(viewRule.minCharge)} />}
                {viewRule.maxWeightKg != null && <Field label="Max / Included KG" value={`${viewRule.maxWeightKg} kg`} />}
                {viewRule.extraWeightCharge != null && <Field label="Extra / Excess" value={inr(viewRule.extraWeightCharge)} />}
                {viewRule.expressCharge != null && <Field label="Express" value={inr(viewRule.expressCharge)} />}
                {viewRule.pickupCharge != null && <Field label="Pickup" value={inr(viewRule.pickupCharge)} />}
                {viewRule.deliveryCharge != null && <Field label="Delivery" value={inr(viewRule.deliveryCharge)} />}
                <Field label="Effective" value={`${fmtDate(viewRule.effectiveFrom)} → ${fmtDate(viewRule.effectiveTo)}`} />
                <Field label="Created By" value={viewRule.createdByName || "—"} />
              </div>
              {viewRule.notes && <p className="text-xs text-muted-foreground border-t pt-2">{viewRule.notes}</p>}
              <div className="border-t pt-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><History className="h-3.5 w-3.5" /> Audit History</p>
                {history === null ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between text-xs rounded bg-muted/40 px-2 py-1">
                        <span><Badge variant="outline" className="mr-2 text-[10px]">{typeLabel(h.action)}</Badge>v{h.version} {h.actorName ? `· ${h.actorName}` : ""}</span>
                        <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRule} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pricing rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{deleteRule?.name || typeLabel(deleteRule?.pricingType)}”. Rules already used by orders cannot be deleted — archive them instead to preserve invoice history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterSelect({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{all}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
}
