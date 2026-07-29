"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Save, RotateCcw, GripVertical, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, Settings2, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

interface NavSection {
  id?: string
  name: string
  icon: string
  description?: string
  order: number
  expanded: boolean
  collapsible: boolean
  active: boolean
  items: NavItem[]
}

interface NavItem {
  id?: string
  screenKey: string
  displayName: string
  icon: string
  order: number
  active: boolean
  hidden: boolean
  badge?: string
  comingSoon: boolean
  pinned: boolean
  description?: string
}

function SortableSection({ section, onToggleExpand, onEdit, onDelete, onMoveUp, onMoveDown }: {
  section: NavSection
  sectionIndex: number
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id ?? section.name })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {section.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{section.name}</span>
            {!section.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
            <Badge variant="secondary" className="text-[10px]">{section.items.length}</Badge>
          </div>
          {section.description && <p className="text-xs text-muted-foreground truncate">{section.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit section"><Settings2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete section"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {section.expanded && section.items.length > 0 && (
        <div className="border-t px-3 py-2 space-y-1">
          {section.items.map((item, ii) => (
            <SortableItem key={item.id ?? item.screenKey} item={item} itemIndex={ii} sectionIndex={0} />
          ))}
        </div>
      )}
      {section.expanded && section.items.length === 0 && (
        <div className="border-t px-3 py-4 text-center text-xs text-muted-foreground">
          No screens in this section. Drag screens here or edit to add.
        </div>
      )}
    </div>
  )
}

function SortableItem({ item, itemIndex, sectionIndex }: { item: NavItem; itemIndex: number; sectionIndex: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id ?? item.screenKey })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-3 w-3" />
      </button>
      <span className={`flex-1 ${item.comingSoon ? "text-muted-foreground line-through" : ""}`}>
        {item.displayName}
      </span>
      {item.comingSoon && <Badge variant="outline" className="text-[9px] h-4">Soon</Badge>}
      {item.badge && <Badge className="text-[9px] h-4">{item.badge}</Badge>}
      {item.hidden && <EyeOff className="h-3 w-3 text-muted-foreground" />}
    </div>
  )
}

