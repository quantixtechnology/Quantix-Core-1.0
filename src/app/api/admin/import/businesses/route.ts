// ============================================================================
// Route: POST /api/admin/import/businesses
// Bulk-import business records (parsed on frontend, sent as JSON rows).
// For CLIENT_OWNER: scoped to their own business's customer/product data context.
// For SUPER_ADMIN: can import full business profiles.
// Runs duplicate check per row before inserting.
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export type ImportBusinessRow = {
  name: string;
  slug?: string;
  businessType?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  gstNumber?: string;
  description?: string;
  status?: string;
};

export type ImportBusinessResult = {
  row: number;
  status: 'imported' | 'duplicate' | 'error';
  reason?: string;
  data: ImportBusinessRow;
};

const VALID_BUSINESS_TYPES = new Set([
  'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
  'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY', 'FURNITURE', 'DIRECTORY',
]);

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'import:business',
})(async (req) => {
  try {
    const body = await req.json();
    const rows: ImportBusinessRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows provided' }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ success: false, error: 'Maximum 500 rows per import' }, { status: 400 });
    }

    // Pre-fetch existing slugs and emails
    const existingBusinesses = await db.business.findMany({
      select: { slug: true, contactEmail: true },
    });
    const existingSlugs = new Set(existingBusinesses.map((b) => b.slug));
    const existingEmails = new Set(
      existingBusinesses.filter((b) => b.contactEmail).map((b) => b.contactEmail!.toLowerCase().trim())
    );

    const batchSlugs = new Set<string>();
    const batchEmails = new Set<string>();

    const results: ImportBusinessResult[] = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.name?.trim()) {
        results.push({ row: rowNum, status: 'error', reason: 'Missing business name', data: row });
        errorCount++;
        continue;
      }

      const slug = row.slug?.trim() || toSlug(row.name);
      const email = row.contactEmail?.toLowerCase().trim() || null;

      // Duplicate check against DB
      if (existingSlugs.has(slug)) {
        results.push({ row: rowNum, status: 'duplicate', reason: `Business with slug "${slug}" already exists`, data: row });
        duplicateCount++;
        continue;
      }
      if (email && existingEmails.has(email)) {
        results.push({ row: rowNum, status: 'duplicate', reason: `Business with email "${email}" already exists`, data: row });
        duplicateCount++;
        continue;
      }

      // Duplicate within batch
      if (batchSlugs.has(slug)) {
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate slug "${slug}" within this import`, data: row });
        duplicateCount++;
        continue;
      }
      if (email && batchEmails.has(email)) {
        results.push({ row: rowNum, status: 'duplicate', reason: `Duplicate email within this import`, data: row });
        duplicateCount++;
        continue;
      }

      const businessType = row.businessType && VALID_BUSINESS_TYPES.has(row.businessType.toUpperCase())
        ? row.businessType.toUpperCase()
        : 'ECOMMERCE';

      try {
        await db.business.create({
          data: {
            name: row.name.trim(),
            slug,
            businessType: businessType as any,
            status: 'ONBOARDING',
            contactEmail: email || undefined,
            contactPhone: row.contactPhone?.trim() || undefined,
            city: row.city?.trim() || undefined,
            state: row.state?.trim() || undefined,
            pincode: row.pincode?.trim() || undefined,
            address: row.address?.trim() || undefined,
            gstNumber: row.gstNumber?.trim() || undefined,
            description: row.description?.trim() || undefined,
            primaryColor: '#10B981',
            defaultCurrency: 'INR',
            defaultLocale: 'en-IN',
            timezone: 'Asia/Kolkata',
            isOnline: false,
            settings: JSON.stringify({}),
            features: '{}',
            notificationConfig: '{}',
          },
        });

        batchSlugs.add(slug);
        if (email) { batchEmails.add(email); existingEmails.add(email); }
        existingSlugs.add(slug);

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
    console.error('[import/businesses] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
});
