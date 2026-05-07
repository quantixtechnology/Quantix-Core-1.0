"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Send,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  X,
  Plus,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Channel = "EMAIL" | "WHATSAPP" | "PUSH" | "IN_APP"
type NotificationStatus = "SENT" | "DELIVERED" | "FAILED"
type Priority = "LOW" | "NORMAL" | "HIGH"
type RecipientType = "ALL_BUSINESSES" | "SPECIFIC_BUSINESS" | "SALES_TEAM"

interface Notification {
  id: string
  channel: Channel
  title: string
  description: string
  recipient: string
  recipientType: RecipientType
  status: NotificationStatus
  priority: Priority
  isRead: boolean
  timestamp: Date
}

interface NotificationTemplate {
  id: string
  name: string
  description: string
  channel: Channel
  titleTemplate: string
  messageTemplate: string
}

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

const channelConfig: Record<Channel, { icon: typeof Mail; label: string; color: string; bgColor: string; borderColor: string }> = {
  EMAIL: { icon: Mail, label: "Email", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-400" },
  WHATSAPP: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-400" },
  PUSH: { icon: Smartphone, label: "Push", color: "text-violet-600", bgColor: "bg-violet-50", borderColor: "border-violet-400" },
  IN_APP: { icon: Bell, label: "In-App", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-400" },
}

const statusConfig: Record<NotificationStatus, { label: string; color: string; bgColor: string }> = {
  SENT: { label: "Sent", color: "text-sky-700", bgColor: "bg-sky-100" },
  DELIVERED: { label: "Delivered", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  FAILED: { label: "Failed", color: "text-red-700", bgColor: "bg-red-100" },
}

const priorityConfig: Record<Priority, { label: string; color: string; bgColor: string; icon: typeof Info }> = {
  LOW: { label: "Low", color: "text-slate-600", bgColor: "bg-slate-100", icon: Info },
  NORMAL: { label: "Normal", color: "text-sky-600", bgColor: "bg-sky-50", icon: Clock },
  HIGH: { label: "High", color: "text-amber-600", bgColor: "bg-amber-50", icon: AlertTriangle },
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const now = new Date()

function hoursAgo(h: number): Date {
  return new Date(now.getTime() - h * 60 * 60 * 1000)
}

function daysAgo(d: number): Date {
  return new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
}

const mockNotifications: Notification[] = [
  {
    id: "notif_001",
    channel: "EMAIL",
    title: "Payment received from FreshMart Grocers",
    description: "Monthly subscription payment of ₹4,999 has been successfully processed for FreshMart Grocers.",
    recipient: "FreshMart Grocers",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: false,
    timestamp: hoursAgo(2),
  },
  {
    id: "notif_002",
    channel: "WHATSAPP",
    title: "Subscription expiring for ShopNow Express",
    description: "ShopNow Express subscription expires in 3 days. Renewal reminder sent via WhatsApp.",
    recipient: "ShopNow Express",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "HIGH",
    isRead: false,
    timestamp: hoursAgo(3),
  },
  {
    id: "notif_003",
    channel: "PUSH",
    title: "Deployment complete for MedQuick Pharmacy",
    description: "MedQuick Pharmacy deployment has been successfully completed. All services are running.",
    recipient: "MedQuick Pharmacy",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: hoursAgo(5),
  },
  {
    id: "notif_004",
    channel: "IN_APP",
    title: "New lead assigned to Priya Sharma",
    description: "A new lead from Meta Ads has been auto-assigned to Priya Sharma for follow-up.",
    recipient: "Sales Team",
    recipientType: "SALES_TEAM",
    status: "SENT",
    priority: "NORMAL",
    isRead: false,
    timestamp: hoursAgo(1),
  },
  {
    id: "notif_005",
    channel: "EMAIL",
    title: "Platform maintenance scheduled",
    description: "Scheduled maintenance window on March 8, 2025 from 2:00 AM to 4:00 AM IST.",
    recipient: "All Businesses",
    recipientType: "ALL_BUSINESSES",
    status: "DELIVERED",
    priority: "HIGH",
    isRead: true,
    timestamp: hoursAgo(8),
  },
  {
    id: "notif_006",
    channel: "WHATSAPP",
    title: "Payment received from QuickBite Restaurants",
    description: "Quarterly payment of ₹14,997 received from QuickBite Restaurants for Pro plan.",
    recipient: "QuickBite Restaurants",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: hoursAgo(10),
  },
  {
    id: "notif_007",
    channel: "PUSH",
    title: "Failed delivery for GreenLeaf Organics",
    description: "Push notification delivery failed for GreenLeaf Organics. Device token may be expired.",
    recipient: "GreenLeaf Organics",
    recipientType: "SPECIFIC_BUSINESS",
    status: "FAILED",
    priority: "HIGH",
    isRead: false,
    timestamp: hoursAgo(12),
  },
  {
    id: "notif_008",
    channel: "IN_APP",
    title: "Subscription renewed for UrbanBrew Coffee",
    description: "UrbanBrew Coffee has renewed their Pro subscription for another year.",
    recipient: "UrbanBrew Coffee",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "LOW",
    isRead: true,
    timestamp: daysAgo(1),
  },
  {
    id: "notif_009",
    channel: "EMAIL",
    title: "New feature: Advanced Analytics Dashboard",
    description: "Introducing the new Advanced Analytics Dashboard available for all Pro plan subscribers.",
    recipient: "All Businesses",
    recipientType: "ALL_BUSINESSES",
    status: "SENT",
    priority: "NORMAL",
    isRead: false,
    timestamp: daysAgo(1),
  },
  {
    id: "notif_010",
    channel: "WHATSAPP",
    title: "Subscription expiring for StyleHub Fashion",
    description: "StyleHub Fashion Starter plan expires in 5 days. Send renewal reminder.",
    recipient: "StyleHub Fashion",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "HIGH",
    isRead: false,
    timestamp: daysAgo(1),
  },
  {
    id: "notif_011",
    channel: "PUSH",
    title: "Order spike alert for FreshMart Grocers",
    description: "FreshMart Grocers is experiencing 300% above average order volume in the last hour.",
    recipient: "FreshMart Grocers",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "HIGH",
    isRead: false,
    timestamp: hoursAgo(4),
  },
  {
    id: "notif_012",
    channel: "EMAIL",
    title: "Invoice generated for TechMart Electronics",
    description: "Monthly invoice INV-2025-045 has been generated for TechMart Electronics.",
    recipient: "TechMart Electronics",
    recipientType: "SPECIFIC_BUSINESS",
    status: "FAILED",
    priority: "HIGH",
    isRead: false,
    timestamp: hoursAgo(6),
  },
  {
    id: "notif_013",
    channel: "IN_APP",
    title: "Sales target achieved",
    description: "The sales team has achieved 92% of the quarterly target. Great work everyone!",
    recipient: "Sales Team",
    recipientType: "SALES_TEAM",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: daysAgo(2),
  },
  {
    id: "notif_014",
    channel: "WHATSAPP",
    title: "Onboarding completed for PetPals Store",
    description: "PetPals Store has completed their onboarding checklist and is now live on the platform.",
    recipient: "PetPals Store",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: daysAgo(2),
  },
  {
    id: "notif_015",
    channel: "PUSH",
    title: "Deployment complete for BookNest Library",
    description: "BookNest Library deployment finished. Custom domain is now active.",
    recipient: "BookNest Library",
    recipientType: "SPECIFIC_BUSINESS",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: daysAgo(2),
  },
  {
    id: "notif_016",
    channel: "EMAIL",
    title: "Weekly performance digest",
    description: "Your weekly platform performance digest is ready. Revenue is up 12% compared to last week.",
    recipient: "All Businesses",
    recipientType: "ALL_BUSINESSES",
    status: "SENT",
    priority: "LOW",
    isRead: true,
    timestamp: daysAgo(3),
  },
  {
    id: "notif_017",
    channel: "IN_APP",
    title: "Payment overdue for HomeEssentials Mart",
    description: "HomeEssentials Mart has an overdue payment of ₹4,999. Consider sending a follow-up.",
    recipient: "HomeEssentials Mart",
    recipientType: "SPECIFIC_BUSINESS",
    status: "SENT",
    priority: "HIGH",
    isRead: false,
    timestamp: hoursAgo(7),
  },
  {
    id: "notif_018",
    channel: "WHATSAPP",
    title: "New lead assigned to Rahul Verma",
    description: "A new lead from Google Ads has been assigned to Rahul Verma for demo scheduling.",
    recipient: "Sales Team",
    recipientType: "SALES_TEAM",
    status: "DELIVERED",
    priority: "NORMAL",
    isRead: true,
    timestamp: daysAgo(3),
  },
]

const notificationTemplates: NotificationTemplate[] = [
  {
    id: "tpl_001",
    name: "New Lead Assigned",
    description: "Notify the sales team when a new lead is assigned",
    channel: "WHATSAPP",
    titleTemplate: "New Lead Assigned: {{businessName}}",
    messageTemplate: "A new lead from {{source}} has been assigned to {{salesRep}}. Business: {{businessName}}, Contact: {{contactName}}. Please follow up within 24 hours.",
  },
  {
    id: "tpl_002",
    name: "Payment Received",
    description: "Confirm payment receipt to the business",
    channel: "EMAIL",
    titleTemplate: "Payment Received - {{amount}}",
    messageTemplate: "We have received your payment of {{amount}} for the {{planName}} plan. Your subscription is now active until {{nextBillingDate}}. Thank you for your continued partnership!",
  },
  {
    id: "tpl_003",
    name: "Subscription Expiring",
    description: "Remind businesses about upcoming subscription expiry",
    channel: "WHATSAPP",
    titleTemplate: "Subscription Expiring in {{daysLeft}} Days",
    messageTemplate: "Hi {{businessName}}, your {{planName}} subscription expires in {{daysLeft}} days. Renew now to avoid service interruption. Visit your dashboard or contact support for assistance.",
  },
  {
    id: "tpl_004",
    name: "Deployment Complete",
    description: "Notify business when their deployment is ready",
    channel: "PUSH",
    titleTemplate: "Deployment Complete - {{businessName}}",
    messageTemplate: "Great news! Your platform deployment is complete. {{businessName}} is now live and accessible at {{domainUrl}}. All modules have been configured and tested successfully.",
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsView() {
  const { searchQuery } = useAdminStore()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

  // Send notification dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendChannel, setSendChannel] = useState<Channel>("EMAIL")
  const [sendRecipientType, setSendRecipientType] = useState<RecipientType>("ALL_BUSINESSES")
  const [sendTitle, setSendTitle] = useState("")
  const [sendMessage, setSendMessage] = useState("")
  const [sendPriority, setSendPriority] = useState<Priority>("NORMAL")
  const [sendScheduled, setSendScheduled] = useState(false)

  // Templates collapsible
  const [templatesOpen, setTemplatesOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Computed stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = notifications.length
    const email = notifications.filter((n) => n.channel === "EMAIL").length
    const whatsapp = notifications.filter((n) => n.channel === "WHATSAPP").length
    const push = notifications.filter((n) => n.channel === "PUSH").length
    const inApp = notifications.filter((n) => n.channel === "IN_APP").length
    const unread = notifications.filter((n) => !n.isRead).length
    const delivered = notifications.filter((n) => n.status === "DELIVERED").length
    const failed = notifications.filter((n) => n.status === "FAILED").length

    return { total, email, whatsapp, push, inApp, unread, delivered, failed }
  }, [notifications])

  // ---------------------------------------------------------------------------
  // Filtered notifications
  // ---------------------------------------------------------------------------

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab filter
      if (activeTab !== "all" && n.channel !== activeTab) return false

      // Channel filter (additional dropdown)
      if (channelFilter !== "all" && n.channel !== channelFilter) return false

      // Status filter
      if (statusFilter !== "all" && n.status !== statusFilter) return false

      // Date filter
      if (dateFilter !== "all") {
        const diff = now.getTime() - n.timestamp.getTime()
        const hours = diff / 3600000
        if (dateFilter === "today" && hours > 24) return false
        if (dateFilter === "week" && hours > 168) return false
        if (dateFilter === "month" && hours > 720) return false
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.recipient.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      return true
    })
  }, [notifications, activeTab, channelFilter, statusFilter, dateFilter, searchQuery])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleMarkAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  function handleMarkAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  function handleSendNotification() {
    if (!sendTitle.trim() || !sendMessage.trim()) return

    const newNotification: Notification = {
      id: `notif_${Date.now()}`,
      channel: sendChannel,
      title: sendTitle,
      description: sendMessage,
      recipient:
        sendRecipientType === "ALL_BUSINESSES"
          ? "All Businesses"
          : sendRecipientType === "SALES_TEAM"
            ? "Sales Team"
            : "Specific Business",
      recipientType: sendRecipientType,
      status: "SENT",
      priority: sendPriority,
      isRead: false,
      timestamp: sendScheduled ? new Date(now.getTime() + 3600000) : new Date(),
    }

    setNotifications((prev) => [newNotification, ...prev])
    resetSendForm()
    setSendDialogOpen(false)
  }

  function resetSendForm() {
    setSendChannel("EMAIL")
    setSendRecipientType("ALL_BUSINESSES")
    setSendTitle("")
    setSendMessage("")
    setSendPriority("NORMAL")
    setSendScheduled(false)
  }

  function handleUseTemplate(template: NotificationTemplate) {
    setSendChannel(template.channel)
    setSendTitle(template.titleTemplate.replace(/\{\{.*?\}\}/g, ""))
    setSendMessage(template.messageTemplate.replace(/\{\{.*?\}\}/g, ""))
    setSendDialogOpen(true)
  }

  function hasActiveFilters() {
    return channelFilter !== "all" || statusFilter !== "all" || dateFilter !== "all"
  }

  function clearFilters() {
    setChannelFilter("all")
    setStatusFilter("all")
    setDateFilter("all")
  }

  // ---------------------------------------------------------------------------
  // Render notification item
  // ---------------------------------------------------------------------------

  function renderNotificationItem(notification: Notification) {
    const config = channelConfig[notification.channel]
    const ChannelIcon = config.icon
    const status = statusConfig[notification.status]
    const priority = priorityConfig[notification.priority]

    return (
      <div
        key={notification.id}
        className={`relative flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30 ${
          !notification.isRead
            ? "border-l-4 border-l-blue-500 bg-blue-50/30"
            : "opacity-75"
        }`}
      >
        {/* Channel Icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}>
          <ChannelIcon className={`h-5 w-5 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold leading-tight truncate">
                {notification.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {notification.description}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Priority icon */}
              {notification.priority === "HIGH" && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
              {/* Status badge */}
              <Badge
                variant="secondary"
                className={`text-[10px] border-0 font-medium ${status.bgColor} ${status.color} hover:${status.bgColor}`}
              >
                {status.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ChannelIcon className="h-3 w-3" />
                {config.label}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(notification.timestamp)}
              </span>
              <span>To: {notification.recipient}</span>
            </div>

            <div className="flex items-center gap-1">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleMarkAsRead(notification.id)}
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                onClick={() => handleDelete(notification.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Notifications"
        description="Manage and send notifications across all channels"
        icon={Bell}
        action={
          <Button className="gap-2" onClick={() => setSendDialogOpen(true)}>
            <Send className="h-4 w-4" />
            Send Notification
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sent"
          value={stats.total}
          change={`${stats.unread} unread`}
          changeType={stats.unread > 0 ? "negative" : "neutral"}
          icon={Send}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Email"
          value={stats.email}
          change={`${stats.delivered} delivered`}
          changeType="positive"
          icon={Mail}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="WhatsApp"
          value={stats.whatsapp}
          change={`${stats.delivered} delivered`}
          changeType="positive"
          icon={MessageSquare}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Push"
          value={stats.push}
          change={`${stats.failed} failed`}
          changeType={stats.failed > 0 ? "negative" : "neutral"}
          icon={Smartphone}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Notification Center</CardTitle>
            <div className="flex items-center gap-2">
              {stats.unread > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleMarkAllAsRead}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
              <TabsTrigger value="all" className="gap-1.5 text-xs">
                All
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                  {stats.total}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="EMAIL" className="gap-1.5 text-xs">
                <Mail className="h-3 w-3" />
                Email
              </TabsTrigger>
              <TabsTrigger value="WHATSAPP" className="gap-1.5 text-xs">
                <MessageSquare className="h-3 w-3" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="PUSH" className="gap-1.5 text-xs">
                <Smartphone className="h-3 w-3" />
                Push
              </TabsTrigger>
              <TabsTrigger value="IN_APP" className="gap-1.5 text-xs">
                <Bell className="h-3 w-3" />
                In-App
              </TabsTrigger>
            </TabsList>

            {/* All tab content is shared — we use TabsContent for layout consistency */}
            <TabsContent value={activeTab} className="mt-4 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notifications..."
                    className="pl-8 h-9"
                    value={searchQuery}
                    readOnly
                  />
                </div>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="PUSH">Push</SelectItem>
                    <SelectItem value="IN_APP">In-App</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters() && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Notification List */}
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-3 text-sm font-medium">No notifications found</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try adjusting your filters or search query
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-96 overflow-y-auto">
                  <div className="space-y-2 pr-3">
                    {filteredNotifications.map((notification) =>
                      renderNotificationItem(notification)
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Templates Section */}
      <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Notification Templates</CardTitle>
                  <CardDescription className="mt-1">
                    Pre-built templates for common notifications
                  </CardDescription>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    templatesOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {notificationTemplates.map((template) => {
                  const config = channelConfig[template.channel]
                  const TemplateIcon = config.icon

                  return (
                    <div
                      key={template.id}
                      className="rounded-lg border p-4 space-y-3 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor}`}>
                            <TemplateIcon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold">{template.name}</h4>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${config.color} border-current/20`}>
                          {config.label}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
                        <div className="text-xs">
                          <span className="font-medium text-muted-foreground">Subject: </span>
                          <span className="text-foreground">{template.titleTemplate}</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium text-muted-foreground">Body: </span>
                          <span className="text-foreground line-clamp-2">{template.messageTemplate}</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 h-8 text-xs"
                        onClick={() => handleUseTemplate(template)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Use Template
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Send Notification Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => { setSendDialogOpen(open); if (!open) resetSendForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              Compose and send a notification to businesses or team members
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Channel */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={sendChannel} onValueChange={(v) => setSendChannel(v as Channel)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">
                    <span className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-blue-600" />
                      Email
                    </span>
                  </SelectItem>
                  <SelectItem value="WHATSAPP">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                      WhatsApp
                    </span>
                  </SelectItem>
                  <SelectItem value="PUSH">
                    <span className="flex items-center gap-2">
                      <Smartphone className="h-3.5 w-3.5 text-violet-600" />
                      Push
                    </span>
                  </SelectItem>
                  <SelectItem value="IN_APP">
                    <span className="flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-amber-600" />
                      In-App
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Type */}
            <div className="space-y-2">
              <Label>Recipient Type</Label>
              <Select value={sendRecipientType} onValueChange={(v) => setSendRecipientType(v as RecipientType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_BUSINESSES">All Businesses</SelectItem>
                  <SelectItem value="SPECIFIC_BUSINESS">Specific Business</SelectItem>
                  <SelectItem value="SALES_TEAM">Sales Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sendRecipientType === "SPECIFIC_BUSINESS" && (
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input placeholder="e.g. FreshMart Grocers" />
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Notification title"
                value={sendTitle}
                onChange={(e) => setSendTitle(e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your notification message..."
                rows={4}
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={sendPriority} onValueChange={(v) => setSendPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">
                    <span className="flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 text-slate-500" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="NORMAL">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-sky-500" />
                      Normal
                    </span>
                  </SelectItem>
                  <SelectItem value="HIGH">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      High
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Schedule for later</Label>
                <p className="text-xs text-muted-foreground">
                  Send this notification at a scheduled time instead of immediately
                </p>
              </div>
              <Switch checked={sendScheduled} onCheckedChange={setSendScheduled} />
            </div>

            {sendScheduled && (
              <div className="space-y-2">
                <Label>Schedule Time</Label>
                <Input type="datetime-local" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSendDialogOpen(false); resetSendForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSendNotification}
              disabled={!sendTitle.trim() || !sendMessage.trim()}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sendScheduled ? "Schedule" : "Send"} Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
