// ============================================================================
// QUANTIX CORE — Lead Activities API
// GET  /api/core/leads/[leadId]/activities — Get lead activity timeline
// POST /api/core/leads/[leadId]/activities — Add activity/comment
//
// Auth required (QUANTIX_SUPER_ADMIN or QUANTIX_SALES_TEAM)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// GET — Get lead activity timeline
// ---------------------------------------------------------------------------
export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(
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
        select: { id: true, businessName: true, stage: true },
      });

      if (!lead) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        );
      }

      // Get activity logs for the lead
      const activities = await db.activityLog.findMany({
        where: {
          entity: 'Lead',
          entityId: leadId,
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

      // Transform activities for timeline
      const timeline = activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        details: activity.details ? JSON.parse(activity.details) : null,
        user: activity.user
          ? {
              id: activity.user.id,
              name: activity.user.name,
              email: activity.user.email,
              avatar: activity.user.avatar,
            }
          : null,
        ip: activity.ip,
        createdAt: activity.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data: {
          lead: {
            id: lead.id,
            businessName: lead.businessName,
            stage: lead.stage,
          },
          activities: timeline,
          total: timeline.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch lead activities';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);

// ---------------------------------------------------------------------------
// POST — Add activity/comment
// ---------------------------------------------------------------------------
export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(
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

      const body = await req.json();

      if (!body.type) {
        return NextResponse.json(
          { success: false, error: 'type is required' },
          { status: 400 }
        );
      }
      if (!body.content) {
        return NextResponse.json(
          { success: false, error: 'content is required' },
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

      // Create activity log entry
      const activity = await db.activityLog.create({
        data: {
          businessId: user.businessId || null,
          userId: user.id,
          action: `lead.${body.type}`,
          entity: 'Lead',
          entityId: leadId,
          details: JSON.stringify({
            type: body.type,
            content: body.content,
            metadata: body.metadata || {},
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

      // Update lead's lastContactedAt if activity is a contact-related type
      const contactTypes = ['call', 'email', 'whatsapp', 'meeting', 'follow_up'];
      if (contactTypes.includes(body.type)) {
        await db.lead.update({
          where: { id: leadId },
          data: { lastContactedAt: new Date() },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            id: activity.id,
            action: activity.action,
            details: JSON.parse(activity.details || '{}'),
            user: activity.user
              ? {
                  id: activity.user.id,
                  name: activity.user.name,
                  email: activity.user.email,
                  avatar: activity.user.avatar,
                }
              : null,
            createdAt: activity.createdAt,
          },
          message: 'Activity added successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add activity';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
