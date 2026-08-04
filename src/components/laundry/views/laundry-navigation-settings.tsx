"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Save, RotateCcw, GripVertical, Trash2, EyeOff, ChevronDown, ChevronRight, Settings2, ArrowUp, ArrowDown, Search, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { useAdminStore } from "@/stores/admin-store"
import { validateNavSections } from "@/lib/laundry-nav-config"
import { clearRuntimeAuthCache } from "@/components/auth/runtime-auth-provider"

const SECTION_PREFIX = "sec_"
const ITEM_PREFIX = "itm_"

function sid(id: string | undefined, fallback: string): string {
  return `${SECTION_PREFIX}${id ?? fallback}`
}
function iid(id: string | undefined, fallback: string): string {
  return `${ITEM_PREFIX}${id ?? fallback}`
}
function stripPrefix(prefixed: string): string {
  return prefixed.replace(/^(sec_|itm_)/, "")
}

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

function SortableSection({
  section, sectionIndex, onToggleExpand, onEdit, onDelete, onMoveUp, onMoveDown, children,
}: {
  section: NavSection
  sectionIndex: number
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sid(section.id, section.name) })
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
      {children}
    </div>
  )
}

function SortableItem({ item, onRemove, onMoveUp, onMoveDown }: {
  item: NavItem
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: iid(item.id, item.screenKey) })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm group">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-3 w-3" />
      </button>
      <span className={`flex-1 ${item.comingSoon ? "text-muted-foreground line-through" : ""}`}>
        {item.displayName}
      </span>
      <span className="text-[9px] text-muted-foreground hidden group-hover:inline">{item.screenKey}</span>
      {item.comingSoon && <Badge variant="outline" className="text-[9px] h-4">Soon</Badge>}
      {item.badge && <Badge className="text-[9px] h-4">{item.badge}</Badge>}
      {item.hidden && <EyeOff className="h-3 w-3 text-muted-foreground" />}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveUp} title="Move up"><ArrowUp className="h-2.5 w-2.5" /></Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveDown} title="Move down"><ArrowDown className="h-2.5 w-2.5" /></Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onRemove} title="Remove"><Trash2 className="h-2.5 w-2.5" /></Button>
      </div>
    </div>
  )
}

