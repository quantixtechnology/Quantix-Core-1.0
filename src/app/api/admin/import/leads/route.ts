// ============================================================================
// Route: POST /api/admin/import/leads
// Bulk-import leads from CSV/Excel (parsed on frontend, sent as JSON rows).
//
// Supports:
//   - New lead creation with auto-generated Lead ID (LED-YYYYMM-XXXX)
//   - Upsert by leadId: if leadId column present and matches existing → update
//   - salesRepName column: match salesperson by name, reject if not found
//   - Duplicate detection by email + phone (skipped for upsert rows)
//   - Audit log written to LeadImportLog
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { generateLeadId } from '@/lib/lead-id';

export type ImportLeadRow = {
  leadId?: string;          // If present → upsert; if absent → new lead
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city?: string;
  state?: string;
  pincode?: string;
  businessType?: string;
  source?: string;
  stage?: string;
  estimatedValue?: number | string;
  notes?: string;
  followUpDate?: string;
  tags?: string;
  salesRepName?: string;    // Name-based lookup — resolved to salesRepId
  salesRepId?: string;      // Direct ID assignment (takes precedence over salesRepName)
  assignedToUserId?: string; // Direct User ID assignment
};

export type ImportLeadResult = {
  row: number;
  status: 'imported' | 'updated' | 'duplicate' | 'error';
  leadId?: string;
  reason?: string;
  data: ImportLeadRow;
};

const VALID_BUSINESS_TYPES = new Set([
  'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
  'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY', 'FURNITURE', 'DIRECTORY',
]);

const VALID_SOURCES = new Set([
  'META_ADS', 'GOOGLE_ADS', 'DIRECT_REFERRAL', 'WEBSITE_INQUIRY',
  'COLD_OUTREACH', 'WHATSAPP_INQUIRY', 'PHONE_CALL', 'OTHER',
]);

