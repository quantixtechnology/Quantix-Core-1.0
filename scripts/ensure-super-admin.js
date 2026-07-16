const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// ── Single source of truth: the ONE canonical platform owner ─────────────────
const ADMIN_EMAIL = 'superadmin@quantixtechnology.in';
const ADMIN_PASSWORD = 'Quantix@Admin2024';

// Legacy Super Admin account being retired. It is ARCHIVED (deactivated), never
// deleted, so audit-log / historical foreign keys stay intact (business data is
// preserved). An archived account can never authenticate (login rejects
// isActive === false with 403).
const LEGACY_ADMIN_EMAIL = 'admin@quantix.in';

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // ── 1. Ensure the canonical platform owner exists, active, Super Admin ──────
  const existing = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  });

  let canonicalId;
  if (existing) {
    canonicalId = existing.id;
    await db.user.update({
      where: { id: existing.id },
      data: { isActive: true, platformRole: 'QUANTIX_SUPER_ADMIN', passwordHash: hash },
    });
    console.log('Canonical Super Admin updated — password reset to deploy default');
  } else {
    const created = await db.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'Quantix Super Admin',
        passwordHash: hash,
        platformRole: 'QUANTIX_SUPER_ADMIN',
        authProvider: 'PASSWORD',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
      select: { id: true },
    });
    canonicalId = created.id;
    console.log('Canonical Super Admin CREATED with deploy default password');
  }

  // ── 2. Archive the legacy admin@quantix.in account (never delete) ───────────
  // Ownership is NOT repointed: platform access is ROLE-based (the canonical
  // Super Admin bypasses every authorization gate), and historical records keep
  // their original actor for audit integrity. Archiving only blocks login.
  const legacy = await db.user.findUnique({
    where: { email: LEGACY_ADMIN_EMAIL },
    select: { id: true, platformRole: true, isActive: true },
  });
  if (legacy) {
    if (legacy.id === canonicalId) {
      console.log('Legacy email already maps to the canonical account — nothing to archive');
    } else {
      await db.user.update({
        where: { id: legacy.id },
        data: { isActive: false, platformRole: null },
      });
      console.log(`Legacy Super Admin ${LEGACY_ADMIN_EMAIL} ARCHIVED (isActive=false, platformRole=null) — can no longer authenticate`);
    }
  } else {
    console.log(`Legacy account ${LEGACY_ADMIN_EMAIL} not present — nothing to archive`);
  }

  // ── 3. Enforce EXACTLY ONE platform Super Admin ─────────────────────────────
  // Demote any other user still carrying platformRole = QUANTIX_SUPER_ADMIN.
  // (platformRole -> null; the account stays active but is no longer a platform
  // owner.) Idempotent; logs every demotion so it is visible in the deploy log.
  const extras = await db.user.findMany({
    where: { platformRole: 'QUANTIX_SUPER_ADMIN', id: { not: canonicalId } },
    select: { id: true, email: true },
  });
  if (extras.length > 0) {
    for (const u of extras) {
      await db.user.update({ where: { id: u.id }, data: { platformRole: null } });
      console.log(`Enforced single Super Admin — demoted extra platform owner: ${u.email}`);
    }
  }
  const superAdminCount = await db.user.count({ where: { platformRole: 'QUANTIX_SUPER_ADMIN' } });
  console.log(`Platform Super Admin count is now: ${superAdminCount} (canonical: ${ADMIN_EMAIL})`);

  // ── 4. Remove any DB permission override for QUANTIX_SUPER_ADMIN ─────────────
  // so it always falls back to the full static permission set.
  try {
    const deleted = await db.rolePermission.deleteMany({ where: { role: 'QUANTIX_SUPER_ADMIN' } });
    if (deleted.count > 0) {
      console.log('Removed stale QUANTIX_SUPER_ADMIN permission override from DB');
    }
  } catch {
    // Table may not exist yet on first deploy — safe to ignore
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Admin init error:', e.message);
  process.exit(0);
});
