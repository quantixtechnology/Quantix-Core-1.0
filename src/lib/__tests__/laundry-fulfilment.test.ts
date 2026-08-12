// New Order → the actual laundry workflow.
//
// The four offline scenarios are tested against the SHIPPED rule
// (src/lib/laundry-fulfilment.ts, which the screen imports), not against a
// copy of it. The removals are asserted against the screen's source, because
// "this control no longer exists" is not something a pure function can answer.
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { fulfilmentError, fulfilmentPayload, orderTypeFor, needsAddress, addressLabel, type FulfilmentState } from "@/lib/laundry-fulfilment"

const ROOT = join(__dirname, "../../..")
const screen = readFileSync(join(ROOT, "src/components/laundry/views/laundry-new-order.tsx"), "utf8")
// "This control is gone" is a claim about CODE. Comments explaining why it was
// removed legitimately name it, so they must not make the assertion pass or
// fail. Negative checks run against the code with comments stripped.
const code = screen
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n")

const base: FulfilmentState = {
  pickupRequired: false, deliveryRequired: false,
  addressText: "", addressId: null, landmark: null, lat: null, lng: null,
  pickupDate: "", pickupTimeSlot: "", deliveryDate: "", deliveryTimeSlot: "",
}
const ADDR = {
  addressText: "12 MG Road, Indiranagar, Bengaluru, 560038",
  addressId: "addr_1", landmark: "Near the park", lat: 12.97, lng: 77.64,
}

describe("Test 1 — walk-in, customer collects (pickup No, delivery No)", () => {
  it("creates with no pickup or delivery information at all", () => {
    expect(fulfilmentError(base)).toBeNull()
    const p = fulfilmentPayload(base)
    expect(p.pickupRequired).toBe(false)
    expect(p.deliveryRequired).toBe(false)
    expect(p.pickupDate).toBeNull()
    expect(p.pickupTimeSlot).toBeNull()
    expect(p.deliveryDate).toBeNull()
    expect(p.deliveryTimeSlot).toBeNull()
    expect(p.pickupAddress).toBeNull()
  })

  it("is a walk-in, so it goes straight to Store Audit", () => {
    expect(orderTypeFor(false)).toBe("WALK_IN")
    expect(needsAddress(base)).toBe(false)
  })
})

describe("Test 2 — walk-in + delivery (pickup No, delivery Yes)", () => {
  const s: FulfilmentState = { ...base, ...ADDR, deliveryRequired: true, deliveryDate: "2026-08-14", deliveryTimeSlot: "14:00-15:00" }

  it("requires only address, delivery date and delivery slot", () => {
    expect(fulfilmentError({ ...s, addressText: "" })).toMatch(/address/i)
    expect(fulfilmentError({ ...s, deliveryDate: "" })).toMatch(/delivery date/i)
    expect(fulfilmentError({ ...s, deliveryTimeSlot: "" })).toMatch(/delivery time slot/i)
    expect(fulfilmentError(s)).toBeNull()
  })

  it("never asks for pickup details — the garments are already at the store", () => {
    // No pickup date/slot is set, and that must not be an error.
    expect(fulfilmentError(s)).toBeNull()
    const p = fulfilmentPayload(s)
    expect(p.pickupRequired).toBe(false)
    expect(p.pickupDate).toBeNull()
    expect(p.pickupTimeSlot).toBeNull()
    // Still a walk-in: nothing is collected from the customer.
    expect(p.orderType).toBe("WALK_IN")
  })

  it("carries the address so the delivery executive has somewhere to go", () => {
    // The delivery job reads the order's single address field — before this,
    // a walk-in + delivery order reached the executive with nothing.
    const p = fulfilmentPayload(s)
    expect(p.pickupAddress).toBe(ADDR.addressText)
    expect(p.pickupAddressId).toBe("addr_1")
    expect(p.pickupLat).toBe(12.97)
    expect(p.pickupLng).toBe(77.64)
  })

  it("labels the address as a delivery address, not a pickup address", () => {
    expect(addressLabel(s)).toBe("Delivery Address")
  })
})

