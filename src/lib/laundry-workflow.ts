// ============================================================================
// Laundry Order Workflow Engine — single source of truth for the operational
// lifecycle. Drives stage transitions across departments. The transition API
// (POST /api/laundry/orders/[id]/transition) validates against this state
// machine; transitions marked `internal` carry side effects (payments, packet
// creation, transit legs, delivery capture) and are ONLY executable through
// their dedicated endpoints — the generic transition API rejects them.
//
// Operational flow:
//   ORDER CREATED → STORE AUDIT → PAYMENT → PACKING & QR → TRANSIT TO
//   PROCESSING → RECEIVED AT PC → GARMENT AUDIT & BARCODE → PROCESSING
//   (item-level) → QC → RETURN TRANSIT → STORE RECEIVE → READY FOR DELIVERY
//   → DELIVERED.
// ============================================================================

export type LaundryOrderStatus =
  | "DRAFT" | "PENDING_STORE_AUDIT" | "UNDER_AUDIT" | "PAYMENT_PENDING"
  | "READY_FOR_PROCESSING" | "PACKED" | "IN_TRANSIT_TO_PROCESSING"
  | "PROCESSING" | "QC_PENDING" | "RETURN_IN_TRANSIT"
  | "READY_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"

// Department that owns a status (where the order is currently sitting).
export type LaundryDepartmentKey =
  | "STORE_COUNTER" | "TRANSIT" | "PROCESSING_CENTER" | "QC" | "DELIVERY" | "DONE"

export interface StatusMeta {
  label: string
  department: LaundryDepartmentKey
  terminal?: boolean
}

export const STATUS_META: Record<LaundryOrderStatus, StatusMeta> = {
  DRAFT:                    { label: "Draft",                 department: "STORE_COUNTER" },
  PENDING_STORE_AUDIT:      { label: "Pending Store Audit",   department: "STORE_COUNTER" },
  UNDER_AUDIT:              { label: "Under Audit",           department: "STORE_COUNTER" },
  PAYMENT_PENDING:          { label: "Payment Pending",       department: "STORE_COUNTER" },
  READY_FOR_PROCESSING:     { label: "Ready for Packing",     department: "STORE_COUNTER" },
  PACKED:                   { label: "Packed",                department: "STORE_COUNTER" },
  IN_TRANSIT_TO_PROCESSING: { label: "In Transit to Processing", department: "TRANSIT" },
  PROCESSING:               { label: "In Processing",         department: "PROCESSING_CENTER" },
  QC_PENDING:               { label: "QC Pending",            department: "QC" }, // legacy status (pre-transit orders)
  RETURN_IN_TRANSIT:        { label: "Return in Transit",     department: "TRANSIT" },
  READY_FOR_DELIVERY:       { label: "Ready for Delivery",    department: "DELIVERY" },
  DELIVERED:                { label: "Delivered",             department: "DONE", terminal: true },
  CANCELLED:                { label: "Cancelled",             department: "DONE", terminal: true },
}

export interface TransitionDef {
  to: LaundryOrderStatus
  action: string   // machine code, stored on the event
  label: string    // button label
  primary?: boolean
  // Side-effect transitions: only their dedicated endpoint may perform them
  // (payment record, packet creation, transit legs, delivery capture).
  internal?: boolean
}

