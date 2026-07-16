"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import { ArrowLeft, Star, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { showSuccess, showError } from "@/lib/toast-utils"

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"]

export function CustomerReview() {
  const { setCustomerPage, selectedReviewProductId, selectedOrderId, currentBusinessPrimaryColor } = useAdminStore()
  const { token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) { showError("Please select a rating"); return }
    if (!selectedReviewProductId) { showError("No product selected"); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/core/storefront/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: selectedReviewProductId,
          orderId: selectedOrderId || undefined,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        showSuccess("Review submitted. Thank you!")
        setSubmitted(true)
      } else {
        showError(json.error || "Failed to submit review")
      }
    } catch {
      showError("Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setCustomerPage("orders")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Write a Review</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${brandColor}15` }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: brandColor }} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">Thank you for your feedback!</h3>
          <p className="text-sm text-gray-500 mb-6">Your review helps others make better choices.</p>
          <Button onClick={() => setCustomerPage("orders")} className="text-white rounded-xl" style={{ backgroundColor: brandColor }}>
            Back to Orders
          </Button>
        </div>
      </div>
    )
  }

  const displayRating = hovered || rating

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setCustomerPage("orders")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Write a Review</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Star rating */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center">
          <p className="text-sm font-medium text-gray-700 mb-4">How would you rate this product?</p>
          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className="w-9 h-9"
                  fill={star <= displayRating ? "#FBBF24" : "none"}
                  stroke={star <= displayRating ? "#FBBF24" : "#D1D5DB"}
                />
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p className="text-sm font-semibold" style={{ color: brandColor }}>
              {RATING_LABELS[displayRating]}
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Review Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your experience in a few words"
            maxLength={80}
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Your Review (optional)</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts about the product quality, freshness, and delivery..."
            rows={4}
            maxLength={500}
            className="text-sm resize-none rounded-xl border-gray-200"
          />
          <p className="text-[10px] text-gray-400 mt-1 text-right">{body.length}/500</p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full h-12 text-sm font-bold rounded-xl text-white"
          style={{ backgroundColor: brandColor }}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
          ) : (
            "Submit Review"
          )}
        </Button>
      </div>
    </div>
  )
}
