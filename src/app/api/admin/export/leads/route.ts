// ============================================================================
// Route: GET /api/admin/export/leads
// Export leads to XLSX with optional date range and column filters.
// Permission: export:leads (QUANTIX_SUPER_ADMIN only)
//
// Query params:
//   fromDate   — ISO date string (inclusive)
//   toDate     — ISO date string (inclusive, bumped to end of day)
//   stage      — comma-separated LeadStage values
//   source     — comma-separated LeadSource values
//   salesRepId — single SalesTeamMember id
//
// Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// Logs to LeadExportLog (failure does NOT block the download)
// ============================================================================

import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

const STAGE_LABELS: Record<string, string> = {
  LEAD:             'Lead',
  FOLLOW_UP:        'Follow Up',
  INTERESTED:       'Interested',
  HOT_LEAD:         'Hot Lead',
  DEMO_PLANNED:     'Demo Planned',
  DEMO_DONE:        'Demo Done',
  NEGOTIATION:      'Negotiation',
  PAYMENT_PENDING:  'Payment Pending',
  PAYMENT_RECEIVED: 'Payment Received',
  CLOSED_WON:       'Closed Won',
  NOT_INTERESTED:   'Not Interested',
  WRONG_NUMBER:     'Wrong Number',
  RNR:              'RNR',
  LOST:             'Lost',
  DUPLICATE:        'Duplicate',
};

const SOURCE_LABELS: Record<string, string> = {
  META_ADS:         'Meta Ads',
  GOOGLE_ADS:       'Google Ads',
  DIRECT_REFERRAL:  'Direct Referral',
  WEBSITE_INQUIRY:  'Website Inquiry',
  COLD_OUTREACH:    'Cold Outreach',
  WHATSAPP_INQUIRY: 'WhatsApp Inquiry',
  PHONE_CALL:       'Phone Call',
  OTHER:            'Other',
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function parseTags(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join(', ');
  } catch { /* treat as plain string */ }
  return raw;
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'export:leads',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const fromDateParam  = searchParams.get('fromDate');
    const toDateParam    = searchParams.get('toDate');
    const stageParam     = searchParams.get('stage');
    const sourceParam    = searchParams.get('source');
    const salesRepId     = searchParams.get('salesRepId');

    // Build Prisma where clause
    const where: Record<string, unknown> = {};

    if (fromDateParam || toDateParam) {
      const createdAt: Record<string, Date> = {};
      if (fromDateParam) createdAt.gte = new Date(fromDateParam);
      if (toDateParam) {
        const to = new Date(toDateParam);
        to.setHours(23, 59, 59, 999);
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }

    if (stageParam) {
      where.stage = { in: stageParam.split(',') };
    }

    if (sourceParam) {
      where.source = { in: sourceParam.split(',') };
    }

    if (salesRepId) {
      where.salesRepId = salesRepId;
    }

    const leads = await db.lead.findMany({
      where,
      include: {
        salesRep: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build XLSX rows
    const headers = [
      'Lead ID', 'Business Name', 'Contact Name', 'Mobile', 'Email',
      'City', 'State', 'Pincode', 'Business Type', 'Source', 'Stage',
      'Assigned Salesperson', 'Estimated Value (INR)', 'Tags', 'Notes',
      'Follow-up Date', 'Last Follow-up Date', 'Created Date',
    ];

    const dataRows = leads.map((l) => [
      l.leadId || '',
      l.businessName,
      l.contactName,
      l.contactPhone,
      l.contactEmail,
      l.city || '',
      l.state || '',
      l.pincode || '',
      l.businessType,
      SOURCE_LABELS[l.source] ?? l.source,
      STAGE_LABELS[l.stage]  ?? l.stage,
      l.salesRep?.name || '',
      l.estimatedValue != null ? l.estimatedValue : '',
      parseTags(l.tags),
      l.notes || '',
      fmtDate(l.followUpDate),
      fmtDate(l.lastFollowUpAt),
      fmtDate(l.createdAt),
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = [
      { wch: 18 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 28 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 32 },
      { wch: 14 }, { wch: 18 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const today = fmtDate(new Date());
    const filename = `quantix_leads_export_${today}.xlsx`;

    // Audit log (non-blocking)
    try {
      await db.leadExportLog.create({
        data: {
          exportedBy: req.user?.id || 'unknown',
          fromDate: fromDateParam ? new Date(fromDateParam) : null,
          toDate: toDateParam ? new Date(toDateParam) : null,
          filters: JSON.stringify({ stage: stageParam, source: sourceParam, salesRepId }),
          rowCount: leads.length,
        },
      });
    } catch { /* audit failure must not block the download */ }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('[export/leads] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
});
