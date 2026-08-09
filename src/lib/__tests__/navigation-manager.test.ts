import { describe, it, expect } from "vitest"
import { validateNavSections, defaultNavigationConfig } from "@/lib/laundry-nav-config"
import { SCREEN_MODULES, allScreenKeys } from "@/lib/laundry-rbac-registry"

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface NavItem {
  screenKey: string
  displayName: string
  icon: string
  order: number
  active: boolean
  hidden: boolean
  comingSoon: boolean
  pinned: boolean
}

interface NavSection {
  name: string
  icon: string
  description?: string
  order: number
  expanded: boolean
  collapsible: boolean
  active: boolean
  items: NavItem[]
}

function makeSection(name: string, items: { screenKey: string; displayName: string }[]): NavSection {
  return {
    name,
    icon: "Circle",
    description: "",
    order: 0,
    expanded: true,
    collapsible: true,
    active: true,
    items: items.map((it, i) => ({
      screenKey: it.screenKey,
      displayName: it.displayName,
      icon: "Circle",
      order: i,
      active: true,
      hidden: false,
      comingSoon: false,
      pinned: false,
    })),
  }
}

function item(screenKey: string, displayName: string) {
  return { screenKey, displayName }
}

// ─── Validation Tests ────────────────────────────────────────────────────────

describe("validateNavSections", () => {
  it("passes for valid sections", () => {
    const sections = [
      makeSection("Main", [item("laundry.dashboard", "Dashboard"), item("laundry.orders", "Orders")]),
      makeSection("Store", [item("store_ops.store_audit", "Store Audit")]),
    ]
    expect(validateNavSections(sections)).toBeNull()
  })

  it("rejects empty section name", () => {
    const sections = [makeSection("", [item("laundry.dashboard", "Dashboard")])]
    expect(validateNavSections(sections)).toMatch(/empty name/)
  })

  it("rejects blank section name", () => {
    const sections = [makeSection("   ", [item("laundry.dashboard", "Dashboard")])]
    expect(validateNavSections(sections)).toMatch(/empty name/)
  })

  it("rejects empty screenKey", () => {
    const sections = [makeSection("Main", [item("", "No Key")])]
    expect(validateNavSections(sections)).toMatch(/without a screen key/)
  })

  it("rejects duplicate screenKey within the same section", () => {
    const sections = [
      makeSection("Main", [
        item("laundry.dashboard", "Dashboard"),
        item("laundry.dashboard", "Dashboard Dupe"),
      ]),
    ]
    const result = validateNavSections(sections)
    expect(result).toMatch(/appears twice/)
    expect(result).toMatch(/Main/)
  })

  it("rejects duplicate screenKey across different sections", () => {
    const sections = [
      makeSection("First", [item("laundry.dashboard", "Dashboard")]),
      makeSection("Second", [item("laundry.dashboard", "Dashboard Again")]),
    ]
    const result = validateNavSections(sections)
    expect(result).toMatch(/is in both/)
    expect(result).toMatch(/First/)
    expect(result).toMatch(/Second/)
  })

  it("passes for empty items", () => {
    const sections = [makeSection("Empty", [])]
    expect(validateNavSections(sections)).toBeNull()
  })

  it("passes for lots of unique items", () => {
    const keys = allScreenKeys().slice(0, 20)
    const sections = [
      makeSection("A", keys.slice(0, 10).map((k) => item(k, k))),
      makeSection("B", keys.slice(10, 20).map((k) => item(k, k))),
    ]
    expect(validateNavSections(sections)).toBeNull()
  })

  it("rejects when the same key appears in 3+ sections", () => {
    const sections = [
      makeSection("A", [item("laundry.dashboard", "Dashboard")]),
      makeSection("B", [item("laundry.dashboard", "Dashboard")]),
      makeSection("C", [item("laundry.dashboard", "Dashboard")]),
    ]
    const result = validateNavSections(sections)
    expect(result).toMatch(/is in both/)
  })
})

// ─── Default Config Integrity ────────────────────────────────────────────────

describe("defaultNavigationConfig integrity", () => {
  const defaults = defaultNavigationConfig()

  it("all section names are non-empty", () => {
    for (const sec of defaults) {
      expect(sec.name?.trim()).toBeTruthy()
    }
  })

  it("all screenKeys are non-empty", () => {
    for (const sec of defaults) {
      for (const item of sec.items) {
        expect(item.screenKey?.trim()).toBeTruthy()
      }
    }
  })

  it("all screenKeys exist in the screen registry (no standalone/alias keys)", () => {
    const all = new Set(allScreenKeys())
    for (const sec of defaults) {
      for (const item of sec.items) {
        if (!all.has(item.screenKey)) {
          throw new Error(`Unknown screenKey "${item.screenKey}" in section "${sec.name}"`)
        }
      }
    }
  })

  it("no duplicate screenKeys across default config", () => {
    const result = validateNavSections(defaults)
    expect(result).toBeNull()
  })

  it("icons are all known strings", () => {
    const knownIcons = new Set([
      "LayoutDashboard", "ShoppingBag", "Users", "Store", "Factory", "BarChart3",
      "Settings", "Plus", "ClipboardCheck", "CreditCard", "Truck", "IndianRupee",
      "Wallet", "UsersRound", "Shirt", "Droplets", "Wind", "Layers", "ShieldCheck",
      "Barcode", "Repeat", "Target", "CheckSquare", "ClipboardList", "PieChart",
      "SlidersHorizontal", "Gauge", "PackageCheck", "CheckCheck", "Sparkles",
      "Package", "Shield", "Megaphone", "Ticket", "BadgePercent", "Gift", "Crown",
      "UserPlus", "Coins", "ShoppingCart", "WashingMachine", "Calculator", "Tags",
      "ChevronDown", "Bike", "Smartphone", "Search", "Menu", "Circle", "Folder",
      "Calendar", "ListChecks", "Usb",
    ])
    for (const sec of defaults) {
      expect(knownIcons.has(sec.icon)).toBe(true)
      for (const item of sec.items) {
        if (item.icon) expect(knownIcons.has(item.icon)).toBe(true)
      }
    }
  })
})

