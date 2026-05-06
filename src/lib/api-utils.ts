import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================================
// Token-Based Auth (for API routes, alongside NextAuth)
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  authProvider: string;
  emailVerified: boolean;
  isActive: boolean;
  businessUsers: Array<{
    id: string;
    userId: string;
    businessId: string;
    role: string;
    isActive: boolean;
    storeId: string | null;
    business: {
      id: string;
      name: string;
      slug: string;
      businessType: string;
      status: string;
      primaryColor: string;
      logo: string | null;
    };
  }>;
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await db.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return token;
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  const refreshToken = await db.refreshToken.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          businessUsers: {
            where: { isActive: true },
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  businessType: true,
                  status: true,
                  primaryColor: true,
                  logo: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!refreshToken) return null;
  if (refreshToken.expiresAt < new Date()) {
    await db.refreshToken.delete({ where: { id: refreshToken.id } }).catch(() => {});
    return null;
  }
  if (!refreshToken.user.isActive) return null;

  return refreshToken.user as unknown as AuthUser;
}

export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return authHeader;
}

// ============================================================================
// Auth Middleware Helpers
// ============================================================================

export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = getTokenFromHeader(authHeader);

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return handler(request, user);
}

export async function withBusinessAccess(
  request: NextRequest,
  businessId: string,
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, user) => {
    const hasAccess = user.businessUsers.some(bu => bu.businessId === businessId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this business' },
        { status: 403 }
      );
    }
    return handler(req, user);
  });
}

export async function validateBusinessExists(businessId: string): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  return !!business;
}

// ============================================================================
// Pagination Helpers
// ============================================================================

export function parsePagination(request: NextRequest): {
  page: number;
  limit: number;
  skip: number;
  search?: string;
} {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || undefined;
  const skip = (page - 1) * limit;

  return { page, limit, skip, search };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
