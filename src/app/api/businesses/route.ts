import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, parsePagination, paginatedResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    try {
      const { page, limit, skip, search } = parsePagination(request);

      const isSuperAdmin = user.businessUsers.some(bu => bu.role === 'SUPER_ADMIN');

      let where = {};
      if (!isSuperAdmin) {
        const businessIds = user.businessUsers.map(bu => bu.businessId);
        where = { id: { in: businessIds } };
      }

      if (search) {
        where = {
          ...where,
          OR: [
            { name: { contains: search } },
            { slug: { contains: search } },
            { city: { contains: search } },
          ],
        };
      }

      const [businesses, total] = await Promise.all([
        db.business.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { stores: true, customers: true, orders: true, products: true },
            },
          },
        }),
        db.business.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(businesses, total, page, limit),
      });
    } catch (error) {
      console.error('List businesses error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (_req, user) => {
    try {
      const isSuperAdmin = user.businessUsers.some(bu => bu.role === 'SUPER_ADMIN');
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only super admins can create businesses' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const {
        name, slug, businessType, description, domain, subdomain,
        primaryColor, secondaryColor, logo, favicon,
        address, city, state, pincode, country,
        contactEmail, contactPhone, supportEmail, supportPhone,
        gstNumber, panNumber, cinNumber,
        defaultCurrency, defaultLocale, timezone,
      } = body;

      if (!name || !slug || !businessType) {
        return NextResponse.json(
          { success: false, error: 'Name, slug, and businessType are required' },
          { status: 400 }
        );
      }

      // Check slug uniqueness
      const existing = await db.business.findUnique({ where: { slug } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Business slug already exists' },
          { status: 409 }
        );
      }

      const business = await db.business.create({
        data: {
          platformId: 'platform_1',
          name,
          slug,
          businessType,
          description,
          domain,
          subdomain,
          primaryColor: primaryColor || '#10B981',
          secondaryColor,
          logo,
          favicon,
          address,
          city,
          state,
          pincode,
          country: country || 'India',
          contactEmail,
          contactPhone,
          supportEmail,
          supportPhone,
          gstNumber,
          panNumber,
          cinNumber,
          defaultCurrency: defaultCurrency || 'INR',
          defaultLocale: defaultLocale || 'en-IN',
          timezone: timezone || 'Asia/Kolkata',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });

      // Assign the creator as business owner
      await db.businessUser.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: 'BUSINESS_OWNER',
          acceptedAt: new Date(),
        },
      });

      return NextResponse.json(
        { success: true, data: business, message: 'Business created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create business error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
