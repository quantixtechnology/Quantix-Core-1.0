'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Store, Plus, MapPin, Phone, Mail, Clock, CheckCircle2,
  XCircle, Star, AlertCircle, Loader2, KeyRound, Copy, Check, Users,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useAdminStore } from '@/stores/admin-store'
import { useAuthStore } from '@/stores/auth-store'

interface StoreRecord {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  status: string
  isMainStore: boolean
  deliveryRadius: number | null
  deliveryFee: number | null
  minOrderAmount: number | null
  latitude: number | null
  longitude: number | null
}

interface CreateForm {
  name: string
  slug: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  deliveryRadius: string
  deliveryFee: string
  minOrderAmount: string
  latitude: string
  longitude: string
}

const EMPTY_FORM: CreateForm = {
  name: '', slug: '', address: '', city: '', state: '', pincode: '',
  phone: '', email: '', deliveryRadius: '', deliveryFee: '',
  minOrderAmount: '', latitude: '', longitude: '',
}

export function StoresView() {
  const { currentBusinessId } = useAdminStore()
  const { token } = useAuthStore()

  const [stores, setStores] = useState<StoreRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [createLoginCredentials, setCreateLoginCredentials] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storeCredentials, setStoreCredentials] = useState<{ email: string; password: string; userId: string } | null>(null)
  const [copiedCred, setCopiedCred] = useState<string | null>(null)

  const fetchStores = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/core/stores?businessId=${currentBusinessId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to load stores')
      setStores(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId, token])

  useEffect(() => { fetchStores() }, [fetchStores])

  const handleFieldChange = (field: keyof CreateForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && !prev.slug) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!form.name || !form.slug) return
    setSaving(true)
    setSaveError(null)
    setStoreCredentials(null)
    try {
      const res = await fetch('/api/core/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessId: currentBusinessId,
          name: form.name.trim(),
          slug: form.slug.trim(),
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          deliveryRadius: form.deliveryRadius ? parseFloat(form.deliveryRadius) : undefined,
          deliveryFee: form.deliveryFee ? parseFloat(form.deliveryFee) : undefined,
          minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          createLoginCredentials,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        if (json.error?.toLowerCase().includes('limit')) {
          setLimitError(json.error)
          setDialogOpen(false)
        } else {
          setSaveError(json.error || 'Failed to create store')
        }
        return
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      if (json.data?.storeCredentials) {
        setStoreCredentials(json.data.storeCredentials)
      }
      await fetchStores()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create store')
    } finally {
      setSaving(false)
    }
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCred(text)
    setTimeout(() => setCopiedCred(null), 2000)
  }

  const activeCount = stores.filter(s => s.status === 'ACTIVE').length
  const mainStore = stores.find(s => s.isMainStore)

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stores</h2>
        <Button
          size="sm"
          className="text-xs h-7"
          onClick={() => { setLimitError(null); setSaveError(null); setForm(EMPTY_FORM); setCreateLoginCredentials(true); setDialogOpen(true) }}
        >
          <Plus className="size-3 mr-1" />Add Store
        </Button>
      </div>

      {limitError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Store limit reached</p>
            <p className="text-xs mt-0.5">{limitError}</p>
          </div>
        </div>
      )}

      {/* Store Login Credentials reveal panel */}
      {storeCredentials && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-blue-700" />
              <p className="text-sm font-semibold text-blue-800">Store Login Created</p>
            </div>
            <button
              type="button"
              onClick={() => setStoreCredentials(null)}
              className="text-[10px] text-blue-600 hover:text-blue-800"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            {[
              { label: 'User ID', value: storeCredentials.userId },
              { label: 'Email', value: storeCredentials.email },
              { label: 'Password', value: storeCredentials.password },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-white/70 border border-blue-200 px-3 py-1.5">
                <div>
                  <p className="text-[10px] text-blue-600 font-medium">{label}</p>
                  <p className="font-mono text-xs font-semibold text-blue-900">{value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(value)}
                  className="text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                >
                  {copiedCred === value ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-blue-700">Share these credentials with the store manager. Password will not be shown again.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-emerald-600 bg-emerald-50"><Store className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Stores</p>
              <p className="text-xl font-bold">{stores.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-blue-600 bg-blue-50"><CheckCircle2 className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-amber-600 bg-amber-50"><Star className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Main Store</p>
              <p className="text-sm font-semibold truncate">{mainStore?.name || '—'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Store list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      ) : stores.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 border-dashed">
          <Store className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stores yet. Add your first store.</p>
          <Button size="sm" variant="outline" onClick={() => { setCreateLoginCredentials(true); setDialogOpen(true) }}>
            <Plus className="size-3 mr-1" />Add Store
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="relative">
              {store.isMainStore && (
                <span className="absolute top-3 right-3">
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">
                    Main
                  </Badge>
                </span>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3 pr-14">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <Store className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold leading-tight">{store.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{store.slug}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(store.address || store.city) && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {[store.address, store.city, store.state, store.pincode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3 shrink-0" />
                    <span>{store.phone}</span>
                  </div>
                )}
                {store.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{store.email}</span>
                  </div>
                )}
                {store.deliveryRadius != null && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    <span>
                      {store.deliveryRadius} km radius
                      {store.deliveryFee != null ? ` · ₹${store.deliveryFee} delivery fee` : ''}
                      {store.minOrderAmount != null ? ` · Min ₹${store.minOrderAmount}` : ''}
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  {store.status === 'ACTIVE' ? (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="size-2.5 mr-1" />Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                      <XCircle className="size-2.5 mr-1" />{store.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create store dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Store</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Store Name *</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="e.g. Main Branch"
                  value={form.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug *</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="e.g. main-branch"
                  value={form.slug}
                  onChange={e => handleFieldChange('slug', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Street address"
                value={form.address}
                onChange={e => handleFieldChange('address', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input className="h-8 text-sm" value={form.city} onChange={e => handleFieldChange('city', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input className="h-8 text-sm" value={form.state} onChange={e => handleFieldChange('state', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pincode</Label>
                <Input className="h-8 text-sm" value={form.pincode} onChange={e => handleFieldChange('pincode', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input className="h-8 text-sm" type="tel" value={form.phone} onChange={e => handleFieldChange('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input className="h-8 text-sm" type="email" value={form.email} onChange={e => handleFieldChange('email', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Delivery Radius (km)</Label>
                <Input className="h-8 text-sm" type="number" min="0" step="0.5" value={form.deliveryRadius} onChange={e => handleFieldChange('deliveryRadius', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Fee (₹)</Label>
                <Input className="h-8 text-sm" type="number" min="0" value={form.deliveryFee} onChange={e => handleFieldChange('deliveryFee', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Order (₹)</Label>
                <Input className="h-8 text-sm" type="number" min="0" value={form.minOrderAmount} onChange={e => handleFieldChange('minOrderAmount', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="e.g. 19.0760" value={form.latitude} onChange={e => handleFieldChange('latitude', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="e.g. 72.8777" value={form.longitude} onChange={e => handleFieldChange('longitude', e.target.value)} />
              </div>
            </div>

            {/* Create Login Credentials toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <KeyRound className="size-3 text-muted-foreground" />
                  Create Login Credentials
                </p>
                <p className="text-[11px] text-muted-foreground">Auto-generate a STORE_MANAGER login for this store</p>
              </div>
              <Switch checked={createLoginCredentials} onCheckedChange={setCreateLoginCredentials} />
            </div>

            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="size-3 shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !form.name || !form.slug}>
              {saving && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              Create Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