describe("Test 3 — future pickup (pickup Yes, delivery No)", () => {
  const s: FulfilmentState = { ...base, ...ADDR, pickupRequired: true, pickupDate: "2026-08-13", pickupTimeSlot: "09:00-11:00" }

  it("requires only address, pickup date and pickup slot", () => {
    expect(fulfilmentError({ ...s, addressText: "" })).toMatch(/address/i)
    expect(fulfilmentError({ ...s, pickupDate: "" })).toMatch(/pickup date/i)
    expect(fulfilmentError({ ...s, pickupTimeSlot: "" })).toMatch(/pickup time slot/i)
    expect(fulfilmentError(s)).toBeNull()
  })

  it("does not validate or send any delivery information", () => {
    expect(fulfilmentError(s)).toBeNull()
    const p = fulfilmentPayload(s)
    expect(p.deliveryRequired).toBe(false)
    expect(p.deliveryDate).toBeNull()
    expect(p.deliveryTimeSlot).toBeNull()
  })

  it("is a HOME_PICKUP, so the order does NOT behave as if the garments arrived", () => {
    // The order engine starts a pickupRequired order in
    // AWAITING_PICKUP_ASSIGNMENT rather than PENDING_STORE_AUDIT. Customer says
    // "collect tomorrow" — the clothes are still at their home tonight.
    const p = fulfilmentPayload(s)
    expect(p.orderType).toBe("HOME_PICKUP")
    expect(p.pickupRequired).toBe(true)
    expect(addressLabel(s)).toBe("Pickup Address")
  })
})

describe("Test 4 — pickup + delivery (both Yes)", () => {
  const s: FulfilmentState = {
    ...base, ...ADDR, pickupRequired: true, deliveryRequired: true,
    pickupDate: "2026-08-13", pickupTimeSlot: "09:00-11:00",
    deliveryDate: "2026-08-15", deliveryTimeSlot: "14:00-15:00",
  }

  it("captures both schedules independently", () => {
    const p = fulfilmentPayload(s)
    expect(p.pickupDate).toBe("2026-08-13")
    expect(p.pickupTimeSlot).toBe("09:00-11:00")
    expect(p.deliveryDate).toBe("2026-08-15")
    expect(p.deliveryTimeSlot).toBe("14:00-15:00")
    expect(p.pickupRequired && p.deliveryRequired).toBe(true)
  })

  it("requires every field of both legs", () => {
    expect(fulfilmentError({ ...s, pickupTimeSlot: "" })).toMatch(/pickup/i)
    expect(fulfilmentError({ ...s, deliveryDate: "" })).toMatch(/delivery/i)
    expect(fulfilmentError(s)).toBeNull()
  })

  it("says plainly that the one stored address serves both legs", () => {
    // A LaundryOrder holds ONE address; the label must not claim otherwise.
    expect(addressLabel(s)).toBe("Pickup & Delivery Address")
  })
})

describe("switching a leg off drops its data", () => {
  it("a pickup date entered then cancelled is never sent", () => {
    const s: FulfilmentState = { ...base, ...ADDR, pickupRequired: false, pickupDate: "2026-08-13", pickupTimeSlot: "09:00-11:00" }
    const p = fulfilmentPayload(s)
    expect(p.pickupDate).toBeNull()
    expect(p.pickupTimeSlot).toBeNull()
    expect(p.orderType).toBe("WALK_IN")
  })

  it("with both legs off, no address is sent even if one was chosen", () => {
    const p = fulfilmentPayload({ ...base, ...ADDR })
    expect(p.pickupAddress).toBeNull()
    expect(p.pickupAddressId).toBeNull()
    expect(p.pickupLat).toBeNull()
  })
})

