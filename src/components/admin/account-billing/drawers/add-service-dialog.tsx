"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Layers, PlusCircle, FileText, RefreshCw } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Plan { id: string; name: string; tier: string }

type ServiceType = 'PLATFORM_SUBSCRIPTION' | 'ADDON' | 'ONE_TIME'

const CYCLES = [
  { value: 'MONTHLY',     label: 'Monthly'     },
  { value: 'QUARTERLY',   label: 'Quarterly'   },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'YEARLY',      label: 'Yearly'      },
]

function nextDueFromStart(start: string, cycle: string): string {
  if (!start) return ''
  const d = new Date(start)
  const months = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }[cycle] ?? 1
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

interface Props {
  open:         boolean
  onOpenChange: (open: boolean) => void
  businessId:   string
  onSuccess:    () => void
}

export function AddServiceDialog({ open, onOpenChange, businessId, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [plans,    setPlans]    = useState<Plan[]>([])
  const [saving,   setSaving]   = useState(false)

  // Form
  const [serviceType, setServiceType] = useState<ServiceType>('PLATFORM_SUBSCRIPTION')
  const [name,        setName]        = useState('')
  const [amount,      setAmount]      = useState('')
  const [billingCycle, setBillingCycle] = useState('MONTHLY')
  const [startDate,   setStartDate]   = useState(() => new Date().toISOString().slice(0, 10))
  const [nextDueDate, setNextDueDate] = useState('')
  const [planId,      setPlanId]      = useState('')
  const [description, setDescription] = useState('')

  // Auto-fill name when plan selected
  useEffect(() => {
    if (serviceType === 'PLATFORM_SUBSCRIPTION' && planId) {
      const p = plans.find(pl => pl.id === planId)
      if (p) setName(p.name + ' Subscription')
    }
  }, [planId, serviceType, plans])

  // Auto-calculate next due date
  useEffect(() => {
    if (serviceType !== 'ONE_TIME' && billingCycle && startDate) {
      setNextDueDate(nextDueFromStart(startDate, billingCycle))
    }
  }, [startDate, billingCycle, serviceType])

  // Fetch plans when dialog opens
  useEffect(() => {
    if (!open) return
    fetch('/api/core/platform/plans', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { if (j.success) setPlans(j.data) })
      .catch(() => {/* non-critical */})
  }, [open])

  const reset = () => {
    setServiceType('PLATFORM_SUBSCRIPTION'); setName(''); setAmount(''); setBillingCycle('MONTHLY')
    setStartDate(new Date().toISOString().slice(0, 10)); setNextDueDate(''); setPlanId(''); setDescription('')
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Service name is required'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (serviceType === 'PLATFORM_SUBSCRIPTION' && !planId) { toast.error('Select a plan'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/account-billing/${businessId}/services`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          name: name.trim(),
          amount: amt,
          billingCycle: serviceType === 'ONE_TIME' ? undefined : billingCycle,
          startDate:    startDate   || undefined,
          nextDueDate:  nextDueDate || undefined,
          planId:       serviceType === 'PLATFORM_SUBSCRIPTION' ? planId : undefined,
          description:  description.trim() || undefined,
          createdById:   user?.id   ?? undefined,
          createdByName: user?.name ?? undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error ?? 'Failed to create service'); return }
      toast.success(json.message ?? 'Service created')
      reset()
      onSuccess()
    } catch { toast.error('Failed to create service') }
    finally { setSaving(false) }
  }

  const typeLabel: Record<ServiceType, string> = {
    PLATFORM_SUBSCRIPTION: 'Platform Subscription',
    ADDON:                 'Add-On',
    ONE_TIME:              'One-Time Service',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-violet-600" /> Add Service
          </DialogTitle>
          <DialogDescription className="text-xs">
            Subscription, Add-On, and One-Time charges are all managed from Account &amp; Billing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Service Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {((['PLATFORM_SUBSCRIPTION', 'ADDON', 'ONE_TIME'] as ServiceType[])).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setServiceType(t); setName(''); setAmount('') }}
                className={`rounded-lg border p-2.5 text-center transition-colors ${serviceType === t ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-muted hover:bg-muted/50'}`}
              >
                {t === 'PLATFORM_SUBSCRIPTION' && <Layers className="h-4 w-4 mx-auto mb-1 text-violet-600" />}
                {t === 'ADDON'                 && <PlusCircle className="h-4 w-4 mx-auto mb-1 text-sky-600" />}
                {t === 'ONE_TIME'              && <FileText className="h-4 w-4 mx-auto mb-1 text-amber-600" />}
                <p className="text-[10px] font-medium leading-tight">{typeLabel[t]}</p>
              </button>
            ))}
          </div>

          {/* Plan selector — only for Platform Subscription */}
          {serviceType === 'PLATFORM_SUBSCRIPTION' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Plan *</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <Badge variant="secondary" className="ml-2 text-[9px] h-4">{p.tier}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Service Name *</Label>
            <Input
              value={name} onChange={e => setName(e.target.value)}
              placeholder={serviceType === 'PLATFORM_SUBSCRIPTION' ? 'e.g. Pro Plan Subscription' : serviceType === 'ADDON' ? 'e.g. SMS Credits' : 'e.g. Setup & Onboarding'}
              className="h-9 text-xs"
            />
          </div>

          {/* Amount + Billing Cycle */}
          <div className={`grid gap-3 ${serviceType === 'ONE_TIME' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-9 text-xs" />
            </div>
            {serviceType !== 'ONE_TIME' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CYCLES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Start Date + Next Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {serviceType === 'ONE_TIME' ? 'Due Date' : 'Next Due Date'}
                {serviceType !== 'ONE_TIME' && <span className="text-muted-foreground ml-1">(auto)</span>}
              </Label>
              <Input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes…" className="text-xs resize-none" rows={2} />
          </div>

          {serviceType === 'ONE_TIME' && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-800">
              <span className="font-semibold">Proforma auto-generated.</span> A Draft Proforma will be created immediately — go to Charges or Documents tab to send it.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="text-xs" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>Cancel</Button>
          <Button className="text-xs gap-1.5" onClick={handleSubmit} disabled={saving || !name.trim() || !amount}>
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Saving…' : `Add ${typeLabel[serviceType]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
