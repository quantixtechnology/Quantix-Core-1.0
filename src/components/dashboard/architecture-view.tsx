'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Database, Layers, FolderTree, Globe, Shield, Users, Monitor,
  Truck, CreditCard, Package, Crown, Rocket, MapPin, Calendar,
  Zap, Server, ChevronDown, ChevronRight, Key, Lock, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, Clock, Cpu, HardDrive,
  Wifi, Bluetooth, Printer, Receipt, ShoppingCart, MapPinned,
  RefreshCw, Bell, Pause, Play, CircleDot, Building2, Store,
  UserCheck, ShieldCheck, Settings, BarChart3, Activity,
  FileCode, GitBranch, Box, Container, Cloud, CloudCog,
  Network, ShieldAlert, Eye, Radio, Smartphone, MonitorSmartphone,
  LayoutTemplate, Wrench, Gauge, Database as DbIcon, ServerCog,
  ArrowDownRight, ArrowRightLeft, GitPullRequest, CircleCheck,
  Timer, ScanLine, QrCode, Navigation, Route, Phone, Mail,
  MessageSquare, Send, Fingerprint, BadgeCheck, ShieldX,
  UserX, UserCog, Scan, IndianRupee, FileText, Calculator,
  CalendarCheck, CalendarX, RotateCcw, HandCoins, Split,
  Tags, Tag, Percent, ToggleLeft, ToggleRight, Circle,
  FileCheck, Download, Upload, Globe2, Link2, ExternalLink,
  Search, Hash, Table2, Binary, Fingerprint as IdIcon,
  ArrowUpRight, ArrowDown, ChevronsUpDown, BookOpen, List,
  BrickWall, Pipette, Palette, PenTool, Sparkles, Workflow,
  CircuitBoard, MemoryStick, RadioTower, Satellite, ShieldCheck as ShieldCheckIcon,
  LayoutGrid, PanelTop, AppWindow, Code2, Terminal, Webhook,
  LifeBuoy, ShieldQuestion, ShieldOff, LockKeyhole, Unlock,
  CheckCheck, ListChecks, ListOrdered, MoveRight, ArrowDownUp,
  PartyPopper, Milestone, Flag, Target, FlagOff,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface SectionData {
  id: string
  number: number
  title: string
  icon: React.ReactNode
  description: string
  badges?: string[]
}

// ============================================================================
// SECTION METADATA
// ============================================================================

const sections: SectionData[] = [
  { id: 'database-schema', number: 1, title: 'Complete Scalable Database Schema', icon: <Database className="size-5" />, description: '30+ Prisma models, 15+ enums, 50+ indexes', badges: ['30+ Models', '15+ Enums', '50+ Indexes'] },
  { id: 'multi-tenant', number: 2, title: 'Multi-Tenant Architecture', icon: <Layers className="size-5" />, description: 'Row-level data isolation using business_id + store_id', badges: ['Isolated', 'Scalable'] },
  { id: 'folder-structure', number: 3, title: 'Folder Structure', icon: <FolderTree className="size-5" />, description: 'Complete monorepo structure', badges: ['Monorepo', 'Turborepo'] },
  { id: 'api-architecture', number: 4, title: 'API Architecture', icon: <Globe className="size-5" />, description: 'REST API structure with middleware chain', badges: ['REST', 'Middleware'] },
  { id: 'auth-flow', number: 5, title: 'Authentication Flow', icon: <Shield className="size-5" />, description: 'OTP-based auth with multiple channels', badges: ['JWT', 'OTP'] },
  { id: 'role-permissions', number: 6, title: 'Role Permission System', icon: <Users className="size-5" />, description: '6 roles with granular permission matrix', badges: ['RBAC', '6 Roles'] },
  { id: 'pos-architecture', number: 7, title: 'POS Architecture', icon: <Monitor className="size-5" />, description: 'Session management, thermal printing, GST invoices', badges: ['POS', 'GST'] },
  { id: 'delivery-architecture', number: 8, title: 'Delivery Architecture', icon: <Truck className="size-5" />, description: 'Haversine-based serviceability, GPS tracking, OTP', badges: ['GPS', 'Haversine'] },
  { id: 'subscription-engine', number: 9, title: 'Subscription Service Engine', icon: <CreditCard className="size-5" />, description: 'Credit-based system for Car Wash / Home Services', badges: ['Credits', 'Rollover'] },
  { id: 'pickup-delivery', number: 10, title: 'Pickup & Delivery Engine', icon: <Package className="size-5" />, description: 'Laundry-style pickup → processing → delivery', badges: ['Pickup', 'OTP'] },
  { id: 'super-admin', number: 11, title: 'Super Admin Architecture', icon: <Crown className="size-5" />, description: 'MANAGED platform, NOT self-service', badges: ['Managed', 'No Self-Service'] },
  { id: 'deployment', number: 12, title: 'Deployment Architecture', icon: <Rocket className="size-5" />, description: 'Replit → Vercel → AWS progression', badges: ['CI/CD', 'Docker'] },
  { id: 'domain-mapping', number: 13, title: 'Domain Mapping Architecture', icon: <MapPin className="size-5" />, description: 'DNS → SSL → Verify → Active', badges: ['SSL', 'DNS'] },
  { id: 'roadmap', number: 14, title: 'Development Roadmap', icon: <Calendar className="size-5" />, description: '12-month phased delivery plan', badges: ['7 Phases', '12 Months'] },
  { id: 'mvp-scope', number: 15, title: 'MVP Scope', icon: <Zap className="size-5" />, description: 'What ships first vs. what comes later', badges: ['MVP', 'Post-MVP'] },
  { id: 'production-architecture', number: 16, title: 'Scalable Production Architecture', icon: <Server className="size-5" />, description: 'CDN, Load Balancer, Redis, Queue, Monitoring', badges: ['99.9% SLA', 'Auto-Scale'] },
]

// ============================================================================
// DATABASE SCHEMA DATA
// ============================================================================

