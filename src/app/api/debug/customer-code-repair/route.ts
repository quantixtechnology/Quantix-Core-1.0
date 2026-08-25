// GET  /api/debug/customer-code-repair?businessId=  — preview
// POST /api/debug/customer-code-repair?businessId=&confirm=1 — apply
//
// Brings a business's existing customer codes onto the canonical Business Code,
// KEEPING each customer's own number:
//
//   CUS-BIZ-VASTRASUDHA-1787384817694-000007  →  CUS-BUS-202608-0008-000007
//
// Safe because `customerCode` exists on exactly one model: orders, invoices and
// everything else reference `Customer.id`, so the code is a label, not a key.
// Numbers are preserved, so registration order is unchanged and no customer
// swaps identity with another.
//
// Idempotent: a customer already on the canonical prefix is skipped, and a
// target code already taken by someone else is skipped rather than overwritten.
// Platform-guarded, like the store-code repair it follows.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { platformOnly } from "@/lib/platform-guard"
import { ensureBusinessCode } from "@/lib/business-code"

export const runtime = "nodejs"

const PAD = 6
const tail = (code: string | null | undefined): string | null => {
  const m = /-(\d{1,10})$/.exec(String(code ?? "").trim())
  return m ? m[1].padStart(PAD, "0") : null
}

async function plan(businessId: string) {
  const businessCode = await ensureBusinessCode(businessId)
  if (!businessCode) return { businessCode: null, prefix: null, rows: [] as { id: string; name: string; from: string; to: string | null; skip?: string }[] }
  const prefix = `CUS-${businessCode}-`
  const customers = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, name: true, customerCode: true },
    orderBy: { createdAt: "asc" },
  })
  const taken = new Set(customers.map((c) => c.customerCode).filter(Boolean) as string[])

  const rows = customers.map((c) => {
    const from = c.customerCode || ""
    if (from.startsWith(prefix)) return { id: c.id, name: c.name, from, to: null, skip: "already canonical" }
    const n = tail(from)
    if (!n) return { id: c.id, name: c.name, from, to: null, skip: "no number to keep" }
    const to = `${prefix}${n}`
    if (taken.has(to)) return { id: c.id, name: c.name, from, to: null, skip: `${to} is already taken` }
    return { id: c.id, name: c.name, from, to }
  })
  return { businessCode, prefix, rows }
}

export async function GET(req: Request) {
  const denied = await platformOnly(req)
  if (denied) return denied
  const businessId = new URL(req.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  const p = await plan(businessId)
  return NextResponse.json({
    businessCode: p.businessCode,
    toRewrite: p.rows.filter((r) => r.to).length,
    skipped: p.rows.filter((r) => !r.to).length,
    rows: p.rows,
  })
}

export async function POST(req: Request) {
  const denied = await platformOnly(req)
  if (denied) return denied
  const sp = new URL(req.url).searchParams
  const businessId = sp.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  if (sp.get("confirm") !== "1") return NextResponse.json({ error: "confirm=1 required" }, { status: 400 })

  const p = await plan(businessId)
  const rewritten: { from: string; to: string }[] = []
  for (const r of p.rows) {
    if (!r.to) continue
    const ok = await prisma.customer
      .update({ where: { id: r.id }, data: { customerCode: r.to } })
      .then(() => true)
      .catch(() => false) // unique clash → leave the customer exactly as it was
    if (ok) rewritten.push({ from: r.from, to: r.to })
  }
  return NextResponse.json({ businessCode: p.businessCode, rewritten: rewritten.length, rows: rewritten, skipped: p.rows.filter((r) => !r.to) })
}
