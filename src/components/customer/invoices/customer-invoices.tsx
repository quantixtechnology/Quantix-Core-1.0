"use client"

import { useEffect, useState, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { formatINR } from "@/lib/currency"
import { ChevronRight, FileText, Loader2, Receipt, AlertCircle } from "lucide-react"

interface CustomerInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  status: string
  paidAt: string | null
  dueDate: string | null
  notes: string | null
  createdAt: string
  order: { orderNumber: string; deliveredAt: string | null } | null
}

function StatusPill({ status }: { status: string }) {
  const isPaid = status === "paid"
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
      {isPaid ? "PAID" : "PENDING"}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function CustomerInvoices() {
  const { currentBusinessId, currentBusinessPrimaryColor, setCustomerPage, pushCustomerPage, setSelectedInvoiceId } = useAdminStore()
  const { token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [invoices, setInvoices] = useState<CustomerInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [accountType, setAccountType] = useState("RETAIL")

  const fetchData = useCallback(async () => {
    if (!token || !currentBusinessId) return
    setLoading(true)
    setError(null)
    try {
      const [invRes, summaryRes] = await Promise.all([
        fetch("/api/core/storefront/customer/invoices", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/core/storefront/customer/account-summary", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const invJson = await invRes.json()
      const summaryJson = await summaryRes.json()

      if (invJson.success) setInvoices(invJson.data || [])
      else setError(invJson.error || "Failed to load invoices")

      if (summaryJson.success) {
        setOutstandingBalance(summaryJson.data.outstandingBalance ?? 0)
        setAccountType(summaryJson.data.accountType ?? "RETAIL")
      }
    } catch {
      setError("Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [token, currentBusinessId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleInvoicePress = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId)
    pushCustomerPage("invoice-detail")
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => setCustomerPage("profile")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-1">
          <ChevronRight className="w-5 h-5 text-gray-500 rotate-180" />
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 leading-none">My Invoices</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Order invoices & payment history</p>
        </div>
      </div>

      {/* Outstanding balance card — only for BUSINESS accounts */}
      {accountType !== "RETAIL" && outstandingBalance > 0 && (
        <div className="mx-4 mb-4 rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, #f59e0b, #d97706)` }}>
          <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">Outstanding Balance</p>
          <p className="text-2xl font-extrabold mt-1">{formatINR(outstandingBalance)}</p>
          <p className="text-[11px] text-white/70 mt-0.5">Please clear pending invoices on time</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: brandColor }} />
          <p className="text-sm text-gray-400">Loading invoices...</p>
        </div>
      )}

      {!loading && error && (
        <div className="mx-4 mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Receipt className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-base font-semibold text-gray-700">No invoices yet</p>
          <p className="text-sm text-gray-400">Invoices are created when your orders are delivered.</p>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <div className="px-4 space-y-2">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => handleInvoicePress(inv.id)}
              className="w-full bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform hover:shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{inv.invoiceNumber}</span>
                  <StatusPill status={inv.status} />
                </div>
                {inv.order && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Order #{inv.order.orderNumber}</p>
                )}
                <p className="text-[11px] text-gray-400">{formatDate(inv.createdAt)}</p>
                {inv.status === "pending" && inv.dueDate && (
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">Due: {formatDate(inv.dueDate)}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-gray-900">{formatINR(inv.totalAmount)}</p>
                {inv.status === "pending" && inv.paidAmount > 0 && (
                  <p className="text-[10px] text-gray-400">Paid: {formatINR(inv.paidAmount)}</p>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
