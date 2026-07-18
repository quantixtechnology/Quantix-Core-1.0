// Delivery Executive session resolution ONLY. Reuses the platform token store
// (RefreshToken table) — the SAME session architecture as the customer app. No
// parallel auth framework: an executive's login mints a platform access token
// for their linked User; this module resolves that token → the active
// LaundryDeliveryExecutive it belongs to. The PWA gate is "an ACTIVE executive".
import { prisma } from "@/lib/prisma"

export interface ExecSession { executiveId: string; userId: string; businessId: string; storeId: string | null }

export async function resolveExecutive(token: string | null): Promise<ExecSession | null> {
  if (!token) return null
  const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
  if (!rt?.userId) return null
  const exec = await prisma.laundryDeliveryExecutive.findFirst({ where: { userId: rt.userId, isActive: true }, select: { id: true, businessId: true, storeId: true } })
  if (!exec) return null
  return { executiveId: exec.id, userId: rt.userId, businessId: exec.businessId, storeId: exec.storeId }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null
}
