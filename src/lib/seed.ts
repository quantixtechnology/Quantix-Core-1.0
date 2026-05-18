// ============================================================================
// Quantix Technology — Comprehensive Database Seed (v2)
// MANAGED PLATFORM: Only Quantix creates businesses
// Matches CURRENT Prisma schema exactly — no Platform model, no platformId,
// no trial fields, correct enums, correct field names
// ============================================================================

import { db } from './db';
import { hashPassword } from './password-utils';

// ============================================================================
// DEMO DATA — 11 businesses (one per BusinessType)
// ============================================================================

const DEMO_BUSINESSES: Array<{
  name: string;
  slug: string;
  businessType: string;
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

  // 1. Create PlatformConfig (key-value store — replaces old Platform model)
  console.log('📦 Creating platform config...');
  const platformConfigs = [
    { key: 'company_name', value: 'Quantix Technology', description: 'Platform company name' },
    { key: 'tagline', value: 'Run Your Business Smarter', description: 'Platform tagline' },
    { key: 'website', value: 'www.quantixtechnology.in', description: 'Platform website' },
    { key: 'support_email', value: 'support@quantixtechnology.in', description: 'Support email' },
    { key: 'support_phone', value: '18001234567', description: 'Support phone' },
    { key: 'default_currency', value: 'INR', description: 'Default currency' },
    { key: 'default_locale', value: 'en-IN', description: 'Default locale' },
    { key: 'default_timezone', value: 'Asia/Kolkata', description: 'Default timezone' },
    { key: 'version', value: '2.0.0', description: 'Platform version' },
    { key: 'hosting_provider', value: 'replit', description: 'Hosting provider' },
  ];

  for (const config of platformConfigs) {
    await db.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log('  ✅ Platform configs created\n');

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

    // SalesTeamMember has NO platformId
    const salesMember = await db.salesTeamMember.upsert({
      where: { userId: salesUser.id },
      update: {},
      create: {
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

  // 4. Create Platform Plans — 2 plans only (STANDARD and PRO), feature access only, NO pricing
  console.log('📋 Creating platform plans...');
  const planConfigs = [
    {
      tier: 'STANDARD' as const,
      name: 'Quantix Standard',
      description: 'Core workflows: Ecommerce, POS, Delivery. Standard badge.',
      maxStores: 2, maxProducts: 1000, maxOrders: 2000, maxDeliveryPartners: 10, maxStaff: 15,
      features: ['2 Stores', '1000 Products', '2000 Orders/mo', 'POS', 'Delivery', 'Ecommerce Workflow'],
      hasEcommerceWorkflow: true, hasPickupWorkflow: false, hasAppointmentWorkflow: false,
      hasSubscriptionWorkflow: false, hasPostServiceWorkflow: false, hasAdvancedWorkflowEngine: false,
    },
    {
      tier: 'PRO' as const,
      name: 'Quantix Pro',
      description: 'All workflows unlocked: Pickup, Appointment, Subscription, Post-Service. Premium badge.',
      maxStores: 5, maxProducts: 5000, maxOrders: 10000, maxDeliveryPartners: 50, maxStaff: 50,
      features: ['5 Stores', '5000 Products', '10000 Orders/mo', 'Advanced POS', 'All Workflows', 'Custom Domain', 'Reports', 'API Access'],
      hasEcommerceWorkflow: true, hasPickupWorkflow: true, hasAppointmentWorkflow: true,
      hasSubscriptionWorkflow: true, hasPostServiceWorkflow: true, hasAdvancedWorkflowEngine: true,
    },
  ];

  const planRecords: Array<{ id: string; tier: string }> = [];
  for (const planData of planConfigs) {
    const plan = await db.platformPlan.upsert({
      where: { tier: planData.tier },
      update: {
        name: planData.name,
        description: planData.description,
        features: JSON.stringify(planData.features),
        maxStores: planData.maxStores,
        maxProducts: planData.maxProducts,
        maxOrders: planData.maxOrders,
        maxDeliveryPartners: planData.maxDeliveryPartners,
        maxStaff: planData.maxStaff,
        hasEcommerceWorkflow: planData.hasEcommerceWorkflow,
        hasPickupWorkflow: planData.hasPickupWorkflow,
        hasAppointmentWorkflow: planData.hasAppointmentWorkflow,
        hasSubscriptionWorkflow: planData.hasSubscriptionWorkflow,
        hasPostServiceWorkflow: planData.hasPostServiceWorkflow,
        hasAdvancedWorkflowEngine: planData.hasAdvancedWorkflowEngine,
      },
      create: {
        tier: planData.tier,
        name: planData.name,
        description: planData.description,
        features: JSON.stringify(planData.features),
        maxStores: planData.maxStores,
        maxProducts: planData.maxProducts,
        maxOrders: planData.maxOrders,
        maxDeliveryPartners: planData.maxDeliveryPartners,
        maxStaff: planData.maxStaff,
        hasEcommerceWorkflow: planData.hasEcommerceWorkflow,
        hasPickupWorkflow: planData.hasPickupWorkflow,
        hasAppointmentWorkflow: planData.hasAppointmentWorkflow,
        hasSubscriptionWorkflow: planData.hasSubscriptionWorkflow,
        hasPostServiceWorkflow: planData.hasPostServiceWorkflow,
        hasAdvancedWorkflowEngine: planData.hasAdvancedWorkflowEngine,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: planData.tier === 'PRO',
        hasCustomDomain: planData.tier === 'PRO',
        hasWhiteLabel: planData.tier === 'PRO',
        hasAdvancedReports: planData.tier === 'PRO',
        hasAPIAccess: planData.tier === 'PRO',
        isActive: true,
      },
    });
    planRecords.push({ id: plan.id, tier: planData.tier });
    console.log(`  ✅ ${planData.name} (feature-access plan, no fixed pricing)`);
  }
  console.log('');

  // 5. Create Demo Businesses — NO platformId, NO trial fields, BusinessStatus enum
  console.log('🏢 Creating 11 demo businesses...');
  const businessRecords: Array<{ id: string; businessType: string; slug: string }> = [];
  // BusinessStatus: ONBOARDING, ACTIVE, SUSPENDED, CHURNED — NO TRIAL
  const statuses: Array<'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED'> = [
    'ONBOARDING', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE',
    'ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED', 'ACTIVE', 'CHURNED',
  ];

  for (let i = 0; i < DEMO_BUSINESSES.length; i++) {
    const bizData = DEMO_BUSINESSES[i];
    const status = statuses[i] || 'ACTIVE';
    const business = await db.business.upsert({
      where: { slug: bizData.slug },
      update: {},
      create: {
        // NO platformId
        salesRepId: i % 2 === 0 ? salesMembers[0]?.id : salesMembers[1]?.id,
        name: bizData.name,
        slug: bizData.slug,
        businessType: bizData.businessType as any,
        status: status as any,
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
        isOnline: status === 'ACTIVE',
        settings: JSON.stringify({ enableDelivery: true, enablePickup: true, enablePOS: true, orderPrefix: 'ORD', invoicePrefix: 'INV' }),
        features: JSON.stringify({ multiStore: true, pos: true, delivery: true, subscriptions: true, loyaltyPoints: true, promoCodes: true }),
        // NO trialStartsAt / trialEndsAt — those fields don't exist
        activatedAt: status === 'ACTIVE' ? new Date() : null,
        onboardedAt: status === 'ACTIVE' ? new Date() : null,
      },
    });
    businessRecords.push({ id: business.id, businessType: bizData.businessType, slug: bizData.slug });
    console.log(`  ✅ ${bizData.name} (${status})`);
  }
  console.log('');

  // 6. Create Business Subscriptions — no fixed pricing, use demo amounts
  console.log('💳 Creating business subscriptions...');
  const now = new Date();
  const cycles: Array<'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY'> = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

  for (let i = 0; i < businessRecords.length; i++) {
    const biz = businessRecords[i];
    const bizStatus = statuses[i] || 'ACTIVE';
    if (bizStatus === 'ONBOARDING' || bizStatus === 'CHURNED') continue;

    const planTier = i < 5 ? 'STANDARD' : 'PRO';
    const billingCycle = cycles[i % 4];
    const plan = planRecords.find(p => p.tier === planTier);
    if (!plan) continue;

    const cycleDays = billingCycle === 'YEARLY' ? 365 : billingCycle === 'HALF_YEARLY' ? 182 : billingCycle === 'QUARTERLY' ? 90 : 30;
    const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);
    const subStatus: 'ACTIVE' | 'SUSPENDED' | 'PAST_DUE' = bizStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    // Demo amounts — these are just placeholders, not real pricing
    const subscriptionAmount = planTier === 'PRO' ? 4999 : 2999;
    const finalAmount = subscriptionAmount;

    await db.businessSubscription.upsert({
      where: { businessId: biz.id },
      update: {},
      create: {
        businessId: biz.id,
        planId: plan.id,
        status: subStatus as any,
        subscriptionAmount,
        finalAmount,
        billingCycle: billingCycle as any,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        nextPaymentAmount: finalAmount,
        lastPaymentDate: now,
        lastPaymentAmount: finalAmount,
        paymentVerified: true,
        paymentVerifiedAt: now,
        paymentVerifiedBy: superAdmin.id,
        autoRenew: true,
      },
    });
  }
  console.log('  ✅ Business subscriptions created\n');

  // 7. Create Domain Mappings — NO platformId, uses DomainStatus enum
  console.log('🌐 Creating domain mappings...');
  const domainStatuses: Array<'ACTIVE' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'PENDING_DNS' | 'ERROR'> = [
    'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE',
    'ACTIVE', 'DNS_PROPAGATING', 'SSL_PENDING', 'ACTIVE', 'PENDING_DNS', 'ERROR',
  ];

  for (let i = 0; i < businessRecords.length; i++) {
    const biz = businessRecords[i];
    const domainStatus = domainStatuses[i] || 'ACTIVE';
    await db.domainMapping.upsert({
      where: { businessId: biz.id },
      update: {},
      create: {
        // NO platformId
        businessId: biz.id,
        domain: `${biz.slug}.quantixtechnology.in`,
        subdomain: biz.slug,
        isPrimary: true,
        sslStatus: domainStatus === 'ACTIVE' ? 'active' : 'pending',
        status: domainStatus as any,
        configuredBy: superAdmin.name,
        configuredAt: new Date(),
        dnsProvider: 'cloudflare',
        dnsConfig: JSON.stringify({ recordType: 'CNAME', ttl: 300 }),
      },
    });
  }
  console.log('  ✅ Domain mappings created\n');

  // 8. Create Deployments — NO platformId, uses DeploymentType/DeploymentStatus enums
  console.log('🚀 Creating deployments...');
  const deploymentTypes: Array<'WEBSITE' | 'ADMIN_DASHBOARD'> = ['WEBSITE', 'ADMIN_DASHBOARD'];
  for (const biz of businessRecords) {
    for (const dtype of deploymentTypes) {
      await db.deployment.create({
        data: {
          // NO platformId
          businessId: biz.id,
          type: dtype as any,
          status: 'LIVE',
          environment: 'production',
          hostingProvider: 'replit',
          liveUrl: `https://${biz.slug}.quantixtechnology.in`,
          version: '2.0.0',
          deployedBy: superAdmin.name,
          deployedAt: new Date(),
          healthStatus: 'healthy',
        },
      });
    }
  }
  console.log('  ✅ Deployments created\n');

  // 9. Create Leads — use `stage` (not `status`), LeadStage enum, no platformId
  console.log('📊 Creating leads...');
  const leadData = [
    { businessName: 'SpiceHub Restaurant', contactName: 'Amit Patel', businessType: 'FOOD_DELIVERY', source: 'GOOGLE_ADS' as const, stage: 'LEAD' as const, estimatedValue: 59988 },
    { businessName: 'CleanPro Services', contactName: 'Neha Gupta', businessType: 'LAUNDRY', source: 'META_ADS' as const, stage: 'DEMO_SHARED' as const, estimatedValue: 59988 },
    { businessName: 'WashMaster', contactName: 'Vikram Singh', businessType: 'CAR_WASH', source: 'DIRECT_REFERRAL' as const, stage: 'NEGOTIATION' as const, estimatedValue: 119988 },
    { businessName: 'MediCare Plus', contactName: 'Dr. Sunita Rao', businessType: 'PHARMACY', source: 'WEBSITE_INQUIRY' as const, stage: 'PAYMENT_PENDING' as const, estimatedValue: 119988 },
    { businessName: 'GreenBasket', contactName: 'Rajesh Nair', businessType: 'GROCERY', source: 'WHATSAPP_INQUIRY' as const, stage: 'PAYMENT_RECEIVED' as const, estimatedValue: 59988 },
    { businessName: 'HomeCare Solutions', contactName: 'Meera Joshi', businessType: 'HOME_SERVICES', source: 'COLD_OUTREACH' as const, stage: 'ONBOARDING' as const, estimatedValue: 99988 },
    { businessName: 'QuickMeat', contactName: 'Arjun Reddy', businessType: 'MEAT_DELIVERY', source: 'PHONE_CALL' as const, stage: 'LOST' as const, estimatedValue: 59988 },
    { businessName: 'StyleBee Beauty', contactName: 'Pooja Malhotra', businessType: 'COSMETICS', source: 'META_ADS' as const, stage: 'DEMO_SHARED' as const, estimatedValue: 59988 },
  ];

  for (const ld of leadData) {
    await db.lead.create({
      data: {
        // NO platformId
        salesRepId: salesMembers[leadData.indexOf(ld) % 2]?.id,
        businessName: ld.businessName,
        contactName: ld.contactName,
        contactEmail: `${ld.contactName.toLowerCase().replace(' ', '.')}@example.com`,
        contactPhone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        businessType: ld.businessType as any,
        source: ld.source as any,
        stage: ld.stage as any, // stage NOT status
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
    const bizData = DEMO_BUSINESSES.find(b => b.slug === biz.slug);
    const mainStore = await db.store.upsert({
      where: { businessId_slug: { businessId: biz.id, slug: `${biz.slug}-main` } },
      update: {},
      create: {
        businessId: biz.id,
        name: `${bizData?.name || biz.slug} - Main`,
        slug: `${biz.slug}-main`,
        code: 'STR01',
        address: bizData?.address,
        city: bizData?.city,
        state: bizData?.state,
        pincode: bizData?.pincode,
        country: 'India',
        latitude: bizData?.latitude,
        longitude: bizData?.longitude,
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

  // 13. Create Categories & Products — Category has workflowType
  console.log('📦 Creating categories & products...');

  // Map business types to appropriate workflow types for categories
  const categoryConfigs: Record<string, Array<{ name: string; slug: string; workflowType: string }>> = {
    GROCERY: [
      { name: 'Rice & Grains', slug: 'rice-grains', workflowType: 'ECOMMERCE' },
      { name: 'Dairy & Eggs', slug: 'dairy-eggs', workflowType: 'ECOMMERCE' },
      { name: 'Pulses & Lentils', slug: 'pulses-lentils', workflowType: 'ECOMMERCE' },
    ],
    FOOD_DELIVERY: [
      { name: 'North Indian', slug: 'north-indian', workflowType: 'ECOMMERCE' },
      { name: 'South Indian', slug: 'south-indian', workflowType: 'ECOMMERCE' },
      { name: 'Biryani', slug: 'biryani', workflowType: 'ECOMMERCE' },
    ],
    LAUNDRY: [
      { name: 'Wash & Fold', slug: 'wash-fold', workflowType: 'PICKUP_DELIVERY' },
      { name: 'Dry Cleaning', slug: 'dry-cleaning', workflowType: 'PICKUP_DELIVERY' },
      { name: 'Subscription Plans', slug: 'subscription-plans', workflowType: 'SUBSCRIPTION' },
    ],
    CAR_WASH: [
      { name: 'Car Wash', slug: 'car-wash', workflowType: 'APPOINTMENT' },
      { name: 'Detailing', slug: 'detailing', workflowType: 'APPOINTMENT' },
      { name: 'Subscription Plans', slug: 'subscription-plans', workflowType: 'SUBSCRIPTION' },
      { name: 'Accessories', slug: 'accessories', workflowType: 'ECOMMERCE' },
    ],
    PHARMACY: [
      { name: 'Medicines', slug: 'medicines', workflowType: 'ECOMMERCE' },
      { name: 'Health & Wellness', slug: 'health-wellness', workflowType: 'ECOMMERCE' },
    ],
    HOME_SERVICES: [
      { name: 'Cleaning', slug: 'cleaning', workflowType: 'APPOINTMENT' },
      { name: 'Appliance Repair', slug: 'appliance-repair', workflowType: 'POST_SERVICE_BILLING' },
      { name: 'Subscription Plans', slug: 'subscription-plans', workflowType: 'SUBSCRIPTION' },
    ],
    ECOMMERCE: [
      { name: 'Electronics', slug: 'electronics', workflowType: 'ECOMMERCE' },
      { name: 'Fashion', slug: 'fashion', workflowType: 'ECOMMERCE' },
    ],
    COSMETICS: [
      { name: 'Skincare', slug: 'skincare', workflowType: 'ECOMMERCE' },
      { name: 'Makeup', slug: 'makeup', workflowType: 'ECOMMERCE' },
    ],
    MEAT_DELIVERY: [
      { name: 'Chicken', slug: 'chicken', workflowType: 'ECOMMERCE' },
      { name: 'Mutton', slug: 'mutton', workflowType: 'ECOMMERCE' },
    ],
    FURNITURE: [
      { name: 'Living Room', slug: 'living-room', workflowType: 'ECOMMERCE' },
      { name: 'Bedroom', slug: 'bedroom', workflowType: 'ECOMMERCE' },
    ],
    DIRECTORY: [
      { name: 'Restaurants', slug: 'restaurants', workflowType: 'ECOMMERCE' },
      { name: 'Services', slug: 'services', workflowType: 'ECOMMERCE' },
    ],
  };

  // Define product configs outside the loop for reuse
  const productConfigs: Record<string, Array<{
      name: string; slug: string; unit: string; isVeg: boolean | null;
      type: string; workflowType: string | null;
      variants: Array<{ name: string; price: number; mrp: number; costPrice?: number; stock?: number }>;
    }>> = {
      GROCERY: [
        { name: 'Organic Basmati Rice', slug: 'organic-basmati-rice', unit: 'kg', isVeg: true, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '1 kg', price: 180, mrp: 220, costPrice: 140, stock: 100 }, { name: '5 kg', price: 850, mrp: 1100, costPrice: 700, stock: 50 }] },
        { name: 'Fresh Amul Butter', slug: 'fresh-amul-butter', unit: 'pack', isVeg: true, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '100g', price: 52, mrp: 56, costPrice: 42, stock: 200 }] },
      ],
      FOOD_DELIVERY: [
        { name: 'Butter Chicken', slug: 'butter-chicken', unit: 'piece', isVeg: false, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'Regular', price: 280, mrp: 320, costPrice: 160, stock: 50 }] },
        { name: 'Paneer Tikka Masala', slug: 'paneer-tikka-masala', unit: 'piece', isVeg: true, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'Regular', price: 240, mrp: 280, costPrice: 130, stock: 50 }] },
      ],
      LAUNDRY: [
        { name: 'Wash & Fold', slug: 'wash-fold-service', unit: 'kg', isVeg: null, type: 'SERVICE', workflowType: 'PICKUP_DELIVERY',
          variants: [{ name: 'Per Kg', price: 49, mrp: 59, costPrice: 20, stock: 999 }] },
        { name: 'Dry Cleaning', slug: 'dry-cleaning-service', unit: 'piece', isVeg: null, type: 'SERVICE', workflowType: 'PICKUP_DELIVERY',
          variants: [{ name: 'Shirt/Saree', price: 99, mrp: 129, costPrice: 45, stock: 999 }] },
      ],
      CAR_WASH: [
        { name: 'Basic Car Wash', slug: 'basic-car-wash', unit: 'service', isVeg: null, type: 'SERVICE', workflowType: 'APPOINTMENT',
          variants: [{ name: 'Hatchback', price: 299, mrp: 399, costPrice: 100, stock: 999 }, { name: 'Sedan', price: 399, mrp: 499, costPrice: 140, stock: 999 }] },
        { name: 'Premium Detailing', slug: 'premium-detailing', unit: 'service', isVeg: null, type: 'SERVICE', workflowType: 'APPOINTMENT',
          variants: [{ name: 'Hatchback', price: 1499, mrp: 1999, costPrice: 600, stock: 999 }] },
      ],
      PHARMACY: [
        { name: 'Dolo 650mg', slug: 'dolo-650mg', unit: 'strip', isVeg: true, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '15 Tablets', price: 32, mrp: 35, costPrice: 24, stock: 500 }] },
        { name: 'Crocin Advance', slug: 'crocin-advance', unit: 'strip', isVeg: true, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '20 Tablets', price: 28, mrp: 30, costPrice: 21, stock: 500 }] },
      ],
      HOME_SERVICES: [
        { name: 'Deep Home Cleaning', slug: 'deep-home-cleaning', unit: 'service', isVeg: null, type: 'SERVICE', workflowType: 'APPOINTMENT',
          variants: [{ name: '1 BHK', price: 1499, mrp: 1999, costPrice: 800, stock: 999 }, { name: '2 BHK', price: 1999, mrp: 2599, costPrice: 1100, stock: 999 }] },
        { name: 'AC Service', slug: 'ac-service', unit: 'service', isVeg: null, type: 'SERVICE', workflowType: 'POST_SERVICE_BILLING',
          variants: [{ name: 'Regular Service', price: 499, mrp: 699, costPrice: 250, stock: 999 }] },
      ],
      ECOMMERCE: [
        { name: 'Wireless Earbuds', slug: 'wireless-earbuds', unit: 'piece', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'Standard', price: 1299, mrp: 1999, costPrice: 700, stock: 100 }] },
        { name: 'Cotton T-Shirt', slug: 'cotton-tshirt', unit: 'piece', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'M', price: 499, mrp: 799, costPrice: 250, stock: 150 }, { name: 'L', price: 499, mrp: 799, costPrice: 250, stock: 150 }] },
      ],
      COSMETICS: [
        { name: 'Vitamin C Serum', slug: 'vitamin-c-serum', unit: 'bottle', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '30ml', price: 599, mrp: 799, costPrice: 280, stock: 80 }] },
        { name: 'Matte Lipstick', slug: 'matte-lipstick', unit: 'piece', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'Red', price: 349, mrp: 449, costPrice: 160, stock: 120 }] },
      ],
      MEAT_DELIVERY: [
        { name: 'Chicken Breast', slug: 'chicken-breast', unit: 'kg', isVeg: false, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '500g', price: 180, mrp: 200, costPrice: 140, stock: 60 }, { name: '1 Kg', price: 340, mrp: 380, costPrice: 260, stock: 40 }] },
        { name: 'Mutton Curry Cut', slug: 'mutton-curry-cut', unit: 'kg', isVeg: false, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '500g', price: 450, mrp: 500, costPrice: 340, stock: 30 }] },
      ],
      FURNITURE: [
        { name: 'Sheesham Wood Sofa', slug: 'sheesham-wood-sofa', unit: 'piece', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: '3-Seater', price: 24999, mrp: 34999, costPrice: 15000, stock: 5 }] },
        { name: 'King Size Bed', slug: 'king-size-bed', unit: 'piece', isVeg: null, type: 'PHYSICAL', workflowType: null,
          variants: [{ name: 'With Storage', price: 29999, mrp: 39999, costPrice: 18000, stock: 3 }] },
      ],
      DIRECTORY: [
        { name: 'Premium Listing', slug: 'premium-listing', unit: 'month', isVeg: null, type: 'SUBSCRIPTION', workflowType: 'SUBSCRIPTION',
          variants: [{ name: 'Monthly', price: 299, mrp: 499, costPrice: 50, stock: 999 }] },
      ],
    };

  for (const biz of businessRecords) {
    const cats = categoryConfigs[biz.businessType] || [];
    const categoryRecords: Array<{ id: string }> = [];
    for (const catData of cats) {
      const cat = await db.category.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: catData.slug } },
        update: {},
        create: {
          businessId: biz.id,
          name: catData.name,
          slug: catData.slug,
          workflowType: catData.workflowType as any,
          isActive: true,
        },
      });
      categoryRecords.push({ id: cat.id });
    }

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
          type: prodData.type as any, // ProductType enum
          status: 'ACTIVE', // ProductStatus enum
          unit: prodData.unit,
          isVeg: prodData.isVeg,
          isFeatured: true,
          minOrderQty: 1,
          maxOrderQty: 100,
          images: JSON.stringify([]),
          tags: JSON.stringify([]),
          workflowType: prodData.workflowType as any, // WorkflowType? — null inherits from category
          metadata: JSON.stringify({}),
        },
      });

      for (const vd of prodData.variants) {
        // ProductVariant has no @@unique constraint, use create
        await db.productVariant.create({
          data: {
            productId: product.id,
            name: vd.name,
            price: vd.price,
            mrp: vd.mrp,
            costPrice: vd.costPrice || null,
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

  // 14. Create Tax Configs (GST) — use `rate` not `gstRate`, no `hsnCode`
  console.log('💰 Creating tax configurations...');
  const gstConfigs = [
    { name: 'GST 0% (Exempt)', taxType: 'GST_0', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, isDefault: true },
    { name: 'GST 5%', taxType: 'GST_5', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
    { name: 'GST 12%', taxType: 'GST_12', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12 },
    { name: 'GST 18%', taxType: 'GST_18', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18 },
    { name: 'GST 28%', taxType: 'GST_28', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28 },
  ];

  for (const biz of businessRecords) {
    for (const taxData of gstConfigs) {
      await db.taxConfig.create({
        data: {
          businessId: biz.id,
          name: taxData.name,
          taxType: taxData.taxType,
          rate: taxData.rate, // `rate` not `gstRate`
          cgstRate: taxData.cgstRate,
          sgstRate: taxData.sgstRate,
          igstRate: taxData.igstRate,
          isActive: true,
          isDefault: taxData.isDefault || false,
          // NO hsnCode — field doesn't exist
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

    await db.deliveryZone.create({
      data: {
        businessId: biz.id, storeId: store?.id,
        name: 'Zone 1 - Near (3km)', zoneType: 'CIRCLE',
        centerLat: bd?.latitude || 0, centerLng: bd?.longitude || 0, radius: 3,
        deliveryFee: 20, minOrderAmount: 100, freeDeliveryAbove: 300, estimatedTime: 25, isActive: true,
      },
    });
    await db.deliveryZone.create({
      data: {
        businessId: biz.id, storeId: store?.id,
        name: 'Zone 2 - Standard (5km)', zoneType: 'CIRCLE',
        centerLat: bd?.latitude || 0, centerLng: bd?.longitude || 0, radius: 5,
        deliveryFee: 35, minOrderAmount: 150, freeDeliveryAbove: 500, estimatedTime: 40, isActive: true,
      },
    });

    if (biz.businessType !== 'DIRECTORY') {
      await db.deliveryPartner.upsert({
        where: { businessId_phone: { businessId: biz.id, phone: '9901234567' } },
        update: {},
        create: { businessId: biz.id, name: 'Raju Kumar', phone: '9901234567', vehicleType: 'bike', vehicleNumber: 'MH01AB1234', isOnline: false, isActive: true },
      });
      await db.deliveryPartner.upsert({
        where: { businessId_phone: { businessId: biz.id, phone: '9902345678' } },
        update: {},
        create: { businessId: biz.id, name: 'Suresh Yadav', phone: '9902345678', vehicleType: 'bike', vehicleNumber: 'MH02CD5678', isOnline: true, isActive: true },
      });
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

  // 17. Create Subscription Plans (Customer-facing: Car Wash, Laundry, etc.)
  console.log('📋 Creating subscription plans...');
  const subscriptionConfigs: Record<string, Array<{
    name: string; slug: string; serviceType: string; billingCycle: string;
    price: number; originalPrice: number; totalCredits: number; creditLabel: string; features: string[];
  }>> = {
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
          serviceType: pd.serviceType as any,
          billingCycle: pd.billingCycle as any,
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

  // 18. Create Sample Orders (first 6 businesses)
  console.log('📦 Creating sample orders...');
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let orderCounter = 1;

  for (const biz of businessRecords.slice(0, 6)) {
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
      const orderType = biz.businessType === 'LAUNDRY' ? 'PICKUP_AND_DELIVERY' : 'DELIVERY';
      const totalAmount = variant.price;
      const taxRate = 5;
      const taxAmount = Math.round(totalAmount * taxRate / 100 * 100) / 100;

      const order = await db.order.create({
        data: {
          businessId: biz.id,
          storeId: store.id,
          orderNumber: orderNum,
          orderType: orderType as any,
          status: 'DELIVERED',
          paymentStatus: 'COMPLETED',
          paymentMethod: 'UPI',
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          deliveryAddress: JSON.stringify({ city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }),
          subtotal: totalAmount,
          totalTax: taxAmount,
          cgstAmount: Math.round(taxAmount / 2 * 100) / 100,
          sgstAmount: Math.round(taxAmount / 2 * 100) / 100,
          totalAmount: totalAmount + taxAmount,
          deliveryFee: 30,
          confirmedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          deliveredAt: new Date(now.getTime() - 30 * 60 * 1000),
        },
      });

      // Create order item
      await db.orderItem.create({
        data: {
          orderId: order.id,
          itemType: 'product',
          itemId: product.id,
          itemName: product.name,
          variantName: variant.name,
          quantity: 1,
          unitPrice: variant.price,
          mrp: variant.mrp,
          discountPrice: variant.price < variant.mrp ? variant.price : null,
          discountPercent: variant.price < variant.mrp ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100) : null,
          totalPrice: variant.price,
          totalMrp: variant.mrp,
          gstRate: taxRate,
          gstAmount: taxAmount,
          cgstAmount: Math.round(taxAmount / 2 * 100) / 100,
          sgstAmount: Math.round(taxAmount / 2 * 100) / 100,
          isVeg: product.isVeg,
          unit: product.unit,
        },
      });

      // Create payment
      await db.payment.create({
        data: {
          orderId: order.id,
          businessId: biz.id,
          amount: totalAmount + taxAmount,
          method: 'UPI',
          status: 'COMPLETED',
          gatewayName: 'razorpay',
          paidAt: new Date(now.getTime() - 30 * 60 * 1000),
        },
      });

      // Create order status history
      await db.orderStatusHistory.createMany({
        data: [
          { orderId: order.id, status: 'PENDING', note: 'Order placed', createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
          { orderId: order.id, status: 'CONFIRMED', note: 'Order confirmed', createdAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000) },
          { orderId: order.id, status: 'OUT_FOR_DELIVERY', note: 'Out for delivery', createdAt: new Date(now.getTime() - 45 * 60 * 1000) },
          { orderId: order.id, status: 'DELIVERED', note: 'Delivered successfully', createdAt: new Date(now.getTime() - 30 * 60 * 1000) },
        ],
      });

      console.log(`  ✅ Order ${orderNum}`);
    }
  }
  console.log('');

  // 19. Create Payment Gateways for each business
  console.log('💳 Creating payment gateways...');
  for (const biz of businessRecords) {
    await db.paymentGateway.upsert({
      where: { businessId_name: { businessId: biz.id, name: 'Razorpay' } },
      update: {},
      create: {
        businessId: biz.id,
        name: 'Razorpay',
        gateway: 'razorpay',
        isActive: true,
        isTestMode: true,
        config: JSON.stringify({ key: 'test_key', enabled_methods: ['upi', 'card', 'netbanking', 'wallet'] }),
      },
    });
  }
  console.log('  ✅ Payment gateways created\n');

  // 20. Create Business Modules
  console.log('🔌 Creating business modules...');
  const moduleMap: Record<string, Array<{ key: string; name: string }>> = {
    GROCERY: [{ key: 'grocery', name: 'Grocery Store' }],
    FOOD_DELIVERY: [{ key: 'restaurant', name: 'Restaurant & Food Delivery' }],
    LAUNDRY: [{ key: 'laundry', name: 'Laundry & Dry Cleaning' }],
    CAR_WASH: [{ key: 'car_wash', name: 'Car Wash & Detailing' }],
    PHARMACY: [{ key: 'pharmacy', name: 'Pharmacy' }],
    HOME_SERVICES: [{ key: 'home_services', name: 'Home Services' }],
    ECOMMERCE: [{ key: 'ecommerce', name: 'E-Commerce' }],
    COSMETICS: [{ key: 'cosmetics', name: 'Cosmetics & Beauty' }],
    MEAT_DELIVERY: [{ key: 'meat_delivery', name: 'Meat Delivery' }],
    FURNITURE: [{ key: 'furniture', name: 'Furniture' }],
    DIRECTORY: [{ key: 'directory', name: 'Business Directory' }],
  };

  for (const biz of businessRecords) {
    const modules = moduleMap[biz.businessType] || [];
    for (const mod of modules) {
      await db.businessModule.upsert({
        where: { businessId_moduleKey: { businessId: biz.id, moduleKey: mod.key } },
        update: {},
        create: {
          businessId: biz.id,
          moduleKey: mod.key,
          moduleName: mod.name,
          status: 'ENABLED',
          enabledAt: new Date(),
        },
      });
    }
  }
  console.log('  ✅ Business modules created\n');

  // 21. Create Onboarding Steps
  console.log('📋 Creating onboarding steps...');
  const onboardingSteps = [
    { stepKey: 'branding', stepName: 'Branding & Logo', sortOrder: 0 },
    { stepKey: 'stores', stepName: 'Store Setup', sortOrder: 1 },
    { stepKey: 'products', stepName: 'Product Catalog', sortOrder: 2 },
    { stepKey: 'payment_gateway', stepName: 'Payment Gateway', sortOrder: 3 },
    { stepKey: 'delivery_zones', stepName: 'Delivery Zones', sortOrder: 4 },
    { stepKey: 'domain', stepName: 'Domain & Deployment', sortOrder: 5 },
  ];

  for (const biz of businessRecords) {
    const bizStatus = statuses[businessRecords.indexOf(biz)] || 'ACTIVE';
    for (const step of onboardingSteps) {
      const isCompleted = bizStatus === 'ACTIVE';
      await db.onboardingStep.upsert({
        where: { businessId_stepKey: { businessId: biz.id, stepKey: step.stepKey } },
        update: {},
        create: {
          businessId: biz.id,
          stepKey: step.stepKey,
          stepName: step.stepName,
          status: isCompleted ? 'COMPLETED' as any : 'PENDING' as any,
          completedBy: isCompleted ? superAdmin.name : null,
          completedAt: isCompleted ? new Date() : null,
          sortOrder: step.sortOrder,
        },
      });
    }
  }
  console.log('  ✅ Onboarding steps created\n');

  console.log('🎉 Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`  - Platform configs: ${platformConfigs.length}`);
  console.log(`  - Platform plans: ${planConfigs.length}`);
  console.log(`  - Sales team members: ${salesMembers.length}`);
  console.log(`  - Businesses: ${businessRecords.length}`);
  console.log(`  - Business subscriptions: ${businessRecords.length - 2}`); // minus ONBOARDING and CHURNED
  console.log(`  - Domain mappings: ${businessRecords.length}`);
  console.log(`  - Deployments: ${businessRecords.length * 2}`);
  console.log(`  - Leads: ${leadData.length}`);
  console.log(`  - Stores: ${storeRecords.length}`);
  console.log(`  - Categories: ~${Object.values(categoryConfigs).reduce((a, b) => a + b.length, 0)}`);
  console.log(`  - Products: ~${Object.values(productConfigs).reduce((a, b) => a + b.length, 0)}`);
  console.log(`  - Tax configs: ${gstConfigs.length} per business`);
  console.log(`  - Customers: ${sampleCustomers.length} per business`);
  console.log(`  - Orders: created for first 6 businesses`);
  console.log(`  - Payment gateways: 1 per business`);
  console.log(`  - Business modules: 1 per business`);
  console.log(`  - Onboarding steps: ${onboardingSteps.length} per business`);
}
