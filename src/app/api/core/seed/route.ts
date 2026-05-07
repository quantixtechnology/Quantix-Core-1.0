// ============================================================================
// Route: POST /api/core/seed
// Seed the platform with initial data for testing
// Creates: PlatformConfig, PlatformPlans, Super Admin, Sales Team Member,
//          Sample Grocery Business with full data
// ============================================================================

import { db } from '@/lib/db';
import { enableDefaultModules } from '@/lib/core';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const summary: Record<string, unknown> = {};

    // =========================================================================
    // 1. PLATFORM CONFIG
    // =========================================================================
    const platformConfigs = [
      { key: 'platform.name', value: 'Quantix Core Platform', description: 'Platform display name' },
      { key: 'platform.tagline', value: 'Run Your Business Smarter', description: 'Platform tagline' },
      { key: 'platform.website', value: 'https://quantixtechnology.in', description: 'Platform website URL' },
      { key: 'platform.support_email', value: 'support@quantixtechnology.in', description: 'Support email' },
      { key: 'platform.default_trial_days', value: '14', description: 'Default trial period in days' },
      { key: 'platform.max_trial_extensions', value: '2', description: 'Max trial extensions allowed' },
      { key: 'platform.otp.expiry_minutes', value: '5', description: 'OTP expiry in minutes' },
      { key: 'platform.otp.max_per_hour', value: '5', description: 'Max OTP requests per hour per identifier' },
      { key: 'platform.currency', value: 'INR', description: 'Default platform currency' },
      { key: 'platform.locale', value: 'en-IN', description: 'Default platform locale' },
      { key: 'platform.timezone', value: 'Asia/Kolkata', description: 'Default platform timezone' },
      { key: 'platform.gst_enabled', value: 'true', description: 'GST billing enabled' },
    ];

    const createdConfigs = [];
    for (const config of platformConfigs) {
      const result = await db.platformConfig.upsert({
        where: { key: config.key },
        update: { value: config.value, description: config.description },
        create: { key: config.key, value: config.value, description: config.description },
      });
      createdConfigs.push(result);
    }
    summary.platformConfigs = createdConfigs.length;

    // =========================================================================
    // 2. PLATFORM PLANS
    // =========================================================================
    const plans = [
      {
        name: 'Starter',
        tier: 'STARTER' as const,
        monthlyPrice: 4999,
        yearlyPrice: 49990,
        description: 'Perfect for small businesses getting started',
        features: JSON.stringify(['1 Store', '500 Products', '1000 Orders/mo', '5 Staff', 'Basic POS', 'Delivery Management']),
        maxStores: 1,
        maxProducts: 500,
        maxOrders: 1000,
        maxDeliveryPartners: 3,
        maxStaff: 5,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: false,
        hasCustomDomain: false,
        hasWhiteLabel: false,
        hasAdvancedReports: false,
        hasAPIAccess: false,
        sortOrder: 1,
      },
      {
        name: 'Professional',
        tier: 'PROFESSIONAL' as const,
        monthlyPrice: 14999,
        yearlyPrice: 149990,
        description: 'For growing businesses that need more power',
        features: JSON.stringify(['3 Stores', '5000 Products', '5000 Orders/mo', '20 Staff', 'Full POS', 'Delivery', 'Subscriptions', 'Custom Domain', 'Advanced Reports']),
        maxStores: 3,
        maxProducts: 5000,
        maxOrders: 5000,
        maxDeliveryPartners: 10,
        maxStaff: 20,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: true,
        hasCustomDomain: true,
        hasWhiteLabel: false,
        hasAdvancedReports: true,
        hasAPIAccess: false,
        sortOrder: 2,
      },
      {
        name: 'Enterprise',
        tier: 'ENTERPRISE' as const,
        monthlyPrice: 49999,
        yearlyPrice: 499990,
        description: 'For large businesses with unlimited needs',
        features: JSON.stringify(['Unlimited Stores', 'Unlimited Products', 'Unlimited Orders', 'Unlimited Staff', 'Full POS', 'Delivery', 'Subscriptions', 'Custom Domain', 'White Label', 'Advanced Reports', 'API Access']),
        maxStores: 100,
        maxProducts: 100000,
        maxOrders: 100000,
        maxDeliveryPartners: 100,
        maxStaff: 100,
        hasPOS: true,
        hasDelivery: true,
        hasSubscription: true,
        hasCustomDomain: true,
        hasWhiteLabel: true,
        hasAdvancedReports: true,
        hasAPIAccess: true,
        sortOrder: 3,
      },
    ];

    const createdPlans = [];
    for (const plan of plans) {
      const planId = plan.tier === 'STARTER' ? 'plan_starter' : plan.tier === 'PROFESSIONAL' ? 'plan_professional' : 'plan_enterprise';
      const result = await db.platformPlan.upsert({
        where: { id: planId },
        update: plan,
        create: { id: planId, ...plan },
      });
      createdPlans.push(result);
    }
    summary.platformPlans = createdPlans.length;

    // =========================================================================
    // 3. SUPER ADMIN USER
    // =========================================================================
    const superAdmin = await db.user.upsert({
      where: { email: 'admin@quantixtechnology.in' },
      update: {},
      create: {
        email: 'admin@quantixtechnology.in',
        name: 'Quantix Super Admin',
        phone: '+919876543210',
        authProvider: 'EMAIL_OTP',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });
    summary.superAdmin = { id: superAdmin.id, email: superAdmin.email };

    // =========================================================================
    // 4. SALES TEAM MEMBER
    // =========================================================================
    const salesUser = await db.user.upsert({
      where: { email: 'sales@quantixtechnology.in' },
      update: {},
      create: {
        email: 'sales@quantixtechnology.in',
        name: 'Priya Sharma',
        phone: '+919876543211',
        authProvider: 'EMAIL_OTP',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });

    const salesMember = await db.salesTeamMember.upsert({
      where: { userId: salesUser.id },
      update: {},
      create: {
        userId: salesUser.id,
        name: 'Priya Sharma',
        email: 'sales@quantixtechnology.in',
        phone: '+919876543211',
        target: 500000,
        achieved: 125000,
        region: 'Mumbai West',
        isActive: true,
      },
    });
    summary.salesTeamMember = { id: salesMember.id, name: salesMember.name };

    // =========================================================================
    // 5. SAMPLE GROCERY BUSINESS — FreshMart
    // =========================================================================
    const business = await db.business.upsert({
      where: { slug: 'freshmart-grocery' },
      update: {},
      create: {
        name: 'FreshMart Grocery',
        slug: 'freshmart-grocery',
        businessType: 'GROCERY',
        status: 'TRIAL',
        tagline: 'Fresh from Farm to Your Door',
        description: 'Premium grocery store with fresh fruits, vegetables, dairy, and daily essentials delivered to your doorstep.',
        gstNumber: '27AABCF1234A1Z5',
        fssaiLicense: '12345678901234',
        address: '42, MG Road, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053',
        country: 'India',
        latitude: 19.1197,
        longitude: 72.8464,
        contactEmail: 'hello@freshmart.in',
        contactPhone: '+919876543220',
        supportEmail: 'support@freshmart.in',
        supportPhone: '+919876543221',
        primaryColor: '#10B981',
        isOnline: true,
        salesRepId: salesMember.id,
        trialStartsAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    summary.business = { id: business.id, name: business.name };

    // =========================================================================
    // 6. BUSINESS SUBSCRIPTION (Trial)
    // =========================================================================
    const subscription = await db.businessSubscription.upsert({
      where: { businessId: business.id },
      update: {},
      create: {
        businessId: business.id,
        planId: 'plan_professional',
        status: 'TRIAL',
        planPrice: 14999,
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    summary.subscription = { id: subscription.id, status: subscription.status };

    // =========================================================================
    // 7. BUSINESS MODULES
    // =========================================================================
    await enableDefaultModules(business.id, 'GROCERY');

    // Also enable catalog module
    await db.businessModule.upsert({
      where: { businessId_moduleKey: { businessId: business.id, moduleKey: 'catalog' } },
      update: { status: 'ENABLED', enabledAt: new Date() },
      create: {
        businessId: business.id,
        moduleKey: 'catalog',
        moduleName: 'Product Catalog',
        status: 'ENABLED',
        config: JSON.stringify({ enableCategories: true, enableVariants: true }),
        enabledAt: new Date(),
      },
    });
    summary.modules = ['grocery', 'catalog'];

    // =========================================================================
    // 8. MAIN STORE WITH TIMINGS
    // =========================================================================
    const store = await db.store.upsert({
      where: { id: 'store_freshmart_main' },
      update: {},
      create: {
        id: 'store_freshmart_main',
        businessId: business.id,
        name: 'FreshMart Main Store',
        slug: 'main-store',
        code: 'FM01',
        address: '42, MG Road, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053',
        country: 'India',
        latitude: 19.1197,
        longitude: 72.8464,
        phone: '+919876543220',
        status: 'ACTIVE',
        isMainStore: true,
        deliveryRadius: 5.0,
        minOrderAmount: 200,
        deliveryFee: 30,
        freeDeliveryAbove: 500,
        maxDeliveryDistance: 10.0,
        preparationTime: 30,
        operatingHours: JSON.stringify({
          mon: { open: '08:00', close: '22:00' },
          tue: { open: '08:00', close: '22:00' },
          wed: { open: '08:00', close: '22:00' },
          thu: { open: '08:00', close: '22:00' },
          fri: { open: '08:00', close: '22:00' },
          sat: { open: '08:00', close: '22:00' },
          sun: { open: '09:00', close: '21:00' },
        }),
        posEnabled: true,
      },
    });
    summary.store = { id: store.id, name: store.name };

    // Store timings
    const timings = [
      { storeId: store.id, day: 0, openTime: '09:00', closeTime: '21:00' },
      { storeId: store.id, day: 1, openTime: '08:00', closeTime: '22:00' },
      { storeId: store.id, day: 2, openTime: '08:00', closeTime: '22:00' },
      { storeId: store.id, day: 3, openTime: '08:00', closeTime: '22:00' },
      { storeId: store.id, day: 4, openTime: '08:00', closeTime: '22:00' },
      { storeId: store.id, day: 5, openTime: '08:00', closeTime: '22:00' },
      { storeId: store.id, day: 6, openTime: '08:00', closeTime: '22:00' },
    ];
    for (const t of timings) {
      await db.storeTiming.upsert({
        where: { storeId_day: { storeId: t.storeId, day: t.day } },
        update: { openTime: t.openTime, closeTime: t.closeTime },
        create: t,
      });
    }
    summary.storeTimings = timings.length;

    // =========================================================================
    // 9. TAX CONFIGS (GST)
    // =========================================================================
    const taxConfigs = [
      { businessId: business.id, name: 'GST 0%', taxType: 'gst_0', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, isDefault: true },
      { businessId: business.id, name: 'GST 5%', taxType: 'gst_5', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
      { businessId: business.id, name: 'GST 12%', taxType: 'gst_12', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12 },
      { businessId: business.id, name: 'GST 18%', taxType: 'gst_18', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18 },
      { businessId: business.id, name: 'GST 28%', taxType: 'gst_28', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28 },
    ];
    for (const tax of taxConfigs) {
      await db.taxConfig.upsert({
        where: { id: `tax_${business.id}_${tax.taxType}` },
        update: tax,
        create: { id: `tax_${business.id}_${tax.taxType}`, ...tax },
      });
    }
    summary.taxConfigs = taxConfigs.length;

    // =========================================================================
    // 10. DELIVERY ZONE (5km radius)
    // =========================================================================
    const deliveryZone = await db.deliveryZone.upsert({
      where: { id: `zone_${business.id}_main` },
      update: {},
      create: {
        id: `zone_${business.id}_main`,
        businessId: business.id,
        storeId: store.id,
        name: 'Andheri West - 5km',
        zoneType: 'CIRCLE',
        centerLat: 19.1197,
        centerLng: 72.8464,
        radius: 5.0,
        deliveryFee: 30,
        minOrderAmount: 200,
        freeDeliveryAbove: 500,
        estimatedTime: 30,
        isActive: true,
      },
    });
    summary.deliveryZone = { id: deliveryZone.id, name: deliveryZone.name };

    // =========================================================================
    // 11. DELIVERY PARTNER
    // =========================================================================
    const deliveryPartner = await db.deliveryPartner.upsert({
      where: { id: `dp_${business.id}_ravi` },
      update: {},
      create: {
        id: `dp_${business.id}_ravi`,
        businessId: business.id,
        name: 'Ravi Kumar',
        phone: '+919876543230',
        email: 'ravi@delivery.in',
        vehicleType: 'motorcycle',
        vehicleNumber: 'MH-02-AB-1234',
        isOnline: true,
        isActive: true,
        currentLat: 19.1197,
        currentLng: 72.8464,
        rating: 4.8,
        totalDeliveries: 156,
        totalEarnings: 23400,
      },
    });
    summary.deliveryPartner = { id: deliveryPartner.id, name: deliveryPartner.name };

    // =========================================================================
    // 12. CUSTOMERS WITH ADDRESSES
    // =========================================================================
    const customersData = [
      { name: 'Amit Patel', email: 'amit@gmail.com', phone: '+919876543301' },
      { name: 'Sneha Kulkarni', email: 'sneha@gmail.com', phone: '+919876543302' },
      { name: 'Rajesh Iyer', email: 'rajesh@gmail.com', phone: '+919876543303' },
      { name: 'Pooja Deshmukh', email: 'pooja@gmail.com', phone: '+919876543304' },
      { name: 'Vikram Singh', email: 'vikram@gmail.com', phone: '+919876543305' },
    ];

    const createdCustomers = [];
    const addressesData = [
      { label: 'Home', addressLine1: '101, Sunshine Apartments', addressLine2: 'JVLR, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', landmark: 'Near Metro Station' },
      { label: 'Home', addressLine1: '205, Green Valley', addressLine2: 'Lokhandwala, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', landmark: 'Opposite City Mall' },
      { label: 'Home', addressLine1: '12, Shivaji Nagar', addressLine2: 'Goregaon West', city: 'Mumbai', state: 'Maharashtra', pincode: '400062', landmark: 'Near Aarey Colony' },
      { label: 'Home', addressLine1: 'A-301, Imperial Towers', addressLine2: 'Malad West', city: 'Mumbai', state: 'Maharashtra', pincode: '400064', landmark: 'Next to Inorbit Mall' },
      { label: 'Home', addressLine1: '45, Versova Beach Road', addressLine2: 'Versova, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400061', landmark: 'Near Cafe Coffee Day' },
    ];

    for (let i = 0; i < customersData.length; i++) {
      const cData = customersData[i];
      const customer = await db.customer.upsert({
        where: { id: `cust_${business.id}_${i + 1}` },
        update: {},
        create: {
          id: `cust_${business.id}_${i + 1}`,
          businessId: business.id,
          name: cData.name,
          email: cData.email,
          phone: cData.phone,
          loyaltyPoints: (i + 1) * 50,
          totalOrders: i + 1,
          totalSpent: (i + 1) * 800,
          avgOrderValue: 800,
        },
      });

      // Create address
      const addr = addressesData[i];
      await db.address.create({
        data: {
          customerId: customer.id,
          label: addr.label,
          addressLine1: addr.addressLine1,
          addressLine2: addr.addressLine2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landmark,
          isDefault: true,
        },
      });

      createdCustomers.push(customer);
    }
    summary.customers = createdCustomers.length;

    // =========================================================================
    // 13. CATEGORIES (12 Grocery Categories)
    // =========================================================================
    // Category schema: id, businessId, name, slug, description, image, icon,
    //                  parentId, sortOrder, isActive, createdAt, updatedAt
    const categoriesData = [
      { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh fruits and organic vegetables', icon: '🥬', sortOrder: 1 },
      { name: 'Dairy & Breakfast', slug: 'dairy-breakfast', description: 'Milk, curd, paneer, bread and breakfast items', icon: '🥛', sortOrder: 2 },
      { name: 'Rice & Grains', slug: 'rice-grains', description: 'Basmati rice, atta, dal and pulses', icon: '🌾', sortOrder: 3 },
      { name: 'Spices & Masala', slug: 'spices-masala', description: 'Whole spices, powder masala and seasonings', icon: '🌶️', sortOrder: 4 },
      { name: 'Snacks & Beverages', slug: 'snacks-beverages', description: 'Chips, biscuits, tea, coffee and cold drinks', icon: '☕', sortOrder: 5 },
      { name: 'Oil & Ghee', slug: 'oil-ghee', description: 'Cooking oil, ghee, butter and margarine', icon: '🫗', sortOrder: 6 },
      { name: 'Cleaning & Household', slug: 'cleaning-household', description: 'Detergents, soaps, and household essentials', icon: '🧹', sortOrder: 7 },
      { name: 'Personal Care', slug: 'personal-care', description: 'Shampoo, toothpaste, skincare and hygiene', icon: '🧴', sortOrder: 8 },
      { name: 'Baby Care', slug: 'baby-care', description: 'Baby food, diapers, and baby essentials', icon: '👶', sortOrder: 9 },
      { name: 'Meat & Fish', slug: 'meat-fish', description: 'Fresh chicken, mutton, fish and eggs', icon: '🍗', sortOrder: 10 },
      { name: 'Bakery', slug: 'bakery', description: 'Cakes, pastries, bread and cookies', icon: '🍰', sortOrder: 11 },
      { name: 'Frozen Foods', slug: 'frozen-foods', description: 'Frozen snacks, ice cream and ready-to-eat', icon: '🧊', sortOrder: 12 },
    ];

    const createdCategories = [];
    for (const cat of categoriesData) {
      const category = await db.category.upsert({
        where: { id: `cat_${business.id}_${cat.slug}` },
        update: { name: cat.name, description: cat.description, icon: cat.icon, sortOrder: cat.sortOrder },
        create: {
          id: `cat_${business.id}_${cat.slug}`,
          businessId: business.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          isActive: true,
        },
      });
      createdCategories.push(category);
    }
    summary.categories = createdCategories.length;

    // =========================================================================
    // 14. PRODUCTS WITH VARIANTS AND INVENTORY (30 Products)
    // =========================================================================
    // Product schema: id, businessId, storeId?, categoryId?, name, slug,
    //   description?, shortDesc?, type (ProductType), status (ProductStatus),
    //   sku?, barcode?, images, unit?, unitQuantity?, isVeg?, isFeatured,
    //   isPopular, preparationTime?, minOrderQty, maxOrderQty, tags,
    //   nutritionInfo?, allergenInfo?, sortOrder, metadata
    // ProductVariant: id, productId, name, sku?, barcode?, price, mrp,
    //   costPrice?, discountPrice?, discountPercent?, stock, minStock,
    //   isDefault, isActive, attributes
    // Inventory: id, businessId, storeId, productId, variantId?, quantity,
    //   reservedQty, minStock, maxStock, status, lastRestockedAt
    const productsData = [
      // Fruits & Vegetables
      { name: 'Organic Bananas', slug: 'organic-bananas', catSlug: 'fruits-vegetables', mrp: 49, price: 45, gstRate: 0, unit: 'dozen', isVeg: true },
      { name: 'Fresh Tomatoes', slug: 'fresh-tomatoes', catSlug: 'fruits-vegetables', mrp: 40, price: 35, gstRate: 0, unit: 'kg', isVeg: true },
      { name: 'Green Apples', slug: 'green-apples', catSlug: 'fruits-vegetables', mrp: 199, price: 179, gstRate: 5, unit: 'kg', isVeg: true },
      // Dairy & Breakfast
      { name: 'Amul Toned Milk', slug: 'amul-toned-milk', catSlug: 'dairy-breakfast', mrp: 28, price: 28, gstRate: 5, unit: '500ml', isVeg: true },
      { name: 'Mother Dairy Curd', slug: 'mother-dairy-curd', catSlug: 'dairy-breakfast', mrp: 40, price: 38, gstRate: 5, unit: '400g', isVeg: true },
      { name: 'Britannia Bread', slug: 'britannia-bread', catSlug: 'dairy-breakfast', mrp: 45, price: 42, gstRate: 0, unit: '400g', isVeg: true },
      // Rice & Grains
      { name: 'India Gate Basmati Rice', slug: 'india-gate-basmati', catSlug: 'rice-grains', mrp: 220, price: 199, gstRate: 5, unit: '1kg', isVeg: true },
      { name: 'Aashirvaad Atta', slug: 'aashirvaad-atta', catSlug: 'rice-grains', mrp: 295, price: 275, gstRate: 0, unit: '5kg', isVeg: true },
      { name: 'Tuar Dal', slug: 'tuar-dal', catSlug: 'rice-grains', mrp: 145, price: 130, gstRate: 5, unit: '1kg', isVeg: true },
      // Spices & Masala
      { name: 'MDH Garam Masala', slug: 'mdh-garam-masala', catSlug: 'spices-masala', mrp: 95, price: 88, gstRate: 5, unit: '100g', isVeg: true },
      { name: 'Everest Turmeric Powder', slug: 'everest-turmeric', catSlug: 'spices-masala', mrp: 58, price: 52, gstRate: 5, unit: '100g', isVeg: true },
      // Snacks & Beverages
      { name: 'Lays Classic Chips', slug: 'lays-classic', catSlug: 'snacks-beverages', mrp: 20, price: 20, gstRate: 18, unit: '52g', isVeg: true },
      { name: 'Tata Gold Tea', slug: 'tata-gold-tea', catSlug: 'snacks-beverages', mrp: 125, price: 115, gstRate: 5, unit: '250g', isVeg: true },
      { name: 'Nescafe Classic', slug: 'nescafe-classic', catSlug: 'snacks-beverages', mrp: 225, price: 210, gstRate: 18, unit: '200g', isVeg: true },
      // Oil & Ghee
      { name: 'Fortune Sunflower Oil', slug: 'fortune-sunflower-oil', catSlug: 'oil-ghee', mrp: 155, price: 145, gstRate: 5, unit: '1L', isVeg: true },
      { name: 'Amul Ghee', slug: 'amul-ghee', catSlug: 'oil-ghee', mrp: 585, price: 555, gstRate: 5, unit: '500ml', isVeg: true },
      // Cleaning & Household
      { name: 'Surf Excel Matic', slug: 'surf-excel-matic', catSlug: 'cleaning-household', mrp: 350, price: 320, gstRate: 18, unit: '1kg', isVeg: true },
      { name: 'Vim Dishwash Liquid', slug: 'vim-dishwash', catSlug: 'cleaning-household', mrp: 99, price: 92, gstRate: 18, unit: '500ml', isVeg: true },
      // Personal Care
      { name: 'Dove Shampoo', slug: 'dove-shampoo', catSlug: 'personal-care', mrp: 195, price: 180, gstRate: 18, unit: '180ml', isVeg: true },
      { name: 'Colgate MaxFresh', slug: 'colgate-maxfresh', catSlug: 'personal-care', mrp: 105, price: 99, gstRate: 18, unit: '150g', isVeg: true },
      // Baby Care
      { name: 'Huggies Wonder Pants', slug: 'huggies-wonder-pants', catSlug: 'baby-care', mrp: 999, price: 899, gstRate: 0, unit: 'M-32pcs', isVeg: true },
      // Meat & Fish
      { name: 'Fresh Chicken Breast', slug: 'fresh-chicken-breast', catSlug: 'meat-fish', mrp: 280, price: 260, gstRate: 0, unit: '500g', isVeg: false },
      { name: 'Farm Eggs', slug: 'farm-eggs', catSlug: 'meat-fish', mrp: 85, price: 79, gstRate: 0, unit: '12pcs', isVeg: false },
      // Bakery
      { name: 'Chocolate Truffle Cake', slug: 'chocolate-truffle-cake', catSlug: 'bakery', mrp: 450, price: 420, gstRate: 5, unit: '500g', isVeg: true },
      { name: 'Butter Cookies', slug: 'butter-cookies', catSlug: 'bakery', mrp: 120, price: 110, gstRate: 5, unit: '200g', isVeg: true },
      // Frozen Foods
      { name: 'Amul Ice Cream Vanilla', slug: 'amul-ice-cream-vanilla', catSlug: 'frozen-foods', mrp: 120, price: 110, gstRate: 18, unit: '500ml', isVeg: true },
      { name: 'McCain French Fries', slug: 'mccain-french-fries', catSlug: 'frozen-foods', mrp: 159, price: 145, gstRate: 12, unit: '600g', isVeg: true },
      // More variety
      { name: 'Onion', slug: 'onion', catSlug: 'fruits-vegetables', mrp: 35, price: 30, gstRate: 0, unit: 'kg', isVeg: true },
      { name: 'Paneer Fresh', slug: 'paneer-fresh', catSlug: 'dairy-breakfast', mrp: 120, price: 110, gstRate: 5, unit: '200g', isVeg: true },
      { name: 'Red Chilli Powder', slug: 'red-chilli-powder', catSlug: 'spices-masala', mrp: 72, price: 65, gstRate: 5, unit: '100g', isVeg: true },
    ];

    const createdProducts = [];
    for (let idx = 0; idx < productsData.length; idx++) {
      const prod = productsData[idx];
      const categoryId = `cat_${business.id}_${prod.catSlug}`;
      const productId = `prod_${business.id}_${prod.slug}`;
      const discountPercent = prod.mrp > prod.price ? Math.round(((prod.mrp - prod.price) / prod.mrp) * 100) : 0;

      // Create Product
      const product = await db.product.upsert({
        where: { id: productId },
        update: {},
        create: {
          id: productId,
          businessId: business.id,
          storeId: store.id,
          categoryId,
          name: prod.name,
          slug: prod.slug,
          description: `Premium quality ${prod.name.toLowerCase()}`,
          type: 'PHYSICAL',
          status: 'ACTIVE',
          unit: prod.unit,
          isVeg: prod.isVeg,
          isFeatured: idx < 3,
          isPopular: prod.mrp > prod.price && discountPercent >= 5,
          tags: JSON.stringify([prod.catSlug.replace(/-/g, ' ')]),
          metadata: JSON.stringify({
            gstRate: prod.gstRate,
            gstIncluded: false,
            hsnCode: '0803',
            discount: discountPercent,
          }),
        },
      });

      // Create default variant with pricing
      const variant = await db.productVariant.upsert({
        where: { id: `var_${productId}_default` },
        update: {},
        create: {
          id: `var_${productId}_default`,
          productId: product.id,
          name: 'Regular',
          price: prod.price,
          mrp: prod.mrp,
          discountPrice: prod.mrp > prod.price ? prod.price : null,
          discountPercent: discountPercent > 0 ? discountPercent : null,
          stock: Math.floor(50 + Math.random() * 200),
          minStock: 10,
          isDefault: true,
          isActive: true,
          attributes: JSON.stringify({ unit: prod.unit }),
        },
      });

      // Create inventory
      await db.inventory.upsert({
        where: { id: `inv_${productId}` },
        update: {},
        create: {
          id: `inv_${productId}`,
          businessId: business.id,
          storeId: store.id,
          productId: product.id,
          variantId: variant.id,
          quantity: variant.stock,
          minStock: 10,
          maxStock: 1000,
          status: 'IN_STOCK',
        },
      });

      createdProducts.push({ ...product, mrp: prod.mrp, sellingPrice: prod.price, gstRate: prod.gstRate, slug: prod.slug, isVeg: prod.isVeg, unit: prod.unit });
    }
    summary.products = createdProducts.length;

    // =========================================================================
    // 15. SAMPLE ORDERS (5 Orders)
    // =========================================================================
    const orderStatuses: Array<{ status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED'; paymentStatus: 'PENDING' | 'COMPLETED' }> = [
      { status: 'DELIVERED', paymentStatus: 'COMPLETED' },
      { status: 'OUT_FOR_DELIVERY', paymentStatus: 'COMPLETED' },
      { status: 'PREPARING', paymentStatus: 'COMPLETED' },
      { status: 'CONFIRMED', paymentStatus: 'PENDING' },
      { status: 'PENDING', paymentStatus: 'PENDING' },
    ];

    const orderItems = [
      [{ prodSlug: 'organic-bananas', qty: 2 }, { prodSlug: 'amul-toned-milk', qty: 3 }, { prodSlug: 'aashirvaad-atta', qty: 1 }],
      [{ prodSlug: 'fresh-tomatoes', qty: 1.5 }, { prodSlug: 'paneer-fresh', qty: 2 }, { prodSlug: 'tata-gold-tea', qty: 1 }],
      [{ prodSlug: 'india-gate-basmati', qty: 1 }, { prodSlug: 'mdh-garam-masala', qty: 1 }, { prodSlug: 'fortune-sunflower-oil', qty: 1 }],
      [{ prodSlug: 'lays-classic', qty: 4 }, { prodSlug: 'amul-ice-cream-vanilla', qty: 1 }, { prodSlug: 'nescafe-classic', qty: 1 }],
      [{ prodSlug: 'green-apples', qty: 1 }, { prodSlug: 'amul-ghee', qty: 1 }, { prodSlug: 'surf-excel-matic', qty: 1 }],
    ];

    const createdOrders = [];
    for (let i = 0; i < 5; i++) {
      const customer = createdCustomers[i];
      const oStatus = orderStatuses[i];
      const items = orderItems[i];

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;
      const orderItemsData = [];

      for (const item of items) {
        const product = createdProducts.find(p => p.slug === item.prodSlug);
        if (!product) continue;

        const itemTotal = product.sellingPrice * item.qty;
        const taxAmount = (itemTotal * product.gstRate) / 100;
        subtotal += itemTotal;
        totalTax += taxAmount;

        orderItemsData.push({
          itemType: 'grocery_product',
          itemId: product.id,
          itemName: product.name,
          quantity: item.qty,
          unitPrice: product.sellingPrice,
          mrp: product.mrp,
          discountPrice: product.mrp > product.sellingPrice ? product.sellingPrice : null,
          discountPercent: product.mrp > product.sellingPrice ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100) : null,
          totalPrice: itemTotal,
          totalMrp: product.mrp * item.qty,
          gstRate: product.gstRate,
          gstAmount: taxAmount,
          cgstAmount: taxAmount / 2,
          sgstAmount: taxAmount / 2,
          isVeg: product.isVeg,
          unit: product.unit,
        });
      }

      const deliveryFee = i < 2 ? 30 : 0;
      const totalAmount = Math.round(subtotal + totalTax + deliveryFee);
      const date = new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

      const orderNumber = `ORD-${dateStr}-${String(i + 1).padStart(3, '0')}`;
      const existingOrder = await db.order.findFirst({ where: { businessId: business.id, orderNumber } });
      if (existingOrder) {
        createdOrders.push(existingOrder);
        continue;
      }

      const order = await db.order.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          orderNumber,
          orderType: 'DELIVERY',
          orderSource: 'online',
          status: oStatus.status,
          paymentStatus: oStatus.paymentStatus,
          paymentMethod: i % 2 === 0 ? 'UPI' : 'COD',
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          deliveryAddress: JSON.stringify({
            addressLine1: `${customer.name}'s address`,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400053',
          }),
          subtotal: Math.round(subtotal),
          totalTax: Math.round(totalTax),
          deliveryFee,
          totalAmount,
          cgstAmount: Math.round(totalTax / 2),
          sgstAmount: Math.round(totalTax / 2),
          createdAt: date,
          items: {
            create: orderItemsData,
          },
        },
      });

      createdOrders.push(order);
    }
    summary.orders = createdOrders.length;

    // =========================================================================
    // RETURN SUMMARY
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: summary,
      message: 'Platform seeded successfully',
    });
  } catch (error) {
    console.error('[seed] Error:', error);
    return NextResponse.json(
      { success: false, error: `Seed failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
