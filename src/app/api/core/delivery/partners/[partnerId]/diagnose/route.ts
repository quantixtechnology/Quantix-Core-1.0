// ============================================================================
// QUANTIX CORE — Delivery Login Diagnostic & Repair (admin-only)
//
// GET  /api/core/delivery/partners/[partnerId]/diagnose
//   Full auth trace for a delivery partner: partner record, linked user, the
//   five auth pass/fail checks, and the EXACT reason email login fails.
//
// POST /api/core/delivery/partners/[partnerId]/diagnose   { action }
//   Repair actions: create-user | link-user | reset-password | regenerate |
//   force-reset | send-setup-email. Returns the temp password (when generated)
//   and the refreshed diagnosis.
//
// Visible to Business Owners (CLIENT_OWNER), Store Managers, Super/Platform
// Admins, and Sales — consistent with the other partner-management routes.
// Queries the LIVE database the app is connected to (prod when run in prod).
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword, generateTempPassword } from '@/lib/password-utils';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';

const ADMIN_ROLES = ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM'] as const;
const RESET_TOKEN_EXPIRY_MINUTES = 60;

type PartnerWithRefs = NonNullable<Awaited<ReturnType<typeof loadPartner>>>;

function loadPartner(partnerId: string) {
  return db.deliveryPartner.findUnique({
    where: { id: partnerId },
    include: {
      store: { select: { id: true, name: true, storeCode: true, code: true } },
      business: { select: { id: true, name: true, slug: true, status: true } },
      user: {
        include: {
          businessUsers: {
            include: { business: { select: { id: true, name: true, slug: true, status: true } } },
          },
        },
      },
    },
  });
}

// Build the diagnosis payload — partner record, linked user, the five checks,
// and the single exact failing condition (first blocker, in login priority).
function buildDiagnosis(p: PartnerWithRefs) {
  const user = p.user;
  const deliveryBU = user?.businessUsers.find((b) => b.role === 'DELIVERY_STAFF' && b.businessId === p.businessId);
  const anyDeliveryBU = user?.businessUsers.find((b) => b.role === 'DELIVERY_STAFF');
  const buForBusiness = user?.businessUsers.find((b) => b.businessId === p.businessId);

  const userExists = !!user;
  const passwordHashExists = !!user?.passwordHash && user.hasPassword;
  const userActive = !!user?.isActive;
  const roleIsDeliveryStaff = !!deliveryBU;
  const businessMatch = !!buForBusiness;
  const storeAssignmentExists = !!p.storeId;
  const businessActive = p.business ? ['ONBOARDING', 'ACTIVE'].includes(p.business.status) : false;

  // Exact failing condition — ordered the way the real login path fails.
  let failReason: string | null = null;
  if (!userExists) failReason = '❌ User record missing';
  else if (!passwordHashExists) failReason = '❌ Password hash missing';
  else if (!userActive) failReason = '❌ User inactive';
  else if (!businessMatch && anyDeliveryBU) failReason = '❌ User linked to another business';
  else if (!roleIsDeliveryStaff) failReason = '❌ Wrong role assigned (no DELIVERY_STAFF for this business)';
  else if (!businessActive) failReason = `❌ Business not active (status: ${p.business?.status})`;
  else if (!storeAssignmentExists) failReason = '⚠️ Store assignment missing (login works, but orders are unscoped)';

  return {
    partner: {
      partnerId: p.id,
      partnerName: p.name,
      businessId: p.businessId,
      businessName: p.business?.name ?? null,
      storeId: p.storeId,
      storeName: p.store?.name ?? null,
      storeCode: p.store?.storeCode ?? p.store?.code ?? null,
      appEnabled: p.appEnabled,
      isActive: p.isActive,
      email: p.email,
      phone: p.phone,
      userId: p.userId,
    },
    user: user
      ? {
          userId: user.id,
          email: user.email,
          role: (deliveryBU || buForBusiness || anyDeliveryBU)?.role ?? user.platformRole ?? null,
          isActive: user.isActive,
          passwordHashExists,
          mustChangePassword: user.mustChangePassword,
          lastLogin: user.lastLoginAt,
          businesses: user.businessUsers.map((b) => ({
            businessId: b.businessId, slug: b.business.slug, name: b.business.name,
            role: b.role, storeId: b.storeId, status: b.business.status,
          })),
        }
      : null,
    tests: {
      userExists,
      passwordHashExists,
      roleIsDeliveryStaff,
      businessMatch,
      storeAssignmentExists,
    },
    failReason,
    // "Invalid email or password" is produced only by the first three;
    // canLogin reflects whether the API would actually authenticate.
    canLogin: userExists && passwordHashExists && userActive && businessActive,
  };
}

