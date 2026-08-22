'use client'

// ============================================================================
// Business Wizard — THE single business management experience for the whole
// Quantix Platform. One component handles BOTH Create and Edit:
//   - no businessId  -> Create mode (creates the tenant, assigns product/plan,
//                       provisions, sets the initial owner password).
//   - businessId set -> Edit/Manage mode (loads + edits an existing tenant).
//
// Sections:
//   1. Business Setup       — tenant identity, branding, contact & legal, owner.
//   2. Licensed Features    — product, plan, resource overrides, modules,
//                             payment-gateway availability (what the tenant bought).
//   3. Review Configuration — read-only summary before provisioning.
//   4. Provision Workspace  — run/re-run provisioning + logs.
//   5. Deployment Status    — read-only digital-asset cards ("Managed by Quantix").
//
// A persistent Business Summary header is shown across every section.
//
// Reuses existing components/APIs only — no new APIs, no provisioning-logic,
// schema, auth/RBAC or lifecycle changes. Sub-steps reused: ProductSelectionStep,
// PlanSelectionStep, ReviewStep.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, ArrowRight, Loader2, Check, Building2, Boxes, ClipboardCheck, Rocket, Server,
  Save, KeyRound, ShieldCheck, ExternalLink, Globe, Smartphone, Apple, Lock, HardDrive, Activity,
  Eye, EyeOff,
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { LaundryImageUpload } from '@/components/laundry/views/pricing/laundry-image-upload'
import { LaundryLicensingCard } from '@/components/admin/laundry/laundry-licensing-card'
import { CommerceTemplateAssignCard, CommerceTemplateReviewField } from '@/components/admin/commerce/commerce-template-assign-card'
import { CommerceCategoryField } from '@/components/admin/businesses/commerce-category-field'
import { ProductSelector } from '@/components/admin/businesses/product-selector'
import { isCategoryValidForProduct, businessCategoryLabel } from '@/lib/products/product-categories'
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
  { key: 'licensed', label: 'Licensed Features', icon: Boxes },
  { key: 'review', label: 'Review Configuration', icon: ClipboardCheck },
  { key: 'provision', label: 'Provision Workspace', icon: Rocket },
  { key: 'deployment', label: 'Deployment Status', icon: Server },
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
// Password field with a visibility toggle. Only ever holds a password being
// SET — the stored one is a bcrypt hash and is never sent to the browser, so
// there is nothing here that could reveal an existing password.
function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="pr-9" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
// Read-only digital-asset card (Deployment Status).
function AssetCard({ icon: Icon, title, status, detail, managed = true }: { icon: React.ElementType; title: string; status: string; detail?: string; managed?: boolean }) {
  const tone = /ready|active|live|healthy|completed|available/i.test(status) ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : /fail|error|offline|unhealthy/i.test(status) ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-gray-600 bg-gray-50 border-gray-200'
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="size-4 text-indigo-600" /><span className="text-sm font-semibold">{title}</span></div>
        <Badge variant="outline" className={`text-[10px] ${tone}`}>{status}</Badge>
      </div>
      {detail && <p className="text-xs text-muted-foreground font-mono break-words">{detail}</p>}
      {managed && <p className="text-[10px] text-indigo-600 flex items-center gap-1"><ShieldCheck className="size-3" /> Managed by Quantix</p>}
    </Card>
  )
}

