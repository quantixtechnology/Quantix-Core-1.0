const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'superadmin@quantixtechnology.in';
const ADMIN_PASSWORD = 'Quantix@Admin2024';

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        platformRole: 'QUANTIX_SUPER_ADMIN',
        passwordHash: hash,
      },
    });
    console.log('Admin updated — password reset to deploy default');
  } else {
    await db.user.create({
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
    });
    console.log('Admin CREATED with deploy default password');
  }

  // Remove any DB permission override for QUANTIX_SUPER_ADMIN so it always
  // falls back to the full static permission set. A stale row causes new
  // permissions (added to the code) to be ignored until manually re-saved.
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
