import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================================
// Comprehensive Grocery Seed Endpoint — FreshMart Grocery
// ============================================================================

interface ProductSeed {
  name: string;
  slug: string;
  description: string;
  unit: string;
  unitQuantity: number;
  isVeg: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string;
  variant: {
    name: string;
    price: number;
    mrp: number;
    costPrice: number;
    discountPrice?: number;
    stock: number;
    gstRate: number;
  };
}

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  products: ProductSeed[];
}

export async function POST() {
  try {
    // =========================================================================
    // 1. PLATFORM
    // =========================================================================
    const platform = await db.platform.upsert({
      where: { id: 'platform_1' },
      update: {},
      create: {
        id: 'platform_1',
        companyName: 'Quantix Technology',
        tagline: 'Run Your Business Smarter',
        website: 'www.quantixtechnology.in',
        supportEmail: 'support@quantixtechnology.in',
        supportPhone: '+91 22 4000 5000',
        defaultCurrency: 'INR',
        defaultLocale: 'en-IN',
        defaultTimezone: 'Asia/Kolkata',
        hostingProvider: 'replit',
        version: '2.0.0',
      },
    });

    // =========================================================================
    // 2. PLATFORM PLANS
    // =========================================================================
    const planData = [
      {
        id: 'plan_starter',
        name: 'Starter',
        tier: 'STARTER' as const,
        monthlyPrice: 4999,
        yearlyPrice: 49999,
        description: 'Perfect for small businesses getting started',
        maxStores: 1,
        maxProducts: 500,
        maxOrders: 1000,
        maxDeliveryPartners: 5,
        maxStaff: 10,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: false,
        hasCustomDomain: false,
        hasWhiteLabel: false,
        hasAdvancedReports: false,
        hasAPIAccess: false,
        sortOrder: 0,
      },
      {
        id: 'plan_professional',
        name: 'Professional',
        tier: 'PROFESSIONAL' as const,
        monthlyPrice: 9999,
        yearlyPrice: 99999,
        description: 'For growing businesses that need more power',
        maxStores: 3,
        maxProducts: 2000,
        maxOrders: 5000,
        maxDeliveryPartners: 15,
        maxStaff: 25,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: true,
        hasCustomDomain: true,
        hasWhiteLabel: false,
        hasAdvancedReports: true,
        hasAPIAccess: false,
        sortOrder: 1,
      },
      {
        id: 'plan_enterprise',
        name: 'Enterprise',
        tier: 'ENTERPRISE' as const,
        monthlyPrice: 24999,
        yearlyPrice: 249999,
        description: 'Unlimited power for enterprise operations',
        maxStores: 999,
        maxProducts: 99999,
        maxOrders: 99999,
        maxDeliveryPartners: 999,
        maxStaff: 999,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: true,
        hasCustomDomain: true,
        hasWhiteLabel: true,
        hasAdvancedReports: true,
        hasAPIAccess: true,
        sortOrder: 2,
      },
    ];

    for (const p of planData) {
      await db.platformPlan.upsert({
        where: { id: p.id },
        update: {},
        create: { platformId: platform.id, ...p },
      });
    }

    // =========================================================================
    // 3. SUPER ADMIN USER
    // =========================================================================
    const admin = await db.user.upsert({
      where: { email: 'superadmin@quantixtechnology.in' },
      update: {},
      create: {
        email: 'superadmin@quantixtechnology.in',
        name: 'Quantix Super Admin',
        phone: '+91 98765 00000',
        passwordHash: '$2a$12$placeholder_hash_for_dev',
        authProvider: 'PASSWORD',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });

    // =========================================================================
    // 4. GROCERY BUSINESS — FreshMart
    // =========================================================================
    const business = await db.business.upsert({
      where: { slug: 'freshmart' },
      update: {
        name: 'FreshMart Grocery',
        businessType: 'GROCERY',
        status: 'ACTIVE',
        primaryColor: '#10B981',
        secondaryColor: '#059669',
        tagline: 'Fresh to your doorstep',
        description: 'Mumbai\'s trusted online grocery store delivering fresh fruits, vegetables, dairy, and daily essentials right to your doorstep. Quality products, best prices, same-day delivery.',
        gstNumber: '27AABCF1234A1Z5',
        panNumber: 'AABCF1234A',
        fssaiLicense: '12345678901234',
        address: '42 Linking Road, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        latitude: 19.0596,
        longitude: 72.8295,
        contactEmail: 'info@freshmart.in',
        contactPhone: '+91 22 4000 1234',
        supportEmail: 'support@freshmart.in',
        supportPhone: '+91 22 4000 5678',
        isOnline: true,
      },
      create: {
        platformId: platform.id,
        name: 'FreshMart Grocery',
        slug: 'freshmart',
        businessType: 'GROCERY',
        status: 'ACTIVE',
        primaryColor: '#10B981',
        secondaryColor: '#059669',
        tagline: 'Fresh to your doorstep',
        description: 'Mumbai\'s trusted online grocery store delivering fresh fruits, vegetables, dairy, and daily essentials right to your doorstep. Quality products, best prices, same-day delivery.',
        gstNumber: '27AABCF1234A1Z5',
        panNumber: 'AABCF1234A',
        fssaiLicense: '12345678901234',
        address: '42 Linking Road, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        country: 'India',
        latitude: 19.0596,
        longitude: 72.8295,
        contactEmail: 'info@freshmart.in',
        contactPhone: '+91 22 4000 1234',
        supportEmail: 'support@freshmart.in',
        supportPhone: '+91 22 4000 5678',
        isOnline: true,
        activatedAt: new Date('2024-06-01'),
      },
    });

    // =========================================================================
    // 5. BUSINESS SUBSCRIPTION — Starter plan
    // =========================================================================
    await db.businessSubscription.upsert({
      where: { businessId: business.id },
      update: {},
      create: {
        businessId: business.id,
        planId: 'plan_starter',
        status: 'ACTIVE',
        planPrice: 4999,
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        nextBillingDate: new Date(Date.now() + 30 * 86400000),
        lastPaymentDate: new Date(),
        lastPaymentAmount: 4999,
        nextPaymentAmount: 4999,
        paymentMethod: 'razorpay',
        autoRenew: true,
      },
    });

    // =========================================================================
    // 6. DOMAIN MAPPING — freshmart.in
    // =========================================================================
    await db.domainMapping.upsert({
      where: { businessId: business.id },
      update: {},
      create: {
        platformId: platform.id,
        businessId: business.id,
        domain: 'freshmart.in',
        subdomain: 'freshmart',
        isPrimary: true,
        sslStatus: 'active',
        sslExpiryDate: new Date(Date.now() + 365 * 86400000),
        dnsProvider: 'cloudflare',
        dnsConfig: JSON.stringify({ aRecord: '34.56.78.90', cname: 'freshmart.in' }),
        status: 'ACTIVE',
        configuredBy: admin.id,
        configuredAt: new Date('2024-06-01'),
        deployedAt: new Date('2024-06-01'),
      },
    });

    // =========================================================================
    // 7. MAIN STORE
    // =========================================================================
    const store = await db.store.upsert({
      where: { businessId_slug: { businessId: business.id, slug: 'freshmart-main' } },
      update: {
        name: 'FreshMart - Bandra West',
        code: 'FM-BW-01',
        address: '42 Linking Road, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        latitude: 19.0596,
        longitude: 72.8295,
        phone: '+91 22 4000 1234',
        email: 'store@freshmart.in',
        status: 'ACTIVE',
        isMainStore: true,
        deliveryRadius: 10,
        minOrderAmount: 200,
        deliveryFee: 30,
        freeDeliveryAbove: 500,
        preparationTime: 20,
        printerType: 'thermal_bluetooth',
        paperSize: '80mm',
        posEnabled: true,
      },
      create: {
        businessId: business.id,
        name: 'FreshMart - Bandra West',
        slug: 'freshmart-main',
        code: 'FM-BW-01',
        address: '42 Linking Road, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        country: 'India',
        latitude: 19.0596,
        longitude: 72.8295,
        phone: '+91 22 4000 1234',
        email: 'store@freshmart.in',
        status: 'ACTIVE',
        isMainStore: true,
        deliveryRadius: 10,
        minOrderAmount: 200,
        deliveryFee: 30,
        freeDeliveryAbove: 500,
        preparationTime: 20,
        operatingHours: JSON.stringify({
          mon: { open: '08:00', close: '22:00' },
          tue: { open: '08:00', close: '22:00' },
          wed: { open: '08:00', close: '22:00' },
          thu: { open: '08:00', close: '22:00' },
          fri: { open: '08:00', close: '22:00' },
          sat: { open: '08:00', close: '22:00' },
          sun: { open: '09:00', close: '21:00' },
        }),
        gstNumber: '27AABCF1234A1Z5',
        printerConfig: JSON.stringify({
          autoPrint: true,
          copies: 2,
          footerText: 'Thank you for shopping at FreshMart!',
          headerText: 'FreshMart Grocery',
        }),
        printerType: 'thermal_bluetooth',
        paperSize: '80mm',
        posEnabled: true,
      },
    });

    // =========================================================================
    // 8. STORE TIMINGS (Mon-Sat 8AM-10PM, Sun 9AM-9PM)
    // =========================================================================
    const timings = [
      { day: 0, openTime: '09:00', closeTime: '21:00', isClosed: false }, // Sunday
      { day: 1, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Monday
      { day: 2, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Tuesday
      { day: 3, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Wednesday
      { day: 4, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Thursday
      { day: 5, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Friday
      { day: 6, openTime: '08:00', closeTime: '22:00', isClosed: false }, // Saturday
    ];

    for (const t of timings) {
      await db.storeTiming.upsert({
        where: { storeId_day: { storeId: store.id, day: t.day } },
        update: {},
        create: { storeId: store.id, ...t },
      });
    }

    // =========================================================================
    // 9 & 10. CATEGORIES + PRODUCTS
    // =========================================================================
    const categoriesData: CategorySeed[] = [
      // ── Fruits & Vegetables ──────────────────────────────────────────────
      {
        name: 'Fruits & Vegetables',
        slug: 'fruits-vegetables',
        description: 'Fresh fruits and vegetables sourced daily from local markets',
        icon: '🥬',
        sortOrder: 0,
        products: [
          { name: 'Banana', slug: 'banana', description: 'Fresh yellow bananas, rich in potassium and energy', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["fresh","fruit","banana"]', variant: { name: '1 kg', price: 40, mrp: 50, costPrice: 30, discountPrice: 40, stock: 150, gstRate: 0 } },
          { name: 'Apple (Shimla)', slug: 'apple-shimla', description: 'Crispy Shimla apples, sweet and juicy', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["fresh","fruit","apple"]', variant: { name: '1 kg', price: 180, mrp: 220, costPrice: 150, discountPrice: 180, stock: 80, gstRate: 0 } },
          { name: 'Onion', slug: 'onion', description: 'Fresh red onions, essential for Indian cooking', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["fresh","vegetable","onion"]', variant: { name: '1 kg', price: 30, mrp: 40, costPrice: 22, discountPrice: 30, stock: 200, gstRate: 0 } },
          { name: 'Tomato', slug: 'tomato', description: 'Ripe red tomatoes, perfect for curries and salads', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["fresh","vegetable","tomato"]', variant: { name: '1 kg', price: 25, mrp: 35, costPrice: 18, discountPrice: 25, stock: 180, gstRate: 0 } },
          { name: 'Potato', slug: 'potato', description: 'Fresh potatoes, versatile kitchen staple', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["fresh","vegetable","potato"]', variant: { name: '1 kg', price: 20, mrp: 30, costPrice: 14, discountPrice: 20, stock: 250, gstRate: 0 } },
          { name: 'Green Chillies', slug: 'green-chillies', description: 'Spicy green chillies for authentic Indian flavor', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["fresh","vegetable","chilli"]', variant: { name: '1 kg', price: 60, mrp: 80, costPrice: 40, discountPrice: 60, stock: 50, gstRate: 0 } },
          { name: 'Capsicum (Green)', slug: 'capsicum-green', description: 'Fresh green capsicum, crunchy and mild', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["fresh","vegetable","capsicum"]', variant: { name: '1 kg', price: 80, mrp: 100, costPrice: 55, discountPrice: 80, stock: 40, gstRate: 0 } },
        ],
      },
      // ── Dairy & Breakfast ────────────────────────────────────────────────
      {
        name: 'Dairy & Breakfast',
        slug: 'dairy-breakfast',
        description: 'Fresh milk, butter, cheese, bread and breakfast essentials',
        icon: '🥛',
        sortOrder: 1,
        products: [
          { name: 'Amul Taaza Milk', slug: 'amul-taaza-milk-1l', description: 'Amul Taaza toned milk, 1 litre pack', unit: 'L', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["dairy","milk","amul"]', variant: { name: '1 L', price: 68, mrp: 68, costPrice: 62, stock: 120, gstRate: 0 } },
          { name: 'Amul Butter', slug: 'amul-butter-500g', description: 'Amul pasteurized butter, 500g', unit: 'g', unitQuantity: 500, isVeg: true, isFeatured: true, isPopular: true, tags: '["dairy","butter","amul"]', variant: { name: '500 g', price: 280, mrp: 280, costPrice: 255, stock: 60, gstRate: 12 } },
          { name: 'Amul Curd (Dahi)', slug: 'amul-curd-400g', description: 'Fresh Amul curd, 400g cup', unit: 'g', unitQuantity: 400, isVeg: true, isFeatured: false, isPopular: true, tags: '["dairy","curd","yogurt"]', variant: { name: '400 g', price: 45, mrp: 45, costPrice: 38, stock: 80, gstRate: 0 } },
          { name: 'Amul Paneer', slug: 'amul-paneer-200g', description: 'Amul fresh paneer block, 200g', unit: 'g', unitQuantity: 200, isVeg: true, isFeatured: true, isPopular: true, tags: '["dairy","paneer","cottage-cheese"]', variant: { name: '200 g', price: 90, mrp: 90, costPrice: 75, stock: 45, gstRate: 12 } },
          { name: 'Britannia Bread', slug: 'britannia-bread', description: 'Britannia white bread, 400g', unit: 'g', unitQuantity: 400, isVeg: true, isFeatured: false, isPopular: true, tags: '["bakery","bread","breakfast"]', variant: { name: '400 g', price: 40, mrp: 40, costPrice: 33, stock: 90, gstRate: 0 } },
        ],
      },
      // ── Rice & Grains ────────────────────────────────────────────────────
      {
        name: 'Rice & Grains',
        slug: 'rice-grains',
        description: 'Premium basmati rice, poha, and grain varieties',
        icon: '🍚',
        sortOrder: 2,
        products: [
          { name: 'India Gate Basmati Rice', slug: 'india-gate-basmati-5kg', description: 'India Gate classic basmati rice, 5kg', unit: 'kg', unitQuantity: 5, isVeg: true, isFeatured: true, isPopular: true, tags: '["rice","basmati","grain"]', variant: { name: '5 kg', price: 450, mrp: 550, costPrice: 390, discountPrice: 450, stock: 60, gstRate: 0 } },
          { name: 'Sona Masoori Rice', slug: 'sona-masoori-rice-5kg', description: 'Sona Masoori medium grain rice, 5kg', unit: 'kg', unitQuantity: 5, isVeg: true, isFeatured: false, isPopular: true, tags: '["rice","sona-masoori","grain"]', variant: { name: '5 kg', price: 320, mrp: 380, costPrice: 270, discountPrice: 320, stock: 75, gstRate: 0 } },
          { name: 'Poha (Flattened Rice)', slug: 'poha-1kg', description: 'Thin poha for making delicious breakfast', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["rice","poha","breakfast"]', variant: { name: '1 kg', price: 80, mrp: 95, costPrice: 60, discountPrice: 80, stock: 50, gstRate: 0 } },
          { name: 'Murmura (Puffed Rice)', slug: 'murmura-500g', description: 'Light and crispy puffed rice for snacks', unit: 'g', unitQuantity: 500, isVeg: true, isFeatured: false, isPopular: false, tags: '["rice","murmura","snack"]', variant: { name: '500 g', price: 35, mrp: 40, costPrice: 25, discountPrice: 35, stock: 60, gstRate: 0 } },
          { name: 'Rava (Semolina)', slug: 'rava-1kg', description: 'Fine rava for upma, dosa, and halwa', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["grain","rava","semolina"]', variant: { name: '1 kg', price: 55, mrp: 65, costPrice: 40, discountPrice: 55, stock: 70, gstRate: 0 } },
        ],
      },
      // ── Pulses & Lentils ─────────────────────────────────────────────────
      {
        name: 'Pulses & Lentils',
        slug: 'pulses-lentils',
        description: 'High-quality dal, pulses and lentils for daily nutrition',
        icon: '🫘',
        sortOrder: 3,
        products: [
          { name: 'Toor Dal', slug: 'toor-dal-1kg', description: 'Premium toor dal (arhar dal), 1kg', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["dal","pulses","toor"]', variant: { name: '1 kg', price: 160, mrp: 185, costPrice: 135, discountPrice: 160, stock: 100, gstRate: 0 } },
          { name: 'Moong Dal', slug: 'moong-dal-1kg', description: 'Yellow moong dal, easy to cook, 1kg', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["dal","pulses","moong"]', variant: { name: '1 kg', price: 175, mrp: 200, costPrice: 148, discountPrice: 175, stock: 80, gstRate: 0 } },
          { name: 'Chana Dal', slug: 'chana-dal-1kg', description: 'Split Bengal gram dal, 1kg', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["dal","pulses","chana"]', variant: { name: '1 kg', price: 120, mrp: 140, costPrice: 98, discountPrice: 120, stock: 70, gstRate: 0 } },
          { name: 'Urad Dal', slug: 'urad-dal-1kg', description: 'White urad dal for dal makhani and idli', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["dal","pulses","urad"]', variant: { name: '1 kg', price: 155, mrp: 180, costPrice: 128, discountPrice: 155, stock: 55, gstRate: 0 } },
          { name: 'Rajma (Kidney Beans)', slug: 'rajma-1kg', description: 'Premium red rajma for rajma chawal', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["dal","pulses","rajma","kidney-beans"]', variant: { name: '1 kg', price: 190, mrp: 220, costPrice: 155, discountPrice: 190, stock: 45, gstRate: 0 } },
        ],
      },
      // ── Spices & Masala ──────────────────────────────────────────────────
      {
        name: 'Spices & Masala',
        slug: 'spices-masala',
        description: 'Authentic Indian spices and masala blends',
        icon: '🌶️',
        sortOrder: 4,
        products: [
          { name: 'MDH Turmeric Powder', slug: 'mdh-turmeric-powder-100g', description: 'MDH haldi powder, 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: true, isPopular: true, tags: '["spice","turmeric","haldi","masala"]', variant: { name: '100 g', price: 35, mrp: 42, costPrice: 26, discountPrice: 35, stock: 120, gstRate: 5 } },
          { name: 'MDH Red Chilli Powder', slug: 'mdh-red-chilli-powder-100g', description: 'MDH lal mirch powder, 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: false, isPopular: true, tags: '["spice","chilli","lal-mirch","masala"]', variant: { name: '100 g', price: 40, mrp: 48, costPrice: 30, discountPrice: 40, stock: 100, gstRate: 5 } },
          { name: 'MDH Garam Masala', slug: 'mdh-garam-masala-100g', description: 'MDH garam masala blend, 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: true, isPopular: true, tags: '["spice","garam-masala","masala"]', variant: { name: '100 g', price: 55, mrp: 65, costPrice: 40, discountPrice: 55, stock: 80, gstRate: 5 } },
          { name: 'MDH Coriander Powder', slug: 'mdh-coriander-powder-100g', description: 'MDH dhania powder, 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: false, isPopular: false, tags: '["spice","coriander","dhania","masala"]', variant: { name: '100 g', price: 30, mrp: 38, costPrice: 22, discountPrice: 30, stock: 90, gstRate: 5 } },
          { name: 'MDH Cumin Seeds', slug: 'mdh-cumin-seeds-100g', description: 'MDH jeera (cumin seeds), 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: false, isPopular: false, tags: '["spice","cumin","jeera","masala"]', variant: { name: '100 g', price: 45, mrp: 55, costPrice: 34, discountPrice: 45, stock: 75, gstRate: 5 } },
          { name: 'Tata Salt', slug: 'tata-salt-1kg', description: 'Tata iodized salt, 1kg', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["salt","essential","tata"]', variant: { name: '1 kg', price: 24, mrp: 24, costPrice: 19, stock: 150, gstRate: 0 } },
        ],
      },
      // ── Oil & Ghee ───────────────────────────────────────────────────────
      {
        name: 'Oil & Ghee',
        slug: 'oil-ghee',
        description: 'Cooking oils, ghee and vanaspati for daily cooking',
        icon: '🫗',
        sortOrder: 5,
        products: [
          { name: 'Fortune Sunflower Oil', slug: 'fortune-sunflower-oil-1l', description: 'Fortune refined sunflower oil, 1 litre', unit: 'L', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["oil","sunflower","cooking"]', variant: { name: '1 L', price: 140, mrp: 165, costPrice: 120, discountPrice: 140, stock: 90, gstRate: 5 } },
          { name: 'Fortune Mustard Oil', slug: 'fortune-mustard-oil-1l', description: 'Fortune kachi ghani mustard oil, 1 litre', unit: 'L', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["oil","mustard","cooking"]', variant: { name: '1 L', price: 180, mrp: 200, costPrice: 155, discountPrice: 180, stock: 60, gstRate: 5 } },
          { name: 'Amul Ghee', slug: 'amul-ghee-500ml', description: 'Amul pure ghee, 500ml', unit: 'ml', unitQuantity: 500, isVeg: true, isFeatured: true, isPopular: true, tags: '["ghee","amul","cooking"]', variant: { name: '500 ml', price: 310, mrp: 310, costPrice: 275, stock: 50, gstRate: 0 } },
          { name: 'Saffola Gold Oil', slug: 'saffola-gold-oil-1l', description: 'Saffola Gold heart-healthy blended oil, 1L', unit: 'L', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["oil","saffola","healthy","cooking"]', variant: { name: '1 L', price: 195, mrp: 215, costPrice: 165, discountPrice: 195, stock: 40, gstRate: 5 } },
          { name: 'Dalda Vanaspati', slug: 'dalda-vanaspati-1kg', description: 'Dalda vanaspati ghee, 1kg', unit: 'kg', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["vanaspati","dalda","cooking"]', variant: { name: '1 kg', price: 135, mrp: 150, costPrice: 115, discountPrice: 135, stock: 45, gstRate: 5 } },
        ],
      },
      // ── Snacks & Biscuits ────────────────────────────────────────────────
      {
        name: 'Snacks & Biscuits',
        slug: 'snacks-biscuits',
        description: 'Popular snacks, biscuits, noodles and instant food',
        icon: '🍪',
        sortOrder: 6,
        products: [
          { name: 'Maggi 2-Minute Noodles', slug: 'maggi-noodles', description: 'Nestle Maggi 2-minute masala noodles', unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: true, isPopular: true, tags: '["noodles","instant","maggi"]', variant: { name: '1 pack (140g)', price: 14, mrp: 16, costPrice: 12, discountPrice: 14, stock: 300, gstRate: 18 } },
          { name: "Lay's Classic Salted", slug: 'lays-classic-salted', description: "Lay's classic salted potato chips", unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["chips","snack","lays"]', variant: { name: '52 g', price: 20, mrp: 20, costPrice: 16, stock: 200, gstRate: 18 } },
          { name: 'Parle-G Biscuit', slug: 'parle-g-biscuit', description: 'Parle-G glucose biscuits, the OG', unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["biscuit","snack","parle-g"]', variant: { name: '65 g', price: 10, mrp: 10, costPrice: 8, stock: 250, gstRate: 18 } },
          { name: 'Britannia Bourbon', slug: 'britannia-bourbon', description: 'Britannia bourbon cream biscuits', unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: true, tags: '["biscuit","snack","bourbon"]', variant: { name: '96 g', price: 30, mrp: 30, costPrice: 24, stock: 150, gstRate: 18 } },
          { name: 'Haldiram Aloo Bhujia', slug: 'haldiram-aloo-bhujia', description: 'Haldiram aloo bhujia namkeen', unit: 'g', unitQuantity: 200, isVeg: true, isFeatured: false, isPopular: true, tags: '["namkeen","snack","haldiram","bhujia"]', variant: { name: '200 g', price: 60, mrp: 70, costPrice: 46, discountPrice: 60, stock: 80, gstRate: 12 } },
          { name: 'Kurkure Masala Munch', slug: 'kurkure-masala-munch', description: 'Kurkure masala munch crispy snacks', unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["snack","kurkure","namkeen"]', variant: { name: '90 g', price: 20, mrp: 20, costPrice: 15, stock: 120, gstRate: 18 } },
        ],
      },
      // ── Beverages ────────────────────────────────────────────────────────
      {
        name: 'Beverages',
        slug: 'beverages',
        description: 'Tea, coffee, juices and refreshing drinks',
        icon: '☕',
        sortOrder: 7,
        products: [
          { name: 'Tata Tea Gold', slug: 'tata-tea-gold-250g', description: 'Tata Tea Gold premium leaf tea, 250g', unit: 'g', unitQuantity: 250, isVeg: true, isFeatured: true, isPopular: true, tags: '["tea","beverage","tata"]', variant: { name: '250 g', price: 140, mrp: 160, costPrice: 115, discountPrice: 140, stock: 70, gstRate: 5 } },
          { name: 'Nescafe Classic', slug: 'nescafe-classic-25g', description: 'Nescafe classic instant coffee, 25g', unit: 'g', unitQuantity: 25, isVeg: true, isFeatured: false, isPopular: true, tags: '["coffee","beverage","nescafe"]', variant: { name: '25 g', price: 55, mrp: 60, costPrice: 44, discountPrice: 55, stock: 90, gstRate: 18 } },
          { name: 'Paper Boat Aam Panna', slug: 'paper-boat-aam-panna', description: 'Paper Boat traditional aam panna drink', unit: 'pack', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["juice","beverage","paper-boat"]', variant: { name: '200 ml', price: 30, mrp: 30, costPrice: 23, stock: 100, gstRate: 12 } },
          { name: 'Coca-Cola', slug: 'coca-cola-750ml', description: 'Coca-Cola soft drink, 750ml bottle', unit: 'ml', unitQuantity: 750, isVeg: true, isFeatured: false, isPopular: true, tags: '["soft-drink","beverage","coca-cola"]', variant: { name: '750 ml', price: 40, mrp: 40, costPrice: 32, stock: 120, gstRate: 28 } },
          { name: 'Real Fruit Juice (Mixed)', slug: 'real-fruit-juice-mixed-1l', description: 'Real mixed fruit juice, 1 litre', unit: 'L', unitQuantity: 1, isVeg: true, isFeatured: false, isPopular: false, tags: '["juice","beverage","real"]', variant: { name: '1 L', price: 110, mrp: 120, costPrice: 88, discountPrice: 110, stock: 55, gstRate: 12 } },
        ],
      },
      // ── Personal Care ────────────────────────────────────────────────────
      {
        name: 'Personal Care',
        slug: 'personal-care',
        description: 'Soaps, shampoos, toothpaste and personal hygiene products',
        icon: '🧴',
        sortOrder: 8,
        products: [
          { name: 'Dettol Soap', slug: 'dettol-soap', description: 'Dettol original antibacterial bathing soap, 75g', unit: 'piece', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: true, tags: '["soap","personal-care","dettol"]', variant: { name: '75 g', price: 38, mrp: 42, costPrice: 30, discountPrice: 38, stock: 100, gstRate: 18 } },
          { name: 'Colgate Strong Teeth', slug: 'colgate-strong-teeth', description: 'Colgate strong teeth toothpaste, 100g', unit: 'g', unitQuantity: 100, isVeg: true, isFeatured: false, isPopular: true, tags: '["toothpaste","personal-care","colgate"]', variant: { name: '100 g', price: 55, mrp: 58, costPrice: 42, discountPrice: 55, stock: 90, gstRate: 18 } },
          { name: 'Clinic Plus Shampoo', slug: 'clinic-plus-shampoo', description: 'Clinic Plus healthy & strong shampoo, 175ml', unit: 'ml', unitQuantity: 175, isVeg: false, isFeatured: false, isPopular: false, tags: '["shampoo","personal-care","clinic-plus"]', variant: { name: '175 ml', price: 95, mrp: 105, costPrice: 72, discountPrice: 95, stock: 60, gstRate: 18 } },
          { name: 'Surf Excel Easy Wash', slug: 'surf-excel-easy-wash-1kg', description: 'Surf Excel easy wash detergent powder, 1kg', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: true, tags: '["detergent","personal-care","surf-excel"]', variant: { name: '1 kg', price: 135, mrp: 145, costPrice: 108, discountPrice: 135, stock: 70, gstRate: 18 } },
          { name: 'Nivea Body Lotion', slug: 'nivea-body-lotion-200ml', description: 'Nivea body lotion, moisturizing, 200ml', unit: 'ml', unitQuantity: 200, isVeg: false, isFeatured: false, isPopular: false, tags: '["lotion","personal-care","nivea"]', variant: { name: '200 ml', price: 185, mrp: 210, costPrice: 148, discountPrice: 185, stock: 40, gstRate: 18 } },
        ],
      },
      // ── Cleaning & Household ─────────────────────────────────────────────
      {
        name: 'Cleaning & Household',
        slug: 'cleaning-household',
        description: 'Cleaning supplies, kitchen essentials and household items',
        icon: '🧹',
        sortOrder: 9,
        products: [
          { name: 'Vim Dishwash Liquid', slug: 'vim-dishwash-liquid', description: 'Vim dishwash liquid gel, 500ml', unit: 'ml', unitQuantity: 500, isVeg: false, isFeatured: false, isPopular: true, tags: '["dishwash","cleaning","vim"]', variant: { name: '500 ml', price: 105, mrp: 115, costPrice: 82, discountPrice: 105, stock: 80, gstRate: 18 } },
          { name: 'Harpic Toilet Cleaner', slug: 'harpic-toilet-cleaner', description: 'Harpic disinfectant toilet cleaner, 500ml', unit: 'ml', unitQuantity: 500, isVeg: false, isFeatured: false, isPopular: false, tags: '["toilet-cleaner","cleaning","harpic"]', variant: { name: '500 ml', price: 95, mrp: 105, costPrice: 72, discountPrice: 95, stock: 60, gstRate: 18 } },
          { name: 'Lizol Floor Cleaner', slug: 'lizol-floor-cleaner', description: 'Lizol disinfectant floor cleaner, 500ml', unit: 'ml', unitQuantity: 500, isVeg: false, isFeatured: false, isPopular: false, tags: '["floor-cleaner","cleaning","lizol"]', variant: { name: '500 ml', price: 110, mrp: 125, costPrice: 86, discountPrice: 110, stock: 50, gstRate: 18 } },
          { name: 'Scotch Brite Scrub Pad', slug: 'scotch-brite-scrub-pad', description: 'Scotch Brite scrub pad for dish cleaning', unit: 'pack', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: false, tags: '["scrub","cleaning","kitchen"]', variant: { name: '3 pcs', price: 35, mrp: 40, costPrice: 26, discountPrice: 35, stock: 100, gstRate: 18 } },
          { name: 'Hit Cockroach Spray', slug: 'hit-cockroach-spray', description: 'Hit cockroach killer spray, 200ml', unit: 'ml', unitQuantity: 200, isVeg: false, isFeatured: false, isPopular: false, tags: '["pest-control","cleaning","hit"]', variant: { name: '200 ml', price: 130, mrp: 145, costPrice: 100, discountPrice: 130, stock: 45, gstRate: 18 } },
        ],
      },
      // ── Baby Care ────────────────────────────────────────────────────────
      {
        name: 'Baby Care',
        slug: 'baby-care',
        description: 'Baby food, diapers, and gentle baby care products',
        icon: '👶',
        sortOrder: 10,
        products: [
          { name: 'Cerelac Baby Cereal (Wheat)', slug: 'cerelac-wheat-200g', description: 'Nestle Cerelac stage 1 wheat baby cereal, 200g', unit: 'g', unitQuantity: 200, isVeg: true, isFeatured: false, isPopular: true, tags: '["baby-food","baby-care","cerelac"]', variant: { name: '200 g', price: 185, mrp: 195, costPrice: 152, discountPrice: 185, stock: 40, gstRate: 0 } },
          { name: 'Pampers Active Baby', slug: 'pampers-active-baby', description: 'Pampers active baby diapers, medium size', unit: 'pack', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: true, tags: '["diaper","baby-care","pampers"]', variant: { name: '32 pcs (M)', price: 699, mrp: 799, costPrice: 580, discountPrice: 699, stock: 30, gstRate: 0 } },
          { name: 'Johnson Baby Oil', slug: 'johnson-baby-oil', description: 'Johnson\'s baby oil for gentle moisturizing, 200ml', unit: 'ml', unitQuantity: 200, isVeg: false, isFeatured: false, isPopular: false, tags: '["baby-oil","baby-care","johnson"]', variant: { name: '200 ml', price: 145, mrp: 160, costPrice: 112, discountPrice: 145, stock: 35, gstRate: 18 } },
          { name: 'Himalaya Baby Lotion', slug: 'himalaya-baby-lotion', description: 'Himalaya gentle baby lotion, 200ml', unit: 'ml', unitQuantity: 200, isVeg: true, isFeatured: false, isPopular: false, tags: '["baby-lotion","baby-care","himalaya"]', variant: { name: '200 ml', price: 140, mrp: 155, costPrice: 108, discountPrice: 140, stock: 30, gstRate: 18 } },
        ],
      },
      // ── Meat & Seafood ───────────────────────────────────────────────────
      {
        name: 'Meat & Seafood',
        slug: 'meat-seafood',
        description: 'Fresh chicken, mutton, fish and seafood delivered daily',
        icon: '🍗',
        sortOrder: 11,
        products: [
          { name: 'Fresh Chicken Breast', slug: 'fresh-chicken-breast', description: 'Boneless chicken breast, fresh and tender', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: true, isPopular: true, tags: '["chicken","meat","non-veg"]', variant: { name: '1 kg', price: 280, mrp: 320, costPrice: 230, discountPrice: 280, stock: 25, gstRate: 0 } },
          { name: 'Fresh Chicken Curry Cut', slug: 'fresh-chicken-curry-cut', description: 'Chicken curry cut with bone, perfect for Indian curries', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: true, tags: '["chicken","meat","non-veg","curry"]', variant: { name: '1 kg', price: 220, mrp: 260, costPrice: 180, discountPrice: 220, stock: 30, gstRate: 0 } },
          { name: 'Mutton Curry Cut', slug: 'mutton-curry-cut', description: 'Fresh goat mutton curry cut, premium quality', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: false, tags: '["mutton","meat","non-veg"]', variant: { name: '1 kg', price: 750, mrp: 850, costPrice: 620, discountPrice: 750, stock: 15, gstRate: 0 } },
          { name: 'Fresh Pomfret Fish', slug: 'fresh-pomfret-fish', description: 'Whole fresh pomfret fish, cleaned', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: false, tags: '["fish","seafood","non-veg","pomfret"]', variant: { name: '1 kg', price: 600, mrp: 700, costPrice: 480, discountPrice: 600, stock: 10, gstRate: 0 } },
          { name: 'Fresh Prawns', slug: 'fresh-prawns', description: 'Medium-sized fresh prawns, cleaned and deveined', unit: 'kg', unitQuantity: 1, isVeg: false, isFeatured: false, isPopular: false, tags: '["prawns","seafood","non-veg"]', variant: { name: '500 g', price: 400, mrp: 480, costPrice: 320, discountPrice: 400, stock: 12, gstRate: 0 } },
        ],
      },
    ];

    // Create categories and products
    const categoryMap: Record<string, string> = {};
    const productVariantMap: Record<string, { productId: string; variantId: string; price: number; mrp: number; gstRate: number; isVeg: boolean }> = {};

    for (const cat of categoriesData) {
      // Upsert category
      const existingCat = await db.category.findFirst({
        where: { businessId: business.id, slug: cat.slug },
      });

      let categoryId: string;
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const created = await db.category.create({
          data: {
            businessId: business.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
            isActive: true,
          },
        });
        categoryId = created.id;
      }
      categoryMap[cat.slug] = categoryId;

      // Create products for this category
      for (const prod of cat.products) {
        const existingProd = await db.product.findFirst({
          where: { businessId: business.id, slug: prod.slug },
        });

        let productId: string;
        if (existingProd) {
          productId = existingProd.id;
        } else {
          const createdProd = await db.product.create({
            data: {
              businessId: business.id,
              storeId: store.id,
              categoryId,
              name: prod.name,
              slug: prod.slug,
              description: prod.description,
              type: 'PHYSICAL',
              status: 'ACTIVE',
              unit: prod.unit,
              unitQuantity: prod.unitQuantity,
              isVeg: prod.isVeg,
              isFeatured: prod.isFeatured,
              isPopular: prod.isPopular,
              tags: prod.tags,
              sortOrder: 0,
            },
          });
          productId = createdProd.id;

          // Create the default variant
          const variant = await db.productVariant.create({
            data: {
              productId,
              name: prod.variant.name,
              price: prod.variant.price,
              mrp: prod.variant.mrp,
              costPrice: prod.variant.costPrice,
              discountPrice: prod.variant.discountPrice,
              discountPercent: prod.variant.discountPrice
                ? Math.round(((prod.variant.mrp - prod.variant.discountPrice) / prod.variant.mrp) * 100 * 10) / 10
                : null,
              stock: prod.variant.stock,
              minStock: 5,
              isDefault: true,
              isActive: true,
              attributes: JSON.stringify({
                gstRate: prod.variant.gstRate,
                unit: prod.unit,
                unitQuantity: prod.unitQuantity,
              }),
            },
          });

          productVariantMap[prod.slug] = {
            productId,
            variantId: variant.id,
            price: prod.variant.price,
            mrp: prod.variant.mrp,
            gstRate: prod.variant.gstRate,
            isVeg: prod.isVeg,
          };

          // Create inventory record
          await db.inventory.create({
            data: {
              businessId: business.id,
              storeId: store.id,
              productId,
              variantId: variant.id,
              quantity: prod.variant.stock,
              reservedQty: 0,
              minStock: 5,
              maxStock: 1000,
              status: prod.variant.stock > 10 ? 'IN_STOCK' : prod.variant.stock > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
              lastRestockedAt: new Date(),
            },
          });
        }

        // If product already existed, try to get variant info
        if (existingProd) {
          const existingVariant = await db.productVariant.findFirst({
            where: { productId: existingProd.id, isDefault: true },
          });
          if (existingVariant) {
            productVariantMap[prod.slug] = {
              productId: existingProd.id,
              variantId: existingVariant.id,
              price: existingVariant.price,
              mrp: existingVariant.mrp,
              gstRate: prod.variant.gstRate,
              isVeg: prod.isVeg,
            };
          }
        }
      }
    }

    // =========================================================================
    // 11. TAX CONFIGS (GST 0%, 5%, 12%, 18%, 28%)
    // =========================================================================
    const taxConfigs = [
      { name: 'GST 0% (Exempted)', taxType: 'GST_0' as const, gstRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, hsnCode: null, isDefault: true },
      { name: 'GST 5%', taxType: 'GST_5' as const, gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, hsnCode: '0901' },
      { name: 'GST 12%', taxType: 'GST_12' as const, gstRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, hsnCode: '2106' },
      { name: 'GST 18%', taxType: 'GST_18' as const, gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnCode: '2101' },
      { name: 'GST 28%', taxType: 'GST_28' as const, gstRate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28, hsnCode: '2202' },
    ];

    for (const tc of taxConfigs) {
      const existing = await db.taxConfig.findFirst({
        where: { businessId: business.id, taxType: tc.taxType },
      });
      if (!existing) {
        await db.taxConfig.create({
          data: {
            businessId: business.id,
            ...tc,
            isActive: true,
          },
        });
      }
    }

    // =========================================================================
    // 12. DELIVERY ZONE — Mumbai 10km radius
    // =========================================================================
    const existingZone = await db.deliveryZone.findFirst({
      where: { businessId: business.id, name: 'Mumbai Central Zone' },
    });
    if (!existingZone) {
      await db.deliveryZone.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          name: 'Mumbai Central Zone',
          zoneType: 'CIRCLE',
          centerLat: 19.0596,
          centerLng: 72.8295,
          radius: 10,
          deliveryFee: 30,
          minOrderAmount: 200,
          freeDeliveryAbove: 500,
          estimatedTime: 45,
          isActive: true,
        },
      });
    }

    // =========================================================================
    // 13. DELIVERY PARTNER — Ramesh Kumar
    // =========================================================================
    const existingPartner = await db.deliveryPartner.findFirst({
      where: { businessId: business.id, phone: '+91 98765 43210' },
    });
    let deliveryPartnerId: string | undefined;
    if (!existingPartner) {
      const partner = await db.deliveryPartner.create({
        data: {
          businessId: business.id,
          name: 'Ramesh Kumar',
          phone: '+91 98765 43210',
          email: 'ramesh@freshmart.in',
          vehicleType: 'motorcycle',
          vehicleNumber: 'MH-01-AB-1234',
          licenseNumber: 'MH0120180012345',
          isOnline: true,
          isActive: true,
          currentLat: 19.06,
          currentLng: 72.83,
          rating: 4.5,
          totalDeliveries: 320,
          totalEarnings: 28500,
        },
      });
      deliveryPartnerId = partner.id;
    } else {
      deliveryPartnerId = existingPartner.id;
    }

    // =========================================================================
    // 14. CUSTOMERS (5 customers with addresses)
    // =========================================================================
    const customerSeeds = [
      { name: 'Priya Sharma', phone: '+91 98100 10001', email: 'priya.sharma@gmail.com', loyaltyPoints: 250, totalOrders: 12, totalSpent: 8500, address: { label: 'Home', line1: '301, Shiv Sagar Estate', line2: 'Dr. Ambedkar Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400051', landmark: 'Near Shivaji Park', isDefault: true } },
      { name: 'Rahul Patel', phone: '+91 98100 10002', email: 'rahul.patel@gmail.com', loyaltyPoints: 180, totalOrders: 8, totalSpent: 6200, address: { label: 'Home', line1: 'B-12, Juhu Tara Road', line2: 'Juhu', city: 'Mumbai', state: 'Maharashtra', pincode: '400049', landmark: 'Opposite Juhu Beach', isDefault: true } },
      { name: 'Anita Desai', phone: '+91 98100 10003', email: 'anita.desai@gmail.com', loyaltyPoints: 420, totalOrders: 22, totalSpent: 15800, address: { label: 'Home', line1: '405, Shanti Niketan', line2: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', landmark: 'Near Linking Road', isDefault: true } },
      { name: 'Vikram Singh', phone: '+91 98100 10004', email: 'vikram.singh@gmail.com', loyaltyPoints: 90, totalOrders: 5, totalSpent: 3800, address: { label: 'Home', line1: '2nd Floor, Kalpataru Estate', line2: 'Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400058', landmark: 'Near Versova Metro', isDefault: true } },
      { name: 'Meera Joshi', phone: '+91 98100 10005', email: 'meera.joshi@gmail.com', loyaltyPoints: 310, totalOrders: 15, totalSpent: 11200, address: { label: 'Home', line1: 'A-701, Lodha Paradise', line2: 'Worli', city: 'Mumbai', state: 'Maharashtra', pincode: '400030', landmark: 'Near Worli Sea Link', isDefault: true } },
    ];

    const customerIds: string[] = [];
    for (const cs of customerSeeds) {
      const existingCustomer = await db.customer.findFirst({
        where: { businessId: business.id, phone: cs.phone },
      });

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const customer = await db.customer.create({
          data: {
            businessId: business.id,
            name: cs.name,
            phone: cs.phone,
            email: cs.email,
            loyaltyPoints: cs.loyaltyPoints,
            totalOrders: cs.totalOrders,
            totalSpent: cs.totalSpent,
            avgOrderValue: cs.totalOrders > 0 ? Math.round(cs.totalSpent / cs.totalOrders) : 0,
            lastOrderAt: new Date(),
            tags: '["regular"]',
            isActive: true,
          },
        });
        customerId = customer.id;

        // Create address
        await db.address.create({
          data: {
            customerId,
            label: cs.address.label,
            addressLine1: cs.address.line1,
            addressLine2: cs.address.line2,
            city: cs.address.city,
            state: cs.address.state,
            pincode: cs.address.pincode,
            isDefault: cs.address.isDefault,
            landmark: cs.address.landmark,
          },
        });
      }
      customerIds.push(customerId);
    }

    // =========================================================================
    // 15. SAMPLE ORDERS (5-8 orders in various statuses)
    // =========================================================================
    const orderSeeds = [
      {
        orderNumber: 'FM-2024-001',
        status: 'DELIVERED' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'UPI' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 2, // Anita Desai
        items: [
          { slug: 'banana', qty: 2 },
          { slug: 'amul-taaza-milk-1l', qty: 2 },
          { slug: 'toor-dal-1kg', qty: 1 },
          { slug: 'mdh-garam-masala-100g', qty: 1 },
          { slug: 'fortune-sunflower-oil-1l', qty: 1 },
        ],
      },
      {
        orderNumber: 'FM-2024-002',
        status: 'DELIVERED' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'CARD' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 4, // Meera Joshi
        items: [
          { slug: 'apple-shimla', qty: 1 },
          { slug: 'amul-paneer-200g', qty: 2 },
          { slug: 'tata-tea-gold-250g', qty: 1 },
          { slug: 'parle-g-biscuit', qty: 3 },
        ],
      },
      {
        orderNumber: 'FM-2024-003',
        status: 'OUT_FOR_DELIVERY' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'UPI' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 0, // Priya Sharma
        items: [
          { slug: 'onion', qty: 2 },
          { slug: 'tomato', qty: 2 },
          { slug: 'potato', qty: 3 },
          { slug: 'britannia-bread', qty: 1 },
          { slug: 'amul-butter-500g', qty: 1 },
        ],
      },
      {
        orderNumber: 'FM-2024-004',
        status: 'CONFIRMED' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'UPI' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 1, // Rahul Patel
        items: [
          { slug: 'india-gate-basmati-5kg', qty: 1 },
          { slug: 'moong-dal-1kg', qty: 1 },
          { slug: 'mdh-turmeric-powder-100g', qty: 1 },
          { slug: 'amul-ghee-500ml', qty: 1 },
        ],
      },
      {
        orderNumber: 'FM-2024-005',
        status: 'PENDING' as const,
        paymentStatus: 'PENDING' as const,
        paymentMethod: 'COD' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 3, // Vikram Singh
        items: [
          { slug: 'maggi-noodles', qty: 5 },
          { slug: 'lays-classic-salted', qty: 3 },
          { slug: 'nescafe-classic-25g', qty: 1 },
        ],
      },
      {
        orderNumber: 'FM-2024-006',
        status: 'DELIVERED' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'CASH' as const,
        orderType: 'POS' as const,
        customerIdx: 2, // Anita Desai (walk-in)
        items: [
          { slug: 'green-chillies', qty: 1 },
          { slug: 'capsicum-green', qty: 1 },
          { slug: 'amul-curd-400g', qty: 2 },
        ],
      },
      {
        orderNumber: 'FM-2024-007',
        status: 'CONFIRMED' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'UPI' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 4, // Meera Joshi
        items: [
          { slug: 'fresh-chicken-curry-cut', qty: 1 },
          { slug: 'onion', qty: 1 },
          { slug: 'mdh-red-chilli-powder-100g', qty: 1 },
          { slug: 'fortune-mustard-oil-1l', qty: 1 },
          { slug: 'tata-salt-1kg', qty: 1 },
        ],
      },
      {
        orderNumber: 'FM-2024-008',
        status: 'OUT_FOR_DELIVERY' as const,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: 'UPI' as const,
        orderType: 'DELIVERY' as const,
        customerIdx: 0, // Priya Sharma
        items: [
          { slug: 'surf-excel-easy-wash-1kg', qty: 1 },
          { slug: 'vim-dishwash-liquid', qty: 1 },
          { slug: 'colgate-strong-teeth', qty: 1 },
          { slug: 'dettol-soap', qty: 2 },
        ],
      },
    ];

    const promoCodeId = (await db.promoCode.findFirst({
      where: { businessId: business.id, code: 'FRESH10' },
    }))?.id;

    for (const orderSeed of orderSeeds) {
      const existingOrder = await db.order.findFirst({
        where: { businessId: business.id, orderNumber: orderSeed.orderNumber },
      });

      if (existingOrder) continue;

      // Calculate order totals from items
      let subtotal = 0;
      let totalMrp = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      const orderItems: { productId: string; variantId: string; name: string; variantName: string; qty: number; price: number; mrp: number; gstRate: number; isVeg: boolean }[] = [];

      for (const item of orderSeed.items) {
        const pv = productVariantMap[item.slug];
        if (!pv) continue;

        const itemTotal = pv.price * item.qty;
        const itemMrpTotal = pv.mrp * item.qty;
        const itemTax = (itemTotal * pv.gstRate) / (100 + pv.gstRate);
        const itemDiscount = itemMrpTotal - itemTotal;

        subtotal += itemTotal;
        totalMrp += itemMrpTotal;
        totalTax += itemTax;
        totalDiscount += itemDiscount;

        orderItems.push({
          productId: pv.productId,
          variantId: pv.variantId,
          name: item.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          variantName: 'Default',
          qty: item.qty,
          price: pv.price,
          mrp: pv.mrp,
          gstRate: pv.gstRate,
          isVeg: pv.isVeg,
        });
      }

      const deliveryFee = subtotal >= 500 ? 0 : 30;
      const totalAmount = Math.round(subtotal + deliveryFee);
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;

      const customerName = customerSeeds[orderSeed.customerIdx]?.name || 'Guest';
      const customerPhone = customerSeeds[orderSeed.customerIdx]?.phone || '';
      const customerEmail = customerSeeds[orderSeed.customerIdx]?.email || '';
      const customerId = customerIds[orderSeed.customerIdx];

      const order = await db.order.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          orderNumber: orderSeed.orderNumber,
          orderType: orderSeed.orderType,
          status: orderSeed.status,
          paymentStatus: orderSeed.paymentStatus,
          paymentMethod: orderSeed.paymentMethod,
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddress: '301, Shiv Sagar Estate, Dr. Ambedkar Road, Mumbai - 400051',
          deliveryLat: 19.06,
          deliveryLng: 72.83,
          subtotal: Math.round(subtotal),
          totalDiscount: Math.round(totalDiscount),
          totalTax: Math.round(totalTax),
          deliveryFee,
          totalAmount,
          cgstAmount: Math.round(cgst * 100) / 100,
          sgstAmount: Math.round(sgst * 100) / 100,
          igstAmount: 0,
          confirmedAt: orderSeed.status !== 'PENDING' ? new Date() : null,
          preparedAt: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderSeed.status) ? new Date() : null,
          deliveredAt: orderSeed.status === 'DELIVERED' ? new Date() : null,
          deliveryOtp: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderSeed.status) ? String(Math.floor(100000 + Math.random() * 900000)) : null,
          promoCodeId: orderSeed.orderNumber === 'FM-2024-004' ? promoCodeId : null,
        },
      });

      // Create order items
      for (const oi of orderItems) {
        const itemTotal = oi.price * oi.qty;
        const itemTaxAmount = (itemTotal * oi.gstRate) / (100 + oi.gstRate);
        await db.orderItem.create({
          data: {
            orderId: order.id,
            productId: oi.productId,
            variantId: oi.variantId,
            productName: oi.name,
            variantName: oi.variantName,
            quantity: oi.qty,
            unitPrice: oi.price,
            mrp: oi.mrp,
            discountPrice: oi.price < oi.mrp ? oi.price : null,
            discountPercent: oi.price < oi.mrp ? Math.round(((oi.mrp - oi.price) / oi.mrp) * 100) : null,
            totalPrice: Math.round(itemTotal),
            totalMrp: Math.round(oi.mrp * oi.qty),
            gstRate: oi.gstRate,
            gstAmount: Math.round(itemTaxAmount * 100) / 100,
            cgstAmount: Math.round((itemTaxAmount / 2) * 100) / 100,
            sgstAmount: Math.round((itemTaxAmount / 2) * 100) / 100,
            isVeg: oi.isVeg,
          },
        });
      }

      // Create order status history
      const statusFlow: string[] = [];
      if (orderSeed.status === 'DELIVERED') {
        statusFlow.push('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED');
      } else if (orderSeed.status === 'OUT_FOR_DELIVERY') {
        statusFlow.push('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY');
      } else if (orderSeed.status === 'CONFIRMED') {
        statusFlow.push('PENDING', 'CONFIRMED');
      } else if (orderSeed.status === 'PENDING') {
        statusFlow.push('PENDING');
      }

      for (let si = 0; si < statusFlow.length; si++) {
        await db.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: statusFlow[si] as 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED',
            note: `Order status changed to ${statusFlow[si]}`,
            changedBy: si === 0 ? 'system' : 'admin',
            createdAt: new Date(Date.now() - (statusFlow.length - si) * 600000),
          },
        });
      }

      // Create delivery record for OUT_FOR_DELIVERY orders
      if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(orderSeed.status) && deliveryPartnerId) {
        await db.delivery.create({
          data: {
            orderId: order.id,
            deliveryPartnerId,
            status: orderSeed.status === 'DELIVERED' ? 'DELIVERED' : 'ON_THE_WAY',
            pickupLat: 19.0596,
            pickupLng: 72.8295,
            pickupAddress: '42 Linking Road, Bandra West, Mumbai',
            dropLat: 19.06,
            dropLng: 72.83,
            dropAddress: 'Customer Address, Mumbai',
            estimatedDeliveryTime: new Date(Date.now() + 30 * 60000),
            actualDeliveryTime: orderSeed.status === 'DELIVERED' ? new Date() : null,
            distance: 3.5,
            deliveryOtp: order.deliveryOtp,
          },
        });
      }
    }

    // =========================================================================
    // 16. POS SESSION (one open session)
    // =========================================================================
    const existingSession = await db.pOSSession.findFirst({
      where: { businessId: business.id, status: 'OPEN' },
    });
    if (!existingSession) {
      await db.pOSSession.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          operatorId: admin.id,
          sessionNumber: 'POS-2024-001',
          status: 'OPEN',
          openingBalance: 5000,
          totalSales: 3850,
          totalCash: 1200,
          totalCard: 800,
          totalUpi: 1850,
          totalRefunds: 0,
          totalOrders: 6,
          cashDrawer: JSON.stringify({
            2000: 0, 500: 2, 200: 3, 100: 5, 50: 8, 20: 10, 10: 15,
          }),
          openedAt: new Date(new Date().setHours(8, 0, 0, 0)),
        },
      });
    }

    // =========================================================================
    // 17. PROMO CODE — FRESH10 (10% off, min ₹200)
    // =========================================================================
    await db.promoCode.upsert({
      where: { businessId_code: { businessId: business.id, code: 'FRESH10' } },
      update: {},
      create: {
        businessId: business.id,
        code: 'FRESH10',
        description: '10% off on your first order! Minimum order ₹200',
        promoType: 'PERCENTAGE',
        value: 10,
        minOrderAmount: 200,
        maxDiscount: 100,
        usageLimit: 1000,
        usageCount: 47,
        perCustomerLimit: 1,
        isFirstOrderOnly: true,
        isActive: true,
        startsAt: new Date('2024-01-01'),
        endsAt: new Date('2025-12-31'),
      },
    });

    // =========================================================================
    // ADDITIONAL: BusinessUser for Super Admin + Client Owner
    // =========================================================================
    const existingBizUser = await db.businessUser.findFirst({
      where: { userId: admin.id, businessId: business.id },
    });
    if (!existingBizUser) {
      await db.businessUser.create({
        data: {
          userId: admin.id,
          businessId: business.id,
          role: 'CLIENT_OWNER',
          storeId: store.id,
          isActive: true,
          acceptedAt: new Date(),
        },
      });
    }

    // Create a store manager user
    const storeManager = await db.user.upsert({
      where: { email: 'manager@freshmart.in' },
      update: {},
      create: {
        email: 'manager@freshmart.in',
        name: 'Amit Verma',
        phone: '+91 98765 11111',
        passwordHash: '$2a$12$placeholder_hash_for_dev',
        authProvider: 'PASSWORD',
        emailVerified: true,
        isActive: true,
      },
    });

    const existingManager = await db.businessUser.findFirst({
      where: { userId: storeManager.id, businessId: business.id },
    });
    if (!existingManager) {
      await db.businessUser.create({
        data: {
          userId: storeManager.id,
          businessId: business.id,
          role: 'STORE_MANAGER',
          storeId: store.id,
          isActive: true,
          acceptedAt: new Date(),
        },
      });
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const productCount = await db.product.count({ where: { businessId: business.id } });
    const categoryCount = await db.category.count({ where: { businessId: business.id } });
    const orderCount = await db.order.count({ where: { businessId: business.id } });
    const customerCount = await db.customer.count({ where: { businessId: business.id } });

    return NextResponse.json({
      success: true,
      data: {
        business: business.name,
        store: store.name,
        categories: categoryCount,
        products: productCount,
        orders: orderCount,
        customers: customerCount,
        message: 'FreshMart Grocery seed completed successfully',
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
