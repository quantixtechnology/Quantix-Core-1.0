#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

/**
 * Production-ready tenant deletion script.
 * - Deletes all tenant (business) data only.
 * - Preserves platform tables and artifacts as requested.
 * - Auto-discovers models referencing business/store/customer/product/inventory/order
 * - Runs deletes in a single transaction, child-first.
 * - Supports DRY_RUN (environment variable DRY_RUN=true) and requires CONFIRM=YES for actual run.
 *
 * Usage (dry-run):
 *   DATABASE_URL="file:./prisma/db/custom.db" DRY_RUN=true BUSINESS_ID=<id> ts-node scripts/delete-all-tenants.ts
 * Production (destructive):
 *   DATABASE_URL="file:./prisma/db/custom.db" CONFIRM=YES BUSINESS_ID=<id> node scripts/delete-all-tenants.js
 */

const prisma = new PrismaClient();

const PRESERVE_MODELS = new Set([
  'User',
  'Lead',
  'SalesTeamMember',
  'PlatformPlan',
  'PlatformConfig',
  'RolePermission',
  'Permission',
  'WebsiteContent',
  'ProposalDocument',
  'PlatformAuditLog',
  'AuditLog',
  'SuperAdmin',
  'HRMS',
  'OfferLetter',
  'Payslip',
]);

const REQUIRED_TENANT_MODELS = [
  'Business', 'BusinessSubscription', 'BusinessModule', 'BusinessUser',
  'Store', 'StoreTiming', 'Product', 'ProductVariant', 'Category', 'Inventory', 'InventoryLog',
  'Customer', 'CustomerNote', 'CustomerSubscription', 'Address',
  'Order', 'OrderItem', 'OrderStatusHistory', 'Delivery', 'DeliveryPartner', 'DeliveryZone',
  'Payment', 'Invoice', 'POSSession', 'Notification', 'PromoCode'
];

function lowerFirst(s: string) { return s.charAt(0).toLowerCase() + s.slice(1); }

function parseSchemaForFKs(schemaPath: string) {
  const txt = fs.readFileSync(schemaPath, 'utf-8');
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const fkNames = ['businessId','storeId','customerId','productId','inventoryId','orderId'];
  const results: { model: string; props: string[] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const model = m[1];
    const body = m[2];
    if (PRESERVE_MODELS.has(model)) continue;
    const props: string[] = [];
    for (const fk of fkNames) if (body.indexOf(fk) !== -1) props.push(fk);
    if (props.length > 0) results.push({ model, props });
  }
  return results;
}

