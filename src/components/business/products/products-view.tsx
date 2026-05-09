"use client"

import { useState, useMemo, useCallback } from "react"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatusBadge } from "@/components/admin/shared/status-badge"
import { EmptyState } from "@/components/ui/loading-states"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  X,
  Upload,
  Tag,
  Barcode,
  DollarSign,
  ToggleRight,
  Grid3X3,
  List,
  Workflow,
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
} from "lucide-react"
import { useAdminStore, type WorkflowType, WORKFLOW_CONFIGS } from "@/stores/admin-store"
import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"
import { showSuccess, showError } from "@/lib/toast-utils"

// Local type definitions (replacing mock data types)
type ProductStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | "OUT_OF_STOCK"
type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"

const BUSINESS_ID = "biz_1"

// Workflow icon mapping for category dialog
const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Variant {
  id: string
  name: string
  sku: string
  mrp: number
  price: number
  stock: number
  isDefault: boolean
}

interface Product {
  id: string
  name: string
  slug: string
  categoryId: string
  category: string
  status: ProductStatus
  isVeg: boolean
  isFeatured: boolean
  image: string
  variants: Variant[]
}

interface Category {
  id: string
  name: string
  slug: string
  productCount: number
  icon: string
  color: string
  sortOrder: number
  workflow?: WorkflowType
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStockStatus(stock: number): StockStatus {
  if (stock === 0) return "OUT_OF_STOCK"
  if (stock < 30) return "LOW_STOCK"
  return "IN_STOCK"
}

function getStockBadge(stock: number) {
  const status = getStockStatus(stock)
  if (status === "OUT_OF_STOCK") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 text-xs border-0">
        Out of Stock
      </Badge>
    )
  }
  if (status === "LOW_STOCK") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs border-0">
        Low Stock ({stock})
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs border-0">
      In Stock ({stock})
    </Badge>
  )
}

