'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const stats = [
  { label: "Products", value: "245", change: "+12" },
  { label: "Categories", value: "12", change: "+1" },
  { label: "Orders Today", value: "38", change: "+5" },
  { label: "Revenue", value: "\u20B952,400", change: "+8,200" },
]

const products = [
  { name: "Organic Basmati Rice (5kg)", category: "Grains", price: "\u20B9450", stock: 128, status: "active" as const },
  { name: "Cold Pressed Mustard Oil (1L)", category: "Oils", price: "\u20B9320", stock: 85, status: "active" as const },
  { name: "Whole Wheat Flour (10kg)", category: "Flour", price: "\u20B9380", stock: 64, status: "active" as const },
  { name: "Turmeric Powder (500g)", category: "Spices", price: "\u20B9180", stock: 210, status: "active" as const },
  { name: "Organic Jaggery (1kg)", category: "Sweeteners", price: "\u20B9150", stock: 0, status: "inactive" as const },
  { name: "Red Chilli Powder (250g)", category: "Spices", price: "\u20B9120", stock: 95, status: "active" as const },
  { name: "Desi Ghee (500ml)", category: "Dairy", price: "\u20B9550", stock: 42, status: "active" as const },
  { name: "Sona Masoori Rice (25kg)", category: "Grains", price: "\u20B91,200", stock: 0, status: "inactive" as const },
]

const cartRules = [
  { id: 1, name: "Minimum Order Value", condition: "\u20B9200 minimum", action: "Block checkout below threshold", priority: 1, status: "active" as const },
  { id: 2, name: "Free Delivery", condition: "Orders above \u20B9500", action: "Waive delivery fee", priority: 2, status: "active" as const },
  { id: 3, name: "Bulk Discount", condition: "5+ same items", action: "Apply 10% discount", priority: 3, status: "active" as const },
  { id: 4, name: "First Order Coupon", condition: "New customers only", action: "Flat \u20B9100 off", priority: 4, status: "inactive" as const },
]

const deliverySettings = {
  radius: "5 km",
  fee: "\u20B940",
  freeDeliveryThreshold: "\u20B9500",
  estimatedTime: "30-45 min",
  maxWeight: "25 kg",
  expressFee: "\u20B920 extra",
  expressTime: "15-25 min",
}

const paymentMethods = [
  { id: 1, name: "UPI", description: "Google Pay, PhonePe, Paytm", enabled: true, icon: "UPI" },
  { id: 2, name: "Card", description: "Credit & Debit cards", enabled: true, icon: "CARD" },
  { id: 3, name: "COD", description: "Cash on Delivery", enabled: true, icon: "COD" },
  { id: 4, name: "Net Banking", description: "All major banks supported", enabled: false, icon: "NET" },
]

export function EcommerceEngineView() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ecommerce Engine</h2>
          <p className="text-xs text-muted-foreground">Manage products, orders, and delivery settings</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-8 w-full justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-xs h-6 px-3">Overview</TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs h-6 px-3">Product Catalog</TabsTrigger>
          <TabsTrigger value="cart-rules" className="text-xs h-6 px-3">Cart Rules</TabsTrigger>
          <TabsTrigger value="delivery" className="text-xs h-6 px-3">Delivery Settings</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs h-6 px-3">Payment Methods</TabsTrigger>
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
                <CardTitle className="text-xs font-medium">Top Products</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {products.slice(0, 4).map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[180px]">{p.name}</span>
                      <span className="font-medium">{p.price}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Add Product</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Create Coupon</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">View Orders</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Export Catalog</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Product Catalog</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Product</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Name</TableHead>
                    <TableHead className="text-xs h-8">Category</TableHead>
                    <TableHead className="text-xs h-8">Price</TableHead>
                    <TableHead className="text-xs h-8">Stock</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{product.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{product.category}</TableCell>
                      <TableCell className="text-xs">{product.price}</TableCell>
                      <TableCell className="text-xs">
                        <span className={product.stock === 0 ? "text-red-500" : ""}>{product.stock}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === "active" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${product.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}>
                          {product.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cart-rules" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Cart Rules</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Rule</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-3">
                {cartRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{rule.name}</p>
                        <Badge variant={rule.status === "active" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${rule.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}>
                          {rule.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Condition: {rule.condition}</p>
                      <p className="text-[10px] text-muted-foreground">Action: {rule.action}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">P{rule.priority}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Standard Delivery</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Delivery Radius</span>
                    <span className="font-medium">{deliverySettings.radius}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium">{deliverySettings.fee}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Free Delivery Above</span>
                    <span className="font-medium">{deliverySettings.freeDeliveryThreshold}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Estimated Time</span>
                    <span className="font-medium">{deliverySettings.estimatedTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max Weight</span>
                    <span className="font-medium">{deliverySettings.maxWeight}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Express Delivery</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Express Fee</span>
                    <span className="font-medium">{deliverySettings.expressFee}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Estimated Time</span>
                    <span className="font-medium">{deliverySettings.expressTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Delivery Radius</span>
                    <span className="font-medium">3 km</span>
                  </div>
                </div>
                <div className="mt-4">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Edit Settings</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-xs font-medium">Payment Methods</CardTitle>
              <CardDescription className="text-[10px]">Configure payment options for customers</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                        {method.icon}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{method.name}</p>
                        <p className="text-[10px] text-muted-foreground">{method.description}</p>
                      </div>
                    </div>
                    <Switch checked={method.enabled} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