const prismaModels = [
  { name: 'Platform', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'name', type: 'String' }, { name: 'supportEmail', type: 'String' },
    { name: 'supportPhone', type: 'String' }, { name: 'defaultDomain', type: 'String' }, { name: 'createdAt', type: 'DateTime' }, { name: 'updatedAt', type: 'DateTime' },
  ]},
  { name: 'Business', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'name', type: 'String' }, { name: 'slug', type: 'String', unique: true },
    { name: 'type', type: 'BusinessType' }, { name: 'ownerId', type: 'String', fk: 'User' }, { name: 'gstNumber', type: 'String?' },
    { name: 'panNumber', type: 'String?' }, { name: 'logo', type: 'String?' }, { name: 'primaryColor', type: 'String' },
    { name: 'status', type: 'BusinessStatus' }, { name: 'createdAt', type: 'DateTime' }, { name: 'updatedAt', type: 'DateTime' },
  ]},
  { name: 'User', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'email', type: 'String', unique: true }, { name: 'phone', type: 'String?' },
    { name: 'name', type: 'String' }, { name: 'role', type: 'UserRole' }, { name: 'businessId', type: 'String?', fk: 'Business' },
    { name: 'avatar', type: 'String?' }, { name: 'isActive', type: 'Boolean' }, { name: 'lastLogin', type: 'DateTime?' },
  ]},
  { name: 'BusinessSubscription', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business' }, { name: 'planId', type: 'String', fk: 'SubscriptionPlan' },
    { name: 'status', type: 'SubscriptionStatus' }, { name: 'customPrice', type: 'Float?' }, { name: 'discountPercent', type: 'Float?' },
    { name: 'manualPriceOverride', type: 'Boolean' }, { name: 'trialEndsAt', type: 'DateTime?' }, { name: 'currentPeriodStart', type: 'DateTime' },
    { name: 'currentPeriodEnd', type: 'DateTime' }, { name: 'cancelAtPeriodEnd', type: 'Boolean' },
  ]},
  { name: 'DomainMapping', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business' }, { name: 'domain', type: 'String', unique: true },
    { name: 'status', type: 'DomainStatus' }, { name: 'sslProvisioned', type: 'Boolean' }, { name: 'verifiedAt', type: 'DateTime?' },
  ]},
  { name: 'Deployment', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business' }, { name: 'environment', type: 'DeployEnvironment' },
    { name: 'platform', type: 'DeployPlatform' }, { name: 'status', type: 'DeployStatus' }, { name: 'url', type: 'String?' },
    { name: 'deployedAt', type: 'DateTime?' }, { name: 'version', type: 'String' },
  ]},
  { name: 'SalesTeamMember', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'userId', type: 'String', fk: 'User' }, { name: 'target', type: 'Float' },
    { name: 'commission', type: 'Float' }, { name: 'region', type: 'String?' }, { name: 'isActive', type: 'Boolean' },
  ]},
  { name: 'Lead', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'name', type: 'String' }, { name: 'email', type: 'String' },
    { name: 'phone', type: 'String' }, { name: 'businessType', type: 'BusinessType' }, { name: 'assignedTo', type: 'String?', fk: 'SalesTeamMember' },
    { name: 'status', type: 'LeadStatus' }, { name: 'source', type: 'String' }, { name: 'notes', type: 'String?' },
  ]},
  { name: 'SubscriptionPlan', level: 'platform', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'name', type: 'String' }, { name: 'price', type: 'Float' },
    { name: 'billingCycle', type: 'BillingCycle' }, { name: 'features', type: 'String' }, { name: 'maxStores', type: 'Int' },
    { name: 'maxProducts', type: 'Int' }, { name: 'isActive', type: 'Boolean' },
  ]},
  { name: 'Store', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'name', type: 'String' },
    { name: 'address', type: 'String' }, { name: 'lat', type: 'Float' }, { name: 'lng', type: 'Float' },
    { name: 'deliveryRadius', type: 'Float' }, { name: 'phone', type: 'String' }, { name: 'isActive', type: 'Boolean' },
  ]},
  { name: 'Product', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'name', type: 'String' }, { name: 'description', type: 'String?' }, { name: 'price', type: 'Float' },
    { name: 'gstRate', type: 'Float' }, { name: 'hsnCode', type: 'String?' }, { name: 'category', type: 'String' },
    { name: 'images', type: 'String' }, { name: 'isActive', type: 'Boolean' },
  ]},
  { name: 'ProductVariant', level: 'store', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'productId', type: 'String', fk: 'Product' }, { name: 'name', type: 'String' }, { name: 'price', type: 'Float' },
    { name: 'sku', type: 'String' }, { name: 'stock', type: 'Int' },
  ]},
  { name: 'Inventory', level: 'store', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'productId', type: 'String', fk: 'Product' }, { name: 'variantId', type: 'String?', fk: 'ProductVariant' },
    { name: 'quantity', type: 'Int' }, { name: 'lowStockThreshold', type: 'Int' },
  ]},
  { name: 'Order', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String?', fk: 'Store', tenant: true },
    { name: 'customerId', type: 'String', fk: 'User' }, { name: 'orderNumber', type: 'String', unique: true },
    { name: 'type', type: 'OrderType' }, { name: 'status', type: 'OrderStatus' },
    { name: 'subtotal', type: 'Float' }, { name: 'taxTotal', type: 'Float' }, { name: 'deliveryFee', type: 'Float' },
    { name: 'total', type: 'Float' }, { name: 'paymentStatus', type: 'PaymentStatus' },
  ]},
  { name: 'OrderItem', level: 'store', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'orderId', type: 'String', fk: 'Order' }, { name: 'productId', type: 'String', fk: 'Product' },
    { name: 'variantId', type: 'String?', fk: 'ProductVariant' }, { name: 'quantity', type: 'Int' },
    { name: 'unitPrice', type: 'Float' }, { name: 'totalPrice', type: 'Float' }, { name: 'gstRate', type: 'Float' },
  ]},
  { name: 'Delivery', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'orderId', type: 'String', fk: 'Order' }, { name: 'partnerId', type: 'String?', fk: 'User' },
    { name: 'status', type: 'DeliveryStatus' }, { name: 'pickupAddress', type: 'String' },
    { name: 'deliveryAddress', type: 'String' }, { name: 'deliveryLat', type: 'Float' }, { name: 'deliveryLng', type: 'Float' },
    { name: 'otp', type: 'String' }, { name: 'estimatedTime', type: 'DateTime?' }, { name: 'deliveredAt', type: 'DateTime?' },
  ]},
  { name: 'CustomerSubscription', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true },
    { name: 'customerId', type: 'String', fk: 'User' }, { name: 'planId', type: 'String', fk: 'SubscriptionPlan' },
    { name: 'status', type: 'CustSubStatus' }, { name: 'totalCredits', type: 'Int' }, { name: 'usedCredits', type: 'Int' },
    { name: 'remainingCredits', type: 'Int' }, { name: 'currentPeriodStart', type: 'DateTime' },
    { name: 'currentPeriodEnd', type: 'DateTime' }, { name: 'cancelAtPeriodEnd', type: 'Boolean' },
  ]},
  { name: 'SubscriptionUsage', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true },
    { name: 'customerSubId', type: 'String', fk: 'CustomerSubscription' }, { name: 'creditsUsed', type: 'Int' },
    { name: 'serviceType', type: 'String' }, { name: 'usedAt', type: 'DateTime' },
  ]},
  { name: 'POSSession', level: 'store', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true }, { name: 'storeId', type: 'String', fk: 'Store', tenant: true },
    { name: 'userId', type: 'String', fk: 'User' }, { name: 'openingBalance', type: 'Float' },
    { name: 'closingBalance', type: 'Float?' }, { name: 'status', type: 'POSSessionStatus' },
    { name: 'openedAt', type: 'DateTime' }, { name: 'closedAt', type: 'DateTime?' },
  ]},
  { name: 'Invoice', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true },
    { name: 'orderId', type: 'String', fk: 'Order' }, { name: 'invoiceNumber', type: 'String', unique: true },
    { name: 'cgst', type: 'Float' }, { name: 'sgst', type: 'Float' }, { name: 'igst', type: 'Float' },
    { name: 'totalTax', type: 'Float' }, { name: 'pdfUrl', type: 'String?' },
  ]},
  { name: 'Payment', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true },
    { name: 'orderId', type: 'String', fk: 'Order' }, { name: 'amount', type: 'Float' },
    { name: 'method', type: 'PaymentMethod' }, { name: 'status', type: 'PaymentStatus' },
    { name: 'transactionId', type: 'String?' }, { name: 'paidAt', type: 'DateTime?' },
  ]},
  { name: 'TaxConfig', level: 'business', fields: [
    { name: 'id', type: 'String', pk: true }, { name: 'businessId', type: 'String', fk: 'Business', tenant: true },
    { name: 'gstRate', type: 'Float' }, { name: 'hsnCode', type: 'String' },
    { name: 'isInterState', type: 'Boolean' }, { name: 'isActive', type: 'Boolean' },
  ]},
]

const prismaEnums = [
  'BusinessType', 'BusinessStatus', 'UserRole', 'SubscriptionStatus', 'DomainStatus',
  'DeployEnvironment', 'DeployPlatform', 'DeployStatus', 'LeadStatus', 'BillingCycle',
  'OrderType', 'OrderStatus', 'PaymentStatus', 'PaymentMethod', 'DeliveryStatus',
  'CustSubStatus', 'POSSessionStatus',
]

// ============================================================================
// HELPER: LEVEL BADGE COLOR
// ============================================================================

function levelColor(level: string) {
  switch (level) {
    case 'platform': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'business': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    case 'store': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800'
    default: return ''
  }
}

function levelLabel(level: string) {
  switch (level) {
    case 'platform': return 'Platform'
    case 'business': return 'Business'
    case 'store': return 'Store'
    default: return level
  }
}

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

function SectionWrapper({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: SectionData
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      id={section.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: section.number * 0.02 }}
    >
      <Card className={cn(
        'overflow-hidden border-l-4 transition-all duration-200',
        isOpen ? 'border-l-emerald-500 shadow-md' : 'border-l-transparent hover:border-l-emerald-300 hover:shadow-sm'
      )}>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center size-10 rounded-lg',
                isOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
              )}>
                {section.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">#{String(section.number).padStart(2, '0')}</span>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <CardDescription className="mt-1">{section.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {section.badges?.map((badge, i) => (
                <Badge key={i} variant="outline" className="text-[10px] hidden sm:inline-flex border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  {badge}
                </Badge>
              ))}
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-5 text-muted-foreground" />
              </motion.div>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <CardContent className="pt-0">
                <Separator className="mb-6" />
                {children}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// SCHEMA TABLE COMPONENT
// ============================================================================

