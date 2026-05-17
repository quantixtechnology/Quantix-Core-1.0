// ============================================================================
// GET /api/admin/leads/mtd-report?month=4&year=2025
// Returns per-sales-rep lead stage counts for a given calendar month.
// Used by the MTD (Month-to-Date) report table in the Leads view.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'leads:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10);
    const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()),  10);

    if (month < 1 || month > 12 || isNaN(year)) {
      return createErrorResponse('Invalid month or year', 400);
    }

    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month,     1); // first day of next month (exclusive)

    // Fetch all leads created in the month with their sales rep
    const leads = await db.lead.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: {
        stage: true,
        salesRepId: true,
        salesRep: { select: { id: true, name: true } },
      },
    });

    // Fetch all active sales reps so we include reps with zero leads
    const salesTeam = await db.salesTeamMember.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    type RepRow = {
      repId: string;
      repName: string;
      totalLeads: number;
      notCalled: number;    // LEAD stage (not yet worked)
      closed: number;       // CLOSED_WON
      followUp: number;     // FOLLOW_UP
      interested: number;   // INTERESTED
      notInterested: number;// NOT_INTERESTED
      wrongNumber: number;  // WRONG_NUMBER
      rnr: number;          // RNR
      webCallPlanned: number;// DEMO_PLANNED
      webCallDone: number;  // DEMO_DONE
      hotLead: number;      // HOT_LEAD
      totalAttempted: number;// totalLeads - notCalled
    };

    const map = new Map<string, RepRow>();

    // Initialise a row for every active rep (so zero-lead months still show)
    for (const rep of salesTeam) {
      map.set(rep.id, {
        repId: rep.id, repName: rep.name,
        totalLeads: 0, notCalled: 0, closed: 0, followUp: 0,
        interested: 0, notInterested: 0, wrongNumber: 0, rnr: 0,
        webCallPlanned: 0, webCallDone: 0, hotLead: 0, totalAttempted: 0,
      });
    }

    // Also create a row for any rep found in leads but not in active team list
    // (e.g. deactivated rep who had leads this month)
    for (const lead of leads) {
      if (lead.salesRepId && !map.has(lead.salesRepId)) {
        map.set(lead.salesRepId, {
          repId: lead.salesRepId,
          repName: lead.salesRep?.name ?? 'Unknown',
          totalLeads: 0, notCalled: 0, closed: 0, followUp: 0,
          interested: 0, notInterested: 0, wrongNumber: 0, rnr: 0,
          webCallPlanned: 0, webCallDone: 0, hotLead: 0, totalAttempted: 0,
        });
      }
    }

    // Aggregate stage counts per rep
    for (const lead of leads) {
      const key = lead.salesRepId ?? '__unassigned__';
      if (!map.has(key)) {
        map.set(key, {
          repId: key, repName: 'Unassigned',
          totalLeads: 0, notCalled: 0, closed: 0, followUp: 0,
          interested: 0, notInterested: 0, wrongNumber: 0, rnr: 0,
          webCallPlanned: 0, webCallDone: 0, hotLead: 0, totalAttempted: 0,
        });
      }
      const row = map.get(key)!;
      row.totalLeads++;
      switch (lead.stage) {
        case 'LEAD':             row.notCalled++;      break;
        case 'CLOSED_WON':       row.closed++;         break;
        case 'FOLLOW_UP':        row.followUp++;       break;
        case 'INTERESTED':       row.interested++;     break;
        case 'NOT_INTERESTED':   row.notInterested++;  break;
        case 'WRONG_NUMBER':     row.wrongNumber++;    break;
        case 'RNR':              row.rnr++;            break;
        case 'DEMO_PLANNED':     row.webCallPlanned++; break;
        case 'DEMO_DONE':        row.webCallDone++;    break;
        case 'HOT_LEAD':         row.hotLead++;        break;
      }
    }

    // Compute totalAttempted = totalLeads - notCalled for each row
    const reps: RepRow[] = [];
    for (const row of map.values()) {
      row.totalAttempted = row.totalLeads - row.notCalled;
      reps.push(row);
    }

    // Sort: reps with leads first (desc total), then alphabetical
    reps.sort((a, b) => b.totalLeads - a.totalLeads || a.repName.localeCompare(b.repName));

    // Totals row
    const totals: Omit<RepRow, 'repId' | 'repName'> = {
      totalLeads: 0, notCalled: 0, closed: 0, followUp: 0,
      interested: 0, notInterested: 0, wrongNumber: 0, rnr: 0,
      webCallPlanned: 0, webCallDone: 0, hotLead: 0, totalAttempted: 0,
    };
    for (const r of reps) {
      totals.totalLeads     += r.totalLeads;
      totals.notCalled      += r.notCalled;
      totals.closed         += r.closed;
      totals.followUp       += r.followUp;
      totals.interested     += r.interested;
      totals.notInterested  += r.notInterested;
      totals.wrongNumber    += r.wrongNumber;
      totals.rnr            += r.rnr;
      totals.webCallPlanned += r.webCallPlanned;
      totals.webCallDone    += r.webCallDone;
      totals.hotLead        += r.hotLead;
      totals.totalAttempted += r.totalAttempted;
    }

    return NextResponse.json({ success: true, data: { month, year, reps, totals } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate MTD report';
    return createErrorResponse(message, 500);
  }
});
