import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (isActive !== null) where.isActive = isActive === 'true';

    const team = await db.salesTeamMember.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
        _count: { select: { leads: true, clients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    console.error('Get sales team error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales team' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, target, region, avatar } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and phone are required' },
        { status: 400 }
      );
    }

    // Create user first if not exists
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name,
          phone,
          authProvider: 'PASSWORD',
        },
      });
    }

    const member = await db.salesTeamMember.create({
      data: {
        platformId: 'platform_1',
        userId: user.id,
        name,
        email,
        phone,
        avatar,
        target: target ? parseFloat(String(target)) : 0,
        region,
      },
    });

    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error) {
    console.error('Create sales team member error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sales team member' },
      { status: 500 }
    );
  }
}
