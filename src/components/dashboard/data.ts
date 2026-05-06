// Mock data for the Quantix Technology Admin Dashboard

export type BusinessType = 'grocery' | 'food_delivery' | 'laundry' | 'car_wash' | 'home_services';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type OrderType = 'delivery' | 'pickup' | 'pos' | 'subscription';
export type StoreStatus = 'active' | 'inactive' | 'maintenance';
export type DeliveryStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';

export const businessTypeLabels: Record<BusinessType, string> = {
  grocery: 'Grocery',
  food_delivery: 'Food Delivery',
  laundry: 'Laundry',
  car_wash: 'Car Wash',
  home_services: 'Home Services',
};

export const businessTypeColors: Record<BusinessType, string> = {
  grocery: 'bg-emerald-100 text-emerald-800',
  food_delivery: 'bg-orange-100 text-orange-800',
  laundry: 'bg-cyan-100 text-cyan-800',
  car_wash: 'bg-violet-100 text-violet-800',
  home_services: 'bg-amber-100 text-amber-800',
};

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  status: 'active' | 'inactive';
  owner: string;
  email: string;
  phone: string;
  city: string;
  totalStores: number;
  totalOrders: number;
  monthlyRevenue: number;
  createdAt: string;
  subscriptionPlan: string;
}

export interface Store {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  address: string;
  city: string;
  status: StoreStatus;
  deliveryRadius: number;
  totalProducts: number;
  dailyOrders: number;
  rating: number;
  manager: string;
  phone: string;
}

