"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Check, Loader2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const STEPS = ["Business Details", "Plan", "Business Code", "Credentials"]

const STANDARD_FEATURES = ["Pickup & Delivery", "Pre-Service Payment", "Post-Service Payment"]

const PRO_FEATURES = [
  "Everything in Standard",
  "Advanced Order Management",
  "Multi-Store Support",
  "Priority Support",
  "Future Advanced Modules",
]

export function LaundryBusinessCreate({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [generatedCode, setGeneratedCode] = useState("")
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{
    owner: { email: string; password: string; name: string; role: string }
    storeManager: { email: string; password: string; name: string; role: string }
    processingManager: { email: string; password: string; name: string; role: string }
  } | null>(null)

  const [form, setForm] = useState({
    businessName: "",
    legalName: "",
    ownerName: "",
    mobile: "",
    email: "",
    gstNumber: "",
    address: "",
    plan: "STANDARD",
    status: "ONBOARDING",
  })

  useEffect(() => {
    if (step === 2 && !generatedCode) {
      fetch("/api/laundry/next-business-code")
        .then(r => r.json())
        .then(d => { if (d.code) setGeneratedCode(d.code) })
        .catch(() => {})
    }
  }, [step, generatedCode])

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const canProceed = () => {
    if (step === 0) return form.businessName.trim() && form.ownerName.trim() && form.mobile.trim()
    if (step === 1) return true
    return true
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setBusinessId(data.id)
        setGeneratedCode(data.businessCode)
        if (data.credentials) {
          setCredentials(data.credentials)
          setStep(3)
        }
      }
    } catch (err) {
      console.error("Failed to create business:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create Laundry Business</h1>
          <p className="text-sm text-gray-500">Step {step + 1} of 3 — {STEPS[step]}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-sky-500" : "bg-gray-200"}`} />
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Business Name *</Label>
                <Input value={form.businessName} onChange={e => updateField("businessName", e.target.value)} placeholder="My Laundry Service" />
              </div>
              <div>
                <Label>Legal Name</Label>
                <Input value={form.legalName} onChange={e => updateField("legalName", e.target.value)} placeholder="My Laundry Pvt Ltd" />
              </div>
              <div>
                <Label>Owner Name *</Label>
                <Input value={form.ownerName} onChange={e => updateField("ownerName", e.target.value)} placeholder="John Doe" />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input value={form.mobile} onChange={e => updateField("mobile", e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => updateField("email", e.target.value)} placeholder="john@example.com" />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={form.gstNumber} onChange={e => updateField("gstNumber", e.target.value)} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={e => updateField("address", e.target.value)} placeholder="Business address" />
              </div>
              <div>
                <Label>Status</Label>
                <select className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={form.status} onChange={e => updateField("status", e.target.value)}>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <RadioGroup value={form.plan} onValueChange={v => updateField("plan", v)}>
              <div className={`rounded-lg border p-4 cursor-pointer ${form.plan === "STANDARD" ? "border-sky-500 bg-sky-50" : "border-gray-200"}`} onClick={() => updateField("plan", "STANDARD")}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="STANDARD" id="standard" />
                  <div>
                    <Label htmlFor="standard" className="font-semibold text-base cursor-pointer">STANDARD</Label>
                    <p className="text-sm text-gray-500">Essential laundry operations</p>
                  </div>
                </div>
                <div className="mt-3 ml-7 space-y-1">
                  {STANDARD_FEATURES.map(f => <div key={f} className="flex items-center gap-2 text-sm text-gray-600"><Check className="h-3.5 w-3.5 text-green-500" />{f}</div>)}
                </div>
              </div>

              <div className={`rounded-lg border p-4 cursor-pointer ${form.plan === "PRO" ? "border-purple-500 bg-purple-50" : "border-gray-200"}`} onClick={() => updateField("plan", "PRO")}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="PRO" id="pro" />
                  <div>
                    <Label htmlFor="pro" className="font-semibold text-base cursor-pointer">PRO</Label>
                    <Badge className="ml-2 bg-purple-100 text-purple-700 border-purple-200">Advanced</Badge>
                    <p className="text-sm text-gray-500">Full-featured laundry platform</p>
                  </div>
                </div>
                <div className="mt-3 ml-7 space-y-1">
                  {PRO_FEATURES.map(f => <div key={f} className="flex items-center gap-2 text-sm text-gray-600"><Check className="h-3.5 w-3.5 text-green-500" />{f}</div>)}
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {step === 2 && !credentials && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>Auto-Generated Business Code</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input value={generatedCode} readOnly className="font-mono text-lg bg-gray-50" />
                {generatedCode && <Badge className="bg-green-100 text-green-700">Unique</Badge>}
              </div>
              <p className="text-xs text-gray-400 mt-1">Format: BUS-YYYYMM-NNNN — the platform Business Code, shared by every product. This is the canonical business identity and is used for all future references.</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">Summary</p>
              <ul className="mt-1 space-y-0.5 text-amber-700">
                <li>Business: {form.businessName}</li>
                <li>Owner: {form.ownerName}</li>
                <li>Plan: {form.plan}</li>
                <li>Status: {form.status}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && credentials && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-800 mb-2">
              <Check className="h-5 w-5" />
              <span className="font-semibold">Business created successfully!</span>
              <span className="font-mono text-sm">{generatedCode}</span>
            </div>

            <div className="rounded-lg border border-green-200 bg-white p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">O</span>
                  Laundry Owner Login
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-mono text-gray-900">{credentials.owner.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Password</span>
                    <span className="font-mono text-gray-900">{credentials.owner.password}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Role</span>
                    <span className="text-gray-900">Laundry Owner</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold">S</span>
                  Store Manager Login
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-mono text-gray-900">{credentials.storeManager.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Password</span>
                    <span className="font-mono text-gray-900">{credentials.storeManager.password}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Role</span>
                    <span className="text-gray-900">Store Manager</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">P</span>
                  Processing Manager Login
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-mono text-gray-900">{credentials.processingManager.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Password</span>
                    <span className="font-mono text-gray-900">{credentials.processingManager.password}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-500">Role</span>
                    <span className="text-gray-900">Processing Manager</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
              <strong>Important:</strong> Save these credentials. They will not be shown again.
              Share them with the business owner and store manager so they can log in directly at /laundry/login
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? "Cancel" : <> <ChevronLeft className="mr-1 h-4 w-4" /> Back</>}
        </Button>
        {step === 3 ? (
          <Button onClick={onComplete}>
            <Check className="mr-2 h-4 w-4" /> Done
          </Button>
        ) : step < 2 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {saving ? "Creating..." : "Create Business"}
          </Button>
        )}
      </div>
    </div>
  )
}