const VALID_STAGES = new Set([
  'LEAD', 'FOLLOW_UP', 'INTERESTED', 'HOT_LEAD',
  'NOT_INTERESTED', 'WRONG_NUMBER', 'RNR',
  'DEMO_PLANNED', 'DEMO_DONE',
  'NEGOTIATION', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED',
  'CLOSED_WON', 'LOST', 'DUPLICATE',
]);

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'import:leads',
})(async (req) => {
  try {
    const body = await req.json();
    const rows: ImportLeadRow[] = body.rows;
    const globalSalesRepId: string | undefined = body.salesRepId;
    const globalAssignedToUserId: string | undefined = body.assignedToUserId;
    const fileName: string | undefined = body.fileName;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows provided' }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json({ success: false, error: 'Maximum 2000 rows per import' }, { status: 400 });
    }

    // Pre-fetch all existing emails + phones for O(1) duplicate lookup (for new leads)
    const existingLeads = await db.lead.findMany({
      select: { id: true, leadId: true, contactEmail: true, contactPhone: true },
    });
    const existingEmails = new Set(existingLeads.map((l) => l.contactEmail.toLowerCase().trim()));
    const existingPhones = new Set(existingLeads.map((l) => l.contactPhone.trim()));
    const existingLeadIds = new Map(
      existingLeads.filter((l) => l.leadId).map((l) => [l.leadId!, l.id])
    );

    // Build salesperson name→id lookup (case-insensitive)
    const salesTeam = await db.salesTeamMember.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
    });
    const salesRepByName = new Map(
      salesTeam.map((m) => [m.name.toLowerCase().trim(), m.id])
    );

    // Track within-batch duplicates (new leads only)
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();

    const results: ImportLeadResult[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const incomingLeadId = row.leadId?.trim();

      // ── Resolve salesRep ────────────────────────────────────────────────────
      let resolvedSalesRepId: string | null = globalSalesRepId || row.salesRepId || null;

      if (!resolvedSalesRepId && row.salesRepName?.trim()) {
        const nameKey = row.salesRepName.toLowerCase().trim();
        const found = salesRepByName.get(nameKey);
        if (!found) {
          results.push({
            row: rowNum,
            status: 'error',
            reason: `Salesperson "${row.salesRepName}" not found. Check name spelling or activate the user.`,
            data: row,
          });
          errorCount++;
          continue;
        }
        resolvedSalesRepId = found;
      }

      // ── Resolve assignedToUserId ───────────────────────────────────────────
      const resolvedAssignedToUserId: string | null = globalAssignedToUserId || row.assignedToUserId || null;

      if (resolvedAssignedToUserId) {
        const assignee = await db.user.findUnique({
          where: { id: resolvedAssignedToUserId },
          select: { id: true, isActive: true },
        });
        if (!assignee || !assignee.isActive) {
          results.push({
            row: rowNum,
            status: 'error',
            reason: `Assigned user "${row.assignedToUserId}" not found or inactive.`,
            data: row,
          });
          errorCount++;
          continue;
        }
      }

      // ── UPSERT PATH: leadId column present and matches existing record ──────
      if (incomingLeadId) {
        const existingDbId = existingLeadIds.get(incomingLeadId);
        if (existingDbId) {
          // Update existing lead
          const businessType = row.businessType && VALID_BUSINESS_TYPES.has(row.businessType.toUpperCase())
            ? row.businessType.toUpperCase()
            : undefined;
          const source = row.source && VALID_SOURCES.has(row.source.toUpperCase())
            ? row.source.toUpperCase()
            : undefined;
          const stage = row.stage && VALID_STAGES.has(row.stage.toUpperCase())
            ? row.stage.toUpperCase()
            : undefined;

          try {
            await db.lead.update({
              where: { id: existingDbId },
              data: {
                ...(row.businessName?.trim() && { businessName: row.businessName.trim() }),
                ...(row.contactName?.trim() && { contactName: row.contactName.trim() }),
                ...(row.city?.trim() && { city: row.city.trim() }),
                ...(row.state?.trim() && { state: row.state.trim() }),
                ...(row.pincode?.trim() && { pincode: row.pincode.trim() }),
                ...(businessType && { businessType: businessType as any }),
                ...(source && { source: source as any }),
                ...(stage && { stage: stage as any }),
                ...(row.notes?.trim() && { notes: row.notes.trim() }),
                ...(row.followUpDate && { followUpDate: new Date(row.followUpDate) }),
                ...(row.estimatedValue !== undefined && { estimatedValue: Number(row.estimatedValue) || null }),
                ...(row.tags && { tags: row.tags }),
                ...(resolvedSalesRepId && { salesRepId: resolvedSalesRepId }),
                ...(resolvedAssignedToUserId && { assignedToUserId: resolvedAssignedToUserId }),
              },
            });

            results.push({ row: rowNum, status: 'updated', leadId: incomingLeadId, data: row });
            updatedCount++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Update failed';
            results.push({ row: rowNum, status: 'error', reason: msg, data: row });
            errorCount++;
          }
          continue;
        }
        // leadId provided but not in DB → fall through to create as new lead with that ID
        // (treat as new lead, will generate a new leadId since we can't force the format)
      }

      // ── CREATE PATH ─────────────────────────────────────────────────────────
      if (!row.businessName?.trim()) {
        results.push({ row: rowNum, status: 'error', reason: 'Missing businessName', data: row });
        errorCount++;
        continue;
      }
      if (!row.contactName?.trim()) {
        results.push({ row: rowNum, status: 'error', reason: 'Missing contactName', data: row });
        errorCount++;
        continue;
      }
      if (!row.contactEmail?.trim()) {
        results.push({ row: rowNum, status: 'error', reason: 'Missing contactEmail', data: row });
        errorCount++;
        continue;
      }
      if (!row.contactPhone?.trim()) {
        results.push({ row: rowNum, status: 'error', reason: 'Missing contactPhone', data: row });
        errorCount++;
        continue;
      }

      const email = row.contactEmail.toLowerCase().trim();
      const phone = row.contactPhone.trim();

      if (existingEmails.has(email) || existingPhones.has(phone)) {
        const dupField = existingEmails.has(email) ? 'email' : 'phone';
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate ${dupField} already exists in database`, data: row });
        duplicateCount++;
        continue;
      }

      if (batchEmails.has(email) || batchPhones.has(phone)) {
        const dupField = batchEmails.has(email) ? 'email' : 'phone';
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate ${dupField} within this import file`, data: row });
        duplicateCount++;
        continue;
      }

      const businessType = row.businessType && VALID_BUSINESS_TYPES.has(row.businessType.toUpperCase())
        ? row.businessType.toUpperCase()
        : 'ECOMMERCE';
      const source = row.source && VALID_SOURCES.has(row.source.toUpperCase())
        ? row.source.toUpperCase()
        : 'WEBSITE_INQUIRY';
      const stage = row.stage && VALID_STAGES.has(row.stage.toUpperCase())
        ? row.stage.toUpperCase()
        : 'LEAD';

      try {
        const newLeadId = await generateLeadId(db);

        await db.lead.create({
          data: {
            leadId: newLeadId,
            businessName: row.businessName.trim(),
            contactName: row.contactName.trim(),
            contactEmail: email,
            contactPhone: phone,
            city: row.city?.trim() || null,
            state: row.state?.trim() || null,
            pincode: row.pincode?.trim() || null,
            businessType: businessType as any,
            source: source as any,
            stage: stage as any,
            estimatedValue: row.estimatedValue ? Number(row.estimatedValue) || null : null,
            notes: row.notes?.trim() || null,
            followUpDate: row.followUpDate ? new Date(row.followUpDate) : null,
            tags: row.tags || '[]',
            salesRepId: resolvedSalesRepId,
            assignedToUserId: resolvedAssignedToUserId,
            createdById: req.user?.id || null,
          },
        });

        batchEmails.add(email);
        batchPhones.add(phone);
        existingEmails.add(email);
        existingPhones.add(phone);

        results.push({ row: rowNum, status: 'imported', leadId: newLeadId, data: row });
        importedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Insert failed';
        results.push({ row: rowNum, status: 'error', reason: msg, data: row });
        errorCount++;
      }
    }

    // Write audit log
    try {
      await db.leadImportLog.create({
        data: {
          importedBy: req.user?.id || 'unknown',
          fileName: fileName || null,
          totalRows: rows.length,
          imported: importedCount,
          duplicates: duplicateCount,
          errors: errorCount,
          notes: `Updated: ${updatedCount}`,
        },
      });
    } catch { /* Audit failure must not block the response */ }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        imported: importedCount,
        updated: updatedCount,
        duplicates: duplicateCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    console.error('[import/leads] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
});