function SchemaTable({ model }: { model: typeof prismaModels[0] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className={cn(
        'px-3 py-2 flex items-center justify-between',
        model.level === 'platform' ? 'bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800' :
        model.level === 'business' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800' :
        'bg-sky-50 dark:bg-sky-950/30 border-b border-sky-200 dark:border-sky-800'
      )}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">{model.name}</span>
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', levelColor(model.level))}>
            {levelLabel(model.level)}
          </Badge>
        </div>
        <Badge variant="secondary" className="text-[9px]">{model.fields.length} fields</Badge>
      </div>
      <div className="bg-white dark:bg-card">
        {model.fields.map((field, i) => (
          <div key={i} className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-mono border-b last:border-b-0',
            i % 2 === 0 ? 'bg-gray-50/50 dark:bg-muted/20' : ''
          )}>
            {field.pk ? (
              <Key className="size-3 text-amber-500 shrink-0" />
            ) : field.fk ? (
              <Link2 className="size-3 text-blue-500 shrink-0" />
            ) : field.tenant ? (
              <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="size-3 text-gray-300 shrink-0" />
            )}
            <span className="font-semibold text-foreground">{field.name}</span>
            <span className="text-muted-foreground">{field.type}</span>
            <div className="flex-1" />
            <div className="flex gap-1">
              {field.pk && <Badge className="text-[8px] px-1 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">PK</Badge>}
              {field.fk && <Badge className="text-[8px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">FK→{field.fk}</Badge>}
              {field.tenant && <Badge className="text-[8px] px-1 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">TENANT</Badge>}
              {field.unique && <Badge className="text-[8px] px-1 py-0 h-4 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">UNIQ</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// FLOW ARROW COMPONENT
// ============================================================================

function FlowArrow({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-1 py-1', className)}>
      <ArrowDownRight className="size-4 text-emerald-500" />
      {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
    </div>
  )
}

function FlowStep({ icon, title, desc, active }: { icon: React.ReactNode; title: string; desc: string; active?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg border',
      active ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-border bg-card'
    )}>
      <div className={cn(
        'flex items-center justify-center size-8 rounded-md shrink-0',
        active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
      )}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ArchitectureView() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['database-schema']))
  const [searchQuery, setSearchQuery] = useState('')

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setOpenSections(new Set(sections.map(s => s.id)))
  const collapseAll = () => setOpenSections(new Set())

  const filteredSections = sections.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CircuitBoard className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Architecture Documentation</h1>
              <p className="text-sm text-muted-foreground">Quantix Technology — Managed White-Label SaaS Platform</p>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="mt-3 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Table of Contents</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    if (!openSections.has(s.id)) toggleSection(s.id)
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <span className="font-mono text-emerald-500">{String(s.number).padStart(2, '0')}</span>
                  <span className="truncate text-foreground/80">{s.title}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={expandAll} className="text-xs">
                <ChevronsUpDown className="size-3 mr-1" /> Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs">
                <List className="size-3 mr-1" /> Collapse All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {filteredSections.map(section => (
          <SectionWrapper
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          >
            {section.id === 'database-schema' && <DatabaseSchemaSection />}
            {section.id === 'multi-tenant' && <MultiTenantSection />}
            {section.id === 'folder-structure' && <FolderStructureSection />}
            {section.id === 'api-architecture' && <ApiArchitectureSection />}
            {section.id === 'auth-flow' && <AuthFlowSection />}
            {section.id === 'role-permissions' && <RolePermissionsSection />}
            {section.id === 'pos-architecture' && <PosArchitectureSection />}
            {section.id === 'delivery-architecture' && <DeliveryArchitectureSection />}
            {section.id === 'subscription-engine' && <SubscriptionEngineSection />}
            {section.id === 'pickup-delivery' && <PickupDeliverySection />}
            {section.id === 'super-admin' && <SuperAdminSection />}
            {section.id === 'deployment' && <DeploymentSection />}
            {section.id === 'domain-mapping' && <DomainMappingSection />}
            {section.id === 'roadmap' && <RoadmapSection />}
            {section.id === 'mvp-scope' && <MvpScopeSection />}
            {section.id === 'production-architecture' && <ProductionArchitectureSection />}
          </SectionWrapper>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 1: DATABASE SCHEMA
// ============================================================================

function DatabaseSchemaSection() {
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Database className="size-5 text-amber-600" />
          <div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">30+</div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400">Models</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <Hash className="size-5 text-emerald-600" />
          <div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">15+</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Enums</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800">
          <Table2 className="size-5 text-sky-600" />
          <div>
            <div className="text-lg font-bold text-sky-700 dark:text-sky-300">50+</div>
            <div className="text-[10px] text-sky-600 dark:text-sky-400">Indexes</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/50 border">
        <span className="text-xs font-medium text-muted-foreground mr-2">Legend:</span>
        <div className="flex items-center gap-1"><Key className="size-3 text-amber-500" /><span className="text-xs">Primary Key</span></div>
        <div className="flex items-center gap-1"><Link2 className="size-3 text-blue-500" /><span className="text-xs">Foreign Key</span></div>
        <div className="flex items-center gap-1"><ShieldCheck className="size-3 text-emerald-500" /><span className="text-xs">Tenant ID</span></div>
        <div className="flex items-center gap-1"><Badge className="text-[8px] px-1 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">Platform</Badge><span className="text-xs">No businessId</span></div>
        <div className="flex items-center gap-1"><Badge className="text-[8px] px-1 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200">Business</Badge><span className="text-xs">Has businessId</span></div>
        <div className="flex items-center gap-1"><Badge className="text-[8px] px-1 py-0 h-4 bg-sky-100 text-sky-700 border-sky-200">Store</Badge><span className="text-xs">Has businessId + storeId</span></div>
      </div>

      {/* Enums */}
      <div>
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Binary className="size-4 text-emerald-500" /> Enums
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {prismaEnums.map(e => (
            <Badge key={e} variant="outline" className="font-mono text-[10px] border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
              {e}
            </Badge>
          ))}
        </div>
      </div>

      {/* Schema Tables */}
      <div>
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Database className="size-4 text-emerald-500" /> Models
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prismaModels.map(model => (
            <SchemaTable key={model.name} model={model} />
          ))}
        </div>
      </div>

      {/* Highlight */}
      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-start gap-2">
          <ShieldCheck className="size-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            <strong>Key Design Principle:</strong> <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">business_id</code> on ALL tenant tables ensures row-level isolation.
            <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded ml-1">store_id</code> on operational tables further scopes data to a specific store location.
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 2: MULTI-TENANT ARCHITECTURE
// ============================================================================

function MultiTenantSection() {
  return (
    <div className="space-y-5">
      {/* Core Principle */}
      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-2">
          <BrickWall className="size-5 text-emerald-600" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">Core Principle: Shared Infrastructure, Isolated Data</span>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Every business operates on the same database and application, but their data is completely isolated through row-level tenant IDs. No business can ever access another business&apos;s data.
        </p>
      </div>

      {/* Tenant Resolution Flow */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Tenant Resolution Flow</h4>
        <div className="flex flex-col gap-1">
          <FlowStep icon={<Fingerprint className="size-4" />} title="1. User Request" desc="Authenticated request hits the API" active />
          <FlowArrow label="extract from session" />
          <FlowStep icon={<ShieldCheck className="size-4" />} title="2. Session → businessId" desc="JWT token contains businessId claim" active />
          <FlowArrow label="inject into query" />
          <FlowStep icon={<Database className="size-4" />} title="3. All Queries Scoped" desc="WHERE businessId = ? appended automatically" active />
          <FlowArrow label="guaranteed isolation" />
          <FlowStep icon={<Lock className="size-4" />} title="4. Isolated Data Return" desc="Only this tenant's data is returned" active />
        </div>
      </div>

      {/* Three-Level Hierarchy */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Three-Level Data Hierarchy</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="size-4 text-amber-600" />
              <span className="font-semibold text-amber-700 dark:text-amber-300">Platform Level</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">NO businessId — global data</p>
            <div className="space-y-1">
              {['Platform', 'SalesTeamMember', 'Lead', 'SubscriptionPlan'].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <XCircle className="size-3 text-amber-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="size-4 text-emerald-600" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Business Level</span>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Has businessId — tenant-scoped</p>
            <div className="space-y-1">
              {['Business', 'User (clients)', 'Store', 'Order', 'Invoice', 'Payment', 'CustomerSubscription'].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border-2 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Store className="size-4 text-sky-600" />
              <span className="font-semibold text-sky-700 dark:text-sky-300">Store Level</span>
            </div>
            <p className="text-xs text-sky-600 dark:text-sky-400 mb-2">Has businessId AND storeId</p>
            <div className="space-y-1">
              {['Product', 'ProductVariant', 'Inventory', 'OrderItem', 'POSSession', 'Delivery'].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <CheckCircle2 className="size-3 text-sky-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Query Example */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Query Isolation Example</h4>
        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto">
          <div className="text-gray-500">{'// ✅ CORRECT — always filter by businessId'}</div>
          <div>const orders = await db.order.findMany({'{'}</div>
          <div className="text-emerald-400">  where: {'{'} businessId: session.businessId {'}'}</div>
          <div>{'}'}</div>
          <div className="mt-2 text-gray-500">{'// ❌ NEVER — unscoped query leaks cross-tenant data'}</div>
          <div className="text-red-400 line-through">const orders = await db.order.findMany()</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 3: FOLDER STRUCTURE
// ============================================================================

function FolderStructureSection() {
  const treeLines = [
    { indent: 0, name: 'quantix-platform/', icon: <FolderTree className="size-3.5 text-emerald-500" />, bold: true },
    { indent: 1, name: 'apps/', icon: <LayoutGrid className="size-3.5 text-emerald-500" />, bold: true },
    { indent: 2, name: 'web-admin/', icon: <Monitor className="size-3.5 text-sky-500" />, comment: 'Next.js - Admin Dashboard' },
    { indent: 2, name: 'super-admin/', icon: <Crown className="size-3.5 text-amber-500" />, comment: 'Next.js - Super Admin Dashboard' },
    { indent: 2, name: 'customer-app/', icon: <Smartphone className="size-3.5 text-violet-500" />, comment: 'React Native / Expo' },
    { indent: 2, name: 'delivery-app/', icon: <Truck className="size-3.5 text-orange-500" />, comment: 'React Native / Expo' },
    { indent: 2, name: 'admin-app/', icon: <MonitorSmartphone className="size-3.5 text-pink-500" />, comment: 'React Native / Expo' },
    { indent: 2, name: 'business-website/', icon: <LayoutTemplate className="size-3.5 text-teal-500" />, comment: 'Next.js - White-label sites' },
    { indent: 1, name: 'packages/', icon: <Box className="size-3.5 text-emerald-500" />, bold: true },
    { indent: 2, name: 'shared/', icon: <FileCode className="size-3.5 text-gray-500" />, comment: 'Shared types, utils, constants' },
    { indent: 2, name: 'database/', icon: <Database className="size-3.5 text-emerald-500" />, comment: 'Prisma schema & client' },
    { indent: 2, name: 'auth/', icon: <Shield className="size-3.5 text-amber-500" />, comment: 'Auth utilities' },
    { indent: 2, name: 'api-client/', icon: <Globe className="size-3.5 text-sky-500" />, comment: 'Typed API client' },
    { indent: 2, name: 'ui/', icon: <Palette className="size-3.5 text-violet-500" />, comment: 'Shared UI components' },
    { indent: 1, name: 'services/', icon: <Server className="size-3.5 text-emerald-500" />, bold: true },
    { indent: 2, name: 'api-server/', icon: <ServerCog className="size-3.5 text-emerald-600" />, comment: 'Node.js / Express API' },
    { indent: 2, name: 'websocket-service/', icon: <Radio className="size-3.5 text-blue-500" />, comment: 'Socket.io real-time' },
    { indent: 2, name: 'worker-service/', icon: <Cpu className="size-3.5 text-orange-500" />, comment: 'Background jobs' },
    { indent: 2, name: 'notification-service/', icon: <Bell className="size-3.5 text-pink-500" />, comment: 'Push/Email/WhatsApp' },
    { indent: 1, name: 'prisma/', icon: <Database className="size-3.5 text-emerald-500" /> },
    { indent: 1, name: 'docker/', icon: <Container className="size-3.5 text-blue-500" /> },
    { indent: 1, name: 'docs/', icon: <BookOpen className="size-3.5 text-gray-500" /> },
    { indent: 1, name: 'package.json', icon: <FileText className="size-3.5 text-gray-500" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gray-900 dark:bg-gray-950 font-mono text-xs overflow-x-auto">
        {treeLines.map((line, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${line.indent * 20}px` }}>
            {line.indent > 0 && <span className="text-gray-600">{'├── '}</span>}
            <span className="shrink-0">{line.icon}</span>
            <span className={cn('text-green-400', line.bold && 'font-bold')}>{line.name}</span>
            {line.comment && <span className="text-gray-500 ml-2">{'// '}{line.comment}</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="size-4 text-sky-600" />
            <span className="font-semibold text-sm text-sky-700 dark:text-sky-300">6 Apps</span>
          </div>
          <p className="text-xs text-sky-600 dark:text-sky-400">2 Web (Next.js) + 3 Mobile (Expo) + 1 White-label site</p>
        </div>
        <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-1">
            <Box className="size-4 text-emerald-600" />
            <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">5 Packages</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Shared code for types, DB, auth, API client, UI</p>
        </div>
        <div className="p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-1">
            <Server className="size-4 text-orange-600" />
            <span className="font-semibold text-sm text-orange-700 dark:text-orange-300">4 Services</span>
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400">API + WebSocket + Worker + Notifications</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 4: API ARCHITECTURE
// ============================================================================

function ApiArchitectureSection() {
  return (
    <div className="space-y-5">
      {/* REST API Routes */}
      <div>
        <h4 className="font-semibold text-sm mb-3">REST API Route Structure</h4>
        <div className="space-y-2">
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="size-4 text-amber-600" />
              <code className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">/api/platform/*</code>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">Super Admin only — create businesses, deploy, manage plans, sales team</p>
          </div>
          <div className="p-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="size-4 text-violet-600" />
              <code className="font-mono font-bold text-violet-700 dark:text-violet-300 text-sm">/api/sales/*</code>
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400">Sales team — leads, onboarding, follow-ups, renewal tracking</p>
          </div>
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="size-4 text-emerald-600" />
              <code className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">/api/businesses/:businessId/*</code>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Business-scoped — all tenant operations scoped to businessId</p>
          </div>
        </div>
      </div>

      {/* Middleware Chain */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Middleware Chain</h4>
        <div className="flex flex-col gap-1">
          {[
            { icon: <Globe className="size-4" />, title: 'CORS', desc: 'Cross-origin resource sharing', color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' },
            { icon: <Shield className="size-4" />, title: 'Auth', desc: 'JWT verification, session extraction', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' },
            { icon: <Building2 className="size-4" />, title: 'Tenant Resolution', desc: 'Extract businessId from session/token', color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' },
            { icon: <Gauge className="size-4" />, title: 'Rate Limit', desc: '100 req/min per user', color: 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' },
            { icon: <CheckCircle2 className="size-4" />, title: 'Validation', desc: 'Zod schema validation', color: 'bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800' },
            { icon: <Cpu className="size-4" />, title: 'Handler', desc: 'Business logic execution', color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' },
          ].map((step, i) => (
            <div key={i}>
              <div className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border', step.color)}>
                {step.icon}
                <div>
                  <span className="font-semibold text-sm">{step.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">{step.desc}</span>
                </div>
              </div>
              {i < 5 && <FlowArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Response Format */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Standard Response Format</h4>
        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <div className="text-gray-500">{'// Success Response'}</div>
          <div>{'{'}</div>
          <div className="text-emerald-400 ml-4">{'"success": true,'}</div>
          <div className="text-sky-400 ml-4">{'"data": { ... },'}</div>
          <div className="text-gray-400 ml-4">{'"error": null,'}</div>
          <div className="text-amber-400 ml-4">{'"meta": { "page": 1, "limit": 20, "total": 150 }'}</div>
          <div>{'}'}</div>
          <div className="mt-3 text-gray-500">{'// Pagination Parameters'}</div>
          <div className="text-violet-400">?page=1&limit=20&search=query&sort=createdAt:desc</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 5: AUTHENTICATION FLOW
// ============================================================================

function AuthFlowSection() {
  return (
    <div className="space-y-5">
      {/* NO SMS banner */}
      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <XCircle className="size-4 text-red-600" />
          <span className="font-semibold text-sm text-red-700 dark:text-red-300">NO SMS OTP — SMS is not supported as an authentication channel</span>
        </div>
      </div>

      {/* Three Auth Methods */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Email OTP */}
        <div className="p-4 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="size-5 text-sky-600" />
            <span className="font-semibold text-sky-700 dark:text-sky-300">Email OTP</span>
          </div>
          <div className="space-y-1.5">
            {[
              'Enter email address',
              'Send 6-digit OTP to email',
              'User enters OTP',
              'Verify OTP (5 min expiry)',
              'Issue JWT token',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="flex items-center justify-center size-5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 font-bold text-[10px] shrink-0">{i + 1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp OTP */}
        <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="size-5 text-emerald-600" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">WhatsApp OTP</span>
          </div>
          <div className="space-y-1.5">
            {[
              'Enter phone number',
              'Send OTP via WhatsApp Business API',
              'User enters OTP from WhatsApp',
              'Verify OTP (5 min expiry)',
              'Issue JWT token',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="flex items-center justify-center size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 font-bold text-[10px] shrink-0">{i + 1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Push Notification */}
        <div className="p-4 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="size-5 text-violet-600" />
            <span className="font-semibold text-violet-700 dark:text-violet-300">Push Notification</span>
          </div>
          <div className="space-y-1.5">
            {[
              'Register device token',
              'Send push notification',
              'User taps to verify from app',
              'App confirms verification',
              'Issue JWT token',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="flex items-center justify-center size-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 font-bold text-[10px] shrink-0">{i + 1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Session Management</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="size-4 text-emerald-600" />
              <span className="font-semibold text-sm">JWT in httpOnly Cookie</span>
            </div>
            <p className="text-xs text-muted-foreground">Secure, httpOnly, SameSite=Lax cookie prevents XSS access</p>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="size-4 text-emerald-600" />
              <span className="font-semibold text-sm">24h Expiry + Refresh</span>
            </div>
            <p className="text-xs text-muted-foreground">Access token expires in 24h, refresh token for seamless renewal</p>
          </div>
        </div>
      </div>

      {/* NextAuth */}
      <div className="p-3 rounded-lg bg-gray-900 dark:bg-gray-950 font-mono text-xs">
        <div className="text-gray-500 mb-2">{'// NextAuth.js v4 Configuration'}</div>
        <div className="text-emerald-400">NextAuth({'{'}</div>
        <div className="text-sky-400 ml-4">providers: [</div>
        <div className="text-amber-400 ml-8">CredentialsProvider({'{'} name: &quot;email-otp&quot; {'}'}),</div>
        <div className="text-amber-400 ml-8">CredentialsProvider({'{'} name: &quot;whatsapp-otp&quot; {'}'}),</div>
        <div className="text-amber-400 ml-8">CredentialsProvider({'{'} name: &quot;push-notification&quot; {'}'}),</div>
        <div className="text-sky-400 ml-4">],</div>
        <div className="text-emerald-400">{'}'})</div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 6: ROLE PERMISSION SYSTEM
// ============================================================================

function RolePermissionsSection() {
  const roles = [
    {
      name: 'QUANTIX_SUPER_ADMIN',
      icon: <Crown className="size-4" />,
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
      desc: 'Full platform control',
      permissions: ['Create businesses', 'Deploy apps', 'Map domains', 'Set pricing', 'Manage sales team', 'Override subscriptions', 'Feature flags', 'All business operations'],
      cannot: [],
    },
    {
      name: 'QUANTIX_SALES_TEAM',
      icon: <UserCheck className="size-4" />,
      color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300',
      desc: 'Sales & onboarding',
      permissions: ['Manage leads', 'Onboard businesses', 'Follow-ups', 'Renewal tracking', 'View business analytics'],
      cannot: ['Deploy apps', 'Change infrastructure', 'Manage domain DNS'],
    },
    {
      name: 'CLIENT_OWNER',
      icon: <Building2 className="size-4" />,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300',
      desc: 'Business owner (client)',
      permissions: ['Manage products', 'Process orders', 'Manage delivery', 'Use POS', 'Manage staff', 'View reports', 'Configure store', 'View invoices'],
      cannot: ['Create businesses', 'Deploy apps', 'Manage hosting', 'Configure infrastructure', 'Change platform settings'],
    },
    {
      name: 'STORE_MANAGER',
      icon: <Store className="size-4" />,
      color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300',
      desc: 'Store operations',
      permissions: ['Store operations', 'Process orders', 'Manage inventory', 'View store reports'],
      cannot: ['Create/delete stores', 'Manage business settings', 'Add staff above store level'],
    },
    {
      name: 'DELIVERY_STAFF',
      icon: <Truck className="size-4" />,
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300',
      desc: 'Delivery partner',
      permissions: ['View assigned deliveries', 'OTP verification', 'GPS navigation', 'Update delivery status'],
      cannot: ['Accept/reject orders', 'Modify prices', 'Access POS'],
    },
    {
      name: 'CUSTOMER',
      icon: <Users className="size-4" />,
      color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300',
      desc: 'End customer',
      permissions: ['Browse products', 'Place orders', 'Manage subscriptions', 'Track deliveries', 'Make payments'],
      cannot: ['Access admin panels', 'View other customers', 'Modify business data'],
    },
  ]

  return (
    <div className="space-y-5">
      {/* Key Restriction */}
      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-red-600" />
          <span className="font-semibold text-sm text-red-700 dark:text-red-300">
            KEY RESTRICTION: Clients CANNOT create businesses, deploy apps, manage hosting, or configure infrastructure
          </span>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {roles.map(role => (
          <div key={role.name} className="p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('flex items-center justify-center size-8 rounded-lg', role.color)}>
                {role.icon}
              </div>
              <div>
                <div className="font-mono font-bold text-xs">{role.name}</div>
                <div className="text-xs text-muted-foreground">{role.desc}</div>
              </div>
            </div>
            <div className="space-y-1">
              {role.permissions.map(p => (
                <div key={p} className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
              {role.cannot.map(p => (
                <div key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="size-3 text-red-400 shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Permission Matrix Table */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Permission Matrix</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border font-semibold">Permission</th>
                <th className="p-2 border text-center"><Crown className="size-3 mx-auto text-amber-500" /></th>
                <th className="p-2 border text-center"><UserCheck className="size-3 mx-auto text-violet-500" /></th>
                <th className="p-2 border text-center"><Building2 className="size-3 mx-auto text-emerald-500" /></th>
                <th className="p-2 border text-center"><Store className="size-3 mx-auto text-sky-500" /></th>
                <th className="p-2 border text-center"><Truck className="size-3 mx-auto text-orange-500" /></th>
                <th className="p-2 border text-center"><Users className="size-3 mx-auto text-pink-500" /></th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Create Business', true, false, false, false, false, false],
                ['Deploy Apps', true, false, false, false, false, false],
                ['Domain Mapping', true, false, false, false, false, false],
                ['Set Pricing', true, false, false, false, false, false],
                ['Sales / Leads', true, true, false, false, false, false],
                ['Products', true, false, true, true, false, false],
                ['Orders', true, false, true, true, false, true],
                ['POS', true, false, true, true, false, false],
                ['Delivery Ops', true, false, true, true, true, false],
                ['Staff Management', true, false, true, false, false, false],
                ['View Reports', true, true, true, true, false, false],
                ['Browse / Order', false, false, false, false, false, true],
                ['Subscriptions', true, false, true, false, false, true],
              ].map(([perm, ...vals]) => (
                <tr key={perm as string} className="border-t">
                  <td className="p-2 border font-medium">{perm as string}</td>
                  {(vals as boolean[]).map((v, i) => (
                    <td key={i} className="p-2 border text-center">
                      {v ? <CheckCircle2 className="size-3.5 text-emerald-500 mx-auto" /> : <XCircle className="size-3.5 text-red-300 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 7: POS ARCHITECTURE
// ============================================================================

function PosArchitectureSection() {
  return (
    <div className="space-y-5">
      {/* Session Management */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Session Management</h4>
        <div className="flex flex-col gap-1">
          {[
            { icon: <Play className="size-4" />, title: 'Open Session', desc: 'Cashier opens with starting balance', active: true },
            { icon: <ShoppingCart className="size-4" />, title: 'Process Orders', desc: 'Accept payments, generate receipts', active: false },
            { icon: <CircleDot className="size-4" />, title: 'Close Session', desc: 'End of day close with cash count', active: false },
            { icon: <FileText className="size-4" />, title: 'Settlement Report', desc: 'Total sales, cash/card/UPI split, refunds', active: true },
          ].map((step, i) => (
            <div key={i}>
              <FlowStep {...step} />
              {i < 3 && <FlowArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Multi-paper & Printers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">Paper Sizes</h4>
          <div className="space-y-2">
            {[
              { size: '58mm', label: 'Thermal (2 inch)', icon: <Receipt className="size-4" />, use: 'Portable, mobile POS' },
              { size: '80mm', label: 'Thermal (3 inch)', icon: <Receipt className="size-4" />, use: 'Standard retail POS' },
              { size: 'A4', label: 'Laser Printer', icon: <Printer className="size-4" />, use: 'Detailed invoices, reports' },
            ].map(p => (
              <div key={p.size} className="flex items-center gap-3 p-2 rounded-lg border">
                <div className="flex items-center justify-center size-8 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                  {p.icon}
                </div>
                <div>
                  <div className="font-semibold text-xs">{p.size} — {p.label}</div>
                  <div className="text-[10px] text-muted-foreground">{p.use}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">Printer Support</h4>
          <div className="space-y-2">
            {[
              { name: 'Bluetooth Thermal', icon: <Bluetooth className="size-4" />, status: 'Mobile POS' },
              { name: 'USB Thermal', icon: <HardDrive className="size-4" />, status: 'Desktop POS' },
              { name: 'Network Printer', icon: <Wifi className="size-4" />, status: 'Multi-terminal' },
            ].map(p => (
              <div key={p.name} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  {p.icon}
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment & GST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-lg border">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <IndianRupee className="size-4 text-emerald-500" /> Payment Methods
          </h4>
          <div className="flex flex-wrap gap-2">
            {['Cash', 'UPI', 'Card'].map(m => (
              <Badge key={m} className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">{m}</Badge>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-lg border">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Calculator className="size-4 text-emerald-500" /> GST Invoice
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3 text-emerald-500" /> CGST/SGST breakdown</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3 text-emerald-500" /> HSN codes per item</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3 text-emerald-500" /> GSTIN on invoice</div>
          </div>
        </div>
      </div>

      {/* Platforms & Offline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800">
          <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-sky-600" /> Multi-Platform
          </h4>
          <p className="text-xs text-sky-600 dark:text-sky-400">Works on both Web Admin and Admin Mobile App</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Wifi className="size-4 text-amber-600" /> Offline Mode
          </h4>
          <p className="text-xs text-amber-600 dark:text-amber-400">Local storage queue → auto-sync when online</p>
        </div>
      </div>

      {/* Daily Settlement */}
      <div className="p-4 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <BarChart3 className="size-4 text-emerald-600" /> Daily Settlement Report
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-white dark:bg-card border"><div className="font-bold text-sm">₹12,450</div><div className="text-[10px] text-muted-foreground">Total Sales</div></div>
          <div className="p-2 rounded bg-white dark:bg-card border"><div className="font-bold text-sm">₹5,200</div><div className="text-[10px] text-muted-foreground">Cash</div></div>
          <div className="p-2 rounded bg-white dark:bg-card border"><div className="font-bold text-sm">₹4,800</div><div className="text-[10px] text-muted-foreground">UPI</div></div>
          <div className="p-2 rounded bg-white dark:bg-card border"><div className="font-bold text-sm">₹2,450</div><div className="text-[10px] text-muted-foreground">Card</div></div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 8: DELIVERY ARCHITECTURE
// ============================================================================

function DeliveryArchitectureSection() {
  return (
    <div className="space-y-5">
      {/* Complete Flow */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Serviceability & Delivery Flow</h4>
        <div className="flex flex-col gap-1">
          {[
            { icon: <MapPinned className="size-4" />, title: '1. Customer enters address', desc: 'Address with lat/lng coordinates', active: true },
            { icon: <Search className="size-4" />, title: '2. Find nearest store', desc: 'Search stores by lat/lng proximity', active: true },
            { icon: <Route className="size-4" />, title: '3. Calculate distance', desc: 'Haversine Formula between customer & store', active: true },
            { icon: <CheckCircle2 className="size-4" />, title: '4. Check serviceability', desc: 'Distance ≤ store.deliveryRadius → Serviceable', active: true },
            { icon: <XCircle className="size-4" />, title: '5. If out of range', desc: '"Currently not available in your area"', active: false },
            { icon: <UserCheck className="size-4" />, title: '6. Assign delivery partner', desc: 'After order placement', active: true },
            { icon: <Navigation className="size-4" />, title: '7. Pickup → Deliver', desc: 'OTP verification at delivery', active: true },
            { icon: <Activity className="size-4" />, title: '8. Live GPS tracking', desc: 'Breadcrumb trail for customer', active: true },
          ].map((step, i) => (
            <div key={i}>
              <FlowStep {...step} />
              {i < 7 && <FlowArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Haversine Formula */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Haversine Formula</h4>
        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <div className="text-gray-500">{'// Calculate great-circle distance between two points on Earth'}</div>
          <div className="text-amber-400 mt-1">d = 2R × arcsin(√(sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)))</div>
          <div className="mt-2 text-gray-500">{'// Where:'}</div>
          <div className="text-sky-400">R = 6,371 km (Earth&apos;s radius)</div>
          <div className="text-sky-400">φ = latitude, λ = longitude</div>
          <div className="text-sky-400">Δφ = φ2 - φ1, Δλ = λ2 - λ1</div>
          <div className="mt-2 text-emerald-400">{'// Serviceability check:'}</div>
          <div className="text-emerald-400">if distance ≤ store.deliveryRadius → ✅ Serviceable</div>
          <div className="text-red-400">if distance &gt; store.deliveryRadius → ❌ Not available</div>
        </div>
      </div>

      {/* Zone-based fee & GPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <IndianRupee className="size-4 text-emerald-500" /> Zone-based Fee
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5"><CircleDot className="size-3 text-emerald-500" /> Zone A (0-3km): ₹20</div>
            <div className="flex items-center gap-1.5"><CircleDot className="size-3 text-amber-500" /> Zone B (3-6km): ₹35</div>
            <div className="flex items-center gap-1.5"><CircleDot className="size-3 text-red-500" /> Zone C (6-10km): ₹50</div>
          </div>
        </div>
        <div className="p-4 rounded-lg border">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Satellite className="size-4 text-emerald-500" /> Live GPS Tracking
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5"><Activity className="size-3 text-emerald-500" /> Real-time breadcrumb trail</div>
            <div className="flex items-center gap-1.5"><Clock className="size-3 text-emerald-500" /> ETA updates every 15s</div>
            <div className="flex items-center gap-1.5"><Navigation className="size-3 text-emerald-500" /> In-app navigation for partner</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 9: SUBSCRIPTION SERVICE ENGINE
// ============================================================================

function SubscriptionEngineSection() {
  return (
    <div className="space-y-5">
      {/* Business Types */}
      <div className="flex flex-wrap gap-2">
        {['Car Wash', 'Home Services', 'Laundry'].map(t => (
          <Badge key={t} className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
            {t}
          </Badge>
        ))}
      </div>

      {/* Credit System */}
      <div className="p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-emerald-600" /> Credit-Based System
        </h4>
        <div className="bg-white dark:bg-card rounded-lg border p-3 mb-3">
          <div className="font-semibold text-sm mb-1">Example: Premium Car Wash Plan</div>
          <div className="text-xs text-muted-foreground mb-2">₹1,999/month</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="font-bold text-lg text-emerald-700 dark:text-emerald-300">15</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Exterior Washes</div>
            </div>
            <div className="p-2 rounded bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
              <div className="font-bold text-lg text-sky-700 dark:text-sky-300">2</div>
              <div className="text-[10px] text-sky-600 dark:text-sky-400">Interior Washes</div>
            </div>
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="font-bold text-lg text-amber-700 dark:text-amber-300">17</div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400">Total Credits</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Each use deducts credits from <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">remainingCredits</code> in CustomerSubscription</p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: <Tags className="size-4" />, title: 'Package Tracking', desc: 'total/used/remaining credits per plan item' },
          { icon: <Clock className="size-4" />, title: 'Expiry Tracking', desc: 'currentPeriodEnd date, auto-expire credits' },
          { icon: <ListChecks className="size-4" />, title: 'Usage History', desc: 'SubscriptionUsage records each use with service type' },
          { icon: <Bell className="size-4" />, title: 'Renewal Reminders', desc: '7 days before → 1 day before → day of' },
          { icon: <RefreshCw className="size-4" />, title: 'Rollover', desc: 'Optional: unused credits carry over, up to rolloverMax' },
          { icon: <Pause className="size-4" />, title: 'Pause / Resume', desc: 'Customer can pause subscription anytime' },
          { icon: <XCircle className="size-4" />, title: 'Cancel', desc: 'cancelAtPeriodEnd flag — finish current period' },
        ].map(f => (
          <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border">
            <div className="flex items-center justify-center size-8 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0 mt-0.5">
              {f.icon}
            </div>
            <div>
              <div className="font-semibold text-sm">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Schema Reference */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
        <div className="text-gray-500">{'// CustomerSubscription key fields'}</div>
        <div className="text-emerald-400">totalCredits: Int     {'// 17'}</div>
        <div className="text-sky-400">usedCredits: Int      {'// 5'}</div>
        <div className="text-amber-400">remainingCredits: Int {'// 12'}</div>
        <div className="text-violet-400">currentPeriodEnd: DateTime</div>
        <div className="text-red-400">cancelAtPeriodEnd: Boolean</div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 10: PICKUP & DELIVERY ENGINE
// ============================================================================

function PickupDeliverySection() {
  return (
    <div className="space-y-5">
      {/* For Laundry etc. */}
      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-emerald-600" />
          <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">For Laundry, Dry Cleaning, and similar services</span>
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Different from regular delivery — involves pickup → processing → delivery cycle</p>
      </div>

      {/* Status Flow */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Order Status Flow</h4>
        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { status: 'PENDING', color: 'text-gray-400' },
              { status: 'PICKUP_ASSIGNED', color: 'text-amber-400' },
              { status: 'PICKED_UP', color: 'text-sky-400' },
              { status: 'PROCESSING', color: 'text-violet-400' },
              { status: 'READY_FOR_DELIVERY', color: 'text-orange-400' },
              { status: 'OUT_FOR_DELIVERY', color: 'text-emerald-400' },
              { status: 'DELIVERED', color: 'text-green-400' },
            ].map((s, i) => (
              <span key={s.status} className="flex items-center gap-1">
                <span className={s.color}>{s.status}</span>
                {i < 6 && <ArrowRight className="size-3 text-gray-600" />}
              </span>
            ))}
          </div>
          <div className="mt-2 text-gray-500">Order type: PICKUP_AND_DELIVERY</div>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: <UserCheck className="size-4" />, title: 'Separate Partners', desc: 'Pickup partner ≠ Delivery partner — each assigned independently' },
          { icon: <CalendarCheck className="size-4" />, title: 'Pickup Scheduling', desc: 'Customer selects date/time slot for pickup' },
          { icon: <Clock className="size-4" />, title: 'Delivery Scheduling', desc: 'Scheduled after processing is complete' },
          { icon: <ScanLine className="size-4" />, title: 'Item Tracking', desc: 'Each clothing item tracked individually through service' },
          { icon: <Wrench className="size-4" />, title: 'Service Status', desc: 'Washing, Ironing, Dry Cleaning, Stain Removal per item' },
          { icon: <ShieldCheck className="size-4" />, title: 'Dual OTP Verification', desc: 'OTP at both pickup AND delivery points' },
        ].map(f => (
          <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border">
            <div className="flex items-center justify-center size-8 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0 mt-0.5">
              {f.icon}
            </div>
            <div>
              <div className="font-semibold text-sm">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Flow */}
      <div className="p-4 rounded-lg border">
        <h4 className="font-semibold text-sm mb-3">Pickup → Processing → Delivery</h4>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {[
            { step: 'Pickup', icon: <Package className="size-5" />, items: ['Customer schedules', 'Partner assigned', 'OTP at pickup'], color: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20' },
            { step: 'Processing', icon: <Wrench className="size-5" />, items: ['Washing/Ironing', 'Per-item tracking', 'Quality check'], color: 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/20' },
            { step: 'Delivery', icon: <Truck className="size-5" />, items: ['Partner assigned', 'Out for delivery', 'OTP at delivery'], color: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20' },
          ].map((phase, i) => (
            <div key={phase.step} className="flex-1">
              <div className={cn('p-3 rounded-lg border-2 h-full', phase.color)}>
                <div className="flex items-center gap-2 mb-2">
                  {phase.icon}
                  <span className="font-bold text-sm">{phase.step}</span>
                </div>
                {phase.items.map(item => (
                  <div key={item} className="text-xs flex items-center gap-1.5 py-0.5">
                    <CheckCircle2 className="size-3 text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
              {i < 2 && <div className="hidden sm:flex items-center justify-center"><ArrowRight className="size-5 text-gray-400" /></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 11: SUPER ADMIN ARCHITECTURE
// ============================================================================

function SuperAdminSection() {
  return (
    <div className="space-y-5">
      {/* Core Principle */}
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-800">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="size-5 text-red-600" />
          <span className="font-bold text-red-700 dark:text-red-300">CORE PRINCIPLE: MANAGED Platform, NOT Self-Service</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">Clients do NOT self-onboard. Quantix team creates, configures, and deploys everything.</p>
      </div>

      {/* Business Creation Flow */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Business Creation Flow</h4>
        <div className="flex flex-col gap-1">
          {[
            { icon: <PlusIcon className="size-4" />, title: 'Super Admin creates business', desc: 'Name, type, owner details' },
            { icon: <Palette className="size-4" />, title: 'Configure branding', desc: 'Logo, primary color, business details' },
            { icon: <Tags className="size-4" />, title: 'Assign plan & pricing', desc: 'Select plan, optionally override price' },
            { icon: <MapPin className="size-4" />, title: 'Map domain', desc: 'Configure DNS, provision SSL' },
            { icon: <Rocket className="size-4" />, title: 'Deploy', desc: 'Build and deploy white-label instance' },
          ].map((step, i) => (
            <div key={i}>
              <FlowStep {...step} active />
              {i < 4 && <FlowArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: <Users className="size-4" />, title: 'Sales Team Management', desc: 'Manage leads, track conversions, assign follow-ups', color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
          { icon: <IndianRupee className="size-4" />, title: 'Custom Pricing', desc: 'Override plan price per customer, discount %, manual_price_override flag', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
          { icon: <Timer className="size-4" />, title: 'Trial Management', desc: 'Set trial period, extend trial, convert to paid', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
          { icon: <ToggleRight className="size-4" />, title: 'Subscription Control', desc: 'Pause, resume, cancel, force-cancel any business subscription', color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30' },
          { icon: <Globe2 className="size-4" />, title: 'Domain Mapping', desc: 'Configure DNS, provision SSL, verify domain ownership', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
          { icon: <Rocket className="size-4" />, title: 'Deployment', desc: 'Build and deploy to Replit/Vercel/AWS', color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30' },
          { icon: <ToggleLeft className="size-4" />, title: 'Feature Flags', desc: 'Enable/disable modules per business', color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30' },
        ].map(f => (
          <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border">
            <div className={cn('flex items-center justify-center size-8 rounded shrink-0 mt-0.5', f.color)}>
              {f.icon}
            </div>
            <div>
              <div className="font-semibold text-sm">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Pricing Detail */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
        <div className="text-gray-500">{'// BusinessSubscription custom pricing fields'}</div>
        <div className="text-amber-400">customPrice: Float?         {'// Override the plan price'}</div>
        <div className="text-sky-400">discountPercent: Float?     {'// E.g., 15% discount'}</div>
        <div className="text-red-400">manualPriceOverride: Boolean {'// Flag: was manually overridden?'}</div>
      </div>
    </div>
  )
}

// Plus icon since it's not always available
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  )
}

// ============================================================================
// SECTION 12: DEPLOYMENT ARCHITECTURE
// ============================================================================

function DeploymentSection() {
  return (
    <div className="space-y-5">
      {/* Phase Progression */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Deployment Phase Progression</h4>
        <div className="space-y-3">
          {[
            { phase: 'Phase 1 (Current)', platform: 'Replit', desc: 'Development + Production on Replit', icon: <Code2 className="size-4" />, color: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20', active: true },
            { phase: 'Phase 2', platform: 'Vercel + AWS RDS', desc: 'Frontend on Vercel, Database on AWS RDS', icon: <Cloud className="size-4" />, color: 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20', active: false },
            { phase: 'Phase 3', platform: 'AWS ECS / DigitalOcean', desc: 'Full control with container orchestration', icon: <Server className="size-4" />, color: 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/20', active: false },
          ].map(p => (
            <div key={p.phase} className={cn('p-4 rounded-lg border-2', p.color)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {p.icon}
                  <span className="font-bold text-sm">{p.phase}</span>
                  {p.active && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Current</Badge>}
                </div>
                <span className="font-mono text-xs">{p.platform}</span>
              </div>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CI/CD */}
      <div>
        <h4 className="font-semibold text-sm mb-3">CI/CD Pipeline</h4>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          {[
            { icon: <GitBranch className="size-4" />, title: 'GitHub Actions', desc: 'Trigger on push/PR' },
            { icon: <Cpu className="size-4" />, title: 'Build', desc: 'Compile & bundle' },
            { icon: <CheckCircle2 className="size-4" />, title: 'Test', desc: 'Unit + Integration' },
            { icon: <Rocket className="size-4" />, title: 'Deploy', desc: 'Auto-deploy to env' },
          ].map((step, i) => (
            <div key={i} className="flex-1">
              <div className="p-3 rounded-lg border bg-card text-center">
                <div className="flex justify-center mb-1">{step.icon}</div>
                <div className="font-semibold text-xs">{step.title}</div>
                <div className="text-[10px] text-muted-foreground">{step.desc}</div>
              </div>
              {i < 3 && <div className="hidden sm:flex items-center justify-center"><ArrowRight className="size-4 text-gray-400" /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Environments & Docker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">Environments</h4>
          <div className="space-y-1.5">
            {[
              { name: 'development', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
              { name: 'staging', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
              { name: 'production', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
            ].map(env => (
              <div key={env.name} className="flex items-center gap-2 p-2 rounded border">
                <Badge className={cn('text-[10px]', env.color)}>{env.name}</Badge>
                <span className="text-xs text-muted-foreground font-mono">{env.name}.quantix.in</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">Docker & Monitoring</h4>
          <div className="space-y-1.5">
            {[
              { icon: <Container className="size-3.5" />, text: 'Docker containers for each service' },
              { icon: <Activity className="size-3.5" />, text: 'Health checks and monitoring' },
              { icon: <RotateCcw className="size-3.5" />, text: 'Auto-restart on failure' },
              { icon: <Eye className="size-3.5" />, text: 'Log aggregation & alerting' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-2 text-xs p-2 rounded border">
                <span className="text-emerald-500">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 13: DOMAIN MAPPING ARCHITECTURE
// ============================================================================

function DomainMappingSection() {
  return (
    <div className="space-y-5">
      {/* Flow */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Domain Mapping Flow</h4>
        <div className="flex flex-col gap-1">
          {[
            { icon: <Globe2 className="size-4" />, title: '1. Client provides domain', desc: 'e.g., shop.clientbusiness.in', active: true },
            { icon: <Link2 className="size-4" />, title: '2. Quantix configures DNS', desc: 'A/CNAME records pointing to platform', active: true },
            { icon: <Clock className="size-4" />, title: '3. Wait for DNS propagation', desc: 'Up to 48 hours', active: false },
            { icon: <ShieldCheck className="size-4" />, title: '4. Provision SSL certificate', desc: 'Let\'s Encrypt / Cloudflare', active: true },
            { icon: <Database className="size-4" />, title: '5. Map domain to business', desc: 'Create DomainMapping record in database', active: true },
            { icon: <CheckCircle2 className="size-4" />, title: '6. Verify and mark ACTIVE', desc: 'SSL verified, domain resolves correctly', active: true },
          ].map((step, i) => (
            <div key={i}>
              <FlowStep {...step} />
              {i < 5 && <FlowArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Status States */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Domain Status States</h4>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { status: 'PENDING_DNS', color: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600' },
            { status: 'DNS_PROPAGATING', color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
            { status: 'SSL_PENDING', color: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700' },
            { status: 'ACTIVE', color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
            { status: 'ERROR', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
          ].map((s, i) => (
            <span key={s.status} className="flex items-center gap-1">
              <Badge className={cn('text-[10px] font-mono', s.color)}>{s.status}</Badge>
              {i < 4 && <ArrowRight className="size-3 text-gray-400" />}
            </span>
          ))}
        </div>
      </div>

      {/* Key Restriction */}
      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <ShieldX className="size-4 text-red-600" />
          <span className="font-semibold text-sm text-red-700 dark:text-red-300">
            Client CANNOT manage DNS/hosting — Quantix handles ALL infrastructure
          </span>
        </div>
      </div>

      {/* Example */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
        <div className="text-gray-500">{'// DomainMapping record'}</div>
        <div>{'{'}</div>
        <div className="text-sky-400 ml-4">domain: &quot;shop.clientbusiness.in&quot;,</div>
        <div className="text-emerald-400 ml-4">businessId: &quot;biz_abc123&quot;,</div>
        <div className="text-amber-400 ml-4">status: &quot;ACTIVE&quot;,</div>
        <div className="text-violet-400 ml-4">sslProvisioned: true,</div>
        <div className="text-gray-400 ml-4">verifiedAt: &quot;2025-01-15T10:30:00Z&quot;</div>
        <div>{'}'}</div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 14: DEVELOPMENT ROADMAP
// ============================================================================

function RoadmapSection() {
  const phases = [
    { phase: 1, months: '1-2', title: 'Core Platform + Super Admin Dashboard', icon: <Crown className="size-4" />, color: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20' },
    { phase: 2, months: '3-4', title: 'Client Admin Panel + POS System', icon: <Monitor className="size-4" />, color: 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20' },
    { phase: 3, months: '5-6', title: 'Customer Mobile App (Expo)', icon: <Smartphone className="size-4" />, color: 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/20' },
    { phase: 4, months: '7', title: 'Delivery Mobile App (Expo)', icon: <Truck className="size-4" />, color: 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20' },
    { phase: 5, months: '8', title: 'Admin Mobile App (Expo)', icon: <MonitorSmartphone className="size-4" />, color: 'border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-950/20' },
    { phase: 6, months: '9-10', title: 'Business Website Builder', icon: <LayoutTemplate className="size-4" />, color: 'border-teal-300 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/20' },
    { phase: 7, months: '11-12', title: 'Scale & Optimize (AWS, monitoring, analytics)', icon: <Rocket className="size-4" />, color: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20' },
  ]

  return (
    <div className="space-y-5">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-emerald-200 dark:bg-emerald-800" />

        <div className="space-y-3">
          {phases.map(p => (
            <div key={p.phase} className="relative flex items-start gap-4 pl-2">
              {/* Dot on timeline */}
              <div className="flex items-center justify-center size-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0 z-10">
                {p.phase}
              </div>
              <div className={cn('flex-1 p-3 rounded-lg border-2', p.color)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {p.icon}
                    <span className="font-semibold text-sm">{p.title}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">Month {p.months}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
          <div className="font-bold text-lg text-emerald-700 dark:text-emerald-300">7</div>
          <div className="text-[10px] text-muted-foreground">Phases</div>
        </div>
        <div className="p-3 rounded-lg border bg-sky-50/50 dark:bg-sky-950/20 text-center">
          <div className="font-bold text-lg text-sky-700 dark:text-sky-300">12</div>
          <div className="text-[10px] text-muted-foreground">Months</div>
        </div>
        <div className="p-3 rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 text-center">
          <div className="font-bold text-lg text-violet-700 dark:text-violet-300">6</div>
          <div className="text-[10px] text-muted-foreground">Apps</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 15: MVP SCOPE
// ============================================================================

function MvpScopeSection() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IN MVP */}
        <div className="p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <span className="font-bold text-emerald-700 dark:text-emerald-300">IN MVP</span>
          </div>
          <div className="space-y-2">
            {[
              { icon: <Crown className="size-3.5" />, text: 'Super Admin Dashboard (create/manage businesses)' },
              { icon: <Monitor className="size-3.5" />, text: 'Client Admin Panel (products, orders, POS)' },
              { icon: <Store className="size-3.5" />, text: '3 business types (Grocery, Food, Laundry)' },
              { icon: <Receipt className="size-3.5" />, text: 'Basic POS with thermal printing' },
              { icon: <Truck className="size-3.5" />, text: 'Delivery with OTP verification' },
              { icon: <FileText className="size-3.5" />, text: 'GST invoices (CGST/SGST breakdown)' },
              { icon: <CreditCard className="size-3.5" />, text: 'Subscription plans (Car Wash)' },
              { icon: <Mail className="size-3.5" />, text: 'Email OTP authentication' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-2 text-xs">
                <div className="text-emerald-500 shrink-0">{item.icon}</div>
                <span className="text-emerald-700 dark:text-emerald-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* POST-MVP */}
        <div className="p-4 rounded-lg border-2 border-sky-300 dark:border-sky-700 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-5 text-sky-600" />
            <span className="font-bold text-sky-700 dark:text-sky-300">POST-MVP</span>
          </div>
          <div className="space-y-2">
            {[
              { icon: <Building2 className="size-3.5" />, text: 'All 11 business types' },
              { icon: <Smartphone className="size-3.5" />, text: 'Customer Mobile App' },
              { icon: <Truck className="size-3.5" />, text: 'Delivery Mobile App' },
              { icon: <MonitorSmartphone className="size-3.5" />, text: 'Admin Mobile App' },
              { icon: <MessageSquare className="size-3.5" />, text: 'WhatsApp OTP' },
              { icon: <BarChart3 className="size-3.5" />, text: 'Advanced analytics' },
              { icon: <LayoutTemplate className="size-3.5" />, text: 'White-label website builder' },
              { icon: <Wifi className="size-3.5" />, text: 'Advanced POS (offline mode)' },
              { icon: <Sparkles className="size-3.5" />, text: 'AI-powered recommendations' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-2 text-xs">
                <div className="text-sky-500 shrink-0">{item.icon}</div>
                <span className="text-sky-700 dark:text-sky-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Business Types */}
      <div>
        <h4 className="font-semibold text-sm mb-2">11 Business Types</h4>
        <div className="flex flex-wrap gap-1.5">
          {[
            { name: 'Grocery', mvp: true },
            { name: 'Food Delivery', mvp: true },
            { name: 'Laundry', mvp: true },
            { name: 'Car Wash', mvp: false },
            { name: 'Home Services', mvp: false },
            { name: 'Pharmacy', mvp: false },
            { name: 'Bakery', mvp: false },
            { name: 'Spa & Salon', mvp: false },
            { name: 'Electronics', mvp: false },
            { name: 'Fashion', mvp: false },
            { name: 'Pet Store', mvp: false },
          ].map(b => (
            <Badge key={b.name} variant="outline" className={cn(
              'text-xs',
              b.mvp
                ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/20'
                : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'
            )}>
              {b.mvp && <CheckCircle2 className="size-3 mr-1" />}
              {b.name}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3 text-emerald-500" /> = MVP &nbsp;&nbsp;
          <Circle className="size-3 text-gray-400" /> = Post-MVP
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 16: PRODUCTION ARCHITECTURE
// ============================================================================

function ProductionArchitectureSection() {
  return (
    <div className="space-y-5">
      {/* Infrastructure Diagram */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Infrastructure Stack</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: <Cloud className="size-5" />, title: 'CDN', detail: 'Cloudflare', desc: 'Static assets, DDoS protection', color: 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' },
            { icon: <Network className="size-5" />, title: 'Load Balancer', detail: 'Nginx / AWS ALB', desc: 'Distribute traffic across instances', color: 'bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800' },
            { icon: <Server className="size-5" />, title: 'API Servers', detail: 'Multiple instances', desc: 'Auto-scaling based on load', color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' },
            { icon: <Database className="size-5" />, title: 'Database', detail: 'PostgreSQL + Read Replicas', desc: 'Primary + replica for read scaling', color: 'bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800' },
            { icon: <Cpu className="size-5" />, title: 'Cache', detail: 'Redis', desc: 'Sessions, product catalog, delivery tracking', color: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' },
            { icon: <Clock className="size-5" />, title: 'Queue', detail: 'Bull / BullMQ', desc: 'Order processing, notifications, jobs', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' },
            { icon: <HardDrive className="size-5" />, title: 'Storage', detail: 'AWS S3', desc: 'Images, invoices, PDFs, backups', color: 'bg-teal-50 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800' },
            { icon: <Activity className="size-5" />, title: 'Monitoring', detail: 'DataDog / Prometheus', desc: 'Metrics, dashboards, alerts', color: 'bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800' },
            { icon: <FileText className="size-5" />, title: 'Logging', detail: 'ELK Stack', desc: 'Centralized log aggregation & search', color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800' },
          ].map(item => (
            <div key={item.title} className={cn('p-3 rounded-lg border', item.color)}>
              <div className="flex items-center gap-2 mb-1">
                {item.icon}
                <span className="font-semibold text-sm">{item.title}</span>
              </div>
              <div className="font-mono text-xs font-bold mb-0.5">{item.detail}</div>
              <div className="text-[10px] text-muted-foreground">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA & Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 text-center">
          <div className="font-bold text-3xl text-emerald-700 dark:text-emerald-300">99.9%</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Uptime SLA</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">~8.7 hours downtime/year</div>
        </div>
        <div className="p-4 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 text-center">
          <div className="font-bold text-3xl text-amber-700 dark:text-amber-300">100</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Requests/min per user</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Rate limiting threshold</div>
        </div>
        <div className="p-4 rounded-lg border-2 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/20 text-center">
          <div className="font-bold text-3xl text-sky-700 dark:text-sky-300">Daily</div>
          <div className="text-xs text-sky-600 dark:text-sky-400 mt-1">Automated Backups</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">To AWS S3 with 30-day retention</div>
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="p-4 rounded-lg border bg-muted/30">
        <h4 className="font-semibold text-sm mb-3">Request Flow</h4>
        <div className="flex flex-col sm:flex-row items-stretch gap-2 text-xs">
          {[
            { label: 'Client', sub: 'Browser/App', color: 'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700' },
            { label: 'CDN', sub: 'Cloudflare', color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' },
            { label: 'LB', sub: 'Nginx/ALB', color: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700' },
            { label: 'API', sub: 'Node.js', color: 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700' },
            { label: 'Cache', sub: 'Redis', color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
            { label: 'DB', sub: 'PostgreSQL', color: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700' },
          ].map((item, i) => (
            <div key={i} className="flex-1">
              <div className={cn('p-2 rounded-lg border-2 text-center', item.color)}>
                <div className="font-bold">{item.label}</div>
                <div className="text-[10px] text-muted-foreground">{item.sub}</div>
              </div>
              {i < 5 && <div className="hidden sm:flex items-center justify-center py-1"><ArrowRight className="size-3 text-gray-400" /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Recovery */}
      <div className="p-4 rounded-lg border">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" /> Backup & Recovery
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Daily DB Backup', value: 'S3', icon: <Database className="size-3.5" /> },
            { label: 'Retention', value: '30 days', icon: <Clock className="size-3.5" /> },
            { label: 'RPO', value: '< 1 hour', icon: <Timer className="size-3.5" /> },
            { label: 'RTO', value: '< 4 hours', icon: <RotateCcw className="size-3.5" /> },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <span className="text-emerald-500">{item.icon}</span>
              <div>
                <div className="font-bold text-xs">{item.value}</div>
                <div className="text-[10px] text-muted-foreground">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
