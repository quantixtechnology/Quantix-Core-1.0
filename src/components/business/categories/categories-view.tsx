"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Tag, Plus, Search, Loader2, ChevronRight, ImageIcon, Edit2, Trash2, FolderOpen,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  icon: string | null
  color: string | null
  parentId: string | null
  isActive: boolean
  sortOrder: number
  workflowType: string | null
  storeId: string | null
  children?: Category[]
}

const WORKFLOW_OPTIONS = [
  { value: "ECOMMERCE",            label: "Ecommerce" },
  { value: "PICKUP_DELIVERY",      label: "Pickup & Delivery" },
  { value: "APPOINTMENT",          label: "Appointment" },
  { value: "SUBSCRIPTION",         label: "Subscription" },
  { value: "POST_SERVICE_BILLING", label: "Post Service Billing" },
]

const PRESET_COLORS = [
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#0891B2", "#D97706",
  "#6366F1", "#14B8A6",
]

const CATEGORY_EMOJIS = [
  "🥬","🥛","🍪","🌾","🌶️","✨","🧹","❄️","👕","🧥",
  "♨️","🚚","🔄","⚖️","🚗","📅","🧴","📦","🛒","🎨",
  "💊","🍕","🎂","🧁","☕","🍖","🥩","🐟","📱","💡",
]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

const emptyForm = {
  name: "", slug: "", description: "", image: "", icon: "📦",
  color: "#10B981", sortOrder: "0", isActive: true, parentId: "", workflowType: "ECOMMERCE",
}

export function CategoriesView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/categories`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setCategories(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ ...emptyForm })
    setEditTarget(null)
    setCreateOpen(true)
  }

  const openEdit = (cat: Category) => {
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      image: cat.image ?? "",
      icon: cat.icon ?? "📦",
      color: cat.color ?? "#10B981",
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
      parentId: cat.parentId ?? "",
      workflowType: cat.workflowType ?? "ECOMMERCE",
    })
    setEditTarget(cat)
    setCreateOpen(true)
  }

  const handleNameChange = (value: string) => {
    setForm(f => ({
      ...f,
      name: value,
      slug: editTarget ? f.slug : slugify(value),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const method = editTarget ? "PATCH" : "POST"
      const payload = {
        ...(editTarget ? { id: editTarget.id } : {}),
        name: form.name.trim(),
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        image: form.image || null,
        icon: form.icon || null,
        color: form.color || null,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
        parentId: form.parentId || null,
        workflowType: form.workflowType || "ECOMMERCE",
      }
      const res = await fetch(`/api/core/businesses/${businessId}/categories`, {
        method,
        headers: { "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setCreateOpen(false); load() }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products will be uncategorized; subcategories will become top-level.")) return
    setDeleting(id)
    try {
      await fetch(`/api/core/businesses/${businessId}/categories?id=${id}`, {
        method: "DELETE",
        headers: { "x-business-id": businessId },
      })
      load()
    } finally {
      setDeleting(null)
    }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )
  const parents  = filtered.filter(c => !c.parentId)
  const childMap = filtered.reduce<Record<string, Category[]>>((acc, c) => {
    if (c.parentId) { acc[c.parentId] = [...(acc[c.parentId] ?? []), c] }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Single source of truth for all product categories and sub-categories"
        icon={Tag}
        action={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search categories…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",    value: categories.length,                         color: "text-foreground" },
          { label: "Active",   value: categories.filter(c => c.isActive).length,  color: "text-emerald-600" },
          { label: "Inactive", value: categories.filter(c => !c.isActive).length, color: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label} className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category tree */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : parents.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No categories yet</p>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> Create First Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {parents.length} top-level {parents.length === 1 ? "category" : "categories"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {parents.map(cat => (
                <div key={cat.id}>
                  {/* Parent row */}
                  <div className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 group">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm shrink-0"
                      style={{ backgroundColor: cat.color ? `${cat.color}20` : "#10B98120" }}
                    >
                      {cat.icon || <Tag className="h-4 w-4" style={{ color: cat.color ?? "#10B981" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        {!cat.isActive && <Badge variant="secondary" className="text-[10px] h-4">Inactive</Badge>}
                        {cat.workflowType && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            {cat.workflowType.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {cat.color && (
                          <span
                            className="inline-block h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                      </div>
                      {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {childMap[cat.id] && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {childMap[cat.id].length} sub
                        </Badge>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cat)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        disabled={deleting === cat.id}
                        onClick={() => handleDelete(cat.id)}
                      >
                        {deleting === cat.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Children */}
                  {childMap[cat.id]?.map(child => (
                    <div key={child.id} className="flex items-center gap-3 px-6 py-2.5 bg-muted/20 hover:bg-muted/40 group border-l-2 border-l-muted ml-6">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm truncate">{child.name}</p>
                          {!child.isActive && <Badge variant="secondary" className="text-[10px] h-4">Inactive</Badge>}
                          {child.color && (
                            <span
                              className="inline-block h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: child.color }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(child)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          disabled={deleting === child.id}
                          onClick={() => handleDelete(child.id)}
                        >
                          {deleting === child.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) setEditTarget(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name + Slug */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  placeholder="e.g. Fresh Vegetables"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  placeholder="auto-generated"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description…"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Workflow Type */}
            <div className="space-y-1.5">
              <Label>Workflow Type</Label>
              <Select
                value={form.workflowType}
                onValueChange={v => setForm(f => ({ ...f, workflowType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_OPTIONS.map(wf => (
                    <SelectItem key={wf.value} value={wf.value}>{wf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parent Category */}
            <div className="space-y-1.5">
              <Label>Parent Category</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={form.parentId}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
              >
                <option value="">— None (top-level) —</option>
                {categories.filter(c => !c.parentId && c.id !== editTarget?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center text-sm transition-all ${
                      form.icon === emoji
                        ? "border-primary scale-110 bg-primary/10"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setForm(f => ({ ...f, icon: emoji }))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`h-7 w-7 rounded-full border-2 transition-all ${
                        form.color === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm(f => ({ ...f, color }))}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Image URL + Sort Order */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Image URL</Label>
                <Input
                  placeholder="https://…"
                  value={form.image}
                  onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
