const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  const existing = await db.user.findUnique({
    where: { email: 'superadmin@quantixtechnology.in' },
    select: { id: true, email: true, isActive: true, platformRole: true },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { isActive: true, platformRole: 'QUANTIX_SUPER_ADMIN' },
    });
    console.log('Admin exists:', existing.email, '| active:', existing.isActive, '| role:', existing.platformRole);
  } else {
    const hash = await bcrypt.hash('Admin@123', 12);
    await db.user.create({
      data: {
        email: 'superadmin@quantixtechnology.in',
        name: 'Quantix Super Admin',
        passwordHash: hash,
        platformRole: 'QUANTIX_SUPER_ADMIN',
        authProvider: 'PASSWORD',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });
    console.log('Admin CREATED with default password Admin@123');
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Admin init error:', e.message);
  process.exit(0);
});
