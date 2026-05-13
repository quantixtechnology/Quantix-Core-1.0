"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ArrowRight,
  Check,
  Lock,
  AlertCircle,
  Workflow,
  Layers,
  Settings,
} from "lucide-react"
import { useAdminStore, WORKFLOW_CONFIGS, BUSINESS_TYPE_WORKFLOWS, BUSINESS_TYPE_UI, type WorkflowType } from "@/stores/admin-store"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

interface WorkflowCategory {
  id: string
  name: string
  workflow: WorkflowType
  products: number
  active: boolean
  designation?: string
}

// Demo category data per business
const BUSINESS_CATEGORIES: Record<string, { id: string; name: string; workflow: WorkflowType; products: number }[]> = {
  standard_grocery: [
    { id: "c1", name: "Fruits & Vegetables", workflow: "ECOMMERCE", products: 45 },
    { id: "c2", name: "Dairy & Bakery", workflow: "ECOMMERCE", products: 32 },
    { id: "c3", name: "Snacks & Beverages", workflow: "ECOMMERCE", products: 58 },
    { id: "c4", name: "Household Items", workflow: "ECOMMERCE", products: 24 },
  ],
  standard_laundry: [
    { id: "c1", name: "Wash & Fold", workflow: "ECOMMERCE", products: 3 },
    { id: "c2", name: "Dry Cleaning", workflow: "ECOMMERCE", products: 5 },
    { id: "c3", name: "Ironing Service", workflow: "ECOMMERCE", products: 2 },
  ],
  pro_laundry: [
    { id: "c1", name: "Standard Wash", workflow: "ECOMMERCE", products: 4 },
    { id: "c2", name: "Weight Wash", workflow: "POST_SERVICE_BILLING", products: 3 },
    { id: "c3", name: "Subscription Wash", workflow: "SUBSCRIPTION", products: 6 },
    { id: "c4", name: "Pickup & Delivery", workflow: "PICKUP_DELIVERY", products: 2 },
  ],
  pro_carwash: [
    { id: "c1", name: "Subscription Wash", workflow: "SUBSCRIPTION", products: 8 },
    { id: "c2", name: "Pickup Wash", workflow: "PICKUP_DELIVERY", products: 4 },
    { id: "c3", name: "Accessories", workflow: "ECOMMERCE", products: 15 },
    { id: "c4", name: "Appointment Wash", workflow: "APPOINTMENT", products: 6 },
    { id: "c5", name: "Detailing Service", workflow: "POST_SERVICE_BILLING", products: 5 },
  ],
}

