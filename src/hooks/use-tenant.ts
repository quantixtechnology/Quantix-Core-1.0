"use client";

// ============================================================================
// Quantix Technology — Tenant Context Hook
// Resolves current tenant from URL hostname or subdomain
// Falls back to default business context from localStorage
// Caches resolution to avoid repeated API calls
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

interface TenantBranding {
  businessId: string;
  businessName: string;
  businessType: string;
  slug: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  darkMode: boolean;
  tagline: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  website: string | null;
  status: string;
  domain: string | null;
  subdomain: string | null;
}

interface UseTenantReturn {
  /** The resolved business ID */
  businessId: string | null;
  /** The resolved business name */
  businessName: string | null;
  /** The resolved business type (e.g., GROCERY, FOOD_DELIVERY) */
  businessType: string | null;
  /** Primary brand color */
  primaryColor: string | null;
  /** Business logo URL */
  logo: string | null;
  /** Whether the tenant is currently being resolved */
  isLoading: boolean;
  /** Error message if resolution failed */
  error: string | null;
  /** Full branding object */
  branding: TenantBranding | null;
  /** Manually re-resolve the tenant */
  refetch: () => void;
  /** Whether a custom domain was resolved (not platform default) */
  isCustomDomain: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TENANT_CACHE_KEY = "quantix_tenant_cache";
const TENANT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Platform domains that should NOT trigger tenant resolution
const PLATFORM_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "quantixtechnology.in",
  "www.quantixtechnology.in",
  "app.quantixtechnology.in",
  "admin.quantixtechnology.in",
];

// ============================================================================
// Cache helpers
// ============================================================================

interface CachedTenant {
  hostname: string;
  branding: TenantBranding;
  timestamp: number;
}

function getCachedTenant(hostname: string): TenantBranding | null {
  try {
    const cached = localStorage.getItem(TENANT_CACHE_KEY);
    if (!cached) return null;
    const parsed: CachedTenant = JSON.parse(cached);
    if (parsed.hostname !== hostname) return null;
    if (Date.now() - parsed.timestamp > TENANT_CACHE_TTL) {
      localStorage.removeItem(TENANT_CACHE_KEY);
      return null;
    }
    return parsed.branding;
  } catch {
    return null;
  }
}

function setCachedTenant(hostname: string, branding: TenantBranding): void {
  try {
    const cached: CachedTenant = {
      hostname,
      branding,
      timestamp: Date.now(),
    };
    localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Hostname extraction
// ============================================================================

function extractHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

function extractSubdomain(): string | null {
  const hostname = extractHostname();
  if (!hostname) return null;

  // Check if this is a subdomain of quantixtechnology.in
  if (hostname.endsWith(".quantixtechnology.in")) {
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] !== "www") {
      return parts[0];
    }
  }

  return null;
}

function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.some(
    (pd) =>
      hostname === pd ||
      hostname === `www.${pd}` ||
      hostname.startsWith(`${pd}:`)
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTenant(): UseTenantReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Determine resolution strategy
  const hostname = extractHostname();
  const subdomain = extractSubdomain();
  const isCustom = !isPlatformDomain(hostname);

  // Build query params
  const queryParams = isCustom
    ? `domain=${encodeURIComponent(hostname)}`
    : subdomain
      ? `subdomain=${encodeURIComponent(subdomain)}`
      : `businessId=${encodeURIComponent(
          typeof window !== "undefined"
            ? localStorage.getItem("quantix_business_id") || "biz_1"
            : "biz_1"
        )}`;

  // Check cache first
  const cachedBranding = isCustom ? getCachedTenant(hostname) : null;

  // Fetch tenant from API
  const {
    data: tenantData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tenant", queryParams],
    queryFn: async () => {
      // Return cached data if available
      if (cachedBranding) {
        return { business: cachedBranding, domain: null };
      }

      const response = await fetch(
        `/api/core/tenant/resolve?${queryParams}`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to resolve tenant");
      }

      return data.data as {
        business: TenantBranding;
        domain: {
          domain: string;
          subdomain: string | null;
          isPrimary: boolean;
          sslStatus: string;
          status: string;
        } | null;
      };
    },
    enabled: typeof window !== "undefined",
    staleTime: TENANT_CACHE_TTL,
    retry: 1,
  });

  // Cache the resolved tenant
  useEffect(() => {
    if (tenantData?.business && isCustom) {
      setCachedTenant(hostname, tenantData.business);
    }
  }, [tenantData, isCustom, hostname]);

  // Apply branding to document
  useEffect(() => {
    if (tenantData?.business) {
      const branding = tenantData.business;

      // Apply primary color as CSS variable
      if (branding.primaryColor) {
        document.documentElement.style.setProperty(
          "--tenant-primary",
          branding.primaryColor
        );
      }

      // Apply favicon
      if (branding.favicon) {
        const existingFavicon = document.querySelector(
          'link[rel="icon"]'
        ) as HTMLLinkElement;
        if (existingFavicon) {
          existingFavicon.href = branding.favicon;
        } else {
          const newFavicon = document.createElement("link");
          newFavicon.rel = "icon";
          newFavicon.href = branding.favicon;
          document.head.appendChild(newFavicon);
        }
      }

      // Apply document title
      if (branding.businessName) {
        document.title = `${branding.businessName} — Powered by Quantix`;
      }

      // Apply dark mode
      if (branding.darkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [tenantData]);

  // Extract branding from response or cache
  const branding = tenantData?.business || cachedBranding || null;

  return {
    businessId: branding?.businessId || null,
    businessName: branding?.businessName || null,
    businessType: branding?.businessType || null,
    primaryColor: branding?.primaryColor || null,
    logo: branding?.logo || null,
    isLoading: isLoading && !cachedBranding,
    error,
    branding,
    refetch: () => {
      // Clear cache before refetching
      localStorage.removeItem(TENANT_CACHE_KEY);
      refetch();
    },
    isCustomDomain: isCustom,
  };
}
