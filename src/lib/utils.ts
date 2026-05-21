// ============================================================================
// Quantix Technology — Utility Functions
// MANAGED PLATFORM
// ============================================================================

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { GSTBreakdown } from './types';

// ============================================================================
// EXISTING UTILITY
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

/**
 * Format amount as INR currency.
 * Uses manual ₹ prefix — avoids Intl.NumberFormat currency style which
 * requires full ICU data (outputs '$' on some Node.js VPS builds).
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return '₹' + Math.round(amount).toLocaleString('en-IN')
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format amount as compact INR (e.g., ₹1.2L, ₹1.5Cr)
 */
export function formatCompactCurrency(amount: number, currency: string = 'INR'): string {
  if (currency !== 'INR') return formatCurrency(amount, currency)
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(1)}L`
  if (amount >= 1_000)      return `₹${(amount / 1_000).toFixed(1)}K`
  return formatCurrency(amount)
}

// ============================================================================
// ORDER / INVOICE NUMBER FORMATTING
// ============================================================================

/**
 * Format order number: ORD-YYYYMMDD-XXXX
 */
export function formatOrderNumber(num: number): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ORD-${datePart}-${String(num).padStart(4, '0')}`;
}

/**
 * Format GST-compliant invoice number: PREFIX/YY/MM/XXXX
 */
export function formatInvoiceNumber(prefix: string, num: number): string {
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyShort = fy.toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${prefix}/${fyShort}/${month}/${String(num).padStart(4, '0')}`;
}

/**
 * Format POS session number: POS-YYYY-XXXX
 */
export function formatPOSSessionNumber(num: number): string {
  const year = new Date().getFullYear();
  return `POS-${year}-${String(num).padStart(4, '0')}`;
}

// ============================================================================
// SLUG GENERATION
// ============================================================================

/**
 * Generate a URL-safe slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// DISTANCE CALCULATION (Haversine Formula)
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a customer location is within the delivery radius of a store
 */
export function isWithinDeliveryRadius(
  storeLat: number,
  storeLng: number,
  custLat: number,
  custLng: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(storeLat, storeLng, custLat, custLng);
  return distance <= radiusKm;
}

// ============================================================================
// GST CALCULATION
// ============================================================================

/**
 * Calculate GST breakdown for an amount
 * For intra-state: CGST + SGST (each half of total GST rate)
 * For inter-state: IGST (full GST rate)
 */
export function calculateGST(
  amount: number,
  gstRate: number,
  isInterState: boolean = false,
  cessRate: number = 0
): GSTBreakdown {
  const totalGstAmount = (amount * gstRate) / 100;
  const cessAmount = (amount * cessRate) / 100;

  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(totalGstAmount * 100) / 100,
      cess: Math.round(cessAmount * 100) / 100,
      totalTax: Math.round((totalGstAmount + cessAmount) * 100) / 100,
    };
  }

  const halfGst = Math.round((totalGstAmount / 2) * 100) / 100;

  return {
    cgst: halfGst,
    sgst: halfGst,
    igst: 0,
    cess: Math.round(cessAmount * 100) / 100,
    totalTax: Math.round((totalGstAmount + cessAmount) * 100) / 100,
  };
}

// ============================================================================
// OTP GENERATION
// ============================================================================

/**
 * Generate a random 6-digit OTP (as per schema requirement)
 */
export function generateOTP(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

// ============================================================================
// PHONE NUMBER FORMATTING
// ============================================================================

/**
 * Format Indian phone number
 * Input: 9876543210 → Output: +91 98765 43210
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  return false;
}

// ============================================================================
// SAFE JSON PARSE
// ============================================================================

/**
 * Safely parse JSON with a default value fallback
 */
export function parseJSON<T>(str: string | null | undefined, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert enum-like string to readable label
 * e.g., "FOOD_DELIVERY" → "Food Delivery"
 */
export function enumToLabel(text: string): string {
  return text
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Format date for Indian display
 */
export function formatIndianDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Format date and time for Indian display
 */
export function formatIndianDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return formatIndianDate(d);
}

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Format number in Indian numbering system
 * e.g., 1234567 → 12,34,567
 */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Round to specified decimal places
 */
export function roundTo(num: number, decimals: number = 2): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calculate percentage
 */
export function calcPercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return roundTo((value / total) * 100);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate Indian GST number format
 */
export function isValidGSTNumber(gst: string): boolean {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase().replace(/\s/g, ''));
}

/**
 * Validate Indian PAN number format
 */
export function isValidPANNumber(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase().replace(/\s/g, ''));
}

/**
 * Validate Indian PIN code
 */
export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
