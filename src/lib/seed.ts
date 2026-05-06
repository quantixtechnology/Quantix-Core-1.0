// ============================================================================
// Quantix Technology - Database Seed Function
// ============================================================================

import { db } from './db';
import { hashPassword } from './password-utils';
import type { BusinessType } from './types';

// ============================================================================
// SEED DATA
// ============================================================================

const DEMO_BUSINESSES = [
  {
    name: 'FreshMart Grocery',
    slug: 'freshmart-grocery',
    businessType: 'GROCERY' as BusinessType,
    description: 'Premium grocery delivery with fresh produce, dairy, and household essentials',
    primaryColor: '#10B981',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    address: '123 Market Street, Fort, Mumbai',
    gstNumber: '27AADCF1234A1Z5',
    contactEmail: 'info@freshmart.in',
    contactPhone: '9876543210',
    supportEmail: 'support@freshmart.in',
    supportPhone: '9876543211',
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    name: 'TastyBites Food Delivery',
    slug: 'tastybites-food',
    businessType: 'FOOD_DELIVERY' as BusinessType,
    description: 'Fast and delicious food delivery from the best restaurants in town',
    primaryColor: '#F59E0B',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    address: '456 Food Hub, MG Road, Bengaluru',
    gstNumber: '29AADCF5678B1Z3',
    contactEmail: 'hello@tastybites.in',
    contactPhone: '9876543220',
    supportEmail: 'support@tastybites.in',
    supportPhone: '9876543221',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    name: 'SparkleClean Laundry',
    slug: 'sparkleclean-laundry',
    businessType: 'LAUNDRY' as BusinessType,
    description: 'Professional laundry and dry cleaning with free pickup & delivery',
    primaryColor: '#3B82F6',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    address: '789 Clean Street, Connaught Place, New Delhi',
    gstNumber: '07AADCF9012C1Z1',
    contactEmail: 'care@sparkleclean.in',
    contactPhone: '9876543230',
    supportEmail: 'support@sparkleclean.in',
    supportPhone: '9876543231',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    name: 'AutoGlow Car Wash',
    slug: 'autoglow-carwash',
    businessType: 'CAR_WASH' as BusinessType,
    description: 'Premium car wash and detailing services with monthly subscription plans',
    primaryColor: '#8B5CF6',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    address: '321 Auto Lane, Banjara Hills, Hyderabad',
    gstNumber: '36AADCF3456D1Z9',
    contactEmail: 'info@autoglow.in',
    contactPhone: '9876543240',
    supportEmail: 'support@autoglow.in',
    supportPhone: '9876543241',
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    name: 'HomeFix Services',
    slug: 'homefix-services',
    businessType: 'HOME_SERVICES' as BusinessType,
    description: 'Trusted home cleaning, repair, and maintenance professionals at your doorstep',
    primaryColor: '#EF4444',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    address: '654 Service Road, T Nagar, Chennai',
    gstNumber: '33AADCF7890E1Z7',
    contactEmail: 'book@homefix.in',
    contactPhone: '9876543250',
    supportEmail: 'support@homefix.in',
    supportPhone: '9876543251',
    latitude: 13.0827,
    longitude: 80.2707,
  },
];

