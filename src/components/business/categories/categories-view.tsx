"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
  Tag, Plus, Search, Loader2, ImageIcon, Edit2, Trash2, FolderOpen, UploadCloud, X,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { showSuccess, showError } from "@/lib/toast-utils"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  icon: string | null
  color: string | null
  isActive: boolean
  sortOrder: number
  workflowType: string | null
}

const WORKFLOW_LABELS: Record<string, string> = {
  ECOMMERCE:            "Ecommerce",
  PICKUP_DELIVERY:      "Pickup & Delivery",
  APPOINTMENT:          "Appointment",
  SUBSCRIPTION:         "Subscription",
  POST_SERVICE_BILLING: "Post Service Billing",
}

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

const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

const emptyForm = {
  name: "", slug: "", description: "", image: "", icon: "📦",
  color: "#10B981", sortOrder: "0", isActive: true, workflowType: "ECOMMERCE",
}

export function CategoriesView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""
  const queryClient = useQueryClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [enabledWorkflows, setEnabledWorkflows] = useState<string[]>(["ECOMMERCE"])
  const [planTier, setPlanTier] = useState<string>("STANDARD")

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const authHeaders = useMemo(() => ({
    ...getAuthHeaders(),
    "x-business-id": businessId,
  }), [businessId])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [catRes, wfRes] = await Promise.all([
        fetch(`/api/core/businesses/${businessId}/categories`, { headers: authHeaders }),
        fetch(`/api/core/businesses/${businessId}/workflows`,  { headers: authHeaders }),
      ])
      const catJson = await catRes.json()
      if (catJson.success) setCategories(catJson.data ?? [])
      const wfJson = await wfRes.json()
      if (wfJson.success) {
        setEnabledWorkflows(wfJson.data.enabledWorkflows ?? ["ECOMMERCE"])
        setPlanTier(wfJson.data.planTier ?? "STANDARD")
      }
    } finally {
      setLoading(false)
    }
  }, [businessId, authHeaders])

  const isMultiWorkflow = useMemo(() => enabledWorkflows.length > 1, [enabledWorkflows])

  useEffect(() => { load() }, [load])

  const resetImageState = () => {
    setImageFile(null)
    setImagePreview("")
    setIsDragging(false)
  }

  const openCreate = () => {
    setForm({ ...emptyForm, workflowType: enabledWorkflows[0] ?? "ECOMMERCE" })
    setEditTarget(null)
    resetImageState()
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
      workflowType: cat.workflowType ?? "ECOMMERCE",
    })
    setEditTarget(cat)
    // Show existing image in preview (no new file chosen yet)
    setImageFile(null)
    setImagePreview(cat.image ?? "")
    setIsDragging(false)
    setCreateOpen(true)
  }

  const applyImageFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError("Only PNG, JPG, and WEBP images are accepted")
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      showError("Image must be under 2 MB")
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) applyImageFile(file)
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) applyImageFile(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview("")
    setForm(f => ({ ...f, image: "" }))
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
      // If a new file was chosen, upload it first
      let finalImageUrl = imagePreview.startsWith("data:") ? "" : imagePreview
      if (imageFile) {
        setUploadingImage(true)
        const fd = new FormData()
        fd.append("file", imageFile)
        fd.append("businessId", businessId)
        fd.append("folder", "categories")
        const upRes = await fetch("/api/core/upload", { method: "POST", headers: getAuthHeaders(), body: fd })
        const upJson = await upRes.json()
        setUploadingImage(false)
        if (!upRes.ok || !upJson.success) {
          showError(upJson.error || "Image upload failed")
          setSaving(false)
          return
        }
        finalImageUrl = upJson.url
      }

      const method = editTarget ? "PATCH" : "POST"
      const payload = {
        ...(editTarget ? { id: editTarget.id } : {}),
        name: form.name.trim(),
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        image: finalImageUrl || null,
        icon: form.icon || null,
        color: form.color || null,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
        workflowType: form.workflowType || enabledWorkflows[0] || "ECOMMERCE",
      }
      const res = await fetch(`/api/core/businesses/${businessId}/categories`, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showSuccess(editTarget ? "Category updated" : "Category created")
        setCreateOpen(false)
        resetImageState()
        load()
        queryClient.invalidateQueries({ queryKey: ["categories", businessId] })
      } else {
        showError(json.error || json.message || "Failed to save category")
      }
    } catch {
      showError("Failed to save category")
    } finally {
      setSaving(false)
      setUploadingImage(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products will be uncategorized.")) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/categories?id=${id}`, {
        method: "DELETE",
        headers: authHeaders,
      })
      const json = await res.json()
      if (res.ok && json.success) {
        showSuccess("Category deleted")
        load()
        queryClient.invalidateQueries({ queryKey: ["categories", businessId] })
      } else {
        showError(json.error || "Failed to delete category")
      }
    } finally {
      setDeleting(null)
    }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Single source of truth for all product categories"
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

      {/* Category list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No categories match your search" : "No categories yet"}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Create First Category
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "category" : "categories"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 group">
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
                      {cat.workflowType && isMultiWorkflow && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          {WORKFLOW_LABELS[cat.workflowType] ?? cat.workflowType.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {cat.color && (
                        <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) { setEditTarget(null); resetImageState() } }}>
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

            {/* Workflow — read-only badge or filtered selector */}
            {isMultiWorkflow ? (
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
                    {enabledWorkflows.map(wf => (
                      <SelectItem key={wf} value={wf}>{WORKFLOW_LABELS[wf] ?? wf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Only workflows enabled for this business are shown.
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-muted/40 border px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Workflow</p>
                  <p className="text-[11px] text-muted-foreground">
                    {WORKFLOW_LABELS[enabledWorkflows[0]] ?? enabledWorkflows[0]} · auto-assigned by {planTier} plan
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {WORKFLOW_LABELS[enabledWorkflows[0]] ?? enabledWorkflows[0]}
                </Badge>
              </div>
            )}

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

            {/* Category Image Upload */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Category Image
              </Label>

              {imagePreview ? (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border bg-muted/30 h-36 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Category preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors select-none ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/20"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <UploadCloud className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Upload Image</span>
                    {" "}or drag &amp; drop
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WEBP · Max 2 MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                className="max-w-[120px]"
              />
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
              {(saving || uploadingImage) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {uploadingImage ? "Uploading…" : saving ? "Saving…" : editTarget ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
