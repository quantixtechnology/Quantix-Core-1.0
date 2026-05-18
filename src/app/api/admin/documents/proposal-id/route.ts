// ============================================================================
// POST /api/admin/documents/proposal-id
// Generates and returns the next immutable QX-YYYYMM-XXX proposal ID.
// Called once when the proposal builder loads — the returned ID is locked
// to that session and stored with the document on save.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { generateProposalId } from '@/lib/proposal-id'
import { db } from '@/lib/db'

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:create',
})(async () => {
  try {
    const proposalId = await generateProposalId(db)
    return NextResponse.json({ success: true, proposalId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate proposal ID'
    return createErrorResponse(message, 500)
  }
})
