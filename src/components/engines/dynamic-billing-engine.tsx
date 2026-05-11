'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const stats = [
  { label: "Invoices Today", value: "22", change: "+4" },
  { label: "Revenue", value: "\u20B934,500", change: "+5,200" },
  { label: "Overage Billing", value: "\u20B92,800", change: "+400" },
  { label: "Avg Invoice", value: "\u20B91,568", change: "+120" },
]

const weightTiers = [
  { id: 1, range: "0 - 5 kg", pricePerKg: "\u20B980", minimum: "\u20B9200", overageRate: "\u20B9100/kg" },
  { id: 2, range: "5 - 10 kg", pricePerKg: "\u20B970", minimum: "\u20B9400", overageRate: "\u20B990/kg" },
  { id: 3, range: "10 - 18 kg", pricePerKg: "\u20B960", minimum: "\u20B9700", overageRate: "\u20B980/kg" },
  { id: 4, range: "18+ kg", pricePerKg: "\u20B955", minimum: "\u20B91,100", overageRate: "\u20B975/kg" },
]

const pieceItems = [
  { id: 1, name: "Shirt", category: "Clothing", fixedPrice: "\u20B910", unit: "piece", status: "active" as const },
  { id: 2, name: "Pant", category: "Clothing", fixedPrice: "\u20B910", unit: "piece", status: "active" as const },
  { id: 3, name: "Blanket", category: "Heavy", fixedPrice: "\u20B950", unit: "piece", status: "active" as const },
  { id: 4, name: "Duvet", category: "Heavy", fixedPrice: "\u20B980", unit: "piece", status: "active" as const },
  { id: 5, name: "Curtain", category: "Household", fixedPrice: "\u20B935", unit: "piece", status: "active" as const },
  { id: 6, name: "Saree", category: "Clothing", fixedPrice: "\u20B915", unit: "piece", status: "active" as const },
  { id: 7, name: "Jacket", category: "Clothing", fixedPrice: "\u20B925", unit: "piece", status: "inactive" as const },
  { id: 8, name: "Towel", category: "Household", fixedPrice: "\u20B912", unit: "piece", status: "active" as const },
]

const overageConfig = {
  ratePerExtraKg: "\u20B9100",
  notificationThreshold: "2 kg over",
  autoBill: true,
  maxOverage: "5 kg",
  roundUp: true,
}

export function DynamicBillingEngineView() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Dynamic Billing Engine</h2>
          <p className="text-xs text-muted-foreground">Configure pricing tiers, overage rules, and invoices</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-8 w-full justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-xs h-6 px-3">Overview</TabsTrigger>
          <TabsTrigger value="weight" className="text-xs h-6 px-3">Weight-Based Pricing</TabsTrigger>
          <TabsTrigger value="piece" className="text-xs h-6 px-3">Piece-Based Pricing</TabsTrigger>
          <TabsTrigger value="overage" className="text-xs h-6 px-3">Overage Rules</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs h-6 px-3">Invoice Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <CardContent className="p-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-emerald-600">{stat.change} from yesterday</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Pricing Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Weight Tiers</span>
                    <span className="font-medium">4 tiers</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Piece Items</span>
                    <span className="font-medium">8 items</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overage Revenue</span>
                    <span className="font-medium text-amber-600">\u20B92,800</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Auto-Bill Enabled</span>
                    <span className="font-medium text-emerald-600">Yes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Add Tier</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Add Item</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Generate Invoice</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">View Reports</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="weight" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Weight-Based Pricing Tiers</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Tier</Button>
              </div>
              <CardDescription className="text-[10px]">Pricing is calculated based on item weight at the time of processing</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Weight Range</TableHead>
                    <TableHead className="text-xs h-8">Price per KG</TableHead>
                    <TableHead className="text-xs h-8">Minimum Amount</TableHead>
                    <TableHead className="text-xs h-8">Overage Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weightTiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell className="text-xs font-medium">{tier.range}</TableCell>
                      <TableCell className="text-xs">{tier.pricePerKg}</TableCell>
                      <TableCell className="text-xs">{tier.minimum}</TableCell>
                      <TableCell className="text-xs text-amber-600">{tier.overageRate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="piece" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Piece-Based Pricing</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Item</Button>
              </div>
              <CardDescription className="text-[10px]">Fixed price per item regardless of weight</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Item Name</TableHead>
                    <TableHead className="text-xs h-8">Category</TableHead>
                    <TableHead className="text-xs h-8">Fixed Price</TableHead>
                    <TableHead className="text-xs h-8">Unit</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pieceItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.fixedPrice}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "active" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${item.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overage" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Overage Configuration</CardTitle>
                <CardDescription className="text-[10px]">Billing rules for items exceeding expected weight</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rate per Extra KG</span>
                    <span className="font-medium">{overageConfig.ratePerExtraKg}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Notification Threshold</span>
                    <span className="font-medium">{overageConfig.notificationThreshold}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max Overage Allowed</span>
                    <span className="font-medium">{overageConfig.maxOverage}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Round Up Weight</span>
                    <span className="font-medium">{overageConfig.roundUp ? "Yes" : "No"}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-4 h-7 text-xs">Edit Configuration</Button>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Overage Controls</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Auto-Bill Overage</p>
                      <p className="text-[10px] text-muted-foreground">Automatically charge for weight overage</p>
                    </div>
                    <Switch defaultChecked={overageConfig.autoBill} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Customer Notification</p>
                      <p className="text-[10px] text-muted-foreground">Notify customer before charging overage</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Approval Required</p>
                      <p className="text-[10px] text-muted-foreground">Require admin approval for overage above threshold</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Round Up Weight</p>
                      <p className="text-[10px] text-muted-foreground">Round up to nearest 0.5 kg</p>
                    </div>
                    <Switch defaultChecked={overageConfig.roundUp} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Invoice Template Settings</CardTitle>
                <CardDescription className="text-[10px]">Customize what appears on generated invoices</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Business Logo</p>
                      <p className="text-[10px] text-muted-foreground">Display logo on invoice header</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Itemized Breakdown</p>
                      <p className="text-[10px] text-muted-foreground">Show per-item pricing details</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Weight Details</p>
                      <p className="text-[10px] text-muted-foreground">Show weight and tier on invoice</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Payment Terms</p>
                      <p className="text-[10px] text-muted-foreground">Include payment terms and due date</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">GST Settings</CardTitle>
                <CardDescription className="text-[10px]">Tax configuration for invoices</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">GSTIN</span>
                    <span className="font-medium">27AABCU9603R1ZM</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CGST Rate</span>
                    <span className="font-medium">2.5%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SGST Rate</span>
                    <span className="font-medium">2.5%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total GST</span>
                    <span className="font-medium">5%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3 mt-2">
                    <div>
                      <p className="text-xs font-medium">Include GST in Price</p>
                      <p className="text-[10px] text-muted-foreground">Show GST inclusive pricing</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">HSN Code</p>
                      <p className="text-[10px] text-muted-foreground">Display HSN/SAC codes on invoice</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
