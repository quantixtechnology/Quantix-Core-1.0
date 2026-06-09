import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"

const SEED_PLANS = [
  {
    planKey: "starter",
    planName: "Starter",
    billingType: "monthly",
    price: 2499,
    priceDisplay: "₹2,499/month",
    implementationFee: 4999,
    description: "Perfect for small businesses getting started",
    discountMessage: null,
    displayOrder: 1,
    isActive: true,
    features: [
      "POS (Point of Sale)",
      "Inventory Management",
      "Customer Management",
      "Basic Reports & Analytics",
      "GST Invoice Generation",
      "Staff Management (up to 5)",
      "WhatsApp Notifications",
      "Email Support",
      "Cloud Backup",
    ],
  },
  {
    planKey: "business",
    planName: "Business",
    billingType: "monthly",
    price: 4999,
    priceDisplay: "₹4,999/month",
    implementationFee: 1999,
    description: "For growing businesses that need more power",
    discountMessage: null,
    displayOrder: 2,
    isActive: true,
    features: [
      "POS (Point of Sale)",
      "Inventory Management",
      "Customer Management",
      "Advanced Reports & Analytics",
      "GST Invoice Generation",
      "Staff Management (unlimited)",
      "WhatsApp Notifications",
      "Priority Email & Chat Support",
      "Cloud Backup",
      "Android App",
      "Delivery Management",
      "1 Store Included",
      "Loyalty & Rewards Program",
    ],
  },
  {
    planKey: "yearly",
    planName: "Business Yearly",
    billingType: "yearly",
    price: 49999,
    priceDisplay: "₹49,999/year",
    implementationFee: 1999,
    description: "All Business features billed annually",
    discountMessage: "Get 2 Months Free",
    displayOrder: 3,
    isActive: true,
    features: [
      "POS (Point of Sale)",
      "Inventory Management",
      "Customer Management",
      "Advanced Reports & Analytics",
      "GST Invoice Generation",
      "Staff Management (unlimited)",
      "WhatsApp Notifications",
      "Priority Email & Chat Support",
      "Cloud Backup",
      "Android App",
      "Delivery Management",
      "1 Store Included",
      "Loyalty & Rewards Program",
    ],
  },
  {
    planKey: "custom",
    planName: "Custom",
    billingType: "custom",
    price: null,
    priceDisplay: "Contact Us",
    implementationFee: null,
    description: "Tailored solution for enterprise and high-volume businesses",
    discountMessage: null,
    displayOrder: 4,
    isActive: true,
    features: [
      "POS (Point of Sale)",
      "Inventory Management",
      "Customer Management",
      "Advanced Reports & Analytics",
      "GST Invoice Generation",
      "Staff Management (unlimited)",
      "WhatsApp Notifications",
      "Dedicated Account Manager",
      "Cloud Backup",
      "Android App",
      "Delivery Management",
      "Multi-Store Management",
      "Loyalty & Rewards Program",
      "Custom Development",
      "Enterprise Integrations",
      "White Label Option",
      "Custom Reporting",
      "SLA-Backed Support",
      "Dedicated Infrastructure",
    ],
  },
  {
    planKey: "additional-store",
    planName: "Additional Store",
    billingType: "monthly",
    price: 1999,
    priceDisplay: "₹1,999/month per store",
    implementationFee: null,
    description: "Add more store locations to your existing plan",
    discountMessage: null,
    displayOrder: 5,
    isActive: true,
    features: [
      "Full POS for New Location",
      "Inventory Sync Across Stores",
      "Separate Staff Management",
      "Consolidated Reporting",
    ],
  },
]

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async () => {
    const count = await prisma.websitePricingPlan.count()

    if (count === 0) {
      for (const plan of SEED_PLANS) {
        const { features, ...planData } = plan
        await prisma.websitePricingPlan.create({
          data: {
            ...planData,
            features: {
              create: features.map((f, i) => ({ featureName: f, displayOrder: i + 1 })),
            },
          },
        })
      }
    }

    const plans = await prisma.websitePricingPlan.findMany({
      include: { features: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ plans })
  }
)
