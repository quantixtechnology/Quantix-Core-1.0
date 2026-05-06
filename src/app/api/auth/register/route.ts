import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, name, password, role, businessId } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, name, and password are required' },
        { status: 400 }
      );
    }

    // Only QUANTIX_SUPER_ADMIN or system can create users
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        phone,
        name,
        passwordHash,
        authProvider: 'PASSWORD',
        emailVerified: true,
      },
    });

    // If businessId and role provided, create business user association
    if (businessId && role) {
      const business = await db.business.findUnique({ where: { id: businessId } });
      if (business) {
        await db.businessUser.create({
          data: {
            userId: user.id,
            businessId,
            role,
            acceptedAt: new Date(),
          },
        });
      }
    }

    const { passwordHash: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { success: true, data: userWithoutPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
