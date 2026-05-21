// Shared INR currency formatter.
//
// Do NOT use Intl.NumberFormat with style:'currency' + currency:'INR' on the
// server — Node.js builds without full ICU data return '$' instead of '₹'.
// This module uses a manual '₹' prefix so it works in all environments.
//
// Usage:
//   import { formatINR, formatINRCompact } from "@/lib/currency"
//   formatINR(1100)       → "₹1,100"
//   formatINRCompact(150000)  → "₹1.5L"

export function formatINR(v: number): string {
  return '₹' + Math.round(v).toLocaleString('en-IN')
}

export function formatINRCompact(v: number): string {
  if (v >= 10_000_000) return '₹' + (v / 10_000_000).toFixed(1) + 'Cr'
  if (v >= 100_000)    return '₹' + (v / 100_000).toFixed(1) + 'L'
  if (v >= 1_000)      return '₹' + (v / 1_000).toFixed(1) + 'K'
  return formatINR(v)
}
