// ============================================================================
// Quantix Technology — Comprehensive Database Seed
// MANAGED PLATFORM: Only Quantix creates businesses
// ============================================================================

import { db } from './db';
import { hashPassword } from './password-utils';
import { generateSlug } from './utils';
import type { BusinessType } from './types';

// ============================================================================
// DEMO DATA — 11 businesses (one per category)
// ============================================================================

const DEMO_BUSINESSES: Array<{
  name: string;
  slug: string;
  businessType: BusinessType;
  description: string;
  primaryColor: string;
  tagline: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  gstNumber: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail: string;
  supportPhone: string;
  latitude: number;
  longitude: number;
}> = [
  {
    name: 'FreshMart Grocery', slug: 'freshmart-grocery', businessType: 'GROCERY',
    description: 'Premium grocery delivery with fresh produce, dairy, and household essentials',
    primaryColor: '#10B981', tagline: 'Fresh to your doorstep',
    city: 'Mumbai', state: 'Maharashtra', pincode: '400001',
    address: '123 Market Street, Fort, Mumbai', gstNumber: '27AADCF1234A1Z5',
    contactEmail: 'info@freshmart.in', contactPhone: '9876543210',
    supportEmail: 'support@freshmart.in', supportPhone: '9876543211',
    latitude: 19.076, longitude: 72.8777,
  },
  {
    name: 'TastyBites Food Delivery', slug: 'tastybites-food', businessType: 'FOOD_DELIVERY',
    description: 'Fast and delicious food delivery from the best restaurants in town',
    primaryColor: '#F59E0B', tagline: 'Delicious food, delivered fast',
    city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
    address: '456 Food Hub, MG Road, Bengaluru', gstNumber: '29AADCF5678B1Z3',
    contactEmail: 'hello@tastybites.in', contactPhone: '9876543220',
    supportEmail: 'support@tastybites.in', supportPhone: '9876543221',
    latitude: 12.9716, longitude: 77.5946,
  },
  {
    name: 'SparkleClean Laundry', slug: 'sparkleclean-laundry', businessType: 'LAUNDRY',
    description: 'Professional laundry and dry cleaning with free pickup & delivery',
    primaryColor: '#3B82F6', tagline: 'We clean, you relax',
    city: 'Delhi', state: 'Delhi', pincode: '110001',
    address: '789 Clean Street, Connaught Place, New Delhi', gstNumber: '07AADCF9012C1Z1',
    contactEmail: 'care@sparkleclean.in', contactPhone: '9876543230',
    supportEmail: 'support@sparkleclean.in', supportPhone: '9876543231',
    latitude: 28.6139, longitude: 77.209,
  },
  {
    name: 'AutoGlow Car Wash', slug: 'autoglow-carwash', businessType: 'CAR_WASH',
    description: 'Premium car wash and detailing services with monthly subscription plans',
    primaryColor: '#8B5CF6', tagline: 'Your car deserves the best',
    city: 'Hyderabad', state: 'Telangana', pincode: '500001',
    address: '321 Auto Lane, Banjara Hills, Hyderabad', gstNumber: '36AADCF3456D1Z9',
    contactEmail: 'info@autoglow.in', contactPhone: '9876543240',
    supportEmail: 'support@autoglow.in', supportPhone: '9876543241',
    latitude: 17.385, longitude: 78.4867,
  },
  {
    name: 'MedQuick Pharmacy', slug: 'medquick-pharmacy', businessType: 'PHARMACY',
    description: 'Online pharmacy with prescription delivery and health consultations',
    primaryColor: '#EF4444', tagline: 'Health at your doorstep',
    city: 'Pune', state: 'Maharashtra', pincode: '411001',
    address: '56 Health Avenue, Camp, Pune', gstNumber: '27AADCF7890E1Z7',
    contactEmail: 'care@medquick.in', contactPhone: '9876543250',
    supportEmail: 'support@medquick.in', supportPhone: '9876543251',
    latitude: 18.5196, longitude: 73.8553,
  },
  {
    name: 'HomeFix Services', slug: 'homefix-services', businessType: 'HOME_SERVICES',
    description: 'Trusted home cleaning, repair, and maintenance professionals at your doorstep',
    primaryColor: '#F97316', tagline: 'Expert hands for your home',
    city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
    address: '654 Service Road, T Nagar, Chennai', gstNumber: '33AADCF1234F1Z3',
    contactEmail: 'book@homefix.in', contactPhone: '9876543260',
    supportEmail: 'support@homefix.in', supportPhone: '9876543261',
    latitude: 13.0827, longitude: 80.2707,
  },
  {
    name: 'ShopNow E-Commerce', slug: 'shopnow-ecommerce', businessType: 'ECOMMERCE',
    description: 'Multi-category online store with fast delivery and easy returns',
    primaryColor: '#06B6D4', tagline: 'Shop everything, delivered anywhere',
    city: 'Jaipur', state: 'Rajasthan', pincode: '302001',
    address: '12 Commerce Park, MI Road, Jaipur', gstNumber: '08AADCF5678G1Z5',
    contactEmail: 'hello@shopnow.in', contactPhone: '9876543270',
    supportEmail: 'support@shopnow.in', supportPhone: '9876543271',
    latitude: 26.9124, longitude: 75.7873,
  },
  {
    name: 'GlowUp Cosmetics', slug: 'glowup-cosmetics', businessType: 'COSMETICS',
    description: 'Beauty products and cosmetic services with expert consultations',
    primaryColor: '#EC4899', tagline: 'Glow with confidence',
    city: 'Kolkata', state: 'West Bengal', pincode: '700001',
    address: '89 Beauty Lane, Park Street, Kolkata', gstNumber: '19AADCF9012H1Z1',
    contactEmail: 'hello@glowup.in', contactPhone: '9876543280',
    supportEmail: 'support@glowup.in', supportPhone: '9876543281',
    latitude: 22.5726, longitude: 88.3639,
  },
  {
    name: 'FreshMeat Direct', slug: 'freshmeat-direct', businessType: 'MEAT_DELIVERY',
    description: 'Fresh meat and seafood delivery with same-day service',
    primaryColor: '#DC2626', tagline: 'Farm fresh meat, home delivered',
    city: 'Kochi', state: 'Kerala', pincode: '682001',
    address: '34 Fish Market Road, Ernakulam, Kochi', gstNumber: '32AADCF3456I1Z9',
    contactEmail: 'order@freshmeat.in', contactPhone: '9876543290',
    supportEmail: 'support@freshmeat.in', supportPhone: '9876543291',
    latitude: 9.9312, longitude: 76.2673,
  },
  {
    name: 'WoodCraft Furniture', slug: 'woodcraft-furniture', businessType: 'FURNITURE',
    description: 'Premium furniture and home décor with delivery & assembly',
    primaryColor: '#92400E', tagline: 'Crafted for your home',
    city: 'Jodhpur', state: 'Rajasthan', pincode: '342001',
    address: '78 Furniture Hub, Sardarpura, Jodhpur', gstNumber: '08AADCF7890J1Z7',
    contactEmail: 'info@woodcraft.in', contactPhone: '9876543300',
    supportEmail: 'support@woodcraft.in', supportPhone: '9876543301',
    latitude: 26.2389, longitude: 73.0243,
  },
  {
    name: 'CityGuide Directory', slug: 'cityguide-directory', businessType: 'DIRECTORY',
    description: 'Local business directory and listing platform for your city',
    primaryColor: '#6366F1', tagline: 'Discover local businesses',
    city: 'Ahmedabad', state: 'Gujarat', pincode: '380001',
    address: '45 Digital Tower, CG Road, Ahmedabad', gstNumber: '24AADCF1234K1Z5',
    contactEmail: 'info@cityguide.in', contactPhone: '9876543310',
    supportEmail: 'support@cityguide.in', supportPhone: '9876543311',
    latitude: 23.0225, longitude: 72.5714,
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

export async function seed() {
  console.log('🌱 Starting Quantix Platform seed...\n');

  // 1. Create Platform
  console.log('📦 Creating platform record...');
  const platform = await db.platform.upsert({
    where: { id: 'platform_1' },
    update: {},
    create: {
      id: 'platform_1',
      companyName: 'Quantix Technology',
      tagline: 'Run Your Business Smarter',
      website: 'www.quantixtechnology.in',
      supportEmail: 'support@quantixtechnology.in',
      supportPhone: '18001234567',
      defaultCurrency: 'INR',
      defaultLocale: 'en-IN',
      defaultTimezone: 'Asia/Kolkata',
      version: '2.0.0',
      hostingProvider: 'replit',
    },
  });
  console.log('  ✅ Platform created\n');

  // 2. Create Super Admin User
  console.log('👤 Creating super admin user...');
  const superAdminPassword = await hashPassword('Admin@123');
  const superAdmin = await db.user.upsert({
    where: { email: 'superadmin@quantixtechnology.in' },
    update: {},
    create: {
      email: 'superadmin@quantixtechnology.in',
      name: 'Quantix Super Admin',
      passwordHash: superAdminPassword,
      authProvider: 'PASSWORD',
      emailVerified: true,
      isActive: true,
    },
  });
  console.log('  ✅ Super admin created\n');

  // 3. Create Sales Team Members
  console.log('👥 Creating sales team members...');
  const salesPassword = await hashPassword('Sales@123');
  const salesMembers: Array<{ id: string; name: string; email: string }> = [];

  const salesTeamData = [
    { name: 'Priya Sharma', email: 'priya.sales@quantixtechnology.in', phone: '9901234567', region: 'North India', target: 500000 },
    { name: 'Ravi Kumar', email: 'ravi.sales@quantixtechnology.in', phone: '9902345678', region: 'South India', target: 600000 },
  ];

  for (const sData of salesTeamData) {
    const salesUser = await db.user.upsert({
      where: { email: sData.email },
      update: {},
      create: {
        email: sData.email,
        name: sData.name,
        phone: sData.phone,
        passwordHash: salesPassword,
        authProvider: 'PASSWORD',
        emailVerified: true,
        isActive: true,
      },
    });

    const salesMember = await db.salesTeamMember.upsert({
      where: { userId: salesUser.id },
      update: {},
      create: {
        platformId: platform.id,
        userId: salesUser.id,
        name: sData.name,
        email: sData.email,
        phone: sData.phone,
        target: sData.target,
        achieved: Math.floor(sData.target * 0.7),
        region: sData.region,
        isActive: true,
      },
    });

    salesMembers.push({ id: salesMember.id, name: sData.name, email: sData.email });
    console.log(`  ✅ ${sData.name} (${sData.region})`);
  }
  console.log('');

  // 4. Create Platform Plans
  console.log('📋 Creating platform plans...');
  const planConfigs = [
    { name: 'Starter', tier: 'STARTER' as const, monthlyPrice: 4999, yearlyPrice: 49999, description: 'Perfect for small businesses', maxStores: 1, maxProducts: 500, maxOrders: 1000, maxDeliveryPartners: 5, maxStaff: 10, hasPOS: true, hasDelivery: true, hasSubscription: false, hasCustomDomain: false, hasWhiteLabel: false, hasAdvancedReports: false, hasAPIAccess: false, features: ['1 Store', '500 Products', '1000 Orders/mo', 'Basic POS', 'Delivery'] },
    { name: 'Professional', tier: 'PROFESSIONAL' as const, monthlyPrice: 9999, yearlyPrice: 99999, description: 'For growing businesses', maxStores: 3, maxProducts: 2000, maxOrders: 5000, maxDeliveryPartners: 15, maxStaff: 25, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: false, hasAdvancedReports: true, hasAPIAccess: false, features: ['3 Stores', '2000 Products', '5000 Orders/mo', 'Advanced POS', 'Subscriptions', 'Custom Domain', 'Reports'] },
    { name: 'Enterprise', tier: 'ENTERPRISE' as const, monthlyPrice: 24999, yearlyPrice: 249999, description: 'For large businesses', maxStores: 999, maxProducts: 99999, maxOrders: 99999, maxDeliveryPartners: 999, maxStaff: 999, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: true, hasAdvancedReports: true, hasAPIAccess: true, features: ['Unlimited Everything', 'White Label', 'API Access', 'Priority Support'] },
  ];

  const planRecords: Array<{ id: string; tier: string; monthlyPrice: number }> = [];
  for (const planData of planConfigs) {
    const plan = await db.platformPlan.upsert({
      where: { id: `plan_${planData.tier.toLowerCase()}` },
      update: {},
      create: {
        id: `plan_${planData.tier.toLowerCase()}`,
        platformId: platform.id,
        name: planData.name,
        tier: planData.tier,
        monthlyPrice: planData.monthlyPrice,
        yearlyPrice: planData.yearlyPrice,
        description: planData.description,
        features: JSON.stringify(planData.features),
        maxStores: planData.maxStores,
        maxProducts: planData.maxProducts,
        maxOrders: planData.maxOrders,
        maxDeliveryPartners: planData.maxDeliveryPartners,
        maxStaff: planData.maxStaff,
        hasPOS: planData.hasPOS,
        hasDelivery: planData.hasDelivery,
        hasSubscription: planData.hasSubscription,
        hasCustomDomain: planData.hasCustomDomain,
        hasWhiteLabel: planData.hasWhiteLabel,
        hasAdvancedReports: planData.hasAdvancedReports,
        hasAPIAccess: planData.hasAPIAccess,
        sortOrder: planConfigs.indexOf(planData),
      },
    });
    planRecords.push({ id: plan.id, tier: planData.tier, monthlyPrice: planData.monthlyPrice });
    console.log(`  ✅ ${planData.name} (₹${planData.monthlyPrice}/mo)`);
  }
  console.log('');

  // 5. Create Demo Businesses
  console.log('🏢 Creating 11 demo businesses...');
  const businessRecords: Array<{ id: string; businessType: BusinessType; slug: string }> = [];
  const statuses = ['ONBOARDING', 'TRIAL', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED', 'ACTIVE', 'CHURNED'] as const;

  for (let i = 0; i < DEMO_BUSINESSES.length; i++) {
    const bizData = DEMO_BUSINESSES[i];
    const status = statuses[i] || 'ACTIVE';
    const business = await db.business.upsert({
      where: { slug: bizData.slug },
      update: {},
      create: {
        platformId: platform.id,
        salesRepId: i % 2 === 0 ? salesMembers[0]?.id : salesMembers[1]?.id,
        name: bizData.name,
        slug: bizData.slug,
        businessType: bizData.businessType,
        status: status as 'ONBOARDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED',
        description: bizData.description,
        primaryColor: bizData.primaryColor,
        tagline: bizData.tagline,
        address: bizData.address,
        city: bizData.city,
        state: bizData.state,
        pincode: bizData.pincode,
        country: 'India',
        gstNumber: bizData.gstNumber,
        contactEmail: bizData.contactEmail,
        contactPhone: bizData.contactPhone,
        supportEmail: bizData.supportEmail,
        supportPhone: bizData.supportPhone,
        latitude: bizData.latitude,
        longitude: bizData.longitude,
        defaultCurrency: 'INR',
        defaultLocale: 'en-IN',
        timezone: 'Asia/Kolkata',
        settings: JSON.stringify({ enableDelivery: true, enablePickup: true, enablePOS: true, orderPrefix: 'ORD', invoicePrefix: 'INV' }),
        features: JSON.stringify({ multiStore: true, pos: true, delivery: true, subscriptions: true, loyaltyPoints: true, promoCodes: true }),
        activatedAt: status === 'ACTIVE' ? new Date() : null,
        trialStartsAt: status === 'TRIAL' ? new Date() : null,
        trialEndsAt: status === 'TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
      },
    });
    businessRecords.push({ id: business.id, businessType: bizData.businessType, slug: bizData.slug });
    console.log(`  ✅ ${bizData.name} (${status})`);
  }
  console.log('');

  // 6. Create Business Subscriptions
  console.log('💳 Creating business subscriptions...');
  for (let i = 0; i < businessRecords.length; i++) {
    const biz = businessRecords[i];
    const status = statuses[i] || 'ACTIVE';
    if (status === 'ONBOARDING' || status === 'CHURNED') continue;

    const planTier = i < 5 ? 'STARTER' : i < 9 ? 'PROFESSIONAL' : 'ENTERPRISE';
    const plan = planRecords.find(p => p.tier === planTier);
    if (!plan) continue;

    const subStatus = status === 'TRIAL' ? 'TRIAL' : status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    await db.businessSubscription.upsert({
      where: { businessId: biz.id },
      update: {},
      create: {
        businessId: biz.id,
        planId: plan.id,
        status: subStatus as 'TRIAL' | 'ACTIVE' | 'SUSPENDED',
        planPrice: plan.monthlyPrice,
        billingCycle: i % 3 === 0 ? 'yearly' : 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialStart: subStatus === 'TRIAL' ? new Date() : null,
        trialEnd: subStatus === 'TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        autoRenew: true,
      },
    });
  }
  console.log('  ✅ Business subscriptions created\n');

  // 7. Create Domain Mappings
  console.log('🌐 Creating domain mappings...');
  for (const biz of businessRecords) {
    const domainStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'DNS_PROPAGATING', 'SSL_PENDING', 'ACTIVE', 'PENDING_DNS', 'ERROR'] as const;
    const idx = businessRecords.indexOf(biz);
    await db.domainMapping.upsert({
      where: { businessId: biz.id },
      update: {},
      create: {
        platformId: platform.id,
        businessId: biz.id,
        domain: `${biz.slug}.quantixtechnology.in`,
        subdomain: biz.slug,
        isPrimary: true,
        sslStatus: domainStatuses[idx] === 'ACTIVE' ? 'active' : 'pending',
        status: domainStatuses[idx] as 'PENDING_DNS' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'ACTIVE' | 'ERROR',
        configuredBy: superAdmin.id,
        configuredAt: new Date(),
      },
    });
  }
  console.log('  ✅ Domain mappings created\n');

  // 8. Create Deployments
  console.log('🚀 Creating deployments...');
  for (const biz of businessRecords) {
    const deploymentTypes = ['WEBSITE', 'ADMIN_DASHBOARD'] as const;
    for (const dtype of deploymentTypes) {
      await db.deployment.create({
        data: {
          platformId: platform.id,
          businessId: biz.id,
          type: dtype,
          status: 'LIVE',
          environment: 'production',
          hostingProvider: 'replit',
          liveUrl: `https://${biz.slug}.quantixtechnology.in`,
          version: '2.0.0',
          deployedBy: superAdmin.id,
          deployedAt: new Date(),
          healthStatus: 'healthy',
        },
      });
    }
  }
  console.log('  ✅ Deployments created\n');

  // 9. Create Leads in various stages
  console.log('📊 Creating leads...');
  const leadData = [
    { businessName: 'SpiceHub Restaurant', contactName: 'Amit Patel', businessType: 'FOOD_DELIVERY' as BusinessType, source: 'GOOGLE_ADS' as const, status: 'NEW' as const, estimatedValue: 59988 },
    { businessName: 'CleanPro Services', contactName: 'Neha Gupta', businessType: 'LAUNDRY' as BusinessType, source: 'META_ADS' as const, status: 'CONTACTED' as const, estimatedValue: 59988 },
    { businessName: 'WashMaster', contactName: 'Vikram Singh', businessType: 'CAR_WASH' as BusinessType, source: 'DIRECT_REFERRAL' as const, status: 'QUALIFIED' as const, estimatedValue: 119988 },
    { businessName: 'MediCare Plus', contactName: 'Dr. Sunita Rao', businessType: 'PHARMACY' as BusinessType, source: 'WEBSITE_INQUIRY' as const, status: 'PROPOSAL_SENT' as const, estimatedValue: 119988 },
    { businessName: 'GreenBasket', contactName: 'Rajesh Nair', businessType: 'GROCERY' as BusinessType, source: 'WHATSAPP_INQUIRY' as const, status: 'NEGOTIATION' as const, estimatedValue: 59988 },
    { businessName: 'HomeCare Solutions', contactName: 'Meera Joshi', businessType: 'HOME_SERVICES' as BusinessType, source: 'COLD_OUTREACH' as const, status: 'WON' as const, estimatedValue: 99988 },
    { businessName: 'QuickMeat', contactName: 'Arjun Reddy', businessType: 'MEAT_DELIVERY' as BusinessType, source: 'PHONE_CALL' as const, status: 'LOST' as const, estimatedValue: 59988 },
    { businessName: 'StyleBee Beauty', contactName: 'Pooja Malhotra', businessType: 'COSMETICS' as BusinessType, source: 'META_ADS' as const, status: 'FOLLOW_UP' as const, estimatedValue: 59988 },
  ];

  for (const ld of leadData) {
    await db.lead.create({
      data: {
        platformId: platform.id,
        salesRepId: salesMembers[leadData.indexOf(ld) % 2]?.id,
        businessName: ld.businessName,
        contactName: ld.contactName,
        contactEmail: `${ld.contactName.toLowerCase().replace(' ', '.')}@example.com`,
        contactPhone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        businessType: ld.businessType,
        source: ld.source,
        status: ld.status,
        estimatedValue: ld.estimatedValue,
        notes: `Lead for ${ld.businessName}`,
        tags: JSON.stringify([ld.businessType.toLowerCase()]),
      },
    });
  }
  console.log('  ✅ Leads created\n');

  // 10. Create Business Owners + Staff
  console.log('👤 Creating business owners & staff...');
  const ownerPassword = await hashPassword('Owner@123');
  const staffPassword = await hashPassword('Staff@123');

  for (const biz of businessRecords) {
    // Owner
    const ownerEmail = `owner@${biz.slug}.in`;
    const owner = await db.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        name: `Owner - ${DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.name || biz.slug}`,
        passwordHash: ownerPassword,
        authProvider: 'PASSWORD',
        emailVerified: true,
        isActive: true,
      },
    });
    await db.businessUser.upsert({
      where: { userId_businessId: { userId: owner.id, businessId: biz.id } },
      update: {},
      create: { userId: owner.id, businessId: biz.id, role: 'CLIENT_OWNER', isActive: true, acceptedAt: new Date() },
    });

    // Store Manager
    const mgrEmail = `manager@${biz.slug}.in`;
    const mgr = await db.user.upsert({
      where: { email: mgrEmail },
      update: {},
      create: {
        email: mgrEmail,
        name: `Manager - ${biz.slug}`,
        passwordHash: staffPassword,
        authProvider: 'PASSWORD',
        emailVerified: true,
        isActive: true,
      },
    });
    await db.businessUser.upsert({
      where: { userId_businessId: { userId: mgr.id, businessId: biz.id } },
      update: {},
      create: { userId: mgr.id, businessId: biz.id, role: 'STORE_MANAGER', isActive: true, acceptedAt: new Date() },
    });
  }
  console.log('  ✅ Owners & managers created\n');

  // 11. Create Stores
  console.log('🏪 Creating stores...');
  const storeRecords: Array<{ id: string; businessId: string }> = [];

  for (const biz of businessRecords) {
    const mainStore = await db.store.upsert({
      where: { businessId_slug: { businessId: biz.id, slug: `${biz.slug}-main` } },
      update: {},
      create: {
        businessId: biz.id,
        name: `${DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.name || biz.slug} - Main`,
        slug: `${biz.slug}-main`,
        code: 'STR01',
        address: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.address,
        city: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.city,
        state: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.state,
        pincode: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.pincode,
        country: 'India',
        latitude: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.latitude,
        longitude: DEMO_BUSINESSES.find(b => b.slug === biz.slug)?.longitude,
        isMainStore: true,
        deliveryRadius: 5.0,
        minOrderAmount: 0,
        deliveryFee: 30,
        freeDeliveryAbove: 500,
        preparationTime: 30,
        posEnabled: true,
        status: 'ACTIVE',
      },
    });
    storeRecords.push({ id: mainStore.id, businessId: biz.id });
  }
  console.log('');

  // 12. Create Store Timings
  console.log('🕐 Creating store timings...');
  for (const store of storeRecords) {
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      await db.storeTiming.upsert({
        where: { storeId_day: { storeId: store.id, day } },
        update: {},
        create: {
          storeId: store.id,
          day,
          openTime: day === 0 ? '09:00' : '08:00',
          closeTime: day === 0 ? '21:00' : '22:00',
          isClosed: false,
        },
      });
    }
  }
  console.log('  ✅ Store timings created\n');

  // 13. Create Categories & Products
  console.log('📦 Creating categories & products...');
  const categoryConfigs: Record<string, Array<{ name: string; slug: string }>> = {
    GROCERY: [{ name: 'Rice & Grains', slug: 'rice-grains' }, { name: 'Dairy & Eggs', slug: 'dairy-eggs' }, { name: 'Pulses & Lentils', slug: 'pulses-lentils' }],
    FOOD_DELIVERY: [{ name: 'North Indian', slug: 'north-indian' }, { name: 'South Indian', slug: 'south-indian' }, { name: 'Biryani', slug: 'biryani' }],
    LAUNDRY: [{ name: 'Wash & Fold', slug: 'wash-fold' }, { name: 'Dry Cleaning', slug: 'dry-cleaning' }],
    CAR_WASH: [{ name: 'Car Wash', slug: 'car-wash' }, { name: 'Detailing', slug: 'detailing' }],
    PHARMACY: [{ name: 'Medicines', slug: 'medicines' }, { name: 'Health & Wellness', slug: 'health-wellness' }],
    HOME_SERVICES: [{ name: 'Cleaning', slug: 'cleaning' }, { name: 'Appliance Repair', slug: 'appliance-repair' }],
    ECOMMERCE: [{ name: 'Electronics', slug: 'electronics' }, { name: 'Fashion', slug: 'fashion' }],
    COSMETICS: [{ name: 'Skincare', slug: 'skincare' }, { name: 'Makeup', slug: 'makeup' }],
    MEAT_DELIVERY: [{ name: 'Chicken', slug: 'chicken' }, { name: 'Mutton', slug: 'mutton' }],
    FURNITURE: [{ name: 'Living Room', slug: 'living-room' }, { name: 'Bedroom', slug: 'bedroom' }],
    DIRECTORY: [{ name: 'Restaurants', slug: 'restaurants' }, { name: 'Services', slug: 'services' }],
  };

  for (const biz of businessRecords) {
    const cats = categoryConfigs[biz.businessType] || [];
    const categoryRecords: Array<{ id: string }> = [];
    for (const catData of cats) {
      const cat = await db.category.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: catData.slug } },
        update: {},
        create: { businessId: biz.id, name: catData.name, slug: catData.slug, isActive: true },
      });
      categoryRecords.push({ id: cat.id });
    }

    // Create 2-3 products per business
    const productConfigs: Record<string, Array<{ name: string; slug: string; unit: string; isVeg: boolean | null; variants: Array<{ name: string; price: number; mrp: number }> }>> = {
      GROCERY: [
        { name: 'Organic Basmati Rice', slug: 'organic-basmati-rice', unit: 'kg', isVeg: true, variants: [{ name: '1 kg', price: 180, mrp: 220 }, { name: '5 kg', price: 850, mrp: 1100 }] },
        { name: 'Fresh Amul Butter', slug: 'fresh-amul-butter', unit: 'pack', isVeg: true, variants: [{ name: '100g', price: 52, mrp: 56 }] },
      ],
      FOOD_DELIVERY: [
        { name: 'Butter Chicken', slug: 'butter-chicken', unit: 'piece', isVeg: false, variants: [{ name: 'Regular', price: 280, mrp: 320 }] },
        { name: 'Paneer Tikka Masala', slug: 'paneer-tikka-masala', unit: 'piece', isVeg: true, variants: [{ name: 'Regular', price: 240, mrp: 280 }] },
      ],
      LAUNDRY: [
        { name: 'Wash & Fold', slug: 'wash-fold', unit: 'kg', isVeg: null, variants: [{ name: 'Per Kg', price: 49, mrp: 59 }] },
        { name: 'Dry Cleaning', slug: 'dry-cleaning', unit: 'piece', isVeg: null, variants: [{ name: 'Shirt/Saree', price: 99, mrp: 129 }] },
      ],
      CAR_WASH: [
        { name: 'Basic Car Wash', slug: 'basic-car-wash', unit: 'service', isVeg: null, variants: [{ name: 'Hatchback', price: 299, mrp: 399 }, { name: 'Sedan', price: 399, mrp: 499 }] },
        { name: 'Premium Detailing', slug: 'premium-detailing', unit: 'service', isVeg: null, variants: [{ name: 'Hatchback', price: 1499, mrp: 1999 }] },
      ],
      PHARMACY: [
        { name: 'Dolo 650mg', slug: 'dolo-650mg', unit: 'strip', isVeg: true, variants: [{ name: '15 Tablets', price: 32, mrp: 35 }] },
        { name: 'Crocin Advance', slug: 'crocin-advance', unit: 'strip', isVeg: true, variants: [{ name: '20 Tablets', price: 28, mrp: 30 }] },
      ],
      HOME_SERVICES: [
        { name: 'Deep Home Cleaning', slug: 'deep-home-cleaning', unit: 'service', isVeg: null, variants: [{ name: '1 BHK', price: 1499, mrp: 1999 }, { name: '2 BHK', price: 1999, mrp: 2599 }] },
        { name: 'AC Service', slug: 'ac-service', unit: 'service', isVeg: null, variants: [{ name: 'Regular Service', price: 499, mrp: 699 }] },
      ],
      ECOMMERCE: [
        { name: 'Wireless Earbuds', slug: 'wireless-earbuds', unit: 'piece', isVeg: null, variants: [{ name: 'Standard', price: 1299, mrp: 1999 }] },
        { name: 'Cotton T-Shirt', slug: 'cotton-tshirt', unit: 'piece', isVeg: null, variants: [{ name: 'M', price: 499, mrp: 799 }, { name: 'L', price: 499, mrp: 799 }] },
      ],
      COSMETICS: [
        { name: 'Vitamin C Serum', slug: 'vitamin-c-serum', unit: 'bottle', isVeg: null, variants: [{ name: '30ml', price: 599, mrp: 799 }] },
        { name: 'Matte Lipstick', slug: 'matte-lipstick', unit: 'piece', isVeg: null, variants: [{ name: 'Red', price: 349, mrp: 449 }] },
      ],
      MEAT_DELIVERY: [
        { name: 'Chicken Breast', slug: 'chicken-breast', unit: 'kg', isVeg: false, variants: [{ name: '500g', price: 180, mrp: 200 }, { name: '1 Kg', price: 340, mrp: 380 }] },
        { name: 'Mutton Curry Cut', slug: 'mutton-curry-cut', unit: 'kg', isVeg: false, variants: [{ name: '500g', price: 450, mrp: 500 }] },
      ],
      FURNITURE: [
        { name: 'Sheesham Wood Sofa', slug: 'sheesham-wood-sofa', unit: 'piece', isVeg: null, variants: [{ name: '3-Seater', price: 24999, mrp: 34999 }] },
        { name: 'King Size Bed', slug: 'king-size-bed', unit: 'piece', isVeg: null, variants: [{ name: 'With Storage', price: 29999, mrp: 39999 }] },
      ],
      DIRECTORY: [
        { name: 'Premium Listing', slug: 'premium-listing', unit: 'month', isVeg: null, variants: [{ name: 'Monthly', price: 299, mrp: 499 }] },
      ],
    };

    const prods = productConfigs[biz.businessType] || [];
    for (const prodData of prods) {
      const product = await db.product.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: prodData.slug } },
        update: {},
        create: {
          businessId: biz.id,
          storeId: storeRecords.find(s => s.businessId === biz.id)?.id,
          categoryId: categoryRecords[0]?.id || null,
          name: prodData.name,
          slug: prodData.slug,
          description: prodData.name,
          type: biz.businessType === 'LAUNDRY' || biz.businessType === 'CAR_WASH' || biz.businessType === 'HOME_SERVICES' ? 'SERVICE' : 'PHYSICAL',
          status: 'ACTIVE',
          unit: prodData.unit,
          isVeg: prodData.isVeg,
          isFeatured: true,
          minOrderQty: 1,
          maxOrderQty: 100,
          images: JSON.stringify([]),
          tags: JSON.stringify([]),
          metadata: JSON.stringify({}),
        },
      });

      for (const vd of prodData.variants) {
        await db.productVariant.upsert({
          where: { productId_name: { productId: product.id, name: vd.name } },
          update: {},
          create: {
            productId: product.id,
            name: vd.name,
            price: vd.price,
            mrp: vd.mrp,
            discountPrice: vd.price < vd.mrp ? vd.price : null,
            discountPercent: vd.price < vd.mrp ? Math.round(((vd.mrp - vd.price) / vd.mrp) * 100) : null,
            isDefault: prodData.variants.indexOf(vd) === 0,
            isActive: true,
            attributes: JSON.stringify({}),
          },
        });
      }
    }
    console.log(`  ✅ ${biz.slug}`);
  }
  console.log('');

  // 14. Create Tax Configs (GST)
  console.log('💰 Creating tax configurations...');
  const gstConfigs = [
    { name: 'GST 0% (Exempt)', taxType: 'GST_0' as const, gstRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, hsnCode: '0101', isDefault: true },
    { name: 'GST 5%', taxType: 'GST_5' as const, gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, hsnCode: '0201' },
    { name: 'GST 12%', taxType: 'GST_12' as const, gstRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, hsnCode: '1701' },
    { name: 'GST 18%', taxType: 'GST_18' as const, gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnCode: '2106' },
    { name: 'GST 28%', taxType: 'GST_28' as const, gstRate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28, hsnCode: '2402' },
  ];

  for (const biz of businessRecords) {
    for (const taxData of gstConfigs) {
      await db.taxConfig.create({
        data: {
          businessId: biz.id,
          name: taxData.name,
          taxType: taxData.taxType,
          gstRate: taxData.gstRate,
          cgstRate: taxData.cgstRate,
          sgstRate: taxData.sgstRate,
          igstRate: taxData.igstRate,
          hsnCode: taxData.hsnCode,
          isActive: true,
          isDefault: taxData.isDefault || false,
        },
      });
    }
  }
  console.log('  ✅ Tax configs created\n');

  // 15. Create Delivery Zones & Partners
  console.log('🚚 Creating delivery zones & partners...');
  for (const biz of businessRecords) {
    const store = storeRecords.find(s => s.businessId === biz.id);
    const bd = DEMO_BUSINESSES.find(b => b.slug === biz.slug);

    await db.deliveryZone.create({ data: { businessId: biz.id, storeId: store?.id, name: 'Zone 1 - Near (3km)', zoneType: 'CIRCLE', centerLat: bd?.latitude || 0, centerLng: bd?.longitude || 0, radius: 3, deliveryFee: 20, minOrderAmount: 100, freeDeliveryAbove: 300, estimatedTime: 25, isActive: true } });
    await db.deliveryZone.create({ data: { businessId: biz.id, storeId: store?.id, name: 'Zone 2 - Standard (5km)', zoneType: 'CIRCLE', centerLat: bd?.latitude || 0, centerLng: bd?.longitude || 0, radius: 5, deliveryFee: 35, minOrderAmount: 150, freeDeliveryAbove: 500, estimatedTime: 40, isActive: true } });

    if (biz.businessType !== 'DIRECTORY') {
      await db.deliveryPartner.upsert({ where: { businessId_phone: { businessId: biz.id, phone: '9901234567' } }, update: {}, create: { businessId: biz.id, name: 'Raju Kumar', phone: '9901234567', vehicleType: 'bike', vehicleNumber: 'MH01AB1234', isOnline: false, isActive: true } });
      await db.deliveryPartner.upsert({ where: { businessId_phone: { businessId: biz.id, phone: '9902345678' } }, update: {}, create: { businessId: biz.id, name: 'Suresh Yadav', phone: '9902345678', vehicleType: 'bike', vehicleNumber: 'MH02CD5678', isOnline: true, isActive: true } });
    }
  }
  console.log('  ✅ Delivery zones & partners created\n');

  // 16. Create Customers
  console.log('👥 Creating demo customers...');
  const sampleCustomers = [
    { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9812345678' },
    { name: 'Priya Patel', email: 'priya@example.com', phone: '9823456789' },
    { name: 'Amit Kumar', email: 'amit@example.com', phone: '9834567890' },
    { name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9845678901' },
  ];

  for (const biz of businessRecords) {
    for (const cd of sampleCustomers) {
      await db.customer.upsert({
        where: { businessId_phone: { businessId: biz.id, phone: cd.phone } },
        update: {},
        create: { businessId: biz.id, name: cd.name, email: cd.email, phone: cd.phone, isActive: true },
      });
    }
  }
  console.log('  ✅ Customers created\n');

  // 17. Create Subscription Plans (Car Wash etc.)
  console.log('📋 Creating subscription plans...');
  const subscriptionConfigs: Record<string, Array<{ name: string; slug: string; serviceType: string; billingCycle: string; price: number; originalPrice: number; totalCredits: number; creditLabel: string; features: string[] }>> = {
    CAR_WASH: [
      { name: 'Basic Wash Plan', slug: 'basic-wash-plan', serviceType: 'CAR_WASH', billingCycle: 'MONTHLY', price: 999, originalPrice: 1499, totalCredits: 4, creditLabel: 'washes', features: ['4 Basic washes/month', 'Exterior wash only'] },
      { name: 'Premium Shine Plan', slug: 'premium-shine-plan', serviceType: 'CAR_WASH', billingCycle: 'MONTHLY', price: 1999, originalPrice: 2999, totalCredits: 8, creditLabel: 'washes', features: ['8 Premium washes/month', 'Interior + Exterior', 'Wax coating'] },
    ],
    HOME_SERVICES: [
      { name: 'Weekly Clean Plan', slug: 'weekly-clean-plan', serviceType: 'HOME_SERVICE', billingCycle: 'WEEKLY', price: 499, originalPrice: 699, totalCredits: 1, creditLabel: 'cleaning sessions', features: ['1 Deep cleaning/week', '1 BHK coverage'] },
      { name: 'Monthly Maintenance', slug: 'monthly-maintenance', serviceType: 'HOME_SERVICE', billingCycle: 'MONTHLY', price: 1999, originalPrice: 2999, totalCredits: 4, creditLabel: 'service sessions', features: ['4 Service sessions/month', 'Any service type'] },
    ],
    LAUNDRY: [
      { name: 'Weekly Laundry Pack', slug: 'weekly-laundry-pack', serviceType: 'LAUNDRY', billingCycle: 'WEEKLY', price: 399, originalPrice: 599, totalCredits: 10, creditLabel: 'kg laundry', features: ['10 kg wash & fold/week', 'Free pickup & delivery'] },
    ],
    PHARMACY: [
      { name: 'Monthly Medicine Pack', slug: 'monthly-medicine-pack', serviceType: 'CUSTOM', billingCycle: 'MONTHLY', price: 299, originalPrice: 499, totalCredits: 1, creditLabel: 'deliveries', features: ['Free delivery', '5% extra discount'] },
    ],
    GROCERY: [
      { name: 'Weekly Essentials', slug: 'weekly-essentials', serviceType: 'GROCERY', billingCycle: 'WEEKLY', price: 999, originalPrice: 1199, totalCredits: 1, creditLabel: 'delivery', features: ['Free weekly delivery', '5% extra discount'] },
    ],
  };

  for (const biz of businessRecords) {
    const plans = subscriptionConfigs[biz.businessType] || [];
    for (const pd of plans) {
      await db.subscriptionPlan.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: pd.slug } },
        update: {},
        create: {
          businessId: biz.id,
          name: pd.name,
          slug: pd.slug,
          serviceType: pd.serviceType as 'CAR_WASH' | 'HOME_SERVICE' | 'LAUNDRY' | 'GROCERY' | 'CUSTOM',
          billingCycle: pd.billingCycle as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY',
          price: pd.price,
          originalPrice: pd.originalPrice,
          totalCredits: pd.totalCredits,
          creditLabel: pd.creditLabel,
          features: JSON.stringify(pd.features),
          isFeatured: true,
          isActive: true,
        },
      });
    }
  }
  console.log('  ✅ Subscription plans created\n');

  // 18. Create Sample Orders
  console.log('📦 Creating sample orders...');
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let orderCounter = 1;

  for (const biz of businessRecords.slice(0, 6)) { // First 6 businesses get sample orders
    const store = storeRecords.find(s => s.businessId === biz.id);
    if (!store) continue;

    const customers = await db.customer.findMany({ where: { businessId: biz.id }, take: 2 });
    const products = await db.product.findMany({ where: { businessId: biz.id }, include: { variants: true }, take: 3 });

    for (const cust of customers) {
      if (products.length === 0) continue;
      const product = products[orderCounter % products.length];
      const variant = product.variants[0];
      if (!variant) continue;

      const orderNum = `ORD-${datePart}-${String(orderCounter++).padStart(4, '0')}`;
      await db.order.create({
        data: {
          businessId: biz.id,
          storeId: store.id,
          orderNumber: orderNum,
          orderType: biz.businessType === 'LAUNDRY' ? 'PICKUP_AND_DELIVERY' : 'DELIVERY',
          status: 'DELIVERED',
          paymentStatus: 'COMPLETED',
          paymentMethod: 'UPI',
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          deliveryAddress: JSON.stringify({ city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }),
          subtotal: variant.price,
          totalTax: Math.round(variant.price * 0.05 * 100) / 100,
          cgstAmount: Math.round(variant.price * 0.025 * 100) / 100,
          sgstAmount: Math.round(variant.price * 0.025 * 100) / 100,
          deliveryFee: 30,
          totalAmount: Math.round((variant.price + variant.price * 0.05 + 30) * 100) / 100,
          confirmedAt: new Date(),
          deliveredAt: new Date(),
          items: {
            create: {
              productId: product.id,
              variantId: variant.id,
              productName: product.name,
              variantName: variant.name,
              quantity: 1,
              unitPrice: variant.price,
              mrp: variant.mrp,
              totalPrice: variant.price,
              totalMrp: variant.mrp,
              gstRate: 5,
              gstAmount: Math.round(variant.price * 0.05 * 100) / 100,
              cgstAmount: Math.round(variant.price * 0.025 * 100) / 100,
              sgstAmount: Math.round(variant.price * 0.025 * 100) / 100,
            },
          },
        },
      });
    }
  }
  console.log('  ✅ Sample orders created\n');

  // 19. Create POS Sessions
  console.log('💳 Creating POS sessions...');
  for (const biz of businessRecords.slice(0, 5)) {
    const store = storeRecords.find(s => s.businessId === biz.id);
    const owner = await db.businessUser.findFirst({ where: { businessId: biz.id, role: 'CLIENT_OWNER' } });
    if (!store || !owner) continue;

    await db.pOSSession.create({
      data: {
        businessId: biz.id,
        storeId: store.id,
        operatorId: owner.userId,
        sessionNumber: `POS-${now.getFullYear()}-${String(businessRecords.indexOf(biz) + 1).padStart(4, '0')}`,
        status: 'OPEN',
        openingBalance: 5000,
        totalSales: Math.floor(Math.random() * 15000) + 5000,
      },
    });
  }
  console.log('  ✅ POS sessions created\n');

  console.log('🎉 Seed completed successfully!\n');
  console.log('📋 Demo Credentials:');
  console.log('  Super Admin:    superadmin@quantixtechnology.in / Admin@123');
  console.log('  Sales Team:     priya.sales@quantixtechnology.in / Sales@123');
  console.log('                 ravi.sales@quantixtechnology.in / Sales@123');
  console.log('  Business Owner: owner@{business-slug}.in / Owner@123');
  console.log('  Store Manager:  manager@{business-slug}.in / Staff@123');
  console.log('');
  console.log('  Business Slugs: freshmart-grocery, tastybites-food, sparkleclean-laundry,');
  console.log('                  autoglow-carwash, medquick-pharmacy, homefix-services,');
  console.log('                  shopnow-ecommerce, glowup-cosmetics, freshmeat-direct,');
  console.log('                  woodcraft-furniture, cityguide-directory');
  console.log('');
}

// Run seed if called directly
seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
