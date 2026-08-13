// Which registered screen governs role administration.
//
// The sidebar navigates to Roles & Permissions with laundry.roles, but every
// /api/laundry/rbac/roles endpoint asked for laundry.staff. That is a
// disagreement in both directions at once: a Store Manager holds laundry.staff
// and no laundry.roles, so the API let them read and rename roles they cannot
// see a menu item for, while a role granted laundry.roles alone would have
// opened the screen and been refused by every call it makes.
//
// Reads accept EITHER screen, because two screens genuinely read the role list:
// Roles & Permissions renders the matrix from it, and Staff fills its "assign a
// role" dropdown from it. Writes require laundry.roles — changing who can do
// what in the workspace is the Roles & Permissions screen, and nothing else.
//
// No new permission key: both are existing registered screens.

export const ROLE_ADMIN_SCREEN = "laundry.roles"

/** Roles & Permissions, or Staff needing the list to assign one. */
export const ROLE_READ_SCREENS = [ROLE_ADMIN_SCREEN, "laundry.staff"]
