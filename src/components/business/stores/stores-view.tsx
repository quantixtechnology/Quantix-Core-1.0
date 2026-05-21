'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Store, Plus, MapPin, Phone, Mail, Clock, CheckCircle2,
  XCircle, Star, AlertCircle, Loader2, KeyRound, Copy, Check, Users,
  MoreVertical, Edit, Trash2, ShieldOff, ShieldCheck, RefreshCw,
  Hash, Package, ShoppingBag,
} from 'lucide-react'
import { useAdminStore } from '@/stores/admin-store'
import { useAuthStore } from '@/stores/auth-store'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { showSuccess, showError } from '@/lib/toast-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreStaff {
  id: string
  role: string
  isActive: boolean
  loginId: string | null
  user: { id: string; name: string; email: string; phone: string | null }
}

interface StoreRecord {
  id: string
  name: string
  slug: string
  storeCode: string | null
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
  freeDeliveryAbove: number | null
  gstNumber: string | null
  latitude: number | null
  longitude: number | null
  _count: { orders: number; inventory: number; staff: number }
  staff: StoreStaff[]
}

interface StoreForm {
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
  freeDeliveryAbove: string
  gstNumber: string
  latitude: string
  longitude: string
}

const EMPTY_FORM: StoreForm = {
  name: '', slug: '', address: '', city: '', state: '', pincode: '',
  phone: '', email: '', deliveryRadius: '', deliveryFee: '',
  minOrderAmount: '', freeDeliveryAbove: '', gstNumber: '',
  latitude: '', longitude: '',
}

function storeToForm(s: StoreRecord): StoreForm {
  return {
    name: s.name,
    slug: s.slug,
    address: s.address ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    pincode: s.pincode ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    deliveryRadius: s.deliveryRadius != null ? String(s.deliveryRadius) : '',
    deliveryFee: s.deliveryFee != null ? String(s.deliveryFee) : '',
    minOrderAmount: s.minOrderAmount != null ? String(s.minOrderAmount) : '',
    freeDeliveryAbove: s.freeDeliveryAbove != null ? String(s.freeDeliveryAbove) : '',
    gstNumber: s.gstNumber ?? '',
    latitude: s.latitude != null ? String(s.latitude) : '',
    longitude: s.longitude != null ? String(s.longitude) : '',
  }
}

// ── Credential display (show-once panel) ───────────────────────────────────────

interface CredPanel {
  title: string
  storeName: string
  rows: { label: string; value: string }[]
  note: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StoresView() {
  const { currentBusinessId } = useAdminStore()
  const { token } = useAuthStore()

  const [stores, setStores] = useState<StoreRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)

