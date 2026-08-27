// The ONE way a Laundry OS customer record is written.
//
// Extracted verbatim from POST /api/laundry/customers so the bulk importer
// creates customers through exactly the same path as the single-customer form —
// same customer code generator, same duplicate rule, same acquisition-source
// default, same metadata shape, same address handling. A second copy of this
// would drift, and a customer created by the importer would slowly stop looking
// like one created at the counter.
//
// It deliberately does NOT authenticate, resolve the business, or check
// permissions: the callers do that first and pass the resolved ids in, so this
// cannot be used to reach a business the caller has not already been cleared for.
import { prisma } from "@/lib/prisma"
import { generateCustomerCode } from "@/lib/customer-code"
import { defaultCustomerSourceId } from "@/lib/laundry-customer-source"
import { mergeMeta, type CommPrefs } from "@/lib/laundry-customer"

export interface CustomerCreateInput {
  name: string
  mobile: string
  alternateMobile?: string | null
  email?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  area?: string | null
  landmark?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
  gender?: string | null
  dateOfBirth?: string | null
  avatar?: string | null
  gstNumber?: string | null
  accountType?: string | null
  customerSourceId?: string | null
  salesTeamOwnerId?: string | null
  salesTeamOwnerName?: string | null
  anniversary?: string | null
  company?: string | null
  reference?: string | null
  comm?: CommPrefs | null
  tags?: unknown
  notes?: string | null
}

/**
 * THE duplicate rule: one customer per mobile number, per platform business.
 * Exactly what the single-create route has always used — exported so the
 * importer asks the same question rather than inventing its own.
 */
export async function findCustomerByMobile(platformBusinessId: string, mobile: string) {
  return prisma.customer.findFirst({ where: { businessId: platformBusinessId, phone: mobile } })
}

/**
 * Create a customer (and its default address, when any address part is given).
 *
 * @param platformBusinessId the resolved platform Business id — the tenant boundary
 * @param laundryBusinessId  the resolved LaundryBusiness id — for the source default
 */
export async function createLaundryCustomer(
  platformBusinessId: string,
  laundryBusinessId: string,
  input: CustomerCreateInput,
) {
  const addressLine1 = input.addressLine1 ?? ""
  const country = input.country || "India"

  // Enterprise ID via the shared generator: CUS-{businessCode}-NNNNNN
  const customerCode = await generateCustomerCode(platformBusinessId)

  // Full profile extras live in metadata (JSON); tags in the tags JSON.
  const metadata = mergeMeta("{}", {
    alternateMobile: input.alternateMobile || undefined,
    anniversary: input.anniversary || undefined,
    company: input.company || undefined,
    reference: input.reference || undefined,
    comm: (input.comm && typeof input.comm === "object" ? input.comm : undefined) as CommPrefs | undefined,
  })

  const customer = await prisma.customer.create({
    data: {
      businessId: platformBusinessId,
      name: input.name,
      phone: input.mobile,
      email: input.email || null,
      gender: input.gender || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      avatar: input.avatar || null,
      gstNumber: input.gstNumber || null,
      ...(input.accountType && { accountType: input.accountType }),
      customerCode,
      // Channel — the long-standing field, unchanged.
      source: "LAUNDRY_OS",
      // Acquisition — how the business won them, chosen by a person. Falls back
      // to the business's default (Direct) when the caller says nothing.
      customerSourceId: input.customerSourceId
        ? String(input.customerSourceId)
        : await defaultCustomerSourceId(laundryBusinessId),
      salesTeamOwnerId: input.salesTeamOwnerId ? String(input.salesTeamOwnerId) : null,
      salesTeamOwnerName: input.salesTeamOwnerName ? String(input.salesTeamOwnerName) : null,
      isGuest: false,
      tags: JSON.stringify(Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : []),
      metadata,
      notes: input.notes || "",
    },
  })

  if (addressLine1 || input.area || input.landmark || input.city || input.state || input.pincode) {
    await prisma.address.create({
      data: {
        customerId: customer.id,
        addressLine1: addressLine1 || "",
        addressLine2: input.addressLine2 || null,
        area: input.area || null,
        landmark: input.landmark || null,
        city: input.city || "",
        state: input.state || "",
        pincode: input.pincode || "",
        country,
        isDefault: true,
      },
    })
  }

  return customer
}
