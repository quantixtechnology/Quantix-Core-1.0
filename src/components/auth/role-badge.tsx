"use client";

import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Crown,
  Store,
  Truck,
  User,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { ROLES } from "@/lib/constants";

// ============================================================================
// ROLE ICON MAPPING
// ============================================================================

const roleIcons: Record<Role, React.ElementType> = {
  QUANTIX_SUPER_ADMIN: Crown,
  QUANTIX_SALES_TEAM: Users,
  CLIENT_OWNER: Shield,
  STORE_MANAGER: Store,
  DELIVERY_STAFF: Truck,
  CUSTOMER: User,
};

const roleColors: Record<Role, string> = {
  QUANTIX_SUPER_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  QUANTIX_SALES_TEAM: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  CLIENT_OWNER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  STORE_MANAGER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  DELIVERY_STAFF: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  CUSTOMER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

// ============================================================================
// ROLE BADGE COMPONENT
// ============================================================================

interface RoleBadgeProps {
  /** The role to display */
  role: Role;
  /** Optional additional class names */
  className?: string;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Size variant */
  size?: "sm" | "md";
}

export function RoleBadge({
  role,
  className = "",
  showIcon = true,
  size = "sm",
}: RoleBadgeProps) {
  const Icon = roleIcons[role];
  const label = ROLES[role]?.label || role;
  const colorClasses = roleColors[role];

  const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

  return (
    <Badge
      variant="outline"
      className={`${colorClasses} ${sizeClasses} ${className} gap-1 font-medium border-0`}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}