function CategoryWorkflowRow({
  category,
  allowedWorkflows,
  onWorkflowChange,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  category: WorkflowCategory
  allowedWorkflows: WorkflowType[]
  onWorkflowChange: (id: string, workflow: WorkflowType) => void
  onToggleActive: (id: string) => void
  onEdit: (category: WorkflowCategory) => void
  onDelete: (category: WorkflowCategory) => void
}) {
  const config = WORKFLOW_CONFIGS.find((w) => w.type === category.workflow)
  const Icon = workflowIconMap[config?.icon || "ShoppingCart"] || ShoppingCart

  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config?.bgColor || "bg-muted"} border`}>
          <Icon className={`h-4 w-4 ${config?.color || "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{category.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{category.products} products</span>
            <Badge className={`rounded-full px-2 py-0.5 text-[10px] ${category.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
              {category.active ? "Active" : "Inactive"}
            </Badge>
            {category.designation && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                {category.designation}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Select value={category.workflow} onValueChange={(value) => onWorkflowChange(category.id, value as WorkflowType)}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_CONFIGS.map((wf) => {
              const isAllowed = allowedWorkflows.includes(wf.type)
              const WfIcon = workflowIconMap[wf.icon] || ShoppingCart
              return (
                <SelectItem key={wf.type} value={wf.type} disabled={!isAllowed}>
                  <div className="flex items-center gap-2">
                    <WfIcon className={`h-3.5 w-3.5 ${wf.color}`} />
                    <span>{wf.label}</span>
                    {!isAllowed && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onEdit(category)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => onDelete(category)}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Switch checked={category.active} onCheckedChange={() => onToggleActive(category.id)} aria-label="Toggle category active state" />
      </div>
    </div>
  )
}

function WorkflowStatusCard({
  workflowType,
  categories,
  isActive,
}: {
  workflowType: WorkflowType
  categories: { name: string }[]
  isActive: boolean
}) {
  const config = WORKFLOW_CONFIGS.find((w) => w.type === workflowType)
  if (!config) return null
  const Icon = workflowIconMap[config.icon] || ShoppingCart

  return (
    <Card className={`${isActive ? "" : "opacity-50"}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor} border`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{config.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{config.description}</p>
          </div>
          {isActive ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
              <Check className="h-2.5 w-2.5 mr-0.5" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px]">
              <Lock className="h-2.5 w-2.5 mr-0.5" /> Locked
            </Badge>
          )}
        </div>
        {isActive && categories.length > 0 && (
          <div className="space-y-1">
            {categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <ChevronRight className="h-3 w-3" />
                {cat.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkflowConfigView() {
  const { currentBusinessType, currentBusinessName } = useAdminStore()
  const activeWorkflows: WorkflowType[] = (BUSINESS_TYPE_WORKFLOWS[currentBusinessType] || ["ECOMMERCE"]) as WorkflowType[]
  const typeUI = BUSINESS_TYPE_UI[currentBusinessType] || BUSINESS_TYPE_UI["GROCERY"]
  const displayName = currentBusinessName || typeUI?.label || "Business"
  const businessCategories = BUSINESS_CATEGORIES[currentBusinessType] || BUSINESS_CATEGORIES["standard_grocery"] || []

  const [categories, setCategories] = useState<WorkflowCategory[]>(
    businessCategories.map((cat) => ({ ...cat, active: true, designation: "Sales Team" }))
  )
  const [activeDialog, setActiveDialog] = useState<"add" | "edit" | "delete" | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<WorkflowCategory>({
    id: "",
    name: "",
    workflow: "ECOMMERCE",
    products: 0,
    active: true,
    designation: "Sales Team",
  })
  const [deleteReassignCategoryId, setDeleteReassignCategoryId] = useState("")

  const workflowGroups = useMemo(() => {
    const groups: Record<WorkflowType, { name: string }[]> = {
      ECOMMERCE: [],
      PICKUP_DELIVERY: [],
      APPOINTMENT: [],
      SUBSCRIPTION: [],
      POST_SERVICE_BILLING: [],
    }

    categories.forEach((cat) => {
      if (groups[cat.workflow]) {
        groups[cat.workflow].push({ name: cat.name })
      }
    })

    return groups
  }, [categories])

  const openAddDialog = () => {
    setCategoryForm({
      id: `new-${Date.now()}`,
      name: "",
      workflow: activeWorkflows[0] ?? "ECOMMERCE",
      products: 0,
      active: true,
      designation: "Sales Team",
    })
    setSelectedCategory(null)
    setActiveDialog("add")
  }

  const openEditDialog = (category: WorkflowCategory) => {
    setSelectedCategory(category)
    setCategoryForm({ ...category })
    setActiveDialog("edit")
  }

  const openDeleteDialog = (category: WorkflowCategory) => {
    setSelectedCategory(category)
    setDeleteReassignCategoryId(
      categories.find((cat) => cat.id !== category.id)?.id ?? ""
    )
    setActiveDialog("delete")
  }

  const closeDialog = () => {
    setSelectedCategory(null)
    setActiveDialog(null)
    setDeleteReassignCategoryId("")
  }

  const handleWorkflowChange = (id: string, workflow: WorkflowType) => {
    setCategories((current) =>
      current.map((cat) => (cat.id === id ? { ...cat, workflow } : cat))
    )
  }

  const handleToggleActive = (id: string) => {
    setCategories((current) =>
      current.map((cat) => (cat.id === id ? { ...cat, active: !cat.active } : cat))
    )
  }

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) return

    setCategories((current) => {
      if (activeDialog === "edit" && selectedCategory) {
        return current.map((cat) =>
          cat.id === selectedCategory.id ? { ...cat, ...categoryForm } : cat
        )
      }

      return [...current, categoryForm]
    })

    closeDialog()
  }

  const handleConfirmDelete = () => {
    if (!selectedCategory) return

    setCategories((current) => {
      const newCategories = current.filter((cat) => cat.id !== selectedCategory.id)
      if (selectedCategory.products > 0 && deleteReassignCategoryId) {
        return newCategories.map((cat) =>
          cat.id === deleteReassignCategoryId
            ? { ...cat, products: cat.products + selectedCategory.products }
            : cat
        )
      }
      return newCategories
    })

    closeDialog()
  }

  const availableReassignCategories = categories.filter(
    (cat) => cat.id !== selectedCategory?.id
  )

  const canDeleteCategory =
    Boolean(selectedCategory) &&
    (selectedCategory?.products === 0 || Boolean(deleteReassignCategoryId)) &&
    !((selectedCategory?.products ?? 0) > 0 && availableReassignCategories.length === 0)

  const handleAddCategory = openAddDialog

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Workflow Configuration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign workflow types to categories — each category can use a different workflow
        </p>
      </div>

      {/* Business Context */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {activeWorkflows.length > 1 ? "Pro Plan — All Workflows Available" : "Standard Plan — Ecommerce Only"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {WORKFLOW_CONFIGS.map((wf) => {
                const isAllowed = activeWorkflows.includes(wf.type)
                const Icon = workflowIconMap[wf.icon] || ShoppingCart
                return (
                  <div
                    key={wf.type}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      isAllowed ? wf.bgColor : "bg-muted/50 border-dashed"
                    }`}
                    title={isAllowed ? wf.label : `${wf.label} (Pro Only)`}
                  >
                    <Icon className={`h-4 w-4 ${isAllowed ? wf.color : "text-muted-foreground"}`} />
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category → Workflow Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Category → Workflow Mapping
              </CardTitle>
              <CardDescription className="text-xs">
                Select which workflow each category uses. Products inherit their category&apos;s workflow.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleAddCategory}>
              <Plus className="h-3.5 w-3.5" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No categories configured</p>
              <p className="text-xs mt-1">Add categories and assign workflows</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <CategoryWorkflowRow
                  key={cat.id}
                  category={cat}
                  allowedWorkflows={activeWorkflows}
                  onWorkflowChange={handleWorkflowChange}
                  onToggleActive={handleToggleActive}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activeDialog === "add" || activeDialog === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeDialog === "edit" ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              Configure category details, workflow assignment, and safe reassignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="category-name">Category name</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="category-designation">Designation</Label>
                <Input
                  id="category-designation"
                  value={categoryForm.designation ?? ""}
                  onChange={(event) => setCategoryForm({ ...categoryForm, designation: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="category-workflow">Workflow</Label>
                <Select
                  value={categoryForm.workflow}
                  onValueChange={(value) => setCategoryForm({ ...categoryForm, workflow: value as WorkflowType })}
                >
                  <SelectTrigger id="category-workflow" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_CONFIGS.map((wf) => (
                      <SelectItem key={wf.type} value={wf.type}>
                        {wf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">Keep this category active for storefront use.</p>
                </div>
                <Switch
                  checked={categoryForm.active}
                  onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, active: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSaveCategory}>{activeDialog === "edit" ? "Save changes" : "Create category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "delete"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Remove a category safely without losing product assignments.
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-slate-50 p-4 text-sm">
                <p className="font-semibold">{selectedCategory.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCategory.products} product{selectedCategory.products === 1 ? "" : "s"} currently assigned.
                </p>
              </div>
              {selectedCategory.products > 0 ? (
                availableReassignCategories.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Reassign products before deleting</p>
                    <Select value={deleteReassignCategoryId} onValueChange={setDeleteReassignCategoryId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Choose target category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReassignCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Cannot delete this category because it still has products and no other category is available to reassign.
                  </div>
                )
              ) : (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  This category has no active product assignments and can be deleted immediately.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!canDeleteCategory}
              onClick={handleConfirmDelete}
            >
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Status Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4" />
          Active Workflows
        </h3>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {WORKFLOW_CONFIGS.map((wf) => (
            <WorkflowStatusCard
              key={wf.type}
              workflowType={wf.type}
              categories={workflowGroups[wf.type]}
              isActive={activeWorkflows.includes(wf.type)}
            />
          ))}
        </div>
      </div>

      {/* Upgrade Prompt for Standard users */}
      {activeWorkflows.length === 1 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Unlock All Workflows with Pro Plan</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade to Pro (₹4,999/mo) to access Pickup & Delivery, Appointment, Subscription, 
                  and Post-Service Billing workflows. Perfect for multi-service businesses.
                </p>
                <Button size="sm" className="mt-3 gap-1.5 text-xs">
                  Upgrade to Pro
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
