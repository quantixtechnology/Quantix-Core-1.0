'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const stats = [
  { label: "Pickups Today", value: "18", change: "+4" },
  { label: "Deliveries", value: "14", change: "+2" },
  { label: "Partners Online", value: "5", change: "+1" },
  { label: "Avg Time", value: "42 min", change: "-5 min" },
]

const pickups = [
  { id: "PK-1001", customer: "Sunil Yadav", address: "42, MG Road, Sector 12", scheduledTime: "10:30 AM", partner: "Raju M.", status: "assigned" as const },
  { id: "PK-1002", customer: "Anjali Das", address: "15, Park Street, Block C", scheduledTime: "11:00 AM", partner: "Unassigned", status: "pending" as const },
  { id: "PK-1003", customer: "Manoj Tiwari", address: "8, Nehru Nagar, Lane 5", scheduledTime: "11:30 AM", partner: "Kiran S.", status: "en-route" as const },
  { id: "PK-1004", customer: "Sapna Kumari", address: "27, Indira Colony, Phase 2", scheduledTime: "12:00 PM", partner: "Unassigned", status: "pending" as const },
  { id: "PK-1005", customer: "Vivek Ahuja", address: "3, SV Road, Apt 4B", scheduledTime: "02:00 PM", partner: "Raju M.", status: "assigned" as const },
  { id: "PK-1006", customer: "Lata Menon", address: "19, Gandhi Path, Room 7", scheduledTime: "03:30 PM", partner: "Dinesh R.", status: "en-route" as const },
]

const deliveries = [
  { id: "DL-2001", customer: "Rahul Bhat", address: "55, Laxmi Nagar, Shop 3", partner: "Raju M.", status: "in-transit" as const, eta: "15 min" },
  { id: "DL-2002", customer: "Preeti Sharma", address: "10, Shanti Path, Flat 2A", partner: "Kiran S.", status: "in-transit" as const, eta: "25 min" },
  { id: "DL-2003", customer: "Ashok Verma", address: "22, Rajput Colony, H.No 8", partner: "Dinesh R.", status: "picked-up" as const, eta: "40 min" },
  { id: "DL-2004", customer: "Neha Kapoor", address: "7, Cantonment Area, Block D", partner: "Raju M.", status: "in-transit" as const, eta: "20 min" },
  { id: "DL-2005", customer: "Suresh Pillai", address: "31, Patel Nagar, Phase 1", partner: "Kiran S.", status: "picked-up" as const, eta: "55 min" },
  { id: "DL-2006", customer: "Divya Agarwal", address: "14, Subhash Nagar, Plot 9", partner: "Arjun T.", status: "in-transit" as const, eta: "30 min" },
]

const partners = [
  { id: 1, name: "Raju M.", phone: "98765 43210", vehicle: "Honda Activa", status: "online" as const, rating: 4.5, totalDeliveries: 342 },
  { id: 2, name: "Kiran S.", phone: "98765 43211", vehicle: "TVS Jupiter", status: "online" as const, rating: 4.2, totalDeliveries: 218 },
  { id: 3, name: "Dinesh R.", phone: "98765 43212", vehicle: "Hero Splendor", status: "online" as const, rating: 4.7, totalDeliveries: 456 },
  { id: 4, name: "Arjun T.", phone: "98765 43213", vehicle: "Bajaj Pulsar", status: "online" as const, rating: 3.9, totalDeliveries: 124 },
  { id: 5, name: "Mohit L.", phone: "98765 43214", vehicle: "Royal Enfield", status: "offline" as const, rating: 4.1, totalDeliveries: 189 },
]

export function PickupDropEngineView() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pickup & Drop Engine</h2>
          <p className="text-xs text-muted-foreground">Manage pickups, deliveries, and partner assignments</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-8 w-full justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-xs h-6 px-3">Overview</TabsTrigger>
          <TabsTrigger value="pickups" className="text-xs h-6 px-3">Pickup Queue</TabsTrigger>
          <TabsTrigger value="deliveries" className="text-xs h-6 px-3">Delivery Queue</TabsTrigger>
          <TabsTrigger value="partners" className="text-xs h-6 px-3">Partners</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs h-6 px-3">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <CardContent className="p-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                  <p className={`text-[10px] ${stat.change.startsWith("-") ? "text-emerald-600" : "text-emerald-600"}`}>{stat.change} from yesterday</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Active Pickups</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {pickups.slice(0, 3).map((pk) => (
                    <div key={pk.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{pk.id}</span>
                        <span className="text-muted-foreground ml-1">- {pk.customer}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pk.status === "en-route" ? "border-blue-200 text-blue-700 bg-blue-50" : pk.status === "assigned" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                        {pk.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">In-Transit Deliveries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {deliveries.slice(0, 3).map((dl) => (
                    <div key={dl.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{dl.id}</span>
                        <span className="text-muted-foreground ml-1">- {dl.customer}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">ETA {dl.eta}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pickups" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Pending Pickups</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs">Assign All</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Order #</TableHead>
                    <TableHead className="text-xs h-8">Customer</TableHead>
                    <TableHead className="text-xs h-8">Address</TableHead>
                    <TableHead className="text-xs h-8">Scheduled</TableHead>
                    <TableHead className="text-xs h-8">Partner</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickups.map((pk) => (
                    <TableRow key={pk.id}>
                      <TableCell className="text-xs font-medium">{pk.id}</TableCell>
                      <TableCell className="text-xs">{pk.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{pk.address}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{pk.scheduledTime}</TableCell>
                      <TableCell className={`text-xs ${pk.partner === "Unassigned" ? "text-red-500 italic" : ""}`}>{pk.partner}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pk.status === "en-route" ? "border-blue-200 text-blue-700 bg-blue-50" : pk.status === "assigned" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                          {pk.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Pending Deliveries</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs">Refresh</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Order #</TableHead>
                    <TableHead className="text-xs h-8">Customer</TableHead>
                    <TableHead className="text-xs h-8">Address</TableHead>
                    <TableHead className="text-xs h-8">Partner</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                    <TableHead className="text-xs h-8">ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((dl) => (
                    <TableRow key={dl.id}>
                      <TableCell className="text-xs font-medium">{dl.id}</TableCell>
                      <TableCell className="text-xs">{dl.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{dl.address}</TableCell>
                      <TableCell className="text-xs">{dl.partner}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${dl.status === "in-transit" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                          {dl.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{dl.eta}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Delivery Partners</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Partner</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Name</TableHead>
                    <TableHead className="text-xs h-8">Phone</TableHead>
                    <TableHead className="text-xs h-8">Vehicle</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                    <TableHead className="text-xs h-8">Rating</TableHead>
                    <TableHead className="text-xs h-8">Deliveries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.vehicle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${p.status === "online" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-gray-200 text-gray-500 bg-gray-50"}`}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{p.rating}</TableCell>
                      <TableCell className="text-xs">{p.totalDeliveries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Zone Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Pickup Radius</span>
                    <span className="font-medium">5 km</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Delivery Radius</span>
                    <span className="font-medium">8 km</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max Orders Per Partner</span>
                    <span className="font-medium">3</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-4 h-7 text-xs">Edit Zone</Button>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Verification & Assignment</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">OTP Verification</p>
                      <p className="text-[10px] text-muted-foreground">Require OTP at pickup & delivery</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Auto-Assign</p>
                      <p className="text-[10px] text-muted-foreground">Automatically assign nearest partner</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Photo Proof</p>
                      <p className="text-[10px] text-muted-foreground">Require delivery photo confirmation</p>
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
