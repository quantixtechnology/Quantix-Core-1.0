'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface Props {
  // Wizard onboarding state; only businessId is needed here. All displayed
  // values are read back from the persisted Business so Review is the single
  // source of truth before provisioning.
  state: { businessId?: string }
}

// Authoritative Business shape we read from the API (persisted values only).
interface PersistedBusiness {
  name?: string | null
  ownerName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
  productCode?: string | null
  subscriptionPlanCode?: string | null
  businessType?: string | null
  status?: string | null
}

// Values not implemented yet (Resource Allocation, Phase 7). Never fabricated.
const PLAN_DEFAULT = 'Will use plan defaults'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-semibold break-words">{value || '—'}</p>
    </div>
  )
}

function PlaceholderField({ label }: { label: string }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-medium text-gray-400 italic">{PLAN_DEFAULT}</p>
    </div>
  )
}

export function ReviewStep({ state }: Props) {
  const [biz, setBiz] = useState<PersistedBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const businessId = state.businessId
    if (!businessId) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/businesses/${businessId}`)
        const json = await res.json()
        if (!res.ok || json.success === false) {
          throw new Error(json.error || 'Failed to load business')
        }
        if (active) setBiz(json.data as PersistedBusiness)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load business')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [state.businessId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading review…
      </div>
    )
  }

  if (error || !biz) {
    return (
      <Card className="p-6 bg-red-50 border-red-200">
        <p className="text-red-600 text-sm">{error || 'No business data available to review.'}</p>
      </Card>
    )
  }

  const addressParts = [biz.address, biz.city, biz.state, biz.pincode, biz.country].filter(
    (p) => p && String(p).trim()
  )
  const fullAddress = addressParts.length ? addressParts.join(', ') : null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Review &amp; Confirm</h3>
        <p className="text-sm text-gray-600">
          These are the saved details for this business — the single source of truth before provisioning.
        </p>
      </div>

      {/* Business Information */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h4 className="font-semibold mb-4">Business Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Business Name" value={biz.name} />
          <Field label="Owner" value={biz.ownerName} />
          <Field label="Email" value={biz.contactEmail} />
          <Field label="Mobile" value={biz.contactPhone} />
          <div className="col-span-2">
            <Field label="Address" value={fullAddress} />
          </div>
          <Field label="Business Status" value={biz.status} />
        </div>
      </Card>

      {/* Product & Subscription */}
      <Card className="p-6 bg-purple-50 border-purple-200">
        <h4 className="font-semibold mb-4">Product &amp; Subscription</h4>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Product" value={biz.productCode} />
          <Field label="Plan" value={biz.subscriptionPlanCode} />
          <Field label="Workspace Type" value={biz.businessType} />
        </div>
      </Card>

      {/* Resource Allocation — not implemented yet (Phase 7). Plan defaults apply. */}
      <Card className="p-6 bg-green-50 border-green-200">
        <h4 className="font-semibold mb-1">Resource Allocation</h4>
        <p className="text-xs text-gray-500 mb-4">Configured during provisioning.</p>
        <div className="grid grid-cols-2 gap-4">
          <PlaceholderField label="Storage" />
          <PlaceholderField label="Users" />
          <PlaceholderField label="Stores" />
          <PlaceholderField label="Licensed Features" />
        </div>
      </Card>
    </div>
  )
}
