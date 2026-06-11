"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, Clock, SplitSquareHorizontal, Receipt } from "lucide-react"
import { formatINR } from "@/lib/currency"

export type DeliveryPaymentStatus = "paid" | "partial" | "pending"

interface InvoiceOnDeliveryDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  order: { id: string; orderNumber: string; total: number } | null
  onConfirm: (paymentStatus: DeliveryPaymentStatus, paidAmount: number, notes: string) => Promise<void>
}

export function InvoiceOnDeliveryDialog({
  open,
  onOpenChange,
  order,
  onConfirm,
}: InvoiceOnDeliveryDialogProps) {
  const [paymentStatus, setPaymentStatus] = useState<DeliveryPaymentStatus>("paid")
  const [partialAmount, setPartialAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const total = order?.total ?? 0
  const parsedPartial = parseFloat(partialAmount) || 0
  const balance = Math.max(0, total - parsedPartial)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const paidAmt = paymentStatus === "paid" ? total : paymentStatus === "partial" ? parsedPartial : 0
      await onConfirm(paymentStatus, paidAmt, notes)
      setNotes("")
      setPartialAmount("")
      setPaymentStatus("paid")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      onOpenChange(v)
      if (!v) {
        setNotes("")
        setPartialAmount("")
        setPaymentStatus("paid")
      }
    }
  }

  const isPartialValid = paymentStatus !== "partial" || (parsedPartial > 0 && parsedPartial < total)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <DialogTitle>Mark Delivered &amp; Create Invoice</DialogTitle>
          </div>
          {order && (
            <p className="text-sm text-muted-foreground pt-1">
              Order <span className="font-semibold text-foreground">#{order.orderNumber}</span>{" "}
              — <span className="font-semibold text-foreground">{formatINR(order.total)}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-2 block">Payment Received?</Label>
            <div className="flex flex-col gap-2">
              {/* Paid in Full */}
              <button
                type="button"
                onClick={() => setPaymentStatus("paid")}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  paymentStatus === "paid"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${paymentStatus === "paid" ? "text-emerald-600" : "text-gray-300"}`} />
                <div>
                  <p className={`text-sm font-semibold ${paymentStatus === "paid" ? "text-emerald-700" : "text-gray-700"}`}>
                    Paid in Full
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight">Customer paid the full amount — invoice marked paid</p>
                </div>
              </button>

              {/* Partially Paid */}
              <button
                type="button"
                onClick={() => setPaymentStatus("partial")}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  paymentStatus === "partial"
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <SplitSquareHorizontal className={`w-5 h-5 shrink-0 ${paymentStatus === "partial" ? "text-blue-500" : "text-gray-300"}`} />
                <div>
                  <p className={`text-sm font-semibold ${paymentStatus === "partial" ? "text-blue-700" : "text-gray-700"}`}>
                    Partially Paid
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight">Customer paid part of the amount — remaining added to balance</p>
                </div>
              </button>

              {/* Pending */}
              <button
                type="button"
                onClick={() => setPaymentStatus("pending")}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  paymentStatus === "pending"
                    ? "border-amber-400 bg-amber-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Clock className={`w-5 h-5 shrink-0 ${paymentStatus === "pending" ? "text-amber-500" : "text-gray-300"}`} />
                <div>
                  <p className={`text-sm font-semibold ${paymentStatus === "pending" ? "text-amber-700" : "text-gray-700"}`}>
                    Payment Pending
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight">Credit — full amount added to customer's outstanding balance</p>
                </div>
              </button>
            </div>
          </div>

          {/* Partial amount input */}
          {paymentStatus === "partial" && (
            <div className="space-y-2">
              <Label htmlFor="partial-amount" className="text-sm">Amount Received (₹)</Label>
              <Input
                id="partial-amount"
                type="number"
                min={0.01}
                max={total - 0.01}
                step={0.01}
                placeholder={`Enter amount (max ${formatINR(total)})`}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                className="text-sm"
              />
              {parsedPartial > 0 && (
                <p className="text-xs text-blue-600">
                  Balance remaining: <span className="font-semibold">{formatINR(balance)}</span>
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invoice-notes" className="text-sm">Notes (optional)</Label>
            <Textarea
              id="invoice-notes"
              placeholder="Payment notes, remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !isPartialValid}
            className={
              paymentStatus === "paid"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : paymentStatus === "partial"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            }
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              <>
                {paymentStatus === "paid" ? <CheckCircle2 className="w-4 h-4 mr-2" /> : paymentStatus === "partial" ? <SplitSquareHorizontal className="w-4 h-4 mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                Confirm &amp; Deliver
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
