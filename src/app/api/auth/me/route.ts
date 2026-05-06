import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'quantix-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = verify(token, JWT_SECRET) as { userId: string; email: string; businessId?: string };

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: {
        businessUsers: {
          include: {
            business: {
              include: {
                businessSubscription: { include: { plan: true } },
              },
            },
          },
        },
        salesProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    const { passwordHash: _, ...userWithoutPassword } = user;

    const currentBusiness = decoded.businessId
      ? user.businessUsers.find((bu) => bu.businessId === decoded.businessId)?.business
      : user.businessUsers[0]?.business;

    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        currentBusiness: currentBusiness
          ? {
              id: currentBusiness.id,
              name: currentBusiness.name,
              slug: currentBusiness.slug,
              businessType: currentBusiness.businessType,
              status: currentBusiness.status,
              primaryColor: currentBusiness.primaryColor,
              isOnline: currentBusiness.isOnline,
              subscription: currentBusiness.businessSubscription,
            }
          : null,
        businesses: user.businessUsers.map((bu) => ({
          businessId: bu.businessId,
          businessName: bu.business.name,
          businessType: bu.business.businessType,
          role: bu.role,
          slug: bu.business.slug,
          status: bu.business.status,
        })),
        isSuperAdmin: user.businessUsers.some((bu) => bu.role === 'QUANTIX_SUPER_ADMIN'),
        isSalesTeam: !!user.salesProfile,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
