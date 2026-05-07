"use client"

import { useState, useCallback } from "react"
import {
  Settings,
  Palette,
  Receipt,
  MessageSquare,
  Mail,
  CreditCard,
  Printer,
  Save,
  RotateCcw,
  Globe,
  Shield,
  Copy,
  Check,
  Plus,
  Trash2,
  Send,
  TestTube,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminStore } from "@/stores/admin-store"
import { PageHeader } from "../shared/page-header"
import { useToast } from "@/hooks/use-toast"

// ─── Default State Types & Values ───────────────────────────────────────────

interface BrandingSettings {
  platformName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  faviconUrl: string
  supportEmail: string
  supportPhone: string
  websiteUrl: string
}

interface GSTSettings {
  gstRegistrationNumber: string
  businessLegalName: string
  businessAddress: string
  state: string
  gstRates: { rate: string; label: string; enabled: boolean }[]
  defaultGstRate: string
  stateGstins: { state: string; gstin: string }[]
  enableGstOnInvoices: boolean
}

interface InvoiceSettings {
  invoicePrefix: string
  invoiceStartingNumber: string
  invoiceTemplate: string
  defaultPaymentTerms: string
  invoiceFooterText: string
  showGstBreakdown: boolean
  showCompanyLogo: boolean
  invoiceNotesTemplate: string
}

interface WhatsAppSettings {
  apiKey: string
  phoneNumberId: string
  businessAccountId: string
  webhookUrl: string
  webhookVerifyToken: string
  enableNotifications: boolean
  templates: { id: string; name: string; body: string }[]
}

interface EmailSettings {
  smtpHost: string
  smtpPort: string
  smtpUsername: string
  smtpPassword: string
  fromEmail: string
  fromName: string
  enableNotifications: boolean
}

interface RazorpaySettings {
  keyId: string
  keySecret: string
  webhookUrl: string
  webhookSecret: string
  enableTestMode: boolean
  autoCapturePayments: boolean
  paymentMethods: {
    upi: boolean
    card: boolean
    netbanking: boolean
    wallet: boolean
  }
}

interface PrinterSettings {
  defaultPaperSize: string
  defaultPrinterType: string
  autoPrintOnOrder: boolean
  printReceiptOnPayment: boolean
  includeQrCode: boolean
  headerText: string
  footerText: string
  numberOfCopies: string
}

const defaultBranding: BrandingSettings = {
  platformName: "Quantix Core Platform",
  tagline: "Run Your Business Smarter",
  primaryColor: "#10B981",
  secondaryColor: "#6366F1",
  logoUrl: "",
  faviconUrl: "",
  supportEmail: "support@quantixcore.com",
  supportPhone: "+91 1800 123 4567",
  websiteUrl: "https://quantixcore.com",
}

const defaultGST: GSTSettings = {
  gstRegistrationNumber: "",
  businessLegalName: "",
  businessAddress: "",
  state: "Maharashtra",
  gstRates: [
    { rate: "0", label: "0% (Exempt)", enabled: true },
    { rate: "5", label: "5%", enabled: true },
    { rate: "12", label: "12%", enabled: true },
    { rate: "18", label: "18%", enabled: true },
    { rate: "28", label: "28%", enabled: true },
  ],
  defaultGstRate: "18",
  stateGstins: [{ state: "Maharashtra", gstin: "" }],
  enableGstOnInvoices: true,
}

const defaultInvoice: InvoiceSettings = {
  invoicePrefix: "QX-INV-",
  invoiceStartingNumber: "1001",
  invoiceTemplate: "standard",
  defaultPaymentTerms: "net30",
  invoiceFooterText: "Thank you for your business!",
  showGstBreakdown: true,
  showCompanyLogo: true,
  invoiceNotesTemplate:
    "This is a computer-generated invoice. No signature required.",
}

