#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const PRESERVE_MODELS = new Set([
  'User', 'Lead', 'SalesTeamMember', 'PlatformPlan', 'PlatformConfig', 'RolePermission', 'Permission', 'WebsiteContent', 'ProposalDocument', 'PlatformAuditLog', 'AuditLog', 'SuperAdmin',
]);

function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

function parseSchemaForFKs(schemaPath) {
  const txt = fs.readFileSync(schemaPath, 'utf-8');
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const fkNames = ['businessId', 'storeId', 'customerId', 'productId', 'inventoryId', 'orderId'];
  const results = [];
  let m;
  while ((m = re.exec(txt))) {
    const model = m[1];
    const body = m[2];
    if (PRESERVE_MODELS.has(model)) continue;
    const props = [];
    for (const fk of fkNames) {
      if (body.indexOf(fk) !== -1) props.push(fk);
    }
    if (props.length > 0) results.push({ model, props });
  }
  return results;
}

async function main() {
  const arg = process.argv[2];
  const businessId = process.env.BUSINESS_ID || arg;
  const DRY_RUN = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  if (!businessId) { console.error('Usage: BUSINESS_ID=<id> [DRY_RUN=true] node scripts/tenant-reset.js <BUSINESS_ID>'); process.exit(1); }
  console.log('Tenant reset — businessId=', businessId, 'DRY_RUN=', DRY_RUN);

  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz) { console.error('Business not found:', businessId); process.exit(1); }
  const slug = biz.slug || '';
  const protectedFlags = ['isPlatform', 'isSystem', 'protected', 'isProtected'];
  const flagged = protectedFlags.some((f) => biz[f]);
  const reservedSlugs = ['quantix', 'system', 'platform', 'quantix-internal'];
  if (flagged || reservedSlugs.includes(String(slug).toLowerCase())) { console.error('Refusing to run: target business appears protected or is a system tenant:', businessId, slug); process.exit(2); }

  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  const modelFKs = parseSchemaForFKs(schemaPath);
  const priority = ['orderId','productId','inventoryId','customerId','storeId','businessId'];
  const orderedModels = [];
  for (const p of priority) for (const m of modelFKs) if (m.props.includes(p) && !orderedModels.find(x=>x.model===m.model)) orderedModels.push(m);
  for (const m of modelFKs) if (!orderedModels.find(x=>x.model===m.model)) orderedModels.push(m);

  const report = [];
  const start = Date.now();

  const txResult = await prisma.$transaction(async (tx) => {
    async function idsFor(model, where={}) { try { const rows = await tx[lowerFirst(model)].findMany({ where, select: { id: true } }); return rows.map(r=>r.id); } catch(e){ return []; } }
    const storeIds = await idsFor('Store', { businessId });
    const customerIds = await idsFor('Customer', { businessId });
    const productIds = await idsFor('Product', { businessId });
    const inventoryIds = await idsFor('Inventory', { businessId });
    const orderIds = await idsFor('Order', { businessId });

    for (const m of orderedModels) {
      const modelProp = lowerFirst(m.model);
      try {
        const total = await tx[modelProp].count();
        const ors = [];
        for (const fk of m.props) {
          if (fk === 'businessId') ors.push({ businessId });
          if (fk === 'storeId' && storeIds.length) ors.push({ storeId: { in: storeIds } });
          if (fk === 'customerId' && customerIds.length) ors.push({ customerId: { in: customerIds } });
          if (fk === 'productId' && productIds.length) ors.push({ productId: { in: productIds } });
          if (fk === 'inventoryId' && inventoryIds.length) ors.push({ inventoryId: { in: inventoryIds } });
          if (fk === 'orderId' && orderIds.length) ors.push({ orderId: { in: orderIds } });
        }
        let where = {}; if (ors.length===1) where=ors[0]; else if (ors.length>1) where={ OR: ors }; else where={ id: -1 };
        const wouldDelete = await tx[modelProp].count({ where });
        if (DRY_RUN) report.push({ table: m.model, wouldDelete, total }); else { const res = await tx[modelProp].deleteMany({ where }); report.push({ table: m.model, deleted: res.count, total }); }
      } catch(e) { continue; }
    }

    if (DRY_RUN) { const bTotal = await tx['business'].count({ where: { id: businessId } }); report.push({ table: 'Business', wouldDelete: bTotal, total: await tx['business'].count() }); }
    else { const res = await tx['business'].deleteMany({ where: { id: businessId } }); report.push({ table: 'Business', deleted: res.count, total: await tx['business'].count() }); }
    return report;
  });

  const end = Date.now();
  const remainingBusinesses = await prisma.business.count();
  const remainingCustomers = await prisma.customer.count();
  const remainingOrders = await prisma.order.count();
  const remainingProducts = await prisma.product.count();
  const remainingLeads = await prisma.lead.count();
  const remainingUsers = await prisma.user.count();

  console.log('\n=== Tenant reset report ===');
  console.log('Business:', businessId);
  console.log('Dry run:', DRY_RUN);
  console.log('\nPer-table results:');
  for (const r of txResult) {
    if (DRY_RUN) console.log(`${r.table}: would delete=${r.wouldDelete ?? 0}, total=${r.total ?? 'unknown'}`);
    else console.log(`${r.table}: deleted=${r.deleted ?? 0}, total=${r.total ?? 'unknown'}`);
  }

  console.log('\nSummary:');
  console.log('Remaining Businesses:', remainingBusinesses);
  console.log('Remaining Customers:', remainingCustomers);
  console.log('Remaining Orders:', remainingOrders);
  console.log('Remaining Products:', remainingProducts);
  console.log('Remaining Leads:', remainingLeads);
  console.log('Remaining Users:', remainingUsers);

  console.log('\nExecution time (ms):', end - start);
  console.log('Status:', DRY_RUN ? 'dry-run-complete' : 'success');

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error('Tenant reset failed:', e); prisma.$disconnect(); process.exit(1); });