function getPriceRange(variants: Variant[]): string {
  if (variants.length === 0) return "—"
  const prices = variants.map((v) => v.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return `₹${min.toLocaleString("en-IN")}`
  return `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`
}

function getTotalStock(variants: Variant[]): number {
  return variants.reduce((sum, v) => sum + v.stock, 0)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
}

// Category icon mapping (supports emoji icons from API or fallback to initials)
function CategoryIcon({ icon, color, name }: { icon: string; color: string; name: string }) {
  const isEmoji = icon && /\p{Emoji}/u.test(icon) && icon.length <= 4
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {isEmoji ? (
        <span className="text-lg">{icon}</span>
      ) : (
        <span className="text-sm font-bold">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function ProductsView() {
  // Get demo business context
  const { demoBusinessId } = useAdminStore()

  // ---- Demo data based on business context ----
  const demoProductList: Product[] = useMemo(() => {
    return getDemoProducts(demoBusinessId).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      category: p.category,
      status: p.status as ProductStatus,
      isVeg: p.isVeg,
      isFeatured: p.isFeatured,
      image: p.image,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        mrp: v.mrp,
        price: v.price,
        stock: v.stock,
        isDefault: v.isDefault,
      })),
    }))
  }, [demoBusinessId])

  const demoCategoryList: Category[] = useMemo(() => {
    const cats = getDemoCategories(demoBusinessId)
    const prods = getDemoProducts(demoBusinessId)
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: prods.filter((p) => p.categoryId === c.id).length,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      workflow: c.workflow,
    }))
  }, [demoBusinessId])

  // ---- Product state ----
  const [productList, setProductList] = useState<Product[]>([])
  const [categoryList, setCategoryList] = useState<Category[]>([])

  // Sync: use local additions first, then fill from demo data
  const syncedProductList = useMemo(() => {
    const localOnly = productList.filter(
      (lp) => !demoProductList.some((dp) => dp.id === lp.id)
    )
    return [...demoProductList, ...localOnly]
  }, [demoProductList, productList])

  const syncedCategoryList = useMemo(() => {
    const localOnly = categoryList.filter(
      (lc) => !demoCategoryList.some((dc) => dc.id === lc.id)
    )
    return [...demoCategoryList, ...localOnly]
  }, [demoCategoryList, categoryList])

  // ---- Filter state ----
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [workflowFilter, setWorkflowFilter] = useState<string>("ALL")

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState("products")

  // ---- Product detail sheet ----
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ---- Add/Edit product dialog ----
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // ---- Product form state ----
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formIsVeg, setFormIsVeg] = useState(true)
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formStatus, setFormStatus] = useState<string>("ACTIVE")
  const [formVariants, setFormVariants] = useState<
    { name: string; sku: string; mrp: string; price: string; stock: string }[]
  >([{ name: "", sku: "", mrp: "", price: "", stock: "" }])

  // ---- Delete confirmation dialog ----
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // ---- Add category dialog ----
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [catFormName, setCatFormName] = useState("")
  const [catFormSlug, setCatFormSlug] = useState("")
  const [catFormColor, setCatFormColor] = useState("#10B981")
  const [catFormSortOrder, setCatFormSortOrder] = useState("")
  const [catFormWorkflow, setCatFormWorkflow] = useState<WorkflowType>("ECOMMERCE")
  const [catFormIcon, setCatFormIcon] = useState("📦")

  // ---- Category emoji options ----
  const categoryEmojis = ["🥬", "🥛", "🍪", "🌾", "🌶️", "✨", "🧹", "❄️", "👕", "🧥", "♨️", "🚚", "🔄", "⚖️", "🚗", "📅", "🧴", "📦", "🛒", "🎨", "💊", "🍕", "🎂", "🧁", "☕", "🍖", "🥩", "🐟", "📱", "💡"]

  // ---- Edit variant dialog ----
  const [editVariantDialogOpen, setEditVariantDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null)
  const [editVariantProductId, setEditVariantProductId] = useState<string>("")
  const [variantFormName, setVariantFormName] = useState("")
  const [variantFormSku, setVariantFormSku] = useState("")
  const [variantFormMrp, setVariantFormMrp] = useState("")
  const [variantFormPrice, setVariantFormPrice] = useState("")
  const [variantFormStock, setVariantFormStock] = useState("")

  // =========================================================================
  // Computed values
  // =========================================================================
  const summaryStats = useMemo(() => {
    const total = syncedProductList.length
    const active = syncedProductList.filter((p) => p.status === "ACTIVE").length
    const outOfStock = syncedProductList.filter((p) => getTotalStock(p.variants) === 0).length
    const lowStock = syncedProductList.filter(
      (p) => {
        const stock = getTotalStock(p.variants)
        return stock > 0 && stock < 30
      }
    ).length
    return { total, active, outOfStock, lowStock }
  }, [syncedProductList])

  // Available workflows from current categories
  const availableWorkflows = useMemo(() => {
    const wfSet = new Set<string>()
    for (const cat of syncedCategoryList) {
      if (cat.workflow) wfSet.add(cat.workflow)
    }
    return Array.from(wfSet)
  }, [syncedCategoryList])

  // Workflow lookup for product (from its category)
  const getWorkflowForProduct = useCallback((categoryId: string): WorkflowType | undefined => {
    return syncedCategoryList.find((c) => c.id === categoryId)?.workflow
  }, [syncedCategoryList])

  const filteredProducts = useMemo(() => {
    return syncedProductList.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchCategory = categoryFilter === "ALL" || p.categoryId === categoryFilter

      const totalStock = getTotalStock(p.variants)
      let matchStatus = true
      if (statusFilter === "ACTIVE") matchStatus = p.status === "ACTIVE"
      else if (statusFilter === "INACTIVE") matchStatus = p.status === "INACTIVE"
      else if (statusFilter === "OUT_OF_STOCK") matchStatus = totalStock === 0 || p.status === "OUT_OF_STOCK"

      const pWorkflow = getWorkflowForProduct(p.categoryId)
      const matchWorkflow = workflowFilter === "ALL" || pWorkflow === workflowFilter

      return matchSearch && matchCategory && matchStatus && matchWorkflow
    })
  }, [syncedProductList, searchQuery, categoryFilter, statusFilter, workflowFilter, getWorkflowForProduct])

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleNameChange = (value: string) => {
    setFormName(value)
    if (!editingProduct) {
      setFormSlug(slugify(value))
    }
  }

  const resetProductForm = () => {
    setFormName("")
    setFormSlug("")
    setFormCategory("")
    setFormIsVeg(true)
    setFormIsFeatured(false)
    setFormStatus("ACTIVE")
    setFormVariants([{ name: "", sku: "", mrp: "", price: "", stock: "" }])
    setEditingProduct(null)
  }

  const openAddProduct = () => {
    resetProductForm()
    setProductDialogOpen(true)
  }

  const openEditProduct = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormSlug(product.slug)
    setFormCategory(product.categoryId)
    setFormIsVeg(product.isVeg)
    setFormIsFeatured(product.isFeatured)
    setFormStatus(product.status)
    setFormVariants(
      product.variants.map((v) => ({
        name: v.name,
        sku: v.sku,
        mrp: String(v.mrp),
        price: String(v.price),
        stock: String(v.stock),
      }))
    )
    setProductDialogOpen(true)
  }

  const handleSaveProduct = async () => {
    if (!formName || !formCategory) return

    const categoryObj = syncedCategoryList.find((c) => c.id === formCategory)

    try {
      if (editingProduct) {
        // Optimistic update: update local state immediately
        setProductList((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  name: formName,
                  slug: formSlug,
                  categoryId: formCategory,
                  category: categoryObj?.name || p.category,
                  status: formStatus as ProductStatus,
                  isVeg: formIsVeg,
                  isFeatured: formIsFeatured,
                  variants: formVariants.map((fv, i) => ({
                    id: p.variants[i]?.id || `var_new_${Date.now()}_${i}`,
                    name: fv.name,
                    sku: fv.sku,
                    mrp: Number(fv.mrp) || 0,
                    price: Number(fv.price) || 0,
                    stock: Number(fv.stock) || 0,
                    isDefault: i === 0,
                  })),
                }
              : p
          )
        )
        showSuccess("Product updated successfully")
      } else {
        const newProduct: Product = {
          id: `prod_${Date.now()}`,
          name: formName,
          slug: formSlug || slugify(formName),
          categoryId: formCategory,
          category: categoryObj?.name || "Unknown",
          status: formStatus as ProductStatus,
          isVeg: formIsVeg,
          isFeatured: formIsFeatured,
          image: "",
          variants: formVariants.map((fv, i) => ({
            id: `var_${Date.now()}_${i}`,
            name: fv.name,
            sku: fv.sku,
            mrp: Number(fv.mrp) || 0,
            price: Number(fv.price) || 0,
            stock: Number(fv.stock) || 0,
            isDefault: i === 0,
          })),
        }
        setProductList((prev) => [...prev, newProduct])
        showSuccess("Product created successfully")
      }

      setProductDialogOpen(false)
      resetProductForm()
    } catch {
      showError("Failed to save product")
    }
  }

  const handleToggleAvailability = async (productId: string) => {
    const product = syncedProductList.find((p) => p.id === productId)
    if (!product) return

    const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    // Optimistic update
    setProductList((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, status: newStatus as ProductStatus }
          : p
      )
    )
    showSuccess(`Product ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`)
  }

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return
    // Optimistic delete
    setProductList((prev) => prev.filter((p) => p.id !== deletingProduct.id))
    setDeleteDialogOpen(false)
    setDeletingProduct(null)
    setDetailOpen(false)
    setSelectedProduct(null)
    showSuccess("Product deleted")
  }

  const openEditVariant = (variant: Variant, productId: string) => {
    setEditingVariant(variant)
    setEditVariantProductId(productId)
    setVariantFormName(variant.name)
    setVariantFormSku(variant.sku)
    setVariantFormMrp(String(variant.mrp))
    setVariantFormPrice(String(variant.price))
    setVariantFormStock(String(variant.stock))
    setEditVariantDialogOpen(true)
  }

  const handleSaveVariant = () => {
    if (!editingVariant || !editVariantProductId) return
    setProductList((prev) =>
      prev.map((p) =>
        p.id === editVariantProductId
          ? {
              ...p,
              variants: p.variants.map((v) =>
                v.id === editingVariant.id
                  ? {
                      ...v,
                      name: variantFormName,
                      sku: variantFormSku,
                      mrp: Number(variantFormMrp) || 0,
                      price: Number(variantFormPrice) || 0,
                      stock: Number(variantFormStock) || 0,
                    }
                  : v
              ),
            }
          : p
      )
    )
    // Also update the selected product if it's open
    if (selectedProduct && selectedProduct.id === editVariantProductId) {
      setSelectedProduct((prev) =>
        prev
          ? {
              ...prev,
              variants: prev.variants.map((v) =>
                v.id === editingVariant.id
                  ? {
                      ...v,
                      name: variantFormName,
                      sku: variantFormSku,
                      mrp: Number(variantFormMrp) || 0,
                      price: Number(variantFormPrice) || 0,
                      stock: Number(variantFormStock) || 0,
                    }
                  : v
              ),
            }
          : null
      )
    }
    setEditVariantDialogOpen(false)
    setEditingVariant(null)
  }

  const addFormVariant = () => {
    setFormVariants((prev) => [...prev, { name: "", sku: "", mrp: "", price: "", stock: "" }])
  }

  const removeFormVariant = (index: number) => {
    setFormVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const updateFormVariant = (index: number, field: string, value: string) => {
    setFormVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    )
  }

  // ---- Category handlers ----
  const resetCategoryForm = () => {
    setCatFormName("")
    setCatFormSlug("")
    setCatFormColor("#10B981")
    setCatFormSortOrder("")
    setCatFormWorkflow("ECOMMERCE")
    setCatFormIcon("📦")
  }

  const handleCatNameChange = (value: string) => {
    setCatFormName(value)
    setCatFormSlug(slugify(value))
  }

  const handleSaveCategory = () => {
    if (!catFormName) return
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: catFormName,
      slug: catFormSlug || slugify(catFormName),
      productCount: 0,
      icon: catFormIcon,
      color: catFormColor,
      sortOrder: Number(catFormSortOrder) || categoryList.length + 1,
      workflow: catFormWorkflow,
    }
    setCategoryList((prev) => [...prev, newCategory])
    setCategoryDialogOpen(false)
    resetCategoryForm()
    showSuccess("Category created successfully")
  }

  // ---- Category stats ----
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const cat of syncedCategoryList) {
      stats[cat.id] = syncedProductList.filter((p) => p.categoryId === cat.id).length
    }
    return stats
  }, [syncedCategoryList, syncedProductList])

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Page Header                                                        */}
      {/* ================================================================== */}
      <PageHeader
        title="Products"
        description="Manage your product catalog, variants, and categories"
        icon={Package}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCategoryDialogOpen(true)}>
              <Tag className="h-4 w-4" />
              Add Category
            </Button>
            <Button className="gap-2" onClick={openAddProduct}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        }
      />

      {/* ================================================================== */}
      {/* Tabs                                                               */}
      {/* ================================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products" className="gap-2">
            <List className="h-4 w-4" />
            All Products
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Grid3X3 className="h-4 w-4" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* Products Tab                                                   */}
        {/* ============================================================== */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* ---- Summary Cards ---- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <Package className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Products</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <ToggleRight className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <X className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.outOfStock}</p>
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Filter className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.lowStock}</p>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                </div>
              </CardContent>
            </Card>
            </>
          </div>

          {/* ---- Filter Bar ---- */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, SKUs..."
                className="pl-8 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {syncedCategoryList.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableWorkflows.length > 1 && (
              <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
                <SelectTrigger className="w-[170px] h-9">
                  <SelectValue placeholder="All Workflows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Workflows</SelectItem>
                  {availableWorkflows.map((wf) => (
                    <SelectItem key={wf} value={wf}>
                      {wf.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            {(categoryFilter !== "ALL" || statusFilter !== "ALL" || workflowFilter !== "ALL" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setCategoryFilter("ALL")
                  setStatusFilter("ALL")
                  setWorkflowFilter("ALL")
                }}
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* ---- Products Table ---- */}
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description="Try adjusting your filters or add a new product to get started"
              action={{
                label: "Add Product",
                onClick: openAddProduct,
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Variants</TableHead>
                        <TableHead>Price Range</TableHead>
                        <TableHead>Stock Status</TableHead>
                        <TableHead className="text-center">Availability</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const totalStock = getTotalStock(product.variants)
                        return (
                          <TableRow
                            key={product.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedProduct(product)
                              setDetailOpen(true)
                            }}
                          >
                            {/* Product Name */}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm truncate">{product.name}</span>
                                    {product.isFeatured && (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] border-0 shrink-0">
                                        Featured
                                      </Badge>
                                    )}
                                    {product.isVeg && (
                                      <div className="w-4 h-4 border-2 border-emerald-500 rounded flex items-center justify-center shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{product.slug}</span>
                                </div>
                              </div>
                            </TableCell>

                            {/* Category */}
                            <TableCell>
                              <span className="text-sm">{product.category}</span>
                            </TableCell>

                            {/* Workflow */}
                            <TableCell>
                              {(() => {
                                const wf = getWorkflowForProduct(product.categoryId)
                                if (!wf) return <span className="text-xs text-muted-foreground">—</span>
                                const wfConfig = WORKFLOW_CONFIGS.find(w => w.type === wf)
                                return (
                                  <Badge variant="outline" className={`text-[10px] gap-1 ${wfConfig?.color || ""}`}>
                                    <Workflow className="h-3 w-3" />
                                    {wf.replace(/_/g, " ")}
                                  </Badge>
                                )
                              })()}
                            </TableCell>

                            {/* Variants */}
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}
                              </Badge>
                            </TableCell>

                            {/* Price Range */}
                            <TableCell>
                              <span className="text-sm font-medium">{getPriceRange(product.variants)}</span>
                            </TableCell>

                            {/* Stock Status */}
                            <TableCell>{getStockBadge(totalStock)}</TableCell>

                            {/* Availability Toggle */}
                            <TableCell className="text-center">
                              <div onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={product.status === "ACTIVE"}
                                  onCheckedChange={() => handleToggleAvailability(product.id)}
                                  className="data-[state=checked]:bg-emerald-500"
                                />
                              </div>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div
                                className="flex items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setSelectedProduct(product)
                                    setDetailOpen(true)
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => openEditProduct(product)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setDeletingProduct(product)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* Categories Tab                                                 */}
        {/* ============================================================== */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {syncedCategoryList.map((cat) => {
              const count = categoryStats[cat.id] || 0
              return (
                <Card
                  key={cat.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setCategoryFilter(cat.id)
                    setActiveTab("products")
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <CategoryIcon icon={cat.icon} color={cat.color} name={cat.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{cat.name}</p>
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.slug}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {count} {count === 1 ? "product" : "products"}
                          </Badge>
                          {cat.workflow && (() => {
                            const wfConfig = WORKFLOW_CONFIGS.find(w => w.type === cat.workflow)
                            return (
                              <Badge variant="outline" className={`text-[10px] gap-1 ${wfConfig?.color || ""}`}>
                                <Workflow className="h-2.5 w-2.5" />
                                {cat.workflow.replace(/_/g, " ")}
                              </Badge>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Add Category Card */}
            <Card
              className="border-dashed hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[100px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mt-2">Add Category</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/* Product Detail Sheet                                               */}
      {/* ================================================================== */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedProduct(null)
        }}
      >
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          {selectedProduct && (() => {
            const product = selectedProduct
            const categoryObj = syncedCategoryList.find((c) => c.id === product.categoryId)
            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <SheetTitle className="text-lg truncate">{product.name}</SheetTitle>
                      <SheetDescription className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium" style={{ borderColor: categoryObj?.color, color: categoryObj?.color }}>
                          {product.category}
                        </Badge>
                        <StatusBadge status={product.status} />
                        {product.isVeg && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <div className="w-3 h-3 border-2 border-emerald-500 rounded flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            </div>
                            Veg
                          </span>
                        )}
                        {product.isFeatured && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] border-0">
                            Featured
                          </Badge>
                        )}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-6 p-6">
                    {/* ---- Image Placeholder ---- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product Image
                      </h4>
                      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed bg-muted/30">
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                          <p className="text-xs text-muted-foreground mt-2">No image uploaded</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* ---- Product Info ---- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product Details
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">Slug</p>
                          <p className="text-sm font-medium">{product.slug}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">Total Stock</p>
                          <p className="text-sm font-medium">{getTotalStock(product.variants)} units</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">Price Range</p>
                          <p className="text-sm font-medium">{getPriceRange(product.variants)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">Variants</p>
                          <p className="text-sm font-medium">{product.variants.length}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* ---- Variants List ---- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Variants
                      </h4>
                      <div className="space-y-3">
                        {product.variants.map((variant) => (
                          <div
                            key={variant.id}
                            className="rounded-lg border p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Barcode className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{variant.name}</span>
                                {variant.isDefault && (
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-[10px] border-0">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => openEditVariant(variant, product.id)}
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">SKU:</span>
                                <span className="font-mono font-medium">{variant.sku}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">MRP:</span>
                                <span className="font-medium">₹{variant.mrp.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Selling:</span>
                                <span className="font-semibold text-emerald-600">₹{variant.price.toLocaleString("en-IN")}</span>
                                {variant.mrp > variant.price && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    ₹{variant.mrp.toLocaleString("en-IN")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Stock:</span>
                                <span className="font-medium">{variant.stock}</span>
                                <span
                                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                                    variant.stock === 0
                                      ? "bg-red-500"
                                      : variant.stock < 30
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* ---- Danger Zone ---- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-red-600">
                        Danger Zone
                      </h4>
                      <div className="rounded-lg border border-red-200 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Delete this product</p>
                          <p className="text-xs text-muted-foreground">
                            This action cannot be undone. All variants will be permanently removed.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setDeletingProduct(product)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* ================================================================== */}
      {/* Add/Edit Product Dialog                                            */}
      {/* ================================================================== */}
      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open)
          if (!open) resetProductForm()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update product details and variants"
                : "Add a new product to your catalog with variants"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  placeholder="e.g. Amul Toned Milk"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  placeholder="Auto-generated"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                />
              </div>
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {syncedCategoryList.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <span>{cat.name}</span>
                          {cat.workflow && (
                            <Badge variant="outline" className="text-[9px] ml-1">
                              {cat.workflow.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggles: Is Veg & Is Featured */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Vegetarian</Label>
                  <p className="text-xs text-muted-foreground">Mark as veg product</p>
                </div>
                <Switch checked={formIsVeg} onCheckedChange={setFormIsVeg} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Featured</Label>
                  <p className="text-xs text-muted-foreground">Show in featured section</p>
                </div>
                <Switch checked={formIsFeatured} onCheckedChange={setFormIsFeatured} />
              </div>
            </div>

            <Separator />

            {/* ---- Variant Builder ---- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Variants</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={addFormVariant}
                >
                  <Plus className="h-3 w-3" />
                  Add another variant
                </Button>
              </div>

              <div className="space-y-3">
                {formVariants.map((variant, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Variant {index + 1} {index === 0 && "(Default)"}
                      </span>
                      {formVariants.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-red-600 hover:text-red-700"
                          onClick={() => removeFormVariant(index)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Variant Name</Label>
                        <Input
                          placeholder="e.g. 500ml"
                          className="h-8 text-sm"
                          value={variant.name}
                          onChange={(e) => updateFormVariant(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">SKU</Label>
                        <Input
                          placeholder="e.g. AML-MLK-500"
                          className="h-8 text-sm"
                          value={variant.sku}
                          onChange={(e) => updateFormVariant(index, "sku", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">MRP (₹)</Label>
                        <Input
                          placeholder="0"
                          type="number"
                          className="h-8 text-sm"
                          value={variant.mrp}
                          onChange={(e) => updateFormVariant(index, "mrp", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Selling Price (₹)</Label>
                        <Input
                          placeholder="0"
                          type="number"
                          className="h-8 text-sm"
                          value={variant.price}
                          onChange={(e) => updateFormVariant(index, "price", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Stock Quantity</Label>
                        <Input
                          placeholder="0"
                          type="number"
                          className="h-8 text-sm"
                          value={variant.stock}
                          onChange={(e) => updateFormVariant(index, "stock", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* ---- Image Upload Placeholder ---- */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Product Image</Label>
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="text-center">
                  <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                  <p className="text-xs text-muted-foreground mt-1">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProductDialogOpen(false)
                resetProductForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProduct}>
              {editingProduct ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Delete Confirmation Dialog                                         */}
      {/* ================================================================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone and will remove all variants.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletingProduct(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Edit Variant Dialog                                                */}
      {/* ================================================================== */}
      <Dialog
        open={editVariantDialogOpen}
        onOpenChange={(open) => {
          setEditVariantDialogOpen(open)
          if (!open) setEditingVariant(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
            <DialogDescription>
              Update variant details for {editingVariant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Variant Name</Label>
                <Input
                  value={variantFormName}
                  onChange={(e) => setVariantFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={variantFormSku}
                  onChange={(e) => setVariantFormSku(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MRP (₹)</Label>
                <Input
                  type="number"
                  value={variantFormMrp}
                  onChange={(e) => setVariantFormMrp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (₹)</Label>
                <Input
                  type="number"
                  value={variantFormPrice}
                  onChange={(e) => setVariantFormPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <Input
                type="number"
                value={variantFormStock}
                onChange={(e) => setVariantFormStock(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVariantDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVariant}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Add Category Dialog                                                */}
      {/* ================================================================== */}
      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open)
          if (!open) resetCategoryForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new product category and assign a workflow type
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  placeholder="e.g. Dairy & Eggs"
                  value={catFormName}
                  onChange={(e) => handleCatNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  placeholder="Auto-generated"
                  value={catFormSlug}
                  onChange={(e) => setCatFormSlug(e.target.value)}
                />
              </div>
            </div>

            {/* Workflow Type */}
            <div className="space-y-2">
              <Label>Workflow Type</Label>
              <Select value={catFormWorkflow} onValueChange={(v) => setCatFormWorkflow(v as WorkflowType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_CONFIGS.map((wf) => {
                    const Icon = workflowIconMap[wf.icon] || ShoppingCart
                    return (
                      <SelectItem key={wf.type} value={wf.type}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${wf.color}`} />
                          <span>{wf.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Determines how orders for products in this category are processed
              </p>
            </div>

            {/* Icon Picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {categoryEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center text-sm transition-all ${
                      catFormIcon === emoji ? "border-primary scale-110 bg-primary/10" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setCatFormIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={catFormColor}
                  onChange={(e) => setCatFormColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <div className="flex gap-2">
                  {["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#0891B2", "#D97706"].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-7 w-7 rounded-full border-2 transition-all ${
                          catFormColor === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setCatFormColor(color)}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                placeholder="e.g. 1"
                value={catFormSortOrder}
                onChange={(e) => setCatFormSortOrder(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
