"use client"

import { useState, useMemo, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge } from "../shared/status-badge"
import { domains, deployments, businesses } from "@/components/dashboard/data"
import type { DomainStatus, DeploymentStatus } from "@/components/dashboard/data"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Globe,
  Plus,
  Search,
  X,
  Shield,
  ExternalLink,
  Server,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  ArrowUpRight,
  Activity,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainRecord {
  id: string
  businessId: string
  businessName: string
  domain: string
  isPrimary: boolean
  sslStatus: string
  status: DomainStatus
  dnsProvider: string
}

interface DeploymentRecord {
  id: string
  businessId: string
  businessName: string
  type: string
  status: DeploymentStatus
  hostingProvider: string
  version: string
  healthStatus: string
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const mockDomainTimelines: Record<string, { step: string; status: string; timestamp: string }[]> = {
  dom_1: [
    { step: "DNS Configured", status: "completed", timestamp: "2025-01-02 10:30" },
    { step: "DNS Propagation Complete", status: "completed", timestamp: "2025-01-02 14:15" },
    { step: "SSL Certificate Issued", status: "completed", timestamp: "2025-01-02 15:00" },
    { step: "Domain Active", status: "completed", timestamp: "2025-01-02 15:05" },
  ],
  dom_5: [
    { step: "DNS Configured", status: "completed", timestamp: "2025-01-14 09:00" },
    { step: "DNS Propagation Complete", status: "completed", timestamp: "2025-01-14 13:30" },
    { step: "SSL Certificate Pending", status: "current", timestamp: "2025-01-14 14:00" },
    { step: "Domain Active", status: "pending", timestamp: "" },
  ],
  dom_7: [
    { step: "DNS Configuration Pending", status: "current", timestamp: "2025-01-15 08:00" },
    { step: "DNS Propagation", status: "pending", timestamp: "" },
    { step: "SSL Certificate", status: "pending", timestamp: "" },
    { step: "Domain Active", status: "pending", timestamp: "" },
  ],
}

const defaultTimeline: { step: string; status: string; timestamp: string }[] = [
  { step: "DNS Configured", status: "completed", timestamp: "2025-01-05 10:00" },
  { step: "DNS Propagation Complete", status: "completed", timestamp: "2025-01-05 14:00" },
  { step: "SSL Certificate Issued", status: "completed", timestamp: "2025-01-05 15:00" },
  { step: "Domain Active", status: "completed", timestamp: "2025-01-05 15:05" },
]

const mockDeploymentLogs: Record<string, { timestamp: string; level: string; message: string }[]> = {
  dep_5: [
    { timestamp: "2025-01-15 10:00:12", level: "info", message: "Build triggered for MedQuick Pharmacy" },
    { timestamp: "2025-01-15 10:00:15", level: "info", message: "Installing dependencies..." },
    { timestamp: "2025-01-15 10:01:30", level: "info", message: "Dependencies installed successfully" },
    { timestamp: "2025-01-15 10:01:35", level: "info", message: "Running build script..." },
    { timestamp: "2025-01-15 10:03:20", level: "warn", message: "Build optimization: large bundle detected (>2MB)" },
    { timestamp: "2025-01-15 10:03:45", level: "info", message: "Build completed successfully" },
  ],
  dep_8: [
    { timestamp: "2025-01-14 22:00:05", level: "info", message: "Health check: degraded performance detected" },
    { timestamp: "2025-01-14 22:00:10", level: "warn", message: "Response time: 2800ms (threshold: 1000ms)" },
    { timestamp: "2025-01-14 22:05:00", level: "info", message: "Auto-scaling triggered: adding 1 instance" },
    { timestamp: "2025-01-14 22:10:30", level: "info", message: "Health check: still degraded" },
    { timestamp: "2025-01-14 22:15:00", level: "warn", message: "Memory usage: 89% on primary instance" },
  ],
}

const defaultDeploymentLogs: { timestamp: string; level: string; message: string }[] = [
  { timestamp: "2025-01-10 09:00:00", level: "info", message: "Deployment initiated" },
  { timestamp: "2025-01-10 09:01:00", level: "info", message: "Build completed successfully" },
  { timestamp: "2025-01-10 09:02:00", level: "info", message: "Deployment live on production" },
  { timestamp: "2025-01-10 09:02:05", level: "info", message: "Health check passed" },
]

const mockVersionHistory: Record<string, { version: string; deployedAt: string; status: string }[]> = {
  dep_1: [
    { version: "2.1.3", deployedAt: "2025-01-10", status: "current" },
    { version: "2.1.2", deployedAt: "2024-12-28", status: "previous" },
    { version: "2.1.1", deployedAt: "2024-12-15", status: "older" },
  ],
  dep_3: [
    { version: "2.1.3", deployedAt: "2025-01-12", status: "current" },
    { version: "2.1.2", deployedAt: "2024-12-20", status: "previous" },
  ],
}

// ---------------------------------------------------------------------------
// DNS Instructions data
// ---------------------------------------------------------------------------

interface DNSInstruction {
  provider: string
  icon: string
  steps: string[]
  records: { type: string; name: string; value: string }[]
}

const dnsInstructions: DNSInstruction[] = [
  {
    provider: "Cloudflare",
    icon: "☁️",
    steps: [
      "Log in to your Cloudflare dashboard",
      "Select the domain you want to configure",
      "Go to DNS > Records",
      "Click 'Add Record' and add the CNAME/A records below",
      "Ensure the Proxy status is set to 'Proxied' (orange cloud) for SSL support",
      "Wait for DNS propagation (usually 1-5 minutes with Cloudflare)",
    ],
    records: [
      { type: "CNAME", name: "www", value: "cname.quantixplatform.in" },
      { type: "CNAME", name: "@", value: "cname.quantixplatform.in" },
      { type: "A", name: "@", value: "34.131.45.67" },
    ],
  },
  {
    provider: "GoDaddy",
    icon: "🌐",
    steps: [
      "Log in to your GoDaddy account",
      "Go to My Products > DNS > Manage Zones",
      "Select your domain",
      "Add the CNAME and A records below",
      "Set TTL to 'Custom' and 600 seconds for faster propagation",
      "DNS propagation may take 15-30 minutes",
    ],
    records: [
      { type: "CNAME", name: "www", value: "cname.quantixplatform.in" },
      { type: "A", name: "@", value: "34.131.45.67" },
    ],
  },
  {
    provider: "Route53 (AWS)",
    icon: "🔶",
    steps: [
      "Log in to the AWS Management Console",
      "Navigate to Route 53 > Hosted zones",
      "Select your domain's hosted zone",
      "Click 'Create Record' and add the records below",
      "For CNAME records, set TTL to 300 seconds",
      "For A records, set Alias to 'No' and enter the IP address",
      "Propagation typically takes 1-2 minutes",
    ],
    records: [
      { type: "CNAME", name: "www.yourdomain.in", value: "cname.quantixplatform.in" },
      { type: "A", name: "yourdomain.in", value: "34.131.45.67" },
    ],
  },
]

const sslInstructions = [
  "SSL certificates are automatically provisioned via Let's Encrypt once DNS is properly configured",
  "Ensure your domain resolves to our server before SSL issuance",
  "SSL certificates are auto-renewed 30 days before expiry",
  "If SSL issuance fails, verify DNS records point correctly and try the 'Retry SSL' action",
  "Wildcard certificates cover all subdomains (*.yourdomain.in)",
  "Force HTTPS redirect is enabled by default for all active domains",
]

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getHealthDotColor(health: string): string {
  switch (health) {
    case "healthy":
      return "bg-emerald-500"
    case "degraded":
      return "bg-amber-500"
    case "unknown":
      return "bg-slate-300"
    default:
      return "bg-slate-300"
  }
}

function getHealthLabel(health: string): string {
  switch (health) {
    case "healthy":
      return "Healthy"
    case "degraded":
      return "Degraded"
    case "unknown":
      return "Unknown"
    default:
      return health
  }
}

function getDeploymentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    WEBSITE: "Website",
    ADMIN_DASHBOARD: "Admin Dashboard",
    CUSTOMER_APP: "Customer App",
    DELIVERY_APP: "Delivery App",
    ADMIN_APP: "Admin App",
  }
  return map[type] || type
}

function getHostingProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    replit: "Replit",
    vercel: "Vercel",
    aws: "AWS",
    digitalocean: "DigitalOcean",
  }
  return map[provider] || provider
}

function getDomainTimeline(domainId: string) {
  return mockDomainTimelines[domainId] || defaultTimeline
}

function getDeploymentLogs(deploymentId: string) {
  return mockDeploymentLogs[deploymentId] || defaultDeploymentLogs
}

function getVersionHistory(deploymentId: string) {
  return mockVersionHistory[deploymentId] || [
    { version: "2.1.3", deployedAt: "2025-01-10", status: "current" },
  ]
}

function getLogLevelColor(level: string): string {
  switch (level) {
    case "info":
      return "text-sky-600"
    case "warn":
      return "text-amber-600"
    case "error":
      return "text-red-600"
    default:
      return "text-muted-foreground"
  }
}

// ---------------------------------------------------------------------------
// DNS Provider filter options
// ---------------------------------------------------------------------------

const domainStatusOptions: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING_DNS", label: "Pending DNS" },
  { value: "DNS_PROPAGATING", label: "DNS Propagating" },
  { value: "SSL_PENDING", label: "SSL Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "ERROR", label: "Error" },
]

const dnsProviderOptions: { value: string; label: string }[] = [
  { value: "ALL", label: "All Providers" },
  { value: "Cloudflare", label: "Cloudflare" },
  { value: "GoDaddy", label: "GoDaddy" },
  { value: "Route53", label: "Route53" },
]

