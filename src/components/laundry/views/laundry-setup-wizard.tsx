"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Check, Building2, Store, Wrench, IndianRupee, Factory, Rocket } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

const DEFAULT_SERVICES = [
  { id: "wash-fold", label: "Wash + Dry + Fold" },
  { id: "wash-iron", label: "Wash + Dry + Iron" },
  { id: "dry-clean", label: "Dry Clean" },
  { id: "steam-iron", label: "Steam Iron" },
  { id: "shoe-clean", label: "Shoe Cleaning" },
  { id: "carpet-clean", label: "Carpet Cleaning" },
]

const STEPS = [
  { num: 1 as const, label: "Business", icon: Building2 },
  { num: 2 as const, label: "Store", icon: Store },
  { num: 3 as const, label: "Services", icon: Wrench },
  { num: 4 as const, label: "Pricing", icon: IndianRupee },
  { num: 5 as const, label: "Processing", icon: Factory },
  { num: 6 as const, label: "Activate", icon: Rocket },
]

interface SetupWizardProps {
  laundryBusinessId: string
  onComplete?: () => void
}

export default function LaundrySetupWizard({ laundryBusinessId, onComplete }: SetupWizardProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCustomServices, setShowCustomServices] = useState(false)

  const [businessInfo, setBusinessInfo] = useState({
    laundryName: "",
    gstNumber: "",
    contactNumber: "",
    email: "",
    businessAddress: "",
  })

  const [storeSetup, setStoreSetup] = useState({
    storeName: "",
    storeCode: "",
    storeAddress: "",
  })

  const [selectedServices, setSelectedServices] = useState<string[]>(["wash-fold", "wash-iron"])
  const [customServices, setCustomServices] = useState<string[]>([])

  const [pricing, setPricing] = useState<Record<string, string>>({})

  const [processingCenter, setProcessingCenter] = useState({
    centerName: "",
    centerAddress: "",
    dailyCapacity: "",
  })

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const addCustomService = () => {
    setCustomServices(prev => [...prev, ""])
  }

  const updateCustomService = (index: number, value: string) => {
    setCustomServices(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const removeCustomService = (index: number) => {
    setCustomServices(prev => prev.filter((_, i) => i !== index))
  }

  const getSelectedServiceLabels = () => {
    const labels: string[] = []
    selectedServices.forEach(id => {
      const found = DEFAULT_SERVICES.find(s => s.id === id)
      if (found) labels.push(found.label)
    })
    return labels
  }

  const updatePricing = (serviceLabel: string, value: string) => {
    setPricing(prev => ({ ...prev, [serviceLabel]: value }))
  }

  const updateBusinessInfo = (field: string, value: string) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }))
  }

  const updateStoreSetup = (field: string, value: string) => {
    setStoreSetup(prev => ({ ...prev, [field]: value }))
  }

  const updateProcessingCenter = (field: string, value: string) => {
    setProcessingCenter(prev => ({ ...prev, [field]: value }))
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return businessInfo.laundryName.trim().length > 0 &&
               businessInfo.contactNumber.trim().length > 0
      case 2:
        return storeSetup.storeName.trim().length > 0
      case 3:
        return selectedServices.length > 0
      case 4: {
        const labels = [...getSelectedServiceLabels(), ...customServices.filter(Boolean)]
        return labels.every(l => pricing[l] && parseFloat(pricing[l]) > 0)
      }
      case 5:
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (step < 6) setStep((step + 1) as 1 | 2 | 3 | 4 | 5 | 6)
  }

  const prevStep = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5 | 6)
  }

  const handleActivate = async () => {
    setLoading(true)
    setError(null)

    const serviceLabels = [...getSelectedServiceLabels(), ...customServices.filter(Boolean)]

    const payload = {
      businessInfo,
      storeSetup,
      services: serviceLabels,
      pricing,
      processingCenter,
    }

    try {
      const res = await fetch(`/api/laundry/businesses/${laundryBusinessId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Setup failed")
        toast({ title: "Error", description: data.error || "Setup failed", variant: "destructive" })
        return
      }

      toast({ title: "Success", description: "Workspace activated successfully" })
      onComplete?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Setup failed"
      setError(msg)
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              step === s.num
                ? "bg-primary text-primary-foreground"
                : step > s.num
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step > s.num ? <Check className="h-4 w-4" /> : s.num}
          </div>
          <span className={`text-xs hidden sm:inline ${step === s.num ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 ${step > s.num ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  )

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business Name *</Label>
              <Input
                placeholder="My Laundry Services"
                value={businessInfo.laundryName}
                onChange={e => updateBusinessInfo("laundryName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>GST Number</Label>
              <Input
                placeholder="22AAAAA0000A1Z5"
                value={businessInfo.gstNumber}
                onChange={e => updateBusinessInfo("gstNumber", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contact Number *</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={businessInfo.contactNumber}
                  onChange={e => updateBusinessInfo("contactNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  placeholder="contact@laundry.com"
                  type="email"
                  value={businessInfo.email}
                  onChange={e => updateBusinessInfo("email", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Business Address</Label>
              <Textarea
                placeholder="Enter your business address"
                value={businessInfo.businessAddress}
                onChange={e => updateBusinessInfo("businessAddress", e.target.value)}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Store Name *</Label>
              <Input
                placeholder="Main Store"
                value={storeSetup.storeName}
                onChange={e => updateStoreSetup("storeName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Store Code</Label>
              <Input
                value={storeSetup.storeCode || "Auto-generated"}
                disabled
                className="text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Store code is auto-generated after activation</p>
            </div>
            <div className="space-y-1.5">
              <Label>Store Address</Label>
              <Textarea
                placeholder="Enter store address"
                value={storeSetup.storeAddress}
                onChange={e => updateStoreSetup("storeAddress", e.target.value)}
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the services you offer</p>
            <div className="grid gap-3">
              {DEFAULT_SERVICES.map(service => (
                <label key={service.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <span className="text-sm font-medium">{service.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                checked={showCustomServices}
                onCheckedChange={(checked) => setShowCustomServices(checked === true)}
                id="custom-services"
              />
              <Label htmlFor="custom-services" className="text-sm cursor-pointer">Allow custom services</Label>
            </div>
            {showCustomServices && (
              <div className="space-y-2 pl-6">
                {customServices.map((cs, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Custom service name"
                      value={cs}
                      onChange={e => updateCustomService(i, e.target.value)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeCustomService(i)} className="text-destructive">
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCustomService}>
                  + Add Service
                </Button>
              </div>
            )}
          </div>
        )

      case 4: {
        const serviceLabels = [...getSelectedServiceLabels(), ...customServices.filter(Boolean)]
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Set pricing for each selected service</p>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Service</th>
                    <th className="text-right p-3 font-medium">Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceLabels.map(label => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="p-3">{label}</td>
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={pricing[label] || ""}
                          onChange={e => updatePricing(label, e.target.value)}
                          className="w-28 ml-auto text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Processing Center Name</Label>
              <Input
                placeholder="Main Processing Center"
                value={processingCenter.centerName}
                onChange={e => updateProcessingCenter("centerName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Center Address</Label>
              <Textarea
                placeholder="Enter processing center address"
                value={processingCenter.centerAddress}
                onChange={e => updateProcessingCenter("centerAddress", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Daily Capacity (kg)</Label>
              <Input
                type="number"
                min="0"
                placeholder="100"
                value={processingCenter.dailyCapacity}
                onChange={e => updateProcessingCenter("dailyCapacity", e.target.value)}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-medium">Setup Summary</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Business:</span>
                <span className="font-medium">{businessInfo.laundryName}</span>
                <span className="text-muted-foreground">GST:</span>
                <span>{businessInfo.gstNumber || "—"}</span>
                <span className="text-muted-foreground">Contact:</span>
                <span>{businessInfo.contactNumber}</span>
                <span className="text-muted-foreground">Store:</span>
                <span>{storeSetup.storeName}</span>
                <span className="text-muted-foreground">Services:</span>
                <span>{getSelectedServiceLabels().length + customServices.filter(Boolean).length} selected</span>
                <span className="text-muted-foreground">Processing Center:</span>
                <span>{processingCenter.centerName || "—"}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleActivate}
              disabled={loading}
            >
              {loading ? (
                <>Activating...</>
              ) : (
                <><Rocket className="h-4 w-4" /> Activate Workspace</>
              )}
            </Button>
          </div>
        )
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">
          {step === 1 && "Business Information"}
          {step === 2 && "Store Setup"}
          {step === 3 && "Service Setup"}
          {step === 4 && "Pricing Setup"}
          {step === 5 && "Processing Center Setup"}
          {step === 6 && "Complete Setup"}
        </CardTitle>
        <CardDescription>
          {step === 1 && "Tell us about your laundry business"}
          {step === 2 && "Create your first store location"}
          {step === 3 && "Select the services you offer"}
          {step === 4 && "Configure your service pricing"}
          {step === 5 && "Set up your processing facility"}
          {step === 6 && "Review and activate your workspace"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderStepIndicator()}
        {renderStep()}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < 6 ? (
            <Button onClick={nextStep} disabled={!canProceed()} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
