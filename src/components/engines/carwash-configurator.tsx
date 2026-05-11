'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/* ─── Mock Data ─── */

const subscriptionPlans = [
  {
    name: "Basic Wash",
    price: 599,
    credits: [
      { type: "external_wash", label: "External Wash", total: 4, used: 1 },
    ],
  },
  {
    name: "Standard Care",
    price: 999,
    credits: [
      { type: "external_wash", label: "External Wash", total: 8, used: 5 },
      { type: "internal_wash", label: "Internal Wash", total: 1, used: 0 },
    ],
  },
  {
    name: "Premium Detail",
    price: 1799,
    credits: [
      { type: "external_wash", label: "External Wash", total: 12, used: 3 },
      { type: "internal_wash", label: "Internal Wash", total: 2, used: 1 },
      { type: "detailing", label: "Detailing", total: 1, used: 0 },
    ],
  },
]

const serviceCatalog = [
  { name: "Car External Wash", price: 299, duration: "45 min" },
  { name: "Car Internal Clean", price: 399, duration: "60 min" },
  { name: "Car Full Detail", price: 899, duration: "120 min" },
  { name: "Bike Wash", price: 99, duration: "20 min" },
  { name: "Bike Detail", price: 249, duration: "45 min" },
  { name: "Pickup & Drop Wash (Car)", price: 449, duration: "90 min" },
  { name: "Pickup & Drop Wash (Bike)", price: 199, duration: "60 min" },
]

const productCatalog = [
  { name: "Car Shampoo", price: 350, stock: 45 },
  { name: "Car Polish", price: 550, stock: 30 },
  { name: "Car Perfume", price: 280, stock: 60 },
  { name: "Microfiber Cloth", price: 150, stock: 100 },
  { name: "Tire Shine", price: 320, stock: 25 },
  { name: "Dashboard Cleaner", price: 220, stock: 40 },
]

const bookingSteps = [
  "Select Service", "Pick Date/Time", "Optional Pickup", "Service Assignment", "Completion",
]

const ecommerceSteps = [
  "Browse", "Add to Cart", "Checkout", "Delivery",
]

/* ─── Engine Tag ─── */

function EngineTag({ name }: { name: string }) {
  return (
    <Badge
      variant="outline"
      className="text-xs border-emerald-600 text-emerald-700 bg-emerald-50 px-2 py-0.5"
    >
      {name}
    </Badge>
  )
}

/* ─── Workflow Flow ─── */

function WorkflowFlow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 text-xs font-medium whitespace-nowrap">
            {step}
          </span>
          {i < steps.length - 1 && (
            <span className="text-emerald-500 text-xs font-bold">&rarr;</span>
          )}
        </span>
      ))}
    </div>
  )
}

/* ─── Setting Row ─── */

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label className="text-xs text-muted-foreground flex-1">{label}</Label>
      <Input defaultValue={value} className="h-7 text-xs w-28" />
    </div>
  )
}

/* ─── Credit Badge ─── */

function CreditTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    external_wash: "bg-blue-50 border-blue-200 text-blue-700",
    internal_wash: "bg-violet-50 border-violet-200 text-violet-700",
    detailing: "bg-amber-50 border-amber-200 text-amber-700",
  }
  return (
    <Badge variant="outline" className={`text-xs border px-1.5 py-0 ${colors[type] || ""}`}>
      {type.replace("_", " ")}
    </Badge>
  )
}

/* ─── Tab 1: Subscription Service Plans ─── */

function SubscriptionServiceTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Subscription Engine" />
      </div>

      {/* Plan Configuration */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Plan Configuration</CardTitle>
          <CardDescription className="text-xs">Subscription plans with credit-based service access</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {subscriptionPlans.map((plan) => (
              <Card key={plan.name} className="border-emerald-200">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-800">{plan.name}</span>
                    <span className="text-xs font-bold text-emerald-700">&#8377;{plan.price}/mo</span>
                  </div>
                  <div className="space-y-1.5">
                    {plan.credits.map((credit) => {
                      const remaining = credit.total - credit.used
                      return (
                        <div key={credit.type} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <CreditTypeBadge type={credit.type} />
                            <span className="text-xs text-muted-foreground">{credit.label}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Total: <span className="font-medium text-foreground">{credit.total}</span></span>
                            <span>Used: <span className="font-medium text-foreground">{credit.used}</span></span>
                            <span>Remaining: <span className={`font-medium ${remaining <= 1 ? "text-red-600" : "text-emerald-700"}`}>{remaining}</span></span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${(credit.used / credit.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credit Tracking */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Credit Tracking</CardTitle>
          <CardDescription className="text-xs">How credits are deducted per service</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <p className="text-xs font-medium text-emerald-800">Example: Standard Care Plan</p>
            <p className="text-xs text-muted-foreground">
              Customer has 8 external + 1 internal credits
            </p>
            <p className="text-xs text-muted-foreground">
              Uses 1 external wash &rarr; Remaining: <span className="font-semibold text-emerald-700">7 external + 1 internal</span>
            </p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 space-y-1">
            <p className="text-xs font-medium text-gray-700">Credit Expiry</p>
            <p className="text-xs text-muted-foreground">
              Credits expire at end of billing cycle. No rollover to next month.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Expiry & Renewal */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Expiry & Renewal</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <div className="flex items-center justify-between gap-3 py-1.5">
            <Label className="text-xs text-muted-foreground flex-1">Expiry Tracking</Label>
            <Switch defaultChecked />
          </div>
          <SettingRow label="Renewal Reminder" value="3 days before expiry" />
          <div className="flex items-center justify-between gap-3 py-1.5">
            <Label className="text-xs text-muted-foreground flex-1">Auto-Renewal</Label>
            <Switch defaultChecked />
          </div>
          <SettingRow label="Grace Period" value="2 days" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Tab 2: Standard Service Booking ─── */

function StandardServiceBookingTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Service Booking Engine" />
        <EngineTag name="Pickup & Drop Engine" />
      </div>

      {/* Service Catalog */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Service Catalog</CardTitle>
          <CardDescription className="text-xs">Available services with pricing and duration</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Service</th>
                  <th className="text-right py-2 font-medium">Price</th>
                  <th className="text-right py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {serviceCatalog.map((row) => (
                  <tr key={row.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="py-2 text-right text-emerald-700 font-semibold">&#8377;{row.price}</td>
                    <td className="py-2 text-right text-muted-foreground">{row.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Booking Flow */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Booking Flow</CardTitle>
          <CardDescription className="text-xs">From service selection to completion</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <WorkflowFlow steps={bookingSteps} />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <SettingRow label="Slot Duration" value="30 min" />
          <SettingRow label="Buffer Between Slots" value="15 min" />
          <SettingRow label="Max Bookings per Slot" value="3" />
          <SettingRow label="Pickup Radius" value="5 km" />
          <SettingRow label="Pickup Fee" value="₹50" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Tab 3: Ecommerce Accessories ─── */

function EcommerceAccessoriesTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Ecommerce Engine" />
      </div>

      {/* Product Catalog */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Product Catalog</CardTitle>
          <CardDescription className="text-xs">Car and bike care accessories for online purchase</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {productCatalog.map((product) => (
              <div key={product.name} className="rounded-md border border-gray-200 p-3 space-y-1">
                <p className="text-xs font-medium">{product.name}</p>
                <p className="text-sm font-bold text-emerald-700">&#8377;{product.price}</p>
                <p className="text-xs text-muted-foreground">Stock: <span className={`font-medium ${product.stock < 30 ? "text-red-600" : "text-foreground"}`}>{product.stock}</span></p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Flow */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Order Flow</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <WorkflowFlow steps={ecommerceSteps} />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <SettingRow label="Minimum Order Amount" value="₹200" />
          <SettingRow label="Delivery Fee" value="₹40" />
          <SettingRow label="Free Delivery Above" value="₹500" />
          <SettingRow label="Delivery Radius" value="8 km" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Main Component ─── */

export function CarwashConfiguratorView() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-emerald-800">Car & Bike Wash Business Model Configurator</h2>
        <p className="text-xs text-muted-foreground mt-1">Configure and visualize how reusable engines combine to power different car wash business models</p>
      </div>

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="subscription" className="text-xs">Subscription Plans</TabsTrigger>
          <TabsTrigger value="service-booking" className="text-xs">Service Booking</TabsTrigger>
          <TabsTrigger value="ecommerce" className="text-xs">Ecommerce Accessories</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          <SubscriptionServiceTab />
        </TabsContent>

        <TabsContent value="service-booking">
          <StandardServiceBookingTab />
        </TabsContent>

        <TabsContent value="ecommerce">
          <EcommerceAccessoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
