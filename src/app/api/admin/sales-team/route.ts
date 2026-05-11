// ============================================================================
// Route: GET/POST /api/admin/sales-team
// GET  — Returns active sales team members
// POST — Creates a new sales team member (User + SalesTeamMember)
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const salesTeam = await db.salesTeamMember.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        region: true,
        target: true,
        achieved: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: salesTeam,
    });
  } catch (error) {
    console.error('[admin/sales-team] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch sales team: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, region, target } = body;

    // Validate required fields
    if (!name || !email || !phone || !region || target === undefined || target === null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, email, phone, region, target' },
        { status: 400 }
      );
    }

    // Check if email is already in use
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash default password
    const passwordHash = await hashPassword('Quantix@123');

    // Create User + SalesTeamMember in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the User record
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone,
          passwordHash,
          authProvider: 'EMAIL_OTP',
          emailVerified: true,
          isActive: true,
        },
      });

      // Create the SalesTeamMember record linked to the user
      const salesMember = await tx.salesTeamMember.create({
        data: {
          userId: user.id,
          name,
          email,
          phone,
          region,
          target: Number(target),
          achieved: 0,
          isActive: true,
        },
      });

      return salesMember;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[admin/sales-team] POST Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to create sales team member: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
