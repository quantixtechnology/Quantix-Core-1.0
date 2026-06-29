'use client'

// ============================================================================
// Business Management Wizard (full page) — replaces the right-side drawer.
//
// Quantix Super Admin tool to manage a tenant. Eight steps separate platform
// administration (tenant identity, branding, legal, feature provisioning,
// digital assets/infrastructure, owner credentials, provisioning) from the
// Business Workspace (daily operations). Reuses existing APIs only:
//   GET  /api/admin/businesses           (load full business record)
//   PUT  /api/core/businesses/{id}       (edit profile/branding/contact/legal)
//   PUT  /api/core/businesses/{id}/modules        (feature provisioning)
//   POST /api/admin/businesses/{id}/reset-password (owner credentials)
//   POST /api/admin/businesses/provision           (provision again)
//   GET  /api/admin/businesses/provision?businessId= (provisioning status/logs)
// No new APIs, no provisioning logic changes, no schema changes.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, ArrowRight, Loader2, Check, Building2, Palette, Phone, Boxes,
  Globe, UserCog, Rocket, ClipboardCheck, Save, KeyRound, ShieldCheck, ExternalLink,
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { useAdminStore } from '@/stores/admin-store'
import { getWorkspaceEntryRoute } from '@/lib/workspace-routes'
import { toast } from 'sonner'

interface Biz {
  id: string; businessCode: string | null; name: string; slug: string; businessType: string; status: string
  productCode: string | null; subscriptionPlanCode: string | null
  city: string | null; state: string | null; pincode: string | null; country: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null; supportEmail: string | null; supportPhone: string | null
  gstNumber: string | null; panNumber: string | null; cinNumber: string | null; fssaiLicense: string | null
  favicon: string | null; secondaryColor: string | null; tagline: string | null; description: string | null
  isOnline: boolean; primaryColor: string; logo: string | null; createdAt: string
  subscription: { status: string; plan: { name: string; tier: string } | null } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  ownerEmail: string | null; ownerName: string | null; ownerPhone: string | null
  ownerLoginId: string | null; ownerLastLogin: string | null; ownerIsActive: boolean | null
}

interface Props { businessId?: string }

const STEPS = [
  { key: 'profile', label: 'Business Profile', icon: Building2 },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'contact', label: 'Contact & Legal', icon: Phone },
  { key: 'features', label: 'Subscription & Features', icon: Boxes },
  { key: 'assets', label: 'Digital Assets', icon: Globe },
  { key: 'owner', label: 'Owner Account', icon: UserCog },
  { key: 'provisioning', label: 'Provisioning', icon: Rocket },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
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

