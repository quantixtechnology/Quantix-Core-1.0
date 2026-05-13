"use client";

// ============================================================================
// Quantix Core — Activity Feed Component
// Shows recent activity log entries with type icons, relative time,
// user name display, compact list format, and pagination.
//
// Props: businessId, limit, userId, filter
// Fetches from /api/core/audit
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  CreditCard,
  ShoppingCart,
  User,
  Truck,
  LogIn,
  RefreshCw,
  Megaphone,
  Settings,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getRelativeTime } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ActivityLogEntry {
  id: string;
  businessId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ActivityFeedProps {
  /** Business ID to fetch logs for */
  businessId?: string;
  /** Max items per page (default 10) */
  limit?: number;
  /** Filter by specific user */
  userId?: string;
  /** Filter by action prefix (e.g., "order.", "payment.") */
  filter?: string;
}

// ============================================================================
// Icon & Color Mapping
// ============================================================================

function getActivityIcon(action: string, entity: string): LucideIcon {
  // Auth actions
  if (action.startsWith("auth.")) return LogIn;
  // Order actions
  if (action.startsWith("order.") || entity === "Order") return Package;
  // Payment actions
  if (action.startsWith("payment.") || entity === "Payment") return CreditCard;
  // POS actions
  if (action.startsWith("pos.") || entity === "POSSession") return ShoppingCart;
  // Delivery actions
  if (action.startsWith("delivery.") || entity === "Delivery") return Truck;
  // Lead actions
  if (action.startsWith("lead.") || entity === "Lead") return Megaphone;
  // Subscription actions
  if (action.startsWith("subscription.") || entity === "BusinessSubscription")
    return RefreshCw;
  // Settings / business
  if (action.startsWith("business.") || entity === "Business") return Settings;
  // User entity fallback
  if (entity === "User") return User;
  // Default
  return Activity;
}

function getActivityColor(action: string, entity: string): string {
  if (action.startsWith("auth.")) return "text-violet-600 bg-violet-50";
  if (action.startsWith("order.") || entity === "Order")
    return "text-blue-600 bg-blue-50";
  if (action.startsWith("payment.") || entity === "Payment")
    return "text-emerald-600 bg-emerald-50";
  if (action.startsWith("pos.") || entity === "POSSession")
    return "text-amber-600 bg-amber-50";
  if (action.startsWith("delivery.") || entity === "Delivery")
    return "text-orange-600 bg-orange-50";
  if (action.startsWith("lead.") || entity === "Lead")
    return "text-pink-600 bg-pink-50";
  if (action.startsWith("subscription.") || entity === "BusinessSubscription")
    return "text-cyan-600 bg-cyan-50";
  if (action.startsWith("business.") || entity === "Business")
    return "text-purple-600 bg-purple-50";
  if (entity === "User") return "text-violet-600 bg-violet-50";
  return "text-gray-600 bg-gray-50";
}

/** Human-readable action label from dot-notation action string */
function formatActionLabel(action: string): string {
  const parts = action.split(".");
  if (parts.length < 2) return action;
  const verb = parts[parts.length - 1];
  // Convert snake_case or camelCase to Title Case
  return verb
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Component
// ============================================================================

export function ActivityFeed({
  businessId,
  limit = 10,
  userId,
  filter,
}: ActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);

  const fetchLogs = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        limit: String(limit),
      });
      if (userId) params.set("userId", userId);
      if (filter) params.set("actionPrefix", filter);

      const response = await fetch(`/api/core/audit?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("quantix_auth_token") || "" : ""}`,
          "x-business-id": businessId,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch activity logs");
      }

      const data = await response.json();
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  }, [businessId, page, limit, userId, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [businessId, userId, filter]);

  // Loading skeleton
  if (isLoading && logs.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className="mt-2 text-sm font-medium text-red-600">
          Failed to load activity
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={fetchLogs}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-2 text-sm font-medium">No activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Actions will appear here as they happen
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ScrollArea className="max-h-96">
        <div className="divide-y">
          {logs.map((log) => {
            const Icon = getActivityIcon(log.action, log.entity);
            const colorClass = getActivityColor(log.action, log.entity);
            const label = formatActionLabel(log.action);
            const userName = log.user?.name || "System";

            return (
              <div
                key={log.id}
                className="flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
                    >
                      {log.entity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    by {userName}
                    {log.details && typeof log.details === "object" && "method" in log.details
                      ? ` via ${(log.details as Record<string, unknown>).method}`
                      : ""}
                  </p>
                </div>

                {/* Time */}
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {getRelativeTime(log.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
