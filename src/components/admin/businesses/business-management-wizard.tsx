'use client'

// ============================================================================
// Business Wizard — THE single business management experience for the whole
// Quantix Platform. One component handles BOTH Create and Edit:
//   - no businessId  -> Create mode (creates the tenant, assigns product/plan,
//                       provisions, sets the initial owner password).
//   - businessId set -> Edit/Manage mode (loads + edits an existing tenant).
//
// Three sections separate concerns:
//   1. Business Setup     — tenant identity, branding, contact & legal, owner.
//   2. Commercial Features— product, plan, resource overrides, modules,
//                           payment-gateway availability.
//   3. Platform           — digital assets (read-only) + provisioning.
//
// Reuses existing components/APIs only — no new APIs, no provisioning-logic,
// schema or business-rule changes:
//   POST /api/admin/businesses                (create tenant)
//   PUT  /api/core/businesses/{id}            (edit profile/branding/legal, assign product/plan)
//   PUT  /api/core/businesses/{id}/modules    (feature provisioning)
//   POST /api/admin/businesses/assign-product (review submit)
//   POST /api/admin/businesses/provision      (provision w/ initial owner password)
//   GET  /api/admin/businesses/provision?businessId= (status/logs)
//   POST /api/admin/businesses/{id}/reset-password   (owner credentials)
// Sub-steps reused: ProductSelectionStep, PlanSelectionStep, ReviewStep.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, ArrowRight, Loader2, Check, Building2, Boxes, Globe, Save,
  KeyRound, ShieldCheck, ExternalLink, Rocket,
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { useAdminStore } from '@/stores/admin-store'
import { getWorkspaceEntryRoute } from '@/lib/workspace-routes'
import { ProductSelectionStep } from '@/components/onboarding/steps/product-selection-step'
import { PlanSelectionStep } from '@/components/onboarding/steps/plan-selection-step'
import { ReviewStep } from '@/components/onboarding/steps/review-step'
import { toast } from 'sonner'

interface Biz {
  id: string; businessCode: string | null; name: string; slug: string; businessType: string; status: string
  productCode: string | null; subscriptionPlanCode: string | null
  city: string | null; state: string | null; pincode: string | null; country: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null; supportEmail: string | null; supportPhone: string | null
  gstNumber: string | null; panNumber: string | null; cinNumber: string | null; fssaiLicense: string | null
  favicon: string | null; secondaryColor: string | null; tagline: string | null; description: string | null
  isOnline: boolean; primaryColor: string; logo: string | null; createdAt: string
  subscription: { status: string } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  ownerEmail: string | null; ownerName: string | null; ownerPhone: string | null
  ownerLoginId: string | null; ownerLastLogin: string | null; ownerIsActive: boolean | null
}

interface Props { businessId?: string }

const SECTIONS = [
  { key: 'setup', label: 'Business Setup', icon: Building2 },
  { key: 'commercial', label: 'Commercial Features', icon: Boxes },
  { key: 'platform', label: 'Platform', icon: Globe },
] as const

const GATEWAYS = ['COD', 'Razorpay', 'PhonePe', 'Stripe', 'Cashfree', 'PayU', 'CCAvenue']

