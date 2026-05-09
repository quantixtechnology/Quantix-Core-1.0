'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MapPin, Clock, Truck, Plus, Navigation, Info,
} from 'lucide-react'

const stats = [
  { label: 'Active Zones', value: '5', icon: MapPin, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Coverage Area', value: '12 km²', icon: Navigation, color: 'text-blue-600 bg-blue-50' },
  { label: 'Avg Delivery Time', value: '28 min', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Delivery Partners', value: '8', icon: Truck, color: 'text-purple-600 bg-purple-50' },
]

const zones = [
  { name: 'Central Zone', pinCodes: ['400001', '400002', '400003'], radius: '3 km', minOrder: '₹150', fee: '₹25', status: 'active', avgTime: '22 min' },
  { name: 'North Zone', pinCodes: ['400010', '400011', '400012'], radius: '4 km', minOrder: '₹200', fee: '₹35', status: 'active', avgTime: '28 min' },
  { name: 'South Zone', pinCodes: ['400020', '400021'], radius: '5 km', minOrder: '₹250', fee: '₹45', status: 'active', avgTime: '35 min' },
  { name: 'East Zone', pinCodes: ['400030', '400031', '400032'], radius: '3.5 km', minOrder: '₹200', fee: '₹30', status: 'active', avgTime: '26 min' },
  { name: 'West Zone', pinCodes: ['400040', '400041'], radius: '6 km', minOrder: '₹300', fee: '₹50', status: 'inactive', avgTime: '40 min' },
]

const feeStructure = [
  { type: 'Free Delivery', condition: 'Orders above ₹500', fee: '₹0', color: 'bg-emerald-100 text-emerald-700' },
  { type: 'Standard', condition: '0–3 km radius', fee: '₹25', color: 'bg-blue-100 text-blue-700' },
  { type: 'Express', condition: 'Under 20 min guarantee', fee: '₹49', color: 'bg-amber-100 text-amber-700' },
  { type: 'Midnight', condition: '10 PM – 6 AM', fee: '₹69', color: 'bg-purple-100 text-purple-700' },
]

const pinCodeCoverage = [
  { pin: '400001', area: 'Fort', zone: 'Central', deliverable: true, time: '20-25 min' },
  { pin: '400002', area: 'Mumbai CST', zone: 'Central', deliverable: true, time: '22-28 min' },
  { pin: '400003', area: 'Marine Drive', zone: 'Central', deliverable: true, time: '18-22 min' },
  { pin: '400010', area: 'Bandra West', zone: 'North', deliverable: true, time: '25-30 min' },
  { pin: '400011', area: 'Khar West', zone: 'North', deliverable: true, time: '28-35 min' },
  { pin: '400012', area: 'Santacruz West', zone: 'North', deliverable: true, time: '30-38 min' },
  { pin: '400020', area: 'Colaba', zone: 'South', deliverable: true, time: '32-40 min' },
  { pin: '400021', area: 'Navy Nagar', zone: 'South', deliverable: true, time: '35-42 min' },
  { pin: '400030', area: 'Matunga', zone: 'East', deliverable: true, time: '24-30 min' },
  { pin: '400031', area: 'Sion', zone: 'East', deliverable: true, time: '22-28 min' },
  { pin: '400032', area: 'Wadala', zone: 'East', deliverable: true, time: '26-32 min' },
  { pin: '400040', area: 'Andheri West', zone: 'West', deliverable: false, time: '—' },
  { pin: '400041', area: 'Versova', zone: 'West', deliverable: false, time: '—' },
]

const zoneCircleColors = [
  { zone: 'Central', color: 'border-emerald-500', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  { zone: 'North', color: 'border-blue-500', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  { zone: 'South', color: 'border-amber-500', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  { zone: 'East', color: 'border-purple-500', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  { zone: 'West', color: 'border-gray-400', bg: 'bg-gray-50', dot: 'bg-gray-400' },
]

export function DeliveryZonesView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Delivery Zones</h2>
        <Button variant="outline" size="sm" className="text-xs h-7">
          <Plus className="size-3 mr-1" />Add Zone
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Zones List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Service Zones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Zone</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Pin Codes</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Radius</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Min Order</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Delivery Fee</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.name} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{z.name}</td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {z.pinCodes.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">{z.radius}</td>
                    <td className="p-2">{z.minOrder}</td>
                    <td className="p-2">{z.fee}</td>
                    <td className="p-2">
                      <Badge className={`text-[10px] ${z.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {z.status}
                      </Badge>
                    </td>
                    <td className="p-2">{z.avgTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Visual Zone Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Zone Coverage Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-56 h-56">
                {/* Concentric circles */}
                {zoneCircleColors.map((z, i) => (
                  <div
                    key={z.zone}
                    className={`absolute rounded-full border-2 border-dashed ${z.color} flex items-center justify-center`}
                    style={{
                      top: `${10 + i * 18}px`,
                      left: `${10 + i * 18}px`,
                      right: `${10 + i * 18}px`,
                      bottom: `${10 + i * 18}px`,
                    }}
                  >
                    {i === 0 && (
                      <div className="flex flex-col items-center">
                        <MapPin className="size-4 text-emerald-600" />
                        <span className="text-[8px] font-medium text-emerald-700 mt-0.5">Store</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Zone dots */}
                <div className="absolute top-6 right-8 w-2.5 h-2.5 rounded-full bg-emerald-500" title="Central" />
                <div className="absolute top-16 right-4 w-2.5 h-2.5 rounded-full bg-blue-500" title="North" />
                <div className="absolute bottom-12 left-6 w-2.5 h-2.5 rounded-full bg-amber-500" title="South" />
                <div className="absolute top-14 left-4 w-2.5 h-2.5 rounded-full bg-purple-500" title="East" />
                <div className="absolute bottom-6 right-10 w-2.5 h-2.5 rounded-full bg-gray-400" title="West" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {zoneCircleColors.map(z => (
                <div key={z.zone} className="flex items-center gap-1">
                  <div className={`size-2 rounded-full ${z.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{z.zone}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Fee Structure */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Delivery Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feeStructure.map(f => (
                <div key={f.type} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{f.type}</p>
                    <p className="text-[10px] text-muted-foreground">{f.condition}</p>
                  </div>
                  <Badge className={`text-[10px] ${f.color}`}>{f.fee}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pin Code Coverage Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pin Code Coverage</CardTitle>
            <Badge variant="outline" className="text-[10px]">{pinCodeCoverage.filter(p => p.deliverable).length} deliverable</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Pin Code</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Area</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Zone</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Deliverable</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Est. Time</th>
                </tr>
              </thead>
              <tbody>
                {pinCodeCoverage.map(p => (
                  <tr key={p.pin} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{p.pin}</td>
                    <td className="p-2">{p.area}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.zone}</Badge></td>
                    <td className="p-2">
                      <Badge className={`text-[10px] ${p.deliverable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {p.deliverable ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{p.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Haversine Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Info className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Distance Calculation Method</p>
              <p className="text-xs text-muted-foreground mt-1">
                Delivery zones use the <span className="font-semibold">Haversine formula</span> to compute
                great-circle distance between store coordinates and customer location. The formula accounts
                for Earth&apos;s curvature (mean radius ≈ 6,371 km) and provides accurate distances for
                zone assignment and fee calculation.
              </p>
              <div className="mt-2 p-2 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                d = 2r · arcsin(√(sin²((φ₂−φ₁)/2) + cos(φ₁)·cos(φ₂)·sin²((λ₂−λ₁)/2)))
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