// ─── SCREEN_MODULES Integrity ────────────────────────────────────────────────

describe("SCREEN_MODULES integrity", () => {
  it("all screen keys are unique across modules", () => {
    const all = allScreenKeys()
    expect(new Set(all).size).toBe(all.length)
  })

  it("every module has a non-empty label and key", () => {
    for (const m of SCREEN_MODULES) {
      expect(m.key?.trim()).toBeTruthy()
      expect(m.label?.trim()).toBeTruthy()
      for (const s of m.screens) {
        expect(s.key?.trim()).toBeTruthy()
        expect(s.label?.trim()).toBeTruthy()
        expect(`${m.key}.${s.key}`).toBeTruthy()
      }
    }
  })

  it("all generated screenKeys match the pattern module.screen", () => {
    for (const m of SCREEN_MODULES) {
      for (const s of m.screens) {
        expect(`${m.key}.${s.key}`).toMatch(/^[a-z_]+\.[a-z_]+$/)
      }
    }
  })
})

// ─── Screen Management Operations ────────────────────────────────────────────

describe("screen management operations", () => {
  function makeEmptySections(): NavSection[] {
    return [makeSection("Operations Testing", [])]
  }

  it("add screen", () => {
    const sections = makeEmptySections()
    const screenKey = "store_ops.store_audit"
    sections[0].items.push({
      screenKey, displayName: "Store Audit", icon: "Circle",
      order: 0, active: true, hidden: false, comingSoon: false, pinned: false,
    })
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].screenKey).toBe(screenKey)
  })

  it("remove screen", () => {
    const sections = [
      makeSection("Main", [item("laundry.dashboard", "Dashboard"), item("laundry.orders", "Orders")]),
    ]
    sections[0].items = sections[0].items.filter((_, i) => i !== 0)
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].screenKey).toBe("laundry.orders")
  })

  it("prevent duplicate screen in same section", () => {
    const sections = [
      makeSection("Main", [item("laundry.dashboard", "Dashboard")]),
    ]
    sections[0].items.push({ screenKey: "laundry.dashboard", displayName: "Dashboard", icon: "Circle", order: 1, active: true, hidden: false, comingSoon: false, pinned: false })
    expect(validateNavSections(sections)).not.toBeNull()
  })
})

// ─── Order Integrity ─────────────────────────────────────────────────────────

describe("order integrity", () => {
  it("section order is sequential", () => {
    const sections = [makeSection("A", []), makeSection("B", []), makeSection("C", [])]
    const ordered = sections.map((s, i) => ({ ...s, order: i }))
    for (let i = 0; i < ordered.length; i++) {
      expect(ordered[i].order).toBe(i)
    }
  })

  it("item order is sequential after reorder", () => {
    const items = [
      { screenKey: "a", displayName: "A", order: 2 },
      { screenKey: "b", displayName: "B", order: 0 },
      { screenKey: "c", displayName: "C", order: 1 },
    ]
    const reordered = items.sort((a, b) => a.order - b.order).map((it, i) => ({ ...it, order: i }))
    expect(reordered[0].screenKey).toBe("b")
    expect(reordered[1].screenKey).toBe("c")
    expect(reordered[2].screenKey).toBe("a")
    expect(reordered[0].order).toBe(0)
    expect(reordered[1].order).toBe(1)
    expect(reordered[2].order).toBe(2)
  })

  it("items maintain order after cross-section move", () => {
    const sections = [
      makeSection("A", [item("x", "X"), item("y", "Y")]),
      makeSection("B", [item("z", "Z")]),
    ]

    // Move "y" from A to B
    const movedItem = sections[0].items.splice(1, 1)[0]
    sections[1].items.push(movedItem)
    sections[0].items = sections[0].items.map((it, i) => ({ ...it, order: i }))
    sections[1].items = sections[1].items.map((it, i) => ({ ...it, order: i }))

    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].screenKey).toBe("x")
    expect(sections[1].items).toHaveLength(2)
    expect(sections[1].items[1].screenKey).toBe("y")
    expect(sections[0].items[0].order).toBe(0)
    expect(sections[1].items[0].order).toBe(0)
    expect(sections[1].items[1].order).toBe(1)
  })
})
