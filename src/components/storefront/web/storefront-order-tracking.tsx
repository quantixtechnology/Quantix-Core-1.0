"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ArrowLeft, Loader2, Package, CheckCircle2, Clock, Truck,
  XCircle, MapPin, Phone, RefreshCw, Receipt, Download, FileText,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { buildLabelMap, getLabel } from "@/lib/order-stages"
import { resolveInvoiceStatus, invoiceStatusColors } from "@/lib/invoice-utils"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import type { WebNav } from "./storefront-types"

interface InvoiceData {
  id: string
  invoiceNumber: string
  invoiceStatus: string
  invoiceAmount: number
  paidAmount: number
  balanceAmount: number
  pdfUrl?: string | null
  dueDate?: string | null
  paidAt?: string | null
}

interface TrackingData {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  totalAmount: number
  subtotal: number
  deliveryFee: number
  createdAt: string
  deliveryAddress?: string | null
  store?: { name: string; phone?: string | null } | null
  delivery?: {
    status: string
    estimatedDeliveryTime?: string | null
    partner?: { name: string; phone: string; vehicleType?: string | null; vehicleNumber?: string | null } | null
  } | null
  statusHistory: Array<{ status: string; note?: string | null; timestamp: string }>
  items: Array<{ itemName: string; variantName?: string | null; quantity: number; unitPrice: number; totalPrice: number; isVeg?: boolean | null }>
  invoice?: InvoiceData | null
}

const STATUS_STEPS = ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]

interface StorefrontOrderTrackingProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontOrderTracking({ brandColor, nav }: StorefrontOrderTrackingProps) {
  const orderId = nav.orderId
  const { orderStages, currentBusinessId } = useAdminStore()
  const { token } = useAuthStore()
  const labelMap = useMemo(() => buildLabelMap(orderStages), [orderStages])

  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function buildAuthHeaders(): Record<string, string> {
    const h: Record<string, string> = {}
    if (token) h["Authorization"] = `Bearer ${token}`
    if (currentBusinessId) h["x-business-id"] = currentBusinessId
    return h
  }

  useEffect(() => {
    if (!orderId) { setError("No order ID"); setLoading(false); return }
    fetch(`/api/core/storefront/orders/${orderId}/track`, { headers: buildAuthHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
        else setError(json.error || "Order not found")
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token])

  function refresh() {
    if (!orderId) return
    setLoading(true)
    fetch(`/api/core/storefront/orders/${orderId}/track`, { headers: buildAuthHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function handleViewInvoice() {
    if (!orderId) return
    try {
      const res = await fetch(`/api/core/storefront/orders/${orderId}/invoice/pdf`, { headers: buildAuthHeaders() })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { /* silent */ }
  }

  async function handleDownloadPdf() {
    if (!orderId) return
    try {
      const res = await fetch(`/api/core/storefront/orders/${orderId}/invoice/pdf`, { headers: buildAuthHeaders() })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${data?.invoice?.invoiceNumber ?? orderId}.html`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { /* silent */ }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => nav.goBack("orders")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {data && (
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">Order #{data.orderNumber}</p>
                <p className="text-xs text-gray-400">
                  {new Date(data.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className="text-sm font-bold px-3 py-1 rounded-full text-white"
                style={{ backgroundColor: data.status === "DELIVERED" ? "#10B981" : data.status === "CANCELLED" ? "#EF4444" : brandColor }}
              >
                {getLabel(data.status, labelMap)}
              </span>
            </div>

            {/* Progress bar */}
            {data.status !== "CANCELLED" && (
              <div className="mt-4">
                <div className="flex items-center">
                  {STATUS_STEPS.map((step, i) => {
                    const stepIdx = STATUS_STEPS.indexOf(data.status)
                    const done = i <= stepIdx
                    const active = i === stepIdx
                    return (
                      <div key={step} className="flex-1 flex items-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            done ? "text-white" : "bg-gray-100"
                          }`}
                          style={done ? { backgroundColor: brandColor } : {}}
                        >
                          {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className="flex-1 h-1 mx-1 rounded-full" style={{ backgroundColor: i < stepIdx ? brandColor : "#e5e7eb" }} />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  {STATUS_STEPS.map((step) => (
                    <p key={step} className="text-[10px] text-gray-400 text-center" style={{ width: "20%" }}>
                      {getLabel(step, labelMap)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Delivery partner */}
          {data.delivery?.partner && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" style={{ color: brandColor }} />
                Delivery Partner
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{data.delivery.partner.name}</p>
                  {data.delivery.partner.vehicleType && (
                    <p className="text-xs text-gray-500">
                      {data.delivery.partner.vehicleType} · {data.delivery.partner.vehicleNumber}
                    </p>
                  )}
                </div>
                <a
                  href={`tel:${data.delivery.partner.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg"
                  style={{ backgroundColor: brandColor }}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
              </div>
            </div>
          )}

          {/* Delivery address */}
          {data.deliveryAddress && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: brandColor }} />
                Delivery Address
              </h3>
              <p className="text-sm text-gray-600">{data.deliveryAddress}</p>
            </div>
          )}

          {/* Items */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: brandColor }} />
              Order Items
            </h3>
            <div className="space-y-3">
              {data.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                    {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                    <p className="text-xs text-gray-400">×{item.quantity} @ {formatINR(item.unitPrice)}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatINR(item.totalPrice)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatINR(data.subtotal)}</span>
              </div>
              {(data.deliveryFee || 0) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery</span>
                  <span>{formatINR(data.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                <span>Total</span>
                <span>{formatINR(data.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Status history */}
          {data.statusHistory.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: brandColor }} />
                Order Timeline
              </h3>
              <div className="space-y-3">
                {[...data.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: i === 0 ? brandColor : "#D1D5DB" }} />
                      {i < data.statusHistory.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 mb-0" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-semibold text-gray-900">{getLabel(h.status, labelMap)}</p>
                      {h.note && <p className="text-xs text-gray-500">{h.note}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(h.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {new Date(h.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment & Invoice */}
          {data.invoice && (() => {
            const inv = data.invoice!
            const statusLabel = resolveInvoiceStatus(inv.invoiceStatus, inv.invoiceAmount, inv.paidAmount)
            const colors = invoiceStatusColors(statusLabel)
            return (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4" style={{ color: brandColor }} />
                  Payment &amp; Invoice
                </h3>

                {/* Invoice number + status */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-gray-600">{inv.invoiceNumber}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Amounts grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-0.5">Invoice Amount</p>
                    <p className="text-sm font-bold text-gray-900">{formatINR(inv.invoiceAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-0.5">Paid Amount</p>
                    <p className="text-sm font-bold text-gray-900">{formatINR(inv.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-0.5">Balance Due</p>
                    <p className={`text-sm font-bold ${inv.balanceAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {formatINR(inv.balanceAmount)}
                    </p>
                  </div>
                </div>

                {/* Due / paid date */}
                {statusLabel === "PAYMENT DUE" && inv.dueDate && (
                  <p className="text-xs text-amber-600 mb-3">
                    Due: {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
                {statusLabel === "PAID" && inv.paidAt && (
                  <p className="text-xs text-emerald-600 mb-3">
                    Paid on {new Date(inv.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleViewInvoice}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:opacity-90"
                    style={{ borderColor: `${brandColor}50`, color: brandColor, backgroundColor: `${brandColor}08` }}
                  >
                    <FileText className="w-4 h-4" />
                    View Invoice
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      ) : null}
    </div>
  )
}
