// POST /api/laundry/app/invite — send a Customer App registration invitation by
// EMAIL (walk-in customer onboarding + CRM). Reuses the platform email service;
// no SMS. The email carries the business name, the app URL with the email
// pre-filled, and a Continue button. The recipient becomes a customer only
// after completing the email-OTP registration in the app (no duplicate created
// here). Admin-triggered (businessId scoped), so no app session is required.
//
// Body: { businessId, email, name?, source?("WALK_IN"|"CRM"), customerId? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { sendTransactionalEmail } from "@/lib/email-service"

export const runtime = "nodejs"
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const email = String(b.email || "").trim().toLowerCase()
    if (!b.businessId || !isEmail(email)) return NextResponse.json({ error: "businessId and a valid email are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.customers.invite")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const lb = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { businessName: true, logo: true } })
    const businessName = lb?.businessName || "Laundry"
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const appUrl = `${origin.replace(/\/$/, "")}/laundry/app?email=${encodeURIComponent(email)}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        ${lb?.logo ? `<img src="${lb.logo}" alt="${businessName}" style="height:44px;margin-bottom:12px"/>` : ""}
        <h2 style="margin:0 0 8px">${businessName}</h2>
        <p style="color:#475569;line-height:1.5">${b.name ? `Hi ${b.name}, ` : ""}you're invited to manage your laundry orders, subscription and delivery from the ${businessName} Customer App.</p>
        <p style="color:#475569;line-height:1.5">Sign in with your email — we'll email you a one-time code. No password needed.</p>
        <a href="${appUrl}" style="display:inline-block;margin:16px 0;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Continue to the App</a>
        <p style="color:#94a3b8;font-size:12px">If the button doesn't work, open: ${appUrl}</p>
      </div>`
    const { sent, error } = await sendTransactionalEmail(email, `Your ${businessName} Customer App invitation`, html)

    // Log the invitation on the customer's timeline when one already exists.
    if (b.customerId) {
      await prisma.customerActivity.create({ data: { businessId: biz.platformBusinessId, customerId: b.customerId, type: "COMMUNICATION", title: "Customer App invitation sent", body: `Invitation emailed to ${email}${sent ? "" : " (queued — SMTP not configured)"}`, actorName: b.actorName || null } }).catch(() => {})
    }
    return NextResponse.json({ success: true, data: { sent, link: appUrl, ...(error ? { warning: error } : {}) } })
  } catch (e) {
    console.error("[laundry-app-invite] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
