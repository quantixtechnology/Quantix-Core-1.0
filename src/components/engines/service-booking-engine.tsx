'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const stats = [
  { label: "Services", value: "8", change: "+2" },
  { label: "Bookings Today", value: "12", change: "+3" },
  { label: "Completed", value: "8", change: "+2" },
  { label: "Pending", value: "4", change: "-1" },
]

const services = [
  { id: 1, name: "Premium Car Wash", duration: "60 min", price: "\u20B9499", category: "Car Wash", status: "active" as const },
  { id: 2, name: "Express Car Wash", duration: "30 min", price: "\u20B9299", category: "Car Wash", status: "active" as const },
  { id: 3, name: "Interior Detailing", duration: "90 min", price: "\u20B9999", category: "Detailing", status: "active" as const },
  { id: 4, name: "Bike Wash", duration: "20 min", price: "\u20B9149", category: "Bike Wash", status: "active" as const },
  { id: 5, name: "Full Detailing", duration: "120 min", price: "\u20B91,999", category: "Detailing", status: "active" as const },
  { id: 6, name: "Engine Cleaning", duration: "45 min", price: "\u20B9699", category: "Maintenance", status: "active" as const },
  { id: 7, name: "AC Sanitization", duration: "30 min", price: "\u20B9399", category: "Maintenance", status: "inactive" as const },
  { id: 8, name: "Ceramic Coating", duration: "180 min", price: "\u20B93,499", category: "Premium", status: "active" as const },
]

const appointments = [
  { id: 1, customer: "Arjun Mehta", service: "Premium Car Wash", datetime: "2025-01-15 10:00 AM", duration: "60 min", status: "confirmed" as const, assignedTo: "Ramesh K." },
  { id: 2, customer: "Nisha Gupta", service: "Bike Wash", datetime: "2025-01-15 10:30 AM", duration: "20 min", status: "confirmed" as const, assignedTo: "Suresh P." },
  { id: 3, customer: "Deepak Rao", service: "Interior Detailing", datetime: "2025-01-15 11:00 AM", duration: "90 min", status: "pending" as const, assignedTo: "Unassigned" },
  { id: 4, customer: "Kavita Singh", service: "Express Car Wash", datetime: "2025-01-15 11:30 AM", duration: "30 min", status: "confirmed" as const, assignedTo: "Ramesh K." },
  { id: 5, customer: "Rohit Jain", service: "Full Detailing", datetime: "2025-01-15 02:00 PM", duration: "120 min", status: "pending" as const, assignedTo: "Unassigned" },
  { id: 6, customer: "Pooja Nair", service: "Ceramic Coating", datetime: "2025-01-16 09:00 AM", duration: "180 min", status: "confirmed" as const, assignedTo: "Vijay M." },
]

const slotConfig = {
  slotDuration: "30 min",
  bufferTime: "15 min",
  operatingHours: "8:00 AM - 8:00 PM",
  maxConcurrent: 3,
  breakTime: "1:00 PM - 2:00 PM",
  weekendHours: "9:00 AM - 6:00 PM",
}

