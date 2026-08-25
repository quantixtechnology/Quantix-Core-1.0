"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { ErrorFallback, type ErrorFallbackVariant } from "./error-fallback";
import { logError } from "@/lib/error-handler";

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = "admin" | "business" | "customer" | "delivery";

interface ErrorBoundaryProps {
  /** Children to render */
  children: ReactNode;
  /** Fallback variant style */
  variant?: ErrorFallbackVariant;
  /** Custom fallback component — overrides variant */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when user clicks retry */
  onReset?: () => void;
  /** View mode for context-specific fallback UIs */
  view?: ViewMode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Store error info for display
    this.setState({ errorInfo });

    // Log with context using our centralized error handler
    logError(error, {
      context: "ErrorBoundary",
      componentStack: errorInfo.componentStack,
      view: this.props.view,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use view-specific fallback if view is specified
      if (this.props.view) {
        return (
          <ViewSpecificFallback
            view={this.props.view}
            error={this.state.error}
            onRetry={this.handleRetry}
            componentStack={this.state.errorInfo?.componentStack}
          />
        );
      }

      return (
        <ErrorFallback
          variant={this.props.variant || "page"}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// VIEW-SPECIFIC FALLBACK COMPONENTS
// ============================================================================

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  Package,
  Truck,
  ShoppingBag,
  Settings,
} from "lucide-react";

interface ViewSpecificFallbackProps {
  view: ViewMode;
  error: Error;
  onRetry: () => void;
  componentStack?: string | null;
}

function ViewSpecificFallback({ view, error, onRetry, componentStack }: ViewSpecificFallbackProps) {
  switch (view) {
    case "admin":
      return <AdminErrorFallback error={error} onRetry={onRetry} />;
    case "business":
      return <BusinessErrorFallback error={error} onRetry={onRetry} componentStack={componentStack} />;
    case "customer":
      return <CustomerErrorFallback error={error} onRetry={onRetry} />;
    case "delivery":
      return <DeliveryErrorFallback error={error} onRetry={onRetry} />;
    default:
      return (
        <ErrorFallback
          variant="page"
          error={error}
          onRetry={onRetry}
        />
      );
  }
}

/** Admin panel error fallback — technical, action-oriented */
function AdminErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <Settings className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel Error</h2>
          <p className="text-muted-foreground">
            Something went wrong in the admin panel. This may affect platform operations.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload Panel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Refresh Page
          </Button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <details className="text-left mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              Error Details (Dev Only)
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/** Business owner error fallback — operational focus.
 *
 *  It used to show ONLY the reassurance, with the error nowhere on screen and
 *  no detail even in development. That made every occurrence a blind hunt: the
 *  message says "loading your business data", which reads like a failed
 *  request, when what it actually means is that something threw while
 *  rendering. The cause is now on screen and copyable, so the next one is
 *  diagnosable in seconds instead of by elimination. */
function BusinessErrorFallback({ error, onRetry, componentStack }: { error: Error; onRetry: () => void; componentStack?: string | null }) {
  const details = [
    `Error: ${error?.message || "Unknown error"}`,
    error?.stack ? `\nStack:\n${error.stack}` : "",
    componentStack ? `\nComponent stack:${componentStack}` : "",
    typeof window !== "undefined" ? `\nURL: ${window.location.href}` : "",
  ].join("");

  return (
    <Card className="border-amber-200 dark:border-amber-900/50 max-w-lg mx-auto mt-8">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
          <Package className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This screen failed to render. Your orders and operations are not affected.
          </p>
        </div>

        {/* The actual cause — shown to the operator, not hidden behind NODE_ENV.
            This is an internal business application; the person looking at it is
            the person who needs to report it. */}
        <div className="w-full text-left rounded-lg border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 break-words">
            {error?.message || "Unknown error"}
          </p>
          {componentStack && (
            <pre className="mt-2 max-h-32 overflow-auto text-[10px] leading-relaxed text-amber-900/70 dark:text-amber-200/60">
              {componentStack.trim().split("\n").slice(0, 6).join("\n")}
            </pre>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={onRetry} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => { void navigator.clipboard?.writeText(details).catch(() => {}) }}
          >
            Copy details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Customer app error fallback — friendly, minimal */
function CustomerErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
        <ShoppingBag className="h-10 w-10 text-orange-500 dark:text-orange-400" />
      </div>
      <h2 className="mt-4 text-xl font-bold">Oops! Something broke</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
        We hit a snag. Don&apos;t worry, your cart and orders are safe!
      </p>
      <Button onClick={onRetry} variant="default" className="mt-4 gap-2">
        <RefreshCw className="h-4 w-4" />
        Let&apos;s Try Again
      </Button>
    </div>
  );
}

/** Delivery partner error fallback — action-oriented */
function DeliveryErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/20">
        <Truck className="h-10 w-10 text-teal-600 dark:text-teal-400" />
      </div>
      <h2 className="mt-4 text-xl font-bold">Error Loading Deliveries</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
        Couldn&apos;t load your delivery information. Your active deliveries are still being tracked.
      </p>
      <Button onClick={onRetry} variant="default" className="mt-4 gap-2">
        <RefreshCw className="h-4 w-4" />
        Reload
      </Button>
    </div>
  );
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Page-level error boundary — for wrapping entire page components
 */
export function PageErrorBoundary({
  children,
  onError,
  view,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  view?: ViewMode;
}) {
  return (
    <ErrorBoundary variant="page" onError={onError} view={view}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Card-level error boundary — for wrapping card/section components
 */
export function CardErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary variant="card" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Inline error boundary — for wrapping small UI sections
 */
export function InlineErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary variant="inline" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Admin-specific error boundary
 */
export function AdminErrorBoundary({ children, onError }: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
  return (
    <ErrorBoundary variant="page" view="admin" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Business-specific error boundary
 */
export function BusinessErrorBoundary({ children, onError }: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
  return (
    <ErrorBoundary variant="page" view="business" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Customer-specific error boundary
 */
export function CustomerErrorBoundary({ children, onError }: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
  return (
    <ErrorBoundary variant="page" view="customer" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Delivery-specific error boundary
 */
export function DeliveryErrorBoundary({ children, onError }: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
  return (
    <ErrorBoundary variant="page" view="delivery" onError={onError}>
      {children}
    </ErrorBoundary>
  );
}
