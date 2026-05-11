"use client";

import React, { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type ViewMode } from "@/stores/admin-store";
import { setBusinessContext } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  LogIn,
  ChevronDown,
  Shield,
  Store,
  Truck,
  Users,
  Crown,
  Zap,
} from "lucide-react";
import type { Role } from "@/lib/types";

// ============================================================================
// DEMO CREDENTIALS
// ============================================================================

interface DemoCredential {
  email: string;
  password: string;
  role: Role;
  label: string;
  description: string;
  icon: React.ElementType;
  viewMode: ViewMode;
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    email: "superadmin@quantixtechnology.in",
    password: "Admin@123",
    role: "QUANTIX_SUPER_ADMIN",
    label: "Super Admin",
    description: "Full platform control",
    icon: Crown,
    viewMode: "super_admin",
  },
  {
    email: "priya.sales@quantixtechnology.in",
    password: "Sales@123",
    role: "QUANTIX_SALES_TEAM",
    label: "Sales Team",
    description: "Lead & demo management",
    icon: Users,
    viewMode: "super_admin",
  },
  {
    email: "owner@freshmart-grocery.in",
    password: "Owner@123",
    role: "CLIENT_OWNER",
    label: "Business Owner",
    description: "FreshMart Grocery",
    icon: Shield,
    viewMode: "business_owner",
  },
  {
    email: "manager@freshmart-grocery.in",
    password: "Staff@123",
    role: "STORE_MANAGER",
    label: "Store Manager",
    description: "FreshMart Grocery",
    icon: Store,
    viewMode: "business_owner",
  },
];

// ============================================================================
// ROLE → VIEW MODE MAPPING
// ============================================================================

function getViewModeForRole(role: Role): ViewMode {
  switch (role) {
    case "QUANTIX_SUPER_ADMIN":
    case "QUANTIX_SALES_TEAM":
      return "super_admin";
    case "CLIENT_OWNER":
    case "STORE_MANAGER":
      return "business_owner";
    case "CUSTOMER":
      return "customer";
    case "DELIVERY_STAFF":
      return "delivery_partner";
    default:
      return "super_admin";
  }
}

// ============================================================================
// LOGIN PAGE COMPONENT
// ============================================================================

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, isLoading, error, clearError } = useAuthStore();
  const { setViewMode, setCurrentBusinessId } = useAdminStore();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;

      try {
        await login(email, password);

        // After successful login, set the correct viewMode based on role
        const authState = useAuthStore.getState();
        if (authState.user) {
          const viewMode = getViewModeForRole(authState.user.role as Role);
          setViewMode(viewMode);

          // Set business context if user has a business
          if (authState.currentBusinessId) {
            setCurrentBusinessId(authState.currentBusinessId);
            setBusinessContext(authState.currentBusinessId);
          }
        }
      } catch {
        // Error is handled by the auth store
      }
    },
    [email, password, login, setViewMode, setCurrentBusinessId]
  );

  const handleDemoLogin = useCallback(
    async (cred: DemoCredential) => {
      setEmail(cred.email);
      setPassword(cred.password);

      try {
        await login(cred.email, cred.password);

        const authState = useAuthStore.getState();
        if (authState.user) {
          const viewMode = getViewModeForRole(authState.user.role as Role);
          setViewMode(viewMode);

          if (authState.currentBusinessId) {
            setCurrentBusinessId(authState.currentBusinessId);
            setBusinessContext(authState.currentBusinessId);
          }
        }
      } catch {
        // Error is handled by the auth store
      }
    },
    [login, setViewMode, setCurrentBusinessId]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-50/30 dark:bg-emerald-900/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/25 mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Quantix Core Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run Your Business Smarter
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/20">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-center">Sign In</h2>
            <p className="text-sm text-muted-foreground text-center">
              Enter your credentials to access the platform
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Display */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/50 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) clearError();
                  }}
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 px-3 text-xs text-muted-foreground">
                Demo Accounts
              </span>
            </div>

            {/* Demo Credentials - Collapsible */}
            <Collapsible open={showDemo} onOpenChange={setShowDemo}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  size="sm"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Show Demo Credentials
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showDemo ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {DEMO_CREDENTIALS.map((cred) => {
                    const Icon = cred.icon;
                    return (
                      <button
                        key={cred.email}
                        type="button"
                        onClick={() => handleDemoLogin(cred)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/50 transition-colors">
                          <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {cred.label}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            >
                              {cred.viewMode === "super_admin"
                                ? "Platform"
                                : cred.viewMode === "business_owner"
                                  ? "Business"
                                  : cred.viewMode === "customer"
                                    ? "Customer"
                                    : "Delivery"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {cred.description}
                          </p>
                        </div>
                        <LogIn className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Quantix Technology &middot;{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              www.quantixtechnology.in
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
