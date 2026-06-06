"use client";

import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Crown,
  Store,
  Truck,
  User,
  Users,
  ShieldCheck,
  HeadphonesIcon,
  Server,
  DollarSign,
  Receipt,
  Package,
  HelpCircle,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { ROLES } from "@/lib/constants";

// ============================================================================
// ROLE ICON MAPPING
// ============================================================================

const roleIcons: Record<Role, React.ElementType> = {
  // Core platform
  QUANTIX_SUPER_ADMIN: Crown,
  PLATFORM_ADMIN: ShieldCheck,
  // Named roles
  SALES_MANAGER: Users,
  BD_EXECUTIVE: Users,
  HR_ADMIN: Users,
  FINANCE_MANAGER: DollarSign,
  OPERATIONS_MANAGER: Server,
  SUPPORT_MANAGER: HeadphonesIcon,
  READ_ONLY_AUDITOR: Shield,
  // Legacy team roles
  QUANTIX_SALES_TEAM: Users,
  SUPPORT_TEAM: HeadphonesIcon,
  DEPLOYMENT_TEAM: Server,
  FINANCE_TEAM: DollarSign,
  // Business roles
  CLIENT_OWNER: Shield,
  STORE_MANAGER: Store,
  STORE_OPERATOR: Store,
  BILLING_STAFF: Receipt,
  INVENTORY_STAFF: Package,
  SUPPORT_STAFF: HelpCircle,
  DELIVERY_STAFF: Truck,
  CUSTOMER: User,
};

const roleColors: Record<Role, string> = {
  // Core platform
  QUANTIX_SUPER_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PLATFORM_ADMIN: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  // Named roles
  SALES_MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  BD_EXECUTIVE: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  HR_ADMIN: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FINANCE_MANAGER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  OPERATIONS_MANAGER: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  SUPPORT_MANAGER: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  READ_ONLY_AUDITOR: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  // Legacy team roles
  QUANTIX_SALES_TEAM: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SUPPORT_TEAM: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  DEPLOYMENT_TEAM: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  FINANCE_TEAM: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  // Business roles
  CLIENT_OWNER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  STORE_MANAGER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  STORE_OPERATOR: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  BILLING_STAFF: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  INVENTORY_STAFF: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  SUPPORT_STAFF: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
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
