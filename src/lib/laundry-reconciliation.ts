// ============================================================================
// ADMINISTRATIVE RECONCILIATION — the attested repair of an order the SYSTEM
// failed to record, never a shortcut through the workflow.
//
// The problem it exists for: during the workflow outage, garments were washed,
// packed and handed to customers while the order's status never moved. The
// physical work is finished; only the record is wrong. Those orders are
// stranded in stages whose only exits are custody edges — PACK_ORDER,
// DISPATCH_TO_PROCESSING, MARK_DELIVERED — which can only ever be taken by the
// person physically performing them. Correctly: laundry-order-state.ts exists
// because a burst of clicks once walked orders to DELIVERED with no garments,
// no processing and no delivery.
//
// So this is deliberately NOT a workflow transition and NOT a relaxation of
// those guards. Nothing here grants `allowInternal` or `custodyAction`, no edge
// is added to TRANSITIONS, and the normal flow is untouched — an order that
// completes through the real delivery engine still takes exactly the path it
// always did.
//
// What it is instead: a NAMED HUMAN ATTESTATION, recorded as its own kind of
// fact. The attestation is the evidence, it is weaker than a scan, and it is
// marked as such permanently:
//
//   • `administrativelyReconciled` is true forever on that order;
//   • `reconciliationType` says which attestation was made;
//   • `reconciledFromStatus` preserves the stage it was stranded in;
//   • the reason, the actor and the timestamp are stored, not inferred;
//   • `actualCompletionAt` records when the work REALLY happened, which is not
//     when someone typed it, and is kept out of `deliveredAt` so a reconciled
//     order can never be counted as a scanned delivery.
//
// Reporting reads `administrativelyReconciled` to separate "Delivered" from
// "Delivered — Administrative Reconciliation". A number that cannot tell those
// apart is the thing this is meant to prevent.
// ============================================================================
import { statusLabel } from "@/lib/laundry-workflow"

export type ReconciliationType = "ADMIN_DELIVERED" | "ADMIN_CANCEL"

/** The status each attestation lands the order in. The ONLY two destinations. */
export const RECONCILIATION_TARGET: Record<ReconciliationType, "DELIVERED" | "CANCELLED"> = {
  ADMIN_DELIVERED: "DELIVERED",
  ADMIN_CANCEL: "CANCELLED",
}

/** The timeline action written for each — distinct from every workflow action. */
export const RECONCILIATION_EVENT: Record<ReconciliationType, string> = {
  ADMIN_DELIVERED: "ADMIN_RECONCILE_DELIVERED",
  ADMIN_CANCEL: "ADMIN_RECONCILE_CANCELLED",
}

/** What the badge says wherever the order is shown. */
export const RECONCILIATION_LABEL: Record<ReconciliationType, string> = {
  ADMIN_DELIVERED: "Administratively Delivered",
  ADMIN_CANCEL: "Administratively Cancelled",
}

/** A reason must be a real sentence, not a keystroke to get past the field. */
export const MIN_REASON_LENGTH = 10

export interface ReconciliationActor {
  /** The caller's BusinessUser role, or platform role in support mode. */
  role: string | null | undefined
  /** True only for the tenant's own owner. */
  isBusinessOwner: boolean
  /** True only for the platform Super Admin. */
  isSuperAdmin: boolean
}

export interface ReconcilableOrder {
  status: string
  administrativelyReconciled?: boolean | null
  reconciliationType?: string | null
}

export type ReconcileVerdict =
  | { ok: true; type: ReconciliationType; to: "DELIVERED" | "CANCELLED" }
  | { ok: false; code: string; error: string }

/**
 * Owner or Super Admin ONLY.
 *
 * Deliberately NOT `resolved.isOwner`: that flag is true for every platform
 * role in support mode, which includes READ_ONLY_AUDITOR and the sales roles.
 * A full-access staff role does not qualify either — reach is not ownership,
 * and this action rewrites the truth of a completed order.
 */
export function mayReconcile(actor: ReconciliationActor): boolean {
  return !!actor && (actor.isBusinessOwner || actor.isSuperAdmin)
}

/** Terminal states carry no workflow claim left to reconcile. */
export const ALREADY_FINAL = new Set(["DELIVERED", "CANCELLED"])

/**
 * May this order take this attestation, from this actor, with this reason?
 *
 * Every refusal is a distinct code so the screen can say which rule was hit
 * rather than showing one generic failure.
 */
export function assertReconcilable(
  order: ReconcilableOrder | null | undefined,
  type: string | null | undefined,
  reason: string | null | undefined,
  actor: ReconciliationActor,
): ReconcileVerdict {
  if (!order) return { ok: false, code: "NOT_FOUND", error: "Order not found." }

  if (!mayReconcile(actor)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Administrative reconciliation is restricted to the business Owner and Super Admin.",
    }
  }

  if (type !== "ADMIN_DELIVERED" && type !== "ADMIN_CANCEL") {
    return { ok: false, code: "INVALID_TYPE", error: "Choose whether this order was delivered or cancelled." }
  }

  const text = String(reason || "").trim()
  if (!text) {
    return { ok: false, code: "REASON_REQUIRED", error: "A reason is required — say why this order is being reconciled." }
  }
  if (text.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      error: `The reason must explain what happened (at least ${MIN_REASON_LENGTH} characters).`,
    }
  }

  // NOT REPEATABLE. A second attestation over the first would overwrite the
  // record of who said what, which is the only thing this mechanism produces.
  if (order.administrativelyReconciled) {
    const was = (order.reconciliationType as ReconciliationType) || null
    return {
      ok: false,
      code: "ALREADY_RECONCILED",
      error: was
        ? `This order was already reconciled as ${RECONCILIATION_LABEL[was]}. Reconciliation cannot be repeated.`
        : "This order has already been administratively reconciled.",
    }
  }

  const to = RECONCILIATION_TARGET[type]

  // An order that reached DELIVERED or CANCELLED through the real workflow is
  // already true — there is nothing stranded to repair, and overwriting it
  // would replace a system-observed fact with a weaker attested one.
  if (ALREADY_FINAL.has(order.status)) {
    return {
      ok: false,
      code: "ALREADY_FINAL",
      error: `This order is already ${statusLabel(order.status)} through the normal workflow — it does not need reconciliation.`,
    }
  }

  return { ok: true, type, to }
}

/** One sentence for the timeline, carrying the stage the order was stranded in. */
export function reconciliationNote(type: ReconciliationType, fromStatus: string, reason: string): string {
  return `${RECONCILIATION_LABEL[type]} — stranded at ${statusLabel(fromStatus)}. ${String(reason).trim()}`
}

/** How a status reads once an attestation is on the order. */
export function reconciledStatusLabel(
  status: string,
  administrativelyReconciled?: boolean | null,
  type?: string | null,
): string {
  if (!administrativelyReconciled) return statusLabel(status)
  const t = type as ReconciliationType | null
  return t && RECONCILIATION_LABEL[t] ? RECONCILIATION_LABEL[t] : `${statusLabel(status)} — Administrative Reconciliation`;
}
