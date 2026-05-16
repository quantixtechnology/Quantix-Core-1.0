// ============================================================================
// QUANTIX CORE — Lead Comments API
// GET  /api/core/leads/[leadId]/comments — Get lead comments
// POST /api/core/leads/[leadId]/comments — Add comment
//
// Auth required
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// GET — Get lead comments
// ---------------------------------------------------------------------------
export const GET = withMiddleware({ requireAuth: true })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const leadId = params?.leadId as string;

      if (!leadId) {
        return NextResponse.json(
          { success: false, error: 'leadId is required' },
          { status: 400 }
        );
      }

      // Verify lead exists
      const lead = await db.lead.findUnique({
        where: { id: leadId },
        select: { id: true, businessName: true },
      });

      if (!lead) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        );
      }

      // Get comment-type activities for the lead
      const comments = await db.activityLog.findMany({
        where: {
          entity: 'Lead',
          entityId: leadId,
          action: {
            in: ['lead.comment', 'lead.follow_up', 'lead.call_outcome'],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform for comments view
      const commentsList = comments.map((comment) => {
        const details = comment.details ? JSON.parse(comment.details) : {} as Record<string, unknown>;
        return {
          id: comment.id,
          type: (comment.action as string).replace('lead.', ''),
          content: (details as Record<string, unknown>).content || '',
          metadata: (details as Record<string, unknown>).metadata || {},
          user: comment.user
            ? {
                id: comment.user.id,
                name: comment.user.name,
                email: comment.user.email,
                avatar: comment.user.avatar,
              }
            : null,
          createdAt: comment.createdAt,
        };
      });

      return NextResponse.json({
        success: true,
        data: commentsList,
        total: commentsList.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch comments';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);

// ---------------------------------------------------------------------------
// POST — Add comment
// ---------------------------------------------------------------------------
export const POST = withMiddleware({ requireAuth: true })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const leadId = params?.leadId as string;
      const user = req.user!;

      if (!leadId) {
        return NextResponse.json(
          { success: false, error: 'leadId is required' },
          { status: 400 }
        );
      }

      // req.text() + JSON.parse is more reliable than req.json() in Next.js 15 App Router
      let body: { type?: string; content?: string }
      try {
        const raw = await req.text()
        body = raw ? JSON.parse(raw) : {}
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid request body — expected JSON' },
          { status: 400 }
        )
      }

      if (!body.content?.trim()) {
        return NextResponse.json(
          { success: false, error: 'content is required' },
          { status: 400 }
        );
      }

      const type = body.type || 'comment';
      const validTypes = ['comment', 'follow_up', 'call_outcome'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Verify lead exists
      const lead = await db.lead.findUnique({
        where: { id: leadId },
        select: { id: true, businessName: true },
      });

      if (!lead) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        );
      }

      // Create activity log entry as comment
      const comment = await db.activityLog.create({
        data: {
          businessId: user.businessId || null,
          userId: user.id,
          action: `lead.${type}`,
          entity: 'Lead',
          entityId: leadId,
          details: JSON.stringify({
            type,
            content: body.content,
            leadName: lead.businessName,
            addedBy: user.name,
          }),
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
          userAgent: req.headers.get('user-agent') || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      // Update lead's lastContactedAt for follow_up or call_outcome
      if (type === 'follow_up' || type === 'call_outcome') {
        await db.lead.update({
          where: { id: leadId },
          data: { lastContactedAt: new Date() },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            id: comment.id,
            type,
            content: body.content,
            user: comment.user
              ? {
                  id: comment.user.id,
                  name: comment.user.name,
                  email: comment.user.email,
                  avatar: comment.user.avatar,
                }
              : null,
            createdAt: comment.createdAt,
          },
          message: 'Comment added successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[comments POST] Error:', error)
      const message = error instanceof Error ? error.message : 'Failed to add comment';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
