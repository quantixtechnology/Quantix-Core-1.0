"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  WifiOff,
  ShieldAlert,
  Search,
  RefreshCw,
  FileQuestion,
  Server,
} from "lucide-react";
import { AppError, getErrorTitle, getErrorAction } from "@/lib/error-handler";

// ============================================================================
// TYPES
// ============================================================================

export type ErrorFallbackVariant = "page" | "card" | "inline";

interface ErrorFallbackProps {
  /** The error that occurred */
  error: Error | AppError;
  /** Callback to retry the failed action */
  onRetry?: () => void;
  /** Variant style */
  variant?: ErrorFallbackVariant;
  /** Optional title override */
  title?: string;
  /** Optional description override */
  description?: string;
}

// ============================================================================
// ERROR ICON COMPONENT — Resolves icon outside of render
// ============================================================================

function ErrorIcon({ error, className }: { error: Error | AppError; className?: string }) {
  if (error instanceof AppError) {
    switch (error.type) {
      case "NETWORK":
        return <WifiOff className={className} />;
      case "AUTH":
        return <ShieldAlert className={className} />;
      case "NOT_FOUND":
        return <Search className={className} />;
      case "SERVER":
        return <Server className={className} />;
      case "RATE_LIMIT":
        return <AlertTriangle className={className} />;
      case "PAYMENT":
        return <AlertTriangle className={className} />;
      case "VALIDATION":
        return <AlertTriangle className={className} />;
      case "BUSINESS":
        return <AlertTriangle className={className} />;
      default:
        return <AlertTriangle className={className} />;
    }
  }
  return <AlertTriangle className={className} />;
}

// ============================================================================
// PAGE-LEVEL ERROR FALLBACK
// ============================================================================

function PageErrorFallback({ error, onRetry, title, description }: ErrorFallbackProps) {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);
  const errorTitle = title || getErrorTitle(appError.type);
  const errorDescription = description || getErrorAction(appError.type);

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ErrorIcon error={error} className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">{errorTitle}</h2>
          <p className="text-muted-foreground">{errorDescription}</p>
        </div>

        {appError.type !== "AUTH" && onRetry && (
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}

        {process.env.NODE_ENV === "development" && (
          <details className="text-left mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              Error Details (Dev Only)
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {error.message}
              {appError.data != null && "\n" + JSON.stringify(appError.data as Record<string, unknown>, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CARD-LEVEL ERROR FALLBACK
// ============================================================================

function CardErrorFallback({ error, onRetry, title, description }: ErrorFallbackProps) {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);
  const errorTitle = title || getErrorTitle(appError.type);
  const errorDescription = description || getErrorAction(appError.type);

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ErrorIcon error={error} className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-medium">{errorTitle}</p>
          <p className="text-sm text-muted-foreground mt-1">{errorDescription}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INLINE ERROR FALLBACK
// ============================================================================

function InlineErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const appError = error instanceof AppError ? error : AppError.fromApiError(error);

  return (
    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{error.message || appError.message}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="h-auto p-0 text-red-600 dark:text-red-400 underline">
          Retry
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// SPECIALIZED ERROR FALLBACKS
// ============================================================================

/**
 * Network error fallback — connection lost
 */
export function NetworkErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
          <WifiOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold">Connection Lost</h3>
        <p className="text-sm text-muted-foreground">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Unauthorized error fallback — session expired
 */
export function UnauthorizedErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold">Session Expired</h3>
        <p className="text-sm text-muted-foreground">
          Your session has expired. Please log in again to continue.
        </p>
        <Button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/?view=auth";
            }
          }}
          className="gap-2"
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
}

/**
 * Not found error fallback
 */
export function NotFoundErrorFallback({ entity = "Resource" }: { entity?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <FileQuestion className="h-8 w-8 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold">{entity} Not Found</h3>
        <p className="text-sm text-muted-foreground">
          The {entity.toLowerCase()} you&apos;re looking for may have been moved or deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.history.back();
            }
          }}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}

/**
 * Loading error fallback — failed to load data
 */
export function LoadingErrorFallback({ onRetry, entity = "data" }: { onRetry?: () => void; entity?: string }) {
  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-medium">Failed to Load {entity}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Something went wrong while loading this data.
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN EXPORT — ROUTED BY VARIANT
// ============================================================================

export function ErrorFallback(props: ErrorFallbackProps) {
  const variant = props.variant || "page";

  switch (variant) {
    case "page":
      return <PageErrorFallback {...props} />;
    case "card":
      return <CardErrorFallback {...props} />;
    case "inline":
      return <InlineErrorFallback {...props} />;
    default:
      return <PageErrorFallback {...props} />;
  }
}
