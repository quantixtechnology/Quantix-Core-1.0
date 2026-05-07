"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Inbox,
  Package,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// SPINNER LOADERS
// ============================================================================

interface LoaderProps {
  className?: string;
  message?: string;
}

/**
 * Full page spinner with optional message
 */
export function PageLoader({ className, message = "Loading..." }: LoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[500px] p-6", className)}>
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Section-level spinner
 */
export function SectionLoader({ className, message }: LoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

/**
 * Small inline spinner
 */
export function InlineLoader({ className, message }: LoaderProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </span>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

/**
 * Dashboard-style skeleton card
 */
export function SkeletonCard({ count = 4, className }: SkeletonCardProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
  showSearch?: boolean;
  showPagination?: boolean;
}

/**
 * Table skeleton for data tables
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
  showSearch = true,
  showPagination = true,
}: SkeletonTableProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {showSearch && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        {/* Header */}
        <div className="border-b bg-muted/50 p-4">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b p-4 last:border-0">
            <div className="flex gap-4 items-center">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton
                  key={j}
                  className={cn("h-4 flex-1", j === 0 && "w-1/4")}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  className?: string;
  showAvatar?: boolean;
  showAction?: boolean;
}

/**
 * List skeleton for list views
 */
export function SkeletonList({
  count = 5,
  className,
  showAvatar = true,
  showAction = true,
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {showAction && <Skeleton className="h-8 w-20 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty state with icon, title, description, and optional action button
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  icon?: React.ElementType;
}

/**
 * Error state with retry button
 */
export function ErrorState({
  title = "Something went wrong",
  description = "An error occurred while loading this content. Please try again.",
  onRetry,
  className,
  icon: Icon = AlertTriangle,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <Icon className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
        {description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
