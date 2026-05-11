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
  { name: "Basic", price: 999, includedWeight: 10, usedWeight: 6.5, overageRate: 80 },
  { name: "Standard", price: 1500, includedWeight: 18, usedWeight: 12, overageRate: 75 },
  { name: "Premium", price: 2200, includedWeight: 25, usedWeight: 8, overageRate: 70 },
]

const pieceCatalog = [
  { item: "Shirt", price: 10 },
  { item: "Pant", price: 10 },
  { item: "T-Shirt", price: 8 },
  { item: "Jeans", price: 15 },
  { item: "Bedsheet", price: 30 },
  { item: "Blanket", price: 50 },
  { item: "Curtain", price: 40 },
  { item: "Towel", price: 5 },
]

const weightTiers = [
  { range: "0-5 kg", rate: 60 },
  { range: "5-10 kg", rate: 55 },
  { range: "10-18 kg", rate: 50 },
  { range: "18+ kg", rate: 45 },
]

const subWashSteps = [
  "Pickup", "Weight Measurement", "Weight Deduction", "Extra Billing (if overage)", "Payment", "Processing", "Delivery",
]

const pieceWashSteps = [
  "Select Items", "Upfront Payment", "Pickup", "Processing", "Delivery",
]

const weightWashSteps = [
  "Booking", "Pickup", "Weight Measurement", "Final Invoice", "Customer Approval", "Payment", "Processing", "Delivery",
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

function SettingRow({ label, value, type = "input" }: { label: string; value: string; type?: "input" | "switch" | "select" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label className="text-xs text-muted-foreground flex-1">{label}</Label>
      {type === "switch" ? (
        <Switch defaultChecked={value === "on"} />
      ) : (
        <Input defaultValue={value} className="h-7 text-xs w-28" />
      )}
    </div>
  )
}

/* ─── Tab 1: Subscription Wash ─── */

function SubscriptionWashTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Subscription Engine" />
        <EngineTag name="Dynamic Billing Engine" />
        <EngineTag name="Pickup & Drop Engine" />
      </div>

      {/* Plan Configuration */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Plan Configuration</CardTitle>
          <CardDescription className="text-xs">Subscription plans with included weight and overage billing</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {subscriptionPlans.map((plan) => {
              const remaining = plan.includedWeight - plan.usedWeight
              return (
                <Card key={plan.name} className="border-emerald-200">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-800">{plan.name}</span>
                      <span className="text-xs font-bold text-emerald-700">&#8377;{plan.price}/mo</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Included Weight</span>
                        <span className="font-medium text-foreground">{plan.includedWeight} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Used (example)</span>
                        <span className="font-medium text-foreground">{plan.usedWeight} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Remaining</span>
                        <span className={`font-medium ${remaining < 3 ? "text-red-600" : "text-emerald-700"}`}>{remaining} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overage Rate</span>
                        <span className="font-medium text-foreground">&#8377;{plan.overageRate}/kg</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${(plan.usedWeight / plan.includedWeight) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{Math.round((plan.usedWeight / plan.includedWeight) * 100)}% used</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weight Tracking */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Weight Tracking</CardTitle>
          <CardDescription className="text-xs">How weight deduction works per booking</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <p className="text-xs font-medium text-emerald-800">Example 1: Within Limit</p>
            <p className="text-xs text-muted-foreground">
              Customer has 10 kg plan, sends 3.5 kg &rarr; Remaining: <span className="font-semibold text-emerald-700">6.5 kg</span>
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">Example 2: Overage</p>
            <p className="text-xs text-muted-foreground">
              Customer has 10 kg plan, sends 12 kg &rarr; Overage: <span className="font-semibold text-amber-700">2 kg</span> &times; &#8377;80 = <span className="font-bold text-amber-800">&#8377;160 extra</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Workflow Steps</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <WorkflowFlow steps={subWashSteps} />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <SettingRow label="Overage Rate per KG" value="₹80" />
          <SettingRow label="Weight Tolerance %" value="5%" />
          <SettingRow label="Minimum Booking Weight" value="1 kg" />
          <SettingRow label="Pickup Scheduling Window" value="2 hours" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Tab 2: Piece-Based Wash ─── */

function PieceBasedWashTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Ecommerce Engine" />
        <EngineTag name="Pickup & Drop Engine" />
      </div>

      {/* Service Catalog */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Service Catalog</CardTitle>
          <CardDescription className="text-xs">Fixed pricing per item type</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-right py-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {pieceCatalog.map((row) => (
                  <tr key={row.item} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.item}</td>
                    <td className="py-2 text-right text-emerald-700 font-semibold">&#8377;{row.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Order Flow */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Order Flow</CardTitle>
          <CardDescription className="text-xs">Customer selects items, pays upfront, then pickup and delivery</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <WorkflowFlow steps={pieceWashSteps} />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <SettingRow label="Minimum Order Amount" value="₹50" />
          <SettingRow label="Pickup Fee" value="₹30" />
          <SettingRow label="Delivery Fee" value="₹30" />
          <SettingRow label="Express Service Surcharge %" value="25%" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Tab 3: Weight-Based Wash ─── */

function WeightBasedWashTab() {
  return (
    <div className="space-y-4">
      {/* Engine Tags */}
      <div className="flex flex-wrap gap-2">
        <EngineTag name="Dynamic Billing Engine" />
        <EngineTag name="Pickup & Drop Engine" />
        <EngineTag name="Approval Workflow Engine" />
      </div>

      {/* Pricing Tiers */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Pricing Tiers</CardTitle>
          <CardDescription className="text-xs">Per-kg rate decreases with higher weight</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {weightTiers.map((tier) => (
              <div key={tier.range} className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">{tier.range}</p>
                <p className="text-sm font-bold text-emerald-700">&#8377;{tier.rate}/kg</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Workflow Steps</CardTitle>
          <CardDescription className="text-xs">Includes customer approval step before payment</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <WorkflowFlow steps={weightWashSteps} />
          <p className="text-xs text-amber-700 mt-2 font-medium">
            * Customer Approval is required after final invoice generation
          </p>
        </CardContent>
      </Card>

      {/* Approval Workflow Config */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Approval Workflow Config</CardTitle>
          <CardDescription className="text-xs">Configure how customer approval works for final invoices</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <div className="flex items-center justify-between gap-3 py-1.5">
            <Label className="text-xs text-muted-foreground flex-1">Customer Approval Required</Label>
            <Switch defaultChecked />
          </div>
          <SettingRow label="Approval Timeout" value="30 minutes" />
          <SettingRow label="Auto-action on Timeout" value="Cancel order" />
          <SettingRow label="Price Change Threshold (requires approval)" value=">20% from estimate" />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-0.5">
          <SettingRow label="Minimum Booking Amount" value="₹100" />
          <SettingRow label="Estimated Cloth Count" value="5 items" />
          <SettingRow label="Actual Weight Measurement Tolerance" value="0.2 kg" />
          <SettingRow label="Invoice Generation Rules" value="Post-measurement" />
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Main Component ─── */

export function LaundryConfiguratorView() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-emerald-800">Laundry Business Model Configurator</h2>
        <p className="text-xs text-muted-foreground mt-1">Configure and visualize how reusable engines combine to power different laundry business models</p>
      </div>

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="subscription" className="text-xs">Subscription Wash</TabsTrigger>
          <TabsTrigger value="piece-based" className="text-xs">Piece-Based Wash</TabsTrigger>
          <TabsTrigger value="weight-based" className="text-xs">Weight-Based Wash</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          <SubscriptionWashTab />
        </TabsContent>

        <TabsContent value="piece-based">
          <PieceBasedWashTab />
        </TabsContent>

        <TabsContent value="weight-based">
          <WeightBasedWashTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
