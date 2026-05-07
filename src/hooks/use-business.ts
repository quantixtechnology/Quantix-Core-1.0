// ============================================================================
// Quantix Technology - Business Context Zustand Store
// ============================================================================

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BusinessType, BusinessListItem } from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================

interface BusinessState {
  // Current business context
  currentBusiness: BusinessListItem | null;
  currentBusinessId: string | null;

  // Business list (for multi-business users)
  businessList: BusinessListItem[];
  isLoading: boolean;

  // Actions
  setCurrentBusiness: (business: BusinessListItem | null) => void;
  setBusinessList: (businesses: BusinessListItem[]) => void;
  clearBusiness: () => void;
  setLoading: (loading: boolean) => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      currentBusiness: null,
      currentBusinessId: null,
      businessList: [],
      isLoading: false,

      setCurrentBusiness: (business: BusinessListItem | null) => {
        set({
          currentBusiness: business,
          currentBusinessId: business?.id || null,
        });

        // Also update the API client's business context
        if (typeof window !== 'undefined') {
          import('@/lib/api-client').then(({ setBusinessContext }) => {
            setBusinessContext(business?.id || null);
          });
        }
      },

      setBusinessList: (businesses: BusinessListItem[]) => {
        set({ businessList: businesses });
      },

      clearBusiness: () => {
        set({
          currentBusiness: null,
          currentBusinessId: null,
        });

        if (typeof window !== 'undefined') {
          import('@/lib/api-client').then(({ setBusinessContext }) => {
            setBusinessContext(null);
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'quantix-business-store',
      partialize: (state) => ({
        currentBusiness: state.currentBusiness,
        currentBusinessId: state.currentBusinessId,
      }),
    }
  )
);

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Get the current business type
 */
export function useBusinessType(): BusinessType | null {
  return useBusinessStore((state) => state.currentBusiness?.businessType || null);
}

/**
 * Check if a specific business type is active
 */
export function useIsBusinessType(type: BusinessType): boolean {
  return useBusinessStore((state) => state.currentBusiness?.businessType === type);
}

/**
 * Get the current business ID
 */
export function useBusinessId(): string | null {
  return useBusinessStore((state) => state.currentBusinessId);
}

/**
 * Get the current business name
 */
export function useBusinessName(): string | null {
  return useBusinessStore((state) => state.currentBusiness?.name || null);
}

/**
 * Get the primary color of the current business
 */
export function useBusinessColor(): string {
  return useBusinessStore((state) => state.currentBusiness?.primaryColor || '#10B981');
}
