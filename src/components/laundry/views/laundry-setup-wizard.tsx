"use client"

// Guided Initial Business Setup — the first experience after Quantix provisions
// a laundry business. Pure orchestration: it embeds the EXISTING master modules
// and APIs (stores, templates/bulk-import, categories, services, garments,
// pricing) into a guided flow. It never recreates the business/tenant (Quantix
// owns that) and never touches the billing/pricing/workflow engines.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Store, Sparkles, Tags, WashingMachine, Shirt, IndianRupee, CheckCircle2, Rocket,
  ChevronLeft, ChevronRight, Loader2, Download, Check,
} from "lucide-react"
import { toast } from "sonner"
import { useAdminStore } from "@/stores/admin-store"
import { LAUNDRY_TEMPLATES } from "@/lib/laundry-templates"
import { LaundryStoresView } from "@/components/admin/laundry/laundry-stores-view"
import { LaundryCategoriesMaster } from "./laundry-categories-master"
import { LaundryServicesMaster } from "./laundry-services-master"
import { LaundryGarmentsMaster } from "./laundry-garments-master"
import { LaundryPricingEngine } from "./laundry-pricing-engine"

interface Counts { stores: number; categories: number; services: number; garments: number; pricingRules: number }
const ZERO: Counts = { stores: 0, categories: 0, services: 0, garments: 0, pricingRules: 0 }

const STEPS = [
  { key: "stores", label: "Stores", icon: Store, hint: "Configure your operational locations" },
  { key: "template", label: "Templates", icon: Sparkles, hint: "Load a ready-made master data set" },
  { key: "categories", label: "Categories", icon: Tags, hint: "Organise garments & services" },
  { key: "services", label: "Services", icon: WashingMachine, hint: "What you do to garments" },
  { key: "garments", label: "Garments", icon: Shirt, hint: "Your priceable items" },
  { key: "pricing", label: "Pricing", icon: IndianRupee, hint: "Rules that bill every order" },
  { key: "finish", label: "Finish", icon: Rocket, hint: "Review & go live" },
] as const

export function LaundrySetupWizard({ businessId }: { businessId: string }) {
  const { setLaundryPage } = useAdminStore()
  const [step, setStep] = useState(0)
  const [counts, setCounts] = useState<Counts>(ZERO)
  const [loadingTpl, setLoadingTpl] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const template = LAUNDRY_TEMPLATES[0]

  const refresh = useCallback(async () => {
    if (!businessId) return
    try {
      const json = await fetch(`/api/laundry/setup?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (json.success) setCounts(json.counts)
    } catch {}
  }, [businessId])
  useEffect(() => { refresh() }, [refresh, step])

  const loadTemplate = async () => {
    if (!businessId) return
    setLoadingTpl(true)
    try {
      const res = await fetch("/api/laundry/masters/bulk-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, template: template.id }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Import failed")
      const created = json.categoriesCreated + json.servicesCreated + json.garmentsCreated
      toast.success(`Loaded ${created} item(s)${json.skipped ? `, ${json.skipped} already existed` : ""}`)
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed") } finally { setLoadingTpl(false) }
  }

  const finish = async () => {
    if (!businessId) return
    setFinishing(true)
    try {
      await fetch("/api/laundry/setup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, completed: true }),
      })
      toast.success("Setup complete — your laundry is ready to take orders!")
      setLaundryPage("dashboard")
    } catch { toast.error("Could not finish setup") } finally { setFinishing(false) }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white"><Rocket className="h-5 w-5" /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Set up your Laundry</h1>
          <p className="text-sm text-muted-foreground">A few quick steps and you’re ready to take orders. {current.hint}.</p>
        </div>
      </div>

      {/* Stepper rail */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => i <= step && setStep(i)} disabled={i > step}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
              i === step ? "bg-sky-600 text-white" : i < step ? "bg-sky-100 text-sky-700" : "bg-muted text-muted-foreground"}`}>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {current.key === "stores" && businessId && <LaundryStoresView businessId={businessId} />}
        {current.key === "categories" && <LaundryCategoriesMaster />}
        {current.key === "services" && <LaundryServicesMaster />}
        {current.key === "garments" && <LaundryGarmentsMaster />}
        {current.key === "pricing" && <LaundryPricingEngine />}

        {current.key === "template" && (
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Sparkles className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold">{template.label}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">✔ {template.categories.length} Categories</Badge>
              <Badge variant="outline">✔ {template.services.length} Services</Badge>
              <Badge variant="outline">✔ {template.garments.length} Garments</Badge>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              You currently have <strong>{counts.categories}</strong> categories, <strong>{counts.services}</strong> services and <strong>{counts.garments}</strong> garments. Loading a template only adds what’s missing — nothing is duplicated.
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={loadTemplate} disabled={loadingTpl} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
                {loadingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Load Template
              </Button>
              <Button variant="outline" onClick={() => setStep((s) => s + 1)}>Skip — I’ll add my own</Button>
            </div>
          </CardContent></Card>
        )}

        {current.key === "finish" && (
          <Card><CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-6 w-6" /><h3 className="text-lg font-semibold">Almost there — review your setup</h3></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Stores", value: counts.stores, icon: Store },
                { label: "Categories", value: counts.categories, icon: Tags },
                { label: "Services", value: counts.services, icon: WashingMachine },
                { label: "Garments", value: counts.garments, icon: Shirt },
                { label: "Pricing Rules", value: counts.pricingRules, icon: IndianRupee },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><c.icon className="h-4 w-4" /></div>
                  <div><p className="text-2xl font-bold tabular-nums leading-none">{c.value}</p><p className="text-xs text-muted-foreground mt-0.5">{c.label}</p></div>
                </div>
              ))}
            </div>
            {(counts.stores === 0 || counts.pricingRules === 0) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Tip: add at least one <strong>store</strong> and one <strong>pricing rule</strong> so the counter can create and bill orders. You can still finish and add these later.
              </div>
            )}
            <Button onClick={finish} disabled={finishing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Finish Setup &amp; Go Live
            </Button>
          </CardContent></Card>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="gap-1"><ChevronLeft className="h-4 w-4" /> Back</Button>
        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        {!isLast ? (
          <Button onClick={() => setStep((s) => s + 1)} className="gap-1 bg-sky-600 hover:bg-sky-700 text-white">Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <span className="w-[72px]" />
        )}
      </div>
    </div>
  )
}
