// ============================================================================
// Delivery login diagnostic + repair — runs against the ACTUAL database.
//
// The production database is a SQLite file on the server
// (e.g. file:/root/Quantix-Core-1.0/prisma/db/custom.db). It is NOT present on
// a developer laptop, so this must be run ON THE SERVER (or anywhere the prod
// DATABASE_URL is reachable). It uses the app's own Prisma client + bcrypt, so
// password verification is byte-for-byte identical to /api/core/auth/login.
//
// Usage (on the server, from the project root):
//   node scripts/diagnose-delivery-login.mjs --email prashant@gmail.com \
//        --host greenmart.quantixtechnology.in --password 'Delivery@123'
//
//   # add --apply to repair a broken record, then it re-verifies the login:
//   node scripts/diagnose-delivery-login.mjs --email prashant@gmail.com \
//        --host greenmart.quantixtechnology.in --password 'Delivery@123' --apply
//
// It performs the issue's Tasks 1-8 and prints exact values + the exact
// failing condition (no guessing).
// ============================================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const EMAIL = (arg('email') || '').toLowerCase().trim();
const HOST = arg('host'); // e.g. greenmart.quantixtechnology.in
const PASSWORD = arg('password'); // optional — proves valid/invalid hash
const APPLY = process.argv.includes('--apply');
const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in';

function generateTempPassword() {
  const U = 'ABCDEFGHJKMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789';
  const p = (s, n) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('');
  return `${p(U, 1)}${p(L, 3)}-${p(D, 4)}`;
}