function authorize(req: { user?: { isPlatformAdmin: boolean; role: string; businessId?: string } }, businessId: string) {
  const u = req.user!;
  if (u.isPlatformAdmin) return null;
  if (!ADMIN_ROLES.includes(u.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }
  if (u.businessId !== businessId) {
    return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
  }
  return null;
}

export const GET = withMiddleware({ requireAuth: true, requiredRoles: [...ADMIN_ROLES] })(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;
    if (!partnerId) return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });

    const partner = await loadPartner(partnerId);
    if (!partner) return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });

    const denied = authorize(req, partner.businessId);
    if (denied) return denied;

    return NextResponse.json({ success: true, data: buildDiagnosis(partner) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Diagnosis failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: [...ADMIN_ROLES] })(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;
    if (!partnerId) return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });

    const { action } = (await req.json()) as { action?: string };
    if (!action) return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });

    const partner = await loadPartner(partnerId);
    if (!partner) return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });

    const denied = authorize(req, partner.businessId);
    if (denied) return denied;

    const email = (partner.email || '').toLowerCase().trim();
    const requiresEmail = ['create-user', 'link-user', 'reset-password', 'regenerate', 'send-setup-email'];
    if (requiresEmail.includes(action) && !email) {
      return NextResponse.json({ success: false, error: 'Partner has no email. Add an email to the partner first.' }, { status: 400 });
    }

    let tempPassword: string | undefined;
    let message = 'Done';

    // Ensure a DELIVERY_STAFF User exists & is linked, carrying the partner's store.
    async function ensureUser(opts: { password?: string; forceChange: boolean }): Promise<string> {
      const plain = opts.password ?? generateTempPassword();
      if (!opts.password) tempPassword = plain;
      const hash = await hashPassword(plain);
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        await db.user.update({
          where: { id: existing.id },
          data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD', isActive: true, mustChangePassword: opts.forceChange },
        });
        const bu = await db.businessUser.findUnique({ where: { userId_businessId: { userId: existing.id, businessId: partner!.businessId } } });
        if (!bu) {
          await db.businessUser.create({ data: { userId: existing.id, businessId: partner!.businessId, role: 'DELIVERY_STAFF', storeId: partner!.storeId, isActive: true } });
        } else {
          await db.businessUser.update({ where: { id: bu.id }, data: { role: 'DELIVERY_STAFF', isActive: true, ...(partner!.storeId ? { storeId: partner!.storeId } : {}) } });
        }
        await db.deliveryPartner.update({ where: { id: partner!.id }, data: { userId: existing.id, appEnabled: true } });
        return existing.id;
      }
      const created = await db.user.create({
        data: {
          email, name: partner!.name, phone: partner!.phone,
          passwordHash: hash, hasPassword: true, mustChangePassword: opts.forceChange, authProvider: 'PASSWORD', isActive: true,
          businessUsers: { create: { businessId: partner!.businessId, role: 'DELIVERY_STAFF', storeId: partner!.storeId, isActive: true } },
        },
      });
      await db.deliveryPartner.update({ where: { id: partner!.id }, data: { userId: created.id, appEnabled: true } });
      return created.id;
    }

    switch (action) {
      case 'create-user':
      case 'link-user':
      case 'regenerate': {
        await ensureUser({ forceChange: true });
        message = tempPassword ? 'User ready. Temporary password generated.' : 'User linked.';
        break;
      }
      case 'reset-password': {
        await ensureUser({ forceChange: true });
        message = 'Password reset. Temporary password generated.';
        break;
      }
      case 'force-reset': {
        if (!partner.userId) return NextResponse.json({ success: false, error: 'No linked user to flag. Create the user first.' }, { status: 400 });
        await db.user.update({ where: { id: partner.userId }, data: { mustChangePassword: true } });
        message = 'Partner will be forced to set a new password on next login.';
        break;
      }
      case 'send-setup-email': {
        const userId = partner.userId || (await ensureUser({ forceChange: true }));
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
        await db.passwordResetToken.create({ data: { userId, token, expiresAt } });
        const domain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in';
        const slug = partner.business?.slug ?? 'app';
        const resetLink = `https://${slug}.${domain}/reset-password?token=${token}`;
        const { sent, error: sendErr } = await sendPasswordResetEmail({ to: email, resetLink, businessName: partner.business?.name ?? 'Quantix' });
        message = sent ? `Setup email sent to ${email}` : `Email not sent (${sendErr || 'SMTP not configured'}). Use the temp password instead.`;
        break;
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    await db.activityLog.create({
      data: {
        businessId: partner.businessId,
        userId: req.user!.id,
        action: `delivery.diagnose.${action}`,
        entity: 'DeliveryPartner',
        entityId: partner.id,
        details: JSON.stringify({ email, action }),
      },
    }).catch(() => null);

    const refreshed = await loadPartner(partnerId);
    return NextResponse.json({ success: true, message, tempPassword, data: refreshed ? buildDiagnosis(refreshed) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Repair failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
