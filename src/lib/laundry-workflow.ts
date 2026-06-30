// ============================================================================
// Laundry Order Workflow Engine — single source of truth for the operational
// lifecycle. Drives stage transitions across departments. The transition API
// (POST /api/laundry/orders/[id]/transition) validates against this state
// machine, updates the order status, and writes a LaundryOrderEvent (audit
// trail / timeline). Department screens read the queues + allowed actions here.
//
// LaundryOrderStatus enum: DRAFT, PENDING_STORE_AUDIT, UNDER_AUDIT,
// PAYMENT_PENDING, READY_FOR_PROCESSING, PROCESSING, QC_PENDING,
// READY_FOR_DELIVERY, DELIVERED, CANCELLED.
// ============================================================================

export type LaundryOrderStatus =
  | "DRAFT" | "PENDING_STORE_AUDIT" | "UNDER_AUDIT" | "PAYMENT_PENDING"
  | "READY_FOR_PROCESSING" | "PROCESSING" | "QC_PENDING"
  | "READY_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"

// Department that owns a status (where the order is currently sitting).
export type LaundryDepartmentKey =
  | "STORE_COUNTER" | "PROCESSING_CENTER" | "QC" | "DELIVERY" | "DONE"

export interface StatusMeta {
  label: string
  department: LaundryDepartmentKey
  terminal?: boolean
}

export const STATUS_META: Record<LaundryOrderStatus, StatusMeta> = {
  DRAFT:                { label: "Draft",                department: "STORE_COUNTER" },
  PENDING_STORE_AUDIT:  { label: "Pending Store Audit",  department: "STORE_COUNTER" },
  UNDER_AUDIT:          { label: "Under Audit",          department: "STORE_COUNTER" },
  PAYMENT_PENDING:      { label: "Payment Pending",      department: "STORE_COUNTER" },
  READY_FOR_PROCESSING: { label: "Ready for Processing", department: "STORE_COUNTER" },
  PROCESSING:           { label: "In Processing",        department: "PROCESSING_CENTER" },
  QC_PENDING:           { label: "QC Pending",           department: "QC" },
  READY_FOR_DELIVERY:   { label: "Ready for Delivery",   department: "DELIVERY" },
  DELIVERED:            { label: "Delivered",            department: "DONE", terminal: true },
  CANCELLED:            { label: "Cancelled",            department: "DONE", terminal: true },
}

export interface TransitionDef {
  to: LaundryOrderStatus
  action: string   // machine code, stored on the event
  label: string    // button label
  primary?: boolean
}

// Allowed forward (and corrective) transitions per status.
export const TRANSITIONS: Record<LaundryOrderStatus, TransitionDef[]> = {
  DRAFT: [
    { to: "PENDING_STORE_AUDIT", action: "SUBMIT_ORDER", label: "Submit for Audit", primary: true },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  PENDING_STORE_AUDIT: [
    { to: "UNDER_AUDIT", action: "START_AUDIT", label: "Start Audit", primary: true },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  UNDER_AUDIT: [
    { to: "PAYMENT_PENDING", action: "COMPLETE_AUDIT", label: "Complete Audit", primary: true },
    { to: "PENDING_STORE_AUDIT", action: "REOPEN_AUDIT", label: "Send Back" },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  PAYMENT_PENDING: [
    { to: "READY_FOR_PROCESSING", action: "COLLECT_PAYMENT", label: "Collect Payment", primary: true },
    { to: "CANCELLED", action: "CANCEL", label: "Cancel" },
  ],
  READY_FOR_PROCESSING: [
    { to: "PROCESSING", action: "DISPATCH_TO_PROCESSING", label: "Dispatch to Processing", primary: true },
  ],
  PROCESSING: [
    { to: "QC_PENDING", action: "SEND_TO_QC", label: "Send to QC", primary: true },
  ],
  QC_PENDING: [
    { to: "READY_FOR_DELIVERY", action: "QC_PASS", label: "QC Pass", primary: true },
    { to: "PROCESSING", action: "QC_REWORK", label: "Send for Rework" },
  ],
  READY_FOR_DELIVERY: [
    { to: "DELIVERED", action: "MARK_DELIVERED", label: "Mark Delivered", primary: true },
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

// The Store Counter operational queues (Slice 1) — each is a status the counter
// staff act on, in workflow order.
export const STORE_COUNTER_QUEUES: { status: LaundryOrderStatus; title: string }[] = [
  { status: "PENDING_STORE_AUDIT", title: "Store Audit" },
  { status: "PAYMENT_PENDING",     title: "Payment Collection" },
  { status: "READY_FOR_PROCESSING", title: "Dispatch to Processing" },
]