const defaultWhatsApp: WhatsAppSettings = {
  apiKey: "",
  phoneNumberId: "",
  businessAccountId: "",
  webhookUrl: "https://api.quantixcore.com/webhooks/whatsapp",
  webhookVerifyToken: "",
  enableNotifications: false,
  templates: [
    {
      id: "1",
      name: "Order Confirmation",
      body: "Hi {{name}}, your order #{{order_id}} has been confirmed. Total: ₹{{amount}}",
    },
    {
      id: "2",
      name: "Payment Received",
      body: "Hi {{name}}, we received your payment of ₹{{amount}} for order #{{order_id}}.",
    },
  ],
}

const defaultEmail: EmailSettings = {
  smtpHost: "smtp.gmail.com",
  smtpPort: "587",
  smtpUsername: "",
  smtpPassword: "",
  fromEmail: "noreply@quantixcore.com",
  fromName: "Quantix Core",
  enableNotifications: true,
}

const defaultRazorpay: RazorpaySettings = {
  keyId: "",
  keySecret: "",
  webhookUrl: "https://api.quantixcore.com/webhooks/razorpay",
  webhookSecret: "",
  enableTestMode: true,
  autoCapturePayments: false,
  paymentMethods: {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true,
  },
}

const defaultPrinter: PrinterSettings = {
  defaultPaperSize: "80mm",
  defaultPrinterType: "thermal",
  autoPrintOnOrder: false,
  printReceiptOnPayment: true,
  includeQrCode: true,
  headerText: "Quantix Core Platform",
  footerText: "Thank you! Visit again.",
  numberOfCopies: "1",
}

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
]

// ─── Shared Sub-Components ──────────────────────────────────────────────────

function FormField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  )
}

function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9 shrink-0"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

