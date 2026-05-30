// ============================================================================
// Public Account Deletion Page — /delete-account
//
// Multi-tenant: reads ?_storefront=<slug> injected by proxy.ts when a
// storefront subdomain (slug.quantixtechnology.in) hits this path.
// Queries Prisma directly (no HTTP round-trip) to load tenant branding and
// contact details.  No authentication required.  Works for every current
// and future business with zero per-tenant configuration.
// ============================================================================

import type { Metadata } from "next"
import { db } from "@/lib/db"
import { resolveImageUrl } from "@/lib/image-url"
import { Mail, Phone, MapPin, Trash2, Shield, Clock, ChevronRight, Building2, AlertCircle } from "lucide-react"

// ── Tenant resolution ────────────────────────────────────────────────────────

interface TenantInfo {
  name: string
  logo: string
  primaryColor: string
  email: string | null
  phone: string | null
  address: string | null
}

async function resolveTenant(slug: string | undefined): Promise<TenantInfo | null> {
  if (!slug) return null

  const business = await db.business.findFirst({
    where: {
      slug,
      status: { in: ["ACTIVE", "ONBOARDING"] },
    },
    select: {
      name: true,
      logo: true,
      primaryColor: true,
      supportEmail: true,
      supportPhone: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      city: true,
      state: true,
      branding: { select: { logo: true } },
    },
  })

  if (!business) return null

  const logoRaw = business.logo ?? business.branding?.logo ?? null
  const addressParts = [business.address, business.city, business.state].filter(Boolean)

  return {
    name: business.name,
    logo: resolveImageUrl(logoRaw),
    primaryColor: business.primaryColor || "#10B981",
    email: business.supportEmail || business.contactEmail || null,
    phone: business.supportPhone || business.contactPhone || null,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
  }
}

// ── SEO metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ _storefront?: string }>
}): Promise<Metadata> {
  const { _storefront: slug } = await searchParams
  const tenant = await resolveTenant(slug)
  const name = tenant?.name ?? "Store"

  return {
    title: `Account Deletion Request | ${name}`,
    description: `Request deletion of your account and personal data for ${name}.`,
    robots: { index: false, follow: false },
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ _storefront?: string }>
}) {
  const { _storefront: slug } = await searchParams
  const tenant = await resolveTenant(slug)

  const brand = tenant?.primaryColor ?? "#10B981"
  const initial = (tenant?.name ?? "?").charAt(0).toUpperCase()

  const mailtoHref = tenant?.email
    ? `mailto:${tenant.email}?subject=Account%20Deletion%20Request`
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {tenant?.logo ? (
            <img
              src={tenant.logo}
              alt={tenant.name}
              className="w-10 h-10 rounded-xl object-contain border border-gray-100 bg-white shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: brand }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">
              {tenant?.name ?? "Store"}
            </p>
            <p className="text-xs text-gray-500">Account Management</p>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">

        {/* No tenant resolved — show informational state */}
        {!tenant && (
          <div className="mb-8 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Store not specified</p>
              <p className="text-sm text-amber-700 mt-1">
                Access this page via your store&apos;s domain (e.g.{" "}
                <code className="font-mono text-xs bg-amber-100 px-1 rounded">
                  yourstore.quantixtechnology.in/delete-account
                </code>
                ) to see store-specific contact details.
              </p>
            </div>
          </div>
        )}

        {/* Title block */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: `${brand}18`, color: brand }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Account Deletion
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            Account Deletion Request
          </h1>
          <p className="mt-3 text-gray-600 text-sm sm:text-base leading-relaxed">
            You may request deletion of your{tenant ? ` ${tenant.name}` : ""} account and all
            associated personal information at any time. Please read the information below
            before submitting your request.
          </p>
        </div>

        <div className="space-y-5">

          {/* ── Section 1: How to Request ─────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${brand}18` }}
              >
                <Mail className="w-4 h-4" style={{ color: brand }} />
              </div>
              <h2 className="text-base font-bold text-gray-900">How to Request Deletion</h2>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              To request account deletion, please contact us:
            </p>

            {tenant?.email ? (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Support Email</p>
                <a
                  href={mailtoHref!}
                  className="text-sm font-semibold break-all"
                  style={{ color: brand }}
                >
                  {tenant.email}
                </a>
                <p className="text-xs text-gray-500 pt-1">
                  Subject: <span className="font-medium text-gray-700">Account Deletion Request</span>
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600">
                  Please contact support through the app or your store&apos;s help section.
                </p>
              </div>
            )}

            <p className="text-sm font-medium text-gray-700 mb-2">Please include:</p>
            <ul className="space-y-1.5 mb-5">
              {["Full Name", "Registered Mobile Number", "Registered Email Address"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: brand }} />
                  {item}
                </li>
              ))}
            </ul>

            {mailtoHref && (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: brand }}
              >
                <Mail className="w-4 h-4" />
                Request Account Deletion
              </a>
            )}
          </section>

          {/* ── Sections 2 & 3: Data grid ─────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-5">

            {/* Data That Will Be Deleted */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Data That Will Be Deleted</h2>
              </div>
              <ul className="space-y-2.5">
                {[
                  "User account information",
                  "Saved addresses",
                  "Profile details",
                  "App preferences",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Data That May Be Retained */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-50">
                  <Shield className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Data That May Be Retained</h2>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Order history",
                  "Invoice records",
                  "Tax records",
                  "Fraud prevention records",
                  "Any information required by law",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ── Section 4: Processing Time ────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Processing Time</h2>
            </div>
            <p className="text-sm text-gray-600">
              Deletion requests are typically processed within{" "}
              <span className="font-semibold text-gray-800">7 business days</span> of receiving
              your request. You will receive confirmation once the deletion is complete.
            </p>
          </section>

          {/* ── Section 5: Contact Information ────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-gray-100">
                <Building2 className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Contact Information</h2>
            </div>

            <div className="space-y-3">
              {/* Business name */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${brand}18` }}>
                  <Building2 className="w-3.5 h-3.5" style={{ color: brand }} />
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {tenant?.name ?? "—"}
                </span>
              </div>

              {/* Email */}
              {tenant?.email && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brand}18` }}>
                    <Mail className="w-3.5 h-3.5" style={{ color: brand }} />
                  </div>
                  <a
                    href={`mailto:${tenant.email}`}
                    className="text-sm font-medium break-all"
                    style={{ color: brand }}
                  >
                    {tenant.email}
                  </a>
                </div>
              )}

              {/* Phone */}
              {tenant?.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brand}18` }}>
                    <Phone className="w-3.5 h-3.5" style={{ color: brand }} />
                  </div>
                  <a
                    href={`tel:${tenant.phone}`}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    {tenant.phone}
                  </a>
                </div>
              )}

              {/* Address */}
              {tenant?.address && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${brand}18` }}>
                    <MapPin className="w-3.5 h-3.5" style={{ color: brand }} />
                  </div>
                  <span className="text-sm text-gray-700">{tenant.address}</span>
                </div>
              )}

              {/* No contact info available */}
              {!tenant?.email && !tenant?.phone && !tenant?.address && tenant && (
                <p className="text-sm text-gray-500 italic">
                  Contact details not configured. Please reach out through the app.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()}{tenant ? ` ${tenant.name}.` : ""} All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <span className="font-medium text-gray-500">Quantix Technology</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
