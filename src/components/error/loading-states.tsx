"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================================
// PAGE SKELETON — Full page loading state
// ============================================================================

interface PageSkeletonProps {
  /** Number of sections to show */
  sections?: number;
  /** Whether to show a header */
  showHeader?: boolean;
  /** Whether to show tabs */
  showTabs?: boolean;
}

export function PageSkeleton({ sections = 3, showHeader = true, showTabs = false }: PageSkeletonProps) {
  return (
    <div className="space-y-6 p-6">
      {showHeader && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      )}

      {showTabs && (
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// CARD SKELETON — Card loading state
// ============================================================================

interface CardSkeletonProps {
  /** Number of cards to show */
  count?: number;
  /** Whether to show an image placeholder */
  showImage?: boolean;
  /** Number of content lines */
  lines?: number;
}

export function CardSkeleton({ count = 1, showImage = false, lines = 3 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          {showImage && <Skeleton className="h-40 w-full rounded-t-lg" />}
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            {Array.from({ length: lines }).map((_, j) => (
              <Skeleton key={j} className={`h-4 ${j === lines - 1 ? "w-1/2" : "w-full"}`} />
            ))}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ============================================================================
// TABLE SKELETON — Table loading state
// ============================================================================

interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Whether to show a search bar */
  showSearch?: boolean;
  /** Whether to show pagination */
  showPagination?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showSearch = true,
  showPagination = true,
}: TableSkeletonProps) {
  return (
    <div className="space-y-4">
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
                  className={`h-4 flex-1 ${j === 0 ? "w-1/4" : ""}`}
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
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LIST SKELETON — List loading state
// ============================================================================

interface ListSkeletonProps {
  /** Number of items */
  count?: number;
  /** Whether items have avatars */
  showAvatar?: boolean;
  /** Whether items have actions */
  showAction?: boolean;
}

export function ListSkeleton({ count = 5, showAvatar = true, showAction = true }: ListSkeletonProps) {
  return (
    <div className="space-y-3">
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
// DETAIL SKELETON — Detail page loading state
// ============================================================================

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex gap-2 items-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
