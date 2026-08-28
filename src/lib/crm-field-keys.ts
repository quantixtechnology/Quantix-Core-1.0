// Canonical CRM lead field keys.
//
// Its own module because both the server (the CRM defaults and their
// reconciliation, which reach for Prisma) and the browser (the lead form, which
// must not) need to agree on these strings. A constant that has to be imported
// through a database module cannot be shared with a client component.

/**
 * The Sales Team Owner field.
 *
 * "lead_owner", not "sales_team_owner": this is the key the Customer form has
 * always read through /api/laundry/settings/sales-owners, so it is the one that
 * exists in tenants configured by hand. Its OPTIONS are the sales roster — the
 * people who may own a lead — which is configuration, not per-lead data.
 */
export const LEAD_OWNER_FIELD_KEY = "lead_owner"

/**
 * One entry of the sales roster, exactly as GET /api/laundry/settings/sales-owners
 * returns it.
 *
 * Shared because every consumer had been declaring its own shape and one of them
 * got it wrong: the lead form typed the roster as { value, label } while the
 * endpoint returns { id, name }, so every option rendered with an undefined
 * value and the dropdown showed only the lead's current owner. The contract now
 * lives beside the field key it comes from, so a mismatch fails to compile.
 *
 * `id` is the configured option's value; `name` is what the operator sees and
 * what a lead stores in assignedToName.
 */
export interface SalesOwner {
  id: string
  name: string
}
