"use client";

import React, { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type ViewMode } from "@/stores/admin-store";
import { setBusinessContext } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Zap } from "lucide-react";
import type { Role } from "@/lib/types";

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

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login, isLoading, error, clearError } = useAuthStore();
  const { setViewMode, setCurrentBusinessId } = useAdminStore();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email || !password) return;

      try {
        await login(email, password);

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
        // Error handled by auth store
      }
    },
    [email, password, login, setViewMode, setCurrentBusinessId]
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
            Enterprise Business Management
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
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/50 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email or Username</Label>
                <Input
                  id="email"
                  type="text"
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
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Quantix Technology &middot;{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              www.quantixtechnology.in
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Access is restricted to authorized users only. Contact your administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
