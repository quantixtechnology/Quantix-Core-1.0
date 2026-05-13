// ============================================================================
// QUANTIX CORE — Business Owner Provisioning API
// POST /api/core/businesses/[businessId]/provision
//
// Retroactively creates an owner user + BusinessUser record for businesses
// that were created before the auto-provisioning flow was added.
// Also usable by Super Admin to reset / regenerate owner credentials.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const body = await request.json().catch(() => ({})) as {
      ownerEmail?: string;
      ownerPassword?: string;
      ownerName?: string;
      resetExisting?: boolean;
    };

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, contactPhone: true, status: true },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Check for existing owner
    const existingOwner = await db.businessUser.findFirst({
      where: { businessId, role: 'CLIENT_OWNER', isActive: true },
      include: { user: { select: { id: true, email: true } } },
    });

    if (existingOwner && !body.resetExisting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Business already has an active owner. Pass resetExisting: true to regenerate credentials.',
          existingOwner: { userId: existingOwner.userId, email: existingOwner.user.email },
        },
        { status: 409 }
      );
    }

    const ownerEmail = body.ownerEmail || `owner@${business.slug}.in`;
    const rawPassword = body.ownerPassword || `${business.name.replace(/[^a-zA-Z0-9]/g, '')}@123`;
    const ownerName = body.ownerName || `${business.name} Owner`;
    const passwordHash = await hashPassword(rawPassword);

    let ownerUserId: string;

    if (existingOwner && body.resetExisting) {
      // Reset password on existing owner user
      await db.user.update({
        where: { id: existingOwner.userId },
        data: { passwordHash, isActive: true },
      });
      ownerUserId = existingOwner.userId;
    } else {
      // Check if email already taken by another user
      const emailTaken = await db.user.findUnique({ where: { email: ownerEmail } });
      if (emailTaken) {
        // Link this user as the owner instead of creating a new one
        await db.businessUser.upsert({
          where: { userId_businessId: { userId: emailTaken.id, businessId } },
          update: { role: 'CLIENT_OWNER', isActive: true, acceptedAt: new Date() },
          create: {
            userId: emailTaken.id,
            businessId,
            role: 'CLIENT_OWNER',
            isActive: true,
            invitedAt: new Date(),
            acceptedAt: new Date(),
          },
        });
        // Reset their password to the generated one
        await db.user.update({
          where: { id: emailTaken.id },
          data: { passwordHash, isActive: true },
        });
        ownerUserId = emailTaken.id;
      } else {
        // Create a fresh owner user
        const newUser = await db.user.create({
          data: {
            email: ownerEmail,
            name: ownerName,
            phone: business.contactPhone || null,
            passwordHash,
            authProvider: 'PASSWORD',
            emailVerified: false,
            isActive: true,
          },
        });

        await db.businessUser.create({
          data: {
            userId: newUser.id,
            businessId,
            role: 'CLIENT_OWNER',
            isActive: true,
            invitedAt: new Date(),
            acceptedAt: new Date(),
          },
        });

        ownerUserId = newUser.id;
      }
    }

    // Log the provisioning action
    await db.activityLog.create({
      data: {
        businessId,
        action: 'business.owner_provisioned',
        entity: 'Business',
        entityId: businessId,
        details: JSON.stringify({
          ownerEmail,
          ownerUserId,
          reset: !!(existingOwner && body.resetExisting),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: existingOwner && body.resetExisting
        ? 'Owner credentials reset successfully'
        : 'Owner account provisioned successfully',
      ownerCredentials: {
        email: ownerEmail,
        password: rawPassword,
        userId: ownerUserId,
        businessId,
        role: 'CLIENT_OWNER',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to provision owner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