  // create / edit dialog
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)
  const [form, setForm] = useState<StoreForm>(EMPTY_FORM)
  const [createLoginCredentials, setCreateLoginCredentials] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // credential reveal panel
  const [credPanel, setCredPanel] = useState<CredPanel | null>(null)
  const [copiedCred, setCopiedCred] = useState<string | null>(null)

  // delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingStore, setDeletingStore] = useState<StoreRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // disable / enable in-progress
  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null)

  // reset-password in-progress
  const [resettingStoreId, setResettingStoreId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStores = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/core/stores?businessId=${currentBusinessId}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to load stores')
      setStores(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { fetchStores() }, [fetchStores])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedCred(text)
    setTimeout(() => setCopiedCred(null), 2000)
  }

  const handleFieldChange = (field: keyof StoreForm, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && dialogMode === 'create' && !prev.slug) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)
      }
      return next
    })
  }

  // ── Open dialogs ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setDialogMode('create')
    setForm(EMPTY_FORM)
    setCreateLoginCredentials(true)
    setSaveError(null)
    setLimitError(null)
    setEditingStore(null)
    setDialogOpen(true)
  }

  const openEdit = (store: StoreRecord) => {
    setDialogMode('edit')
    setEditingStore(store)
    setForm(storeToForm(store))
    setSaveError(null)
    setDialogOpen(true)
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name || !form.slug) return
    setSaving(true)
    setSaveError(null)
    setCredPanel(null)
    try {
      const res = await fetch('/api/core/stores', {
        method: 'POST',
        headers: getAuthHeaders(),
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
          freeDeliveryAbove: form.freeDeliveryAbove ? parseFloat(form.freeDeliveryAbove) : undefined,
          gstNumber: form.gstNumber.trim() || undefined,
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
        const sc = json.data.storeCredentials
        setCredPanel({
          title: 'Store Login Created',
          storeName: form.name,
          rows: [
            { label: 'Login ID', value: sc.loginId || sc.email },
            { label: 'Email', value: sc.email },
            { label: 'Password', value: sc.password },
          ],
          note: 'Share these credentials with the store manager. Password will not be shown again.',
        })
      }
      await fetchStores()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create store')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!editingStore || !form.name) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/core/stores/${editingStore.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          pincode: form.pincode.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          deliveryRadius: form.deliveryRadius ? parseFloat(form.deliveryRadius) : undefined,
          deliveryFee: form.deliveryFee ? parseFloat(form.deliveryFee) : undefined,
          minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
          freeDeliveryAbove: form.freeDeliveryAbove ? parseFloat(form.freeDeliveryAbove) : undefined,
          gstNumber: form.gstNumber.trim() || null,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
        }),
      })
      const json = await res.json()
      if (!json.success) { setSaveError(json.error || 'Failed to update store'); return }
      setDialogOpen(false)
      showSuccess('Store updated successfully')
      await fetchStores()
    } catch {
      setSaveError('Failed to update store')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────────────

  const handleToggleStatus = async (store: StoreRecord) => {
    const newStatus = store.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingStoreId(store.id)
    try {
      const res = await fetch(`/api/core/stores/${store.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || 'Failed to update store'); return }
      showSuccess(`Store ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`)
      await fetchStores()
    } catch {
      showError('Failed to update store')
    } finally {
      setTogglingStoreId(null)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingStore) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/core/stores/${deletingStore.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || 'Failed to delete store'); return }
      setDeleteDialogOpen(false)
      setDeletingStore(null)
      showSuccess('Store deleted')
      await fetchStores()
    } catch {
      showError('Failed to delete store')
    } finally {
      setDeleting(false)
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  const handleResetPassword = async (store: StoreRecord) => {
    setResettingStoreId(store.id)
    setCredPanel(null)
    try {
      const res = await fetch(`/api/core/stores/${store.id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || 'Failed to reset password'); return }
      const users: { name: string; email: string; role: string; newPassword: string }[] = json.data?.users ?? []
      setCredPanel({
        title: 'Password Reset',
        storeName: store.name,
        rows: users.flatMap(u => [
          { label: `${u.role} — ${u.name}`, value: u.email },
          { label: 'New Password', value: u.newPassword },
        ]),
        note: 'New password shown once. Share immediately with the store manager.',
      })
    } catch {
      showError('Failed to reset password')
    } finally {
      setResettingStoreId(null)
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const activeCount = stores.filter(s => s.status === 'ACTIVE').length
  const mainStore = stores.find(s => s.isMainStore)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stores</h2>
        <Button size="sm" className="text-xs h-7" onClick={openCreate}>
          <Plus className="size-3 mr-1" />Add Store
        </Button>
      </div>

      {/* Limit warning */}
      {limitError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Store limit reached</p>
            <p className="text-xs mt-0.5">{limitError}</p>
          </div>
        </div>
      )}

      {/* Credential panel (show-once) */}
      {credPanel && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-blue-700" />
              <p className="text-sm font-semibold text-blue-800">{credPanel.title} — {credPanel.storeName}</p>
            </div>
            <button
              type="button"
              onClick={() => setCredPanel(null)}
              className="text-[10px] text-blue-600 hover:text-blue-800"
            >Dismiss</button>
          </div>
          <div className="space-y-2">
            {credPanel.rows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-white/70 border border-blue-200 px-3 py-1.5">
                <div>
                  <p className="text-[10px] text-blue-600 font-medium">{label}</p>
                  <p className="font-mono text-xs font-semibold text-blue-900">{value}</p>
                </div>
                <button type="button" onClick={() => copyText(value)} className="text-blue-500 hover:text-blue-700 shrink-0">
                  {copiedCred === value
                    ? <Check className="size-3.5 text-emerald-600" />
                    : <Copy className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-blue-700">{credPanel.note}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-violet-600 bg-violet-50"><Users className="size-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Staff</p>
              <p className="text-xl font-bold">{stores.reduce((s, st) => s + st._count.staff, 0)}</p>
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
          <AlertCircle className="size-4 shrink-0" />{error}
        </div>
      ) : stores.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 border-dashed">
          <Store className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stores yet. Add your first store.</p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="size-3 mr-1" />Add Store
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className={`relative ${store.status !== 'ACTIVE' ? 'opacity-70' : ''}`}>
              <CardHeader className="pb-2">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted shrink-0">
                      <Store className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold leading-tight">{store.name}</CardTitle>
                        {store.isMainStore && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">Main</Badge>
                        )}
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
                      <p className="text-[10px] font-mono mt-0.5 flex items-center gap-1">
                        <Hash className="size-2.5 shrink-0 text-muted-foreground" />
                        {store.storeCode
                          ? <span className="text-emerald-700 font-semibold">{store.storeCode}</span>
                          : <span className="text-amber-600 italic">no code — deploy to repair</span>
                        }
                      </p>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 shrink-0">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openEdit(store)} className="gap-2 cursor-pointer">
                        <Edit className="size-3.5" />Edit Store
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleResetPassword(store)}
                        className="gap-2 cursor-pointer"
                        disabled={resettingStoreId === store.id}
                      >
                        {resettingStoreId === store.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <RefreshCw className="size-3.5" />}
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(store)}
                        className="gap-2 cursor-pointer"
                        disabled={togglingStoreId === store.id}
                      >
                        {togglingStoreId === store.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : store.status === 'ACTIVE'
                            ? <ShieldOff className="size-3.5 text-amber-500" />
                            : <ShieldCheck className="size-3.5 text-emerald-500" />}
                        {store.status === 'ACTIVE' ? 'Disable Store' : 'Enable Store'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => { setDeletingStore(store); setDeleteDialogOpen(true) }}
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5" />Delete Store
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Address / contact */}
                <div className="space-y-1.5">
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
                      <Phone className="size-3 shrink-0" /><span>{store.phone}</span>
                    </div>
                  )}
                  {store.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="size-3 shrink-0" /><span className="truncate">{store.email}</span>
                    </div>
                  )}
                  {(store.deliveryRadius != null || store.deliveryFee != null || store.minOrderAmount != null) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Clock className="size-3 shrink-0" />
                      {store.deliveryRadius != null && <span>{store.deliveryRadius} km</span>}
                      {store.deliveryFee != null && <span>· ₹{store.deliveryFee} fee</span>}
                      {store.minOrderAmount != null && store.minOrderAmount > 0 && <span>· Min ₹{store.minOrderAmount}</span>}
                      {store.freeDeliveryAbove != null && store.freeDeliveryAbove > 0 && <span>· Free &gt;₹{store.freeDeliveryAbove}</span>}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ShoppingBag className="size-3" />
                    <span>{store._count.orders} orders</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="size-3" />
                    <span>{store._count.inventory} SKUs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="size-3" />
                    <span>{store._count.staff} staff</span>
                  </div>
                </div>

                {/* Staff list */}
                {store.staff.length > 0 && (
                  <div className="space-y-1.5">
                    {store.staff.map((su) => (
                      <div key={su.id} className="flex items-center justify-between rounded-md bg-muted/40 border px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{su.user.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{su.user.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {su.loginId && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                              {su.loginId}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {su.role.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Add Store' : `Edit — ${editingStore?.name}`}</DialogTitle>
            {dialogMode === 'edit' && (
              <p className="text-xs font-mono">
                {editingStore?.storeCode
                  ? <span className="text-emerald-700 font-semibold">{editingStore.storeCode}</span>
                  : <span className="text-amber-600 italic">no code — will be assigned on next deploy</span>
                }
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Store Name *</Label>
                <Input className="h-8 text-sm" placeholder="e.g. Main Branch"
                  value={form.name} onChange={e => handleFieldChange('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug *</Label>
                <Input className="h-8 text-sm" placeholder="e.g. main-branch"
                  value={form.slug} onChange={e => handleFieldChange('slug', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input className="h-8 text-sm" placeholder="Street address"
                value={form.address} onChange={e => handleFieldChange('address', e.target.value)} />
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
                <Input className="h-8 text-sm" type="tel"
                  value={form.phone} onChange={e => handleFieldChange('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Support Email</Label>
                <Input className="h-8 text-sm" type="email"
                  value={form.email} onChange={e => handleFieldChange('email', e.target.value)} />
              </div>
            </div>

            <Separator />

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Settings</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Radius (km)</Label>
                <Input className="h-8 text-sm" type="number" min="0" step="0.5"
                  value={form.deliveryRadius} onChange={e => handleFieldChange('deliveryRadius', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Fee (₹)</Label>
                <Input className="h-8 text-sm" type="number" min="0"
                  value={form.deliveryFee} onChange={e => handleFieldChange('deliveryFee', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Order (₹)</Label>
                <Input className="h-8 text-sm" type="number" min="0"
                  value={form.minOrderAmount} onChange={e => handleFieldChange('minOrderAmount', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Free Delivery Above (₹)</Label>
              <Input className="h-8 text-sm" type="number" min="0" placeholder="Leave blank to disable"
                value={form.freeDeliveryAbove} onChange={e => handleFieldChange('freeDeliveryAbove', e.target.value)} />
            </div>

            <Separator />

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location & Tax</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="19.0760"
                  value={form.latitude} onChange={e => handleFieldChange('latitude', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="72.8777"
                  value={form.longitude} onChange={e => handleFieldChange('longitude', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GST Number</Label>
              <Input className="h-8 text-sm" placeholder="27AAAAA0000A1Z5"
                value={form.gstNumber} onChange={e => handleFieldChange('gstNumber', e.target.value)} />
            </div>

            {/* Create login toggle (create mode only) */}
            {dialogMode === 'create' && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <KeyRound className="size-3 text-muted-foreground" />Create Login Credentials
                  </p>
                  <p className="text-[11px] text-muted-foreground">Auto-generate a STORE_MANAGER login for this store</p>
                </div>
                <Switch checked={createLoginCredentials} onCheckedChange={setCreateLoginCredentials} />
              </div>
            )}

            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="size-3 shrink-0" />{saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={dialogMode === 'create' ? handleCreate : handleEdit}
              disabled={saving || !form.name || !form.slug}>
              {saving && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              {dialogMode === 'create' ? 'Create Store' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingStore?.name}</strong>?
              This will permanently remove the store, its staff assignments, inventory, and settings.
              Orders and customers are retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              Delete Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
