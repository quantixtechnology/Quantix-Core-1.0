"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Home, Building2, Star, Edit, Trash2, ChevronRight } from "lucide-react"

const mockAddresses = [
  { id: "addr_1", label: "Home", line1: "402, Lotus Apartments", line2: "Andheri West", city: "Mumbai", pincode: "400053", isDefault: true },
  { id: "addr_2", label: "Office", line1: "512, Commercial Tower", line2: "BKC", city: "Mumbai", pincode: "400051", isDefault: false },
  { id: "addr_3", label: "Other", line1: "15, Sea View Road", line2: "Versova", city: "Mumbai", pincode: "400061", isDefault: false },
]

export function CustomerAddresses() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">My Addresses</h2>
        <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-3 w-3 mr-1" />
          Add New
        </Button>
      </div>

      <div className="space-y-3">
        {mockAddresses.map((addr) => (
          <Card key={addr.id} className="border border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  {addr.label === "Home" ? (
                    <Home className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Building2 className="h-5 w-5 text-orange-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{addr.label}</span>
                    {addr.isDefault && (
                      <Badge className="bg-orange-50 text-orange-600 border-0 text-[10px] h-5">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{addr.line1}, {addr.line2}</p>
                  <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
