// ============================================================================
// Quantix Technology - Authentication Utilities (NextAuth v4)
// ============================================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import { verifyPassword, hashPassword } from './password-utils';
import type { Role, BusinessType, Permission } from './types';
import { getPermissionsForRole } from './permissions';

// ============================================================================
// NEXTAUTH CONFIGURATION
// ============================================================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            businessUsers: {
              include: {
                business: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    businessType: true,
                  },
                },
              },
            },
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
          throw new Error('Account is deactivated. Please contact support.');
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Get primary business context (first active business)
        const primaryBusinessUser = user.businessUsers.find((bu) => bu.isActive);
        const primaryBusiness = primaryBusinessUser?.business;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: primaryBusinessUser?.role || ('CUSTOMER' as Role),
          businessId: primaryBusiness?.id,
          businessName: primaryBusiness?.name,
          businessType: primaryBusiness?.businessType,
          businessSlug: primaryBusiness?.slug,
          storeId: primaryBusinessUser?.storeId,
          permissions: getPermissionsForRole(primaryBusinessUser?.role || ('CUSTOMER' as Role)),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
        token.businessName = user.businessName;
        token.businessType = user.businessType;
        token.businessSlug = user.businessSlug;
        token.storeId = user.storeId;
        token.permissions = user.permissions;
      }

      // Update session (e.g., when switching business context)
      if (trigger === 'update' && session) {
        if (session.businessId) token.businessId = session.businessId;
        if (session.businessName) token.businessName = session.businessName;
        if (session.businessType) token.businessType = session.businessType;
        if (session.businessSlug) token.businessSlug = session.businessSlug;
        if (session.role) {
          token.role = session.role;
          token.permissions = getPermissionsForRole(session.role);
        }
        if (session.storeId) token.storeId = session.storeId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.businessId = token.businessId as string | undefined;
        session.user.businessName = token.businessName as string | undefined;
        session.user.businessType = token.businessType as BusinessType | undefined;
        session.user.businessSlug = token.businessSlug as string | undefined;
        session.user.storeId = token.storeId as string | undefined;
        session.user.permissions = token.permissions as Permission[];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// ============================================================================
// TYPE AUGMENTATION FOR NEXT-AUTH
// ============================================================================

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
      role: Role;
      businessId?: string;
      businessName?: string;
      businessType?: BusinessType;
      businessSlug?: string;
      storeId?: string;
      permissions: Permission[];
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    role: Role;
    businessId?: string;
    businessName?: string;
    businessType?: BusinessType;
    businessSlug?: string;
    storeId?: string;
    permissions: Permission[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    businessId?: string;
    businessName?: string;
    businessType?: BusinessType;
    businessSlug?: string;
    storeId?: string;
    permissions: Permission[];
  }
}

// ============================================================================
// BUSINESS CONTEXT EXTRACTION
// ============================================================================

import type { BusinessContext } from './types';
import type { Session } from 'next-auth';

/**
 * Extract business context from session
 */
export function getBusinessContext(session: Session | null): BusinessContext | null {
  if (!session?.user) return null;

  return {
    businessId: session.user.businessId || '',
    businessType: session.user.businessType || 'GROCERY',
    businessSlug: session.user.businessSlug || '',
    businessName: session.user.businessName || '',
    role: session.user.role,
    userId: session.user.id,
    storeId: session.user.storeId,
    permissions: session.user.permissions,
  };
}

/**
 * Check if user is a platform admin
 */
export function isPlatformAdmin(session: Session | null): boolean {
  return session?.user?.role === 'SUPER_ADMIN';
}

/**
 * Check if user belongs to a business
 */
export function belongsToBusiness(session: Session | null, businessId: string): boolean {
  if (!session?.user) return false;
  if (session.user.role === 'SUPER_ADMIN') return true;
  return session.user.businessId === businessId;
}
