// ============================================================================
// QUANTIX CORE — Storefront Auth Helpers
// Shared session-creation logic for storefront customer endpoints.
// ============================================================================

import { db } from '@/lib/db';
import { createAccessToken } from '@/lib/password-utils';
import { getPermissionsForRole } from '@/lib/core';
import { generateCustomerCode } from '@/lib/customer-code';
import type { Role, BusinessType } from '@/lib/types';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 2);
  const stars = '*'.repeat(Math.max(3, user.length - 2));
  return `${visible}${stars}@${domain}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  if (!phone || !phone.trim()) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return ''; // no digits = no valid phone
  // Ensure +91 prefix for Indian numbers
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export interface CustomerSession {
  user: {
    id: string; name: string; email: string; avatar: string | null;
    role: string; businessId: string | undefined; businessName: string | undefined;
    businessType: string | undefined; businessSlug: string | undefined;
    storeId: string | undefined; permissions: string[]; isPlatformAdmin: boolean;
    hasPassword: boolean;
  };
  accessToken: string;
  refreshToken: string;
  businesses: unknown[];
  customerId: string;
  isPasswordSet: boolean;
  mustChangePassword: boolean;
}

/**
 * Find or create a user + customer record and return a session.
 * Used by both verify and reset-password endpoints.
 */
export async function createStorefrontSession(opts: {
  email: string;
  phone: string;
  name: string;
  businessId: string;
  storeId?: string;
  emailVerified?: boolean;
}): Promise<CustomerSession> {
  const { email, phone, name, businessId, storeId, emailVerified = false } = opts;

  // ── 1. Find or create User ──────────────────────────────────────────────────
  let user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, phone: true, name: true, avatar: true, isActive: true, hasPassword: true } });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        phone: phone || null,
        name,
        authProvider: 'EMAIL_OTP',
        emailVerified,
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true, phone: true, name: true, avatar: true, isActive: true, hasPassword: true },
    });
  } else {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(emailVerified ? { emailVerified: true } : {}),
        ...(phone && !user.phone ? { phone } : {}),
        ...(name && !user.name ? { name } : {}),
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true, phone: true, name: true, avatar: true, isActive: true, hasPassword: true },
    });
    user = updated;
  }

  // ── 2. BusinessUser link ────────────────────────────────────────────────────
  const existingBU = await db.businessUser.findFirst({
    where: { userId: user.id, businessId, isActive: true },
  });
  if (!existingBU) {
    await db.businessUser.create({
      data: { userId: user.id, businessId, role: 'CUSTOMER', isActive: true },
    });
  }

  // ── 3. Customer record — claim shadow or create ─────────────────────────────
  let customer = await db.customer.findFirst({ where: { userId: user.id, businessId } });

  if (!customer) {
    const shadow = phone
      ? await db.customer.findFirst({ where: { businessId, phone, userId: null } })
      : null;

    if (shadow) {
      const codeForShadow = shadow.customerCode ?? await generateCustomerCode(businessId)
      customer = await db.customer.update({
        where: { id: shadow.id },
        data: {
          userId: user.id,
          name: name || shadow.name,
          email: email || shadow.email,
          isGuest: false,
          verified: true,
          emailVerified,
          lastLoginAt: new Date(),
          source: 'STORE_FRONT',
          preferredStoreId: storeId || shadow.preferredStoreId || null,
          customerCode: codeForShadow,
          status: 'ACTIVE',
        },
      });
    } else {
      const newCode = await generateCustomerCode(businessId)
      customer = await db.customer.create({
        data: {
          businessId,
          userId: user.id,
          name,
          phone: phone || null,
          email,
          source: 'STORE_FRONT',
          isGuest: false,
          verified: true,
          emailVerified,
          lastLoginAt: new Date(),
          createdStoreId: storeId || null,
          preferredStoreId: storeId || null,
          customerCode: newCode,
          status: 'ACTIVE',
        },
      });
    }
  } else {
    await db.customer.update({
      where: { id: customer.id },
      data: {
        ...(email && !customer.email ? { email } : {}),
        ...(phone && !customer.phone ? { phone } : {}),
        ...(emailVerified ? { emailVerified: true, verified: true } : {}),
        lastLoginAt: new Date(),
      },
    }).catch(() => {});
  }

  // ── 4. Session tokens ───────────────────────────────────────────────────────
  const accessToken = createAccessToken();
  const refreshTokenValue = generateRefreshToken();
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.refreshToken.create({
    data: { userId: user.id, token: refreshTokenValue, expiresAt: refreshExpiresAt },
  });

  // ── 5. Business context ─────────────────────────────────────────────────────
  const businessUsers = await db.businessUser.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      business: { select: { id: true, name: true, slug: true, businessType: true, status: true, primaryColor: true } },
      store: { select: { id: true, name: true } },
    },
  });

  const primaryBU = businessUsers.find(bu => bu.businessId === businessId) ?? businessUsers[0];
  const role: Role = (primaryBU?.role as Role) ?? 'CUSTOMER';
  const permissions = getPermissionsForRole(role);

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
    role,
    businessId: primaryBU?.business.id,
    businessName: primaryBU?.business.name,
    businessType: primaryBU?.business.businessType as BusinessType | undefined,
    businessSlug: primaryBU?.business.slug,
    storeId: primaryBU?.storeId ?? undefined,
    permissions,
    isPlatformAdmin: false,
    hasPassword: user.hasPassword,
  };

  const businesses = businessUsers.map(bu => ({
    businessId: bu.businessId,
    businessName: bu.business.name,
    businessType: bu.business.businessType as BusinessType,
    businessSlug: bu.business.slug,
    role: bu.role as Role,
    storeId: bu.storeId ?? null,
    storeName: bu.store?.name ?? null,
    permissions: getPermissionsForRole(bu.role as Role),
    business: bu.business,
  }));

  return {
    user: sessionUser,
    accessToken,
    refreshToken: refreshTokenValue,
    businesses,
    customerId: customer.id,
    isPasswordSet: customer.isPasswordSet,
    mustChangePassword: customer.mustChangePassword,
  };
}
