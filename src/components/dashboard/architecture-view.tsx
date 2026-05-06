'use client';

import { motion } from 'framer-motion';
import {
  Database,
  FolderTree,
  Server,
  Shield,
  Users,
  Building2,
  Monitor,
  CreditCard,
  Truck,
  Map,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// Section component with collapsible
function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div variants={itemVariants}>
      <Card className="overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
          )}
        </button>
        {isOpen && (
          <CardContent className="pt-0 px-4 pb-4 border-t">
            {children}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

// Schema table component
function SchemaTable({ name, fields }: { name: string; fields: { name: string; type: string; key?: string }[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-emerald-600 text-white px-3 py-1.5 flex items-center gap-2">
        <Database className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">{name}</span>
      </div>
      <div className="divide-y">
        {fields.map((field) => (
          <div key={field.name} className="flex items-center gap-2 px-3 py-1 text-xs bg-white">
            {field.key === 'pk' && <span className="text-amber-500 font-bold">🔑</span>}
            {field.key === 'fk' && <span className="text-blue-500">🔗</span>}
            {!field.key && <span className="w-4" />}
            <span className="font-mono font-medium text-slate-700 flex-1">{field.name}</span>
            <span className="text-slate-400 font-mono text-[10px]">{field.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Folder tree component
function FolderItem({ name, type, indent = 0, children }: { name: string; type: 'folder' | 'file'; indent?: number; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 py-0.5 text-xs" style={{ paddingLeft: `${indent * 16}px` }}>
        {type === 'folder' ? (
          <span className="text-amber-500">📁</span>
        ) : (
          <span className="text-slate-400">📄</span>
        )}
        <span className={type === 'folder' ? 'font-semibold text-slate-700' : 'text-slate-600'}>{name}</span>
      </div>
      {children}
    </div>
  );
}

// Role permissions matrix
function PermissionMatrix() {
  const roles = ['Super Admin', 'Business Owner', 'Store Manager', 'Delivery Partner', 'Customer'];
  const permissions = [
    { name: 'Manage Platform', roles: [true, false, false, false, false] },
    { name: 'Manage Businesses', roles: [true, true, false, false, false] },
    { name: 'Manage Stores', roles: [true, true, true, false, false] },
    { name: 'Manage Products', roles: [true, true, true, false, false] },
    { name: 'View Orders', roles: [true, true, true, true, true] },
    { name: 'Create Orders', roles: [true, true, true, false, true] },
    { name: 'Update Order Status', roles: [true, true, true, true, false] },
    { name: 'View Customers', roles: [true, true, true, false, false] },
    { name: 'Manage Deliveries', roles: [true, true, true, true, false] },
    { name: 'View Invoices', roles: [true, true, false, false, false] },
    { name: 'Manage Subscriptions', roles: [true, true, false, false, false] },
    { name: 'POS Access', roles: [true, true, true, false, false] },
    { name: 'View Analytics', roles: [true, true, true, false, false] },
    { name: 'Manage Settings', roles: [true, true, false, false, false] },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-slate-700 sticky left-0 bg-white">Permission</th>
            {roles.map((role) => (
              <th key={role} className="py-2 px-3 font-semibold text-slate-700 text-center min-w-[100px]">{role}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {permissions.map((perm) => (
            <tr key={perm.name} className="hover:bg-slate-50">
              <td className="py-1.5 px-3 text-slate-600 font-medium sticky left-0 bg-white">{perm.name}</td>
              {perm.roles.map((allowed, i) => (
                <td key={i} className="py-1.5 px-3 text-center">
                  {allowed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-200 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Timeline component for roadmap
function TimelineItem({
  phase,
  title,
  duration,
  items,
  status,
}: {
  phase: string;
  title: string;
  duration: string;
  items: string[];
  status: 'completed' | 'in_progress' | 'upcoming';
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
          status === 'completed' ? 'bg-emerald-500 text-white' :
          status === 'in_progress' ? 'bg-amber-500 text-white' :
          'bg-slate-200 text-slate-500'
        )}>
          {phase}
        </div>
        <div className="w-0.5 flex-1 bg-slate-200" />
      </div>
      <div className="pb-6 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <Badge className={`text-[9px] h-4 ${
            status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-500'
          }`} variant="secondary">
            {status === 'completed' ? '✓ Done' : status === 'in_progress' ? '⏳ Active' : '📋 Planned'}
          </Badge>
        </div>
        <p className="text-[10px] text-slate-400 mb-2">{duration}</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item} className="text-xs text-slate-600 flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ArchitectureView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-emerald-50">
            <Layers className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Architecture</h2>
            <p className="text-sm text-slate-500">Complete technical documentation for the Quantix Technology Platform</p>
          </div>
        </div>
      </motion.div>

      {/* Technology Stack Overview */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-emerald-800 mb-3">Technology Stack</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { name: 'Next.js 16', desc: 'Framework', color: 'bg-white' },
                { name: 'TypeScript', desc: 'Language', color: 'bg-white' },
                { name: 'Prisma', desc: 'ORM', color: 'bg-white' },
                { name: 'PostgreSQL', desc: 'Database', color: 'bg-white' },
                { name: 'Redis', desc: 'Cache', color: 'bg-white' },
                { name: 'Docker', desc: 'Deployment', color: 'bg-white' },
                { name: 'Tailwind CSS', desc: 'Styling', color: 'bg-white' },
                { name: 'Socket.io', desc: 'Real-time', color: 'bg-white' },
                { name: 'Stripe/Razorpay', desc: 'Payments', color: 'bg-white' },
                { name: 'AWS S3', desc: 'Storage', color: 'bg-white' },
                { name: 'NextAuth.js', desc: 'Auth', color: 'bg-white' },
                { name: 'Recharts', desc: 'Charts', color: 'bg-white' },
              ].map((tech) => (
                <div key={tech.name} className={`${tech.color} rounded-lg p-2.5 text-center shadow-sm`}>
                  <p className="text-xs font-bold text-slate-800">{tech.name}</p>
                  <p className="text-[10px] text-slate-500">{tech.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* All 10 Sections */}
      <div className="space-y-4">

        {/* 1. Database Schema */}
        <Section
          id="db-schema"
          icon={Database}
          title="1. Complete Database Schema"
          description="All models, fields, relationships, and indexes"
          defaultOpen={true}
        >
          <div className="space-y-6 mt-4">
            <p className="text-xs text-slate-600">
              The Quantix platform uses a <strong>PostgreSQL</strong> database with <strong>Prisma ORM</strong>.
              The schema follows a multi-tenant architecture where each Business is a tenant that owns Stores, Products, Orders, etc.
            </p>

            {/* Entity Relationship Diagram */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Entity Relationship Overview</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">User</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Business</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">Store</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">Product</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] mt-2">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Customer</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold">Order</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-bold">Delivery</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] mt-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Business</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded font-bold">Subscription</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded font-bold">Invoice</span>
              </div>
            </div>

            {/* Schema Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <SchemaTable name="User" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'email', type: 'String @unique' },
                { name: 'password', type: 'String' },
                { name: 'name', type: 'String' },
                { name: 'role', type: 'Enum(SUPER_ADMIN, OWNER, MANAGER, PARTNER, CUSTOMER)' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'avatar', type: 'String?' },
                { name: 'isActive', type: 'Boolean @default(true)' },
                { name: 'createdAt', type: 'DateTime' },
                { name: 'updatedAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Business" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'name', type: 'String' },
                { name: 'type', type: 'Enum(GROCERY, FOOD, LAUNDRY, CAR_WASH, HOME_SERVICES)' },
                { name: 'slug', type: 'String @unique' },
                { name: 'ownerId', type: 'UUID', key: 'fk' },
                { name: 'email', type: 'String' },
                { name: 'phone', type: 'String' },
                { name: 'address', type: 'String' },
                { name: 'city', type: 'String' },
                { name: 'logo', type: 'String?' },
                { name: 'customDomain', type: 'String?' },
                { name: 'status', type: 'Enum(ACTIVE, INACTIVE, SUSPENDED)' },
                { name: 'gstNumber', type: 'String?' },
                { name: 'createdAt', type: 'DateTime' },
                { name: 'updatedAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Store" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'name', type: 'String' },
                { name: 'address', type: 'String' },
                { name: 'city', type: 'String' },
                { name: 'latitude', type: 'Float' },
                { name: 'longitude', type: 'Float' },
                { name: 'deliveryRadius', type: 'Int (km)' },
                { name: 'status', type: 'Enum(ACTIVE, INACTIVE, MAINTENANCE)' },
                { name: 'managerId', type: 'UUID?', key: 'fk' },
                { name: 'phone', type: 'String' },
                { name: 'rating', type: 'Float @default(0)' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Product" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'storeId', type: 'UUID', key: 'fk' },
                { name: 'name', type: 'String' },
                { name: 'description', type: 'String?' },
                { name: 'category', type: 'String' },
                { name: 'price', type: 'Float' },
                { name: 'mrp', type: 'Float' },
                { name: 'stock', type: 'Int' },
                { name: 'unit', type: 'String' },
                { name: 'gstRate', type: 'Float' },
                { name: 'images', type: 'String[]' },
                { name: 'status', type: 'Enum(ACTIVE, INACTIVE, OUT_OF_STOCK)' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Order" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'orderNumber', type: 'String @unique' },
                { name: 'customerId', type: 'UUID', key: 'fk' },
                { name: 'storeId', type: 'UUID', key: 'fk' },
                { name: 'orderType', type: 'Enum(DELIVERY, PICKUP, POS, SUBSCRIPTION)' },
                { name: 'status', type: 'Enum(PENDING, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED)' },
                { name: 'subtotal', type: 'Float' },
                { name: 'tax', type: 'Float' },
                { name: 'deliveryFee', type: 'Float @default(0)' },
                { name: 'discount', type: 'Float @default(0)' },
                { name: 'total', type: 'Float' },
                { name: 'paymentMethod', type: 'String' },
                { name: 'paymentStatus', type: 'Enum(PENDING, PAID, REFUNDED)' },
                { name: 'deliveryAddress', type: 'String?' },
                { name: 'deliveryPartnerId', type: 'UUID?', key: 'fk' },
                { name: 'notes', type: 'String?' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="OrderItem" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'orderId', type: 'UUID', key: 'fk' },
                { name: 'productId', type: 'UUID', key: 'fk' },
                { name: 'quantity', type: 'Int' },
                { name: 'price', type: 'Float' },
                { name: 'gstRate', type: 'Float' },
                { name: 'total', type: 'Float' },
              ]} />
              <SchemaTable name="Customer" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'name', type: 'String' },
                { name: 'email', type: 'String' },
                { name: 'phone', type: 'String' },
                { name: 'address', type: 'String?' },
                { name: 'city', type: 'String' },
                { name: 'loyaltyPoints', type: 'Int @default(0)' },
                { name: 'tier', type: 'Enum(BRONZE, SILVER, GOLD, PLATINUM)' },
                { name: 'totalOrders', type: 'Int @default(0)' },
                { name: 'totalSpent', type: 'Float @default(0)' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Delivery" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'orderId', type: 'UUID', key: 'fk' },
                { name: 'partnerId', type: 'UUID', key: 'fk' },
                { name: 'status', type: 'Enum(ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED)' },
                { name: 'pickupLat', type: 'Float' },
                { name: 'pickupLng', type: 'Float' },
                { name: 'dropLat', type: 'Float' },
                { name: 'dropLng', type: 'Float' },
                { name: 'distance', type: 'Float' },
                { name: 'fee', type: 'Float' },
                { name: 'zone', type: 'String' },
                { name: 'estimatedDelivery', type: 'DateTime' },
                { name: 'actualDelivery', type: 'DateTime?' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Subscription" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'plan', type: 'Enum(STARTER, GROWTH, ENTERPRISE)' },
                { name: 'status', type: 'Enum(ACTIVE, EXPIRED, CANCELLED, TRIAL)' },
                { name: 'startDate', type: 'DateTime' },
                { name: 'endDate', type: 'DateTime' },
                { name: 'monthlyFee', type: 'Float' },
                { name: 'creditsUsed', type: 'Int @default(0)' },
                { name: 'creditsTotal', type: 'Int' },
                { name: 'autoRenew', type: 'Boolean @default(true)' },
                { name: 'createdAt', type: 'DateTime' },
              ]} />
              <SchemaTable name="Invoice" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'invoiceNumber', type: 'String @unique' },
                { name: 'amount', type: 'Float' },
                { name: 'cgst', type: 'Float @default(0)' },
                { name: 'sgst', type: 'Float @default(0)' },
                { name: 'igst', type: 'Float @default(0)' },
                { name: 'total', type: 'Float' },
                { name: 'status', type: 'Enum(PAID, PENDING, OVERDUE)' },
                { name: 'issueDate', type: 'DateTime' },
                { name: 'dueDate', type: 'DateTime' },
                { name: 'paidDate', type: 'DateTime?' },
              ]} />
              <SchemaTable name="POSSession" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'storeId', type: 'UUID', key: 'fk' },
                { name: 'userId', type: 'UUID', key: 'fk' },
                { name: 'startTime', type: 'DateTime' },
                { name: 'endTime', type: 'DateTime?' },
                { name: 'openingBalance', type: 'Float' },
                { name: 'closingBalance', type: 'Float?' },
                { name: 'totalTransactions', type: 'Int @default(0)' },
                { name: 'totalRevenue', type: 'Float @default(0)' },
                { name: 'status', type: 'Enum(OPEN, CLOSED)' },
              ]} />
              <SchemaTable name="DeliveryZone" fields={[
                { name: 'id', type: 'UUID', key: 'pk' },
                { name: 'businessId', type: 'UUID', key: 'fk' },
                { name: 'name', type: 'String' },
                { name: 'polygon', type: 'Json (GeoJSON)' },
                { name: 'baseFee', type: 'Float' },
                { name: 'perKmFee', type: 'Float' },
                { name: 'isActive', type: 'Boolean @default(true)' },
              ]} />
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <strong>Indexes:</strong> Business(slug), Store(businessId, status), Product(storeId, category, status),
              Order(customerId, storeId, status, createdAt), Customer(businessId, phone), Delivery(orderId, partnerId, status)
            </div>
          </div>
        </Section>

        {/* 2. Folder Architecture */}
        <Section
          id="folder-arch"
          icon={FolderTree}
          title="2. Folder Architecture"
          description="Complete project structure and file organization"
        >
          <div className="mt-4 bg-slate-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
            <FolderItem name="quantix-platform/" type="folder" indent={0}>
              <FolderItem name="src/" type="folder" indent={1}>
                <FolderItem name="app/" type="folder" indent={2}>
                  <FolderItem name="(auth)/" type="folder" indent={3}>
                    <FolderItem name="login/page.tsx" type="file" indent={4} />
                    <FolderItem name="register/page.tsx" type="file" indent={4} />
                    <FolderItem name="forgot-password/page.tsx" type="file" indent={4} />
                  </FolderItem>
                  <FolderItem name="(dashboard)/" type="folder" indent={3}>
                    <FolderItem name="layout.tsx" type="file" indent={4} />
                    <FolderItem name="page.tsx" type="file" indent={4} />
                    <FolderItem name="businesses/page.tsx" type="file" indent={4} />
                    <FolderItem name="stores/page.tsx" type="file" indent={4} />
                    <FolderItem name="products/page.tsx" type="file" indent={4} />
                    <FolderItem name="orders/page.tsx" type="file" indent={4} />
                    <FolderItem name="customers/page.tsx" type="file" indent={4} />
                    <FolderItem name="deliveries/page.tsx" type="file" indent={4} />
                    <FolderItem name="subscriptions/page.tsx" type="file" indent={4} />
                    <FolderItem name="pos/page.tsx" type="file" indent={4} />
                    <FolderItem name="invoices/page.tsx" type="file" indent={4} />
                    <FolderItem name="settings/page.tsx" type="file" indent={4} />
                  </FolderItem>
                  <FolderItem name="api/" type="folder" indent={3}>
                    <FolderItem name="auth/[...nextauth]/route.ts" type="file" indent={4} />
                    <FolderItem name="businesses/route.ts" type="file" indent={4} />
                    <FolderItem name="stores/route.ts" type="file" indent={4} />
                    <FolderItem name="products/route.ts" type="file" indent={4} />
                    <FolderItem name="orders/route.ts" type="file" indent={4} />
                    <FolderItem name="customers/route.ts" type="file" indent={4} />
                    <FolderItem name="deliveries/route.ts" type="file" indent={4} />
                    <FolderItem name="subscriptions/route.ts" type="file" indent={4} />
                    <FolderItem name="invoices/route.ts" type="file" indent={4} />
                    <FolderItem name="payments/route.ts" type="file" indent={4} />
                    <FolderItem name="webhooks/route.ts" type="file" indent={4} />
                  </FolderItem>
                  <FolderItem name="layout.tsx" type="file" indent={3} />
                  <FolderItem name="globals.css" type="file" indent={3} />
                </FolderItem>
                <FolderItem name="components/" type="folder" indent={2}>
                  <FolderItem name="ui/" type="folder" indent={3}>
                    <FolderItem name="*.tsx (shadcn components)" type="file" indent={4} />
                  </FolderItem>
                  <FolderItem name="dashboard/" type="folder" indent={3}>
                    <FolderItem name="sidebar.tsx" type="file" indent={4} />
                    <FolderItem name="header.tsx" type="file" indent={4} />
                    <FolderItem name="overview.tsx" type="file" indent={4} />
                    <FolderItem name="data.ts" type="file" indent={4} />
                  </FolderItem>
                  <FolderItem name="shared/" type="folder" indent={3}>
                    <FolderItem name="data-table.tsx" type="file" indent={4} />
                    <FolderItem name="status-badge.tsx" type="file" indent={4} />
                    <FolderItem name="business-icon.tsx" type="file" indent={4} />
                  </FolderItem>
                </FolderItem>
                <FolderItem name="lib/" type="folder" indent={2}>
                  <FolderItem name="db.ts" type="file" indent={3} />
                  <FolderItem name="auth.ts" type="file" indent={3} />
                  <FolderItem name="utils.ts" type="file" indent={3} />
                  <FolderItem name="validations/" type="folder" indent={3}>
                    <FolderItem name="business.ts" type="file" indent={4} />
                    <FolderItem name="order.ts" type="file" indent={4} />
                    <FolderItem name="product.ts" type="file" indent={4} />
                  </FolderItem>
                </FolderItem>
                <FolderItem name="hooks/" type="folder" indent={2}>
                  <FolderItem name="use-businesses.ts" type="file" indent={3} />
                  <FolderItem name="use-orders.ts" type="file" indent={3} />
                  <FolderItem name="use-auth.ts" type="file" indent={3} />
                </FolderItem>
                <FolderItem name="stores/" type="folder" indent={2}>
                  <FolderItem name="auth-store.ts" type="file" indent={3} />
                  <FolderItem name="ui-store.ts" type="file" indent={3} />
                </FolderItem>
                <FolderItem name="types/" type="folder" indent={2}>
                  <FolderItem name="index.ts" type="file" indent={3} />
                </FolderItem>
              </FolderItem>
              <FolderItem name="prisma/" type="folder" indent={1}>
                <FolderItem name="schema.prisma" type="file" indent={2} />
                <FolderItem name="seed.ts" type="file" indent={2} />
                <FolderItem name="migrations/" type="folder" indent={2} />
              </FolderItem>
              <FolderItem name="public/" type="folder" indent={1}>
                <FolderItem name="images/" type="folder" indent={2} />
                <FolderItem name="logo.svg" type="file" indent={2} />
              </FolderItem>
              <FolderItem name="mini-services/" type="folder" indent={1}>
                <FolderItem name="websocket-service/" type="folder" indent={2}>
                  <FolderItem name="index.ts" type="file" indent={3} />
                  <FolderItem name="package.json" type="file" indent={3} />
                </FolderItem>
              </FolderItem>
              <FolderItem name="package.json" type="file" indent={1} />
              <FolderItem name="next.config.ts" type="file" indent={1} />
              <FolderItem name="tsconfig.json" type="file" indent={1} />
              <FolderItem name=".env.local" type="file" indent={1} />
            </FolderItem>
          </div>
        </Section>

        {/* 3. Backend API Structure */}
        <Section
          id="api-structure"
          icon={Server}
          title="3. Backend API Structure"
          description="RESTful API endpoints, middleware, and response formats"
        >
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4 text-xs">
              <p className="text-slate-600 mb-3">All API routes are under <code className="bg-slate-200 px-1 rounded">/api/*</code> and use Next.js Route Handlers. Authentication is handled via NextAuth.js session cookies. Multi-tenant data isolation is enforced through middleware that extracts <code className="bg-slate-200 px-1 rounded">businessId</code> from the session.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  group: 'Authentication',
                  endpoints: [
                    { method: 'POST', path: '/api/auth/register', desc: 'Register new user/business' },
                    { method: 'POST', path: '/api/auth/[...nextauth]', desc: 'NextAuth handler (login, logout, etc.)' },
                    { method: 'POST', path: '/api/auth/forgot-password', desc: 'Send password reset email' },
                  ],
                },
                {
                  group: 'Businesses',
                  endpoints: [
                    { method: 'GET', path: '/api/businesses', desc: 'List all businesses (Super Admin)' },
                    { method: 'POST', path: '/api/businesses', desc: 'Create new business' },
                    { method: 'GET', path: '/api/businesses/:id', desc: 'Get business details' },
                    { method: 'PATCH', path: '/api/businesses/:id', desc: 'Update business' },
                    { method: 'DELETE', path: '/api/businesses/:id', desc: 'Deactivate business' },
                  ],
                },
                {
                  group: 'Stores',
                  endpoints: [
                    { method: 'GET', path: '/api/stores', desc: 'List stores (filtered by business)' },
                    { method: 'POST', path: '/api/stores', desc: 'Create store' },
                    { method: 'GET', path: '/api/stores/:id', desc: 'Get store details' },
                    { method: 'PATCH', path: '/api/stores/:id', desc: 'Update store' },
                  ],
                },
                {
                  group: 'Products',
                  endpoints: [
                    { method: 'GET', path: '/api/products', desc: 'List products (filter by store, category)' },
                    { method: 'POST', path: '/api/products', desc: 'Create product' },
                    { method: 'GET', path: '/api/products/:id', desc: 'Get product' },
                    { method: 'PATCH', path: '/api/products/:id', desc: 'Update product' },
                    { method: 'PATCH', path: '/api/products/:id/stock', desc: 'Update stock quantity' },
                    { method: 'POST', path: '/api/products/bulk', desc: 'Bulk import products' },
                  ],
                },
                {
                  group: 'Orders',
                  endpoints: [
                    { method: 'GET', path: '/api/orders', desc: 'List orders (filter by status, date, type)' },
                    { method: 'POST', path: '/api/orders', desc: 'Create order' },
                    { method: 'GET', path: '/api/orders/:id', desc: 'Get order with items' },
                    { method: 'PATCH', path: '/api/orders/:id/status', desc: 'Update order status' },
                    { method: 'POST', path: '/api/orders/:id/cancel', desc: 'Cancel order' },
                  ],
                },
                {
                  group: 'Deliveries',
                  endpoints: [
                    { method: 'GET', path: '/api/deliveries', desc: 'List active deliveries' },
                    { method: 'PATCH', path: '/api/deliveries/:id/status', desc: 'Update delivery status' },
                    { method: 'GET', path: '/api/deliveries/:id/track', desc: 'Get real-time location' },
                    { method: 'POST', path: '/api/deliveries/:id/assign', desc: 'Assign delivery partner' },
                  ],
                },
                {
                  group: 'Subscriptions & Payments',
                  endpoints: [
                    { method: 'GET', path: '/api/subscriptions', desc: 'List subscriptions' },
                    { method: 'POST', path: '/api/subscriptions', desc: 'Create/upgrade subscription' },
                    { method: 'POST', path: '/api/payments/create-order', desc: 'Razorpay order creation' },
                    { method: 'POST', path: '/api/payments/verify', desc: 'Verify payment signature' },
                    { method: 'POST', path: '/api/webhooks/razorpay', desc: 'Razorpay webhook handler' },
                  ],
                },
                {
                  group: 'Invoices',
                  endpoints: [
                    { method: 'GET', path: '/api/invoices', desc: 'List invoices' },
                    { method: 'GET', path: '/api/invoices/:id', desc: 'Get invoice with GST breakdown' },
                    { method: 'GET', path: '/api/invoices/:id/pdf', desc: 'Download invoice PDF' },
                  ],
                },
              ].map((group) => (
                <div key={group.group}>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">{group.group}</h4>
                  <div className="space-y-1">
                    {group.endpoints.map((ep) => (
                      <div key={ep.path} className="flex items-center gap-2 text-[11px] bg-slate-50 rounded px-3 py-1.5">
                        <Badge className={`text-[9px] h-4 min-w-[36px] justify-center ${
                          ep.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                          ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                          ep.method === 'PATCH' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`} variant="secondary">
                          {ep.method}
                        </Badge>
                        <code className="font-mono text-slate-700">{ep.path}</code>
                        <span className="text-slate-400 ml-auto">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Middleware Chain:</p>
              <p>1. <strong>CORS Handler</strong> - Allow whitelisted origins</p>
              <p>2. <strong>Auth Guard</strong> - Verify NextAuth session</p>
              <p>3. <strong>Tenant Resolver</strong> - Extract businessId from session</p>
              <p>4. <strong>Rate Limiter</strong> - 100 req/min per user (500 for Enterprise)</p>
              <p>5. <strong>Request Logger</strong> - Log method, path, status, duration</p>
            </div>
          </div>
        </Section>

        {/* 4. Authentication Flow */}
        <Section
          id="auth-flow"
          icon={Shield}
          title="4. Authentication Flow"
          description="Login, registration, session management, and security"
        >
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Registration Flow</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-white px-2 py-1 rounded border">User fills registration form</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Email verification sent</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">User clicks verify link</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Business created + Trial sub</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Redirect to dashboard</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Login Flow (NextAuth.js v4)</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-white px-2 py-1 rounded border">Email + Password submitted</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">CredentialsProvider validates</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">JWT token created</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Session cookie set</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Dashboard loaded</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Session Strategy</h4>
              <div className="space-y-2 text-xs text-slate-600">
                <p>• <strong>Strategy:</strong> JWT-based sessions (stateless, no database sessions)</p>
                <p>• <strong>Token Expiry:</strong> 24 hours, with refresh on activity</p>
                <p>• <strong>Session Data:</strong> userId, email, name, role, businessId, businessType</p>
                <p>• <strong>CSRF Protection:</strong> Built-in NextAuth CSRF tokens</p>
                <p>• <strong>OAuth Providers:</strong> Google, GitHub (optional)</p>
                <p>• <strong>Password Reset:</strong> Token-based email flow with 15-minute expiry</p>
                <p>• <strong>Two-Factor Auth:</strong> TOTP-based 2FA for admin accounts (Enterprise)</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Security Measures</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  'bcrypt password hashing (12 rounds)',
                  'HTTP-only secure cookies',
                  'CORS whitelist enforcement',
                  'Rate limiting on auth endpoints',
                  'Input sanitization (XSS prevention)',
                  'SQL injection prevention (Prisma)',
                  'CSRF token on mutations',
                  'IP-based anomaly detection',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 5. Role Permissions */}
        <Section
          id="role-permissions"
          icon={Users}
          title="5. Role Permissions Matrix"
          description="Detailed role-based access control for all platform features"
        >
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {[
                { role: 'Super Admin', desc: 'Full platform control, manages all businesses', color: 'bg-red-50 text-red-700 border-red-200' },
                { role: 'Business Owner', desc: 'Manages their business, stores, and staff', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { role: 'Store Manager', desc: 'Manages single store operations', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { role: 'Delivery Partner', desc: 'Handles deliveries, updates status', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { role: 'Customer', desc: 'Places orders, manages profile', color: 'bg-violet-50 text-violet-700 border-violet-200' },
              ].map((r) => (
                <div key={r.role} className={`rounded-lg border p-3 ${r.color}`}>
                  <p className="text-xs font-bold">{r.role}</p>
                  <p className="text-[10px] opacity-80">{r.desc}</p>
                </div>
              ))}
            </div>
            <PermissionMatrix />
          </div>
        </Section>

        {/* 6. Multi-Tenant Architecture */}
        <Section
          id="multi-tenant"
          icon={Building2}
          title="6. Multi-Tenant Architecture"
          description="How data isolation, custom domains, and white-labeling work"
        >
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <p>Quantix uses a <strong>shared database, shared schema</strong> multi-tenancy model. Each Business entity acts as a tenant. Data isolation is achieved through:</p>
              <ul className="space-y-1 ml-3">
                <li>• <strong>Row-Level Filtering:</strong> All queries include <code className="bg-slate-200 px-1 rounded">WHERE businessId = :id</code> enforced at the Prisma middleware level</li>
                <li>• <strong>Prisma Middleware:</strong> Automatic businessId injection on all create/read operations</li>
                <li>• <strong>API Middleware:</strong> Extracts businessId from authenticated session before any data access</li>
                <li>• <strong>No Cross-Tenant Queries:</strong> All list endpoints are scoped to the authenticated business</li>
              </ul>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Tenant Resolution Flow</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-white px-2 py-1 rounded border">User request arrives</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">NextAuth session extracted</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">businessId from JWT</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Prisma query scoped</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Data returned</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">White-Label & Custom Domains</h4>
              <div className="space-y-2 text-xs text-slate-600">
                <p>• <strong>Custom Domain:</strong> CNAME → quantix.app, SSL via Let&apos;s Encrypt</p>
                <p>• <strong>Theme Customization:</strong> Primary color, logo, favicon per business</p>
                <p>• <strong>Email Branding:</strong> Custom SMTP for transactional emails</p>
                <p>• <strong>App Branding:</strong> PWA name, icons, splash screen per tenant</p>
                <p>• <strong>SEO:</strong> Custom meta tags, OG images per business storefront</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4">
                  <h4 className="text-xs font-bold text-emerald-800 mb-2">Shared Resources</h4>
                  <ul className="space-y-1 text-[10px] text-emerald-700">
                    <li>• Database instance</li>
                    <li>• Application server</li>
                    <li>• Delivery partner pool</li>
                    <li>• Payment gateway</li>
                    <li>• Notification service</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <h4 className="text-xs font-bold text-amber-800 mb-2">Tenant-Isolated Resources</h4>
                  <ul className="space-y-1 text-[10px] text-amber-700">
                    <li>• Business data (products, orders)</li>
                    <li>• Customer records</li>
                    <li>• Store configurations</li>
                    <li>• Branding & themes</li>
                    <li>• Tax settings (GST rates)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>

        {/* 7. POS Architecture */}
        <Section
          id="pos-arch"
          icon={Monitor}
          title="7. POS Architecture"
          description="Point of Sale terminal design, sessions, and offline capability"
        >
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <p>The POS module is a dedicated interface for in-store billing. It supports <strong>multiple terminals per store</strong>, each running an independent session with its own cash drawer management.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs">Session Management</CardTitle></CardHeader>
                <CardContent className="pt-0 text-xs text-slate-600 space-y-1">
                  <p>• Cashier opens session with opening balance</p>
                  <p>• All transactions tracked per session</p>
                  <p>• Session close with cash count reconciliation</p>
                  <p>• Auto-close on shift change</p>
                  <p>• Session report generation</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs">Payment Methods</CardTitle></CardHeader>
                <CardContent className="pt-0 text-xs text-slate-600 space-y-1">
                  <p>• Cash (with change calculation)</p>
                  <p>• UPI QR code generation</p>
                  <p>• Credit/Debit Card (via POS terminal)</p>
                  <p>• Wallet (customer balance)</p>
                  <p>• Split payment support</p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">POS Transaction Flow</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-white px-2 py-1 rounded border">Scan/Search product</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Add to cart</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Apply discounts</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Calculate GST</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Select payment</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-white px-2 py-1 rounded border">Print receipt</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Order created</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-700">Offline Mode</h4>
              <p>• <strong>IndexedDB:</strong> Products cached locally for offline search</p>
              <p>• <strong>Queue:</strong> Orders stored in local queue when offline</p>
              <p>• <strong>Sync:</strong> Auto-sync when connection restored, conflict resolution by timestamp</p>
              <p>• <strong>Barcode Scanner:</strong> Works via USB HID, no network required</p>
              <p>• <strong>Receipt Printer:</strong> Thermal printer via Web Serial API</p>
            </div>
          </div>
        </Section>

        {/* 8. Subscription Package Logic */}
        <Section
          id="subscription-logic"
          icon={CreditCard}
          title="8. Subscription Package Logic"
          description="Plans, credits, billing cycles, and upgrade/downgrade flow"
        >
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-slate-300">
                <CardContent className="p-4 text-center">
                  <Badge className="text-[9px] bg-slate-100 text-slate-600 mb-2" variant="secondary">Starter</Badge>
                  <p className="text-lg font-bold text-slate-900">₹1,499</p>
                  <p className="text-[10px] text-slate-500">/month</p>
                  <div className="mt-3 space-y-1 text-[10px] text-slate-600 text-left">
                    <p>• 1 Store only</p>
                    <p>• 50 API credits/day</p>
                    <p>• 500 products max</p>
                    <p>• Email support</p>
                    <p>• No custom domain</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-500">
                <CardContent className="p-4 text-center">
                  <Badge className="text-[9px] bg-emerald-100 text-emerald-700 mb-2" variant="secondary">Growth ★</Badge>
                  <p className="text-lg font-bold text-slate-900">₹4,999</p>
                  <p className="text-[10px] text-slate-500">/month</p>
                  <div className="mt-3 space-y-1 text-[10px] text-slate-600 text-left">
                    <p>• Up to 5 Stores</p>
                    <p>• 100 API credits/day</p>
                    <p>• Unlimited products</p>
                    <p>• Chat support</p>
                    <p>• Custom domain + POS</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-500">
                <CardContent className="p-4 text-center">
                  <Badge className="text-[9px] bg-amber-100 text-amber-700 mb-2" variant="secondary">Enterprise</Badge>
                  <p className="text-lg font-bold text-slate-900">₹14,999</p>
                  <p className="text-[10px] text-slate-500">/month</p>
                  <div className="mt-3 space-y-1 text-[10px] text-slate-600 text-left">
                    <p>• Unlimited Stores</p>
                    <p>• 500 API credits/day</p>
                    <p>• White-label</p>
                    <p>• 24/7 phone support</p>
                    <p>• Dedicated manager</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-700">Credit System</h4>
              <p>• Each plan includes daily <strong>API credits</strong> for third-party integrations</p>
              <p>• Credits reset daily at midnight IST</p>
              <p>• Unused credits <strong>do not roll over</strong></p>
              <p>• Additional credits: ₹10/credit (Starter), ₹8/credit (Growth), ₹5/credit (Enterprise)</p>
              <p>• Credit usage tracked in <code className="bg-slate-200 px-1 rounded">Subscription.creditsUsed</code></p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Upgrade/Downgrade Logic</h4>
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 px-2 py-1 rounded">Upgrade</span>
                  <span>→ Prorated credit applied immediately, new features unlocked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 px-2 py-1 rounded">Downgrade</span>
                  <span>→ Takes effect at end of billing cycle, excess stores flagged for removal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-100 px-2 py-1 rounded">Cancellation</span>
                  <span>→ Grace period of 7 days, then data archived for 30 days, then deleted</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-700">Billing Cycle</h4>
              <p>• <strong>Payment Gateway:</strong> Razorpay (India), Stripe (International)</p>
              <p>• <strong>Auto-renewal:</strong> Charged on the 1st of each month</p>
              <p>• <strong>GST Invoice:</strong> Auto-generated with CGST/SGST or IGST breakdown</p>
              <p>• <strong>Failed Payment:</strong> 3 retry attempts over 5 days, then suspension</p>
              <p>• <strong>Trial:</strong> 14-day free trial with 25 API credits/day, no credit card required</p>
            </div>
          </div>
        </Section>

        {/* 9. Pickup & Delivery Workflow */}
        <Section
          id="delivery-workflow"
          icon={Truck}
          title="9. Pickup & Delivery Workflow"
          description="End-to-end order fulfillment, delivery partner management, and zone logic"
        >
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Delivery Order Flow</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-slate-100 px-2 py-1 rounded border">Order Placed</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-blue-100 px-2 py-1 rounded border">Store Confirms</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-amber-100 px-2 py-1 rounded border">Preparing</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-purple-100 px-2 py-1 rounded border">Partner Assigned</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-orange-100 px-2 py-1 rounded border">Picked Up</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-purple-100 px-2 py-1 rounded border">In Transit</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Delivered</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">Pickup Order Flow</h4>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="bg-slate-100 px-2 py-1 rounded border">Order Placed</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-blue-100 px-2 py-1 rounded border">Store Confirms</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-amber-100 px-2 py-1 rounded border">Preparing</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Ready for Pickup</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
                <span className="bg-emerald-100 px-2 py-1 rounded border">Customer Collects</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs">Delivery Zone Logic</CardTitle></CardHeader>
                <CardContent className="pt-0 text-xs text-slate-600 space-y-1">
                  <p>• Zones defined as GeoJSON polygons</p>
                  <p>• Base delivery fee per zone</p>
                  <p>• Additional per-km charge</p>
                  <p>• Peak hour surge multiplier</p>
                  <p>• Free delivery above order threshold</p>
                  <p>• Multiple zones per store supported</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs">Partner Assignment</CardTitle></CardHeader>
                <CardContent className="pt-0 text-xs text-slate-600 space-y-1">
                  <p>• Auto-assign nearest available partner</p>
                  <p>• Haversine distance calculation</p>
                  <p>• Partner acceptance timeout: 60s</p>
                  <p>• Auto-reassign on rejection</p>
                  <p>• Partner rating threshold filter</p>
                  <p>• Real-time location via WebSocket</p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-700">Real-Time Tracking</h4>
              <p>• <strong>WebSocket:</strong> Socket.io for live location updates (every 5s)</p>
              <p>• <strong>Event Types:</strong> <code className="bg-slate-200 px-1 rounded">order:status</code>, <code className="bg-slate-200 px-1 rounded">delivery:location</code>, <code className="bg-slate-200 px-1 rounded">delivery:eta</code></p>
              <p>• <strong>ETA Calculation:</strong> Google Maps Distance Matrix API fallback to OSRM</p>
              <p>• <strong>Notifications:</strong> Push notification at each status change via Firebase Cloud Messaging</p>
              <p>• <strong>Proof of Delivery:</strong> Photo capture + OTP verification for high-value orders</p>
            </div>
          </div>
        </Section>

        {/* 10. Development Roadmap */}
        <Section
          id="roadmap"
          icon={Map}
          title="10. Development Roadmap"
          description="Recommended phased development approach with milestones"
        >
          <div className="mt-4 space-y-1">
            <TimelineItem
              phase="1"
              title="Foundation & Core"
              duration="Weeks 1-4 (Month 1)"
              status="completed"
              items={[
                'Project setup: Next.js 16, TypeScript, Tailwind, Prisma',
                'Database schema design and Prisma models',
                'NextAuth.js authentication (credentials + OAuth)',
                'Multi-tenant middleware and data isolation',
                'Basic dashboard UI with sidebar navigation',
                'Business CRUD API and management UI',
              ]}
            />
            <TimelineItem
              phase="2"
              title="Store & Product Management"
              duration="Weeks 5-8 (Month 2)"
              status="completed"
              items={[
                'Store CRUD with location/delivery radius',
                'Product catalog with categories and GST rates',
                'Image upload via AWS S3',
                'Bulk product import (CSV)',
                'Stock management and low-stock alerts',
                'Search and filtering (category, business type)',
              ]}
            />
            <TimelineItem
              phase="3"
              title="Order & Delivery System"
              duration="Weeks 9-14 (Month 3-4)"
              status="in_progress"
              items={[
                'Order creation (delivery, pickup, POS, subscription)',
                'Order status workflow with real-time updates',
                'Socket.io integration for live tracking',
                'Delivery partner registration and assignment',
                'Delivery zone configuration (GeoJSON)',
                'Real-time ETA calculation',
              ]}
            />
            <TimelineItem
              phase="4"
              title="Payments & Subscriptions"
              duration="Weeks 15-18 (Month 5)"
              status="upcoming"
              items={[
                'Razorpay integration for UPI, cards, wallets',
                'Subscription plan creation and management',
                'Auto-renewal and failed payment handling',
                'GST invoice generation with PDF export',
                'Credit system implementation',
                'Payment webhook handlers',
              ]}
            />
            <TimelineItem
              phase="5"
              title="POS & Advanced Features"
              duration="Weeks 19-22 (Month 6)"
              status="upcoming"
              items={[
                'POS terminal UI with session management',
                'Barcode scanner integration (Web Serial API)',
                'Receipt printer support',
                'Offline mode with IndexedDB queue',
                'Customer loyalty program (points, tiers)',
                'Advanced analytics dashboard',
              ]}
            />
            <TimelineItem
              phase="6"
              title="Polish & Launch"
              duration="Weeks 23-26 (Month 7)"
              status="upcoming"
              items={[
                'White-label customization per business',
                'Custom domain support with auto-SSL',
                'Mobile responsive PWA',
                'Performance optimization and caching',
                'Security audit and penetration testing',
                'Production deployment on AWS/Vercel',
                'Documentation and onboarding guides',
              ]}
            />
          </div>
        </Section>

      </div>
    </motion.div>
  );
}
