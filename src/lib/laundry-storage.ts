// Tenant storage management — plan limits, category resolution and usage
// computation from the FileUpload ledger (size + businessId are already tracked
// per tenant, so usage never walks the filesystem). Isolation is by businessId:
// uploads live under /uploads/{businessId}/... — one tenant never sees another.

import { prisma } from "@/lib/prisma"

export const STORAGE_CATEGORIES = [
  "customers", "orders", "garments", "audit", "processing", "delivery", "invoice", "documents", "branding", "temp",
] as const
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number]

// Plan → storage limit in GB. null = unlimited.
const PLAN_LIMITS_GB: Record<string, number | null> = {
  STARTER: 2,
  PROFESSIONAL: 10,
  ENTERPRISE: 100,
  CUSTOM: null,
  UNLIMITED: null,
}
const DEFAULT_LIMIT_GB = 10
const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

export function limitBytesForPlan(plan: string | null | undefined): number | null {
  if (!plan) return DEFAULT_LIMIT_GB * GB
  const g = PLAN_LIMITS_GB[plan.toUpperCase()]
  if (g === null) return null // unlimited
  return (g ?? DEFAULT_LIMIT_GB) * GB
}

// Human-friendly label per category.
export const CATEGORY_LABELS: Record<string, string> = {
  customers: "Customer Photos",
  orders: "Order Files",
  garments: "Garment Images",
  audit: "Audit Images",
  processing: "Processing Images",
  delivery: "Delivery Proofs",
  invoice: "Invoices",
  documents: "Documents",
  branding: "Brand Assets",
  temp: "Temp",
  other: "Other",
}

// Derive a category for a FileUpload row: explicit column first, else the folder
// segment in the upload path (e.g. /uploads/{biz}/document/..), else mime.
export function resolveCategory(row: { category?: string | null; uploadPath?: string | null; mimeType?: string | null }): string {
  if (row.category && STORAGE_CATEGORIES.includes(row.category as StorageCategory)) return row.category
  const seg = (row.uploadPath || "").split("/").filter(Boolean)[2] // /uploads/{biz}/{seg}/..
  if (seg) {
    const s = seg.toLowerCase()
    if (s.includes("brand") || s === "logo") return "branding"
    if (s.includes("invoice")) return "invoice"
    if (s.includes("garment") || s === "product") return "garments"
    if (s.includes("audit")) return "audit"
    if (s.includes("customer")) return "customers"
    if (STORAGE_CATEGORIES.includes(s as StorageCategory)) return s
    return "documents"
  }
  return "documents"
}

export interface StorageUsage {
  usedBytes: number
  usedMB: number
  usedGB: number
  limitBytes: number | null
  limitGB: number | null
  remainingBytes: number | null
  percentUsed: number
  nearingLimit: boolean
  exceeded: boolean
  fileCount: number
  uploadsToday: number
  uploadsThisMonth: number
  byCategory: { category: string; label: string; bytes: number; mb: number; count: number }[]
}

export async function computeStorageUsage(platformBusinessId: string, plan: string | null | undefined): Promise<StorageUsage> {
  const rows = await prisma.fileUpload.findMany({
    where: { businessId: platformBusinessId, status: "COMPLETED" },
    select: { size: true, category: true, uploadPath: true, mimeType: true, createdAt: true },
  })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let usedBytes = 0, uploadsToday = 0, uploadsThisMonth = 0
  const cat = new Map<string, { bytes: number; count: number }>()
  for (const r of rows) {
    usedBytes += r.size
    if (r.createdAt >= startOfDay) uploadsToday++
    if (r.createdAt >= startOfMonth) uploadsThisMonth++
    const c = resolveCategory(r)
    const agg = cat.get(c) || { bytes: 0, count: 0 }
    agg.bytes += r.size; agg.count += 1
    cat.set(c, agg)
  }

  const limitBytes = limitBytesForPlan(plan)
  const percentUsed = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0
  const r2 = (n: number) => Math.round(n * 100) / 100

  return {
    usedBytes,
    usedMB: r2(usedBytes / MB),
    usedGB: r2(usedBytes / GB),
    limitBytes,
    limitGB: limitBytes ? r2(limitBytes / GB) : null,
    remainingBytes: limitBytes ? Math.max(0, limitBytes - usedBytes) : null,
    percentUsed,
    nearingLimit: !!limitBytes && percentUsed >= 90,
    exceeded: !!limitBytes && usedBytes >= limitBytes,
    fileCount: rows.length,
    uploadsToday,
    uploadsThisMonth,
    byCategory: [...cat.entries()]
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category] || category, bytes: v.bytes, mb: r2(v.bytes / MB), count: v.count }))
      .sort((a, b) => b.bytes - a.bytes),
  }
}
