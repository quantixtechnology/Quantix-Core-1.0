// Canonical customer identity resolution — ONE shared get-or-create used by the
// laundry order/checkout paths (and available to others) so a customer is never
// duplicated because of phone formatting, a missing email, PWA vs website, or a
// different customerCode prefix.
//
// Root cause this fixes: laundry checkout matched by RAW phone, so "07350551170"
// did not match a stored "+917350551170" and created a second customer. This
// reuses the EXISTING canonical normalizers (normalizePhone / normalizeEmail from
// storefront-auth) — no new phone format is introduced.
//
// Match precedence: (1) explicit customerId, (2) authenticated userId linkage,
// (3) normalized email, (4) normalized phone — all within the platform business
// (tenant) scope. Name is never used as an identity key.
import { prisma } from "@/lib/prisma"
import { normalizePhone, normalizeEmail } from "@/lib/storefront-auth"
import { generateCustomerCode } from "@/lib/customer-code"

export { normalizePhone, normalizeEmail }

export interface ResolveCustomerInput {
  platformBusinessId: string
  name?: string | null
  phone?: string | null
  email?: string | null
  userId?: string | null        // authenticated account linkage (highest precedence)
  customerId?: string | null    // explicit id from the client (verified below)
  source?: string
  emailRequiredForNew?: boolean // a genuinely NEW customer must provide an email
}

export async function resolveOrCreateLaundryCustomer(input: ResolveCustomerInput) {
  const businessId = input.platformBusinessId
  const email = input.email ? normalizeEmail(input.email) : null
  const phone = input.phone ? normalizePhone(input.phone) : null
  const rawPhone = input.phone?.trim() || null

  let customer =
    // (1) explicit id (verified to the tenant)
    (input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, businessId } }) : null) ||
    // (2) authenticated account linkage
    (input.userId ? await prisma.customer.findFirst({ where: { userId: input.userId, businessId } }) : null) ||
    // (3) normalized verified email within tenant
    (email ? await prisma.customer.findFirst({ where: { businessId, email } }) : null) ||
    // (4) normalized phone within tenant (also catch legacy raw-stored phones)
    (phone ? await prisma.customer.findFirst({ where: { businessId, phone: { in: [phone, rawPhone].filter(Boolean) as string[] } } }) : null)

  if (customer) {
    // Backfill/link canonical fields without overwriting existing values.
    const patch: Record<string, unknown> = {}
    if (input.userId && !customer.userId) patch.userId = input.userId
    if (email && !customer.email) patch.email = email
    if (phone && customer.phone !== phone) patch.phone = phone // canonicalize stored phone
    if (input.name && !customer.name) patch.name = input.name
    if (Object.keys(patch).length) customer = await prisma.customer.update({ where: { id: customer.id }, data: patch })
    return { customer, created: false as const }
  }

  // No canonical match → this is a NEW customer.
  if (input.emailRequiredForNew && !email) return { customer: null, created: false as const, error: "Email is required to create your account" }
  // Keyed on the tenant, not on a code string the caller happens to hold — the
  // generator resolves the canonical Business Code itself.
  const code = await generateCustomerCode(businessId)
  customer = await prisma.customer.create({
    data: {
      businessId, userId: input.userId || null, name: input.name || "Customer",
      phone, email, customerCode: code, source: input.source || "STOREFRONT",
      isGuest: !input.userId,
    },
  })
  return { customer, created: true as const, error: undefined as string | undefined }
}
