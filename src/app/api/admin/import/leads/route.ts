// ============================================================================
// Route: POST /api/admin/import/leads
// Bulk-import leads from CSV/Excel (parsed on frontend, sent as JSON rows).
// Runs duplicate check per row before inserting.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export type ImportLeadRow = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city?: string;
  businessType?: string;
  source?: string;
  stage?: string;
  estimatedValue?: number;
  notes?: string;
  followUpDate?: string;
  tags?: string;
};

export type ImportLeadResult = {
  row: number;
  status: 'imported' | 'duplicate' | 'error';
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
  'LEAD', 'DEMO_SHARED', 'NEGOTIATION', 'PAYMENT_PENDING',
  'PAYMENT_RECEIVED', 'ONBOARDING', 'DEPLOYMENT', 'ACTIVE', 'LOST', 'CHURNED',
]);

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'import:leads',
})(async (req) => {
  try {
    const body = await req.json();
    const rows: ImportLeadRow[] = body.rows;
    const assignToSalesRepId: string | undefined = body.salesRepId;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows provided' }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json({ success: false, error: 'Maximum 2000 rows per import' }, { status: 400 });
    }

    // Pre-fetch all existing emails + phones for O(1) duplicate lookup
    const existingLeads = await db.lead.findMany({
      select: { contactEmail: true, contactPhone: true },
    });
    const existingEmails = new Set(existingLeads.map((l) => l.contactEmail.toLowerCase().trim()));
    const existingPhones = new Set(existingLeads.map((l) => l.contactPhone.trim()));

    // Also track emails/phones already seen within THIS import batch
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();

    const results: ImportLeadResult[] = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Required field validation
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

      // Duplicate check against DB
      if (existingEmails.has(email) || existingPhones.has(phone)) {
        const dupField = existingEmails.has(email) ? 'email' : 'phone';
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate ${dupField} already exists in database`, data: row });
        duplicateCount++;
        continue;
      }

      // Duplicate check within this batch
      if (batchEmails.has(email) || batchPhones.has(phone)) {
        const dupField = batchEmails.has(email) ? 'email' : 'phone';
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate ${dupField} within this import file`, data: row });
        duplicateCount++;
        continue;
      }

      // Sanitise enum fields
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
        await db.lead.create({
          data: {
            businessName: row.businessName.trim(),
            contactName: row.contactName.trim(),
            contactEmail: email,
            contactPhone: phone,
            city: row.city?.trim() || null,
            businessType: businessType as any,
            source: source as any,
            stage: stage as any,
            estimatedValue: row.estimatedValue ? Number(row.estimatedValue) : null,
            notes: row.notes?.trim() || null,
            followUpDate: row.followUpDate ? new Date(row.followUpDate) : null,
            tags: row.tags || '[]',
            salesRepId: assignToSalesRepId || null,
          },
        });

        batchEmails.add(email);
        batchPhones.add(phone);
        existingEmails.add(email);
        existingPhones.add(phone);

        results.push({ row: rowNum, status: 'imported', data: row });
        importedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Insert failed';
        results.push({ row: rowNum, status: 'error', reason: msg, data: row });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, imported: importedCount, duplicates: duplicateCount, errors: errorCount },
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