function SectionEditDialog({ section, allScreens, onSave, onClose }: {
  section: NavSection
  allScreens: { screenKey: string; displayName: string }[]
  onSave: (s: NavSection) => void
  onClose: () => void
}) {
  const [name, setName] = useState(section.name)
  const [description, setDescription] = useState(section.description ?? "")
  const [expanded, setExpanded] = useState(section.expanded)
  const [collapsible, setCollapsible] = useState(section.collapsible)
  const [active, setActive] = useState(section.active)
  const [items, setItems] = useState<NavItem[]>(section.items)
  const [search, setSearch] = useState("")

  const assignedKeys = useMemo(() => new Set(items.map((i) => i.screenKey)), [items])

  const addableScreens = useMemo(() => {
    return allScreens.filter((s) => {
      if (assignedKeys.has(s.screenKey)) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return s.displayName.toLowerCase().includes(q) || s.screenKey.toLowerCase().includes(q)
    })
  }, [allScreens, assignedKeys, search])

  const addItem = (screenKey: string, displayName: string) => {
    if (assignedKeys.has(screenKey)) {
      toast.error(`"${displayName}" is already in this section`)
      return
    }
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

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return
    setItems((prev) => {
      const result = [...prev]
      const [moved] = result.splice(index, 1)
      result.splice(newIndex, 0, moved)
      return result.map((item, i) => ({ ...item, order: i }))
    })
  }

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <span className="truncate">{item.displayName}</span>
                  <span className="text-[9px] text-muted-foreground ml-1">{item.screenKey}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveItem(i, "up")} disabled={i === 0} title="Move up">
                  <ArrowUp className="h-2.5 w-2.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveItem(i, "down")} disabled={i === items.length - 1} title="Move down">
                  <ArrowDown className="h-2.5 w-2.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeItem(i)} title="Remove">
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No screens in this section.</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Add Screens</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search screens..."
              className="pl-8"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
            {addableScreens.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {search ? "No screens match your search." : "All available screens are already assigned."}
              </p>
            ) : addableScreens.map((screen) => (
              <div
                key={screen.screenKey}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => addItem(screen.screenKey, screen.displayName)}
              >
                <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1">{screen.displayName}</span>
                <span className="text-[9px] text-muted-foreground">{screen.screenKey}</span>
              </div>
            ))}
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
  const bumpNavRevision = useAdminStore((s) => s.bumpNavRevision)

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
      .then((r) => { if (!r.ok) throw new Error("Failed to load available screens"); return r.json() })
      .then((json) => { if (Array.isArray(json.data)) setAvailableScreens(json.data) })
      .catch(() => toast.error("Failed to load available screens"))
  }, [businessId])

  const saveNavigation = async () => {
    const error = validateNavSections(sections)
    if (error) {
      toast.error(error)
      return
    }
    setSaving(true)
    try {
      const normalized = sections.map((s, si) => ({
        ...s,
        order: si,
        items: s.items.map((item, ii) => ({ ...item, order: ii })),
      }))
      const res = await fetch(`/api/laundry/navigation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, sections: normalized }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Save failed (${res.status})`)
      }
      const json = await res.json()
      if (json.data?.sections) setSections(json.data.sections.map((s: any) => ({ ...s, items: s.items ?? [] })))
      bumpNavRevision()
      if (businessId) clearRuntimeAuthCache(businessId)
      toast.success("Navigation saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save navigation") }
    finally { setSaving(false) }
  }

  const restoreDefault = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/navigation?businessId=${businessId}&action=restore-default`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to restore defaults")
      const json = await res.json()
      if (json.data?.sections) setSections(json.data.sections.map((s: any) => ({ ...s, items: s.items ?? [] })))
      bumpNavRevision()
      if (businessId) clearRuntimeAuthCache(businessId)
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Section drag
    if (activeId.startsWith(SECTION_PREFIX)) {
      const oldIndex = sections.findIndex((s) => sid(s.id, s.name) === activeId)
      const newIndex = sections.findIndex((s) => sid(s.id, s.name) === overId)
      if (oldIndex === -1 || newIndex === -1) return
      setSections((prev) => arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i })))
      return
    }

    // Item drag
    if (activeId.startsWith(ITEM_PREFIX)) {
      const activeSectionIdx = sections.findIndex((s) =>
        s.items.some((item) => iid(item.id, item.screenKey) === activeId)
      )
      if (activeSectionIdx === -1) return

      const activeItemIdx = sections[activeSectionIdx].items.findIndex(
        (item) => iid(item.id, item.screenKey) === activeId
      )
      if (activeItemIdx === -1) return

      // Determine target section
      let overSectionIdx: number
      let overItemIdx: number

      if (overId.startsWith(ITEM_PREFIX)) {
        overSectionIdx = sections.findIndex((s) =>
          s.items.some((item) => iid(item.id, item.screenKey) === overId)
        )
        overItemIdx = overSectionIdx !== -1
          ? sections[overSectionIdx].items.findIndex((item) => iid(item.id, item.screenKey) === overId)
          : -1
      } else if (overId.startsWith(SECTION_PREFIX)) {
        overSectionIdx = sections.findIndex((s) => sid(s.id, s.name) === overId)
        overItemIdx = overSectionIdx !== -1 ? sections[overSectionIdx].items.length : -1
      } else {
        return
      }

      if (overSectionIdx === -1 || overItemIdx === -1) return

      setSections((prev) => {
        const result = prev.map((s) => ({ ...s, items: [...s.items] }))
        const [moved] = result[activeSectionIdx].items.splice(activeItemIdx, 1)

        if (activeSectionIdx === overSectionIdx) {
          // Same section reorder
          const adjustedOver = activeItemIdx < overItemIdx ? overItemIdx - 1 : overItemIdx
          result[activeSectionIdx].items.splice(Math.min(adjustedOver, result[activeSectionIdx].items.length), 0, moved)
        } else {
          // Cross-section move
          result[overSectionIdx].items.splice(overItemIdx, 0, moved)
        }

        return result.map((s) => ({
          ...s,
          items: s.items.map((item, i) => ({ ...item, order: i })),
        }))
      })
    }
  }

  const moveItemWithinSection = (sectionIndex: number, itemIndex: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1
    if (newIndex < 0 || newIndex >= sections[sectionIndex].items.length) return
    setSections((prev) => {
      const result = [...prev]
      const items = [...result[sectionIndex].items]
      const [moved] = items.splice(itemIndex, 1)
      items.splice(newIndex, 0, moved)
      result[sectionIndex] = { ...result[sectionIndex], items: items.map((item, i) => ({ ...item, order: i })) }
      return result
    })
  }

  const removeItemFromSection = (sectionIndex: number, itemIndex: number) => {
    setSections((prev) => {
      const result = [...prev]
      const items = result[sectionIndex].items.filter((_, i) => i !== itemIndex)
      result[sectionIndex] = { ...result[sectionIndex], items: items.map((item, i) => ({ ...item, order: i })) }
      return result
    })
  }

  const addScreenToSection = (screenKey: string, displayName: string, sectionIndex: number) => {
    setSections((prev) => {
      const result = [...prev]
      const items = [...result[sectionIndex].items]
      if (items.some((i) => i.screenKey === screenKey)) {
        toast.error(`"${displayName}" is already in "${result[sectionIndex].name}"`)
        return prev
      }
      items.push({
        screenKey,
        displayName,
        icon: "Circle",
        order: items.length,
        active: true,
        hidden: false,
        comingSoon: false,
        pinned: false,
      })
      result[sectionIndex] = { ...result[sectionIndex], items }
      return result
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const sectionIds = sections.map((s) => sid(s.id, s.name))

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
          <CardDescription>Drag sections to reorder, drag items within or between sections.</CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section, i) => (
                  <SortableSection
                    key={sid(section.id, section.name)}
                    section={section}
                    sectionIndex={i}
                    onToggleExpand={() => toggleExpand(i)}
                    onEdit={() => setEditingSection({ ...section })}
                    onDelete={() => deleteSection(i)}
                    onMoveUp={() => moveSection(i, "up")}
                    onMoveDown={() => moveSection(i, "down")}
                  >
                    {section.expanded && (
                      <SortableContext items={section.items.map((item) => iid(item.id, item.screenKey))} strategy={verticalListSortingStrategy}>
                        <div className="border-t px-3 py-2 space-y-1">
                          {section.items.length > 0 ? (
                            section.items.map((item, ii) => (
                              <SortableItem
                                key={iid(item.id, item.screenKey)}
                                item={item}
                                onRemove={() => removeItemFromSection(i, ii)}
                                onMoveUp={() => moveItemWithinSection(i, ii, "up")}
                                onMoveDown={() => moveItemWithinSection(i, ii, "down")}
                              />
                            ))
                          ) : (
                            <div className="py-4 text-center text-xs text-muted-foreground">
                              No screens in this section. Drag screens here or edit to add.
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    )}
                  </SortableSection>
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
          <CardDescription>Screens not yet placed in any section. Click to assign.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignedScreenList
            availableScreens={availableScreens}
            sections={sections}
            onAdd={addScreenToSection}
          />
        </CardContent>
      </Card>

      {editingSection && (
        <Dialog open={!!editingSection} onOpenChange={(open) => { if (!open) setEditingSection(null) }}>
          <SectionEditDialog
            section={editingSection}
            allScreens={availableScreens}
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

function AssignedScreenList({ availableScreens, sections, onAdd }: {
  availableScreens: AvailableScreen[]
  sections: NavSection[]
  onAdd: (screenKey: string, displayName: string, sectionIndex: number) => void
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const assignedKeys = useMemo(() => new Set(sections.flatMap((s) => s.items.map((i) => i.screenKey))), [sections])
  const unassigned = useMemo(() => availableScreens.filter((s) => !assignedKeys.has(s.screenKey)), [availableScreens, assignedKeys])

  if (unassigned.length === 0) {
    return <p className="text-sm text-muted-foreground">All screens are assigned to a section.</p>
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {unassigned.map((screen) => (
          <div key={screen.screenKey} className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs">
            <span>{screen.displayName}</span>
          </div>
        ))}
        <p className="w-full text-xs text-muted-foreground">Create a section first to assign screens.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {unassigned.map((screen) => (
        <div key={screen.screenKey} className="group relative">
          <div className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs">
            <span>{screen.displayName}</span>
            <span className="text-[9px] text-muted-foreground">{screen.screenKey}</span>
            <Select
              value={addingTo === screen.screenKey ? "open" : ""}
              onValueChange={(val) => {
                if (val && val !== "open") {
                  onAdd(screen.screenKey, screen.displayName, parseInt(val))
                }
                setAddingTo(null)
              }}
              onOpenChange={(open) => {
                if (open) setAddingTo(screen.screenKey)
                else setAddingTo(null)
              }}
            >
              <SelectTrigger className="h-5 w-5 rounded-full p-0 border-0 bg-transparent hover:bg-muted cursor-pointer">
                <Plus className="h-3 w-3" />
              </SelectTrigger>
              <SelectContent align="end" className="max-h-48">
                {sections.map((sec, si) => (
                  <SelectItem key={sid(sec.id, sec.name)} value={String(si)}>
                    → {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  )
}