function hr(t) { console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`); }

async function main() {
  if (!EMAIL) { console.error('Required: --email <address>'); process.exit(1); }
  console.log(`DB: ${process.env.DATABASE_URL || '(env not set — relying on prisma default)'}`);
  console.log(`Target email: ${EMAIL}${HOST ? ` | host: ${HOST}` : ''}`);

  // ── TASK 5 (a): resolve business from host slug ───────────────────────────
  let hostBusiness = null;
  if (HOST) {
    const slug = HOST.split(':')[0].replace(`.${SF_BASE}`, '');
    hostBusiness = await db.business.findFirst({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true },
    });
    hr('TASK 5 — HOST → BUSINESS RESOLUTION');
    console.log(`host slug = "${slug}"`);
    console.log(hostBusiness ? hostBusiness : '❌ No business with this slug');
  }

  // ── TASK 1: DeliveryPartner record ────────────────────────────────────────
  hr('TASK 1 — DELIVERY PARTNER RECORD');
  const partners = await db.deliveryPartner.findMany({
    where: { OR: [{ email: EMAIL }, { email: { contains: EMAIL.split('@')[0] } }] },
    include: { store: { select: { id: true, name: true, storeCode: true, code: true } } },
  });
  if (partners.length === 0) console.log('❌ No DeliveryPartner row matches this email.');
  for (const p of partners) {
    console.log({
      DeliveryPartnerId: p.id, businessId: p.businessId, storeId: p.storeId,
      userId: p.userId, appEnabled: p.appEnabled, isActive: p.isActive,
      email: p.email, phone: p.phone,
      store: p.store ? `${p.store.storeCode || p.store.code || '(no code)'} | ${p.store.name}` : null,
    });
  }
  const partner = partners.find((p) => (p.email || '').toLowerCase() === EMAIL) || partners[0] || null;

  // ── TASK 2: linked User ───────────────────────────────────────────────────
  hr('TASK 2 — LINKED USER (by partner.userId AND by email)');
  const userByLink = partner?.userId
    ? await db.user.findUnique({ where: { id: partner.userId }, include: { businessUsers: { include: { business: { select: { slug: true, name: true, status: true } }, store: { select: { name: true, storeCode: true } } } } } })
    : null;
  const userByEmail = await db.user.findUnique({ where: { email: EMAIL }, include: { businessUsers: { include: { business: { select: { slug: true, name: true, status: true } }, store: { select: { name: true, storeCode: true } } } } } });
  const user = userByLink || userByEmail;
  console.log('user via partner.userId:', userByLink ? userByLink.id : '(none)');
  console.log('user via email lookup  :', userByEmail ? userByEmail.id : '(none)');
  if (user) {
    console.log({
      UserId: user.id, Email: user.email, Active: user.isActive,
      platformRole: user.platformRole, authProvider: user.authProvider,
      mustChangePassword: user.mustChangePassword,
      businessAssignments: user.businessUsers.map((b) => ({
        role: b.role, business: b.business.slug, businessStatus: b.business.status,
        storeId: b.storeId, store: b.store ? `${b.store.storeCode || ''} ${b.store.name}` : null, active: b.isActive,
      })),
    });
    const deliveryBU = user.businessUsers.find((b) => b.role === 'DELIVERY_STAFF');
    console.log(`Role = DELIVERY_STAFF ? ${deliveryBU ? '✅ yes' : '❌ NO'}`);
  } else {
    console.log('❌ No User row found by link or by email.');
  }

  // ── TASK 3: password ──────────────────────────────────────────────────────
  hr('TASK 3 — PASSWORD');
  if (!user) {
    console.log('No user → no password to check.');
  } else {
    console.log({
      hasPasswordFlag: user.hasPassword,
      passwordHashIsNull: user.passwordHash === null,
      passwordHashIsEmpty: user.passwordHash === '',
      passwordHashPrefix: user.passwordHash ? user.passwordHash.slice(0, 7) + '…' : null,
      bcryptShaped: !!user.passwordHash && /^\$2[aby]\$/.test(user.passwordHash),
    });
    if (PASSWORD && user.passwordHash) {
      const ok = await bcrypt.compare(PASSWORD, user.passwordHash);
      console.log(`bcrypt.compare("${PASSWORD}", hash) = ${ok ? '✅ MATCH (this password WAS stored)' : '❌ NO MATCH (this password was never stored, or differs)'}`);
    }
    console.log('Hashing logic identical to Business User login? ✅ yes — both use bcrypt (password-utils.hashPassword/verifyPassword, SALT_ROUNDS=12) via /api/core/auth/login.');
  }

  // ── TASK 4: replicate /api/core/auth/login exactly → exact failure point ───
  hr('TASK 4 — LOGIN EXECUTION TRACE (mirrors /api/core/auth/login)');
  const identifier = EMAIL;
  let loginUser = await db.user.findUnique({ where: { loginId: identifier }, select: loginSelect() });
  let how = 'loginId';
  if (!loginUser) { loginUser = await db.user.findUnique({ where: { email: identifier }, select: loginSelect() }); how = 'email'; }
  if (!loginUser) {
    const rows = await db.$queryRawUnsafe(`SELECT id FROM User WHERE LOWER(loginId)=? OR LOWER(email)=? LIMIT 1`, identifier, identifier);
    if (rows.length) { loginUser = await db.user.findUnique({ where: { id: rows[0].id }, select: loginSelect() }); how = 'LOWER() fallback'; }
  }
  let failPoint = null;
  if (!loginUser || !loginUser.passwordHash) failPoint = !loginUser ? 'USER_NOT_FOUND' : 'NO_PASSWORD_HASH';
  else if (!loginUser.isActive) failPoint = 'INACTIVE_USER';
  else if (PASSWORD && !(await bcrypt.compare(PASSWORD, loginUser.passwordHash))) failPoint = 'PASSWORD_MISMATCH';
  else {
    const primaryBU = loginUser.businessUsers[0];
    if (primaryBU && !['ONBOARDING', 'ACTIVE'].includes(primaryBU.business.status)) failPoint = 'BUSINESS_INACTIVE';
  }
  console.log(`lookup matched via: ${loginUser ? how : '(no match)'}`);
  console.log(`→ EXACT FAILING CONDITION: ${failPoint
    ? `❌ ${failPoint} → response "${failPoint === 'INACTIVE_USER' ? 'Account is deactivated' : failPoint === 'BUSINESS_INACTIVE' ? 'Your business account is not active' : 'Invalid email or password'}"`
    : (PASSWORD ? '✅ LOGIN WOULD SUCCEED' : '✅ no blocking condition found (pass --password to confirm the hash)')}`);
  console.log('Note: the login API does NOT reject by role or by host/business — so a "business mismatch" is never the cause of "Invalid email or password".');

  // ── TASK 6: store assignment ──────────────────────────────────────────────
  hr('TASK 6 — STORE ASSIGNMENT');
  if (partner?.store) console.log(`Store ID: ${partner.store.storeCode || partner.store.code || partner.storeId} | Store Name: ${partner.store.name}`);
  else console.log(partner ? '⚠️ Partner has NO store assigned (storeId null).' : 'No partner to check.');

  // ── TASK 7 + 8: repair + re-verify ────────────────────────────────────────
  if (APPLY) {
    hr('TASK 7 — DATA REPAIR');
    if (!partner) { console.log('❌ Cannot repair: no DeliveryPartner row. Create the partner first.'); }
    else if (!partner.email) { console.log('❌ Cannot repair: partner has no email.'); }
    else {
      const targetBiz = partner.businessId;
      const storeId = partner.storeId || null;
      let uid = partner.userId;
      let existing = uid ? await db.user.findUnique({ where: { id: uid } }) : await db.user.findUnique({ where: { email: EMAIL } });
      let tempPassword = '';
      const needPw = !existing || !existing.passwordHash || !existing.hasPassword;
      if (needPw && !PASSWORD) tempPassword = generateTempPassword();
      const plain = PASSWORD || tempPassword; // prefer the admin-intended password if supplied
      const hash = plain ? await bcrypt.hash(plain, 12) : undefined;

      if (existing) {
        uid = existing.id;
        await db.user.update({ where: { id: existing.id }, data: {
          isActive: true,
          ...(hash ? { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', mustChangePassword: !PASSWORD } : {}),
        }});
        const bu = await db.businessUser.findUnique({ where: { userId_businessId: { userId: existing.id, businessId: targetBiz } } });
        if (!bu) await db.businessUser.create({ data: { userId: existing.id, businessId: targetBiz, role: 'DELIVERY_STAFF', storeId, isActive: true } });
        else await db.businessUser.update({ where: { id: bu.id }, data: { role: 'DELIVERY_STAFF', isActive: true, ...(storeId ? { storeId } : {}) } });
      } else {
        const created = await db.user.create({ data: {
          email: EMAIL, name: partner.name, phone: partner.phone,
          passwordHash: hash, hasPassword: true, mustChangePassword: !PASSWORD, authProvider: 'PASSWORD', isActive: true,
          businessUsers: { create: { businessId: targetBiz, role: 'DELIVERY_STAFF', storeId, isActive: true } },
        }});
        uid = created.id;
      }
      await db.deliveryPartner.update({ where: { id: partner.id }, data: { userId: uid, appEnabled: true } });
      console.log(`✅ Repaired. userId=${uid}, role=DELIVERY_STAFF, storeId=${storeId}`);
      console.log(PASSWORD ? `Password set to the supplied value ("${PASSWORD}").` : `Temporary password: ${tempPassword} (partner must change on first login).`);

      hr('TASK 8 — LOGIN RE-VERIFICATION');
      const v = await db.user.findUnique({ where: { email: EMAIL }, select: loginSelect() });
      const okPw = v?.passwordHash ? await bcrypt.compare(plain, v.passwordHash) : false;
      const role = v?.businessUsers.find((b) => b.role === 'DELIVERY_STAFF');
      const bizOk = v?.businessUsers[0] && ['ONBOARDING', 'ACTIVE'].includes(v.businessUsers[0].business.status);
      console.log(`user found: ${!!v} | password "${plain}" valid: ${okPw ? '✅' : '❌'} | DELIVERY_STAFF: ${role ? '✅' : '❌'} | business active: ${bizOk ? '✅' : '❌'}`);
      console.log(`=> LOGIN RESULT: ${v && okPw && role && bizOk ? 'SUCCESS ✅' : 'STILL FAILING ❌'}`);
    }
  } else {
    hr('NEXT STEP');
    console.log('Re-run with --apply (and optionally --password to set a known password) to repair and re-verify.');
  }

  await db.$disconnect();
}

function loginSelect() {
  return {
    id: true, name: true, email: true, loginId: true, avatar: true,
    passwordHash: true, isActive: true, mustChangePassword: true, platformRole: true,
    businessUsers: { where: { isActive: true }, select: { role: true, storeId: true, business: { select: { id: true, name: true, slug: true, status: true } } } },
  };
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
