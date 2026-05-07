"use client";

// ============================================================================
// Quantix Technology — Connection Status Badge Component
// Shows real-time WebSocket connection status as a small badge
// Can be placed in headers, toolbars, or any UI location
// ============================================================================

import { cn } from "@/lib/utils";
import { useRealtime, type ConnectionStatus } from "@/hooks/use-realtime";

// ============================================================================
// TYPES
// ============================================================================

interface ConnectionStatusBadgeProps {
  /** Whether to show the status text label (default: true) */
  showLabel?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to use compact mode (dot only, no text) */
  compact?: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STATUS_CONFIG: Record<
  ConnectionStatus,
  {
    color: string;
    bgColor: string;
    dotColor: string;
    label: string;
    pulse: boolean;
  }
> = {
  connected: {
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    dotColor: "bg-emerald-500",
    label: "Live",
    pulse: true,
  },
  reconnecting: {
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
    dotColor: "bg-amber-500",
    label: "Reconnecting",
    pulse: true,
  },
  disconnected: {
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
    dotColor: "bg-red-500",
    label: "Offline",
    pulse: false,
  },
};

const SIZE_CONFIG = {
  sm: {
    dot: "h-1.5 w-1.5",
    text: "text-[10px]",
    padding: "px-1.5 py-0.5",
    gap: "gap-1",
  },
  md: {
    dot: "h-2 w-2",
    text: "text-xs",
    padding: "px-2 py-0.5",
    gap: "gap-1.5",
  },
  lg: {
    dot: "h-2.5 w-2.5",
    text: "text-sm",
    padding: "px-2.5 py-1",
    gap: "gap-2",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ConnectionStatusBadge({
  showLabel = true,
  className,
  size = "md",
  compact = false,
}: ConnectionStatusBadgeProps) {
  const { connectionStatus } = useRealtime({
    autoConnect: true,
    autoInvalidate: false,
  });

  const config = STATUS_CONFIG[connectionStatus];
  const sizeConfig = SIZE_CONFIG[size];

  if (compact || !showLabel) {
    return (
      <span
        className={cn("relative inline-flex", className)}
        title={config.label}
        role="status"
        aria-label={`Connection status: ${config.label}`}
      >
        <span
          className={cn(
            "rounded-full",
            sizeConfig.dot,
            config.dotColor,
            config.pulse && "animate-pulse"
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeConfig.padding,
        sizeConfig.gap,
        sizeConfig.text,
        config.color,
        config.bgColor,
        className
      )}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      <span className="relative inline-flex">
        <span
          className={cn(
            "rounded-full",
            sizeConfig.dot,
            config.dotColor,
            config.pulse && "animate-pulse"
          )}
        />
      </span>
      <span>{config.label}</span>
    </span>
  );
}

// ============================================================================
// MINI DOT VARIANT — For tight spaces like headers
// ============================================================================

interface ConnectionDotProps {
  className?: string;
}

export function ConnectionDot({ className }: ConnectionDotProps) {
  const { connectionStatus } = useRealtime({
    autoConnect: true,
    autoInvalidate: false,
  });

  const config = STATUS_CONFIG[connectionStatus];

  return (
    <span
      className={cn("relative inline-flex h-2 w-2", className)}
      title={`WebSocket: ${config.label}`}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-75",
          config.dotColor,
          config.pulse && "animate-ping"
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          config.dotColor
        )}
      />
    </span>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConnectionStatusBadge;
