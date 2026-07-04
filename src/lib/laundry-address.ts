// Structured pickup address for laundry orders. Reuses the SHARED Address model
// (the same one Commerce uses) — no laundry-specific address table/JSON. The
// order stores a human-readable SNAPSHOT string (LaundryOrder.pickupAddress) so
// historical orders keep the exact address used at order time even if the
// customer later edits their saved Address. Ownership + tenant are validated:
// an addressId must belong to the resolving customer.
import { prisma } from "@/lib/prisma"

export interface StructuredAddress {
  fullName?: string | null; phone?: string | null
  label?: string | null; addressLine1?: string | null; addressLine2?: string | null
  area?: string | null; landmark?: string | null
  city?: string | null; state?: string | null; pincode?: string | null; country?: string | null
}

export function formatAddressSnapshot(a: StructuredAddress, name?: string | null, phone?: string | null): string {
  const cityLine = [a.city, a.state].filter(Boolean).join(", ") + (a.pincode ? ` - ${a.pincode}` : "")
  const lines = [
    [a.fullName || name, a.phone || phone].filter(Boolean).join(" · "),
    a.addressLine1, a.addressLine2, a.area, a.landmark && `Landmark: ${a.landmark}`,
    cityLine.trim().replace(/^,\s*/, ""), a.country && a.country !== "India" ? a.country : null,
  ].filter((l) => l && String(l).trim())
  return lines.join("\n")
}

export interface ResolvePickupResult { ok: boolean; snapshot?: string; addressId?: string | null; error?: string; status?: number }

/**
 * Resolve the pickup address for an order.
 * - addressId → load the shared Address, verify it belongs to `customerId`
 *   (ownership) and the customer's tenant, then snapshot it.
 * - structured → snapshot the inline fields (guest add-address).
 * - legacyString → backward-compatible free-text snapshot.
 */
export async function resolvePickupAddress(input: {
  addressId?: string | null
  structured?: StructuredAddress | null
  legacyString?: string | null
  customerId: string
  customerName?: string | null
  customerPhone?: string | null
}): Promise<ResolvePickupResult> {
  if (input.addressId) {
    const addr = await prisma.address.findUnique({ where: { id: input.addressId } })
    if (!addr) return { ok: false, error: "Address not found", status: 404 }
    if (addr.customerId !== input.customerId) return { ok: false, error: "This address does not belong to your account", status: 403 }
    return { ok: true, addressId: addr.id, snapshot: formatAddressSnapshot(addr as StructuredAddress, input.customerName, input.customerPhone) }
  }
  if (input.structured && (input.structured.addressLine1 || input.structured.area)) {
    const s = input.structured
    if (!s.addressLine1 || !s.city || !s.pincode) return { ok: false, error: "Address line, city and PIN code are required", status: 400 }
    return { ok: true, addressId: null, snapshot: formatAddressSnapshot(s, input.customerName, input.customerPhone) }
  }
  if (input.legacyString && input.legacyString.trim()) {
    return { ok: true, addressId: null, snapshot: input.legacyString.trim() }
  }
  return { ok: false, error: "A pickup address is required", status: 400 }
}
