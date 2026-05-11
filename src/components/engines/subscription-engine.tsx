'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const stats = [
  { label: "Active Plans", value: "4", change: "+1" },
  { label: "Total Subscribers", value: "156", change: "+12" },
  { label: "Revenue", value: "\u20B989,500", change: "+6,800" },
  { label: "Renewal Rate", value: "87%", change: "+3%" },
]

const plans = [
  {
    id: 1,
    name: "Starter",
    price: "\u20B9999",
    credits: 20,
    cycle: "Monthly",
    subscribers: 45,
    features: ["20 credits/month", "Basic support", "1 store location", "Standard reports"],
    popular: false,
  },
  {
    id: 2,
    name: "Growth",
    price: "\u20B92,499",
    credits: 60,
    cycle: "Monthly",
    subscribers: 68,
    features: ["60 credits/month", "Priority support", "3 store locations", "Advanced reports", "Custom branding"],
    popular: true,
  },
  {
    id: 3,
    name: "Professional",
    price: "\u20B94,999",
    credits: 150,
    cycle: "Monthly",
    subscribers: 32,
    features: ["150 credits/month", "24/7 support", "10 store locations", "Full analytics", "API access", "White label"],
    popular: false,
  },
  {
    id: 4,
    name: "Enterprise",
    price: "\u20B912,999",
    credits: -1,
    cycle: "Monthly",
    subscribers: 11,
    features: ["Unlimited credits", "Dedicated manager", "Unlimited locations", "Custom integrations", "SLA guarantee"],
    popular: false,
  },
]

const usageEvents = [
  { id: 1, customer: "Rahul Sharma", plan: "Growth", credits: 5, date: "2025-01-15", type: "Order Processing" },
  { id: 2, customer: "Priya Patel", plan: "Starter", credits: 2, date: "2025-01-15", type: "Report Generation" },
  { id: 3, customer: "Amit Kumar", plan: "Professional", credits: 8, date: "2025-01-14", type: "API Calls" },
  { id: 4, customer: "Sneha Reddy", plan: "Growth", credits: 3, date: "2025-01-14", type: "Order Processing" },
  { id: 5, customer: "Vikram Singh", plan: "Enterprise", credits: 12, date: "2025-01-14", type: "Bulk Import" },
  { id: 6, customer: "Anita Desai", plan: "Starter", credits: 1, date: "2025-01-13", type: "Report Generation" },
  { id: 7, customer: "Karthik Nair", plan: "Growth", credits: 4, date: "2025-01-13", type: "Order Processing" },
  { id: 8, customer: "Meera Joshi", plan: "Professional", credits: 6, date: "2025-01-13", type: "API Calls" },
]

export function SubscriptionEngineView() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Subscription Engine</h2>
          <p className="text-xs text-muted-foreground">Manage plans, subscribers, and billing cycles</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-8 w-full justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-xs h-6 px-3">Overview</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs h-6 px-3">Plans</TabsTrigger>
          <TabsTrigger value="usage" className="text-xs h-6 px-3">Usage Tracking</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs h-6 px-3">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <CardContent className="p-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-emerald-600">{stat.change} from last month</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${plan.popular ? "bg-emerald-500" : "bg-gray-300"}`} />
                        <span className="text-muted-foreground">{plan.name}</span>
                      </div>
                      <span className="font-medium">{plan.subscribers} subscribers</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Upcoming Renewals</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Due this week</span>
                    <span className="font-medium">18</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Due next week</span>
                    <span className="font-medium">24</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overdue</span>
                    <span className="font-medium text-red-500">3</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Expiring soon</span>
                    <span className="font-medium text-amber-500">7</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card key={plan.id} className={`p-4 relative ${plan.popular ? "border-emerald-300 ring-1 ring-emerald-200" : ""}`}>
                {plan.popular && (
                  <Badge className="absolute -top-2 right-3 text-[10px] bg-emerald-600 hover:bg-emerald-700 px-2 py-0">Popular</Badge>
                )}
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
                  <CardDescription className="text-[10px]">{plan.subscribers} subscribers</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="mb-3">
                    <span className="text-lg font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">/{plan.cycle.toLowerCase()}</span>
                  </div>
                  <div className="mb-3 text-xs">
                    <span className="text-muted-foreground">Credits: </span>
                    <span className="font-medium">{plan.credits === -1 ? "Unlimited" : plan.credits}</span>
                  </div>
                  <div className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant={plan.popular ? "default" : "outline"} className={`mt-3 h-7 w-full text-xs ${plan.popular ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
                    Edit Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Recent Usage Events</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs">Export</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Customer</TableHead>
                    <TableHead className="text-xs h-8">Plan</TableHead>
                    <TableHead className="text-xs h-8">Type</TableHead>
                    <TableHead className="text-xs h-8">Credits Used</TableHead>
                    <TableHead className="text-xs h-8">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs font-medium">{event.customer}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{event.type}</TableCell>
                      <TableCell className="text-xs font-medium text-emerald-600">{event.credits}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{event.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-xs font-medium">Subscription Settings</CardTitle>
              <CardDescription className="text-[10px]">Configure auto-renewal, grace periods, and reminders</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-xs font-medium">Auto-Renewal</p>
                    <p className="text-[10px] text-muted-foreground">Automatically renew subscriptions at end of cycle</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-xs font-medium">Grace Period</p>
                    <p className="text-[10px] text-muted-foreground">Days after expiry before suspending access</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">3 days</span>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Edit</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-xs font-medium">Renewal Reminder</p>
                    <p className="text-[10px] text-muted-foreground">Days before expiry to send reminder notification</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">7 days</span>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Edit</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-xs font-medium">Max Overdue Days</p>
                    <p className="text-[10px] text-muted-foreground">Maximum days before cancelling overdue subscription</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">30 days</span>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Edit</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
