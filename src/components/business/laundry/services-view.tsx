"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Loader2, Plus, Edit, Trash2, Layers, Package, Clock, IndianRupee, CheckCircle, AlertCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface LaundryService {
  id: string
  name: string
  slug: string
  description: string
  price: number
  unitType: "PER_KG" | "PER_PIECE" | "FIXED_PRICE"
  turnaroundTime: string
  isActive: boolean
  sortOrder: number
  metadata: Record<string, any>
}

interface LaundryServiceCategory {
  id: string
  name: string
  slug: string
  description: string
  type: "NORMAL" | "SUBSCRIPTION"
  sortOrder: number
  isActive: boolean
  services: LaundryService[]
}

const SERVICE_TYPES = [
  { value: "NORMAL", label: "Normal Service" },
  { value: "SUBSCRIPTION", label: "Subscription Service" },
]

const UNIT_TYPES = [
  { value: "PER_KG", label: "Per KG" },
  { value: "PER_PIECE", label: "Per Piece" },
  { value: "FIXED_PRICE", label: "Fixed Price" },
]

export function ServicesView() {
  const { currentBusinessId, currentBusinessType } = useAdminStore()
  const isLaundry = currentBusinessType === "LAUNDRY"

  const [categories, setCategories] = useState<LaundryServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<LaundryServiceCategory | null>(null)
  const [editingService, setEditingService] = useState<{ categoryId: string, service: LaundryService } | null>(null)

  const loadCategories = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/business/${currentBusinessId}/laundry-services`, {
        headers: { "x-business-id": currentBusinessId },
      })
      const json = await res.json()
      if (json.success) {
        setCategories(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { loadCategories() }, [loadCategories])

  if (!isLaundry) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Laundry services are only available for laundry businesses.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laundry Services"
        description="Manage service categories and individual services for your laundry business"
        icon={Layers}
        action={
          <Button size="sm" onClick={() => setIsCategoryDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : categories.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">No service categories yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Create your first service category to get started</p>
              </div>
              <Button onClick={() => setIsCategoryDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Category
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {category.name}
                      <Badge variant={category.type === "SUBSCRIPTION" ? "default" : "secondary"} className="text-xs">
                        {category.type === "SUBSCRIPTION" ? "Subscription" : "Normal"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category)
                        setIsCategoryDialogOpen(true)
                      }}
                      className="gap-1.5"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingService({ categoryId: category.id, service: { id: "", name: "", slug: "", description: "", price: 0, unitType: "PER_KG", turnaroundTime: "24h", isActive: true, sortOrder: 0, metadata: {} } }
                        setIsServiceDialogOpen(true)
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Service
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {category.services.length === 0 ? (
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    No services in this category yet
                  </div>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="space-y-3">
                    {category.services.map((service) => (
                      <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{service.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {service.unitType === "PER_KG" && "Per KG"}
                            {service.unitType === "PER_PIECE" && "Per Piece"}
                            {service.unitType === "FIXED_PRICE" && "Fixed Price"}
                            {service.turnaroundTime && ` • ${service.turnaroundTime}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-semibold">₹{service.price}</div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingService({ categoryId: category.id, service })
                                setIsServiceDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the service category details"
                : "Create a new service category for your laundry services"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="e.g., Wash & Fold"
                defaultValue={editingCategory?.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                placeholder="Describe this service category..."
                rows={3}
                defaultValue={editingCategory?.description}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-type">Type</Label>
              <Select defaultValue={editingCategory?.type || "NORMAL"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal Service</SelectItem>
                  <SelectItem value="SUBSCRIPTION">Subscription Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-sort-order">Sort Order</Label>
              <Input
                id="category-sort-order"
                type="number"
                defaultValue={editingCategory?.sortOrder || 0}
                min={0}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setIsCategoryDialogOpen(false)}>{editingCategory ? "Update" : "Create"} Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Sheet open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>{editingService ? "Edit Service" : "Add Service"}</SheetTitle>
            <SheetDescription>
              {editingService
                ? "Update service details and pricing"
                : "Create a new service for your laundry business"}
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Service Name</Label>
              <Input
                id="service-name"
                placeholder="e.g., Wash & Fold"
                defaultValue={editingService?.service.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                placeholder="Describe the service..."
                rows={3}
                defaultValue={editingService?.service.description}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-price">Price (₹)</Label>
                <Input
                  id="service-price"
                  type="number"
                  placeholder="80"
                  defaultValue={editingService?.service.price.toString()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-unit-type">Unit Type</Label>
                <Select defaultValue={editingService?.service.unitType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_KG">Per KG</SelectItem>
                    <SelectItem value="PER_PIECE">Per Piece</SelectItem>
                    <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-turnaround">Turnaround Time</Label>
              <Input
                id="service-turnaround"
                placeholder="e.g., 24h"
                defaultValue={editingService?.service.turnaroundTime}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="service-active" defaultChecked={editingService?.service.isActive} />
              <Label htmlFor="service-active">Active</Label>
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => setIsServiceDialogOpen(false)}>{editingService ? "Update" : "Create"} Service</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}