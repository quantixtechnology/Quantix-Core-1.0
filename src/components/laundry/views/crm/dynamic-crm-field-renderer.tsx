"use client"

// DynamicCrmFieldRenderer — renders ONE configured Lead field from its
// metadata. The Lead Create/Edit forms map over active field definitions and
// render this; there is no hardcoded per-field JSX anywhere in the CRM.

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type CrmField, parseOptions } from "./crm-shared"

interface Props {
  field: CrmField
  value: unknown
  onChange: (value: unknown) => void
}

export function DynamicCrmFieldRenderer({ field, value, onChange }: Props) {
  const opts = parseOptions(field.options).filter((o) => o.active !== false).sort((a, b) => a.order - b.order)
  const str = value == null ? "" : String(value)

  const control = (() => {
    switch (field.type) {
      case "TEXTAREA": case "ADDRESS":
        return <Textarea value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || undefined} rows={field.type === "ADDRESS" ? 2 : 3} className="text-sm" />
      case "NUMBER":
        return <Input type="number" step={1} value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || undefined} className="h-9" />
      case "DECIMAL":
        return <Input type="number" step="0.01" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || undefined} className="h-9" />
      case "CURRENCY":
        return (
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
            <Input type="number" step="0.01" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || undefined} className="h-9 pl-6" />
          </div>
        )
      case "DATE":
        return <Input type="date" value={str} onChange={(e) => onChange(e.target.value)} className="h-9" />
      case "DATETIME":
        return <Input type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} className="h-9" />
      case "PHONE":
        return <Input type="tel" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "e.g. 98765 43210"} className="h-9" />
      case "EMAIL":
        return <Input type="email" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "name@example.com"} className="h-9" />
      case "URL":
        return <Input type="url" value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "https://…"} className="h-9" />
      case "SELECT":
        return (
          <Select value={str || undefined} onValueChange={(v) => onChange(v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder={field.placeholder || "Select…"} /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      case "RADIO":
        return (
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)}
                className={`rounded-lg border px-3 h-9 text-xs font-medium transition-colors ${str === o.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {o.label}
              </button>
            ))}
          </div>
        )
      case "MULTISELECT": {
        const selected = Array.isArray(value) ? value.map(String) : str ? [str] : []
        const toggleOpt = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
        return (
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => (
              <button key={o.value} type="button" onClick={() => toggleOpt(o.value)}
                className={`rounded-lg border px-3 h-9 text-xs font-medium transition-colors ${selected.includes(o.value) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {o.label}
              </button>
            ))}
          </div>
        )
      }
      case "CHECKBOX":
        return (
          <label className="flex items-center gap-2 h-9 text-sm text-slate-600 cursor-pointer">
            <Checkbox checked={value === true || value === "true"} onCheckedChange={(v) => onChange(v === true)} />
            {field.placeholder || field.label}
          </label>
        )
      case "TOGGLE":
        return (
          <label className="flex items-center gap-2 h-9 text-sm text-slate-600 cursor-pointer">
            <Switch checked={value === true || value === "true"} onCheckedChange={(v) => onChange(v)} className="data-[state=checked]:bg-blue-600" />
            {field.placeholder || "Yes / No"}
          </label>
        )
      default: // TEXT
        return <Input value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || undefined} className="h-9" />
    }
  })()

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {control}
      {field.description && <p className="text-[10px] text-slate-400">{field.description}</p>}
    </div>
  )
}