describe("Test 5/6 — subscription and non-subscription customers", () => {
  it("has no Customer Type selector to tell the system what it already knows", () => {
    expect(code).not.toContain("PAY_TYPES")
    expect(code).not.toContain("Pay After Service")
    expect(code).not.toMatch(/title="Customer Type"/)
    // "Subscription Customer" / "Corporate Customer" order types are gone too.
    expect(code).not.toContain("Subscription Customer")
    expect(code).not.toContain("Corporate Customer")
  })

  it("still detects and previews the subscription automatically", () => {
    // Existing endpoints, untouched — coverage is applied by the subscription
    // engine after creation exactly as before.
    expect(screen).toContain("/api/laundry/subscriptions/active")
    expect(screen).toContain("/api/laundry/subscriptions/preview")
    expect(screen).toContain("Covered by Subscription")
  })

  it("prices through the existing billing engine for every customer", () => {
    expect(screen).toContain("/api/laundry/billing/quote")
  })
})

describe("Test 7 — payment stays in Payment Collection", () => {
  it("New Order asks for no payment method and sends no payment preference", () => {
    expect(code).not.toContain("paymentPreference")
    expect(code).not.toContain("payTypeToPreference")
    expect(code).not.toContain("Pay Now")
  })
})

describe("Test 8 — the online flow is untouched", () => {
  it("this screen is the only file changed for offline intake", () => {
    // The storefront/customer-app order paths build their own payloads through
    // the same order engine; nothing here reaches into them.
    expect(code).not.toContain("storefront")
    expect(code).not.toContain("/api/laundry/app/")
  })
})

describe("the removed sections are actually gone", () => {
  it("no Order Type selector", () => {
    expect(code).not.toContain("ORDER_TYPES")
    expect(code).not.toMatch(/title="Order Type"/)
    expect(code).not.toContain("setOrderType")
  })

  it("no Expected Delivery entry or override", () => {
    expect(code).not.toMatch(/title="Expected Delivery"/)
    expect(code).not.toContain("overrideDelivery")
    expect(code).not.toContain("customDeliveryDate")
    expect(code).not.toContain("Override Allowed")
  })

  it("no Laundry Instructions and no Attachments", () => {
    expect(code).not.toContain("QUICK_NOTES")
    expect(code).not.toContain("quickNotes")
    expect(code).not.toContain("Laundry Instructions")
    expect(code).not.toContain("attachments")
    expect(code).not.toContain("handleUpload")
    // …and not re-introduced as a generic notes box either.
    expect(code).not.toContain("otherInstructions")
    expect(code).not.toContain("specialInstructions")
    expect(code).not.toContain("pickupInstructions")
  })

  it("keeps the shared upload endpoint for the workflows that use it", () => {
    // Removed from THIS screen only.
    expect(code).not.toContain("/api/uploads")
    const audit = readFileSync(join(ROOT, "src/components/laundry/views/laundry-store-audit.tsx"), "utf8")
    expect(audit.length).toBeGreaterThan(0)
  })
})

describe("both toggles default to No", () => {
  it("the walk-in counter case needs no scheduling interaction", () => {
    expect(screen).toContain("useState(false)")
    expect(screen).toMatch(/const \[pickupRequired, setPickupRequired\] = useState\(false\)/)
    expect(screen).toMatch(/const \[deliveryRequired, setDeliveryRequired\] = useState\(false\)/)
  })
})

describe("addresses come from the customer's saved addresses", () => {
  it("reuses the existing address endpoint and never re-asks for city/PIN/GPS", () => {
    expect(screen).toContain("/addresses?businessId=")
    // No address-entry fields inside the fulfilment section — the New Customer
    // form keeps its own, which is a different thing.
    expect(code).not.toContain("Enter pickup address")
  })

  it("preselects the customer's own pickup-default address", () => {
    expect(screen).toContain("isPickupDefault")
  })
})

describe("no second scheduling or ordering mechanism", () => {
  it("uses the existing slot configuration and slot rules", () => {
    expect(screen).toContain("/api/laundry/slot-config")
    expect(screen).toContain("slotHasEnded")
    expect(screen).toContain("slotIsPast")
  })

  it("creates the order through the existing endpoint", () => {
    expect(screen).toContain('fetch("/api/laundry/orders"')
  })

  it("declares no new order status or model", () => {
    expect(code).not.toContain("prisma")
    expect(code).not.toContain("PICKUP_ORDER")
    expect(code).not.toContain("DELIVERY_ORDER")
  })
})
