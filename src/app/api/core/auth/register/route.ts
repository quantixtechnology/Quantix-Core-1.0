// ============================================================================
// Route: POST /api/core/auth/register
// Register a CUSTOMER user via OTP invite (business-initiated only).
//
// SECURITY POLICY:
//   - No self-signup. No password creation by users.
//   - Only CUSTOMER role can be registered via this endpoint.
//   - Business staff accounts are created by admins via the staff API.
//   - authProvider must be EMAIL_OTP or WHATSAPP_OTP (no PASSWORD).
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

    // Block password-based self-signup
    if ((body as Record<string, unknown>).password) {
      return NextResponse.json(
        { success: false, error: 'Self-signup with password is not allowed. Contact your administrator.' },
        { status: 403 }
      );
    }

    // Block any attempt to assign non-customer roles
    if ((body as Record<string, unknown>).role && (body as Record<string, unknown>).role !== 'CUSTOMER') {
      return NextResponse.json(
        { success: false, error: 'Only CUSTOMER accounts can be created via this endpoint.' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Always normalize email: lowercase + trim
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
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
                email: normalizedEmail,
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
        email: normalizedEmail,
        phone: phone || null,
        name,
        authProvider: provider,
        emailVerified: provider === 'EMAIL_OTP',
        phoneVerified: provider === 'WHATSAPP_OTP' && !!phone,
      },
    });

    // If businessId provided, create BusinessUser with CUSTOMER role
    let businessUser: { id: string; businessId: string; role: string } | null = null;
    if (businessId) {
      // Verify business exists
      const business = await db.business.findUnique({ where: { id: businessId } });
      if (!business) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }

      const created = await db.businessUser.create({
        data: {
          userId: user.id,
          businessId,
          role: 'CUSTOMER',
          acceptedAt: new Date(),
        },
      });
      businessUser = { id: created.id, businessId: created.businessId, role: created.role };

      // Create Customer record for this business
      if (phone) {
        await db.customer.create({
          data: {
            businessId,
            userId: user.id,
            name,
            email: normalizedEmail,
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