export function BusinessManagementWizard({ businessId }: Props) {
  const { setActivePage, setManageBusinessId } = useAdminStore()
  const [bizId, setBizId] = useState<string | undefined>(businessId)
  const isCreate = !businessId

  const [biz, setBiz] = useState<Biz | null>(null)
  const [loading, setLoading] = useState(!!businessId)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [provStatus, setProvStatus] = useState<{ status?: string; steps?: Array<{ name: string; status: string; error?: string | null }> } | null>(null)

  type Form = Partial<Biz> & { ownerName?: string | null; ownerEmail?: string | null; ownerPhone?: string | null; ownerPassword?: string; ownerPasswordConfirm?: string }
  const [form, setForm] = useState<Form>({ country: 'India', primaryColor: '#10B981' })
  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const goBackToList = () => { setManageBusinessId(null); setActivePage('businesses') }

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

  // Follow the prop, do not freeze it. `useState(businessId)` reads its argument
  // once, at mount — so when the page swaps in a different business without
  // unmounting, bizId kept pointing at the previous one and every fetch, every
  // save and the Business Category field went on answering for it. The render
  // site keys this component per business, which makes this belt-and-braces; it
  // is here so a future call site that forgets the key is not a data-isolation
  // bug. Whatever was loaded for the old business is dropped in the same pass,
  // so no field of theirs can be painted while the new one is still loading.
  useEffect(() => {
    setBizId(businessId)
    setBiz(null)
    setForm({ country: 'India', primaryColor: '#10B981' })
    setProvStatus(null)
    setSection(0)
  }, [businessId])

  useEffect(() => { if (bizId) load(bizId) }, [bizId, load])

  // ── Persist Business Setup (create => POST; edit => PUT) ──────────────────
  const saveSetup = async (): Promise<boolean> => {
    setSaving(true)
    try {
      if (!bizId) {
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
      // NOTE: businessType is intentionally NOT sent here. It is the authoritative
      // Commerce category and is changed only through the controlled, platform-only
      // /api/core/commerce/business-category flow (CommerceCategoryField).
      const body: Record<string, unknown> = {
        name: form.name, slug: form.slug,
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

  const provision = async () => {
    if (!bizId || !biz) return
    setSaving(true)
    try {
      if (biz.productCode && biz.subscriptionPlanCode) {
        await fetch('/api/admin/businesses/assign-product', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ businessId: bizId, productCode: biz.productCode, subscriptionPlanCode: biz.subscriptionPlanCode }),
        }).catch(() => {})
      }
      const res = await fetch('/api/admin/businesses/provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        // Owner identity travels with the password: the owner user is created
        // HERE, so anything the Super Admin typed on the Business Setup form
        // has to reach this call or it is silently dropped (which is what
        // happened to Owner Name before).
        body: JSON.stringify({
          businessId: bizId,
          ownerPassword: form.ownerPassword || undefined,
          confirmPassword: form.ownerPasswordConfirm || undefined,
          ownerName: form.ownerName || undefined,
          ownerEmail: form.ownerEmail || form.contactEmail || undefined,
          ownerPhone: form.ownerPhone || form.contactPhone || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.data?.error || json.error || 'Provisioning failed')
      const temp = json.data?.ownerTempPassword
      // The Super Admin's chosen password has been hashed and stored; drop the
      // plain text from state rather than leaving it in the form.
      setForm((p) => ({ ...p, ownerPassword: '', ownerPasswordConfirm: '' }))
      toast.success(temp ? `Provisioned. Temp owner password: ${temp}` : 'Provisioned')
      load(bizId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Owner Account — UPDATE the existing owner user, never create one ──────
  // Sends only what the Super Admin actually filled in. Blank password fields
  // mean "leave the password alone", which is why they start empty and are
  // cleared again on success — the existing password is never shown or sent.
  const [savingOwner, setSavingOwner] = useState(false)
  const saveOwnerAccount = async () => {
    if (!bizId) return
    if ((form.ownerPassword || form.ownerPasswordConfirm) && form.ownerPassword !== form.ownerPasswordConfirm) {
      toast.error('Passwords do not match'); return
    }
    setSavingOwner(true)
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}/owner`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: form.ownerName ?? undefined,
          phone: form.ownerPhone ?? undefined,
          email: form.ownerEmail ?? undefined,
          password: form.ownerPassword || undefined,
          confirmPassword: form.ownerPasswordConfirm || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to save owner account')
      // Never keep a plain-text password in component state after the save.
      setForm((p) => ({ ...p, ownerPassword: '', ownerPasswordConfirm: '' }))
      toast.success(json.sessionsRevoked
        ? 'Owner account updated. Existing owner sessions were signed out.'
        : 'Owner account updated')
      load(bizId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save owner account')
    } finally {
      setSavingOwner(false)
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

  const productCode = biz?.productCode || form.productCode
  // Workspace host resolved from the Product Registry (registry-driven launcher),
  // not constructed here. Falls back to the conventional host until it loads.
  const [wsHost, setWsHost] = useState<string | null>(null)
  useEffect(() => {
    if (!productCode) { setWsHost(null); return }
    fetch(`/api/admin/products/runtime/${encodeURIComponent(productCode)}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const url: string | undefined = j?.data?.runtime?.workspaceUrl
        if (url) setWsHost(url.replace(/^https?:\/\//i, '').replace(/\/+$/, '').split('/')[0])
      })
      .catch(() => {})
  }, [productCode])
  const subdomain = wsHost || (productCode ? `${productCode.toLowerCase()}.quantixtechnology.in` : '—')
  const workspaceUrl = useMemo(() => (bizId && (wsHost || productCode))
    ? `https://${wsHost || `${productCode!.toLowerCase()}.quantixtechnology.in`}/${bizId}`
    : '', [bizId, wsHost, productCode])

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
  const enabledModules = (biz?.modules ?? []).filter((m) => m.status === 'ENABLED')

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 w-max"><ArrowLeft className="size-4" /> Businesses</Button>

      {/* Persistent Business Summary header */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Business</p>
            <p className="text-sm font-bold truncate">{biz?.name || form.name || (isCreate ? 'New Business' : '—')}</p>
          </div>
          <Field label="Business ID" value={bizId || '— (unsaved)'} mono />
          <Field label="Workspace" value={subdomain} mono />
          <Field label="Product" value={productCode} />
          <Field label="Plan" value={biz?.subscriptionPlanCode || form.subscriptionPlanCode} />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-0.5">{biz?.status || (isCreate ? 'Draft' : '—')}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Section nav */}
        <nav className="md:sticky md:top-4 h-max">
          <ol className="space-y-1">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon
              const active = i === section
              const done = i < section
              const locked = isCreate && !bizId && i > 0
              return (
                <li key={s.key}>
                  <button onClick={() => { if (!locked) setSection(i) }} disabled={locked}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? 'bg-indigo-600 text-white' : done ? 'text-indigo-700 hover:bg-indigo-50' : locked ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/20' : done ? 'bg-indigo-100' : 'bg-gray-200'}`}>{done ? <Check className="size-3" /> : i + 1}</span>
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

          {/* ── 1 — BUSINESS SETUP ──────────────────────────────────────── */}
          {section === 0 && (
            <div className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Business Name</Lbl><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
                  <div><Lbl>Slug</Lbl><Input value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} /></div>
                  {/* Product FIRST — the authoritative platform classification. Locked
                      once the business is provisioned (productCode assigned / ACTIVE). */}
                  <div><Lbl>Product</Lbl><ProductSelector
                    value={(biz?.productCode || form.productCode) ?? ''}
                    locked={!!biz?.productCode || biz?.status === 'ACTIVE'}
                    onChange={(code) => {
                      set('productCode', code)
                      // Changing product re-evaluates category: clear an incompatible one.
                      if (form.businessType && !isCategoryValidForProduct(code, form.businessType)) set('businessType', '')
                    }}
                  /></div>
                  {/* Business Category — product-scoped; unavailable until Product chosen. */}
                  <div><Lbl>Business Category</Lbl><CommerceCategoryField businessId={bizId ?? null} productCode={(biz?.productCode || form.productCode) ?? null} value={form.businessType ?? ''} onChange={(v) => set('businessType', v)} onChanged={() => bizId && load(bizId)} /></div>
                  <div><Lbl>Tagline</Lbl><Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></div>
                </div>
              </Card>
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Branding (Quantix-managed)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Lbl>Business Logo</Lbl>
                    <LaundryImageUpload value={form.logo || null} businessId={bizId || 'shared'} folder="logos" objectFit="contain"
                      allowed={['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']}
                      helper="PNG, JPEG or WebP. Transparent PNG recommended."
                      formatMsg="Unsupported format. Use PNG, JPEG, WebP or SVG."
                      onChange={(url) => set('logo', url || '')} />
                  </div>
                  <div><Lbl>Favicon</Lbl>
                    <LaundryImageUpload value={form.favicon || null} businessId={bizId || 'shared'} folder="favicons" objectFit="contain" aspect="aspect-square"
                      allowed={['image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']}
                      helper="PNG, WebP or ICO. Square image recommended."
                      formatMsg="Unsupported format. Use PNG, WebP or ICO."
                      onChange={(url) => set('favicon', url || '')} />
                  </div>
                  <div><Lbl>Primary Color</Lbl><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.primaryColor ?? '#10B981'} onChange={(e) => set('primaryColor', e.target.value)} /><Input value={form.primaryColor ?? ''} onChange={(e) => set('primaryColor', e.target.value)} /></div></div>
                  <div><Lbl>Secondary Color</Lbl><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.secondaryColor ?? '#000000'} onChange={(e) => set('secondaryColor', e.target.value)} /><Input value={form.secondaryColor ?? ''} onChange={(e) => set('secondaryColor', e.target.value)} /></div></div>
                </div>
              </Card>
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm">Contact &amp; Legal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Business contact details. Owner identity (name / phone /
                      email / password) lives in Owner Account below — one place,
                      one save. The Owner Name that used to sit here was never
                      sent by this card's save, so it silently did nothing. */}
                  <div><Lbl>Contact Email{isCreate ? ' *' : ''}</Lbl><Input value={form.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} /></div>
                  <div><Lbl>Contact Phone{isCreate ? ' *' : ''}</Lbl><Input value={form.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} /></div>
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
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><KeyRound className="size-4" /> Owner Account</h3>
                {isCreate ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Lbl>Owner Name</Lbl><Input value={form.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} placeholder="Owner's full name" /></div>
                    <div><Lbl>Owner Phone</Lbl><Input value={form.ownerPhone ?? form.contactPhone ?? ''} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="+91XXXXXXXXXX" /></div>
                    <div className="sm:col-span-2"><Lbl>Owner Email / Login ID</Lbl><Input value={form.ownerEmail ?? form.contactEmail ?? ''} onChange={(e) => set('ownerEmail', e.target.value)} placeholder="owner@email.com" /></div>
                    <div><Lbl>Password</Lbl><PasswordInput value={form.ownerPassword ?? ''} onChange={(v) => set('ownerPassword', v)} /></div>
                    <div><Lbl>Confirm Password</Lbl><PasswordInput value={form.ownerPasswordConfirm ?? ''} onChange={(v) => set('ownerPasswordConfirm', v)} /></div>
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      The owner account is created at <b>Provision Workspace</b> with exactly these details. A password you set here is the owner&apos;s real
                      password — they can sign in with it and are not forced to change it. Leave both blank to auto-generate a temporary one instead.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Editable account management — the SAME owner user is
                        updated; changing the email never creates a second one. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><Lbl>Owner Name</Lbl><Input value={form.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} /></div>
                      <div><Lbl>Owner Phone</Lbl><Input value={form.ownerPhone ?? ''} onChange={(e) => set('ownerPhone', e.target.value)} /></div>
                      <div className="sm:col-span-2"><Lbl>Owner Email / Login ID</Lbl><Input value={form.ownerEmail ?? ''} onChange={(e) => set('ownerEmail', e.target.value)} /></div>
                      {/* Blank = leave the password unchanged. The stored value
                          is a hash and is never sent to the browser. */}
                      <div><Lbl>New Password</Lbl><PasswordInput value={form.ownerPassword ?? ''} onChange={(v) => set('ownerPassword', v)} placeholder="Leave blank to keep current" /></div>
                      <div><Lbl>Confirm Password</Lbl><PasswordInput value={form.ownerPasswordConfirm ?? ''} onChange={(v) => set('ownerPasswordConfirm', v)} placeholder="Leave blank to keep current" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-3">
                      <Field label="Login ID" value={biz?.ownerLoginId} mono />
                      <Field label="Account Status" value={biz?.ownerIsActive === false ? 'Suspended' : 'Active'} />
                      <Field label="Last Login" value={biz?.ownerLastLogin ? new Date(biz.ownerLastLogin).toLocaleString('en-IN') : 'Never'} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Changing the password or the email signs the owner out of existing sessions so the new credentials take effect.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="gap-1" onClick={saveOwnerAccount} disabled={savingOwner}>
                        {savingOwner ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save Changes
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={resetOwnerPassword}><KeyRound className="size-3" /> Reset Password (auto-generate, forces change)</Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── 2 — LICENSED FEATURES ───────────────────────────────────── */}
          {section === 1 && bizId && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Product</h3>
                {biz?.productCode ? (
                  <div className="flex items-center gap-3"><Badge className="bg-indigo-100 text-indigo-700">{biz.productCode}</Badge><span className="text-xs text-muted-foreground">Licensed</span></div>
                ) : <ProductSelectionStep onProductSelect={(code) => assign({ productCode: code })} />}
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Plan</h3>
                {!biz?.productCode ? <p className="text-sm text-muted-foreground">Select a product first.</p>
                  : biz?.subscriptionPlanCode ? <div className="flex items-center gap-3"><Badge className="bg-emerald-100 text-emerald-700">{biz.subscriptionPlanCode}</Badge><span className="text-xs text-muted-foreground">Licensed</span></div>
                  : <PlanSelectionStep productCode={biz.productCode} onPlanSelect={(code) => assign({ subscriptionPlanCode: code })} />}
              </Card>
              {biz?.productCode && biz?.subscriptionPlanCode && (<Card className="p-6"><ReviewStep state={{ businessId: bizId }} /></Card>)}
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Modules (licensed features)</h3>
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
              {/* Per-tenant licence — the hierarchical module/screen selector.
                  Replaces the old CRM/Marketing switches; writes through the
                  licensing engine the sidebar, Navigation Manager, RBAC and the
                  API guards all read. Self-hides for non-Laundry businesses. */}
              <LaundryLicensingCard businessId={bizId} />
              {/* Commerce storefront template — self-hides unless product=COMMERCE.
                  Resolves the category default and allows a compatible override. */}
              <CommerceTemplateAssignCard businessId={bizId} productCode={biz?.productCode} />
              {/* Laundry website template — honest platform state. The Laundry
                  template renderer is not implemented yet (Commerce renderer first).
                  Never show Commerce templates to a Laundry business. */}
              {biz?.productCode === 'LAUNDRY' && (
                <Card className="p-6 space-y-1">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Website Template</h3>
                  <p className="text-xs text-muted-foreground">Laundry website templates are <b>planned</b> — the template renderer is not yet enabled for the Laundry product. No Commerce template is applied.</p>
                </Card>
              )}
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

          {/* ── 3 — REVIEW CONFIGURATION (read-only) ─────────────────────── */}
          {section === 2 && bizId && (
            <Card className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Confirm the tenant configuration before provisioning.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business" value={biz?.name} />
                <Field label="Slug" value={biz?.slug} mono />
                <Field label="Business Category" value={businessCategoryLabel(biz?.productCode, biz?.businessType)} />
                <Field label="Owner" value={`${biz?.ownerName ?? '—'} (${biz?.ownerEmail ?? '—'})`} />
                <Field label="Product" value={biz?.productCode} />
                <Field label="Plan" value={biz?.subscriptionPlanCode} />
                <Field label="Address" value={[biz?.address, biz?.city, biz?.state, biz?.pincode, biz?.country].filter(Boolean).join(', ') || '—'} />
                <Field label="GST / PAN" value={`${biz?.gstNumber ?? '—'} / ${biz?.panNumber ?? '—'}`} />
                <Field label="Modules enabled" value={`${enabledModules.length}${enabledModules.length ? ` (${enabledModules.map((m) => m.moduleName).join(', ')})` : ''}`} />
                <Field label="Current Status" value={biz?.status} />
                <CommerceTemplateReviewField businessId={bizId} productCode={biz?.productCode} />
              </div>
            </Card>
          )}

          {/* ── 4 — PROVISION WORKSPACE ─────────────────────────────────── */}
          {section === 3 && bizId && (
            <Card className="p-6 space-y-3">
              <p className="text-xs text-muted-foreground">{biz?.status === 'ACTIVE' ? 'Workspace is provisioned. Re-running is idempotent.' : 'Provision the tenant workspace and create the owner account.'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Workspace Status" value={biz?.status} />
                <Field label="Provisioning" value={provStatus?.status || '—'} />
                <Field label="Product / Plan" value={`${biz?.productCode ?? '—'} / ${biz?.subscriptionPlanCode ?? '—'}`} />
              </div>
              <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white w-max" onClick={provision} disabled={saving || !biz?.productCode || !biz?.subscriptionPlanCode}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />} {biz?.status === 'ACTIVE' ? 'Provision Again' : 'Provision Workspace'}
              </Button>
              {!biz?.productCode || !biz?.subscriptionPlanCode ? <p className="text-xs text-amber-600">Assign a product and plan in Licensed Features first.</p> : null}
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
          )}

          {/* ── 5 — DEPLOYMENT STATUS (read-only cards) ──────────────────── */}
          {section === 4 && bizId && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-indigo-700"><ShieldCheck className="size-4" /> Read-only. The Business Owner receives the generated URLs — no deploy / SSL / DNS / hosting controls.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AssetCard icon={Globe} title="Website" status={biz?.status === 'ACTIVE' ? 'Live' : 'Pending'} detail={workspaceUrl || subdomain} />
                <AssetCard icon={Smartphone} title="PWA" status={biz?.status === 'ACTIVE' ? 'Available' : 'Pending'} detail={getWorkspaceEntryRoute(biz?.productCode)} />
                <AssetCard icon={Smartphone} title="Android App" status="Generated on demand" detail="Quantix build pipeline" />
                <AssetCard icon={Apple} title="iOS App" status="Generated on demand" detail="Quantix build pipeline" />
                <AssetCard icon={Globe} title="Domain" status={biz?.domain?.status || 'Default subdomain'} detail={biz?.domain?.domain || subdomain} />
                <AssetCard icon={Lock} title="SSL" status={biz?.domain?.status === 'ACTIVE' ? 'Active' : 'Auto-managed'} detail="Issued & renewed by Quantix" />
                <AssetCard icon={HardDrive} title="Hosting" status="Active" detail="Quantix Cloud (AWS)" />
                <AssetCard icon={Activity} title="Deployment Health"
                  status={(biz?.deployments ?? []).some((d) => /unhealthy|fail/i.test(d.healthStatus)) ? 'Unhealthy' : (biz?.deployments?.length ? 'Healthy' : (biz?.status === 'ACTIVE' ? 'Healthy' : 'Pending'))}
                  detail={(biz?.deployments ?? []).map((d) => `${d.type}:${d.status}`).join(', ') || 'No deployment records'} />
              </div>
              <Button variant="outline" size="sm" className="gap-1 w-max" disabled={!workspaceUrl} onClick={() => window.open(workspaceUrl, '_blank')}><ExternalLink className="size-3" /> Open Website</Button>
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
