'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save } from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { toast } from 'sonner'

interface Props {
  // Wizard onboarding state; only businessId is needed here. All displayed
  // values are read back from the persisted Business so Review is the single
  // source of truth before provisioning.
  state: { businessId?: string }
}

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
  settings?: string | null
}

// Plan defaults read from the Plan Registry (ProductPlan) — never modified here.
interface PlanDefaults {
  storageGB: number
  users: number
  stores: number
}

// Per-business overrides, stored under settings.resourceOverrides.
interface ResourceOverrides {
  storageGB?: number
  users?: number
  stores?: number
}

const PLAN_DEFAULT = 'Will use plan defaults'

function parseOverrides(settings?: string | null): ResourceOverrides {
  try {
    const s = settings ? JSON.parse(settings) : {}
    return (s?.resourceOverrides ?? {}) as ResourceOverrides
  } catch {
    return {}
  }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-semibold break-words">{value || '—'}</p>
    </div>
  )
}

export function ReviewStep({ state }: Props) {
  const businessId = state.businessId
  const [biz, setBiz] = useState<PersistedBusiness | null>(null)
  const [planDefaults, setPlanDefaults] = useState<PlanDefaults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Override inputs as strings ('' = no override -> effective falls back to default)
  const [storageInput, setStorageInput] = useState('')
  const [usersInput, setUsersInput] = useState('')
  const [storesInput, setStoresInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/businesses/${businessId}`)
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to load business')
      const b = json.data as PersistedBusiness
      setBiz(b)

      // Seed override inputs from persisted overrides
      const ov = parseOverrides(b.settings)
      setStorageInput(ov.storageGB != null ? String(ov.storageGB) : '')
      setUsersInput(ov.users != null ? String(ov.users) : '')
      setStoresInput(ov.stores != null ? String(ov.stores) : '')

      // Plan defaults from the Plan Registry (product profile), read-only
      if (b.productCode && b.subscriptionPlanCode) {
        const pr = await fetch(`/api/admin/products/${encodeURIComponent(b.productCode)}/profile`)
        const pj = await pr.json()
        const plan = (pj?.data?.plans ?? []).find((p: { code: string }) => p.code === b.subscriptionPlanCode)
        if (plan) {
          setPlanDefaults({
            storageGB: Math.round((plan.storageQuotaMB ?? 0) / 1024 / 1024),
            users: plan.userLimit ?? 0,
            stores: plan.branchLimit ?? 0,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  // Parse an override input: blank/invalid/<1 => undefined (no override)
  const parseInput = (raw: string): number | undefined => {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 1 ? n : undefined
  }

  const effective = (override: string, def?: number) => {
    const o = parseInput(override)
    return o != null ? o : def
  }

  const saveOverrides = async () => {
    if (!businessId) return
    const overrides: ResourceOverrides = {}
    const s = parseInput(storageInput)
    const u = parseInput(usersInput)
    const st = parseInput(storesInput)
    if (s != null) overrides.storageGB = s
    if (u != null) overrides.users = u
    if (st != null) overrides.stores = st
    try {
      setSaving(true)
      const res = await fetch(`/api/core/businesses/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ resourceOverrides: overrides }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to save overrides')
      toast.success('Resource overrides saved')
      await load() // re-read so displayed values match persisted data
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save overrides')
    } finally {
      setSaving(false)
    }
  }

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

  const resources: Array<{
    key: string
    label: string
    unit: string
    input: string
    setInput: (v: string) => void
    def?: number
  }> = [
    { key: 'storage', label: 'Storage', unit: 'GB', input: storageInput, setInput: setStorageInput, def: planDefaults?.storageGB },
    { key: 'users', label: 'Users', unit: '', input: usersInput, setInput: setUsersInput, def: planDefaults?.users },
    { key: 'stores', label: 'Stores / Branches', unit: '', input: storesInput, setInput: setStoresInput, def: planDefaults?.stores },
  ]

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

      {/* Resource Allocation — Plan Default -> Optional Override -> Effective */}
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold">Resource Allocation</h4>
          <Button size="sm" onClick={saveOverrides} disabled={saving || !planDefaults} className="gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Overrides
          </Button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Leave an override blank to use the plan default. Overrides apply only to this business and never change the plan.
        </p>

        {!planDefaults ? (
          <p className="text-sm text-gray-500 italic">Plan defaults unavailable.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <span>Resource</span>
              <span>Plan Default</span>
              <span>Business Override</span>
              <span>Effective</span>
            </div>
            {resources.map((r) => {
              const eff = effective(r.input, r.def)
              return (
                <div key={r.key} className="grid grid-cols-4 gap-3 items-center">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-sm text-gray-700">
                    {r.def != null ? `${r.def}${r.unit ? ' ' + r.unit : ''}` : '—'}
                  </span>
                  <Input
                    type="number"
                    min="1"
                    value={r.input}
                    onChange={(e) => r.setInput(e.target.value)}
                    placeholder="default"
                    className="h-8 w-28 text-sm"
                  />
                  <span className="text-sm font-semibold">
                    {eff != null ? `${eff}${r.unit ? ' ' + r.unit : ''}` : '—'}
                    {parseInput(r.input) == null && (
                      <span className="ml-1 text-[10px] font-normal text-gray-400">(default)</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Not configurable in this phase */}
        <div className="mt-5 pt-4 border-t">
          <p className="text-sm text-gray-600">Licensed Features</p>
          <p className="font-medium text-gray-400 italic">{PLAN_DEFAULT}</p>
        </div>
      </Card>
    </div>
  )
}
