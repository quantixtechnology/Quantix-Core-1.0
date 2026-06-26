"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Edit2, Plus, Search, Eye, Loader2, Check, X,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { Badge } from "@/components/ui/badge"

interface Product {
  id: string
  code: string
  name: string
  slug: string
  description?: string
  workspaceUrl: string
  currentVersion: string
  status: string
  isEnabled: boolean
  defaultStorageQuotaMB: number
  createdAt: string
  updatedAt: string
}

interface PaginationData {
  total: number
  page: number
  limit: number
  pages: number
}

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isToggleOpen, setIsToggleOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    slug: '',
    description: '',
    workspaceUrl: '',
    currentVersion: '1.0.0',
    status: 'ACTIVE',
    isEnabled: true,
    defaultStorageQuotaMB: 1048576,
  })

  const [submitting, setSubmitting] = useState(false)

  // Load products
  useEffect(() => {
    loadProducts()
  }, [page])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await authFetch(`/api/admin/products?page=${page}&limit=20`)
      const json = await res.json()
      if (json.success) {
        setProducts(json.data)
        setPagination(json.pagination)
      } else {
        toast.error('Failed to load products')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading products')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      slug: '',
      description: '',
      workspaceUrl: '',
      currentVersion: '1.0.0',
      status: 'ACTIVE',
      isEnabled: true,
      defaultStorageQuotaMB: 1048576,
    })
  }

  function openCreateDialog() {
    resetForm()
    setSelectedProduct(null)
    setIsCreateOpen(true)
  }

  function openEditDialog(product: Product) {
    setFormData({
      code: product.code,
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      workspaceUrl: product.workspaceUrl,
      currentVersion: product.currentVersion,
      status: product.status,
      isEnabled: product.isEnabled,
      defaultStorageQuotaMB: product.defaultStorageQuotaMB,
    })
    setSelectedProduct(product)
    setIsEditOpen(true)
  }

  function openToggleDialog(product: Product) {
    setSelectedProduct(product)
    setIsToggleOpen(true)
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await authFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Product created successfully')
        setIsCreateOpen(false)
        resetForm()
        setPage(1)
        loadProducts()
      } else {
        toast.error(json.errors?.code || json.error || 'Failed to create product')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creating product')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) return

    setSubmitting(true)
    try {
      const res = await authFetch(`/api/admin/products/${selectedProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Product updated successfully')
        setIsEditOpen(false)
        loadProducts()
      } else {
        toast.error(json.error || 'Failed to update product')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating product')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleProduct() {
    if (!selectedProduct) return

    setSubmitting(true)
    try {
      const res = await authFetch(`/api/admin/products/${selectedProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: !selectedProduct.isEnabled,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(
          selectedProduct.isEnabled
            ? 'Product disabled successfully'
            : 'Product enabled successfully'
        )
        setIsToggleOpen(false)
        loadProducts()
      } else {
        toast.error(json.error || 'Failed to toggle product')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error toggling product')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = {
    ACTIVE: 'bg-green-100 text-green-800',
    PLANNED: 'bg-blue-100 text-blue-800',
    DEPRECATED: 'bg-yellow-100 text-yellow-800',
    DISABLED: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Manage platform products and workspaces"
        action={
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        }
      />

      {/* Products Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No products registered yet. Create one to get started.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Workspace URL</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-semibold">{product.name}</TableCell>
                    <TableCell className="font-mono text-sm">{product.code}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.workspaceUrl}
                    </TableCell>
                    <TableCell className="text-sm">{product.currentVersion}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColor[product.status as keyof typeof statusColor] || ''}
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {product.isEnabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(product.defaultStorageQuotaMB / 1024).toFixed(0)} GB
                    </TableCell>
                    <TableCell className="text-right gap-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                        className="gap-1"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant={product.isEnabled ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => openToggleDialog(product)}
                      >
                        {product.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="gap-2 flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-sm">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Register a new product in the Quantix platform
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Product Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., COMMERCE"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Commerce OS"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="slug">Product Slug *</Label>
              <Input
                id="slug"
                placeholder="e.g., commerce-os"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the product"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="workspaceUrl">Workspace URL *</Label>
              <Input
                id="workspaceUrl"
                placeholder="e.g., commerce.quantixtechnology.in"
                value={formData.workspaceUrl}
                onChange={(e) => setFormData({ ...formData, workspaceUrl: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="version">Current Version</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={formData.currentVersion}
                  onChange={(e) => setFormData({ ...formData, currentVersion: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product information
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Product Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-workspaceUrl">Workspace URL</Label>
              <Input
                id="edit-workspaceUrl"
                value={formData.workspaceUrl}
                onChange={(e) => setFormData({ ...formData, workspaceUrl: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-version">Current Version</Label>
                <Input
                  id="edit-version"
                  value={formData.currentVersion}
                  onChange={(e) => setFormData({ ...formData, currentVersion: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Update Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirmation Dialog */}
      <AlertDialog open={isToggleOpen} onOpenChange={setIsToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedProduct?.isEnabled ? 'Disable Product' : 'Enable Product'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProduct?.isEnabled
                ? `Are you sure you want to disable ${selectedProduct?.name}? Existing businesses may be affected.`
                : `Are you sure you want to enable ${selectedProduct?.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={handleToggleProduct} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {selectedProduct?.isEnabled ? 'Disable' : 'Enable'}
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
