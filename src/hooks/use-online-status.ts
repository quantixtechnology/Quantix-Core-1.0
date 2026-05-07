"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { showWarning, showSuccess } from "@/lib/toast-utils";

// ============================================================================
// ONLINE STATUS HOOK
// ============================================================================

interface UseOnlineStatusOptions {
  /** Whether to show toast notifications on status change (default: true) */
  showToast?: boolean;
  /** Custom message when going offline */
  offlineMessage?: string;
  /** Custom message when coming back online */
  onlineMessage?: string;
}

interface UseOnlineStatusReturn {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the browser is currently offline */
  isOffline: boolean;
  /** Manually check online status */
  checkOnline: () => boolean;
  /** Timestamp of last status change */
  lastChangedAt: Date | null;
}

/**
 * Hook that detects online/offline status and optionally shows toasts
 *
 * @example
 * ```tsx
 * const { isOnline, isOffline } = useOnlineStatus();
 *
 * if (isOffline) {
 *   return <NetworkErrorFallback />;
 * }
 * ```
 */
export function useOnlineStatus(options: UseOnlineStatusOptions = {}): UseOnlineStatusReturn {
  const {
    showToast = true,
    offlineMessage = "You're offline. Some features may be unavailable.",
    onlineMessage = "You're back online!",
  } = options;

  // Initialize from navigator.onOnline if available (SSR-safe)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  const toastShownRef = useRef(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastChangedAt(new Date());

    if (showToast && toastShownRef.current) {
      showSuccess("Back Online", onlineMessage);
      toastShownRef.current = false;
    }
  }, [showToast, onlineMessage]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastChangedAt(new Date());

    if (showToast) {
      showWarning("You're Offline", offlineMessage);
      toastShownRef.current = true;
    }
  }, [showToast, offlineMessage]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Sync initial state via event-style callback (avoids synchronous setState in effect)
    const syncInitialState = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Use microtask to avoid synchronous setState lint rule
    queueMicrotask(syncInitialState);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const checkOnline = useCallback((): boolean => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    checkOnline,
    lastChangedAt,
  };
}

// ============================================================================
// OFFLINE-AWARE FETCH UTILITY
// ============================================================================

/**
 * Wrap an async function to skip execution when offline
 *
 * @example
 * ```tsx
 * const fetchOrders = useOfflineAwareCallback(async () => {
 *   const data = await orderApi.list();
 *   return data;
 * }, "fetch orders");
 * ```
 */
export function useOfflineAwareCallback<T extends (...args: never[]) => Promise<unknown>>(
  callback: T,
  actionName: string = "this action"
): T {
  const { isOffline } = useOnlineStatus({ showToast: false });

  return useCallback(
    async (...args: Parameters<T>) => {
      if (isOffline) {
        showWarning(
          "You're Offline",
          `Cannot ${actionName} while offline. Please check your connection.`
        );
        return undefined;
      }
      return callback(...args);
    },
    [isOffline, callback, actionName]
  ) as T;
}
