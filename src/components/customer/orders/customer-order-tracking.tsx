"use client"

import React, { useMemo, useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { buildLabelMap, getLabel } from "@/lib/order-stages"
import { useOrder, useTrackOrder } from "@/hooks/use-api"
import { useDeliveryUpdates } from "@/hooks/use-realtime"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  User,
  Download,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Loader2,
  Receipt,
  FileText,
} from "lucide-react"
import { resolveInvoiceStatus, invoiceStatusColors } from "@/lib/invoice-utils"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";

const statusSteps = [
  { key: "PENDING", label: "Order Placed", icon: Package },
  { key: "CONFIRMED", label: "Confirmed", icon: CheckCircle2 },
  { key: "PREPARING", label: "Preparing", icon: Clock },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
]

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "",
  CANCELLED: "bg-red-100 text-red-700",
}

export function CustomerOrderTracking() {
  const { selectedOrderId, setCustomerPage, currentBusinessPrimaryColor, orderStages, pushCustomerPage, setSelectedInvoiceId, currentBusinessId } = useAdminStore()
  const { token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const labelMap = useMemo(() => buildLabelMap(orderStages), [orderStages])
  const [showDetails, setShowDetails] = useState(false)

  // Invoice data
  const [invoice, setInvoice] = useState<{
    id: string; invoiceNumber: string; status: string;
    totalAmount: number; paidAmount: number;
    pdfUrl?: string | null;
    dueDate: string | null; paidAt: string | null;
    order?: { id: string; orderNumber: string } | null;
  } | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  const fetchInvoice = useCallback(async (orderId: string) => {
    if (!token || !orderId) return
    setInvoiceLoading(true)
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
      if (currentBusinessId) headers['x-business-id'] = currentBusinessId
      const res  = await fetch(`/api/core/storefront/orders/${orderId}/invoice`, { headers })
      const json = await res.json()
      if (json.success) setInvoice(json.data)
      else console.warn('[Invoice] fetch failed:', json.error, res.status)
    } catch (e) {
      console.warn('[Invoice] fetch error:', e)
    } finally {
      setInvoiceLoading(false)
    }
  }, [token, currentBusinessId])

  const handleDownloadPdf = useCallback(async (orderId: string) => {
    if (!token) return
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
      if (currentBusinessId) headers['x-business-id'] = currentBusinessId
      const res = await fetch(`/api/core/storefront/orders/${orderId}/invoice/pdf`, { headers })
      if (!res.ok) {
        console.warn('[InvoicePDF] failed:', res.status)
        return
      }
      // HTML blob with embedded auto-print — open in new tab, print dialog fires
      const blob    = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (e) {
      console.warn('[InvoicePDF] error:', e)
    }
  }, [token, currentBusinessId])

  // Fetch order details
  const { data: orderData, isLoading: orderLoading, error: orderError, refetch } = useOrder(selectedOrderId || "")

  // Fetch delivery tracking data (auto-refreshes every 15s)
  const { data: trackingData } = useTrackOrder(selectedOrderId || "")

  // Real-time delivery updates via WebSocket
  const { latestUpdate, partnerLocation } = useDeliveryUpdates(selectedOrderId || "")

  // Parse order from API
  const order = useMemo(() => {
    if (!orderData?.data) return null
    const o = orderData.data as unknown as Record<string, unknown>
    // Resolve delivery partner from either source in the order response
    type PartnerShape = { id: string; name: string; phone: string; vehicleType?: string | null; vehicleNumber?: string | null; avatar?: string | null; rating?: number | null }
    const directPartner = o.deliveryPartner as PartnerShape | null | undefined
    const deliveryPartner = directPartner
      ?? ((o.delivery as Record<string, unknown> | null | undefined)?.deliveryPartner as PartnerShape | null | undefined)
      ?? null
    return {
      id: o.id as string,
      orderNumber: o.orderNumber as string,
      status: o.status as string,
      totalAmount: o.totalAmount as number,
      createdAt: o.createdAt as string,
      paymentMethod: o.paymentMethod as string | undefined,
      items: Array.isArray(o.items)
        ? (o.items as Array<Record<string, unknown>>).map((i) => ({
            name: (i.itemName ?? i.productName ?? "Item") as string,
            qty: i.quantity as number || 1,
            price: i.unitPrice as number || 0,
          }))
        : [],
      deliveryAddress: o.deliveryAddress as string | undefined,
      estimatedDelivery: o.estimatedDelivery as string | undefined,
      deliveryPartner,
    }
  }, [orderData])

  // Resolve partner — prefer live tracking data (refreshes every 15s) over order snapshot
  const resolvedPartner = useMemo(() => {
    type PartnerShape = { name: string; phone: string; vehicleType?: string | null; vehicleNumber?: string | null }
    const td = trackingData?.data as Record<string, unknown> | null | undefined
    const trackPartner = (td?.delivery as Record<string, unknown> | null | undefined)?.partner as PartnerShape | null | undefined
    return trackPartner ?? order?.deliveryPartner ?? null
  }, [trackingData, order])

  // Load invoice whenever order ID is known
  useEffect(() => {
    if (selectedOrderId) fetchInvoice(selectedOrderId)
  }, [selectedOrderId, fetchInvoice])

  // Merge real-time updates into tracking
  const currentStatus = latestUpdate?.status || order?.status || "PENDING"

  const currentStepIndex = statusSteps.findIndex((s) => s.key === currentStatus)

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch {
      return dateStr
    }
  }

  const handleBack = () => {
    setCustomerPage("orders")
  }

  // Loading state
  if (orderLoading) {
    return (
      <div className="pb-4">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mx-4 mb-4">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="px-4 space-y-4">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (orderError || !order) {
    return (
      <div className="pb-4">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
        </div>
        <ErrorState
          title="Order not found"
          description="We couldn't load this order. It may have been removed or is temporarily unavailable."
          onRetry={() => refetch()}
          className="py-20"
        />
      </div>
    )
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
          <p className="text-xs text-gray-400">{order.orderNumber}</p>
        </div>
        {latestUpdate && (
          <div className="ml-auto">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: `${brandColor}10` }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
              <span className="text-[10px] font-medium" style={{ color: brandColor }}>Live</span>
            </div>
          </div>
        )}
      </div>

      {/* Map Placeholder */}
      {(currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "PREPARING") && (
        <div className="mx-4 mb-4 h-40 rounded-xl flex items-center justify-center border relative" style={{ backgroundColor: `${brandColor}08`, borderColor: `${brandColor}20` }}>
          <div className="text-center">
            <MapPin className="w-8 h-8 mx-auto mb-2" style={{ color: brandColor }} />
            <p className="text-xs font-medium" style={{ color: brandColor }}>Live Tracking</p>
            <p className="text-[10px] text-gray-500">
              {currentStatus === "OUT_FOR_DELIVERY"
                ? "Your order is on the way!"
                : "Your order is being prepared"}
            </p>
            {partnerLocation && (
              <p className="text-[10px] mt-1" style={{ color: brandColor }}>
                📍 {partnerLocation.lat.toFixed(4)}, {partnerLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="px-4 mb-4">
        <Badge
          className={`${statusColors[currentStatus] || "bg-gray-100 text-gray-700"} text-xs px-3 py-1 border-0`}
          style={currentStatus === "DELIVERED" ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
        >
          {getLabel(currentStatus, labelMap)}
        </Badge>
        {order.estimatedDelivery && currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
          <p className="text-xs text-gray-500 mt-1.5">
            Estimated delivery by {formatDate(order.estimatedDelivery)}
          </p>
        )}
      </div>

      {/* Status Timeline */}
      {currentStatus !== "CANCELLED" && (
        <div className="px-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Order Status</h3>
            <div className="space-y-0">
              {statusSteps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex
                const Icon = step.icon

                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={
                          isCompleted
                            ? isCurrent
                              ? { backgroundColor: brandColor, color: '#fff' }
                              : { backgroundColor: `${brandColor}25`, color: brandColor }
                            : { backgroundColor: '#f3f4f6', color: '#d1d5db' }
                        }
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {idx < statusSteps.length - 1 && (
                        <div
                          className="w-0.5 h-8"
                          style={{ backgroundColor: idx < currentStepIndex ? `${brandColor}60` : '#e5e7eb' }}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-xs font-medium ${
                          isCompleted ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {getLabel(step.key, labelMap)}
                      </p>
                      {isCurrent && (
                        <p className="text-[10px]" style={{ color: brandColor }}>In progress</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Partner — show whenever a partner is assigned and order is active */}
      {(resolvedPartner || latestUpdate?.partnerName) &&
        currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
        <div className="px-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" style={{ color: brandColor }} />
              Delivery Partner
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}20` }}>
                <User className="w-5 h-5" style={{ color: brandColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {resolvedPartner?.name || latestUpdate?.partnerName || "Assigned Partner"}
                </p>
                {(resolvedPartner?.vehicleType || resolvedPartner?.vehicleNumber) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[resolvedPartner.vehicleType, resolvedPartner.vehicleNumber].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(resolvedPartner?.phone || latestUpdate?.partnerPhone) && (
                  <a
                    href={`tel:${resolvedPartner?.phone || latestUpdate?.partnerPhone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                )}
                {(resolvedPartner?.phone || latestUpdate?.partnerPhone) && (
                  <a
                    href={`sms:${resolvedPartner?.phone || latestUpdate?.partnerPhone}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${brandColor}15` }}
                  >
                    <MessageCircle className="w-4 h-4" style={{ color: brandColor }} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="px-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-bold text-gray-900">Order Details</h3>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Order Number</span>
              <span className="text-xs font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Placed On</span>
              <span className="text-xs font-medium">{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Payment</span>
              <span className="text-xs font-medium">{order.paymentMethod || "UPI"}</span>
            </div>
          </div>

          {showDetails && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2 mb-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      {item.name} × {item.qty}
                    </span>
                    <span className="text-xs font-medium">{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold">Total</span>
                <span className="text-sm font-bold">{formatPrice(order.totalAmount)}</span>
              </div>
              {order.deliveryAddress && (
                <div className="mt-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-500">Delivery Address</span>
                  </div>
                  <p className="text-xs text-gray-700">{order.deliveryAddress}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Payment & Invoice — visible at every order stage */}
      <div className="px-4 mb-2">
        {invoiceLoading ? (
          <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading invoice…</span>
          </div>
        ) : invoice ? (() => {
          const statusLabel = resolveInvoiceStatus(invoice.status, invoice.totalAmount, invoice.paidAmount)
          const colors = invoiceStatusColors(statusLabel)
          const balanceAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount)
          return (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 shrink-0" style={{ color: brandColor }} />
                  <span className="text-sm font-bold text-gray-900">Payment &amp; Invoice</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                  {statusLabel}
                </span>
              </div>

              {/* Invoice number */}
              <p className="text-[11px] font-mono text-gray-500 mb-3">{invoice.invoiceNumber}</p>

              {/* Amounts grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Invoice Amount</p>
                  <p className="text-xs font-bold text-gray-900">{formatPrice(invoice.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Paid Amount</p>
                  <p className="text-xs font-bold text-gray-900">{formatPrice(invoice.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Balance Due</p>
                  <p className={`text-xs font-bold ${balanceAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {formatPrice(balanceAmount)}
                  </p>
                </div>
              </div>

              {/* Due / Paid date */}
              {statusLabel === "PAYMENT DUE" && invoice.dueDate && (
                <p className="text-[10px] text-amber-600 mb-2">
                  Due: {new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
              {statusLabel === "PAID" && invoice.paidAt && (
                <p className="text-[10px] text-emerald-600 mb-2">
                  Paid on {new Date(invoice.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setSelectedInvoiceId(invoice.id)
                    pushCustomerPage("invoice-detail")
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors"
                  style={{ borderColor: `${brandColor}50`, color: brandColor }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  View Invoice
                </button>
                {selectedOrderId && (
                  <button
                    onClick={() => handleDownloadPdf(selectedOrderId)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          )
        })() : null}
      </div>
    </div>
  )
}