function SaveResetButtons({
  onSave,
  onReset,
}: {
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <Button onClick={onSave} className="gap-2">
        <Save className="h-4 w-4" />
        Save Changes
      </Button>
      <Button variant="outline" onClick={onReset} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Reset to Defaults
      </Button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SettingsView() {
  const { toast } = useToast()

  // ── State for each tab ──
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding)
  const [gst, setGst] = useState<GSTSettings>(defaultGST)
  const [invoice, setInvoice] = useState<InvoiceSettings>(defaultInvoice)
  const [whatsapp, setWhatsapp] = useState<WhatsAppSettings>(defaultWhatsApp)
  const [email, setEmail] = useState<EmailSettings>(defaultEmail)
  const [razorpay, setRazorpay] =
    useState<RazorpaySettings>(defaultRazorpay)
  const [printer, setPrinter] = useState<PrinterSettings>(defaultPrinter)

  const showSaveToast = useCallback(
    (section: string) => {
      toast({
        title: "Settings Saved",
        description: `${section} settings have been saved successfully.`,
      })
    },
    [toast]
  )

  const showResetToast = useCallback(
    (section: string) => {
      toast({
        title: "Settings Reset",
        description: `${section} settings have been reset to defaults.`,
      })
    },
    [toast]
  )

  // ── Branding Tab ──
  const renderBrandingTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Identity</CardTitle>
          <CardDescription>
            Configure how your platform appears to businesses and customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Platform Name" description="The name displayed across the platform">
              <Input
                value={branding.platformName}
                onChange={(e) =>
                  setBranding({ ...branding, platformName: e.target.value })
                }
              />
            </FormField>
            <FormField label="Tagline" description="Your platform's motto or tagline">
              <Input
                value={branding.tagline}
                onChange={(e) =>
                  setBranding({ ...branding, tagline: e.target.value })
                }
              />
            </FormField>
          </div>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Primary Color" description="Main brand color for buttons and accents">
              <div className="flex gap-2">
                <div
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{ backgroundColor: branding.primaryColor }}
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding({ ...branding, primaryColor: e.target.value })
                  }
                  placeholder="#10B981"
                />
              </div>
            </FormField>
            <FormField label="Secondary Color" description="Secondary color for highlights and links">
              <div className="flex gap-2">
                <div
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{ backgroundColor: branding.secondaryColor }}
                />
                <Input
                  value={branding.secondaryColor}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      secondaryColor: e.target.value,
                    })
                  }
                  placeholder="#6366F1"
                />
              </div>
            </FormField>
          </div>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Logo URL" description="URL to your platform logo image">
              <Input
                value={branding.logoUrl}
                onChange={(e) =>
                  setBranding({ ...branding, logoUrl: e.target.value })
                }
                placeholder="https://example.com/logo.png"
              />
            </FormField>
            <FormField label="Favicon URL" description="URL to your platform favicon">
              <Input
                value={branding.faviconUrl}
                onChange={(e) =>
                  setBranding({ ...branding, faviconUrl: e.target.value })
                }
                placeholder="https://example.com/favicon.ico"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
          <CardDescription>
            Support contact details shown to users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Support Email">
              <Input
                type="email"
                value={branding.supportEmail}
                onChange={(e) =>
                  setBranding({ ...branding, supportEmail: e.target.value })
                }
              />
            </FormField>
            <FormField label="Support Phone">
              <Input
                value={branding.supportPhone}
                onChange={(e) =>
                  setBranding({ ...branding, supportPhone: e.target.value })
                }
              />
            </FormField>
          </div>
          <FormField label="Website URL">
            <Input
              value={branding.websiteUrl}
              onChange={(e) =>
                setBranding({ ...branding, websiteUrl: e.target.value })
              }
            />
          </FormField>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding Preview</CardTitle>
          <CardDescription>
            How your platform will look with current settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border p-6 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-lg"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.platformName.charAt(0)}
              </div>
              <div>
                <h3
                  className="font-semibold text-base"
                  style={{ color: branding.primaryColor }}
                >
                  {branding.platformName || "Platform Name"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {branding.tagline || "Your tagline here"}
                </p>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                style={{ backgroundColor: branding.primaryColor }}
                className="text-white"
              >
                Primary
              </Button>
              <Button
                size="sm"
                variant="outline"
                style={{
                  borderColor: branding.secondaryColor,
                  color: branding.secondaryColor,
                }}
              >
                Secondary
              </Button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>
                Email: {branding.supportEmail || "support@example.com"}
              </p>
              <p>
                Phone: {branding.supportPhone || "+91 0000 000 000"}
              </p>
              <p>
                Web: {branding.websiteUrl || "https://example.com"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SaveResetButtons
        onSave={() => showSaveToast("Platform Branding")}
        onReset={() => {
          setBranding(defaultBranding)
          showResetToast("Platform Branding")
        }}
      />
    </div>
  )

  // ── GST Settings Tab ──
  const renderGSTTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Registration</CardTitle>
          <CardDescription>
            Your business GST registration details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField
              label="GST Registration Number"
              description="15-digit GSTIN"
            >
              <Input
                value={gst.gstRegistrationNumber}
                onChange={(e) =>
                  setGst({ ...gst, gstRegistrationNumber: e.target.value })
                }
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </FormField>
            <FormField label="Business Legal Name">
              <Input
                value={gst.businessLegalName}
                onChange={(e) =>
                  setGst({ ...gst, businessLegalName: e.target.value })
                }
                placeholder="Quantix Technologies Pvt. Ltd."
              />
            </FormField>
          </div>
          <FormField label="Business Address">
            <Textarea
              value={gst.businessAddress}
              onChange={(e) =>
                setGst({ ...gst, businessAddress: e.target.value })
              }
              placeholder="Full business address"
              rows={3}
            />
          </FormField>
          <FormField label="State" description="Primary business state">
            <Select
              value={gst.state}
              onValueChange={(v) => setGst({ ...gst, state: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {indianStates.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Rates</CardTitle>
          <CardDescription>
            Enable or disable GST rates available on the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_80px] bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Rate</span>
              <span>Label</span>
              <span className="text-right">Enabled</span>
            </div>
            {gst.gstRates.map((item, idx) => (
              <div
                key={item.rate}
                className="grid grid-cols-[1fr_1fr_80px] items-center px-4 py-3 border-t last:border-0"
              >
                <span className="text-sm font-medium">{item.rate}%</span>
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <div className="flex justify-end">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(checked) => {
                      const updated = [...gst.gstRates]
                      updated[idx] = { ...updated[idx], enabled: checked }
                      setGst({ ...gst, gstRates: updated })
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <FormField
            label="Default GST Rate"
            description="Used when no specific rate is set"
          >
            <Select
              value={gst.defaultGstRate}
              onValueChange={(v) => setGst({ ...gst, defaultGstRate: v })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select rate" />
              </SelectTrigger>
              <SelectContent>
                {gst.gstRates
                  .filter((r) => r.enabled)
                  .map((r) => (
                    <SelectItem key={r.rate} value={r.rate}>
                      {r.rate}%
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">State-wise GSTIN</CardTitle>
          <CardDescription>
            GSTIN for each state where you are registered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gst.stateGstins.map((item, idx) => (
            <div key={idx} className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select
                  value={item.state}
                  onValueChange={(v) => {
                    const updated = [...gst.stateGstins]
                    updated[idx] = { ...updated[idx], state: v }
                    setGst({ ...gst, stateGstins: updated })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {indianStates.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">GSTIN</Label>
                <Input
                  value={item.gstin}
                  onChange={(e) => {
                    const updated = [...gst.stateGstins]
                    updated[idx] = { ...updated[idx], gstin: e.target.value }
                    setGst({ ...gst, stateGstins: updated })
                  }}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                />
              </div>
              {gst.stateGstins.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    const updated = gst.stateGstins.filter((_, i) => i !== idx)
                    setGst({ ...gst, stateGstins: updated })
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              setGst({
                ...gst,
                stateGstins: [...gst.stateGstins, { state: "", gstin: "" }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add State GSTIN
          </Button>
        </CardContent>
      </Card>

      <SwitchField
        label="Enable GST on Invoices"
        description="Show GST calculations on generated invoices"
        checked={gst.enableGstOnInvoices}
        onCheckedChange={(checked) =>
          setGst({ ...gst, enableGstOnInvoices: checked })
        }
      />

      <SaveResetButtons
        onSave={() => showSaveToast("GST Settings")}
        onReset={() => {
          setGst(defaultGST)
          showResetToast("GST Settings")
        }}
      />
    </div>
  )

  // ── Invoice Settings Tab ──
  const renderInvoiceTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Numbering</CardTitle>
          <CardDescription>
            Configure how invoices are numbered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField
              label="Invoice Prefix"
              description="Prefix added before the invoice number"
            >
              <Input
                value={invoice.invoicePrefix}
                onChange={(e) =>
                  setInvoice({ ...invoice, invoicePrefix: e.target.value })
                }
                placeholder="QX-INV-"
              />
            </FormField>
            <FormField
              label="Starting Number"
              description="First invoice number in the sequence"
            >
              <Input
                type="number"
                value={invoice.invoiceStartingNumber}
                onChange={(e) =>
                  setInvoice({
                    ...invoice,
                    invoiceStartingNumber: e.target.value,
                  })
                }
                placeholder="1001"
              />
            </FormField>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Preview:{" "}
              <span className="font-medium text-foreground">
                {invoice.invoicePrefix}
                {invoice.invoiceStartingNumber}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Template</CardTitle>
          <CardDescription>
            Choose the default layout for invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Template Style">
            <Select
              value={invoice.invoiceTemplate}
              onValueChange={(v) =>
                setInvoice({ ...invoice, invoiceTemplate: v })
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Default Payment Terms"
            description="When the invoice payment is due"
          >
            <Select
              value={invoice.defaultPaymentTerms}
              onValueChange={(v) =>
                setInvoice({ ...invoice, defaultPaymentTerms: v })
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                <SelectItem value="net15">Net 15</SelectItem>
                <SelectItem value="net30">Net 30</SelectItem>
                <SelectItem value="net45">Net 45</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Content</CardTitle>
          <CardDescription>
            Customize the content displayed on invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Footer Text">
            <Input
              value={invoice.invoiceFooterText}
              onChange={(e) =>
                setInvoice({ ...invoice, invoiceFooterText: e.target.value })
              }
              placeholder="Thank you for your business!"
            />
          </FormField>
          <FormField
            label="Invoice Notes Template"
            description="Default notes appended to all invoices"
          >
            <Textarea
              value={invoice.invoiceNotesTemplate}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  invoiceNotesTemplate: e.target.value,
                })
              }
              rows={3}
            />
          </FormField>
          <div className="space-y-3">
            <SwitchField
              label="Show GST Breakdown"
              description="Display separate CGST/SGST or IGST on invoices"
              checked={invoice.showGstBreakdown}
              onCheckedChange={(checked) =>
                setInvoice({ ...invoice, showGstBreakdown: checked })
              }
            />
            <SwitchField
              label="Show Company Logo"
              description="Include your company logo on invoices"
              checked={invoice.showCompanyLogo}
              onCheckedChange={(checked) =>
                setInvoice({ ...invoice, showCompanyLogo: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <SaveResetButtons
        onSave={() => showSaveToast("Invoice Settings")}
        onReset={() => {
          setInvoice(defaultInvoice)
          showResetToast("Invoice Settings")
        }}
      />
    </div>
  )

  // ── WhatsApp Config Tab ──
  const renderWhatsAppTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Business API</CardTitle>
          <CardDescription>
            Connect your WhatsApp Business API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="API Key" description="Your WhatsApp Business API key">
            <Input
              type="password"
              value={whatsapp.apiKey}
              onChange={(e) =>
                setWhatsapp({ ...whatsapp, apiKey: e.target.value })
              }
              placeholder="Enter your API key"
            />
          </FormField>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Phone Number ID">
              <Input
                value={whatsapp.phoneNumberId}
                onChange={(e) =>
                  setWhatsapp({ ...whatsapp, phoneNumberId: e.target.value })
                }
                placeholder="Phone Number ID"
              />
            </FormField>
            <FormField label="Business Account ID">
              <Input
                value={whatsapp.businessAccountId}
                onChange={(e) =>
                  setWhatsapp({
                    ...whatsapp,
                    businessAccountId: e.target.value,
                  })
                }
                placeholder="Business Account ID"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
          <CardDescription>
            Webhook endpoint for WhatsApp events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Webhook URL" description="Configure this URL in your WhatsApp Business dashboard">
            <div className="flex gap-2">
              <Input
                value={whatsapp.webhookUrl}
                readOnly
                className="bg-muted/50"
              />
              <CopyButton text={whatsapp.webhookUrl} />
            </div>
          </FormField>
          <FormField label="Webhook Verify Token">
            <Input
              value={whatsapp.webhookVerifyToken}
              onChange={(e) =>
                setWhatsapp({
                  ...whatsapp,
                  webhookVerifyToken: e.target.value,
                })
              }
              placeholder="Verify token for webhook"
            />
          </FormField>
        </CardContent>
      </Card>

      <SwitchField
        label="Enable WhatsApp Notifications"
        description="Send order and payment notifications via WhatsApp"
        checked={whatsapp.enableNotifications}
        onCheckedChange={(checked) =>
          setWhatsapp({ ...whatsapp, enableNotifications: checked })
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Message Templates</CardTitle>
              <CardDescription>
                Manage WhatsApp message templates
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                setWhatsapp({
                  ...whatsapp,
                  templates: [
                    ...whatsapp.templates,
                    {
                      id: String(Date.now()),
                      name: "",
                      body: "",
                    },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsapp.templates.map((tmpl, idx) => (
            <div key={tmpl.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  value={tmpl.name}
                  onChange={(e) => {
                    const updated = [...whatsapp.templates]
                    updated[idx] = { ...updated[idx], name: e.target.value }
                    setWhatsapp({ ...whatsapp, templates: updated })
                  }}
                  placeholder="Template name"
                  className="font-medium"
                />
                {whatsapp.templates.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      const updated = whatsapp.templates.filter(
                        (_, i) => i !== idx
                      )
                      setWhatsapp({ ...whatsapp, templates: updated })
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea
                value={tmpl.body}
                onChange={(e) => {
                  const updated = [...whatsapp.templates]
                  updated[idx] = { ...updated[idx], body: e.target.value }
                  setWhatsapp({ ...whatsapp, templates: updated })
                }}
                placeholder="Template body with {{variables}}"
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            toast({
              title: "Test Message Sent",
              description:
                "A test WhatsApp message has been sent to your registered number.",
            })
          }
        >
          <TestTube className="h-4 w-4" />
          Send Test Message
        </Button>
      </div>

      <SaveResetButtons
        onSave={() => showSaveToast("WhatsApp Config")}
        onReset={() => {
          setWhatsapp(defaultWhatsApp)
          showResetToast("WhatsApp Config")
        }}
      />
    </div>
  )

  // ── Email Config Tab ──
  const renderEmailTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP Configuration</CardTitle>
          <CardDescription>
            Configure your email server settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="SMTP Host">
              <Input
                value={email.smtpHost}
                onChange={(e) =>
                  setEmail({ ...email, smtpHost: e.target.value })
                }
                placeholder="smtp.gmail.com"
              />
            </FormField>
            <FormField label="SMTP Port">
              <Input
                value={email.smtpPort}
                onChange={(e) =>
                  setEmail({ ...email, smtpPort: e.target.value })
                }
                placeholder="587"
              />
            </FormField>
          </div>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="SMTP Username">
              <Input
                value={email.smtpUsername}
                onChange={(e) =>
                  setEmail({ ...email, smtpUsername: e.target.value })
                }
                placeholder="your-email@gmail.com"
              />
            </FormField>
            <FormField label="SMTP Password">
              <Input
                type="password"
                value={email.smtpPassword}
                onChange={(e) =>
                  setEmail({ ...email, smtpPassword: e.target.value })
                }
                placeholder="••••••••"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Information</CardTitle>
          <CardDescription>
            Default sender details for outgoing emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="From Email">
              <Input
                type="email"
                value={email.fromEmail}
                onChange={(e) =>
                  setEmail({ ...email, fromEmail: e.target.value })
                }
                placeholder="noreply@quantixcore.com"
              />
            </FormField>
            <FormField label="From Name">
              <Input
                value={email.fromName}
                onChange={(e) =>
                  setEmail({ ...email, fromName: e.target.value })
                }
                placeholder="Quantix Core"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <SwitchField
        label="Enable Email Notifications"
        description="Send system notifications via email"
        checked={email.enableNotifications}
        onCheckedChange={(checked) =>
          setEmail({ ...email, enableNotifications: checked })
        }
      />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            toast({
              title: "Test Email Sent",
              description:
                "A test email has been sent to your configured address.",
            })
          }
        >
          <Send className="h-4 w-4" />
          Send Test Email
        </Button>
      </div>

      <SaveResetButtons
        onSave={() => showSaveToast("Email Config")}
        onReset={() => {
          setEmail(defaultEmail)
          showResetToast("Email Config")
        }}
      />
    </div>
  )

  // ── Razorpay Config Tab ──
  const renderRazorpayTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Razorpay API Credentials</CardTitle>
          <CardDescription>
            Connect your Razorpay payment gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Key ID" description="Your Razorpay API key ID">
              <Input
                value={razorpay.keyId}
                onChange={(e) =>
                  setRazorpay({ ...razorpay, keyId: e.target.value })
                }
                placeholder="rzp_live_xxxxxxxxxxxx"
              />
            </FormField>
            <FormField
              label="Key Secret"
              description="Your Razorpay API key secret"
            >
              <Input
                type="password"
                value={razorpay.keySecret}
                onChange={(e) =>
                  setRazorpay({ ...razorpay, keySecret: e.target.value })
                }
                placeholder="••••••••••••"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
          <CardDescription>
            Webhook endpoint for Razorpay payment events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Webhook URL" description="Configure this URL in your Razorpay dashboard">
            <div className="flex gap-2">
              <Input
                value={razorpay.webhookUrl}
                readOnly
                className="bg-muted/50"
              />
              <CopyButton text={razorpay.webhookUrl} />
            </div>
          </FormField>
          <FormField label="Webhook Secret">
            <Input
              type="password"
              value={razorpay.webhookSecret}
              onChange={(e) =>
                setRazorpay({ ...razorpay, webhookSecret: e.target.value })
              }
              placeholder="Webhook secret from Razorpay"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Options</CardTitle>
          <CardDescription>
            Configure payment capture and available methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchField
            label="Test Mode"
            description="Use Razorpay test environment (no real charges)"
            checked={razorpay.enableTestMode}
            onCheckedChange={(checked) =>
              setRazorpay({ ...razorpay, enableTestMode: checked })
            }
          />
          <SwitchField
            label="Auto-Capture Payments"
            description="Automatically capture authorized payments"
            checked={razorpay.autoCapturePayments}
            onCheckedChange={(checked) =>
              setRazorpay({ ...razorpay, autoCapturePayments: checked })
            }
          />

          <Separator className="my-2" />

          <div className="space-y-1">
            <Label className="text-sm font-medium">Payment Methods</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Enable or disable payment methods for customers
            </p>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">UPI</Label>
                <p className="text-xs text-muted-foreground">
                  Google Pay, PhonePe, etc.
                </p>
              </div>
              <Switch
                checked={razorpay.paymentMethods.upi}
                onCheckedChange={(checked) =>
                  setRazorpay({
                    ...razorpay,
                    paymentMethods: { ...razorpay.paymentMethods, upi: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">Card</Label>
                <p className="text-xs text-muted-foreground">
                  Credit & Debit cards
                </p>
              </div>
              <Switch
                checked={razorpay.paymentMethods.card}
                onCheckedChange={(checked) =>
                  setRazorpay({
                    ...razorpay,
                    paymentMethods: {
                      ...razorpay.paymentMethods,
                      card: checked,
                    },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">Netbanking</Label>
                <p className="text-xs text-muted-foreground">
                  All major banks
                </p>
              </div>
              <Switch
                checked={razorpay.paymentMethods.netbanking}
                onCheckedChange={(checked) =>
                  setRazorpay({
                    ...razorpay,
                    paymentMethods: {
                      ...razorpay.paymentMethods,
                      netbanking: checked,
                    },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">Wallet</Label>
                <p className="text-xs text-muted-foreground">
                  Paytm, Mobikwik, etc.
                </p>
              </div>
              <Switch
                checked={razorpay.paymentMethods.wallet}
                onCheckedChange={(checked) =>
                  setRazorpay({
                    ...razorpay,
                    paymentMethods: {
                      ...razorpay.paymentMethods,
                      wallet: checked,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <SaveResetButtons
        onSave={() => showSaveToast("Razorpay Config")}
        onReset={() => {
          setRazorpay(defaultRazorpay)
          showResetToast("Razorpay Config")
        }}
      />
    </div>
  )

  // ── Printer Defaults Tab ──
  const renderPrinterTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Printer Configuration</CardTitle>
          <CardDescription>
            Default printer settings for receipts and invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField label="Default Paper Size">
              <Select
                value={printer.defaultPaperSize}
                onValueChange={(v) =>
                  setPrinter({ ...printer, defaultPaperSize: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (2-inch)</SelectItem>
                  <SelectItem value="80mm">80mm (3-inch)</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Default Printer Type">
              <Select
                value={printer.defaultPrinterType}
                onValueChange={(v) =>
                  setPrinter({ ...printer, defaultPrinterType: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermal">Thermal</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="usb">USB</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Number of Copies">
            <Input
              type="number"
              value={printer.numberOfCopies}
              onChange={(e) =>
                setPrinter({ ...printer, numberOfCopies: e.target.value })
              }
              min="1"
              max="10"
              className="max-w-xs"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Print Settings</CardTitle>
          <CardDescription>
            Configure when receipts are automatically printed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchField
            label="Auto-Print on Order"
            description="Print receipt automatically when a new order is placed"
            checked={printer.autoPrintOnOrder}
            onCheckedChange={(checked) =>
              setPrinter({ ...printer, autoPrintOnOrder: checked })
            }
          />
          <SwitchField
            label="Print Receipt on Payment"
            description="Print receipt when a payment is received"
            checked={printer.printReceiptOnPayment}
            onCheckedChange={(checked) =>
              setPrinter({ ...printer, printReceiptOnPayment: checked })
            }
          />
          <SwitchField
            label="Include QR Code"
            description="Add a QR code (order URL / payment link) to the receipt"
            checked={printer.includeQrCode}
            onCheckedChange={(checked) =>
              setPrinter({ ...printer, includeQrCode: checked })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt Content</CardTitle>
          <CardDescription>
            Customize the header and footer of printed receipts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Header Text" description="Printed at the top of each receipt">
            <Input
              value={printer.headerText}
              onChange={(e) =>
                setPrinter({ ...printer, headerText: e.target.value })
              }
              placeholder="Business Name"
            />
          </FormField>
          <FormField label="Footer Text" description="Printed at the bottom of each receipt">
            <Input
              value={printer.footerText}
              onChange={(e) =>
                setPrinter({ ...printer, footerText: e.target.value })
              }
              placeholder="Thank you! Visit again."
            />
          </FormField>
        </CardContent>
      </Card>

      <SaveResetButtons
        onSave={() => showSaveToast("Printer Defaults")}
        onReset={() => {
          setPrinter(defaultPrinter)
          showResetToast("Printer Defaults")
        }}
      />
    </div>
  )

  // ── Render ──
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure platform-wide settings and integrations"
        icon={Settings}
      />

      <Tabs defaultValue="branding" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full flex flex-nowrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="branding" className="gap-2 text-xs sm:text-sm">
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="gst" className="gap-2 text-xs sm:text-sm">
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GST</span>
            </TabsTrigger>
            <TabsTrigger value="invoice" className="gap-2 text-xs sm:text-sm">
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invoice</span>
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="gap-2 text-xs sm:text-sm"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2 text-xs sm:text-sm">
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger
              value="razorpay"
              className="gap-2 text-xs sm:text-sm"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Razorpay</span>
            </TabsTrigger>
            <TabsTrigger value="printer" className="gap-2 text-xs sm:text-sm">
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Printer</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="branding">{renderBrandingTab()}</TabsContent>
        <TabsContent value="gst">{renderGSTTab()}</TabsContent>
        <TabsContent value="invoice">{renderInvoiceTab()}</TabsContent>
        <TabsContent value="whatsapp">{renderWhatsAppTab()}</TabsContent>
        <TabsContent value="email">{renderEmailTab()}</TabsContent>
        <TabsContent value="razorpay">{renderRazorpayTab()}</TabsContent>
        <TabsContent value="printer">{renderPrinterTab()}</TabsContent>
      </Tabs>
    </div>
  )
}
