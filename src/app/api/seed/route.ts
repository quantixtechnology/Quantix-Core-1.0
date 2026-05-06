import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    // 1. Platform
    const platform = await db.platform.upsert({
      where: { id: 'platform_1' },
      update: {},
      create: {
        id: 'platform_1',
        companyName: 'Quantix Technology',
        tagline: 'Run Your Business Smarter',
        website: 'www.quantixtechnology.in',
        hostingProvider: 'replit',
        version: '2.0.0',
      },
    });

    // 2. Plans
    const plans = [
      { id: 'plan_starter', name: 'Starter', tier: 'STARTER' as const, monthlyPrice: 4999, yearlyPrice: 49999, maxStores: 1, maxProducts: 500, maxOrders: 1000, maxDeliveryPartners: 5, maxStaff: 10, hasPOS: true, hasDelivery: true, hasSubscription: false, hasCustomDomain: false, hasWhiteLabel: false, hasAdvancedReports: false, hasAPIAccess: false, sortOrder: 0 },
      { id: 'plan_professional', name: 'Professional', tier: 'PROFESSIONAL' as const, monthlyPrice: 9999, yearlyPrice: 99999, maxStores: 3, maxProducts: 2000, maxOrders: 5000, maxDeliveryPartners: 15, maxStaff: 25, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: false, hasAdvancedReports: true, hasAPIAccess: false, sortOrder: 1 },
      { id: 'plan_enterprise', name: 'Enterprise', tier: 'ENTERPRISE' as const, monthlyPrice: 24999, yearlyPrice: 249999, maxStores: 999, maxProducts: 99999, maxOrders: 99999, maxDeliveryPartners: 999, maxStaff: 999, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: true, hasAdvancedReports: true, hasAPIAccess: true, sortOrder: 2 },
    ];
    for (const p of plans) {
      await db.platformPlan.upsert({ where: { id: p.id }, update: {}, create: { platformId: platform.id, ...p } });
    }

    // 3. Super Admin
    const admin = await db.user.upsert({
      where: { email: 'superadmin@quantixtechnology.in' },
      update: {},
      create: { email: 'superadmin@quantixtechnology.in', name: 'Quantix Super Admin', passwordHash: '$2a$12$placeholder', authProvider: 'PASSWORD', emailVerified: true },
    });

    // 4. Businesses - all 11 types
    const bizData = [
      { name: 'FreshMart Grocery', slug: 'freshmart', businessType: 'GROCERY' as const, city: 'Mumbai', state: 'Maharashtra', primaryColor: '#10B981', tagline: 'Fresh to your doorstep' },
      { name: 'SpiceRoute Kitchen', slug: 'spiceroute', businessType: 'FOOD_DELIVERY' as const, city: 'Delhi', state: 'Delhi', primaryColor: '#F59E0B', tagline: 'Delicious food, delivered fast' },
      { name: 'QuickClean Laundry', slug: 'quickclean', businessType: 'LAUNDRY' as const, city: 'Bangalore', state: 'Karnataka', primaryColor: '#6366F1', tagline: 'We clean, you relax' },
      { name: 'SparkleWash Auto', slug: 'sparklewash', businessType: 'CAR_WASH' as const, city: 'Hyderabad', state: 'Telangana', primaryColor: '#3B82F6', tagline: 'Your car deserves the best' },
      { name: 'MedQuick Pharmacy', slug: 'medquick', businessType: 'PHARMACY' as const, city: 'Chennai', state: 'Tamil Nadu', primaryColor: '#EF4444', tagline: 'Health at your doorstep' },
      { name: 'HomeFix Services', slug: 'homefix', businessType: 'HOME_SERVICES' as const, city: 'Pune', state: 'Maharashtra', primaryColor: '#8B5CF6', tagline: 'Expert hands for your home' },
      { name: 'ShopNow Express', slug: 'shopnow', businessType: 'ECOMMERCE' as const, city: 'Jaipur', state: 'Rajasthan', primaryColor: '#EC4899', tagline: 'Shop everything, delivered' },
      { name: 'GlowUp Beauty', slug: 'glowup', businessType: 'COSMETICS' as const, city: 'Kolkata', state: 'West Bengal', primaryColor: '#F472B6', tagline: 'Glow with confidence' },
      { name: 'FreshCuts Meat', slug: 'freshcuts', businessType: 'MEAT_DELIVERY' as const, city: 'Lucknow', state: 'Uttar Pradesh', primaryColor: '#DC2626', tagline: 'Farm fresh meat' },
      { name: 'WoodCraft Furniture', slug: 'woodcraft', businessType: 'FURNITURE' as const, city: 'Ahmedabad', state: 'Gujarat', primaryColor: '#92400E', tagline: 'Crafted for your home' },
      { name: 'CityGuide Directory', slug: 'cityguide', businessType: 'DIRECTORY' as const, city: 'Indore', state: 'Madhya Pradesh', primaryColor: '#0891B2', tagline: 'Discover local businesses' },
    ];

    const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIAL', 'ACTIVE', 'ACTIVE', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ACTIVE'] as const;
    const bizIds: string[] = [];

    for (let i = 0; i < bizData.length; i++) {
      const b = bizData[i];
      const biz = await db.business.upsert({
        where: { slug: b.slug },
        update: {},
        create: {
          platformId: platform.id,
          ...b,
          status: statuses[i],
          address: `${100 + i} Main Road`,
          pincode: `40000${i + 1}`,
          country: 'India',
          contactEmail: `info@${b.slug}.in`,
          contactPhone: `+91 98765 ${String(10000 + i)}`,
          activatedAt: statuses[i] === 'ACTIVE' ? new Date() : null,
          trialStartsAt: statuses[i] === 'TRIAL' ? new Date() : null,
          trialEndsAt: statuses[i] === 'TRIAL' ? new Date(Date.now() + 14 * 86400000) : null,
        },
      });
      bizIds.push(biz.id);

      // Subscription
      const planId = i < 4 ? 'plan_starter' : i < 8 ? 'plan_professional' : 'plan_starter';
      await db.businessSubscription.upsert({
        where: { businessId: biz.id },
        update: {},
        create: {
          businessId: biz.id,
          planId,
          status: statuses[i] === 'TRIAL' ? 'TRIAL' : statuses[i] === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
          planPrice: i < 4 ? 4999 : i < 8 ? 9999 : 4999,
          customPrice: i === 3 ? 7999 : null,
          discountPercentage: i === 3 ? 20 : null,
          manualPriceOverride: i === 3,
          billingCycle: i % 3 === 0 ? 'yearly' : 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          nextBillingDate: new Date(Date.now() + 30 * 86400000),
          trialStart: statuses[i] === 'TRIAL' ? new Date() : null,
          trialEnd: statuses[i] === 'TRIAL' ? new Date(Date.now() + 14 * 86400000) : null,
        },
      });

      // Domain
      await db.domainMapping.upsert({
        where: { businessId: biz.id },
        update: {},
        create: {
          platformId: platform.id,
          businessId: biz.id,
          domain: statuses[i] === 'ACTIVE' ? `${b.slug}.in` : `${b.slug}.quantixtechnology.in`,
          subdomain: b.slug,
          sslStatus: statuses[i] === 'ACTIVE' ? 'active' : 'pending',
          status: statuses[i] === 'ACTIVE' ? 'ACTIVE' : statuses[i] === 'ONBOARDING' ? 'PENDING_DNS' : 'SSL_PENDING',
          configuredBy: admin.id,
        },
      });

      // Deployment
      await db.deployment.create({
        data: {
          platformId: platform.id,
          businessId: biz.id,
          type: 'WEBSITE',
          status: statuses[i] === 'ACTIVE' ? 'LIVE' : 'PENDING',
          hostingProvider: 'replit',
          version: '2.0.0',
          healthStatus: statuses[i] === 'ACTIVE' ? 'healthy' : 'unknown',
          deployedBy: admin.id,
        },
      });

      // Store
      const store = await db.store.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: `${b.slug}-main` } },
        update: {},
        create: {
          businessId: biz.id,
          name: `${b.name} - Main Store`,
          slug: `${b.slug}-main`,
          address: `${100 + i} Main Road`,
          city: b.city,
          state: b.state,
          pincode: `40000${i + 1}`,
          country: 'India',
          isMainStore: true,
          deliveryRadius: 5,
          posEnabled: true,
          status: 'ACTIVE',
        },
      });

      // Categories
      const catMap: Record<string, string[]> = {
        GROCERY: ['Rice & Grains', 'Dairy', 'Pulses'],
        FOOD_DELIVERY: ['North Indian', 'Biryani', 'Desserts'],
        LAUNDRY: ['Wash & Fold', 'Dry Cleaning'],
        CAR_WASH: ['Car Wash', 'Detailing'],
        PHARMACY: ['Medicines', 'Health & Wellness'],
        HOME_SERVICES: ['Cleaning', 'Repair'],
        ECOMMERCE: ['Electronics', 'Fashion'],
        COSMETICS: ['Skincare', 'Makeup'],
        MEAT_DELIVERY: ['Chicken', 'Mutton'],
        FURNITURE: ['Living Room', 'Bedroom'],
        DIRECTORY: ['Restaurants', 'Services'],
      };
      const catIds: string[] = [];
      for (const cn of (catMap[b.businessType] || ['General'])) {
        const c = await db.category.create({ data: { businessId: biz.id, name: cn, slug: `${b.slug}-${cn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, isActive: true } });
        catIds.push(c.id);
      }

      // Tax configs
      const taxRates = [
        { name: 'GST 0%', taxType: 'GST_0' as const, gstRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, isDefault: true },
        { name: 'GST 5%', taxType: 'GST_5' as const, gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, hsnCode: '0803' },
        { name: 'GST 12%', taxType: 'GST_12' as const, gstRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, hsnCode: '2106' },
        { name: 'GST 18%', taxType: 'GST_18' as const, gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnCode: '2101' },
      ];
      for (const t of taxRates) {
        await db.taxConfig.create({ data: { businessId: biz.id, ...t, isActive: true } });
      }
    }

    return NextResponse.json({
      success: true,
      data: { businesses: bizIds.length, message: 'Seed completed successfully' },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