export interface Product {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  stock: number;
  unit: string;
  gstRate: number;
  image: string;
  status: 'active' | 'inactive' | 'out_of_stock';
  businessType: BusinessType;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  storeName: string;
  businessType: BusinessType;
  orderType: OrderType;
  status: OrderStatus;
  items: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  deliveryAddress: string;
  deliveryPartner?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  lastOrder: string;
  joinedAt: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface Delivery {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  partnerName: string;
  partnerPhone: string;
  status: DeliveryStatus;
  pickupAddress: string;
  estimatedDelivery: string;
  distance: number;
  fee: number;
  zone: string;
}

export interface Subscription {
  id: string;
  businessId: string;
  businessName: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  monthlyFee: number;
  creditsUsed: number;
  creditsTotal: number;
  features: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  businessName: string;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue';
  issueDate: string;
  dueDate: string;
  description: string;
}

// ========== MOCK DATA ==========

export const businesses: Business[] = [
  {
    id: 'b1', name: 'FreshMart Groceries', type: 'grocery', status: 'active',
    owner: 'Rajesh Kumar', email: 'rajesh@freshmart.in', phone: '+91 98765 43210',
    city: 'Mumbai', totalStores: 5, totalOrders: 12450, monthlyRevenue: 2850000,
    createdAt: '2024-03-15', subscriptionPlan: 'Growth'
  },
  {
    id: 'b2', name: 'QuickBite Foods', type: 'food_delivery', status: 'active',
    owner: 'Priya Sharma', email: 'priya@quickbite.in', phone: '+91 98765 43211',
    city: 'Delhi', totalStores: 8, totalOrders: 28900, monthlyRevenue: 4250000,
    createdAt: '2024-01-10', subscriptionPlan: 'Enterprise'
  },
  {
    id: 'b3', name: 'SparkleClean Laundry', type: 'laundry', status: 'active',
    owner: 'Amit Patel', email: 'amit@sparkleclean.in', phone: '+91 98765 43212',
    city: 'Bangalore', totalStores: 3, totalOrders: 5670, monthlyRevenue: 890000,
    createdAt: '2024-06-20', subscriptionPlan: 'Starter'
  },
  {
    id: 'b4', name: 'AquaShine Car Wash', type: 'car_wash', status: 'active',
    owner: 'Vikram Singh', email: 'vikram@aquashine.in', phone: '+91 98765 43213',
    city: 'Chennai', totalStores: 4, totalOrders: 3280, monthlyRevenue: 650000,
    createdAt: '2024-08-05', subscriptionPlan: 'Growth'
  },
  {
    id: 'b5', name: 'HomeFix Services', type: 'home_services', status: 'active',
    owner: 'Neha Gupta', email: 'neha@homefix.in', phone: '+91 98765 43214',
    city: 'Hyderabad', totalStores: 2, totalOrders: 4150, monthlyRevenue: 1580000,
    createdAt: '2024-04-12', subscriptionPlan: 'Growth'
  },
  {
    id: 'b6', name: 'GreenBasket Organics', type: 'grocery', status: 'inactive',
    owner: 'Suresh Nair', email: 'suresh@greenbasket.in', phone: '+91 98765 43215',
    city: 'Kochi', totalStores: 2, totalOrders: 890, monthlyRevenue: 120000,
    createdAt: '2024-09-01', subscriptionPlan: 'Starter'
  },
  {
    id: 'b7', name: 'TasteHub Kitchen', type: 'food_delivery', status: 'active',
    owner: 'Deepa Reddy', email: 'deepa@tastehub.in', phone: '+91 98765 43216',
    city: 'Pune', totalStores: 6, totalOrders: 15600, monthlyRevenue: 2100000,
    createdAt: '2024-02-28', subscriptionPlan: 'Growth'
  },
  {
    id: 'b8', name: 'PressMaster Laundry', type: 'laundry', status: 'active',
    owner: 'Kiran Joshi', email: 'kiran@pressmaster.in', phone: '+91 98765 43217',
    city: 'Jaipur', totalStores: 2, totalOrders: 2340, monthlyRevenue: 450000,
    createdAt: '2024-07-15', subscriptionPlan: 'Starter'
  },
];

export const stores: Store[] = [
  {
    id: 's1', businessId: 'b1', businessName: 'FreshMart Groceries', name: 'FreshMart Andheri',
    address: '123 MG Road, Andheri West', city: 'Mumbai', status: 'active',
    deliveryRadius: 5, totalProducts: 850, dailyOrders: 45, rating: 4.5,
    manager: 'Suresh M.', phone: '+91 99887 76655'
  },
  {
    id: 's2', businessId: 'b1', businessName: 'FreshMart Groceries', name: 'FreshMart Bandra',
    address: '45 Hill Road, Bandra West', city: 'Mumbai', status: 'active',
    deliveryRadius: 4, totalProducts: 720, dailyOrders: 38, rating: 4.3,
    manager: 'Ravi K.', phone: '+91 99887 76656'
  },
  {
    id: 's3', businessId: 'b2', businessName: 'QuickBite Foods', name: 'QuickBite Connaught Place',
    address: '12 Connaught Place, New Delhi', city: 'Delhi', status: 'active',
    deliveryRadius: 8, totalProducts: 320, dailyOrders: 85, rating: 4.7,
    manager: 'Anil T.', phone: '+91 99887 76657'
  },
  {
    id: 's4', businessId: 'b2', businessName: 'QuickBite Foods', name: 'QuickBite Nehru Place',
    address: '88 Nehru Place, New Delhi', city: 'Delhi', status: 'maintenance',
    deliveryRadius: 6, totalProducts: 280, dailyOrders: 0, rating: 4.1,
    manager: 'Pooja D.', phone: '+91 99887 76658'
  },
  {
    id: 's5', businessId: 'b3', businessName: 'SparkleClean Laundry', name: 'SparkleClean Koramangala',
    address: '56 5th Cross, Koramangala', city: 'Bangalore', status: 'active',
    deliveryRadius: 7, totalProducts: 45, dailyOrders: 28, rating: 4.6,
    manager: 'Meena S.', phone: '+91 99887 76659'
  },
  {
    id: 's6', businessId: 'b4', businessName: 'AquaShine Car Wash', name: 'AquaShine Anna Nagar',
    address: '22 Anna Nagar, Chennai', city: 'Chennai', status: 'active',
    deliveryRadius: 10, totalProducts: 25, dailyOrders: 32, rating: 4.4,
    manager: 'Karthik R.', phone: '+91 99887 76660'
  },
  {
    id: 's7', businessId: 'b5', businessName: 'HomeFix Services', name: 'HomeFix Madhapur',
    address: '78 Cyber Hills, Madhapur', city: 'Hyderabad', status: 'active',
    deliveryRadius: 15, totalProducts: 60, dailyOrders: 18, rating: 4.8,
    manager: 'Lakshmi P.', phone: '+91 99887 76661'
  },
  {
    id: 's8', businessId: 'b7', businessName: 'TasteHub Kitchen', name: 'TasteHub Koregaon Park',
    address: '34 Lane 5, Koregaon Park', city: 'Pune', status: 'active',
    deliveryRadius: 6, totalProducts: 200, dailyOrders: 52, rating: 4.5,
    manager: 'Sanjay N.', phone: '+91 99887 76662'
  },
];

export const products: Product[] = [
  {
    id: 'p1', storeId: 's1', storeName: 'FreshMart Andheri', name: 'Organic Basmati Rice (5kg)',
    category: 'Grains & Rice', price: 520, mrp: 599, stock: 150, unit: 'pack',
    gstRate: 5, image: '/products/rice.jpg', status: 'active', businessType: 'grocery'
  },
  {
    id: 'p2', storeId: 's1', storeName: 'FreshMart Andheri', name: 'Amul Butter (500g)',
    category: 'Dairy', price: 270, mrp: 280, stock: 200, unit: 'pack',
    gstRate: 12, image: '/products/butter.jpg', status: 'active', businessType: 'grocery'
  },
  {
    id: 'p3', storeId: 's1', storeName: 'FreshMart Andheri', name: 'Tata Salt (1kg)',
    category: 'Essentials', price: 24, mrp: 28, stock: 500, unit: 'pack',
    gstRate: 0, image: '/products/salt.jpg', status: 'active', businessType: 'grocery'
  },
  {
    id: 'p4', storeId: 's3', storeName: 'QuickBite Connaught Place', name: 'Butter Chicken Meal',
    category: 'Non-Veg Meals', price: 349, mrp: 399, stock: 50, unit: 'plate',
    gstRate: 5, image: '/products/butter-chicken.jpg', status: 'active', businessType: 'food_delivery'
  },
  {
    id: 'p5', storeId: 's3', storeName: 'QuickBite Connaught Place', name: 'Paneer Tikka Pizza',
    category: 'Pizza', price: 299, mrp: 349, stock: 30, unit: 'pizza',
    gstRate: 5, image: '/products/pizza.jpg', status: 'active', businessType: 'food_delivery'
  },
  {
    id: 'p6', storeId: 's5', storeName: 'SparkleClean Koramangala', name: 'Wash & Fold (5kg)',
    category: 'Wash', price: 199, mrp: 249, stock: 999, unit: 'service',
    gstRate: 18, image: '/products/wash.jpg', status: 'active', businessType: 'laundry'
  },
  {
    id: 'p7', storeId: 's5', storeName: 'SparkleClean Koramangala', name: 'Dry Cleaning - Suit',
    category: 'Dry Clean', price: 350, mrp: 400, stock: 999, unit: 'service',
    gstRate: 18, image: '/products/dryclean.jpg', status: 'active', businessType: 'laundry'
  },
  {
    id: 'p8', storeId: 's6', storeName: 'AquaShine Anna Nagar', name: 'Premium Car Wash',
    category: 'Car Wash', price: 499, mrp: 599, stock: 999, unit: 'service',
    gstRate: 18, image: '/products/carwash.jpg', status: 'active', businessType: 'car_wash'
  },
  {
    id: 'p9', storeId: 's7', storeName: 'HomeFix Madhapur', name: 'Deep Home Cleaning',
    category: 'Cleaning', price: 1499, mrp: 1999, stock: 999, unit: 'service',
    gstRate: 18, image: '/products/cleaning.jpg', status: 'active', businessType: 'home_services'
  },
  {
    id: 'p10', storeId: 's7', storeName: 'HomeFix Madhapur', name: 'AC Service & Repair',
    category: 'Appliance', price: 599, mrp: 799, stock: 999, unit: 'service',
    gstRate: 18, image: '/products/ac-service.jpg', status: 'active', businessType: 'home_services'
  },
  {
    id: 'p11', storeId: 's1', storeName: 'FreshMart Andheri', name: 'Maggi Noodles (Pack of 12)',
    category: 'Snacks', price: 168, mrp: 192, stock: 0, unit: 'pack',
    gstRate: 12, image: '/products/maggi.jpg', status: 'out_of_stock', businessType: 'grocery'
  },
  {
    id: 'p12', storeId: 's8', storeName: 'TasteHub Koregaon Park', name: 'Veg Biryani',
    category: 'Rice Bowls', price: 249, mrp: 299, stock: 40, unit: 'bowl',
    gstRate: 5, image: '/products/biryani.jpg', status: 'active', businessType: 'food_delivery'
  },
];

export const orders: Order[] = [
  {
    id: 'o1', orderNumber: 'QTX-2024-001', customerName: 'Rahul Mehta', customerPhone: '+91 91234 56789',
    storeName: 'FreshMart Andheri', businessType: 'grocery', orderType: 'delivery',
    status: 'delivered', items: 5, subtotal: 1250, tax: 89, deliveryFee: 40,
    total: 1379, paymentMethod: 'UPI', createdAt: '2024-12-01 10:30',
    deliveryAddress: '45 SV Road, Andheri West', deliveryPartner: 'Ramesh K.'
  },
  {
    id: 'o2', orderNumber: 'QTX-2024-002', customerName: 'Sneha Iyer', customerPhone: '+91 91234 56790',
    storeName: 'QuickBite Connaught Place', businessType: 'food_delivery', orderType: 'delivery',
    status: 'out_for_delivery', items: 2, subtotal: 648, tax: 32, deliveryFee: 30,
    total: 710, paymentMethod: 'Card', createdAt: '2024-12-01 12:45',
    deliveryAddress: '22 Janpath, New Delhi', deliveryPartner: 'Sunil P.'
  },
  {
    id: 'o3', orderNumber: 'QTX-2024-003', customerName: 'Kavitha Nair', customerPhone: '+91 91234 56791',
    storeName: 'SparkleClean Koramangala', businessType: 'laundry', orderType: 'pickup',
    status: 'preparing', items: 3, subtotal: 750, tax: 135, deliveryFee: 0,
    total: 885, paymentMethod: 'Wallet', createdAt: '2024-12-01 09:15',
    deliveryAddress: '10 HSR Layout, Bangalore'
  },
  {
    id: 'o4', orderNumber: 'QTX-2024-004', customerName: 'Arjun Desai', customerPhone: '+91 91234 56792',
    storeName: 'AquaShine Anna Nagar', businessType: 'car_wash', orderType: 'pos',
    status: 'confirmed', items: 1, subtotal: 499, tax: 90, deliveryFee: 0,
    total: 589, paymentMethod: 'Cash', createdAt: '2024-12-01 14:20',
    deliveryAddress: 'On-site'
  },
  {
    id: 'o5', orderNumber: 'QTX-2024-005', customerName: 'Meera Joshi', customerPhone: '+91 91234 56793',
    storeName: 'HomeFix Madhapur', businessType: 'home_services', orderType: 'subscription',
    status: 'pending', items: 1, subtotal: 1499, tax: 270, deliveryFee: 0,
    total: 1769, paymentMethod: 'UPI', createdAt: '2024-12-01 16:00',
    deliveryAddress: '55 Jubilee Hills, Hyderabad'
  },
  {
    id: 'o6', orderNumber: 'QTX-2024-006', customerName: 'Vivek Reddy', customerPhone: '+91 91234 56794',
    storeName: 'TasteHub Koregaon Park', businessType: 'food_delivery', orderType: 'delivery',
    status: 'cancelled', items: 3, subtotal: 890, tax: 44, deliveryFee: 35,
    total: 969, paymentMethod: 'UPI', createdAt: '2024-12-01 11:30',
    deliveryAddress: '12 Viman Nagar, Pune'
  },
  {
    id: 'o7', orderNumber: 'QTX-2024-007', customerName: 'Ananya Sharma', customerPhone: '+91 91234 56795',
    storeName: 'FreshMart Bandra', businessType: 'grocery', orderType: 'delivery',
    status: 'delivered', items: 8, subtotal: 2100, tax: 147, deliveryFee: 40,
    total: 2287, paymentMethod: 'Card', createdAt: '2024-12-01 08:45',
    deliveryAddress: '90 Carter Road, Bandra', deliveryPartner: 'Mohan T.'
  },
  {
    id: 'o8', orderNumber: 'QTX-2024-008', customerName: 'Deepak Kumar', customerPhone: '+91 91234 56796',
    storeName: 'QuickBite Connaught Place', businessType: 'food_delivery', orderType: 'pickup',
    status: 'delivered', items: 1, subtotal: 299, tax: 15, deliveryFee: 0,
    total: 314, paymentMethod: 'Wallet', createdAt: '2024-12-01 13:00',
    deliveryAddress: 'Self Pickup'
  },
  {
    id: 'o9', orderNumber: 'QTX-2024-009', customerName: 'Priti Patel', customerPhone: '+91 91234 56797',
    storeName: 'PressMaster Laundry', businessType: 'laundry', orderType: 'pickup',
    status: 'confirmed', items: 4, subtotal: 950, tax: 171, deliveryFee: 0,
    total: 1121, paymentMethod: 'UPI', createdAt: '2024-12-01 15:30',
    deliveryAddress: '45 Vaishali Nagar, Jaipur'
  },
  {
    id: 'o10', orderNumber: 'QTX-2024-010', customerName: 'Sanjay Mishra', customerPhone: '+91 91234 56798',
    storeName: 'FreshMart Andheri', businessType: 'grocery', orderType: 'subscription',
    status: 'delivered', items: 12, subtotal: 3500, tax: 245, deliveryFee: 0,
    total: 3745, paymentMethod: 'Card', createdAt: '2024-12-01 07:00',
    deliveryAddress: '78 Lokhandwala, Andheri'
  },
];

export const customers: Customer[] = [
  {
    id: 'c1', name: 'Rahul Mehta', email: 'rahul.mehta@email.com', phone: '+91 91234 56789',
    city: 'Mumbai', totalOrders: 48, totalSpent: 56800, loyaltyPoints: 2840,
    lastOrder: '2024-12-01', joinedAt: '2024-03-20', tier: 'gold'
  },
  {
    id: 'c2', name: 'Sneha Iyer', email: 'sneha.iyer@email.com', phone: '+91 91234 56790',
    city: 'Delhi', totalOrders: 32, totalSpent: 32400, loyaltyPoints: 1620,
    lastOrder: '2024-12-01', joinedAt: '2024-04-15', tier: 'silver'
  },
  {
    id: 'c3', name: 'Kavitha Nair', email: 'kavitha.nair@email.com', phone: '+91 91234 56791',
    city: 'Bangalore', totalOrders: 22, totalSpent: 18900, loyaltyPoints: 945,
    lastOrder: '2024-12-01', joinedAt: '2024-06-25', tier: 'silver'
  },
  {
    id: 'c4', name: 'Arjun Desai', email: 'arjun.desai@email.com', phone: '+91 91234 56792',
    city: 'Chennai', totalOrders: 15, totalSpent: 8900, loyaltyPoints: 445,
    lastOrder: '2024-12-01', joinedAt: '2024-08-10', tier: 'bronze'
  },
  {
    id: 'c5', name: 'Meera Joshi', email: 'meera.joshi@email.com', phone: '+91 91234 56793',
    city: 'Hyderabad', totalOrders: 65, totalSpent: 89200, loyaltyPoints: 4460,
    lastOrder: '2024-12-01', joinedAt: '2024-01-05', tier: 'platinum'
  },
  {
    id: 'c6', name: 'Vivek Reddy', email: 'vivek.reddy@email.com', phone: '+91 91234 56794',
    city: 'Pune', totalOrders: 8, totalSpent: 5600, loyaltyPoints: 280,
    lastOrder: '2024-12-01', joinedAt: '2024-09-18', tier: 'bronze'
  },
  {
    id: 'c7', name: 'Ananya Sharma', email: 'ananya.sharma@email.com', phone: '+91 91234 56795',
    city: 'Mumbai', totalOrders: 41, totalSpent: 47300, loyaltyPoints: 2365,
    lastOrder: '2024-12-01', joinedAt: '2024-02-14', tier: 'gold'
  },
  {
    id: 'c8', name: 'Deepak Kumar', email: 'deepak.kumar@email.com', phone: '+91 91234 56796',
    city: 'Delhi', totalOrders: 19, totalSpent: 15200, loyaltyPoints: 760,
    lastOrder: '2024-12-01', joinedAt: '2024-07-01', tier: 'silver'
  },
];

export const deliveries: Delivery[] = [
  {
    id: 'd1', orderId: 'o2', orderNumber: 'QTX-2024-002', customerName: 'Sneha Iyer',
    customerAddress: '22 Janpath, New Delhi', partnerName: 'Sunil Prajapati',
    partnerPhone: '+91 87654 32101', status: 'in_transit',
    pickupAddress: '12 Connaught Place, New Delhi', estimatedDelivery: '13:15',
    distance: 3.2, fee: 45, zone: 'Central Delhi'
  },
  {
    id: 'd2', orderId: 'o1', orderNumber: 'QTX-2024-001', customerName: 'Rahul Mehta',
    customerAddress: '45 SV Road, Andheri West', partnerName: 'Ramesh K.',
    partnerPhone: '+91 87654 32102', status: 'delivered',
    pickupAddress: '123 MG Road, Andheri West', estimatedDelivery: '11:00',
    distance: 1.8, fee: 40, zone: 'Western Suburbs'
  },
  {
    id: 'd3', orderId: 'o3', orderNumber: 'QTX-2024-003', customerName: 'Kavitha Nair',
    customerAddress: '10 HSR Layout, Bangalore', partnerName: 'Ganesh M.',
    partnerPhone: '+91 87654 32103', status: 'picked_up',
    pickupAddress: '56 5th Cross, Koramangala', estimatedDelivery: '10:30',
    distance: 2.5, fee: 35, zone: 'South Bangalore'
  },
  {
    id: 'd4', orderId: 'o5', orderNumber: 'QTX-2024-005', customerName: 'Meera Joshi',
    customerAddress: '55 Jubilee Hills, Hyderabad', partnerName: 'Srinivas R.',
    partnerPhone: '+91 87654 32104', status: 'assigned',
    pickupAddress: '78 Cyber Hills, Madhapur', estimatedDelivery: '17:00',
    distance: 4.1, fee: 55, zone: 'West Hyderabad'
  },
  {
    id: 'd5', orderId: 'o7', orderNumber: 'QTX-2024-007', customerName: 'Ananya Sharma',
    customerAddress: '90 Carter Road, Bandra', partnerName: 'Mohan T.',
    partnerPhone: '+91 87654 32105', status: 'delivered',
    pickupAddress: '45 Hill Road, Bandra West', estimatedDelivery: '09:30',
    distance: 1.2, fee: 40, zone: 'Bandra'
  },
  {
    id: 'd6', orderId: 'o9', orderNumber: 'QTX-2024-009', customerName: 'Priti Patel',
    customerAddress: '45 Vaishali Nagar, Jaipur', partnerName: 'Dinesh J.',
    partnerPhone: '+91 87654 32106', status: 'assigned',
    pickupAddress: 'PressMaster Vaishali Nagar', estimatedDelivery: '16:30',
    distance: 3.8, fee: 40, zone: 'Jaipur West'
  },
];

export const subscriptions: Subscription[] = [
  {
    id: 'sub1', businessId: 'b1', businessName: 'FreshMart Groceries',
    plan: 'growth', status: 'active', startDate: '2024-03-15', endDate: '2025-03-14',
    monthlyFee: 4999, creditsUsed: 78, creditsTotal: 100,
    features: ['Multi-Store', 'Custom Domain', 'Analytics', 'POS', 'API Access']
  },
  {
    id: 'sub2', businessId: 'b2', businessName: 'QuickBite Foods',
    plan: 'enterprise', status: 'active', startDate: '2024-01-10', endDate: '2025-01-09',
    monthlyFee: 14999, creditsUsed: 42, creditsTotal: 50,
    features: ['Unlimited Stores', 'White Label', 'Priority Support', 'Custom Integrations', 'SLA', 'Dedicated Manager']
  },
  {
    id: 'sub3', businessId: 'b3', businessName: 'SparkleClean Laundry',
    plan: 'starter', status: 'active', startDate: '2024-06-20', endDate: '2025-06-19',
    monthlyFee: 1499, creditsUsed: 28, creditsTotal: 50,
    features: ['Single Store', 'Basic Analytics', 'Email Support']
  },
  {
    id: 'sub4', businessId: 'b4', businessName: 'AquaShine Car Wash',
    plan: 'growth', status: 'active', startDate: '2024-08-05', endDate: '2025-08-04',
    monthlyFee: 4999, creditsUsed: 55, creditsTotal: 100,
    features: ['Multi-Store', 'Custom Domain', 'Analytics', 'POS', 'API Access']
  },
  {
    id: 'sub5', businessId: 'b5', businessName: 'HomeFix Services',
    plan: 'growth', status: 'active', startDate: '2024-04-12', endDate: '2025-04-11',
    monthlyFee: 4999, creditsUsed: 62, creditsTotal: 100,
    features: ['Multi-Store', 'Custom Domain', 'Analytics', 'POS', 'API Access']
  },
  {
    id: 'sub6', businessId: 'b6', businessName: 'GreenBasket Organics',
    plan: 'starter', status: 'expired', startDate: '2024-09-01', endDate: '2024-12-01',
    monthlyFee: 1499, creditsUsed: 50, creditsTotal: 50,
    features: ['Single Store', 'Basic Analytics', 'Email Support']
  },
  {
    id: 'sub7', businessId: 'b7', businessName: 'TasteHub Kitchen',
    plan: 'growth', status: 'active', startDate: '2024-02-28', endDate: '2025-02-27',
    monthlyFee: 4999, creditsUsed: 85, creditsTotal: 100,
    features: ['Multi-Store', 'Custom Domain', 'Analytics', 'POS', 'API Access']
  },
  {
    id: 'sub8', businessId: 'b8', businessName: 'PressMaster Laundry',
    plan: 'starter', status: 'trial', startDate: '2024-07-15', endDate: '2024-10-15',
    monthlyFee: 0, creditsUsed: 12, creditsTotal: 25,
    features: ['Single Store', 'Basic Analytics']
  },
];

export const invoices: Invoice[] = [
  {
    id: 'inv1', invoiceNumber: 'INV-2024-001', businessName: 'FreshMart Groceries',
    amount: 4999, cgst: 450, sgst: 450, igst: 0, total: 5899,
    status: 'paid', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Growth Plan - December 2024'
  },
  {
    id: 'inv2', invoiceNumber: 'INV-2024-002', businessName: 'QuickBite Foods',
    amount: 14999, cgst: 1350, sgst: 1350, igst: 0, total: 17699,
    status: 'paid', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Enterprise Plan - December 2024'
  },
  {
    id: 'inv3', invoiceNumber: 'INV-2024-003', businessName: 'SparkleClean Laundry',
    amount: 1499, cgst: 135, sgst: 135, igst: 0, total: 1769,
    status: 'pending', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Starter Plan - December 2024'
  },
  {
    id: 'inv4', invoiceNumber: 'INV-2024-004', businessName: 'AquaShine Car Wash',
    amount: 4999, cgst: 0, sgst: 0, igst: 900, total: 5899,
    status: 'pending', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Growth Plan - December 2024'
  },
  {
    id: 'inv5', invoiceNumber: 'INV-2024-005', businessName: 'HomeFix Services',
    amount: 4999, cgst: 450, sgst: 450, igst: 0, total: 5899,
    status: 'paid', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Growth Plan - December 2024'
  },
  {
    id: 'inv6', invoiceNumber: 'INV-2024-006', businessName: 'GreenBasket Organics',
    amount: 1499, cgst: 135, sgst: 135, igst: 0, total: 1769,
    status: 'overdue', issueDate: '2024-11-01', dueDate: '2024-11-15',
    description: 'Starter Plan - November 2024'
  },
  {
    id: 'inv7', invoiceNumber: 'INV-2024-007', businessName: 'TasteHub Kitchen',
    amount: 4999, cgst: 450, sgst: 450, igst: 0, total: 5899,
    status: 'paid', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Growth Plan - December 2024'
  },
  {
    id: 'inv8', invoiceNumber: 'INV-2024-008', businessName: 'PressMaster Laundry',
    amount: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
    status: 'paid', issueDate: '2024-12-01', dueDate: '2024-12-15',
    description: 'Trial Period - No Charge'
  },
];

// Chart data
export const revenueData = [
  { month: 'Jul', revenue: 8500000, orders: 8200 },
  { month: 'Aug', revenue: 9200000, orders: 9100 },
  { month: 'Sep', revenue: 10100000, orders: 10500 },
  { month: 'Oct', revenue: 11500000, orders: 11800 },
  { month: 'Nov', revenue: 12800000, orders: 12400 },
  { month: 'Dec', revenue: 13790000, orders: 13280 },
];

export const orderStatusData = [
  { name: 'Delivered', value: 68, color: '#10B981' },
  { name: 'Preparing', value: 12, color: '#F59E0B' },
  { name: 'Out for Delivery', value: 8, color: '#3B82F6' },
  { name: 'Pending', value: 7, color: '#6B7280' },
  { name: 'Cancelled', value: 5, color: '#EF4444' },
];

export const businessTypeData = [
  { name: 'Grocery', value: 35, color: '#10B981' },
  { name: 'Food Delivery', value: 30, color: '#F97316' },
  { name: 'Laundry', value: 12, color: '#06B6D4' },
  { name: 'Car Wash', value: 10, color: '#8B5CF6' },
  { name: 'Home Services', value: 13, color: '#EAB308' },
];

export const subscriptionPlans = [
  {
    name: 'Starter',
    price: 1499,
    period: 'month',
    description: 'Perfect for single-store businesses just getting started',
    features: [
      '1 Store',
      'Up to 500 products',
      'Basic order management',
      'Standard analytics',
      'Email support',
      '50 API credits/day',
    ],
    limitations: [
      'No custom domain',
      'No white-label',
      'No POS integration',
    ],
    color: 'border-slate-300',
    badge: '',
  },
  {
    name: 'Growth',
    price: 4999,
    period: 'month',
    description: 'For growing businesses with multiple locations',
    features: [
      'Up to 5 Stores',
      'Unlimited products',
      'Advanced order management',
      'Full analytics dashboard',
      'Priority support (chat)',
      '100 API credits/day',
      'Custom domain',
      'POS integration',
      'Delivery zone management',
    ],
    limitations: [],
    color: 'border-emerald-500',
    badge: 'Popular',
  },
  {
    name: 'Enterprise',
    price: 14999,
    period: 'month',
    description: 'For large businesses with custom requirements',
    features: [
      'Unlimited Stores',
      'Unlimited products',
      'White-label platform',
      'Custom integrations',
      '24/7 phone support',
      '500 API credits/day',
      'Custom domain',
      'Advanced POS',
      'Multi-zone delivery',
      'SLA guarantee',
      'Dedicated success manager',
    ],
    limitations: [],
    color: 'border-amber-500',
    badge: 'Best Value',
  },
];
