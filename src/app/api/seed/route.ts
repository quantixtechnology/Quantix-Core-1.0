import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

export async function POST() {
  try {
    // Check if already seeded
    const existingPlatform = await db.platform.findFirst();
    if (existingPlatform) {
      return NextResponse.json({ success: false, error: 'Database already seeded. Reset first.' }, { status: 409 });
    }

    // 1. Create Platform
    const platform = await db.platform.create({
      data: {
        id: 'platform_1',
        name: 'Quantix Platform',
        supportEmail: 'support@quantix.tech',
        supportPhone: '+91 98765 43210',
        defaultCurrency: 'INR',
        defaultLocale: 'en-IN',
      },
    });

    // 2. Create Super Admin User
    const superAdminPassword = await hashPassword('admin123');
    const superAdmin = await db.user.create({
      data: {
        email: 'admin@quantix.tech',
        name: 'Super Admin',
        phone: '+91 98765 43210',
        passwordHash: superAdminPassword,
        authProvider: 'EMAIL',
        emailVerified: true,
        isActive: true,
      },
    });

    // 3. Create Business Users
    const ownerPassword = await hashPassword('owner123');
    const staffPassword = await hashPassword('staff123');

    const groceryOwner = await db.user.create({
      data: { email: 'grocery@quantix.tech', name: 'Rajesh Kumar', phone: '+91 99887 76655', passwordHash: ownerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const foodOwner = await db.user.create({
      data: { email: 'food@quantix.tech', name: 'Priya Sharma', phone: '+91 98877 66554', passwordHash: ownerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const laundryOwner = await db.user.create({
      data: { email: 'laundry@quantix.tech', name: 'Amit Patel', phone: '+91 97766 55443', passwordHash: ownerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const carwashOwner = await db.user.create({
      data: { email: 'carwash@quantix.tech', name: 'Vikram Singh', phone: '+91 96655 44332', passwordHash: ownerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const homeServiceOwner = await db.user.create({
      data: { email: 'homeservice@quantix.tech', name: 'Deepa Nair', phone: '+91 95544 33221', passwordHash: ownerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const customerPassword = await hashPassword('customer123');
    const customerUser = await db.user.create({
      data: { email: 'customer@demo.com', name: 'Ananya Gupta', phone: '+91 91234 56789', passwordHash: customerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const customerUser2 = await db.user.create({
      data: { email: 'rahul@demo.com', name: 'Rahul Verma', phone: '+91 92345 67890', passwordHash: customerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const customerUser3 = await db.user.create({
      data: { email: 'sneha@demo.com', name: 'Sneha Iyer', phone: '+91 93456 78901', passwordHash: customerPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const deliveryPassword = await hashPassword('delivery123');
    const deliveryUser1 = await db.user.create({
      data: { email: 'driver1@demo.com', name: 'Suresh Yadav', phone: '+91 94567 89012', passwordHash: deliveryPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    const deliveryUser2 = await db.user.create({
      data: { email: 'driver2@demo.com', name: 'Mohan Das', phone: '+91 95678 90123', passwordHash: deliveryPassword, authProvider: 'EMAIL', emailVerified: true, isActive: true },
    });

    // 4. Create Businesses
    const groceryBusiness = await db.business.create({
      data: {
        platformId: platform.id, name: 'FreshMart Grocery', slug: 'freshmart', businessType: 'GROCERY', status: 'ACTIVE',
        primaryColor: '#10B981', secondaryColor: '#059669', domain: 'freshmart.quantix.tech',
        description: 'Premium online grocery store with fresh produce, dairy, and household essentials.',
        gstNumber: '27AADCF1234A1Z5', panNumber: 'AADCF1234A',
        address: '42 MG Road, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', country: 'India',
        latitude: 12.9352, longitude: 77.6245,
        contactEmail: 'info@freshmart.quantix.tech', contactPhone: '+91 80 1234 5678',
        supportEmail: 'support@freshmart.quantix.tech', supportPhone: '+91 80 8765 4321',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const foodBusiness = await db.business.create({
      data: {
        platformId: platform.id, name: 'SpiceKitchen', slug: 'spicekitchen', businessType: 'FOOD_DELIVERY', status: 'ACTIVE',
        primaryColor: '#F59E0B', secondaryColor: '#D97706', domain: 'spicekitchen.quantix.tech',
        description: 'Authentic Indian cuisine delivered to your doorstep. From biryanis to butter chicken.',
        gstNumber: '27AABCS5678B2Z3', panNumber: 'AABCS5678B',
        address: '15 Park Street, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', country: 'India',
        latitude: 19.0596, longitude: 72.8295,
        contactEmail: 'info@spicekitchen.quantix.tech', contactPhone: '+91 22 2345 6789',
        supportEmail: 'support@spicekitchen.quantix.tech',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const laundryBusiness = await db.business.create({
      data: {
        platformId: platform.id, name: 'QuickClean Laundry', slug: 'quickclean', businessType: 'LAUNDRY', status: 'ACTIVE',
        primaryColor: '#3B82F6', secondaryColor: '#2563EB', domain: 'quickclean.quantix.tech',
        description: 'Professional laundry and dry cleaning services with express delivery.',
        gstNumber: '27AABCQ9012C3Z1', panNumber: 'AABCQ9012C',
        address: '78 Civil Lines', city: 'Delhi', state: 'Delhi', pincode: '110054', country: 'India',
        latitude: 28.6862, longitude: 77.2218,
        contactEmail: 'info@quickclean.quantix.tech', contactPhone: '+91 11 3456 7890',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const carwashBusiness = await db.business.create({
      data: {
        platformId: platform.id, name: 'SparkleWash', slug: 'sparklewash', businessType: 'CAR_WASH', status: 'ACTIVE',
        primaryColor: '#8B5CF6', secondaryColor: '#7C3AED', domain: 'sparklewash.quantix.tech',
        description: 'Premium car wash and detailing services with monthly subscription plans.',
        gstNumber: '27AABCS3456D4Z2', panNumber: 'AABCS3456D',
        address: '25 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033', country: 'India',
        latitude: 17.4326, longitude: 78.4071,
        contactEmail: 'info@sparklewash.quantix.tech', contactPhone: '+91 40 4567 8901',
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const homeServiceBusiness = await db.business.create({
      data: {
        platformId: platform.id, name: 'HomeFixPro', slug: 'homefixpro', businessType: 'HOME_SERVICES', status: 'TRIAL',
        primaryColor: '#EC4899', secondaryColor: '#DB2777', domain: 'homefixpro.quantix.tech',
        description: 'Expert home cleaning, plumbing, electrical, and maintenance services.',
        gstNumber: '27AABCH7890E5Z3', panNumber: 'AABCH7890E',
        address: '100 Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', country: 'India',
        latitude: 13.0827, longitude: 80.2707,
        contactEmail: 'info@homefixpro.quantix.tech', contactPhone: '+91 44 5678 9012',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // 5. Create Business Users
    await db.businessUser.createMany({
      data: [
        { userId: superAdmin.id, businessId: groceryBusiness.id, role: 'SUPER_ADMIN', acceptedAt: new Date() },
        { userId: superAdmin.id, businessId: foodBusiness.id, role: 'SUPER_ADMIN', acceptedAt: new Date() },
        { userId: superAdmin.id, businessId: laundryBusiness.id, role: 'SUPER_ADMIN', acceptedAt: new Date() },
        { userId: superAdmin.id, businessId: carwashBusiness.id, role: 'SUPER_ADMIN', acceptedAt: new Date() },
        { userId: superAdmin.id, businessId: homeServiceBusiness.id, role: 'SUPER_ADMIN', acceptedAt: new Date() },
        { userId: groceryOwner.id, businessId: groceryBusiness.id, role: 'BUSINESS_OWNER', acceptedAt: new Date() },
        { userId: foodOwner.id, businessId: foodBusiness.id, role: 'BUSINESS_OWNER', acceptedAt: new Date() },
        { userId: laundryOwner.id, businessId: laundryBusiness.id, role: 'BUSINESS_OWNER', acceptedAt: new Date() },
        { userId: carwashOwner.id, businessId: carwashBusiness.id, role: 'BUSINESS_OWNER', acceptedAt: new Date() },
        { userId: homeServiceOwner.id, businessId: homeServiceBusiness.id, role: 'BUSINESS_OWNER', acceptedAt: new Date() },
      ],
    });

    // 6. Create Stores
    const groceryStore1 = await db.store.create({
      data: { businessId: groceryBusiness.id, name: 'FreshMart Koramangala', slug: 'freshmart-koramangala', code: 'FM-KRM', address: '42 MG Road, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', phone: '+91 80 1234 5678', email: 'koramangala@freshmart.quantix.tech', isMainStore: true, deliveryRadius: 7, minOrderAmount: 200, deliveryFee: 30, freeDeliveryAbove: 500, preparationTime: 20, posEnabled: true, status: 'ACTIVE' },
    });

    const groceryStore2 = await db.store.create({
      data: { businessId: groceryBusiness.id, name: 'FreshMart Indiranagar', slug: 'freshmart-indiranagar', code: 'FM-IND', address: '88 100 Feet Road, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', phone: '+91 80 2345 6789', email: 'indiranagar@freshmart.quantix.tech', isMainStore: false, deliveryRadius: 5, minOrderAmount: 250, deliveryFee: 25, freeDeliveryAbove: 600, preparationTime: 25, posEnabled: true, status: 'ACTIVE' },
    });

    const foodStore1 = await db.store.create({
      data: { businessId: foodBusiness.id, name: 'SpiceKitchen Bandra', slug: 'spicekitchen-bandra', code: 'SK-BWD', address: '15 Park Street, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', phone: '+91 22 2345 6789', isMainStore: true, deliveryRadius: 6, deliveryFee: 40, freeDeliveryAbove: 400, preparationTime: 35, posEnabled: true, status: 'ACTIVE' },
    });

    const foodStore2 = await db.store.create({
      data: { businessId: foodBusiness.id, name: 'SpiceKitchen Andheri', slug: 'spicekitchen-andheri', code: 'SK-AND', address: '33 Link Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', phone: '+91 22 3456 7890', isMainStore: false, deliveryRadius: 5, deliveryFee: 35, freeDeliveryAbove: 350, preparationTime: 30, posEnabled: true, status: 'ACTIVE' },
    });

    const laundryStore = await db.store.create({
      data: { businessId: laundryBusiness.id, name: 'QuickClean Civil Lines', slug: 'quickclean-civil-lines', code: 'QC-CL', address: '78 Civil Lines', city: 'Delhi', state: 'Delhi', pincode: '110054', phone: '+91 11 3456 7890', isMainStore: true, deliveryRadius: 10, minOrderAmount: 150, deliveryFee: 0, freeDeliveryAbove: 0, preparationTime: 60, status: 'ACTIVE' },
    });

    const carwashStore = await db.store.create({
      data: { businessId: carwashBusiness.id, name: 'SparkleWash Jubilee Hills', slug: 'sparklewash-jubilee-hills', code: 'SW-JH', address: '25 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033', phone: '+91 40 4567 8901', isMainStore: true, status: 'ACTIVE' },
    });

    const homeServiceStore = await db.store.create({
      data: { businessId: homeServiceBusiness.id, name: 'HomeFixPro Anna Nagar', slug: 'homefixpro-anna-nagar', code: 'HF-AN', address: '100 Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', phone: '+91 44 5678 9012', isMainStore: true, status: 'ACTIVE' },
    });

    // 7. Create Categories for Grocery
    const groceryCategories = await Promise.all([
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', icon: '🥬', sortOrder: 1 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Dairy & Eggs', slug: 'dairy-eggs', icon: '🥛', sortOrder: 2 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Bakery', slug: 'bakery', icon: '🍞', sortOrder: 3 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Snacks', slug: 'snacks', icon: '🍿', sortOrder: 4 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Beverages', slug: 'beverages', icon: '🥤', sortOrder: 5 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Household', slug: 'household', icon: '🧹', sortOrder: 6 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Personal Care', slug: 'personal-care', icon: '🧴', sortOrder: 7 } }),
      db.category.create({ data: { businessId: groceryBusiness.id, name: 'Staples', slug: 'staples', icon: '🍚', sortOrder: 8 } }),
    ]);

    // Categories for Food
    const foodCategories = await Promise.all([
      db.category.create({ data: { businessId: foodBusiness.id, name: 'Biryani', slug: 'biryani', icon: '🍛', sortOrder: 1 } }),
      db.category.create({ data: { businessId: foodBusiness.id, name: 'North Indian', slug: 'north-indian', icon: '🍲', sortOrder: 2 } }),
      db.category.create({ data: { businessId: foodBusiness.id, name: 'South Indian', slug: 'south-indian', icon: '🥘', sortOrder: 3 } }),
      db.category.create({ data: { businessId: foodBusiness.id, name: 'Chinese', slug: 'chinese', icon: '🥡', sortOrder: 4 } }),
      db.category.create({ data: { businessId: foodBusiness.id, name: 'Desserts', slug: 'desserts', icon: '🍮', sortOrder: 5 } }),
      db.category.create({ data: { businessId: foodBusiness.id, name: 'Beverages', slug: 'beverages', icon: '☕', sortOrder: 6 } }),
    ]);

    // Categories for Laundry
    const laundryCategories = await Promise.all([
      db.category.create({ data: { businessId: laundryBusiness.id, name: 'Wash & Fold', slug: 'wash-fold', icon: '👔', sortOrder: 1 } }),
      db.category.create({ data: { businessId: laundryBusiness.id, name: 'Dry Cleaning', slug: 'dry-cleaning', icon: '🧥', sortOrder: 2 } }),
      db.category.create({ data: { businessId: laundryBusiness.id, name: 'Ironing', slug: 'ironing', icon: '👕', sortOrder: 3 } }),
    ]);

    // Categories for Car Wash
    const carwashCategories = await Promise.all([
      db.category.create({ data: { businessId: carwashBusiness.id, name: 'Basic Wash', slug: 'basic-wash', icon: '🚗', sortOrder: 1 } }),
      db.category.create({ data: { businessId: carwashBusiness.id, name: 'Premium Wash', slug: 'premium-wash', icon: '✨', sortOrder: 2 } }),
      db.category.create({ data: { businessId: carwashBusiness.id, name: 'Detailing', slug: 'detailing', icon: '🔧', sortOrder: 3 } }),
    ]);

    // Categories for Home Services
    const homeServiceCategories = await Promise.all([
      db.category.create({ data: { businessId: homeServiceBusiness.id, name: 'Cleaning', slug: 'cleaning', icon: '🧹', sortOrder: 1 } }),
      db.category.create({ data: { businessId: homeServiceBusiness.id, name: 'Plumbing', slug: 'plumbing', icon: '🔧', sortOrder: 2 } }),
      db.category.create({ data: { businessId: homeServiceBusiness.id, name: 'Electrical', slug: 'electrical', icon: '💡', sortOrder: 3 } }),
      db.category.create({ data: { businessId: homeServiceBusiness.id, name: 'Painting', slug: 'painting', icon: '🎨', sortOrder: 4 } }),
    ]);

    // 8. Create Products
    const groceryProducts = [];
    const groceryProductDefs = [
      { name: 'Fresh Bananas', slug: 'fresh-bananas', cat: 0, type: 'PHYSICAL' as const, unit: 'dozen', isVeg: true, variants: [{ name: '1 Dozen', price: 49, mrp: 59, isDefault: true }, { name: '2 Dozen', price: 89, mrp: 109 }] },
      { name: 'Organic Apples', slug: 'organic-apples', cat: 0, type: 'PHYSICAL' as const, unit: 'kg', isVeg: true, isFeatured: true, variants: [{ name: '500g', price: 120, mrp: 150, isDefault: true }, { name: '1kg', price: 220, mrp: 280 }] },
      { name: 'Fresh Spinach', slug: 'fresh-spinach', cat: 0, type: 'PHYSICAL' as const, unit: 'bunch', isVeg: true, variants: [{ name: '1 Bunch', price: 30, mrp: 40, isDefault: true }] },
      { name: 'Tomatoes', slug: 'tomatoes', cat: 0, type: 'PHYSICAL' as const, unit: 'kg', isVeg: true, isPopular: true, variants: [{ name: '500g', price: 24, mrp: 30, isDefault: true }, { name: '1kg', price: 44, mrp: 55 }] },
      { name: 'Amul Toned Milk', slug: 'amul-toned-milk', cat: 1, type: 'PHYSICAL' as const, unit: 'packet', isVeg: true, isPopular: true, variants: [{ name: '500ml', price: 27, mrp: 27, isDefault: true }, { name: '1L', price: 52, mrp: 54 }] },
      { name: 'Farm Eggs', slug: 'farm-eggs', cat: 1, type: 'PHYSICAL' as const, unit: 'pack', isVeg: false, isPopular: true, variants: [{ name: '6 Pack', price: 60, mrp: 72, isDefault: true }, { name: '12 Pack', price: 110, mrp: 135 }] },
      { name: 'Greek Yogurt', slug: 'greek-yogurt', cat: 1, type: 'PHYSICAL' as const, unit: 'cup', isVeg: true, variants: [{ name: '200g', price: 45, mrp: 50, isDefault: true }] },
      { name: 'Whole Wheat Bread', slug: 'whole-wheat-bread', cat: 2, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, isPopular: true, variants: [{ name: '400g', price: 45, mrp: 50, isDefault: true }] },
      { name: 'Croissant', slug: 'croissant', cat: 2, type: 'PHYSICAL' as const, unit: 'piece', isVeg: true, isFeatured: true, variants: [{ name: '1 Piece', price: 35, mrp: 40, isDefault: true }, { name: '3 Pack', price: 99, mrp: 120 }] },
      { name: 'Lays Classic', slug: 'lays-classic', cat: 3, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, variants: [{ name: '52g', price: 20, mrp: 20, isDefault: true }, { name: '130g', price: 50, mrp: 50 }] },
      { name: 'Maggi Noodles', slug: 'maggi-noodles', cat: 3, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, isPopular: true, variants: [{ name: 'Single Pack', price: 14, mrp: 14, isDefault: true }, { name: '4 Pack', price: 52, mrp: 56 }] },
      { name: 'Coca Cola', slug: 'coca-cola', cat: 4, type: 'PHYSICAL' as const, unit: 'bottle', isVeg: true, variants: [{ name: '750ml', price: 38, mrp: 40, isDefault: true }, { name: '2L', price: 85, mrp: 90 }] },
      { name: 'Tata Gold Tea', slug: 'tata-gold-tea', cat: 4, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, isFeatured: true, variants: [{ name: '250g', price: 135, mrp: 150, isDefault: true }, { name: '500g', price: 260, mrp: 290 }] },
      { name: 'Surf Excel', slug: 'surf-excel', cat: 5, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, variants: [{ name: '1kg', price: 155, mrp: 175, isDefault: true }, { name: '2kg', price: 295, mrp: 340 }] },
      { name: 'Dettol Handwash', slug: 'dettol-handwash', cat: 5, type: 'PHYSICAL' as const, unit: 'bottle', isVeg: true, variants: [{ name: '200ml', price: 59, mrp: 69, isDefault: true }] },
      { name: 'Dove Soap', slug: 'dove-soap', cat: 6, type: 'PHYSICAL' as const, unit: 'pack', isVeg: true, variants: [{ name: 'Single', price: 48, mrp: 54, isDefault: true }, { name: '3 Pack', price: 135, mrp: 160 }] },
      { name: 'Basmati Rice', slug: 'basmati-rice', cat: 7, type: 'PHYSICAL' as const, unit: 'kg', isVeg: true, isFeatured: true, variants: [{ name: '1kg', price: 180, mrp: 210, isDefault: true }, { name: '5kg', price: 825, mrp: 990 }] },
      { name: 'Toor Dal', slug: 'toor-dal', cat: 7, type: 'PHYSICAL' as const, unit: 'kg', isVeg: true, isPopular: true, variants: [{ name: '500g', price: 95, mrp: 110, isDefault: true }, { name: '1kg', price: 180, mrp: 210 }] },
      { name: 'Aashirvaad Atta', slug: 'aashirvaad-atta', cat: 7, type: 'PHYSICAL' as const, unit: 'kg', isVeg: true, isPopular: true, variants: [{ name: '2kg', price: 120, mrp: 135, isDefault: true }, { name: '5kg', price: 275, mrp: 310 }] },
      { name: 'Mustard Oil', slug: 'mustard-oil', cat: 7, type: 'PHYSICAL' as const, unit: 'bottle', isVeg: true, variants: [{ name: '1L', price: 185, mrp: 210, isDefault: true }] },
    ];

    for (const p of groceryProductDefs) {
      const product = await db.product.create({
        data: {
          businessId: groceryBusiness.id, categoryId: groceryCategories[p.cat].id, name: p.name, slug: p.slug,
          type: p.type, unit: p.unit, isVeg: p.isVeg,
          isFeatured: p.isFeatured || false, isPopular: p.isPopular || false, status: 'ACTIVE',
          variants: { create: p.variants.map(v => ({ name: v.name, price: v.price, mrp: v.mrp, stock: Math.floor(Math.random() * 200) + 20, minStock: 10, isDefault: v.isDefault || false, isActive: true })) },
        },
        include: { variants: true },
      });
      groceryProducts.push(product);
    }

    // Food Products
    const foodProducts = [];
    const foodProductDefs = [
      { name: 'Chicken Biryani', slug: 'chicken-biryani', cat: 0, isVeg: false, isFeatured: true, isPopular: true, prepTime: 35, variants: [{ name: 'Regular', price: 249, mrp: 299, isDefault: true }, { name: 'Family Pack', price: 449, mrp: 549 }] },
      { name: 'Mutton Biryani', slug: 'mutton-biryani', cat: 0, isVeg: false, isPopular: true, prepTime: 40, variants: [{ name: 'Regular', price: 349, mrp: 399, isDefault: true }, { name: 'Family Pack', price: 649, mrp: 749 }] },
      { name: 'Veg Biryani', slug: 'veg-biryani', cat: 0, isVeg: true, prepTime: 30, variants: [{ name: 'Regular', price: 199, mrp: 249, isDefault: true }] },
      { name: 'Butter Chicken', slug: 'butter-chicken', cat: 1, isVeg: false, isFeatured: true, prepTime: 25, variants: [{ name: 'Half', price: 229, mrp: 269, isDefault: true }, { name: 'Full', price: 399, mrp: 469 }] },
      { name: 'Dal Makhani', slug: 'dal-makhani', cat: 1, isVeg: true, prepTime: 20, variants: [{ name: 'Half', price: 179, mrp: 209, isDefault: true }, { name: 'Full', price: 299, mrp: 359 }] },
      { name: 'Paneer Tikka', slug: 'paneer-tikka', cat: 1, isVeg: true, isPopular: true, prepTime: 20, variants: [{ name: '6 Pieces', price: 249, mrp: 299, isDefault: true }] },
      { name: 'Masala Dosa', slug: 'masala-dosa', cat: 2, isVeg: true, isPopular: true, prepTime: 15, variants: [{ name: 'Single', price: 99, mrp: 120, isDefault: true }] },
      { name: 'Idli Sambar', slug: 'idli-sambar', cat: 2, isVeg: true, prepTime: 10, variants: [{ name: '2 Piece', price: 69, mrp: 80, isDefault: true }] },
      { name: 'Hakka Noodles', slug: 'hakka-noodles', cat: 3, isVeg: true, prepTime: 15, variants: [{ name: 'Regular', price: 179, mrp: 210, isDefault: true }] },
      { name: 'Manchurian', slug: 'manchurian', cat: 3, isVeg: true, prepTime: 15, variants: [{ name: 'Half', price: 159, mrp: 189, isDefault: true }, { name: 'Full', price: 269, mrp: 319 }] },
      { name: 'Gulab Jamun', slug: 'gulab-jamun', cat: 4, isVeg: true, prepTime: 5, variants: [{ name: '2 Pieces', price: 59, mrp: 69, isDefault: true }, { name: '4 Pieces', price: 99, mrp: 119 }] },
      { name: 'Rasmalai', slug: 'rasmalai', cat: 4, isVeg: true, isFeatured: true, prepTime: 5, variants: [{ name: '2 Pieces', price: 79, mrp: 89, isDefault: true }] },
      { name: 'Mango Lassi', slug: 'mango-lassi', cat: 5, isVeg: true, prepTime: 5, variants: [{ name: '250ml', price: 69, mrp: 79, isDefault: true }] },
      { name: 'Masala Chai', slug: 'masala-chai', cat: 5, isVeg: true, prepTime: 5, isPopular: true, variants: [{ name: 'Regular', price: 39, mrp: 49, isDefault: true }] },
    ];

    for (const p of foodProductDefs) {
      const product = await db.product.create({
        data: {
          businessId: foodBusiness.id, categoryId: foodCategories[p.cat].id, name: p.name, slug: p.slug,
          type: 'PHYSICAL', isVeg: p.isVeg, isFeatured: p.isFeatured || false, isPopular: p.isPopular || false, preparationTime: p.prepTime, status: 'ACTIVE',
          variants: { create: p.variants.map(v => ({ name: v.name, price: v.price, mrp: v.mrp, stock: 100, minStock: 5, isDefault: v.isDefault || false, isActive: true })) },
        },
        include: { variants: true },
      });
      foodProducts.push(product);
    }

    // Laundry Products
    for (const p of [
      { name: 'Wash & Fold - Shirt', slug: 'wash-fold-shirt', cat: 0, variants: [{ name: 'Per Piece', price: 25, mrp: 30, isDefault: true }] },
      { name: 'Wash & Fold - Trousers', slug: 'wash-fold-trousers', cat: 0, variants: [{ name: 'Per Piece', price: 30, mrp: 35, isDefault: true }] },
      { name: 'Wash & Fold - Bedsheet', slug: 'wash-fold-bedsheet', cat: 0, variants: [{ name: 'Single', price: 60, mrp: 70, isDefault: true }, { name: 'Double', price: 90, mrp: 110 }] },
      { name: 'Dry Clean - Suit', slug: 'dry-clean-suit', cat: 1, isFeatured: true, variants: [{ name: '2 Piece', price: 350, mrp: 400, isDefault: true }, { name: '3 Piece', price: 450, mrp: 520 }] },
      { name: 'Dry Clean - Saree', slug: 'dry-clean-saree', cat: 1, variants: [{ name: 'Regular', price: 200, mrp: 250, isDefault: true }, { name: 'Heavy', price: 350, mrp: 400 }] },
      { name: 'Dry Clean - Coat', slug: 'dry-clean-coat', cat: 1, variants: [{ name: 'Per Piece', price: 200, mrp: 250, isDefault: true }] },
      { name: 'Ironing - Shirt', slug: 'ironing-shirt', cat: 2, variants: [{ name: 'Per Piece', price: 15, mrp: 20, isDefault: true }] },
      { name: 'Ironing - Trouser', slug: 'ironing-trouser', cat: 2, variants: [{ name: 'Per Piece', price: 15, mrp: 20, isDefault: true }] },
    ]) {
      await db.product.create({
        data: {
          businessId: laundryBusiness.id, categoryId: laundryCategories[p.cat].id, name: p.name, slug: p.slug,
          type: 'SERVICE', isFeatured: p.isFeatured || false, status: 'ACTIVE',
          variants: { create: p.variants.map(v => ({ name: v.name, price: v.price, mrp: v.mrp, stock: 999, isDefault: v.isDefault || false, isActive: true })) },
        },
      });
    }

    // Car Wash Products
    for (const p of [
      { name: 'Basic Exterior Wash', slug: 'basic-exterior-wash', cat: 0, variants: [{ name: 'Hatchback', price: 299, mrp: 399, isDefault: true }, { name: 'Sedan', price: 399, mrp: 499 }, { name: 'SUV', price: 499, mrp: 599 }] },
      { name: 'Interior + Exterior Wash', slug: 'interior-exterior-wash', cat: 0, isPopular: true, variants: [{ name: 'Hatchback', price: 499, mrp: 649, isDefault: true }, { name: 'Sedan', price: 599, mrp: 799 }, { name: 'SUV', price: 799, mrp: 999 }] },
      { name: 'Foam Wash', slug: 'foam-wash', cat: 1, isFeatured: true, variants: [{ name: 'Hatchback', price: 599, mrp: 749, isDefault: true }, { name: 'Sedan', price: 699, mrp: 899 }, { name: 'SUV', price: 899, mrp: 1099 }] },
      { name: 'Premium Detailing', slug: 'premium-detailing', cat: 2, variants: [{ name: 'Basic', price: 1999, mrp: 2499, isDefault: true }, { name: 'Advanced', price: 3499, mrp: 4499 }] },
      { name: 'Ceramic Coating', slug: 'ceramic-coating', cat: 2, isFeatured: true, variants: [{ name: 'Standard', price: 4999, mrp: 6999, isDefault: true }, { name: 'Premium', price: 7999, mrp: 9999 }] },
    ]) {
      await db.product.create({
        data: {
          businessId: carwashBusiness.id, categoryId: carwashCategories[p.cat].id, name: p.name, slug: p.slug,
          type: 'SERVICE', isFeatured: p.isFeatured || false, isPopular: p.isPopular || false, status: 'ACTIVE',
          variants: { create: p.variants.map(v => ({ name: v.name, price: v.price, mrp: v.mrp, stock: 999, isDefault: v.isDefault || false, isActive: true })) },
        },
      });
    }

    // Home Service Products
    for (const p of [
      { name: 'Deep Home Cleaning', slug: 'deep-home-cleaning', cat: 0, isFeatured: true, variants: [{ name: '1 BHK', price: 1499, mrp: 1999, isDefault: true }, { name: '2 BHK', price: 2199, mrp: 2999 }, { name: '3 BHK', price: 2999, mrp: 3999 }] },
      { name: 'Kitchen Cleaning', slug: 'kitchen-cleaning', cat: 0, variants: [{ name: 'Standard', price: 799, mrp: 999, isDefault: true }] },
      { name: 'Bathroom Cleaning', slug: 'bathroom-cleaning', cat: 0, variants: [{ name: 'Per Bathroom', price: 499, mrp: 649, isDefault: true }] },
      { name: 'Plumbing Repair', slug: 'plumbing-repair', cat: 1, variants: [{ name: 'Basic Repair', price: 399, mrp: 499, isDefault: true }, { name: 'Pipe Replacement', price: 799, mrp: 999 }] },
      { name: 'Tap Installation', slug: 'tap-installation', cat: 1, variants: [{ name: 'Per Tap', price: 299, mrp: 399, isDefault: true }] },
      { name: 'Electrical Repair', slug: 'electrical-repair', cat: 2, variants: [{ name: 'Basic Repair', price: 349, mrp: 449, isDefault: true }, { name: 'Fan Installation', price: 549, mrp: 699 }] },
      { name: 'Room Painting', slug: 'room-painting', cat: 3, variants: [{ name: 'Per Room', price: 2499, mrp: 3299, isDefault: true }] },
    ]) {
      await db.product.create({
        data: {
          businessId: homeServiceBusiness.id, categoryId: homeServiceCategories[p.cat].id, name: p.name, slug: p.slug,
          type: 'SERVICE', isFeatured: p.isFeatured || false, status: 'ACTIVE',
          variants: { create: p.variants.map(v => ({ name: v.name, price: v.price, mrp: v.mrp, stock: 999, isDefault: v.isDefault || false, isActive: true })) },
        },
      });
    }

    // 9. Create Customers
    const customers = await Promise.all([
      db.customer.create({ data: { businessId: groceryBusiness.id, userId: customerUser.id, name: 'Ananya Gupta', email: 'customer@demo.com', phone: '+91 91234 56789', totalOrders: 15, totalSpent: 8500, avgOrderValue: 567, loyaltyPoints: 850 } }),
      db.customer.create({ data: { businessId: groceryBusiness.id, userId: customerUser2.id, name: 'Rahul Verma', email: 'rahul@demo.com', phone: '+91 92345 67890', totalOrders: 8, totalSpent: 4200, avgOrderValue: 525, loyaltyPoints: 420 } }),
      db.customer.create({ data: { businessId: groceryBusiness.id, userId: customerUser3.id, name: 'Sneha Iyer', email: 'sneha@demo.com', phone: '+91 93456 78901', totalOrders: 22, totalSpent: 12800, avgOrderValue: 582, loyaltyPoints: 1280 } }),
      db.customer.create({ data: { businessId: foodBusiness.id, userId: customerUser.id, name: 'Ananya Gupta', email: 'customer@demo.com', phone: '+91 91234 56789', totalOrders: 25, totalSpent: 7500, avgOrderValue: 300, loyaltyPoints: 750 } }),
      db.customer.create({ data: { businessId: foodBusiness.id, name: 'Karthik Reddy', email: 'karthik@demo.com', phone: '+91 94567 89012', totalOrders: 12, totalSpent: 4200, avgOrderValue: 350, loyaltyPoints: 420 } }),
      db.customer.create({ data: { businessId: foodBusiness.id, userId: customerUser2.id, name: 'Rahul Verma', email: 'rahul@demo.com', phone: '+91 92345 67890', totalOrders: 18, totalSpent: 5400, avgOrderValue: 300, loyaltyPoints: 540 } }),
      db.customer.create({ data: { businessId: laundryBusiness.id, userId: customerUser.id, name: 'Ananya Gupta', email: 'customer@demo.com', phone: '+91 91234 56789', totalOrders: 10, totalSpent: 3200, avgOrderValue: 320, loyaltyPoints: 320 } }),
      db.customer.create({ data: { businessId: carwashBusiness.id, userId: customerUser2.id, name: 'Rahul Verma', email: 'rahul@demo.com', phone: '+91 92345 67890', totalOrders: 6, totalSpent: 4800, avgOrderValue: 800, loyaltyPoints: 480 } }),
      db.customer.create({ data: { businessId: homeServiceBusiness.id, userId: customerUser3.id, name: 'Sneha Iyer', email: 'sneha@demo.com', phone: '+91 93456 78901', totalOrders: 3, totalSpent: 5400, avgOrderValue: 1800, loyaltyPoints: 540 } }),
    ]);

    // 10. Create Delivery Partners
    await db.deliveryPartner.createMany({
      data: [
        { businessId: groceryBusiness.id, userId: deliveryUser1.id, name: 'Suresh Yadav', phone: '+91 94567 89012', vehicleType: 'bike', vehicleNumber: 'KA-01-AB-1234', isOnline: true, rating: 4.5, totalDeliveries: 256, totalEarnings: 38400 },
        { businessId: groceryBusiness.id, userId: deliveryUser2.id, name: 'Mohan Das', phone: '+91 95678 90123', vehicleType: 'bike', vehicleNumber: 'KA-01-CD-5678', isOnline: false, rating: 4.2, totalDeliveries: 189, totalEarnings: 28350 },
        { businessId: foodBusiness.id, name: 'Ravi Kumar', phone: '+91 96789 01234', vehicleType: 'bike', vehicleNumber: 'MH-02-EF-9012', isOnline: true, rating: 4.7, totalDeliveries: 312, totalEarnings: 46800 },
        { businessId: foodBusiness.id, name: 'Anil Singh', phone: '+91 97890 12345', vehicleType: 'bike', vehicleNumber: 'MH-02-GH-3456', isOnline: true, rating: 4.3, totalDeliveries: 198, totalEarnings: 29700 },
        { businessId: laundryBusiness.id, name: 'Pradeep Joshi', phone: '+91 98901 23456', vehicleType: 'bike', vehicleNumber: 'DL-03-IJ-7890', isOnline: true, rating: 4.6, totalDeliveries: 145, totalEarnings: 21750 },
        { businessId: homeServiceBusiness.id, name: 'Kiran Nair', phone: '+91 99012 34567', vehicleType: 'car', vehicleNumber: 'TN-04-KL-1234', isOnline: false, rating: 4.4, totalDeliveries: 67, totalEarnings: 20100 },
      ],
    });

    // 11. Delivery Zones
    await db.deliveryZone.createMany({
      data: [
        { businessId: groceryBusiness.id, storeId: groceryStore1.id, name: 'Koramangala Zone', zoneType: 'PINCODE', pincodes: JSON.stringify(['560034', '560095', '560047']), deliveryFee: 30, freeDeliveryAbove: 500, estimatedTime: 30, isActive: true },
        { businessId: groceryBusiness.id, storeId: groceryStore2.id, name: 'Indiranagar Zone', zoneType: 'PINCODE', pincodes: JSON.stringify(['560038', '560075']), deliveryFee: 25, freeDeliveryAbove: 600, estimatedTime: 35, isActive: true },
        { businessId: foodBusiness.id, storeId: foodStore1.id, name: 'Bandra Zone', zoneType: 'CIRCLE', centerLat: 19.0596, centerLng: 72.8295, radius: 6, deliveryFee: 40, freeDeliveryAbove: 400, estimatedTime: 40, isActive: true },
        { businessId: laundryBusiness.id, name: 'Delhi NCR Zone', zoneType: 'PINCODE', pincodes: JSON.stringify(['110054', '110055', '110056']), deliveryFee: 0, minOrderAmount: 150, estimatedTime: 60, isActive: true },
        { businessId: homeServiceBusiness.id, name: 'Chennai Central Zone', zoneType: 'CIRCLE', centerLat: 13.0827, centerLng: 80.2707, radius: 10, deliveryFee: 0, estimatedTime: 90, isActive: true },
      ],
    });

    // 12. Tax Configs
    await db.taxConfig.createMany({
      data: [
        { businessId: groceryBusiness.id, name: 'GST 0% (Exempted)', taxType: 'GST_0', gstRate: 0, isDefault: false, isActive: true },
        { businessId: groceryBusiness.id, name: 'GST 5%', taxType: 'GST_5', gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, hsnCode: '0803', isDefault: true, isActive: true },
        { businessId: groceryBusiness.id, name: 'GST 12%', taxType: 'GST_12', gstRate: 12, cgstRate: 6, sgstRate: 6, isDefault: false, isActive: true },
        { businessId: groceryBusiness.id, name: 'GST 18%', taxType: 'GST_18', gstRate: 18, cgstRate: 9, sgstRate: 9, isDefault: false, isActive: true },
        { businessId: foodBusiness.id, name: 'GST 5% (Restaurant)', taxType: 'GST_5', gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, isDefault: true, isActive: true },
        { businessId: foodBusiness.id, name: 'GST 18%', taxType: 'GST_18', gstRate: 18, cgstRate: 9, sgstRate: 9, isDefault: false, isActive: true },
        { businessId: laundryBusiness.id, name: 'GST 18% (Services)', taxType: 'GST_18', gstRate: 18, cgstRate: 9, sgstRate: 9, isDefault: true, isActive: true },
        { businessId: carwashBusiness.id, name: 'GST 18% (Services)', taxType: 'GST_18', gstRate: 18, cgstRate: 9, sgstRate: 9, isDefault: true, isActive: true },
        { businessId: homeServiceBusiness.id, name: 'GST 18% (Services)', taxType: 'GST_18', gstRate: 18, cgstRate: 9, sgstRate: 9, isDefault: true, isActive: true },
      ],
    });

    // 13. Subscription Plans
    await db.subscriptionPlan.createMany({
      data: [
        { businessId: carwashBusiness.id, name: 'Basic Wash Plan', slug: 'basic-wash-plan', type: 'CAR_WASH', billingCycle: 'MONTHLY', price: 999, originalPrice: 1499, totalCredits: 4, creditLabel: 'washes', features: JSON.stringify(['4 Basic washes/month', 'Exterior cleaning', 'Dashboard wipe']), isFeatured: false, sortOrder: 1, currentSubscribers: 45, isActive: true },
        { businessId: carwashBusiness.id, name: 'Premium Wash Plan', slug: 'premium-wash-plan', type: 'CAR_WASH', billingCycle: 'MONTHLY', price: 1999, originalPrice: 2999, totalCredits: 8, creditLabel: 'washes', features: JSON.stringify(['8 Premium washes/month', 'Interior + Exterior', 'Foam wash', 'Vacuum cleaning']), isFeatured: true, sortOrder: 2, currentSubscribers: 78, isActive: true },
        { businessId: carwashBusiness.id, name: 'Unlimited Wash Plan', slug: 'unlimited-wash-plan', type: 'CAR_WASH', billingCycle: 'MONTHLY', price: 3499, originalPrice: 4999, totalCredits: 999, creditLabel: 'washes', features: JSON.stringify(['Unlimited washes', 'All services included', 'Priority booking']), isFeatured: true, sortOrder: 3, maxSubscribers: 100, currentSubscribers: 23, isActive: true },
        { businessId: laundryBusiness.id, name: 'Weekly Laundry', slug: 'weekly-laundry', type: 'LAUNDRY', billingCycle: 'WEEKLY', price: 499, totalCredits: 10, creditLabel: 'items', features: JSON.stringify(['10 items/week', 'Wash & Fold', 'Free pickup & delivery']), sortOrder: 1, currentSubscribers: 120, isActive: true },
        { businessId: laundryBusiness.id, name: 'Monthly Laundry', slug: 'monthly-laundry', type: 'LAUNDRY', billingCycle: 'MONTHLY', price: 1499, originalPrice: 1999, totalCredits: 40, creditLabel: 'items', features: JSON.stringify(['40 items/month', 'Wash, Fold & Iron', 'Free pickup & delivery']), isFeatured: true, sortOrder: 2, currentSubscribers: 89, isActive: true },
        { businessId: groceryBusiness.id, name: 'Daily Essentials', slug: 'daily-essentials', type: 'GROCERY', billingCycle: 'MONTHLY', price: 2999, totalCredits: 30, creditLabel: 'deliveries', features: JSON.stringify(['Free delivery on all orders', '5% extra discount', 'Priority delivery slots']), isFeatured: true, sortOrder: 1, currentSubscribers: 56, isActive: true },
        { businessId: homeServiceBusiness.id, name: 'Home Care Plan', slug: 'home-care-plan', type: 'HOME_SERVICE', billingCycle: 'MONTHLY', price: 2499, originalPrice: 3499, totalCredits: 4, creditLabel: 'services', features: JSON.stringify(['4 services/month', 'Cleaning + Minor repairs', 'Priority booking']), isFeatured: true, sortOrder: 1, currentSubscribers: 34, isActive: true },
      ],
    });

    // 14. Promo Codes
    await db.promoCode.createMany({
      data: [
        { businessId: groceryBusiness.id, code: 'FRESH20', description: '20% off on first order', promoType: 'PERCENTAGE', value: 20, minOrderAmount: 300, maxDiscount: 100, usageLimit: 1000, usageCount: 234, isFirstOrderOnly: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
        { businessId: groceryBusiness.id, code: 'FREEDELIVERY', description: 'Free delivery on any order', promoType: 'FREE_DELIVERY', value: 0, minOrderAmount: 200, usageLimit: 5000, usageCount: 1567, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
        { businessId: foodBusiness.id, code: 'SPICE50', description: 'Flat ₹50 off', promoType: 'FLAT', value: 50, minOrderAmount: 250, usageLimit: 2000, usageCount: 890, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
        { businessId: foodBusiness.id, code: 'FIRSTORDER', description: '30% off first order', promoType: 'PERCENTAGE', value: 30, maxDiscount: 150, usageLimit: 5000, usageCount: 2345, isFirstOrderOnly: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
        { businessId: laundryBusiness.id, code: 'CLEAN10', description: '10% off on all services', promoType: 'PERCENTAGE', value: 10, maxDiscount: 200, usageLimit: 1000, usageCount: 345, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
        { businessId: carwashBusiness.id, code: 'SPARKLE15', description: '15% off on premium wash', promoType: 'PERCENTAGE', value: 15, maxDiscount: 300, usageLimit: 500, usageCount: 123, startsAt: new Date('2024-01-01'), endsAt: new Date('2026-12-31'), isActive: true },
      ],
    });

    // 15. Demo Orders
    const orderStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED'] as const;
    const paymentMethods = ['UPI', 'CARD', 'COD', 'UPI', 'CARD', 'UPI', 'CASH', 'UPI', 'CARD', 'UPI'] as const;

    for (let i = 0; i < 25; i++) {
      const status = orderStatuses[i % orderStatuses.length];
      const isCompleted = status === 'DELIVERED';
      const customer = customers[i % customers.length];

      let businessId: string, storeId: string, productIds: string[];
      if (i < 12) {
        businessId = groceryBusiness.id; storeId = i % 2 === 0 ? groceryStore1.id : groceryStore2.id;
        productIds = groceryProducts.slice(0, 5).map(p => p.id);
      } else if (i < 20) {
        businessId = foodBusiness.id; storeId = i % 2 === 0 ? foodStore1.id : foodStore2.id;
        productIds = foodProducts.slice(0, 5).map(p => p.id);
      } else {
        businessId = laundryBusiness.id; storeId = laundryStore.id; productIds = [];
      }

      const daysAgo = Math.floor(i / 2);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const numItems = Math.floor(Math.random() * 3) + 1;
      const subtotal = Math.floor(Math.random() * 800) + 200;
      const totalTax = Math.round(subtotal * 0.05);
      const deliveryFee = Math.floor(Math.random() * 50);
      const totalAmount = subtotal + totalTax + deliveryFee;
      const orderNumber = `ORD-2026-${String(i + 1).padStart(4, '0')}`;

      const order = await db.order.create({
        data: {
          businessId, storeId, orderNumber,
          orderType: i < 20 ? 'DELIVERY' : 'PICKUP',
          status, paymentStatus: isCompleted ? 'COMPLETED' : 'PENDING',
          paymentMethod: paymentMethods[i % paymentMethods.length],
          customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
          subtotal, totalTax, deliveryFee, totalAmount,
          cgstAmount: Math.round(totalTax / 2), sgstAmount: Math.round(totalTax / 2),
          createdAt, confirmedAt: isCompleted ? createdAt : null,
          deliveredAt: isCompleted ? new Date(createdAt.getTime() + 45 * 60 * 1000) : null,
          items: {
            create: Array.from({ length: numItems }, (_, j) => ({
              productId: productIds[j % Math.max(productIds.length, 1)] || groceryProducts[0].id,
              productName: `Product ${j + 1}`, quantity: Math.floor(Math.random() * 3) + 1,
              unitPrice: Math.floor(subtotal / numItems), totalPrice: Math.floor(subtotal / numItems),
              gstRate: 5, gstAmount: Math.round((subtotal / numItems) * 0.05),
              cgstAmount: Math.round((subtotal / numItems) * 0.025), sgstAmount: Math.round((subtotal / numItems) * 0.025),
            })),
          },
          statusHistory: { create: { status, note: `Order ${status.toLowerCase()}`, changedBy: superAdmin.id, createdAt } },
        },
      });

      if (i < 20 && (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED')) {
        const partners = await db.deliveryPartner.findMany({ where: { businessId } });
        if (partners.length > 0) {
          await db.delivery.create({
            data: {
              orderId: order.id, deliveryPartnerId: partners[0].id,
              status: status === 'DELIVERED' ? 'DELIVERED' : 'ON_THE_WAY',
              pickupAddress: 'Store location', dropAddress: 'Customer address',
              deliveryOtp: String(1000 + Math.floor(Math.random() * 9000)),
              actualPickupTime: new Date(createdAt.getTime() + 15 * 60 * 1000),
              actualDeliveryTime: status === 'DELIVERED' ? new Date(createdAt.getTime() + 60 * 60 * 1000) : null,
            },
          });
        }
      }

      if (isCompleted) {
        await db.payment.create({
          data: {
            orderId: order.id, businessId, amount: totalAmount,
            method: paymentMethods[i % paymentMethods.length],
            status: 'COMPLETED', receiptNumber: `RCT-${orderNumber}`, createdAt,
          },
        });
      }
    }

    // 16. POS Session
    await db.pOSSession.create({
      data: {
        businessId: groceryBusiness.id, storeId: groceryStore1.id, operatorId: superAdmin.id,
        sessionNumber: 'POS-2026-0001', status: 'OPEN', openingBalance: 5000,
        totalSales: 12450, totalCash: 5200, totalCard: 4250, totalUpi: 3000, totalOrders: 18,
        openedAt: new Date(),
      },
    });

    // 17. Activity Logs
    await db.activityLog.createMany({
      data: [
        { businessId: groceryBusiness.id, userId: superAdmin.id, action: 'business.created', entity: 'Business', details: JSON.stringify({ name: 'FreshMart Grocery' }), createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { businessId: groceryBusiness.id, userId: groceryOwner.id, action: 'product.created', entity: 'Product', details: JSON.stringify({ count: 20 }), createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
        { businessId: foodBusiness.id, userId: superAdmin.id, action: 'business.created', entity: 'Business', details: JSON.stringify({ name: 'SpiceKitchen' }), createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { businessId: foodBusiness.id, userId: foodOwner.id, action: 'order.status_changed', entity: 'Order', details: JSON.stringify({ from: 'PENDING', to: 'CONFIRMED' }), createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        { businessId: carwashBusiness.id, userId: carwashOwner.id, action: 'subscription.created', entity: 'SubscriptionPlan', details: JSON.stringify({ name: 'Premium Wash Plan' }), createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
        { businessId: homeServiceBusiness.id, userId: superAdmin.id, action: 'business.created', entity: 'Business', details: JSON.stringify({ name: 'HomeFixPro' }), createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      ],
    });

    // 18. Notifications
    await db.notification.createMany({
      data: [
        { businessId: groceryBusiness.id, userId: groceryOwner.id, type: 'ORDER_STATUS', title: 'New Order Received', message: 'Order ORD-2026-0025 has been placed', data: JSON.stringify({ orderNumber: 'ORD-2026-0025' }), channel: 'in_app', sentAt: new Date(), isRead: false },
        { businessId: groceryBusiness.id, userId: groceryOwner.id, type: 'SYSTEM', title: 'Trial Period Ending', message: 'Your trial period ends in 5 days. Upgrade now.', data: '{}', channel: 'in_app', sentAt: new Date(), isRead: false },
        { businessId: foodBusiness.id, userId: foodOwner.id, type: 'PAYMENT', title: 'Payment Received', message: 'Payment of ₹549 received', data: JSON.stringify({ amount: 549 }), channel: 'in_app', sentAt: new Date(), isRead: true },
        { businessId: carwashBusiness.id, userId: carwashOwner.id, type: 'SUBSCRIPTION', title: 'New Subscriber', message: 'A new customer has subscribed to Premium Wash Plan', data: '{}', channel: 'in_app', sentAt: new Date(), isRead: false },
        { businessId: homeServiceBusiness.id, userId: homeServiceOwner.id, type: 'SYSTEM', title: 'Welcome to Quantix!', message: 'Your business has been set up. Start adding products.', data: '{}', channel: 'in_app', sentAt: new Date(), isRead: false },
      ],
    });

    // 19. Inventory entries
    for (const product of groceryProducts.slice(0, 10)) {
      const variant = product.variants[0];
      if (variant) {
        const qty = Math.floor(Math.random() * 200) + 10;
        const status = qty <= 0 ? 'OUT_OF_STOCK' : qty <= 10 ? 'LOW_STOCK' : 'IN_STOCK';
        await db.inventory.create({
          data: { businessId: groceryBusiness.id, storeId: groceryStore1.id, productId: product.id, variantId: variant.id, quantity: qty, minStock: 10, maxStock: 500, status, lastRestockedAt: new Date() },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      data: {
        platform: platform.id,
        businesses: 5, users: 9, stores: 7, categories: 24, products: 50,
        customers: 9, orders: 25, deliveryPartners: 6, deliveryZones: 5,
        taxConfigs: 9, subscriptionPlans: 7, promoCodes: 6, posSessions: 1,
        activityLogs: 6, notifications: 5,
        demoCredentials: {
          superAdmin: { email: 'admin@quantix.tech', password: 'admin123' },
          businessOwner: { email: 'grocery@quantix.tech', password: 'owner123' },
          customer: { email: 'customer@demo.com', password: 'customer123' },
          deliveryPartner: { email: 'driver1@demo.com', password: 'delivery123' },
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: 'Seed failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
