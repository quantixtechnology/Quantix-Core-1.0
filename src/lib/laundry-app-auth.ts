// ============================================================================
// Laundry Customer App — self-contained mobile-OTP auth + session.
// Independent of the platform storefront/website auth (which is email-OTP). It
// authenticates against the existing Customer record and issues an opaque
// bearer token per device. Never modifies the frozen engines.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { createHash, randomBytes } from "crypto"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateCustomerCode } from "@/lib/laundry-codes"

const OTP_TTL_MIN = 5
const SESSION_TTL_DAYS = 30
// No SMS gateway wired in this environment → dev mode returns the OTP so the
// flow is testable (mirrors the razorpay dev-mock pattern). Wire an SMS
// provider here for production; the contract is unchanged.
const SMS_ENABLED = !!process.env.LAUNDRY_APP_SMS_KEY

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
export function normalizePhone(p: string): string { const d = (p || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d }

export async function requestOtp(businessIdInput: string, phoneInput: string) {
  const biz = await resolveLaundryBusiness(businessIdInput)
  if (!biz?.platformBusinessId) return { ok: false as const, error: "Business not found" }
  const phone = normalizePhone(phoneInput)
  if (phone.length !== 10) return { ok: false as const, error: "Enter a valid 10-digit mobile number" }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  await prisma.laundryAppOtp.deleteMany({ where: { businessId: biz.platformBusinessId, phone } })
  await prisma.laundryAppOtp.create({ data: { businessId: biz.platformBusinessId, phone, codeHash: sha(code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60000) } })
  // TODO(prod): send `code` via the SMS provider when SMS_ENABLED.
  return { ok: true as const, phone, devCode: SMS_ENABLED ? undefined : code, expiresInSec: OTP_TTL_MIN * 60 }
}

export async function verifyOtp(businessIdInput: string, phoneInput: string, code: string, device?: string | null) {
  const biz = await resolveLaundryBusiness(businessIdInput)
  if (!biz?.platformBusinessId) return { ok: false as const, error: "Business not found" }
  const platformId = biz.platformBusinessId
  const phone = normalizePhone(phoneInput)
  const otp = await prisma.laundryAppOtp.findFirst({ where: { businessId: platformId, phone }, orderBy: { createdAt: "desc" } })
  if (!otp) return { ok: false as const, error: "Request an OTP first" }
  if (otp.expiresAt < new Date()) return { ok: false as const, error: "OTP expired — request a new one" }
  if (otp.attempts >= 5) return { ok: false as const, error: "Too many attempts — request a new OTP" }
  if (otp.codeHash !== sha(String(code || ""))) {
    await prisma.laundryAppOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return { ok: false as const, error: "Incorrect OTP" }
  }
  await prisma.laundryAppOtp.deleteMany({ where: { businessId: platformId, phone } })

  // Find or create the Customer (shadow claim by phone).
  let customer = await prisma.customer.findFirst({ where: { businessId: platformId, phone } })
  let isNew = false
  if (!customer) {
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { businessCode: true } })
    const customerCode = await generateCustomerCode(lb?.businessCode || `LND-${biz.id}`)
    customer = await prisma.customer.create({ data: { businessId: platformId, name: `Customer ${phone}`, phone, source: "LAUNDRY_APP", customerCode, status: "ACTIVE", phoneVerified: true, verified: true } })
    isNew = true
  } else if (!customer.phoneVerified) {
    await prisma.customer.update({ where: { id: customer.id }, data: { phoneVerified: true, lastLoginAt: new Date() } }).catch(() => {})
  }

  const token = randomBytes(32).toString("hex")
  await prisma.laundryAppSession.create({ data: { businessId: platformId, customerId: customer.id, token, device: device || null, expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400000) } })
  return { ok: true as const, token, customerId: customer.id, businessId: platformId, isNew, needsProfile: isNew || customer.name === `Customer ${phone}` }
}

export interface AppSession { customerId: string; businessId: string; sessionId: string }
export async function resolveSession(token: string | null): Promise<AppSession | null> {
  if (!token) return null
  const s = await prisma.laundryAppSession.findUnique({ where: { token } })
  if (!s || s.expiresAt < new Date()) return null
  prisma.laundryAppSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {})
  return { customerId: s.customerId, businessId: s.businessId, sessionId: s.id }
}
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null
}
// Standard guard for app routes — returns the session or throws a 401 Response.
export async function requireSession(req: Request): Promise<AppSession> {
  const s = await resolveSession(bearerToken(req))
  if (!s) throw new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" } })
  return s
}
