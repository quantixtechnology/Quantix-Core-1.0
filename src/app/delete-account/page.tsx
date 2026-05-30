import type { Metadata } from "next"
import { Mail, Trash2, Shield, Clock, ChevronRight } from "lucide-react"

interface StoreContext {
  businessName: string
  businessLogo: string | null
  primaryColor: string
}

async function fetchStoreContext(slug: string): Promise<StoreContext | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const res = await fetch(
      `${baseUrl}/api/core/storefront/store-context?slug=${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } }
    )
    const json = await res.json()
    if (!json.success || !json.data?.business) return null
    const biz = json.data.business
    return {
      businessName: biz.name || slug,
      businessLogo: biz.logo || null,
      primaryColor: biz.primaryColor || "#10B981",
    }
  } catch {
    return null
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ _storefront?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const slug = params._storefront
  let storeName = "Store"
  if (slug) {
    const ctx = await fetchStoreContext(slug)
    if (ctx) storeName = ctx.businessName
  }
  return {
    title: `Account Deletion Request | ${storeName}`,
    description: `Request deletion of your ${storeName} account and personal data.`,
    robots: { index: false, follow: false },
  }
}

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ _storefront?: string }>
}) {
  const params = await searchParams
  const slug = params._storefront
  let store: StoreContext | null = null
  if (slug) {
    store = await fetchStoreContext(slug)
  }

  const storeName = store?.businessName || "Arbaz Fresh Meat"
  const brandColor = store?.primaryColor || "#10B981"
  const logo = store?.businessLogo
  const contactEmail = "arbazfreshmeat@gmail.com"

  const initial = storeName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {logo ? (
            <img
              src={logo}
              alt={storeName}
              className="w-10 h-10 rounded-xl object-contain border border-gray-100"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: brandColor }}
            >
              {initial}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{storeName}</p>
            <p className="text-xs text-gray-500">Account Management</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        {/* Title block */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Account Deletion
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            Account Deletion Request
          </h1>
          <p className="mt-3 text-gray-600 text-sm sm:text-base leading-relaxed">
            You can request the deletion of your {storeName} account and all associated
            personal data at any time. Please read the information below before submitting
            your request.
          </p>
        </div>

        <div className="space-y-5">
          {/* How to Request */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${brandColor}15` }}
              >
                <Mail className="w-4 h-4" style={{ color: brandColor }} />
              </div>
              <h2 className="text-base font-bold text-gray-900">How to Request Deletion</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Send an email to the address below with the subject line{" "}
              <strong className="text-gray-800">Account Deletion Request</strong> and
              include the following details:
            </p>
            <ul className="space-y-1.5 mb-5">
              {["Full Name", "Registered Mobile Number", "Registered Email Address"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: brandColor }} />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={`mailto:${contactEmail}?subject=Account%20Deletion%20Request`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              <Mail className="w-4 h-4" />
              Email Us to Delete Account
            </a>
            <p className="mt-3 text-xs text-gray-500">
              Send to:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium underline"
                style={{ color: brandColor }}
              >
                {contactEmail}
              </a>
            </p>
          </section>

          {/* Two-column grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Data Deleted */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Data That Will Be Deleted</h2>
              </div>
              <ul className="space-y-2">
                {[
                  "User account",
                  "Saved addresses",
                  "Profile information",
                  "App preferences",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Data Retained */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-50">
                  <Shield className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Data That May Be Retained</h2>
              </div>
              <ul className="space-y-2">
                {[
                  "Order history",
                  "Invoice records",
                  "Tax records",
                  "Fraud prevention records",
                  "Legally required records",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Processing Time */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Processing Time</h2>
            </div>
            <p className="text-sm text-gray-600">
              Account deletion requests are reviewed and processed within{" "}
              <strong className="text-gray-800">7 business days</strong> of receiving your
              email. You will receive a confirmation once the deletion is complete.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">Contact Information</h2>
            <p className="text-sm text-gray-600 mb-2">
              If you have any questions about account deletion or your data, reach out to us:
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm font-medium underline"
              style={{ color: brandColor }}
            >
              {contactEmail}
            </a>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Powered by <span className="font-medium text-gray-500">Quantix Technology</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
