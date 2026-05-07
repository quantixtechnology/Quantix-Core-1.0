// ============================================================================
// Route: POST /api/core/auth/register
// Register new user (CUSTOMER role only, when invited by a business)
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, businessId, authProvider } = body as {
      name: string;
      email: string;
      phone?: string;
      businessId?: string;
      authProvider?: 'EMAIL_OTP' | 'WHATSAPP_OTP';
    };

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      // If user exists and businessId provided, just add them to the business
      if (businessId) {
        const existingBusinessUser = await db.businessUser.findUnique({
          where: {
            userId_businessId: { userId: existingUser.id, businessId },
          },
        });

        if (existingBusinessUser) {
          return NextResponse.json(
            { success: false, error: 'User is already registered with this business' },
            { status: 409 }
          );
        }

        // Add as CUSTOMER to the business
        const businessUser = await db.businessUser.create({
          data: {
            userId: existingUser.id,
            businessId,
            role: 'CUSTOMER',
            acceptedAt: new Date(),
          },
        });

        // Also create a Customer record for this business
        if (phone) {
          const existingCustomer = await db.customer.findUnique({
            where: {
              businessId_phone: { businessId, phone },
            },
          });

          if (!existingCustomer) {
            await db.customer.create({
              data: {
                businessId,
                userId: existingUser.id,
                name,
                email,
                phone,
              },
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            user: {
              id: existingUser.id,
              email: existingUser.email,
              phone: existingUser.phone,
              name: existingUser.name,
            },
            businessUser: {
              id: businessUser.id,
              businessId,
              role: 'CUSTOMER',
            },
          },
          message: 'User added to business as CUSTOMER',
        });
      }

      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const provider = authProvider || 'EMAIL_OTP';
    const user = await db.user.create({
      data: {
        email,
        phone: phone || null,
        name,
        authProvider: provider,
        emailVerified: provider === 'EMAIL_OTP',
        phoneVerified: provider === 'WHATSAPP_OTP' && !!phone,
      },
    });

    // If businessId provided, create BusinessUser with CUSTOMER role
    let businessUser = null;
    if (businessId) {
      // Verify business exists
      const business = await db.business.findUnique({ where: { id: businessId } });
      if (!business) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }

      businessUser = await db.businessUser.create({
        data: {
          userId: user.id,
          businessId,
          role: 'CUSTOMER',
          acceptedAt: new Date(),
        },
      });

      // Create Customer record for this business
      if (phone) {
        await db.customer.create({
          data: {
            businessId,
            userId: user.id,
            name,
            email,
            phone,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
        },
        businessUser: businessUser
          ? {
              id: businessUser.id,
              businessId,
              role: 'CUSTOMER',
            }
          : null,
      },
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error('[register] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
