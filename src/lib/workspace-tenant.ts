// Which business the Laundry OS workspace opens — decided from the SESSION,
// with the URL as a hint it may refuse.
//
// The workspace host used to carry the tenant: laundry.<base>/<businessId>.
// The client read that first path segment and made it the active business with
// no membership check, so a Business A operator opening Business B's URL got a
// workspace that believed it was inside Business B. Nothing leaked — every
// /api/laundry route resolves the caller against the business it is given, and
// getLaundryAuthContext requires an active BusinessUser row, so B's data came
// back 401 and the workspace gate refused entry. But "try it and let the server
// reject it" is the wrong shape: it burns a round trip to reach a dead screen,
// and it makes a URL look like it carries authority.
//
// So the URL is a HINT. It is honoured only when the session already says the
// person belongs there. It never becomes the answer on its own, and this
// function cannot make anything true: it only picks between ids the session is
// already holding. The server remains the authority for every request that
// follows, exactly as before.

export interface WorkspaceTenantInput {
  /** Business id in the workspace URL, if any. Untrusted. */
  urlBusinessId: string | null | undefined
  /** Platform business ids the authenticated session is a member of. */
  memberBusinessIds: readonly string[]
  /** The session's current business, if one is already chosen. */
  currentBusinessId: string | null | undefined
  /**
   * Platform staff (Super Admin, Platform Admin, support …) hold no
   * BusinessUser rows and are deliberately unrestricted — "Open Workspace"
   * hands them any tenant, and the server grants them support mode. Narrowing
   * them here would break that, so the existing rule is preserved untouched.
   */
  isPlatformRole: boolean
}

export type WorkspaceTenantSource = "url" | "platform" | "session" | "membership" | "none"

export interface WorkspaceTenant {
  businessId: string | null
  source: WorkspaceTenantSource
  /** True when a URL named a business the session may not enter. */
  refusedUrlBusinessId: boolean
}

export function resolveWorkspaceTenant(i: WorkspaceTenantInput): WorkspaceTenant {
  const url = i.urlBusinessId || null
  const member = url ? i.memberBusinessIds.includes(url) : false

  if (url && i.isPlatformRole) return { businessId: url, source: "platform", refusedUrlBusinessId: false }
  if (url && member) return { businessId: url, source: "url", refusedUrlBusinessId: false }

  // Either no URL business, or one this session has no membership for. Fall
  // back to what the session itself authorises — never to the URL.
  const refused = !!url && !member
  if (i.currentBusinessId) return { businessId: i.currentBusinessId, source: "session", refusedUrlBusinessId: refused }
  if (i.memberBusinessIds.length) return { businessId: i.memberBusinessIds[0], source: "membership", refusedUrlBusinessId: refused }

  // No business at all. The workspace gate shows its existing no-access state;
  // nothing here invents one.
  return { businessId: null, source: "none", refusedUrlBusinessId: refused }
}
