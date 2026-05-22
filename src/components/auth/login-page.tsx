"use client";

import React, { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type ViewMode } from "@/stores/admin-store";
import { setBusinessContext } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
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
    async (e: React.SyntheticEvent) => {
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
    <div className="dark min-h-screen flex items-center justify-center bg-[#020B3D] p-4 relative overflow-hidden">
      {/* Background depth layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#020B3D] via-[#0e1a55] to-[#020B3D]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#155BDB]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#25B8F5]/8 blur-[100px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <img src="/api/assets/logo" alt="Quantix Technology" style={{ height: "70px", filter: "brightness(0) invert(1)" }} className="object-contain" />
          </div>
          <p className="text-xs text-[#25B8F5]/70 mt-1 font-medium tracking-widest uppercase">
            Enterprise Business Management
          </p>
        </div>

        {/* Glassmorphism login card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Sign In</h2>
            <p className="text-sm text-white/40 mt-0.5">
              Enter your credentials to access the platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Email or Username
              </Label>
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
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#155BDB] focus-visible:ring-[#155BDB]/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs text-[#25B8F5]/70 hover:text-[#25B8F5] font-medium transition-colors"
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
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:border-[#155BDB] focus-visible:ring-[#155BDB]/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#155BDB] hover:bg-[#155BDB]/90 text-white font-semibold shadow-lg shadow-[#155BDB]/30 border-0 transition-all"
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
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} Quantix Technology &middot;{" "}
            <span className="text-[#25B8F5]/50">www.quantixtechnology.in</span>
          </p>
          <p className="text-[10px] text-white/10 mt-1">
            Access is restricted to authorized users only.
          </p>
        </div>
      </div>
    </div>
  );
}
