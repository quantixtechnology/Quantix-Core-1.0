"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store";
import {
  ArrowLeft, Phone, MessageCircle, Mail, ChevronDown, ChevronUp,
  HelpCircle, Clock, Package, RefreshCw, Truck, CreditCard, Scale,
  Ticket, CheckCircle2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { showSuccess, showError } from "@/lib/toast-utils"

interface FaqItem { q: string; a: string; icon: React.ElementType }

const FAQ: FaqItem[] = [
  {
    icon: Clock,
    q: "What are your delivery hours?",
    a: "We deliver from 7:00 AM to 9:00 PM, 7 days a week. Express delivery is available within 45–90 minutes. You can also schedule a slot at your preferred time during checkout.",
  },
  {
    icon: Package,
    q: "How is the meat packaged?",
    a: "All meat is vacuum-sealed in food-grade packaging with hygiene seals, kept at below 4°C throughout the delivery chain. Our delivery bags are insulated to maintain freshness.",
  },
  {
    icon: Scale,
    q: "Will I get the exact weight I ordered?",
    a: "We aim for exact weight but there may be a ±5% variance due to the nature of fresh meat cuts. You'll only be charged for the actual weight delivered.",
  },
  {
    icon: Truck,
    q: "What is the minimum order amount?",
    a: "The minimum order is ₹150. Free delivery is available on orders above ₹500. A flat delivery fee of ₹30 applies to orders below ₹500.",
  },
  {
    icon: RefreshCw,
    q: "What is your return / refund policy?",
    a: "If you receive an incorrect or poor-quality product, contact us within 2 hours of delivery with a photo. We'll arrange a replacement or full refund within 24 hours.",
  },
  {
    icon: CreditCard,
    q: "Which payment methods do you accept?",
    a: "We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Cash on Delivery (COD). All online payments are processed securely.",
  },
  {
    icon: HelpCircle,
    q: "Is the chicken halal certified?",
    a: "Yes, all our chicken is sourced from halal-certified farms and processed according to halal standards. Look for the Halal badge on product pages.",
  },
  {
    icon: HelpCircle,
    q: "Can I request custom cuts?",
    a: "Yes! Use the 'Cut Type' and 'Cleaning' options on the product page to specify how you'd like the meat prepared. For custom requests, add a note in Delivery Instructions.",
  },
]

const TICKET_CATEGORIES = [
  "Order Issue", "Payment", "Refund", "Product Quality", "Delivery", "Other",
]

export function CustomerSupport() {
  const { setCustomerPage, currentBusinessPrimaryColor, currentBusinessName, currentBusinessId } = useAdminStore()
  const { user, token } = useAuthStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    name: user?.name || "",
    phone: "",
    subject: "",
    category: "Order Issue",
    message: "",
  })

  const handleTicketSubmit = async () => {
    if (!ticketForm.name.trim()) { showError("Name is required"); return }
    if (!ticketForm.subject.trim()) { showError("Subject is required"); return }
    if (!ticketForm.message.trim()) { showError("Message is required"); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/core/storefront/support/ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...ticketForm, businessId: currentBusinessId }),
      })
      const json = await res.json()
      if (json.success) {
        setTicketSubmitted(true)
        showSuccess("Ticket raised!", "We'll get back to you within 24 hours.")
      } else {
        showError(json.error || "Failed to raise ticket")
      }
    } catch {
      showError("Failed to raise ticket")
    } finally {
      setSubmitting(false)
    }
  }

  const phone   = "+91 98765 43210"
  const email   = "support@arbazchicken.com"
  const whatsapp = "919876543210"

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCustomerPage("profile")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Help & Support</h1>
      </div>

      {/* Contact Cards */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Contact Us</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
              <Phone className="w-5 h-5" style={{ color: brandColor }} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700">Call Us</span>
            <span className="text-[10px] text-gray-400">9 AM – 9 PM</span>
          </a>

          <a
            href={`https://wa.me/${whatsapp}?text=Hi%20${encodeURIComponent(currentBusinessName || "Arbaz Chicken")}%2C%20I%20need%20help%20with%20my%20order`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#25D36615]">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </div>
            <span className="text-[11px] font-semibold text-gray-700">WhatsApp</span>
            <span className="text-[10px] text-gray-400">Fast reply</span>
          </a>

          <a
            href={`mailto:${email}`}
            className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-blue-50">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[11px] font-semibold text-gray-700">Email</span>
            <span className="text-[10px] text-gray-400">24h reply</span>
          </a>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4">
          {[
            { label: "Track my order",      action: () => setCustomerPage("orders") },
            { label: "View past orders",    action: () => setCustomerPage("orders") },
            { label: "Manage addresses",    action: () => setCustomerPage("addresses") },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
            >
              <span className="text-sm text-gray-700">{item.label}</span>
              <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
            </button>
          ))}
        </div>
      </div>

      {/* Raise a Ticket */}
      <div className="px-4 mb-4">
        <button
          onClick={() => { setShowTicketForm((v) => !v); setTicketSubmitted(false) }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors"
          style={showTicketForm ? { borderColor: brandColor, backgroundColor: `${brandColor}08` } : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}
        >
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4" style={{ color: brandColor }} />
            <span className="text-sm font-semibold text-gray-800">Raise a Support Ticket</span>
          </div>
          {showTicketForm
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {showTicketForm && (
          <div className="mt-2 bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            {ticketSubmitted ? (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <CheckCircle2 className="w-10 h-10" style={{ color: brandColor }} />
                <p className="text-sm font-semibold text-gray-800">Ticket Submitted!</p>
                <p className="text-xs text-gray-500">Our team will reach out within 24 hours.</p>
                <button
                  onClick={() => { setTicketSubmitted(false); setTicketForm({ name: user?.name || "", phone: "", subject: "", category: "Order Issue", message: "" }) }}
                  className="text-xs font-medium mt-1"
                  style={{ color: brandColor }}
                >
                  Raise another ticket
                </button>
              </div>
            ) : (
              <>
                {[
                  { key: "name", label: "Your Name", type: "text", placeholder: "Full name" },
                  { key: "phone", label: "Phone (optional)", type: "tel", placeholder: "+91 98765 43210" },
                  { key: "subject", label: "Subject", type: "text", placeholder: "Brief issue summary" },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-[11px] font-medium text-gray-500 mb-1 block">{label}</label>
                    <input
                      type={type}
                      value={ticketForm[key as keyof typeof ticketForm]}
                      onChange={(e) => setTicketForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                  >
                    {TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">Message</label>
                  <textarea
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Describe your issue in detail..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400 resize-none"
                  />
                </div>
                <Button
                  onClick={handleTicketSubmit}
                  disabled={submitting}
                  className="w-full h-10 text-sm font-semibold rounded-xl text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Ticket"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="px-4">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Frequently Asked Questions</p>
        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const Icon = item.icon
            const open = openFaq === i
            return (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${brandColor}12` }}>
                    <Icon className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 leading-snug">{item.q}</span>
                  {open
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                  }
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="pl-11">
                      <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Still need help CTA */}
      <div className="px-4 mt-6">
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${brandColor}10` }}>
          <HelpCircle className="w-8 h-8 mx-auto mb-2" style={{ color: brandColor }} />
          <p className="text-sm font-semibold text-gray-800 mb-1">Still need help?</p>
          <p className="text-xs text-gray-500 mb-3">Our team is available 9 AM – 9 PM, every day.</p>
          <Button
            asChild
            className="text-white text-xs h-9 px-6 rounded-xl"
            style={{ backgroundColor: brandColor }}
          >
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
              Chat on WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
