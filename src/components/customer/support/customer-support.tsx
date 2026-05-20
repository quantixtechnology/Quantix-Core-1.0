"use client"

import React, { useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import {
  ArrowLeft, Phone, MessageCircle, Mail, ChevronDown, ChevronUp,
  HelpCircle, Clock, Package, RefreshCw, Truck, CreditCard, Scale,
} from "lucide-react"
import { Button } from "@/components/ui/button"

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

export function CustomerSupport() {
  const { setCustomerPage, currentBusinessPrimaryColor, currentBusinessName } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