export function ServiceBookingEngineView() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Service Booking Engine</h2>
          <p className="text-xs text-muted-foreground">Manage services, appointments, and scheduling</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-8 w-full justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="text-xs h-6 px-3">Overview</TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs h-6 px-3">Service Catalog</TabsTrigger>
          <TabsTrigger value="appointments" className="text-xs h-6 px-3">Appointments</TabsTrigger>
          <TabsTrigger value="time-slots" className="text-xs h-6 px-3">Time Slots</TabsTrigger>
          <TabsTrigger value="assignment" className="text-xs h-6 px-3">Assignment Rules</TabsTrigger>
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
                <CardTitle className="text-xs font-medium">Today&apos;s Schedule</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {appointments.slice(0, 4).map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{apt.customer}</span>
                        <span className="text-muted-foreground ml-1">- {apt.service}</span>
                      </div>
                      <Badge variant={apt.status === "confirmed" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${apt.status === "confirmed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}`}>
                        {apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-xs font-medium">Popular Services</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {services.slice(0, 4).map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{svc.name}</span>
                      <span className="font-medium">{svc.price}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Service Catalog</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">Add Service</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Service Name</TableHead>
                    <TableHead className="text-xs h-8">Duration</TableHead>
                    <TableHead className="text-xs h-8">Price</TableHead>
                    <TableHead className="text-xs h-8">Category</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-xs font-medium">{service.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{service.duration}</TableCell>
                      <TableCell className="text-xs">{service.price}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{service.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.status === "active" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${service.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}>
                          {service.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-3">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium">Upcoming Appointments</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs">View All</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Customer</TableHead>
                    <TableHead className="text-xs h-8">Service</TableHead>
                    <TableHead className="text-xs h-8">Date/Time</TableHead>
                    <TableHead className="text-xs h-8">Duration</TableHead>
                    <TableHead className="text-xs h-8">Status</TableHead>
                    <TableHead className="text-xs h-8">Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="text-xs font-medium">{apt.customer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{apt.service}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{apt.datetime}</TableCell>
                      <TableCell className="text-xs">{apt.duration}</TableCell>
                      <TableCell>
                        <Badge variant={apt.status === "confirmed" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${apt.status === "confirmed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}`}>
                          {apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs ${apt.assignedTo === "Unassigned" ? "text-red-500 italic" : ""}`}>
                        {apt.assignedTo}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-slots" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Slot Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Slot Duration</span>
                    <span className="font-medium">{slotConfig.slotDuration}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Buffer Time</span>
                    <span className="font-medium">{slotConfig.bufferTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max Concurrent Bookings</span>
                    <span className="font-medium">{slotConfig.maxConcurrent}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Break Time</span>
                    <span className="font-medium">{slotConfig.breakTime}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-4 h-7 text-xs">Edit Configuration</Button>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Operating Hours</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Weekdays</span>
                    <span className="font-medium">{slotConfig.operatingHours}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Weekends</span>
                    <span className="font-medium">{slotConfig.weekendHours}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3 mt-3">
                    <div>
                      <p className="text-xs font-medium">Allow Same-Day Booking</p>
                      <p className="text-[10px] text-muted-foreground">Customers can book for today</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Auto-Close Slots</p>
                      <p className="text-[10px] text-muted-foreground">Close slots 30 min before start time</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignment" className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Auto-Assignment Rules</CardTitle>
                <CardDescription className="text-[10px]">Configure how bookings are assigned automatically</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Enable Auto-Assignment</p>
                      <p className="text-[10px] text-muted-foreground">Automatically assign staff to bookings</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Prefer Least Busy</p>
                      <p className="text-[10px] text-muted-foreground">Assign to staff with fewest bookings</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Skill Matching</p>
                      <p className="text-[10px] text-muted-foreground">Only assign staff with matching skills</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-xs font-medium">Allow Reassignment</p>
                      <p className="text-[10px] text-muted-foreground">Allow manual reassignment after auto-assignment</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs font-medium">Manual Assignment</CardTitle>
                <CardDescription className="text-[10px]">Staff available for manual assignment</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-2 rounded border">
                    <div>
                      <p className="font-medium">Ramesh K.</p>
                      <p className="text-[10px] text-muted-foreground">Car Wash, Detailing</p>
                    </div>
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded border">
                    <div>
                      <p className="font-medium">Suresh P.</p>
                      <p className="text-[10px] text-muted-foreground">Bike Wash, Express Wash</p>
                    </div>
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded border">
                    <div>
                      <p className="font-medium">Vijay M.</p>
                      <p className="text-[10px] text-muted-foreground">Premium, Ceramic Coating</p>
                    </div>
                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 hover:bg-amber-100">Busy</Badge>
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