export function BusinessManagementWizard({ businessId }: Props) {
  const { setActivePage } = useAdminStore()
  const [biz, setBiz] = useState<Biz | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Editable form (Quantix-managed tenant fields).
  const [form, setForm] = useState<Partial<Biz>>({})
  const set = (k: keyof Biz, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const [provStatus, setProvStatus] = useState<{ status?: string; steps?: Array<{ name: string; status: string; error?: string | null }> } | null>(null)

  const goBackToList = () => setActivePage('businesses')

  const load = useCallback(async () => {
    if (!businessId) { setError('No business selected'); setLoading(false); return }
    try {
      setLoading(true); setError(null)
      const res = await fetch('/api/admin/businesses?limit=200', { headers: getAuthHeaders() })
      const json = await res.json()
      const list: Biz[] = Array.isArray(json.data) ? json.data : (json.data?.businesses ?? [])
      const found = list.find((b) => b.id === businessId)
      if (!found) throw new Error('Business not found')
      setBiz(found)
      setForm(found)
      // provisioning status (best-effort; endpoint is read-only)
      fetch(`/api/admin/businesses/provision?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
        .then((r) => r.json()).then((j) => setProvStatus(j.data ?? null)).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  // Persist the editable tenant fields via the existing Business update API.
  const saveEditable = async (): Promise<boolean> => {
    if (!biz) return false
    setSaving(true)
    try {
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
      const res = await fetch(`/api/core/businesses/${biz.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to save')
      setBiz((p) => (p ? { ...p, ...form } as Biz : p))
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }

  const EDITABLE_STEPS = new Set([0, 1, 2]) // profile, branding, contact & legal

  const next = async () => {
    if (EDITABLE_STEPS.has(step)) {
      const ok = await saveEditable()
      if (!ok) return
      toast.success('Saved')
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const resetOwnerPassword = async () => {
    if (!biz) return
    try {
      const res = await fetch(`/api/admin/businesses/${biz.id}/reset-password`, { method: 'POST', headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed')
      const pw = json.data?.password || json.data?.newPassword || json.data?.temporaryPassword
      toast.success(pw ? `New owner password: ${pw} (must change on next login)` : 'Owner password reset')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    }
  }

  const toggleModule = async (moduleKey: string, current: string) => {
    if (!biz) return
    const enable = current !== 'ENABLED'
    try {
      const res = await fetch(`/api/core/businesses/${biz.id}/modules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ moduleKey, status: enable ? 'ENABLED' : 'DISABLED' }),
      })
      if (!res.ok) throw new Error('Failed')
      setBiz((p) => p ? { ...p, modules: p.modules.map((m) => m.moduleKey === moduleKey ? { ...m, status: enable ? 'ENABLED' : 'DISABLED' } : m) } : p)
    } catch {
      toast.error('Failed to update module')
    }
  }

  const provisionAgain = async () => {
    if (!biz) return
    try {
      const res = await fetch('/api/admin/businesses/provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ businessId: biz.id }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.data?.error || json.error || 'Provisioning failed')
      toast.success('Provisioning re-run complete')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed')
    }
  }

  const workspaceUrl = useMemo(() => biz ? `https://${(biz.productCode || 'commerce').toLowerCase()}.quantixtechnology.in/${biz.id}` : '', [biz])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading business…</div>
  if (error || !biz) return (
    <div className="p-8"><Button variant="outline" size="sm" onClick={goBackToList} className="gap-1"><ArrowLeft className="size-4" /> Back to Businesses</Button>
      <Card className="mt-4 p-6 bg-red-50 border-red-200"><p className="text-red-600 text-sm">{error || 'No business data.'}</p></Card></div>
  )

  const Step = STEPS[step]

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 shrink-0"><ArrowLeft className="size-4" /> Businesses</Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{biz.name}</h1>
            <p className="text-xs text-muted-foreground">Managed by Quantix Platform · {biz.businessCode || biz.id}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">{biz.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Progress / step nav */}
        <nav className="md:sticky md:top-4 h-max">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const active = i === step
              const done = i < step
              return (
                <li key={s.key}>
                  <button
                    onClick={() => setStep(i)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? 'bg-indigo-600 text-white' : done ? 'text-indigo-700 hover:bg-indigo-50' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/20' : done ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <Step.icon className="size-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Step {step + 1} — {Step.label}</h2>
          </div>

          {/* STEP 1 — Business Profile */}
          {step === 0 && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Business Name</label><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Slug</label><Input value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Business Type</label><Input value={form.businessType ?? ''} onChange={(e) => set('businessType', e.target.value)} /></div>
                <Field label="Owner" value={biz.ownerName} />
                <Field label="Product / Workspace" value={biz.productCode} />
                <Field label="Plan" value={biz.subscriptionPlanCode} />
                <Field label="Business Code" value={biz.businessCode} mono />
                <Field label="Business ID" value={biz.id} mono />
                <Field label="Status" value={biz.status} />
                <Field label="Creation Date" value={new Date(biz.createdAt).toLocaleString('en-IN')} />
              </div>
              <p className="text-xs text-muted-foreground">This defines the tenant identity. Quantix-managed.</p>
            </Card>
          )}

          {/* STEP 2 — Branding */}
          {step === 1 && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Business Logo (URL)</label><Input value={form.logo ?? ''} onChange={(e) => set('logo', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Favicon (URL)</label><Input value={form.favicon ?? ''} onChange={(e) => set('favicon', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Primary Color</label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.primaryColor ?? '#10B981'} onChange={(e) => set('primaryColor', e.target.value)} /><Input value={form.primaryColor ?? ''} onChange={(e) => set('primaryColor', e.target.value)} /></div></div>
                <div><label className="text-xs text-muted-foreground">Secondary Color</label><div className="flex gap-2"><Input type="color" className="w-14 p-1 h-9" value={form.secondaryColor ?? '#000000'} onChange={(e) => set('secondaryColor', e.target.value)} /><Input value={form.secondaryColor ?? ''} onChange={(e) => set('secondaryColor', e.target.value)} /></div></div>
                <div><label className="text-xs text-muted-foreground">Brand Theme / Tagline</label><Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></div>
              </div>
              {/* Preview */}
              <div className="rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: form.primaryColor || undefined }}>
                {form.logo ? <img src={form.logo} alt="logo" className="h-10 w-10 rounded object-contain" /> : <div className="h-10 w-10 rounded" style={{ background: form.primaryColor || '#e5e7eb' }} />}
                <div><p className="text-sm font-semibold" style={{ color: form.primaryColor || undefined }}>{form.name}</p><p className="text-xs text-muted-foreground">{form.tagline || 'Brand preview'}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">Only Quantix can modify branding. The Business Owner cannot.</p>
            </Card>
          )}

          {/* STEP 3 — Contact & Legal */}
          {step === 2 && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Phone</label><Input value={form.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Support Phone</label><Input value={form.supportPhone ?? ''} onChange={(e) => set('supportPhone', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Email</label><Input value={form.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Support Email</label><Input value={form.supportEmail ?? ''} onChange={(e) => set('supportEmail', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Address</label><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">City</label><Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">State</label><Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">Country</label><Input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">GST</label><Input value={form.gstNumber ?? ''} onChange={(e) => set('gstNumber', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">PAN</label><Input value={form.panNumber ?? ''} onChange={(e) => set('panNumber', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">CIN</label><Input value={form.cinNumber ?? ''} onChange={(e) => set('cinNumber', e.target.value)} /></div>
                <div><label className="text-xs text-muted-foreground">FSSAI</label><Input value={form.fssaiLicense ?? ''} onChange={(e) => set('fssaiLicense', e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Only Quantix manages these.</p>
            </Card>
          )}

          {/* STEP 4 — Subscription & Feature Provisioning */}
          {step === 3 && (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Plan" value={biz.subscriptionPlanCode} />
                  <Field label="Subscription" value={biz.subscription?.status || '—'} />
                  <Field label="Workspace / Product" value={biz.productCode} />
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Modules (features purchased by this tenant)</h3>
                {biz.modules.length === 0 ? <p className="text-sm text-muted-foreground">No modules provisioned.</p> : (
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
                <p className="text-xs text-muted-foreground mb-3">Quantix decides which gateways this tenant may use. The Business Owner configures keys for enabled gateways only — this page does NOT configure gateways.</p>
                <div className="flex flex-wrap gap-2">
                  {GATEWAYS.map((g) => {
                    const enabled = biz.modules.some((m) => m.status === 'ENABLED' && m.moduleKey.toUpperCase().includes(g.toUpperCase())) || g === 'COD'
                    return <Badge key={g} variant="outline" className={enabled ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-400'}>{enabled ? '✓' : '✗'} {g}</Badge>
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* STEP 5 — Digital Assets (read-only, Quantix-managed) */}
          {step === 4 && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-indigo-700"><ShieldCheck className="size-4" /> Managed by Quantix — the Business Owner receives generated URLs only (no deployment/SSL/DNS/hosting controls).</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Website URL / Workspace" value={workspaceUrl} mono />
                <Field label="Subdomain" value={`${(biz.productCode || 'commerce').toLowerCase()}.quantixtechnology.in`} mono />
                <Field label="Custom Domain" value={biz.domain?.domain} />
                <Field label="SSL / Domain Status" value={biz.domain?.status} />
                <Field label="In-app Workspace Route" value={getWorkspaceEntryRoute(biz.productCode)} mono />
                {biz.deployments.map((d) => (
                  <Field key={d.id} label={`Deployment · ${d.type}`} value={`${d.status} (health: ${d.healthStatus}${d.version ? `, v${d.version}` : ''})`} />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(workspaceUrl, '_blank')}><ExternalLink className="size-3" /> Open Website</Button>
              </div>
            </Card>
          )}

          {/* STEP 6 — Owner Account */}
          {step === 5 && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Owner Name" value={biz.ownerName} />
                <Field label="Owner Email" value={biz.ownerEmail} />
                <Field label="Owner Phone" value={biz.ownerPhone} />
                <Field label="Login ID" value={biz.ownerLoginId} mono />
                <Field label="Last Login" value={biz.ownerLastLogin ? new Date(biz.ownerLastLogin).toLocaleString('en-IN') : 'Never'} />
                <Field label="Account Status" value={biz.ownerIsActive === false ? 'Suspended' : 'Active'} />
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="gap-1" onClick={resetOwnerPassword}><KeyRound className="size-3" /> Reset Password (forces change)</Button>
              </div>
              <p className="text-xs text-muted-foreground">Only Quantix manages owner credentials. Reset issues a temporary password the owner must change on next login.</p>
            </Card>
          )}

          {/* STEP 7 — Provisioning */}
          {step === 6 && (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Workspace Status" value={biz.status} />
                  <Field label="Website / Domain" value={biz.domain?.status || 'PENDING'} />
                  <Field label="Provisioning" value={provStatus?.status || '—'} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={provisionAgain}><Rocket className="size-3" /> Provision Again</Button>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold text-sm mb-3">Provisioning Logs</h3>
                {provStatus?.steps?.length ? (
                  <div className="space-y-1 text-xs font-mono">
                    {provStatus.steps.map((s, i) => (
                      <div key={i} className={s.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}>
                        {s.status === 'COMPLETED' ? '✓' : s.status === 'FAILED' ? '✗' : '•'} {s.name}: {s.status}{s.error ? ` — ${s.error}` : ''}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No provisioning logs available.</p>}
              </Card>
            </div>
          )}

          {/* STEP 8 — Review */}
          {step === 7 && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-sm">Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business" value={biz.name} />
                <Field label="Owner" value={`${biz.ownerName ?? '—'} (${biz.ownerEmail ?? '—'})`} />
                <Field label="Product / Plan" value={`${biz.productCode ?? '—'} / ${biz.subscriptionPlanCode ?? '—'}`} />
                <Field label="Status" value={biz.status} />
                <Field label="Website" value={workspaceUrl} mono />
                <Field label="Modules enabled" value={biz.modules.filter((m) => m.status === 'ENABLED').length} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="gap-1" onClick={async () => { const ok = await saveEditable(); if (ok) { toast.success('Saved'); goBackToList() } }} disabled={saving}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save &amp; Finish
                </Button>
              </div>
            </Card>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={back} disabled={step === 0} className="gap-1"><ArrowLeft className="size-4" /> Back</Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={next} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {EDITABLE_STEPS.has(step) ? 'Save & Continue' : 'Continue'} <ArrowRight className="size-4" />
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