async function main() {
  const businessId = process.env.BUSINESS_ID || process.argv[2];
  const DRY_RUN = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const CONFIRM = (process.env.CONFIRM || '').toUpperCase() === 'YES';

  if (!businessId) {
    console.error('Usage: BUSINESS_ID=<id> [DRY_RUN=true] ts-node scripts/delete-all-tenants.ts');
    process.exit(1);
  }

  if (!DRY_RUN && !CONFIRM) {
    console.error('Dangerous operation. To run destructive delete, set CONFIRM=YES in env. Use DRY_RUN=true to preview.');
    process.exit(1);
  }

  console.log('Delete-all-tenants — businessId=', businessId, 'DRY_RUN=', DRY_RUN);

  // Protect system tenants
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz) { console.error('Business not found:', businessId); process.exit(1); }
  const slug = (biz as any).slug || '';
  const protectedFlags = ['isPlatform','isSystem','protected','isProtected','isInternal'];
  const flagged = protectedFlags.some((f) => Boolean((biz as any)[f]));
  const reservedSlugs = ['quantix','system','platform','quantix-internal'];
  if (flagged || reservedSlugs.includes(String(slug).toLowerCase())) {
    console.error('Refusing to run: target business appears protected or is a system tenant:', businessId, slug);
    process.exit(2);
  }

  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  const discovered = parseSchemaForFKs(schemaPath);

  // Build delete target list: required tenant models + discovered models excluding preserved
  const discoveredNames = discovered.map(d=>d.model);
  const targetSet = new Set<string>([...REQUIRED_TENANT_MODELS, ...discoveredNames]);
  for (const p of PRESERVE_MODELS) targetSet.delete(p);
  const targets = Array.from(targetSet);

  // Build ordered list by dependency priority (child-first)
  const priority = ['orderId','productId','inventoryId','customerId','storeId','businessId'];
  const modelMap = new Map<string, string[]>();
  for (const d of discovered) modelMap.set(d.model, d.props);
  // ensure required models present in map
  for (const t of targets) if (!modelMap.has(t)) modelMap.set(t, []);

  const ordered: string[] = [];
  for (const p of priority) {
    for (const [m, props] of modelMap) {
      if (props.includes(p) && targets.includes(m) && !ordered.includes(m)) ordered.push(m);
    }
  }
  for (const m of targets) if (!ordered.includes(m)) ordered.push(m);

  console.log('Deletion order (child-first):', ordered.join(', '));

  const beforeCounts: Record<string, number> = {};
  const deletedCounts: Record<string, number> = {};
  const wouldDeleteCounts: Record<string, number> = {};
  const start = Date.now();

  await prisma.$transaction(async (tx) => {
    // Precompute ids
    async function idsFor(model: string, where: any = {}) {
      try {
        const rows = await (tx as any)[lowerFirst(model)].findMany({ where, select: { id: true } });
        return rows.map((r: any) => r.id);
      } catch (e) { return []; }
    }

    const storeIds = await idsFor('Store', { businessId });
    const customerIds = await idsFor('Customer', { businessId });
    const productIds = await idsFor('Product', { businessId });
    const inventoryIds = await idsFor('Inventory', { businessId });
    const orderIds = await idsFor('Order', { businessId });

    // counts before
    for (const t of ordered) {
      try {
        const total = await (tx as any)[lowerFirst(t)].count();
        beforeCounts[t] = total;
      } catch (e) { beforeCounts[t] = 0; }
    }

    // perform delete (or dry-run)
    for (const t of ordered) {
      const props = modelMap.get(t) || [];
      const ors: any[] = [];
      for (const fk of props) {
        if (fk === 'businessId') ors.push({ businessId });
        if (fk === 'storeId' && storeIds.length) ors.push({ storeId: { in: storeIds } });
        if (fk === 'customerId' && customerIds.length) ors.push({ customerId: { in: customerIds } });
        if (fk === 'productId' && productIds.length) ors.push({ productId: { in: productIds } });
        if (fk === 'inventoryId' && inventoryIds.length) ors.push({ inventoryId: { in: inventoryIds } });
        if (fk === 'orderId' && orderIds.length) ors.push({ orderId: { in: orderIds } });
      }
      let where: any = {};
      if (ors.length === 0) {
        // as a fallback, if model has businessId column, use it; else set impossible where to avoid accidental deletes
        if (props.includes('businessId')) where = { businessId };
        else where = { id: '___none___' };
      } else if (ors.length === 1) where = ors[0]; else where = { OR: ors };

      if (DRY_RUN) {
        const would = await (tx as any)[lowerFirst(t)].count({ where });
        wouldDeleteCounts[t] = would;
      } else {
        const res = await (tx as any)[lowerFirst(t)].deleteMany({ where });
        deletedCounts[t] = res.count;
      }
    }

    // finally delete Business rows
    if (DRY_RUN) {
      wouldDeleteCounts['Business'] = await (tx as any)['business'].count({ where: { id: businessId } });
    } else {
      const r = await (tx as any)['business'].deleteMany({ where: { id: businessId } });
      deletedCounts['Business'] = r.count;
    }
  });

  const end = Date.now();

  // counts after
  const afterCounts: Record<string, number> = {};
  const checkTables = ['Business','Store','Product','Customer','Order'];
  for (const t of checkTables) {
    try { afterCounts[t] = await (prisma as any)[lowerFirst(t)].count(); } catch (e) { afterCounts[t] = 0; }
  }

  // Output
  console.log('\n=== Delete-all-tenants report ===');
  console.log('Business:', businessId);
  console.log('Dry run:', DRY_RUN);
  console.log('\nTable counts before:');
  for (const t of ordered) console.log(`${t}: ${beforeCounts[t] ?? 0}`);

  if (DRY_RUN) {
    console.log('\nWould delete:');
    for (const t of ordered) console.log(`${t}: ${wouldDeleteCounts[t] ?? 0}`);
  } else {
    console.log('\nDeleted:');
    for (const t of ordered) console.log(`${t}: ${deletedCounts[t] ?? 0}`);
  }

  console.log('\nCounts after:');
  for (const t of Object.keys(afterCounts)) console.log(`${t}: ${afterCounts[t]}`);

  console.log('\nExecution time (ms):', end - start);
  console.log('Status:', DRY_RUN ? 'dry-run-complete' : 'success');

  // final verification expectation
  console.log('\nVerification queries to run:');
  console.log("SELECT COUNT(*) FROM Business;  -- expected 0");
  console.log("SELECT COUNT(*) FROM Store;    -- expected 0");
  console.log("SELECT COUNT(*) FROM Product;  -- expected 0");
  console.log("SELECT COUNT(*) FROM Customer; -- expected 0");
  console.log("SELECT COUNT(*) FROM \"Order\";  -- expected 0");

  await prisma.$disconnect();
}

main().catch((e) => { console.error('delete-all-tenants failed:', e); prisma.$disconnect(); process.exit(1); });