function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''} break-words`}>{value ?? '—'}</p>
    </div>
  )
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-muted-foreground">{children}</label>
}

export function BusinessManagementWizard({ businessId }: Props) {
  const { setActivePage, setManageBusinessId } = useAdminStore()
  const [bizId, setBizId] = useState<string | undefined>(businessId)
  const isCreate = !businessId // started without an id => create flow

  const [biz, setBiz] = useState<Biz | null>(null)
  const [loading, setLoading] = useState(!!businessId)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [provStatus, setProvStatus] = useState<{ status?: string; steps?: Array<{ name: string; status: string; error?: string | null }> } | null>(null)

  // Unified editable form (used in both create and edit).
  type Form = Partial<Biz> & { ownerName?: string | null; ownerEmail?: string | null; ownerPhone?: string | null; ownerPassword?: string; ownerPasswordConfirm?: string }
  const [form, setForm] = useState<Form>({ country: 'India', primaryColor: '#10B981' })
  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const goBackToList = () => { setManageBusinessId(null); setActivePage('businesses') }

  // Load existing business (edit/manage mode) from the same list API the table uses.
  const load = useCallback(async (id: string) => {
    try {
      setLoading(true); setError(null)
      const res = await fetch('/api/admin/businesses?limit=200', { headers: getAuthHeaders() })
      const json = await res.json()
      const list: Biz[] = Array.isArray(json.data) ? json.data : (json.data?.businesses ?? [])
      const found = list.find((b) => b.id === id)
      if (!found) throw new Error('Business not found')
      setBiz(found)
      setForm({ ...found, ownerName: found.ownerName, ownerEmail: found.ownerEmail, ownerPhone: found.ownerPhone })
      fetch(`/api/admin/businesses/provision?businessId=${encodeURIComponent(id)}`, { headers: getAuthHeaders() })
        .then((r) => r.json()).then((j) => setProvStatus(j.data ?? null)).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (bizId) load(bizId) }, [bizId, load])

  // ── Persist Business Setup ────────────────────────────────────────────────
  // Create mode: POST a new tenant. Edit mode: PUT the existing one. Same fields.
  const saveSetup = async (): Promise<boolean> => {
    setSaving(true)
    try {
      if (!bizId) {
        // CREATE the tenant.
        if (!form.name?.trim() || !form.slug?.trim() || !form.contactEmail?.trim() || !form.contactPhone?.trim()) {
          toast.error('Name, slug, owner email and phone are required'); return false
        }
        if (form.ownerPassword && form.ownerPassword !== form.ownerPasswordConfirm) {
          toast.error('Owner passwords do not match'); return false
        }
        const res = await fetch('/api/admin/businesses', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            businessName: form.name, slug: form.slug, ownerName: form.ownerName, email: form.contactEmail, phone: form.contactPhone,
            address1: form.address, city: form.city, state: form.state, pincode: form.pincode, country: form.country || 'India',
            businessType: form.businessType,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.success === false) throw new Error(json.message || json.error || 'Failed to create business')
        const id = json.data?.id
        if (!id) throw new Error('Create returned no id')
        // Persist branding/legal that the create endpoint does not take.
        await fetch(`/api/core/businesses/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            tagline: form.tagline ?? null, logo: form.logo ?? null, favicon: form.favicon ?? null,
            primaryColor: form.primaryColor, secondaryColor: form.secondaryColor ?? null,
            supportEmail: form.supportEmail ?? null, supportPhone: form.supportPhone ?? null,
            gstNumber: form.gstNumber ?? null, panNumber: form.panNumber ?? null, cinNumber: form.cinNumber ?? null, fssaiLicense: form.fssaiLicense ?? null,
          }),
        }).catch(() => {})
        setBizId(id)
        toast.success('Business created')
        return true
      }
      // EDIT existing.
      const body: Record<string, unknown> = {
        name: form.name, businessType: form.businessType, slug: form.slug,
        tagline: form.tagline ?? null, description: form.description ?? null,
        logo: form.logo ?? null, favicon: form.favicon ?? null,
        primaryColor: form.primaryColor, secondaryColor: form.secondaryColor ?? null,
        contactEmail: form.contactEmail ?? null, contactPhone: form.contactPhone ?? null,
        supportEmail: form.supportEmail ?? null, supportPhone: form.supportPhone ?? null,
        address: form.address ?? null, city: form.city ?? null, state: form.state ?? null,
        pincode: form.pincode ?? null, country: form.country ?? null,
        gstNumber: form.gstNumber ?? null, panNumber: form.panNumber ?? null,
        cinNumber: form.cinNumber ?? null, fssaiLicense: form.fssaiLicense ?? null,
      }
      const res = await fetch(`/api/core/businesses/${bizId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to save')
      setBiz((p) => (p ? { ...p, ...form } as Biz : p))
      toast.success('Saved')
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Commercial: assign product / plan (create) ───────────────────────────
  const assign = async (patch: Record<string, unknown>) => {
    if (!bizId) return
    await fetch(`/api/core/businesses/${bizId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(patch),
    }).catch(() => {})
    if (bizId) load(bizId)
  }

  const toggleModule = async (moduleKey: string, current: string) => {
    if (!bizId) return
    const enable = current !== 'ENABLED'
    await fetch(`/api/core/businesses/${bizId}/modules`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ moduleKey, status: enable ? 'ENABLED' : 'DISABLED' }),
    }).then((r) => { if (!r.ok) throw new Error() })
      .then(() => setBiz((p) => p ? { ...p, modules: p.modules.map((m) => m.moduleKey === moduleKey ? { ...m, status: enable ? 'ENABLED' : 'DISABLED' } : m) } : p))
      .catch(() => toast.error('Failed to update module'))
  }

  // ── Platform: provision / re-provision ───────────────────────────────────
  const provision = async () => {
    if (!bizId || !biz) return
    setSaving(true)
    try {
      // Confirm product+plan are present (review submit), then provision.
      if (biz.productCode && biz.subscriptionPlanCode) {
        await fetch('/api/admin/businesses/assign-product', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ businessId: bizId, productCode: biz.productCode, subscriptionPlanCode: biz.subscriptionPlanCode }),
        }).catch(() => {})
      }
      const res = await fetch('/api/admin/businesses/provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ businessId: bizId, ownerPassword: form.ownerPassword || undefined, confirmPassword: form.ownerPasswordConfirm || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.data?.error || json.error || 'Provisioning failed')
      const temp = json.data?.ownerTempPassword
      toast.success(temp ? `Provisioned. Temp owner password: ${temp}` : 'Provisioned')
      load(bizId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed')
    } finally {
      setSaving(false)
    }
  }

  const resetOwnerPassword = async () => {
    if (!bizId) return
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}/reset-password`, { method: 'POST', headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed')
      const pw = json.data?.password || json.data?.newPassword || json.data?.temporaryPassword
      toast.success(pw ? `New owner password: ${pw} (must change on next login)` : 'Owner password reset')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    }
  }

  const workspaceUrl = useMemo(() => bizId ? `https://${(biz?.productCode || 'commerce').toLowerCase()}.quantixtechnology.in/${bizId}` : '', [bizId, biz])

  // Section navigation. Editable sections persist on Continue.
  const next = async () => {
    if (section === 0) { const ok = await saveSetup(); if (!ok) return }
    setSection((s) => Math.min(s + 1, SECTIONS.length - 1))
  }
  const back = () => setSection((s) => Math.max(s - 1, 0))

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
  if (error) return (
    <div className="p-8"><Button variant="outline" size="sm" onClick={goBackToList} className="gap-1"><ArrowLeft className="size-4" /> Back to Businesses</Button>
      <Card className="mt-4 p-6 bg-red-50 border-red-200"><p className="text-red-600 text-sm">{error}</p></Card></div>
  )

  const Sec = SECTIONS[section]

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 shrink-0"><ArrowLeft className="size-4" /> Businesses</Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{isCreate && !bizId ? 'New Business' : (biz?.name || form.name || 'Business')}</h1>
            <p className="text-xs text-muted-foreground">Quantix Platform · {isCreate && !bizId ? 'Create' : 'Manage'} · {biz?.businessCode || bizId || '—'}</p>
          </div>
        </div>
        {biz && <Badge variant="outline" className="shrink-0">{biz.status}</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Section nav */}
        <nav className="md:sticky md:top-4 h-max">
          <ol className="space-y-1">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon
              const active = i === section
              const done = i < section
              const locked = isCreate && !bizId && i > 0 // create: must finish Setup first
              return (
                <li key={s.key}>
                  <button
                    onClick={() => { if (!locked) setSection(i) }}
                    disabled={locked}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? 'bg-indigo-600 text-white' : done ? 'text-indigo-700 hover:bg-indigo-50' : locked ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/20' : done ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <Icon className="size-4 shrink-0" /><span className="truncate">{s.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Section content */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2"><Sec.icon className="size-5 text-indigo-600" /><h2 className="text-lg font-semibold">{Sec.label}</h2></div>

          {/* ── SECTION 1 — BUSINESS SETUP ──────────────────────────────── */}
          {section === 0 && (
            <div className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Business Name</Lbl><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
                  <div><Lbl>Slug</Lbl><Input value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} /></div>
                  <div><Lbl>Business Type</Lbl><Input value={form.businessType ?? ''} onChange={(e) => set('businessType', e.target.value)} placeholder="e.g. GROCERY" /></div>
                  <div><Lbl>Tagline</Lbl><Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></div>
                  {!isCreate && <Field label="Business Code" value={biz?.businessCode} mono />}
                  {!isCreate && <Field label="Business ID" value={bizId} mono />}
                </div>
              </Card>
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Branding (Quantix-managed)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Logo URL</Lbl><Input value={form.logo ?? ''} onChange={(e) => set('logo', e.target.value)} /></div>
                  <div><Lbl>Favicon URL</Lbl><Input value={form.favicon ?? ''} onChange={(e) => set('favicon', e.target.value)} /></div>
                  <div><Lbl>Primary Color</Lbl><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.primaryColor ?? '#10B981'} onChange={(e) => set('primaryColor', e.target.value)} /><Input value={form.primaryColor ?? ''} onChange={(e) => set('primaryColor', e.target.value)} /></div></div>
                  <div><Lbl>Secondary Color</Lbl><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.secondaryColor ?? '#000000'} onChange={(e) => set('secondaryColor', e.target.value)} /><Input value={form.secondaryColor ?? ''} onChange={(e) => set('secondaryColor', e.target.value)} /></div></div>
                </div>
              </Card>
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Contact &amp; Legal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Owner Name</Lbl><Input value={form.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} /></div>
                  <div><Lbl>Owner Email{isCreate ? ' *' : ''}</Lbl><Input value={form.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} /></div>
                  <div><Lbl>Owner Phone{isCreate ? ' *' : ''}</Lbl><Input value={form.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} /></div>
                  <div><Lbl>Support Email</Lbl><Input value={form.supportEmail ?? ''} onChange={(e) => set('supportEmail', e.target.value)} /></div>
                  <div><Lbl>Support Phone</Lbl><Input value={form.supportPhone ?? ''} onChange={(e) => set('supportPhone', e.target.value)} /></div>
                  <div className="sm:col-span-2"><Lbl>Address</Lbl><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></div>
                  <div><Lbl>City</Lbl><Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></div>
                  <div><Lbl>State</Lbl><Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} /></div>
                  <div><Lbl>Pincode</Lbl><Input value={form.pincode ?? ''} onChange={(e) => set('pincode', e.target.value)} /></div>
                  <div><Lbl>Country</Lbl><Input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} /></div>
                  <div><Lbl>GST</Lbl><Input value={form.gstNumber ?? ''} onChange={(e) => set('gstNumber', e.target.value)} /></div>
                  <div><Lbl>PAN</Lbl><Input value={form.panNumber ?? ''} onChange={(e) => set('panNumber', e.target.value)} /></div>
                  <div><Lbl>CIN</Lbl><Input value={form.cinNumber ?? ''} onChange={(e) => set('cinNumber', e.target.value)} /></div>
                  <div><Lbl>FSSAI</Lbl><Input value={form.fssaiLicense ?? ''} onChange={(e) => set('fssaiLicense', e.target.value)} /></div>
                </div>
              </Card>
              {/* Owner credentials: initial password (create) / reset (edit). */}
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><KeyRound className="size-4" /> Owner Account</h3>
                {isCreate ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Lbl>Initial Owner Password</Lbl><Input type="password" value={form.ownerPassword ?? ''} onChange={(e) => set('ownerPassword', e.target.value)} autoComplete="new-password" /></div>
                    <div><Lbl>Confirm Password</Lbl><Input type="password" value={form.ownerPasswordConfirm ?? ''} onChange={(e) => set('ownerPasswordConfirm', e.target.value)} autoComplete="new-password" /></div>
                    <p className="sm:col-span-2 text-xs text-muted-foreground">Set at provisioning. The owner must change it on first login. (Leave blank to auto-generate a temporary password.)</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Owner Email" value={biz?.ownerEmail} />
                      <Field label="Login ID" value={biz?.ownerLoginId} mono />
                      <Field label="Last Login" value={biz?.ownerLastLogin ? new Date(biz.ownerLastLogin).toLocaleString('en-IN') : 'Never'} />
                      <Field label="Account Status" value={biz?.ownerIsActive === false ? 'Suspended' : 'Active'} />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1" onClick={resetOwnerPassword}><KeyRound className="size-3" /> Reset Password (forces change)</Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── SECTION 2 — COMMERCIAL FEATURES ─────────────────────────── */}
          {section === 1 && bizId && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Product</h3>
                {biz?.productCode ? (
                  <div className="flex items-center gap-3">
                    <Badge className="bg-indigo-100 text-indigo-700">{biz.productCode}</Badge>
                    <span className="text-xs text-muted-foreground">Assigned</span>
                  </div>
                ) : (
                  <ProductSelectionStep onProductSelect={(code) => assign({ productCode: code })} />
                )}
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Plan</h3>
                {!biz?.productCode ? <p className="text-sm text-muted-foreground">Select a product first.</p>
                  : biz?.subscriptionPlanCode ? (
                    <div className="flex items-center gap-3"><Badge className="bg-emerald-100 text-emerald-700">{biz.subscriptionPlanCode}</Badge><span className="text-xs text-muted-foreground">Assigned</span></div>
                  ) : (
                    <PlanSelectionStep productCode={biz.productCode} onPlanSelect={(code) => assign({ subscriptionPlanCode: code })} />
                  )}
              </Card>
              {/* Resource overrides — reuse the self-contained ReviewStep. */}
              {biz?.productCode && biz?.subscriptionPlanCode && (
                <Card className="p-6"><ReviewStep state={{ businessId: bizId }} /></Card>
              )}
              {/* Modules / feature provisioning */}
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Modules (purchased features)</h3>
                {(!biz || biz.modules.length === 0) ? <p className="text-sm text-muted-foreground">Modules appear after provisioning.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {biz.modules.map((m) => (
                      <div key={m.moduleKey} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm">{m.moduleName}</span>
                        <Switch checked={m.status === 'ENABLED'} onCheckedChange={() => toggleModule(m.moduleKey, m.status)} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-1">Payment Gateway Availability</h3>
                <p className="text-xs text-muted-foreground mb-3">Quantix decides which gateways the tenant may use; the Business Owner configures keys for enabled ones (not here).</p>
                <div className="flex flex-wrap gap-2">
                  {GATEWAYS.map((g) => {
                    const enabled = (biz?.modules ?? []).some((m) => m.status === 'ENABLED' && m.moduleKey.toUpperCase().includes(g.toUpperCase())) || g === 'COD'
                    return <Badge key={g} variant="outline" className={enabled ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-400'}>{enabled ? '✓' : '✗'} {g}</Badge>
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* ── SECTION 3 — PLATFORM ────────────────────────────────────── */}
          {section === 2 && bizId && (
            <div className="space-y-4">
              <Card className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs text-indigo-700"><ShieldCheck className="size-4" /> Managed by Quantix — the Business Owner receives generated URLs only (no deploy/SSL/DNS/hosting controls).</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Website / Workspace URL" value={workspaceUrl} mono />
                  <Field label="Subdomain" value={`${(biz?.productCode || 'commerce').toLowerCase()}.quantixtechnology.in`} mono />
                  <Field label="Custom Domain" value={biz?.domain?.domain} />
                  <Field label="SSL / Domain Status" value={biz?.domain?.status} />
                  <Field label="In-app Workspace Route" value={getWorkspaceEntryRoute(biz?.productCode)} mono />
                  {(biz?.deployments ?? []).map((d) => <Field key={d.id} label={`Deployment · ${d.type}`} value={`${d.status} (health ${d.healthStatus})`} />)}
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-max" onClick={() => window.open(workspaceUrl, '_blank')}><ExternalLink className="size-3" /> Open Website</Button>
              </Card>
              <Card className="p-6 space-y-3">
                <h3 className="font-semibold text-sm">Provisioning</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Workspace Status" value={biz?.status} />
                  <Field label="Website / Domain" value={biz?.domain?.status || 'PENDING'} />
                  <Field label="Provisioning" value={provStatus?.status || '—'} />
                </div>
                <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white w-max" onClick={provision} disabled={saving}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />} {biz?.status === 'ACTIVE' ? 'Provision Again' : 'Provision'}
                </Button>
                {provStatus?.steps?.length ? (
                  <div className="space-y-1 text-xs font-mono pt-2 border-t">
                    {provStatus.steps.map((s, i) => (
                      <div key={i} className={s.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}>
                        {s.status === 'COMPLETED' ? '✓' : s.status === 'FAILED' ? '✗' : '•'} {s.name}: {s.status}{s.error ? ` — ${s.error}` : ''}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={back} disabled={section === 0} className="gap-1"><ArrowLeft className="size-4" /> Back</Button>
            {section < SECTIONS.length - 1 ? (
              <Button size="sm" onClick={next} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="size-4 animate-spin" /> : section === 0 ? <Save className="size-4" /> : null}
                {section === 0 ? (isCreate && !bizId ? 'Create & Continue' : 'Save & Continue') : 'Continue'} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={goBackToList} className="gap-1"><Check className="size-4" /> Done</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
