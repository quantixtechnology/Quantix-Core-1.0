"use client";

// ============================================================================
// Quantix Core — Enhanced Notification Center
// Real-time feed, filters by type/channel, preferences, quick actions,
// unread badge, sound option, desktop notification permission
// ============================================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatCard } from "@/components/admin/shared/stat-card";
import {
  notificationItems,
  defaultPreferences,
  eventTypeConfig,
  channelConfig,
  type NotificationItem,
  type NotificationPreference,
  type NotificationEventType,
  type NotificationChannel,
} from "./notification-data";
import {
  Bell, BellOff, Mail, MessageSquare, Smartphone, Monitor,
  Check, CheckCheck, Trash2, Filter, X, Plus, Clock, Search,
  AlertTriangle, Volume2, VolumeX, ExternalLink, Settings,
  ChevronDown, Eye, Send, RefreshCw,
} from "lucide-react";
import { getRelativeTime } from "@/lib/utils";

// ============================================================================
// Channel icon helper
// ============================================================================

function getChannelIcon(channel: NotificationChannel) {
  switch (channel) {
    case "PUSH": return Smartphone;
    case "EMAIL": return Mail;
    case "WHATSAPP": return MessageSquare;
    case "IN_APP": return Bell;
  }
}

// ============================================================================
// Component
// ============================================================================

export function NotificationCenter() {
  // ---- State ----
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationItems);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreference[]>(defaultPreferences);
  const [activeTab, setActiveTab] = useState<string>("feed");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [desktopNotifRequested, setDesktopNotifRequested] = useState(false);
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState(false);

  // ---- Unread count ----
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = unreadCount;
    const push = notifications.filter((n) => n.channel === "PUSH").length;
    const email = notifications.filter((n) => n.channel === "EMAIL").length;
    const whatsapp = notifications.filter((n) => n.channel === "WHATSAPP").length;
    const inApp = notifications.filter((n) => n.channel === "IN_APP").length;
    const high = notifications.filter((n) => n.priority === "HIGH" && !n.isRead).length;
    return { total, unread, push, email, whatsapp, inApp, high };
  }, [notifications, unreadCount]);

  // ---- Filtered notifications ----
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (channelFilter !== "all" && n.channel !== channelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !n.title.toLowerCase().includes(q) &&
          !n.message.toLowerCase().includes(q) &&
          !n.recipientName.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [notifications, typeFilter, channelFilter, searchQuery]);

  // ---- Handlers ----
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePreference = useCallback((eventType: NotificationEventType, channel: NotificationChannel) => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.eventType === eventType && p.channel === channel
          ? { ...p, enabled: !p.enabled }
          : p
      )
    );
  }, []);

  // ---- Desktop notification permission ----
  const requestDesktopPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setDesktopNotifEnabled(permission === "granted");
    setDesktopNotifRequested(true);
  }, []);

  // ---- Clear filters ----
  const clearFilters = useCallback(() => {
    setTypeFilter("all");
    setChannelFilter("all");
    setSearchQuery("");
  }, []);

  const hasActiveFilters = typeFilter !== "all" || channelFilter !== "all" || searchQuery.trim() !== "";

  // ============================================================================
  // Render: Notification item
  // ============================================================================
  const renderNotificationItem = (n: NotificationItem) => {
    const typeConf = eventTypeConfig[n.type];
    const channelConf = channelConfig[n.channel];
    const ChannelIcon = getChannelIcon(n.channel);

    return (
      <div
        key={n.id}
        className={`relative flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 ${
          !n.isRead ? "border-l-4 border-l-primary bg-primary/5" : "opacity-80"
        }`}
      >
        {/* Type emoji */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeConf.bgColor}`}>
          <span className="text-base">{typeConf.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold leading-tight truncate">{n.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {n.priority === "HIGH" && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
              <Badge
                variant="secondary"
                className={`text-[9px] border-0 font-medium ${channelConf.bgColor} ${channelConf.color}`}
              >
                <ChannelIcon className="w-2.5 h-2.5 mr-0.5" />
                {channelConf.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{typeConf.label}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {getRelativeTime(n.createdAt)}
              </span>
              <span>·</span>
              <span>{n.recipientName}</span>
            </div>

            <div className="flex items-center gap-0.5">
              {n.isActionable && n.actionLabel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-primary hover:text-primary"
                  onClick={() => markAsRead(n.id)}
                >
                  {n.actionLabel}
                  <ExternalLink className="w-2.5 h-2.5 ml-1" />
                </Button>
              )}
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => markAsRead(n.id)}
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteNotification(n.id)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render: Preferences tab
  // ============================================================================
  const renderPreferences = () => (
    <div className="space-y-4">
      {/* Sound & Desktop notifications */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              Sound Notifications
            </Label>
            <p className="text-xs text-muted-foreground">Play sound when new notification arrives</p>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Desktop Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              {desktopNotifEnabled
                ? "Enabled — you'll receive desktop notifications"
                : desktopNotifRequested
                  ? "Permission denied — check browser settings"
                  : "Request permission to show desktop alerts"}
            </p>
          </div>
          {!desktopNotifEnabled ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={requestDesktopPermission}>
              Enable
            </Button>
          ) : (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">Enabled</Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Per-event, per-channel preference matrix */}
      <div>
        <h3 className="text-sm font-medium mb-3">Notification Preferences by Event Type</h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Event Type</TableHead>
                <TableHead className="text-center w-[80px]">Push</TableHead>
                <TableHead className="text-center w-[80px]">Email</TableHead>
                <TableHead className="text-center w-[80px]">WhatsApp</TableHead>
                <TableHead className="text-center w-[80px]">In-App</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(eventTypeConfig).map(([type, config]) => (
                <TableRow key={type}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                  </TableCell>
                  {(["PUSH", "EMAIL", "WHATSAPP", "IN_APP"] as NotificationChannel[]).map((channel) => {
                    const pref = preferences.find(
                      (p) => p.eventType === type && p.channel === channel
                    );
                    return (
                      <TableCell key={channel} className="text-center">
                        <Switch
                          checked={pref?.enabled ?? true}
                          onCheckedChange={() =>
                            togglePreference(type as NotificationEventType, channel)
                          }
                          className="scale-75"
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Manage real-time notifications across all channels"
        icon={Bell}
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                {unreadCount} unread
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Unread"
          value={stats.unread}
          change={`${stats.high} high priority`}
          changeType={stats.high > 0 ? "negative" : "neutral"}
          icon={Bell}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Push"
          value={stats.push}
          icon={Smartphone}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Email"
          value={stats.email}
          icon={Mail}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="WhatsApp"
          value={stats.whatsapp}
          icon={MessageSquare}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2 lg:w-[240px]">
                <TabsTrigger value="feed" className="gap-1.5 text-xs">
                  <Bell className="w-3.5 h-3.5" />
                  Feed
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 min-w-[18px] px-1 text-[9px]">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1.5 text-xs">
                  <Settings className="w-3.5 h-3.5" />
                  Preferences
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Feed Tab */}
            <TabsContent value="feed" className="mt-0 p-6 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notifications..."
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(eventTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {Object.entries(channelConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
                    <X className="w-3 h-3" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Notification List */}
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <BellOff className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-3 text-sm font-medium">No notifications found</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px] overflow-y-auto">
                  <div className="space-y-2 pr-3">
                    {filteredNotifications.map(renderNotificationItem)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="mt-0 p-6">
              {renderPreferences()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