const deploymentStatusOptions: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "BUILDING", label: "Building" },
  { value: "DEPLOYING", label: "Deploying" },
  { value: "LIVE", label: "Live" },
  { value: "FAILED", label: "Failed" },
  { value: "MAINTENANCE", label: "Maintenance" },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DomainsView() {
  const { searchQuery } = useAdminStore()

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState("domains")

  // ---- Domain filter state ----
  const [domainStatusFilter, setDomainStatusFilter] = useState("ALL")
  const [dnsProviderFilter, setDnsProviderFilter] = useState("ALL")
  const [domainSearch, setDomainSearch] = useState("")

  // ---- Deployment filter state ----
  const [deployStatusFilter, setDeployStatusFilter] = useState("ALL")
  const [deploySearch, setDeploySearch] = useState("")

  // ---- Domain detail sheet ----
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | null>(null)
  const [domainDetailOpen, setDomainDetailOpen] = useState(false)

  // ---- Deployment detail sheet ----
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentRecord | null>(null)
  const [deploymentDetailOpen, setDeploymentDetailOpen] = useState(false)

  // ---- Add domain dialog ----
  const [addDomainOpen, setAddDomainOpen] = useState(false)
  const [formBusiness, setFormBusiness] = useState("")
  const [formDomain, setFormDomain] = useState("")
  const [formSubdomain, setFormSubdomain] = useState("")
  const [formDnsProvider, setFormDnsProvider] = useState("")
  const [formIsPrimary, setFormIsPrimary] = useState(false)

  // ---- Copy feedback ----
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Computed stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const totalDomains = domains.length
    const activeWithSSL = domains.filter((d) => d.status === "ACTIVE" && d.sslStatus === "active").length
    const pendingDNS = domains.filter((d) => d.status === "PENDING_DNS" || d.status === "DNS_PROPAGATING").length
    const liveDeployments = deployments.filter((d) => d.status === "LIVE").length
    const failedDeployments = deployments.filter((d) => d.status === "FAILED").length
    return { totalDomains, activeWithSSL, pendingDNS, liveDeployments, failedDeployments }
  }, [])

  // ---------------------------------------------------------------------------
  // Filtered domains
  // ---------------------------------------------------------------------------

  const effectiveDomainSearch = searchQuery || domainSearch

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      const matchSearch =
        !effectiveDomainSearch ||
        d.businessName.toLowerCase().includes(effectiveDomainSearch.toLowerCase()) ||
        d.domain.toLowerCase().includes(effectiveDomainSearch.toLowerCase()) ||
        d.dnsProvider.toLowerCase().includes(effectiveDomainSearch.toLowerCase())

      const matchStatus = domainStatusFilter === "ALL" || d.status === domainStatusFilter
      const matchProvider = dnsProviderFilter === "ALL" || d.dnsProvider === dnsProviderFilter

      return matchSearch && matchStatus && matchProvider
    })
  }, [effectiveDomainSearch, domainStatusFilter, dnsProviderFilter])

  // ---------------------------------------------------------------------------
  // Filtered deployments
  // ---------------------------------------------------------------------------

  const effectiveDeploySearch = searchQuery || deploySearch

  const filteredDeployments = useMemo(() => {
    return deployments.filter((d) => {
      const matchSearch =
        !effectiveDeploySearch ||
        d.businessName.toLowerCase().includes(effectiveDeploySearch.toLowerCase()) ||
        d.type.toLowerCase().includes(effectiveDeploySearch.toLowerCase()) ||
        d.hostingProvider.toLowerCase().includes(effectiveDeploySearch.toLowerCase())

      const matchStatus = deployStatusFilter === "ALL" || d.status === deployStatusFilter

      return matchSearch && matchStatus
    })
  }, [effectiveDeploySearch, deployStatusFilter])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const resetAddDomainForm = useCallback(() => {
    setFormBusiness("")
    setFormDomain("")
    setFormSubdomain("")
    setFormDnsProvider("")
    setFormIsPrimary(false)
  }, [])

  const handleDomainRowClick = useCallback((domain: DomainRecord) => {
    setSelectedDomain(domain)
    setDomainDetailOpen(true)
  }, [])

  const handleDeploymentRowClick = useCallback((deployment: DeploymentRecord) => {
    setSelectedDeployment(deployment)
    setDeploymentDetailOpen(true)
  }, [])

  const handleCopyToClipboard = useCallback(async (text: string, recordKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedRecord(recordKey)
      setTimeout(() => setCopiedRecord(null), 2000)
    } catch {
      // fallback: do nothing
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render: SSL Status Icon
  // ---------------------------------------------------------------------------

  function renderSSLStatus(sslStatus: string) {
    if (sslStatus === "active") {
      return (
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">Active</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-700">Pending</span>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Health Status Dot
  // ---------------------------------------------------------------------------

  function renderHealthStatus(health: string) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${getHealthDotColor(health)}`} />
        <span className="text-xs font-medium">{getHealthLabel(health)}</span>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Domain Detail Sheet
  // ---------------------------------------------------------------------------

  function renderDomainSheet() {
    if (!selectedDomain) return null

    const timeline = getDomainTimeline(selectedDomain.id)

    return (
      <Sheet
        open={domainDetailOpen}
        onOpenChange={(open) => {
          setDomainDetailOpen(open)
          if (!open) setSelectedDomain(null)
        }}
      >
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <SheetTitle className="text-lg">{selectedDomain.domain}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  {selectedDomain.businessName}
                  {selectedDomain.isPrimary && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-0">
                      PRIMARY
                    </Badge>
                  )}
                  <StatusBadge status={selectedDomain.status} />
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-6 p-6">
              {/* Domain Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Domain Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Domain</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {selectedDomain.domain}
                      <a
                        href={`https://${selectedDomain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">DNS Provider</p>
                    <p className="text-sm font-medium">{selectedDomain.dnsProvider}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Primary</p>
                    <p className="text-sm font-medium">{selectedDomain.isPrimary ? "Yes" : "No"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Business</p>
                    <p className="text-sm font-medium">{selectedDomain.businessName}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SSL Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  SSL Details
                </h4>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">SSL Status</span>
                    {renderSSLStatus(selectedDomain.sslStatus)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Certificate Type</span>
                    <span className="text-sm font-medium">Let&apos;s Encrypt</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auto-Renewal</span>
                    <Badge variant="secondary" className="text-[10px] border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      ENABLED
                    </Badge>
                  </div>
                  {selectedDomain.sslStatus !== "active" && (
                    <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry SSL Issuance
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* DNS Configuration Instructions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DNS Configuration
                </h4>
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add the following DNS records at your provider ({selectedDomain.dnsProvider}):
                  </p>
                  <div className="space-y-2">
                    {/* CNAME Record */}
                    <div className="flex items-center justify-between rounded-md bg-muted/50 p-2.5">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] h-5 w-12 justify-center font-mono">
                          CNAME
                        </Badge>
                        <div>
                          <p className="text-xs font-medium">www &rarr; cname.quantixplatform.in</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          handleCopyToClipboard("cname.quantixplatform.in", `cname-${selectedDomain.id}`)
                        }
                      >
                        {copiedRecord === `cname-${selectedDomain.id}` ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {/* A Record */}
                    <div className="flex items-center justify-between rounded-md bg-muted/50 p-2.5">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] h-5 w-12 justify-center font-mono">
                          A
                        </Badge>
                        <div>
                          <p className="text-xs font-medium">@ &rarr; 34.131.45.67</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          handleCopyToClipboard("34.131.45.67", `a-${selectedDomain.id}`)
                        }
                      >
                        {copiedRecord === `a-${selectedDomain.id}` ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Status Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status Timeline
                </h4>
                <div className="space-y-0">
                  {timeline.map((entry, i) => (
                    <div key={i} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-3 w-3 rounded-full shrink-0 ${
                            entry.status === "completed"
                              ? "bg-emerald-500"
                              : entry.status === "current"
                              ? "bg-amber-500 ring-4 ring-amber-100"
                              : "bg-slate-200"
                          }`}
                        />
                        {i < timeline.length - 1 && (
                          <div
                            className={`w-0.5 flex-1 mt-1 ${
                              entry.status === "completed" ? "bg-emerald-200" : "bg-slate-100"
                            }`}
                          />
                        )}
                      </div>
                      <div className="pb-1">
                        <p
                          className={`text-sm font-medium ${
                            entry.status === "pending"
                              ? "text-muted-foreground"
                              : entry.status === "current"
                              ? "text-amber-700"
                              : "text-foreground"
                          }`}
                        >
                          {entry.step}
                        </p>
                        {entry.timestamp && (
                          <p className="text-[10px] text-muted-foreground">{entry.timestamp}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh DNS
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Renew SSL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Verify DNS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove Domain
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Deployment Detail Sheet
  // ---------------------------------------------------------------------------

  function renderDeploymentSheet() {
    if (!selectedDeployment) return null

    const logs = getDeploymentLogs(selectedDeployment.id)
    const versions = getVersionHistory(selectedDeployment.id)

    return (
      <Sheet
        open={deploymentDetailOpen}
        onOpenChange={(open) => {
          setDeploymentDetailOpen(open)
          if (!open) setSelectedDeployment(null)
        }}
      >
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <SheetTitle className="text-lg">
                  {getDeploymentTypeLabel(selectedDeployment.type)}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  {selectedDeployment.businessName}
                  <StatusBadge status={selectedDeployment.status} />
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-6 p-6">
              {/* Deployment Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deployment Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Type</p>
                    <p className="text-sm font-medium">{getDeploymentTypeLabel(selectedDeployment.type)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Hosting</p>
                    <p className="text-sm font-medium">{getHostingProviderLabel(selectedDeployment.hostingProvider)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Version</p>
                    <p className="text-sm font-medium">{selectedDeployment.version}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground">Health</p>
                    {renderHealthStatus(selectedDeployment.healthStatus)}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Version History */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Version History
                </h4>
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div
                      key={v.version}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium font-mono">v{v.version}</span>
                        {v.status === "current" && (
                          <Badge variant="secondary" className="text-[10px] border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            CURRENT
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{v.deployedAt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Health Metrics */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Health Metrics
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="shadow-none">
                    <CardContent className="p-3 text-center">
                      <Activity className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-lg font-bold">
                        {selectedDeployment.healthStatus === "healthy"
                          ? "99.9%"
                          : selectedDeployment.healthStatus === "degraded"
                          ? "94.2%"
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Uptime</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-3 text-center">
                      <RefreshCw className="h-4 w-4 text-sky-600 mx-auto mb-1" />
                      <p className="text-lg font-bold">
                        {selectedDeployment.healthStatus === "healthy"
                          ? "120ms"
                          : selectedDeployment.healthStatus === "degraded"
                          ? "2800ms"
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Response</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-3 text-center">
                      <Server className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                      <p className="text-lg font-bold">
                        {selectedDeployment.healthStatus === "unknown" ? "—" : "2/2"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Instances</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Deployment Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Logs
                </h4>
                <div className="rounded-lg border bg-slate-950 p-3 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                      <span className={`shrink-0 uppercase w-12 ${getLogLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Redeploy
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Rollback
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Activity className="h-3.5 w-3.5" />
                    Health Check
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Live
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Domains Tab
  // ---------------------------------------------------------------------------

  function renderDomainsTab() {
    return (
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              className="pl-8 h-9"
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
            />
          </div>

          <Select value={domainStatusFilter} onValueChange={setDomainStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {domainStatusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dnsProviderFilter} onValueChange={setDnsProviderFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="DNS Provider" />
            </SelectTrigger>
            <SelectContent>
              {dnsProviderOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(domainStatusFilter !== "ALL" || dnsProviderFilter !== "ALL" || domainSearch) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDomainStatusFilter("ALL")
                setDnsProviderFilter("ALL")
                setDomainSearch("")
              }}
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Domain table */}
        {filteredDomains.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium">No domains found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your filters or add a new domain
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>SSL Status</TableHead>
                      <TableHead>DNS Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDomains.map((domain) => (
                      <TableRow
                        key={domain.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleDomainRowClick(domain)}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{domain.businessName}</div>
                          <div className="text-[10px] text-muted-foreground">{domain.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{domain.domain}</span>
                            {domain.isPrimary && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-0 font-medium">
                                PRIMARY
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderSSLStatus(domain.sslStatus)}</TableCell>
                        <TableCell>
                          <span className="text-sm">{domain.dnsProvider}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={domain.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleDomainRowClick(domain)}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Deployments Tab
  // ---------------------------------------------------------------------------

  function renderDeploymentsTab() {
    return (
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deployments..."
              className="pl-8 h-9"
              value={deploySearch}
              onChange={(e) => setDeploySearch(e.target.value)}
            />
          </div>

          <Select value={deployStatusFilter} onValueChange={setDeployStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {deploymentStatusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(deployStatusFilter !== "ALL" || deploySearch) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeployStatusFilter("ALL")
                setDeploySearch("")
              }}
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Deployment table */}
        {filteredDeployments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium">No deployments found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hosting</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeployments.map((deployment) => (
                      <TableRow
                        key={deployment.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleDeploymentRowClick(deployment)}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{deployment.businessName}</div>
                          <div className="text-[10px] text-muted-foreground">{deployment.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5 font-medium">
                            {getDeploymentTypeLabel(deployment.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getHostingProviderLabel(deployment.hostingProvider)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{deployment.version}</span>
                        </TableCell>
                        <TableCell>{renderHealthStatus(deployment.healthStatus)}</TableCell>
                        <TableCell>
                          <StatusBadge status={deployment.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleDeploymentRowClick(deployment)}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: DNS Instructions Tab
  // ---------------------------------------------------------------------------

  function renderDNSInstructionsTab() {
    return (
      <div className="space-y-6">
        {/* DNS Setup by Provider */}
        {dnsInstructions.map((provider) => (
          <Card key={provider.provider}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">{provider.icon}</span>
                {provider.provider} Setup
              </CardTitle>
              <CardDescription>
                Follow these steps to configure DNS at {provider.provider}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Steps */}
              <div className="space-y-2">
                {provider.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* DNS Records */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Required DNS Records
                </p>
                {provider.records.map((record) => {
                  const recordKey = `${provider.provider}-${record.type}-${record.name}`
                  return (
                    <div
                      key={recordKey}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] h-6 w-14 justify-center font-mono shrink-0">
                          {record.type}
                        </Badge>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium">
                            <span className="text-muted-foreground">Name:</span> {record.name}
                          </p>
                          <p className="text-xs font-medium">
                            <span className="text-muted-foreground">Value:</span> {record.value}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs shrink-0"
                        onClick={() => handleCopyToClipboard(record.value, recordKey)}
                      >
                        {copiedRecord === recordKey ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* SSL Certificate Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-emerald-600" />
              SSL Certificate Instructions
            </CardTitle>
            <CardDescription>
              SSL certificates are automatically managed once DNS is configured correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sslInstructions.map((instruction, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{instruction}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Page Header                                                        */}
      {/* ================================================================== */}
      <PageHeader
        title="Domains & Deployment"
        description="Manage custom domains, SSL certificates, DNS configuration, and deployments"
        icon={Globe}
        action={
          <Dialog
            open={addDomainOpen}
            onOpenChange={(open) => {
              setAddDomainOpen(open)
              if (!open) resetAddDomainForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
                <DialogDescription>
                  Configure a custom domain for a business on the Quantix platform
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Business Select */}
                <div className="space-y-2">
                  <Label>Business</Label>
                  <Select value={formBusiness} onValueChange={setFormBusiness}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((biz) => (
                        <SelectItem key={biz.id} value={biz.id}>
                          {biz.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Domain Name + Subdomain */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Domain Name</Label>
                    <Input
                      placeholder="e.g. freshmart.in"
                      value={formDomain}
                      onChange={(e) => setFormDomain(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subdomain</Label>
                    <Input
                      placeholder="e.g. www or order"
                      value={formSubdomain}
                      onChange={(e) => setFormSubdomain(e.target.value)}
                    />
                  </div>
                </div>

                {/* DNS Provider */}
                <div className="space-y-2">
                  <Label>DNS Provider</Label>
                  <Select value={formDnsProvider} onValueChange={setFormDnsProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cloudflare">Cloudflare</SelectItem>
                      <SelectItem value="GoDaddy">GoDaddy</SelectItem>
                      <SelectItem value="Route53">Route53 (AWS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Is Primary */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Primary Domain</Label>
                    <p className="text-xs text-muted-foreground">
                      Set this as the primary domain for the business
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>

                {/* Info notice */}
                <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-sky-800">
                    <p className="font-medium">DNS Configuration Required</p>
                    <p className="mt-0.5">
                      After adding a domain, you will need to configure DNS records at your provider.
                      DNS propagation may take up to 48 hours. SSL certificates are auto-issued once DNS resolves.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddDomainOpen(false)
                    resetAddDomainForm()
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => setAddDomainOpen(false)}>Add Domain</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ================================================================== */}
      {/* Summary Stat Cards                                                 */}
      {/* ================================================================== */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Domains"
          value={stats.totalDomains}
          change="All businesses"
          changeType="neutral"
          icon={Globe}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Active (with SSL)"
          value={stats.activeWithSSL}
          change={`${stats.totalDomains - stats.activeWithSSL} pending`}
          changeType={stats.activeWithSSL === stats.totalDomains ? "positive" : "neutral"}
          icon={Shield}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Pending DNS"
          value={stats.pendingDNS}
          change="Awaiting configuration"
          changeType={stats.pendingDNS > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Live Deployments"
          value={stats.liveDeployments}
          change={`${deployments.length} total`}
          changeType="positive"
          icon={Server}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Failed Deployments"
          value={stats.failedDeployments}
          change={stats.failedDeployments === 0 ? "All healthy" : "Needs attention"}
          changeType={stats.failedDeployments > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* ================================================================== */}
      {/* Tabs: Domains | Deployments | DNS Instructions                     */}
      {/* ================================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="domains" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="deployments" className="gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="dns-instructions" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            DNS Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="domains">{renderDomainsTab()}</TabsContent>
        <TabsContent value="deployments">{renderDeploymentsTab()}</TabsContent>
        <TabsContent value="dns-instructions">{renderDNSInstructionsTab()}</TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/* Detail Sheets                                                      */}
      {/* ================================================================== */}
      {renderDomainSheet()}
      {renderDeploymentSheet()}
    </div>
  )
}