function SectionEditDialog({ section, onSave, onClose }: {
  section: NavSection
  availableScreens: { screenKey: string; displayName: string }[]
  onSave: (s: NavSection) => void
  onClose: () => void
}) {
  const [name, setName] = useState(section.name)
  const [description, setDescription] = useState(section.description ?? "")
  const [expanded, setExpanded] = useState(section.expanded)
  const [collapsible, setCollapsible] = useState(section.collapsible)
  const [active, setActive] = useState(section.active)
  const [items, setItems] = useState<NavItem[]>(section.items)

  const addItem = (screenKey: string, displayName: string) => {
    setItems((prev) => [...prev, {
      screenKey,
      displayName,
      icon: "Circle",
      order: prev.length,
      active: true,
      hidden: false,
      comingSoon: false,
      pinned: false,
    }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit Section</DialogTitle>
        <DialogDescription>Configure section name, visibility, and screens.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Section Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Store Operations" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={expanded} onCheckedChange={setExpanded} />
            <Label className="text-sm">Expand by default</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={collapsible} onCheckedChange={setCollapsible} />
            <Label className="text-sm">Collapsible</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-sm">Active</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Screens in this section ({items.length})</Label>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-sm">
                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1">{item.displayName}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No screens. Add from below.</p>}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ ...section, name, description: description || undefined, expanded, collapsible, active, items })}>Save</Button>
      </DialogFooter>
    </DialogContent>
  )
}

interface NavigationManagerProps {
  businessId: string
}

interface AvailableScreen {
  screenKey: string
  displayName: string
}

export function LaundryNavigationManager({ businessId }: NavigationManagerProps) {
  const [sections, setSections] = useState<NavSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingSection, setEditingSection] = useState<NavSection | null>(null)
  const [availableScreens, setAvailableScreens] = useState<AvailableScreen[]>([])
  const [addScreenDialog, setAddScreenDialog] = useState<{ sectionIndex: number } | null>(null)
  const [selectedScreenKey, setSelectedScreenKey] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchNav = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/navigation?businessId=${businessId}`)
      const json = await res.json()
      if (json.data?.sections) setSections(json.data.sections.map((s: any) => ({ ...s, items: s.items ?? [] })))
    } catch { toast.error("Failed to load navigation") }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchNav() }, [fetchNav])

  useEffect(() => {
    fetch(`/api/laundry/navigation?businessId=${businessId}&action=available-screens`)
      .then((r) => r.json())
      .then((json) => { if (json.data) setAvailableScreens(json.data) })
      .catch(() => {})
  }, [businessId])

  const saveNavigation = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/navigation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, sections }),
      })
      const json = await res.json()
      if (json.data?.sections) setSections(json.data.sections.map((s: any) => ({ ...s, items: s.items ?? [] })))
      toast.success("Navigation saved")
    } catch { toast.error("Failed to save navigation") }
    finally { setSaving(false) }
  }

  const restoreDefault = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/navigation?businessId=${businessId}&action=restore-default`, { method: "POST" })
      const json = await res.json()
      if (json.data?.sections) setSections(json.data.sections.map((s: any) => ({ ...s, items: s.items ?? [] })))
      toast.success("Default navigation restored")
    } catch { toast.error("Failed to restore defaults") }
    finally { setLoading(false) }
  }

  const addSection = () => {
    setSections((prev) => [...prev, {
      name: "New Section",
      icon: "Folder",
      description: "",
      order: prev.length,
      expanded: true,
      collapsible: true,
      active: true,
      items: [],
    }])
  }

  const deleteSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleExpand = (index: number) => {
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, expanded: !s.expanded } : s))
  }

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return
    setSections((prev) => {
      const result = [...prev]
      const [moved] = result.splice(index, 1)
      result.splice(newIndex, 0, moved)
      return result.map((s, i) => ({ ...s, order: i }))
    })
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => (s.id ?? s.name) === active.id)
    const newIndex = sections.findIndex((s) => (s.id ?? s.name) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setSections((prev) => arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i })))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Navigation Manager</h1>
          <p className="text-sm text-muted-foreground">
            Customise the sidebar menu. RBAC permissions continue unaffected — only presentation changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={restoreDefault}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore Default
          </Button>
          <Button size="sm" onClick={saveNavigation} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sidebar Sections</CardTitle>
          <CardDescription>Drag sections to reorder. Edit each section to add or remove screens.</CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={sections.map((s) => s.id ?? s.name)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section, i) => (
                  <SortableSection
                    key={section.id ?? section.name}
                    section={section}
                    sectionIndex={i}
                    onToggleExpand={() => toggleExpand(i)}
                    onEdit={() => setEditingSection({ ...section })}
                    onDelete={() => deleteSection(i)}
                    onMoveUp={() => moveSection(i, "up")}
                    onMoveDown={() => moveSection(i, "down")}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button variant="outline" className="mt-3 w-full border-dashed" onClick={addSection}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Section
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unassigned Screens</CardTitle>
          <CardDescription>Screens not yet placed in any section.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignedScreenList
            availableScreens={availableScreens}
            sections={sections}
            businessId={businessId}
            onScreenAdded={() => fetchNav()}
          />
        </CardContent>
      </Card>

      {editingSection && (
        <Dialog open={!!editingSection} onOpenChange={(open) => { if (!open) setEditingSection(null) }}>
          <SectionEditDialog
            section={editingSection}
            availableScreens={availableScreens}
            onSave={(updated) => {
              setSections((prev) => prev.map((s, i) =>
                (s.id ?? s.name) === (editingSection.id ?? editingSection.name) ? { ...updated, id: editingSection.id } : s
              ))
              setEditingSection(null)
            }}
            onClose={() => setEditingSection(null)}
          />
        </Dialog>
      )}
    </div>
  )
}

function AssignedScreenList({ availableScreens, sections, businessId, onScreenAdded }: {
  availableScreens: AvailableScreen[]
  sections: NavSection[]
  businessId: string
  onScreenAdded: () => void
}) {
  const assignedKeys = new Set(sections.flatMap((s) => s.items.map((i) => i.screenKey)))
  const unassigned = availableScreens.filter((s) => !assignedKeys.has(s.screenKey))

  if (unassigned.length === 0) {
    return <p className="text-sm text-muted-foreground">All screens are assigned to a section.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {unassigned.map((screen) => (
        <div key={screen.screenKey} className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs">
          <span>{screen.displayName}</span>
          <span className="text-[9px] text-muted-foreground">{screen.screenKey}</span>
        </div>
      ))}
    </div>
  )
}