// Allowed forward (and corrective) transitions per status.
export const TRANSITIONS: Record<LaundryOrderStatus, TransitionDef[]> = {
  DRAFT: [
    { to: "PENDING_STORE_AUDIT", action: "SUBMIT_ORDER", label: "Submit for Audit", primary: true },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  PENDING_STORE_AUDIT: [
    { to: "PAYMENT_PENDING", action: "APPROVE_AUDIT", label: "Approve Audit", primary: true },
    { to: "UNDER_AUDIT", action: "HOLD_FOR_AUDIT", label: "Hold for Audit" },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  UNDER_AUDIT: [
    { to: "PAYMENT_PENDING", action: "COMPLETE_AUDIT", label: "Complete Audit", primary: true },
    { to: "PENDING_STORE_AUDIT", action: "REOPEN_AUDIT", label: "Send Back" },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  PAYMENT_PENDING: [
    // Advancing out of payment requires the payment endpoint (records money or
    // an explicit pay-later decision per business payment policy).
    { to: "READY_FOR_PROCESSING", action: "COLLECT_PAYMENT", label: "Collect Payment", primary: true, internal: true },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  READY_FOR_PROCESSING: [
    { to: "PACKED", action: "PACK_ORDER", label: "Pack & Generate QR", primary: true, internal: true },
  ],
  PACKED: [
    { to: "IN_TRANSIT_TO_PROCESSING", action: "DISPATCH_TO_PROCESSING", label: "Dispatch to Processing", primary: true, internal: true },
  ],
  IN_TRANSIT_TO_PROCESSING: [
    { to: "PROCESSING", action: "RECEIVE_AT_PROCESSING", label: "Receive at Processing Center", primary: true, internal: true },
  ],
  PROCESSING: [
    { to: "RETURN_IN_TRANSIT", action: "DISPATCH_TO_STORE", label: "Dispatch to Store", primary: true, internal: true },
  ],
  // Legacy status kept for orders created before the transit stages existed.
  QC_PENDING: [
    { to: "READY_FOR_DELIVERY", action: "QC_PASS", label: "QC Pass", primary: true },
    { to: "PROCESSING", action: "QC_REWORK", label: "Send for Rework" },
  ],
  RETURN_IN_TRANSIT: [
    { to: "READY_FOR_DELIVERY", action: "RECEIVE_AT_STORE", label: "Receive at Store", primary: true, internal: true },
  ],
  READY_FOR_DELIVERY: [
    { to: "DELIVERED", action: "MARK_DELIVERED", label: "Mark Delivered", primary: true, internal: true },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

export function getTransitions(status: string): TransitionDef[] {
  return TRANSITIONS[status as LaundryOrderStatus] ?? []
}

export function isTransitionAllowed(from: string, to: string): boolean {
  return getTransitions(from).some((t) => t.to === to)
}

export function getTransition(from: string, to: string): TransitionDef | undefined {
  return getTransitions(from).find((t) => t.to === to)
}

export function statusLabel(status: string): string {
  return STATUS_META[status as LaundryOrderStatus]?.label ?? status
}

// Human-readable event labels for the order timeline.
export const ACTION_LABELS: Record<string, string> = {
  SUBMIT_ORDER: "Order Submitted for Audit",
  APPROVE_AUDIT: "Store Audit Completed",
  HOLD_FOR_AUDIT: "Held for Audit",
  COMPLETE_AUDIT: "Store Audit Completed",
  REOPEN_AUDIT: "Audit Reopened",
  COLLECT_PAYMENT: "Payment Collected",
  PAY_LATER: "Approved to Proceed — Pay at Delivery",
  PACK_ORDER: "Packed & QR Generated",
  DISPATCH_TO_PROCESSING: "Dispatched to Processing Center",
  RECEIVE_AT_PROCESSING: "Received at Processing Center",
  ALL_ITEMS_COMPLETE: "All Garments Completed Processing & QC",
  DISPATCH_TO_STORE: "Dispatched back to Store",
  RECEIVE_AT_STORE: "Received at Store",
  MARK_DELIVERED: "Delivered",
  CANCEL: "Cancelled",
  QC_PASS: "QC Passed",
  QC_REWORK: "Sent for Rework",
  PICKUP_REQUESTED: "Pickup Requested",
  PICKUP_ASSIGNED: "Pickup Assigned",
  PICKUP_UNASSIGNED: "Pickup Unassigned",
  PICKUP_ACCEPTED: "Pickup Accepted",
  PICKUP_REJECTED: "Pickup Rejected",
  PICKUP_CANCELLED: "Pickup Cancelled",
  DELIVERY_REQUESTED: "Delivery Requested",
  DELIVERY_ASSIGNED: "Delivery Assigned",
  DELIVERY_UNASSIGNED: "Delivery Unassigned",
  DELIVERY_ACCEPTED: "Delivery Accepted",
  DELIVERY_REJECTED: "Delivery Rejected",
  DELIVERY_CANCELLED: "Delivery Cancelled",
}
export const actionLabel = (a: string) => ACTION_LABELS[a] || a.replace(/_/g, " ")

// The Store Counter operational queues — each is a status the counter staff
// act on, in workflow order.
export const STORE_COUNTER_QUEUES: { status: LaundryOrderStatus; title: string }[] = [
  { status: "PENDING_STORE_AUDIT", title: "Store Audit" },
  { status: "PAYMENT_PENDING",     title: "Payment Collection" },
  { status: "READY_FOR_PROCESSING", title: "Packing & QR" },
  { status: "PACKED",              title: "Transit to Processing" },
  { status: "RETURN_IN_TRANSIT",   title: "Store Receive" },
  { status: "READY_FOR_DELIVERY",  title: "Ready for Delivery" },
]
