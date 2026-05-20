// ============================================================================
// QUANTIX CORE — Backfill Script
// Idempotent. Safe to run multiple times.
//
// Fixes businesses created before the multi-store migration:
//   1. Creates a default main store for businesses that have none
//   2. Creates a domain mapping for businesses that have none
//   3. Patches settings JSON to include ecommerceConfig where missing
//
// Usage:
//   node scripts/backfill-stores-domains.js
//   node scripts/backfill-stores-domains.js --dry-run
// ============================================================================

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultTimings(storeId) {
  return DAY_NAMES.map((_, day) => ({
    storeId,
    day,
    openTime: '09:00',
    closeTime: '21:00',
    isClosed: false,
  }));
}

function log(tag, msg) {
  const prefix = DRY_RUN ? '[DRY-RUN]' : '[APPLY]';
  console.log(`${prefix} [${tag}] ${msg}`);
}

async function backfillStore(business) {
  const existingMain = await db.store.findFirst({
    where: { businessId: business.id, isMainStore: true },
    select: { id: true, name: true },
  });

  if (existingMain) {
    log('STORE', `SKIP  ${business.slug} — main store already exists: "${existingMain.name}"`);
    return 'skipped';
  }

  // Try slug = business.slug, fall back to business.slug + '-main'
  let slug = business.slug;
  const slugConflict = await db.store.findUnique({
    where: { businessId_slug: { businessId: business.id, slug } },
    select: { id: true },
  });
  if (slugConflict) {
    slug = `${business.slug}-main`;
  }

  const name = `${business.name} - Main Store`;
  log('STORE', `CREATE ${business.slug} — "${name}" (slug: ${slug})`);

  if (DRY_RUN) return 'would-create';

  const store = await db.store.create({
    data: {
      businessId: business.id,
      name,
      slug,
      isMainStore: true,
      address: business.address || null,
      city: business.city || null,
      state: business.state || null,
      pincode: business.pincode || null,
      phone: business.contactPhone || null,
      email: business.contactEmail || null,
      status: 'ACTIVE',
      posEnabled: true,
      deliveryRadius: 5.0,
      minOrderAmount: 0,
      deliveryFee: 0,
      preparationTime: 30,
      settings: '{}',
      printerConfig: '{}',
      operatingHours: '{}',
    },
  });

  await db.storeTiming.createMany({
    data: defaultTimings(store.id),
  });

  await db.activityLog.create({
    data: {
      businessId: business.id,
      action: 'store.created',
      entity: 'Store',
      entityId: store.id,
      details: JSON.stringify({ name, slug, isMainStore: true, source: 'backfill' }),
    },
  });

  return 'created';
}

async function backfillDomain(business) {
  const existing = await db.domainMapping.findUnique({
    where: { businessId: business.id },
    select: { id: true, domain: true },
  });

  if (existing) {
    log('DOMAIN', `SKIP  ${business.slug} — mapping already exists: "${existing.domain}"`);
    return 'skipped';
  }

  const domain = `${business.slug}.${STOREFRONT_BASE}`;
  log('DOMAIN', `CREATE ${business.slug} — "${domain}"`);

  if (DRY_RUN) return 'would-create';

  // Guard against domain column unique conflict from another business
  const domainConflict = await db.domainMapping.findUnique({
    where: { domain },
    select: { id: true, businessId: true },
  });
  if (domainConflict) {
    log('DOMAIN', `WARN  ${business.slug} — domain "${domain}" already mapped to business ${domainConflict.businessId}, skipping`);
    return 'conflict';
  }

  await db.domainMapping.create({
    data: {
      businessId: business.id,
      domain,
      subdomain: business.slug,
      isPrimary: true,
      status: 'PENDING_DNS',
    },
  });

  return 'created';
}

async function backfillSettings(business) {
  let parsed = {};
  try {
    parsed = JSON.parse(business.settings || '{}');
  } catch {
    parsed = {};
  }

  if (parsed.ecommerceConfig) {
    log('SETTINGS', `SKIP  ${business.slug} — ecommerceConfig already present`);
    return 'skipped';
  }

  log('SETTINGS', `PATCH ${business.slug} — adding ecommerceConfig`);

  if (DRY_RUN) return 'would-patch';

  parsed.ecommerceConfig = {
    banners: [],
    theme: 'default',
    homepageStyle: 'grid',
    font: 'inter',
  };

  await db.business.update({
    where: { id: business.id },
    data: { settings: JSON.stringify(parsed) },
  });

  return 'patched';
}

async function main() {
  console.log('');
  console.log('='.repeat(72));
  console.log('  Quantix Core — Backfill: stores + domain mappings + settings');
  if (DRY_RUN) console.log('  MODE: DRY RUN — no changes will be written');
  console.log(`  Storefront base domain: ${STOREFRONT_BASE}`);
  console.log('='.repeat(72));
  console.log('');

  const businesses = await db.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      contactPhone: true,
      contactEmail: true,
      settings: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${businesses.length} businesses to check.\n`);

  const summary = {
    stores: { created: 0, skipped: 0, wouldCreate: 0 },
    domains: { created: 0, skipped: 0, wouldCreate: 0, conflicts: 0 },
    settings: { patched: 0, skipped: 0, wouldPatch: 0 },
  };

  for (const biz of businesses) {
    const storeResult = await backfillStore(biz);
    if (storeResult === 'created') summary.stores.created++;
    else if (storeResult === 'would-create') summary.stores.wouldCreate++;
    else summary.stores.skipped++;

    const domainResult = await backfillDomain(biz);
    if (domainResult === 'created') summary.domains.created++;
    else if (domainResult === 'would-create') summary.domains.wouldCreate++;
    else if (domainResult === 'conflict') summary.domains.conflicts++;
    else summary.domains.skipped++;

    const settingsResult = await backfillSettings(biz);
    if (settingsResult === 'patched') summary.settings.patched++;
    else if (settingsResult === 'would-patch') summary.settings.wouldPatch++;
    else summary.settings.skipped++;

    console.log('');
  }

  console.log('='.repeat(72));
  console.log('  Summary');
  console.log('='.repeat(72));
  if (DRY_RUN) {
    console.log(`  Stores:   ${summary.stores.wouldCreate} would create, ${summary.stores.skipped} already exist`);
    console.log(`  Domains:  ${summary.domains.wouldCreate} would create, ${summary.domains.skipped} already exist`);
    console.log(`  Settings: ${summary.settings.wouldPatch} would patch,  ${summary.settings.skipped} already have ecommerceConfig`);
    console.log('');
    console.log('  Run without --dry-run to apply these changes.');
  } else {
    console.log(`  Stores:   ${summary.stores.created} created,  ${summary.stores.skipped} already existed`);
    console.log(`  Domains:  ${summary.domains.created} created,  ${summary.domains.skipped} already existed${summary.domains.conflicts ? `, ${summary.domains.conflicts} domain conflicts` : ''}`);
    console.log(`  Settings: ${summary.settings.patched} patched,  ${summary.settings.skipped} already had ecommerceConfig`);
  }
  console.log('='.repeat(72));
  console.log('');

  await db.$disconnect();
}

main().catch((err) => {
  console.error('\nBackfill error:', err.message);
  db.$disconnect();
  process.exit(1);
});
