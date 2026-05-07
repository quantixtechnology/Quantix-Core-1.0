"use client";

// ============================================================================
// Quantix Core — Notification Bell Component
// Bell icon with unread count badge, dropdown with recent notifications,
// mark as read on click, mark all as read, View All link, real-time badge
// via WebSocket (useNotificationUpdates), sonner toast for new alerts
// ============================================================================

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Package,
  Truck,
  CreditCard,
  Megaphone,
  RefreshCw,
  Settings,
  AlertCircle,
  X,
} from "lucide-react";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-api";
import { useNotificationUpdates } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { getRelativeTime } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  data: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  /** User ID for real-time notification updates */
  userId?: string;
  /** Business ID for filtering notifications */
  businessId?: string;
  /** Callback when "View All" is clicked (e.g., navigate to notification center) */
  onViewAll?: () => void;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

// ============================================================================
// Notification type icon mapping
// ============================================================================

function getNotificationIcon(type: string) {
  switch (type) {
    case "ORDER_STATUS":
      return Package;
    case "DELIVERY_UPDATE":
      return Truck;
    case "PAYMENT":
      return CreditCard;
    case "PROMOTION":
      return Megaphone;
    case "SUBSCRIPTION":
      return RefreshCw;
    case "SYSTEM":
      return AlertCircle;
    default:
      return Bell;
  }
}

function getNotificationIconColor(type: string) {
  switch (type) {
    case "ORDER_STATUS":
      return "text-blue-600 bg-blue-50";
    case "DELIVERY_UPDATE":
      return "text-orange-600 bg-orange-50";
    case "PAYMENT":
      return "text-emerald-600 bg-emerald-50";
    case "PROMOTION":
      return "text-purple-600 bg-purple-50";
    case "SUBSCRIPTION":
      return "text-cyan-600 bg-cyan-50";
    case "SYSTEM":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

// ============================================================================
// Component
// ============================================================================

export function NotificationBell({
  userId,
  businessId,
  onViewAll,
  compact = false,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const prevUnreadCountRef = useRef(0);

  // Fetch notifications from API
  const { data: notificationsData, isLoading } = useNotifications(
    businessId
      ? {
          businessId,
          limit: 20,
          isRead: "false",
        }
      : { limit: 20 }
  );

  // Mark as read mutation
  const markReadMutation = useMarkNotificationRead();

  // Real-time WebSocket notification updates
  const { unreadCount: wsUnreadCount, latestNotification } =
    useNotificationUpdates(userId || "");

  // Parse notifications from API response
  const notifications: NotificationItem[] = useMemo(() => {
    if (!notificationsData) return [];
    const data = notificationsData as {
      data?: NotificationItem[];
      unreadCount?: number;
    };
    return Array.isArray(data) ? data : data.data || [];
  }, [notificationsData]);

  // Compute unread count: prefer WebSocket count if available, else API count
  const apiUnreadCount = useMemo(() => {
    if (!notificationsData) return 0;
    const data = notificationsData as { unreadCount?: number };
    return data.unreadCount ?? notifications.filter((n) => !n.isRead).length;
  }, [notificationsData, notifications]);

  const unreadCount = wsUnreadCount > 0 ? wsUnreadCount : apiUnreadCount;

  // Show sonner toast when a new real-time notification arrives
  useEffect(() => {
    if (latestNotification && latestNotification.title) {
      // Only toast if the count actually increased (new notification)
      if (wsUnreadCount > prevUnreadCountRef.current) {
        toast(latestNotification.title, {
          description: latestNotification.message,
          duration: 5000,
        });
      }
    }
    prevUnreadCountRef.current = wsUnreadCount;
  }, [latestNotification, wsUnreadCount]);

  // Mark single notification as read
  const handleMarkAsRead = useCallback(
    (notificationId: string) => {
      markReadMutation.mutate(notificationId);
    },
    [markReadMutation]
  );

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!businessId) return;
    try {
      const response = await fetch(
        `/api/core/notifications?businessId=${businessId}&isRead=false&limit=50`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await response.json();
      const unreadItems = (data.data || []) as NotificationItem[];
      // Mark each as read
      for (const n of unreadItems) {
        await fetch(`/api/core/notifications/${n.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
      }
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  }, [businessId]);

  // Display badge count
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "icon"}
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className={compact ? "h-4 w-4" : "h-4 w-4"} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
              {displayCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-96 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-[20px] text-[10px] px-1.5"
              >
                {displayCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 px-2"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading...
              </span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm font-medium">No new notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const iconColorClass = getNotificationIconColor(
                  notification.type
                );
                return (
                  <div
                    key={notification.id}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notification.isRead
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "opacity-75"
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p
                        className={`text-sm leading-tight truncate ${
                          !notification.isRead ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {getRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1.5 text-primary hover:text-primary"
            onClick={() => {
              setIsOpen(false);
              onViewAll?.();
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View All Notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