const STORE_CONFIGS: Record<string, Array<{
  name: string;
  slug: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isMainStore: boolean;
}>> = {
  GROCERY: [
    { name: 'FreshMart Main Store', slug: 'freshmart-main', code: 'FM01', address: '123 Market Street, Fort', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', isMainStore: true },
    { name: 'FreshMart Andheri', slug: 'freshmart-andheri', code: 'FM02', address: '45 SV Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', isMainStore: false },
    { name: 'FreshMart Powai', slug: 'freshmart-powai', code: 'FM03', address: '78 Hiranandani, Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', isMainStore: false },
  ],
  FOOD_DELIVERY: [
    { name: 'TastyBites Central Kitchen', slug: 'tastybites-central', code: 'TB01', address: '456 Food Hub, MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', isMainStore: true },
    { name: 'TastyBites Koramangala', slug: 'tastybites-koramangala', code: 'TB02', address: '12 5th Block, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', isMainStore: false },
  ],
  LAUNDRY: [
    { name: 'SparkleClean Main Hub', slug: 'sparkleclean-main', code: 'SC01', address: '789 Clean Street, CP', city: 'Delhi', state: 'Delhi', pincode: '110001', isMainStore: true },
    { name: 'SparkleClean South Delhi', slug: 'sparkleclean-south', code: 'SC02', address: '23 Green Park', city: 'Delhi', state: 'Delhi', pincode: '110016', isMainStore: false },
  ],
  CAR_WASH: [
    { name: 'AutoGlow Banjara Hills', slug: 'autoglow-banjara', code: 'AG01', address: '321 Auto Lane, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500001', isMainStore: true },
    { name: 'AutoGlow Hi-Tech City', slug: 'autoglow-hitech', code: 'AG02', address: '56 Cyber Towers, Hi-Tech City', city: 'Hyderabad', state: 'Telangana', pincode: '500081', isMainStore: false },
  ],
  HOME_SERVICES: [
    { name: 'HomeFix Chennai HQ', slug: 'homefix-chennai-hq', code: 'HF01', address: '654 Service Road, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', isMainStore: true },
  ],
};

const PRODUCT_CONFIGS: Record<string, Array<{
  name: string;
  slug: string;
  description: string;
  type: string;
  unit: string;
  isVeg: boolean | null;
  isFeatured: boolean;
  variants: Array<{
    name: string;
    price: number;
    mrp: number;
    isDefault: boolean;
  }>;
}>> = {
  GROCERY: [
    { name: 'Organic Basmati Rice', slug: 'organic-basmati-rice', description: 'Premium long-grain organic basmati rice from the foothills of Himalayas', type: 'PHYSICAL', unit: 'kg', isVeg: true, isFeatured: true, variants: [{ name: '1 kg', price: 180, mrp: 220, isDefault: true }, { name: '5 kg', price: 850, mrp: 1100, isDefault: false }] },
    { name: 'Fresh Amul Butter', slug: 'fresh-amul-butter', description: '100% pure pasteurized butter', type: 'PHYSICAL', unit: 'pack', isVeg: true, isFeatured: true, variants: [{ name: '100g', price: 52, mrp: 56, isDefault: true }, { name: '500g', price: 255, mrp: 280, isDefault: false }] },
    { name: 'Farm Fresh Eggs', slug: 'farm-fresh-eggs', description: 'Free-range farm fresh eggs', type: 'PHYSICAL', unit: 'dozen', isVeg: false, isFeatured: false, variants: [{ name: '6 pcs', price: 60, mrp: 72, isDefault: true }, { name: '12 pcs', price: 115, mrp: 140, isDefault: false }] },
    { name: 'Toor Dal', slug: 'toor-dal', description: 'Premium quality toor dal for daily cooking', type: 'PHYSICAL', unit: 'kg', isVeg: true, isFeatured: false, variants: [{ name: '1 kg', price: 140, mrp: 165, isDefault: true }, { name: '2 kg', price: 270, mrp: 330, isDefault: false }] },
    { name: 'Organic Wheat Flour', slug: 'organic-wheat-flour', description: 'Stone-ground organic wheat atta', type: 'PHYSICAL', unit: 'kg', isVeg: true, isFeatured: true, variants: [{ name: '5 kg', price: 350, mrp: 420, isDefault: true }, { name: '10 kg', price: 670, mrp: 820, isDefault: false }] },
    { name: 'Amul Toned Milk', slug: 'amul-toned-milk', description: 'Fresh toned milk daily delivery', type: 'PHYSICAL', unit: 'ltr', isVeg: true, isFeatured: false, variants: [{ name: '500 ml', price: 28, mrp: 30, isDefault: true }, { name: '1 Ltr', price: 54, mrp: 58, isDefault: false }] },
  ],
  FOOD_DELIVERY: [
    { name: 'Butter Chicken', slug: 'butter-chicken', description: 'Creamy tomato-based chicken curry', type: 'PHYSICAL', unit: 'piece', isVeg: false, isFeatured: true, variants: [{ name: 'Regular', price: 280, mrp: 320, isDefault: true }, { name: 'Large', price: 420, mrp: 480, isDefault: false }] },
    { name: 'Paneer Tikka Masala', slug: 'paneer-tikka-masala', description: 'Grilled paneer in rich masala gravy', type: 'PHYSICAL', unit: 'piece', isVeg: true, isFeatured: true, variants: [{ name: 'Regular', price: 240, mrp: 280, isDefault: true }, { name: 'Large', price: 360, mrp: 420, isDefault: false }] },
    { name: 'Hyderabadi Biryani', slug: 'hyderabadi-biryani', description: 'Aromatic layered biryani with saffron', type: 'PHYSICAL', unit: 'piece', isVeg: false, isFeatured: true, variants: [{ name: 'Single', price: 220, mrp: 260, isDefault: true }, { name: 'Family Pack', price: 550, mrp: 650, isDefault: false }] },
    { name: 'Garlic Naan', slug: 'garlic-naan', description: 'Soft tandoori bread with garlic butter', type: 'PHYSICAL', unit: 'piece', isVeg: true, isFeatured: false, variants: [{ name: '2 Pcs', price: 60, mrp: 70, isDefault: true }, { name: '4 Pcs', price: 110, mrp: 130, isDefault: false }] },
    { name: 'Masala Dosa', slug: 'masala-dosa', description: 'Crispy dosa with spiced potato filling', type: 'PHYSICAL', unit: 'piece', isVeg: true, isFeatured: false, variants: [{ name: 'Regular', price: 120, mrp: 140, isDefault: true }, { name: 'Mysore Masala', price: 150, mrp: 170, isDefault: false }] },
  ],
  LAUNDRY: [
    { name: 'Wash & Fold', slug: 'wash-fold', description: 'Machine wash and fold service for everyday clothes', type: 'SERVICE', unit: 'kg', isVeg: null, isFeatured: true, variants: [{ name: 'Per Kg', price: 49, mrp: 59, isDefault: true }, { name: '10 Kg Pack', price: 399, mrp: 590, isDefault: false }] },
    { name: 'Dry Cleaning', slug: 'dry-cleaning', description: 'Professional dry cleaning for delicate garments', type: 'SERVICE', unit: 'piece', isVeg: null, isFeatured: true, variants: [{ name: 'Shirt/Saree', price: 99, mrp: 129, isDefault: true }, { name: 'Suit/Blazer', price: 249, mrp: 299, isDefault: false }] },
    { name: 'Iron Service', slug: 'iron-service', description: 'Professional pressing and ironing', type: 'SERVICE', unit: 'piece', isVeg: null, isFeatured: false, variants: [{ name: 'Per Piece', price: 15, mrp: 20, isDefault: true }, { name: '10 Pieces', price: 120, mrp: 200, isDefault: false }] },
  ],
  CAR_WASH: [
    { name: 'Basic Car Wash', slug: 'basic-car-wash', description: 'Exterior wash with soap and water rinse', type: 'SERVICE', unit: 'service', isVeg: null, isFeatured: false, variants: [{ name: 'Hatchback', price: 299, mrp: 399, isDefault: true }, { name: 'Sedan', price: 399, mrp: 499, isDefault: false }, { name: 'SUV', price: 499, mrp: 599, isDefault: false }] },
    { name: 'Premium Detailing', slug: 'premium-detailing', description: 'Complete interior and exterior detailing with wax coating', type: 'SERVICE', unit: 'service', isVeg: null, isFeatured: true, variants: [{ name: 'Hatchback', price: 1499, mrp: 1999, isDefault: true }, { name: 'Sedan', price: 1999, mrp: 2499, isDefault: false }, { name: 'SUV', price: 2499, mrp: 2999, isDefault: false }] },
    { name: 'Interior Deep Clean', slug: 'interior-deep-clean', description: 'Thorough interior vacuuming, shampooing and sanitization', type: 'SERVICE', unit: 'service', isVeg: null, isFeatured: true, variants: [{ name: 'Standard', price: 999, mrp: 1299, isDefault: true }, { name: 'Premium', price: 1499, mrp: 1899, isDefault: false }] },
  ],
  HOME_SERVICES: [
    { name: 'Deep Home Cleaning', slug: 'deep-home-cleaning', description: 'Complete deep cleaning of your home', type: 'SERVICE', unit: 'service', isVeg: null, isFeatured: true, variants: [{ name: '1 BHK', price: 1499, mrp: 1999, isDefault: true }, { name: '2 BHK', price: 1999, mrp: 2599, isDefault: false }, { name: '3 BHK', price: 2499, mrp: 3199, isDefault: false }] },
    { name: 'AC Service & Repair', slug: 'ac-service-repair', description: 'Professional AC servicing and repair', type: 'SERVICE', unit: 'service', isVeg: null, isFeatured: true, variants: [{ name: 'Regular Service', price: 499, mrp: 699, isDefault: true }, { name: 'Deep Clean', price: 799, mrp: 999, isDefault: false }] },
    { name: 'Plumbing Service', slug: 'plumbing-service', description: 'Expert plumbing repairs and installations', type: 'SERVICE', unit: 'hour', isVeg: null, isFeatured: false, variants: [{ name: 'Per Hour', price: 399, mrp: 499, isDefault: true }] },
    { name: 'Electrical Work', slug: 'electrical-work', description: 'Certified electrician for all electrical needs', type: 'SERVICE', unit: 'hour', isVeg: null, isFeatured: false, variants: [{ name: 'Per Hour', price: 449, mrp: 599, isDefault: true }] },
  ],
};

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
      name: 'Quantix Technology',
      supportEmail: 'support@quantix.in',
      supportPhone: '18001234567',
      defaultCurrency: 'INR',
      defaultLocale: 'en-IN',
      version: '1.0.0',
    },
  });
  console.log('  ✅ Platform created\n');

  // 2. Create Super Admin User
  console.log('👤 Creating super admin user...');
  const superAdminPassword = await hashPassword('Admin@123');
  const superAdmin = await db.user.upsert({
    where: { email: 'admin@quantix.in' },
    update: {},
    create: {
      email: 'admin@quantix.in',
      name: 'Platform Admin',
      passwordHash: superAdminPassword,
      authProvider: 'EMAIL',
      emailVerified: true,
      isActive: true,
    },
  });
  console.log('  ✅ Super admin created\n');

  // 3. Create Demo Businesses
  console.log('🏢 Creating demo businesses...');
  const businessRecords = [];

  for (const bizData of DEMO_BUSINESSES) {
    const business = await db.business.upsert({
      where: { slug: bizData.slug },
      update: {},
      create: {
        platformId: platform.id,
        name: bizData.name,
        slug: bizData.slug,
        businessType: bizData.businessType,
        status: 'ACTIVE',
        description: bizData.description,
        primaryColor: bizData.primaryColor,
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
        settings: JSON.stringify({
          enableDelivery: true,
          enablePickup: true,
          enablePOS: true,
          enableSubscriptions: true,
          orderPrefix: 'ORD',
          invoicePrefix: 'INV',
        }),
        features: JSON.stringify({
          multiStore: true,
          pos: true,
          delivery: true,
          subscriptions: true,
          loyaltyPoints: true,
          promoCodes: true,
        }),
      },
    });
    businessRecords.push({ ...business, businessType: bizData.businessType });
    console.log(`  ✅ ${bizData.name}`);
  }
  console.log('');

  // 4. Create Business Owners
  console.log('👤 Creating business owners...');
  const ownerPassword = await hashPassword('Owner@123');
  const ownerRecords = [];

  for (let i = 0; i < businessRecords.length; i++) {
    const biz = businessRecords[i];
    const ownerEmail = `owner@${biz.slug}.in`;
    const owner = await db.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        name: `${biz.name} Owner`,
        passwordHash: ownerPassword,
        authProvider: 'EMAIL',
        emailVerified: true,
        isActive: true,
      },
    });

    await db.businessUser.upsert({
      where: { userId_businessId: { userId: owner.id, businessId: biz.id } },
      update: {},
      create: {
        userId: owner.id,
        businessId: biz.id,
        role: 'BUSINESS_OWNER',
        isActive: true,
        acceptedAt: new Date(),
      },
    });

    ownerRecords.push(owner);
    console.log(`  ✅ Owner for ${biz.name}`);
  }
  console.log('');

  // 5. Create Staff Users
  console.log('👥 Creating staff users...');
  const staffPassword = await hashPassword('Staff@123');

  for (const biz of businessRecords) {
    // Store Manager
    const managerEmail = `manager@${biz.slug}.in`;
    const manager = await db.user.upsert({
      where: { email: managerEmail },
      update: {},
      create: {
        email: managerEmail,
        name: `Manager - ${biz.name}`,
        passwordHash: staffPassword,
        authProvider: 'EMAIL',
        emailVerified: true,
        isActive: true,
      },
    });

    await db.businessUser.upsert({
      where: { userId_businessId: { userId: manager.id, businessId: biz.id } },
      update: {},
      create: {
        userId: manager.id,
        businessId: biz.id,
        role: 'STORE_MANAGER',
        isActive: true,
        acceptedAt: new Date(),
      },
    });
    console.log(`  ✅ Manager for ${biz.name}`);

    // Cashier
    const cashierEmail = `cashier@${biz.slug}.in`;
    const cashier = await db.user.upsert({
      where: { email: cashierEmail },
      update: {},
      create: {
        email: cashierEmail,
        name: `Cashier - ${biz.name}`,
        passwordHash: staffPassword,
        authProvider: 'EMAIL',
        emailVerified: true,
        isActive: true,
      },
    });

    await db.businessUser.upsert({
      where: { userId_businessId: { userId: cashier.id, businessId: biz.id } },
      update: {},
      create: {
        userId: cashier.id,
        businessId: biz.id,
        role: 'CASHIER',
        isActive: true,
        acceptedAt: new Date(),
      },
    });
    console.log(`  ✅ Cashier for ${biz.name}`);
  }
  console.log('');

  // 6. Create Demo Customers
  console.log('👥 Creating demo customers...');
  const customerPassword = await hashPassword('Customer@123');
  const sampleCustomers = [
    { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9812345678' },
    { name: 'Priya Patel', email: 'priya@example.com', phone: '9823456789' },
    { name: 'Amit Kumar', email: 'amit@example.com', phone: '9834567890' },
    { name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9845678901' },
    { name: 'Vikram Singh', email: 'vikram@example.com', phone: '9856789012' },
  ];

  for (const biz of businessRecords) {
    for (const custData of sampleCustomers) {
      const user = await db.user.upsert({
        where: { email: custData.email },
        update: {},
        create: {
          email: custData.email,
          name: custData.name,
          phone: custData.phone,
          passwordHash: customerPassword,
          authProvider: 'EMAIL',
          emailVerified: true,
          isActive: true,
        },
      });

      await db.customer.upsert({
        where: { businessId_phone: { businessId: biz.id, phone: custData.phone } },
        update: {},
        create: {
          businessId: biz.id,
          userId: user.id,
          name: custData.name,
          email: custData.email,
          phone: custData.phone,
          isActive: true,
        },
      });
    }
    console.log(`  ✅ Customers for ${biz.name}`);
  }
  console.log('');

  // 7. Create Stores
  console.log('🏪 Creating demo stores...');
  const storeRecords: Array<{ id: string; businessId: string; businessType: string }> = [];

  for (const biz of businessRecords) {
    const storeConfigs = STORE_CONFIGS[biz.businessType] || [];
    for (const storeData of storeConfigs) {
      const store = await db.store.upsert({
        where: {
          businessId_slug: { businessId: biz.id, slug: storeData.slug },
        },
        update: {},
        create: {
          businessId: biz.id,
          name: storeData.name,
          slug: storeData.slug,
          code: storeData.code,
          address: storeData.address,
          city: storeData.city,
          state: storeData.state,
          pincode: storeData.pincode,
          country: 'India',
          isMainStore: storeData.isMainStore,
          deliveryRadius: 5.0,
          minOrderAmount: 0,
          deliveryFee: 30,
          freeDeliveryAbove: 500,
          preparationTime: 30,
          posEnabled: true,
          status: 'ACTIVE',
        },
      });
      storeRecords.push({ id: store.id, businessId: biz.id, businessType: biz.businessType });
      console.log(`  ✅ ${storeData.name}`);
    }
  }
  console.log('');

  // 8. Create Store Timings
  console.log('🕐 Creating store timings...');
  for (const store of storeRecords) {
    const days = [0, 1, 2, 3, 4, 5, 6];
    for (const day of days) {
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
    console.log(`  ✅ Timings for store ${store.id.slice(-6)}`);
  }
  console.log('');

  // 9. Create Categories and Products
  console.log('📦 Creating categories and products...');

  const categoryConfigs: Record<string, Array<{ name: string; slug: string }>> = {
    GROCERY: [
      { name: 'Rice & Grains', slug: 'rice-grains' },
      { name: 'Dairy & Eggs', slug: 'dairy-eggs' },
      { name: 'Pulses & Lentils', slug: 'pulses-lentils' },
      { name: 'Flour & Atta', slug: 'flour-atta' },
      { name: 'Beverages', slug: 'beverages' },
    ],
    FOOD_DELIVERY: [
      { name: 'North Indian', slug: 'north-indian' },
      { name: 'South Indian', slug: 'south-indian' },
      { name: 'Biryani', slug: 'biryani' },
      { name: 'Breads', slug: 'breads' },
      { name: 'Desserts', slug: 'desserts' },
    ],
    LAUNDRY: [
      { name: 'Wash & Fold', slug: 'wash-fold' },
      { name: 'Dry Cleaning', slug: 'dry-cleaning' },
      { name: 'Ironing', slug: 'ironing' },
    ],
    CAR_WASH: [
      { name: 'Car Wash', slug: 'car-wash' },
      { name: 'Detailing', slug: 'detailing' },
      { name: 'Interior Clean', slug: 'interior-clean' },
    ],
    HOME_SERVICES: [
      { name: 'Cleaning', slug: 'cleaning' },
      { name: 'Appliance Repair', slug: 'appliance-repair' },
      { name: 'Plumbing', slug: 'plumbing' },
      { name: 'Electrical', slug: 'electrical' },
    ],
  };

  for (const biz of businessRecords) {
    const categories = categoryConfigs[biz.businessType] || [];
    const categoryRecords: Array<{ id: string; name: string }> = [];

    for (const catData of categories) {
      const category = await db.category.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: catData.slug } },
        update: {},
        create: {
          businessId: biz.id,
          name: catData.name,
          slug: catData.slug,
          isActive: true,
        },
      });
      categoryRecords.push({ id: category.id, name: catData.name });
    }
    console.log(`  ✅ Categories for ${biz.name}`);

    // Create products
    const productConfigs = PRODUCT_CONFIGS[biz.businessType] || [];
    const mainStore = storeRecords.find((s) => s.businessId === biz.id);

    for (const prodData of productConfigs) {
      const matchingCategory = categoryRecords.find((c) => {
        const catData = categoryConfigs[biz.businessType] || [];
        return catData.some((cc) => cc.name === c.name);
      });

      const product = await db.product.upsert({
        where: { businessId_slug: { businessId: biz.id, slug: prodData.slug } },
        update: {},
        create: {
          businessId: biz.id,
          categoryId: matchingCategory?.id || null,
          name: prodData.name,
          slug: prodData.slug,
          description: prodData.description,
          type: prodData.type as 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION',
          status: 'ACTIVE',
          unit: prodData.unit,
          isVeg: prodData.isVeg,
          isFeatured: prodData.isFeatured,
          isPopular: prodData.isFeatured,
          minOrderQty: 1,
          maxOrderQty: 100,
          images: JSON.stringify([]),
          tags: JSON.stringify([]),
          metadata: JSON.stringify({}),
        },
      });

      // Create variants
      for (const variantData of prodData.variants) {
        await db.productVariant.upsert({
          where: {
            productId_name: { productId: product.id, name: variantData.name },
          },
          update: {},
          create: {
            productId: product.id,
            name: variantData.name,
            price: variantData.price,
            mrp: variantData.mrp,
            discountPrice: variantData.price < variantData.mrp ? variantData.price : null,
            discountPercent: variantData.price < variantData.mrp
              ? Math.round(((variantData.mrp - variantData.price) / variantData.mrp) * 100)
              : null,
            isDefault: variantData.isDefault,
            isActive: true,
            attributes: JSON.stringify({}),
          },
        });
      }

      // Create inventory for main store
      if (mainStore) {
        const defaultVariant = prodData.variants.find((v) => v.isDefault);
        if (defaultVariant) {
          const variant = await db.productVariant.findFirst({
            where: { productId: product.id, isDefault: true },
          });
          if (variant) {
            await db.inventory.upsert({
              where: {
                storeId_productId_variantId: {
                  storeId: mainStore.id,
                  productId: product.id,
                  variantId: variant.id,
                },
              },
              update: {},
              create: {
                businessId: biz.id,
                storeId: mainStore.id,
                productId: product.id,
                variantId: variant.id,
                quantity: 100,
                minStock: 10,
                maxStock: 500,
                status: 'IN_STOCK',
              },
            });
          }
        }
      }
    }
    console.log(`  ✅ Products for ${biz.name}`);
  }
  console.log('');

  // 10. Create Tax Configs for Indian GST
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
          isDefault: taxData.isDefault,
        },
      });
    }
    console.log(`  ✅ Tax configs for ${biz.name}`);
  }
  console.log('');

  // 11. Create Delivery Zones
  console.log('🚚 Creating delivery zones...');
  for (const biz of businessRecords) {
    const mainStore = storeRecords.find((s) => s.businessId === biz.id);

    // Zone 1: 3km radius
    await db.deliveryZone.create({
      data: {
        businessId: biz.id,
        storeId: mainStore?.id,
        name: 'Zone 1 - Near (3km)',
        zoneType: 'CIRCLE',
        centerLat: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.latitude || 0,
        centerLng: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.longitude || 0,
        radius: 3,
        deliveryFee: 20,
        minOrderAmount: 100,
        freeDeliveryAbove: 300,
        estimatedTime: 25,
        isActive: true,
      },
    });

    // Zone 2: 5km radius
    await db.deliveryZone.create({
      data: {
        businessId: biz.id,
        storeId: mainStore?.id,
        name: 'Zone 2 - Standard (5km)',
        zoneType: 'CIRCLE',
        centerLat: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.latitude || 0,
        centerLng: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.longitude || 0,
        radius: 5,
        deliveryFee: 35,
        minOrderAmount: 150,
        freeDeliveryAbove: 500,
        estimatedTime: 40,
        isActive: true,
      },
    });

    // Zone 3: 8km radius
    await db.deliveryZone.create({
      data: {
        businessId: biz.id,
        storeId: mainStore?.id,
        name: 'Zone 3 - Extended (8km)',
        zoneType: 'CIRCLE',
        centerLat: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.latitude || 0,
        centerLng: DEMO_BUSINESSES.find((b) => b.slug === biz.slug)?.longitude || 0,
        radius: 8,
        deliveryFee: 50,
        minOrderAmount: 250,
        freeDeliveryAbove: 750,
        estimatedTime: 60,
        isActive: true,
      },
    });

    console.log(`  ✅ Delivery zones for ${biz.name}`);
  }
  console.log('');

  // 12. Create Subscription Plans
  console.log('📋 Creating subscription plans...');
  const subscriptionPlanConfigs: Record<string, Array<{
    name: string;
    slug: string;
    type: string;
    billingCycle: string;
    price: number;
    originalPrice: number;
    totalCredits: number;
    creditLabel: string;
    features: string[];
  }>> = {
    CAR_WASH: [
      { name: 'Basic Wash Plan', slug: 'basic-wash-plan', type: 'CAR_WASH', billingCycle: 'MONTHLY', price: 999, originalPrice: 1499, totalCredits: 4, creditLabel: 'washes', features: ['4 Basic washes/month', 'Exterior wash only', 'Valid for hatchback & sedan'] },
      { name: 'Premium Shine Plan', slug: 'premium-shine-plan', type: 'CAR_WASH', billingCycle: 'MONTHLY', price: 1999, originalPrice: 2999, totalCredits: 8, creditLabel: 'washes', features: ['8 Premium washes/month', 'Interior + Exterior', 'Wax coating included', 'Valid for all car types'] },
      { name: 'Annual Detail Plan', slug: 'annual-detail-plan', type: 'CAR_WASH', billingCycle: 'YEARLY', price: 7999, originalPrice: 14999, totalCredits: 12, creditLabel: 'detailing sessions', features: ['12 Detailing sessions/year', 'Full interior + exterior', 'Ceramic coating', 'Priority booking'] },
    ],
    HOME_SERVICES: [
      { name: 'Weekly Clean Plan', slug: 'weekly-clean-plan', type: 'HOME_SERVICE', billingCycle: 'WEEKLY', price: 499, originalPrice: 699, totalCredits: 1, creditLabel: 'cleaning sessions', features: ['1 Deep cleaning/week', '1 BHK coverage', 'Eco-friendly products'] },
      { name: 'Monthly Maintenance', slug: 'monthly-maintenance', type: 'HOME_SERVICE', billingCycle: 'MONTHLY', price: 1999, originalPrice: 2999, totalCredits: 4, creditLabel: 'service sessions', features: ['4 Service sessions/month', 'Any service type', 'Up to 2 BHK', 'Priority support'] },
    ],
    LAUNDRY: [
      { name: 'Weekly Laundry Pack', slug: 'weekly-laundry-pack', type: 'LAUNDRY', billingCycle: 'WEEKLY', price: 399, originalPrice: 599, totalCredits: 10, creditLabel: 'kg laundry', features: ['10 kg wash & fold/week', 'Free pickup & delivery', '48hr turnaround'] },
      { name: 'Monthly Laundry Plan', slug: 'monthly-laundry-plan', type: 'LAUNDRY', billingCycle: 'MONTHLY', price: 1299, originalPrice: 1999, totalCredits: 40, creditLabel: 'kg laundry', features: ['40 kg wash & fold/month', 'Free pickup & delivery', 'Express 24hr option', 'Dry cleaning discount'] },
    ],
    GROCERY: [
      { name: 'Weekly Essentials', slug: 'weekly-essentials', type: 'GROCERY', billingCycle: 'WEEKLY', price: 999, originalPrice: 1199, totalCredits: 1, creditLabel: 'delivery', features: ['Free weekly delivery', '₹999 value basket', '5% extra discount', 'Priority time slots'] },
    ],
  };

  for (const biz of businessRecords) {
    const planConfigs = subscriptionPlanConfigs[biz.businessType] || [];
    for (const planData of planConfigs) {
      await db.subscriptionPlan.create({
        data: {
          businessId: biz.id,
          name: planData.name,
          slug: planData.slug,
          type: planData.type as 'CAR_WASH' | 'HOME_SERVICE' | 'LAUNDRY' | 'GROCERY' | 'CUSTOM',
          billingCycle: planData.billingCycle as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY',
          price: planData.price,
          originalPrice: planData.originalPrice,
          totalCredits: planData.totalCredits,
          creditLabel: planData.creditLabel,
          features: JSON.stringify(planData.features),
          isFeatured: planData.originalPrice > planData.price,
          isActive: true,
        },
      });
    }
    console.log(`  ✅ Subscription plans for ${biz.name}`);
  }
  console.log('');

  // 13. Create Delivery Partners
  console.log('🛵 Creating delivery partners...');
  const deliveryPartnerData = [
    { name: 'Raju Kumar', phone: '9901234567', vehicleType: 'bike', vehicleNumber: 'MH01AB1234' },
    { name: 'Suresh Yadav', phone: '9902345678', vehicleType: 'bike', vehicleNumber: 'MH02CD5678' },
    { name: 'Mahesh Patil', phone: '9903456789', vehicleType: 'bicycle', vehicleNumber: '' },
  ];

  for (const biz of businessRecords) {
    if (biz.businessType === 'CAR_WASH') continue; // Car wash doesn't need delivery partners typically

    for (const dpData of deliveryPartnerData) {
      await db.deliveryPartner.upsert({
        where: { businessId_phone: { businessId: biz.id, phone: dpData.phone } },
        update: {},
        create: {
          businessId: biz.id,
          name: dpData.name,
          phone: dpData.phone,
          vehicleType: dpData.vehicleType,
          vehicleNumber: dpData.vehicleNumber || null,
          isOnline: false,
          isActive: true,
        },
      });
    }
    console.log(`  ✅ Delivery partners for ${biz.name}`);
  }
  console.log('');

  // 14. Create Payment Gateway configs
  console.log('💳 Creating payment gateway configs...');
  for (const biz of businessRecords) {
    // Cash (always available)
    await db.paymentGateway.create({
      data: {
        businessId: biz.id,
        name: 'Cash',
        type: 'cash',
        isActive: true,
        isDefault: true,
        config: JSON.stringify({}),
      },
    });

    // UPI
    await db.paymentGateway.create({
      data: {
        businessId: biz.id,
        name: 'UPI',
        type: 'upi',
        isActive: true,
        isDefault: false,
        config: JSON.stringify({ provider: 'razorpay' }),
      },
    });

    // Card
    await db.paymentGateway.create({
      data: {
        businessId: biz.id,
        name: 'Card Payment',
        type: 'card',
        isActive: true,
        isDefault: false,
        config: JSON.stringify({ provider: 'razorpay' }),
      },
    });

    console.log(`  ✅ Payment gateways for ${biz.name}`);
  }
  console.log('');

  console.log('🎉 Seed completed successfully!\n');
  console.log('📋 Demo Credentials:');
  console.log('  Super Admin:    admin@quantix.in / Admin@123');
  console.log('  Business Owner: owner@{business-slug}.in / Owner@123');
  console.log('  Store Manager:  manager@{business-slug}.in / Staff@123');
  console.log('  Cashier:        cashier@{business-slug}.in / Staff@123');
  console.log('  Customer:       rahul@example.com / Customer@123');
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
