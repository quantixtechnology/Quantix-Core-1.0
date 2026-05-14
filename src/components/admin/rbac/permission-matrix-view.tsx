"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/admin-fetch";
import { useAuthStore } from "@/stores/auth-store";
import {
  PERMISSION_MODULES, PERMISSION_ACTIONS, MODULE_GROUPS,
  STANDARD_ACTION_IDS, EXTENDED_ACTION_IDS,
  allPermissionKeys, permKey,
  type ActionId, type ModuleDef, type SubmoduleDef, type ModuleGroup,
} from "@/lib/rbac/permission-definitions";
import { ROLE_META, type RoleId } from "@/lib/rbac/role-templates";
import {
  ChevronDown, ChevronRight, Search, Shield, Save, Copy,
  RotateCcw, CheckSquare, Square, Minus, SlidersHorizontal,
  AlertCircle, CheckCircle2, Loader2, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleInfo {
  id: RoleId;
  label: string;
  group: string;
  color: string;
  description: string;
  permissionCount: number;
  isCustomized: boolean;
  lastUpdated: string | null;
}

type PermState = Record<string, boolean>;

// ─── Indeterminate Checkbox ───────────────────────────────────────────────────

function IndeterminateCheckbox({
  checked, indeterminate, onChange, disabled = false,
}: {
  checked: boolean; indeterminate: boolean; onChange: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getModuleState(mod: ModuleDef, actions: ActionId[], state: PermState): 'all' | 'some' | 'none' {
  const allKeys: string[] = [];
  for (const a of mod.actions) if (actions.includes(a)) allKeys.push(permKey(mod.id, a));
  for (const sub of mod.submodules) {
    for (const a of sub.actions) if (actions.includes(a)) allKeys.push(permKey(sub.id, a));
  }
  if (allKeys.length === 0) return 'none';
  const checked = allKeys.filter(k => state[k]).length;
  if (checked === 0) return 'none';
  if (checked === allKeys.length) return 'all';
  return 'some';
}

function getActionStateForModule(
  modId: string, submodules: SubmoduleDef[], actionId: ActionId, state: PermState
): 'all' | 'some' | 'none' {
  const keys: string[] = [];
  const k = permKey(modId, actionId);
  // Parent key counts too
  for (const sub of submodules) {
    if (sub.actions.includes(actionId)) keys.push(permKey(sub.id, actionId));
  }
  if (keys.length === 0) return state[k] ? 'all' : 'none';
  const checked = keys.filter(k2 => state[k2]).length;
  const parentChecked = state[k] ? 1 : 0;
  const total = keys.length + (/* parent row */ 1);
  const totalChecked = checked + parentChecked;
  if (totalChecked === 0) return 'none';
  if (totalChecked === total) return 'all';
  return 'some';
}

// ─── Column header widths ─────────────────────────────────────────────────────
const COL_W = 58;
const MOD_W = 256;

// ─── Main Component ───────────────────────────────────────────────────────────

export function PermissionMatrixView() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<RoleId>("PLATFORM_ADMIN");
  const [search, setSearch] = useState("");
  const [showExtended, setShowExtended] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<ModuleGroup>>(new Set(["platform", "deployment", "business"]));
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [permState, setPermState] = useState<PermState>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneFrom, setCloneFrom] = useState<RoleId>("QUANTIX_SUPER_ADMIN");
  const [resetOpen, setResetOpen] = useState(false);

  const visibleActions = useMemo(
    () => showExtended
      ? PERMISSION_ACTIONS
      : PERMISSION_ACTIONS.filter(a => STANDARD_ACTION_IDS.includes(a.id)),
    [showExtended]
  );

  // ── Fetch role list ──────────────────────────────────────────────────────
  const { data: rolesData } = useQuery({
    queryKey: ["rbac-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/rbac", { headers: getAuthHeaders() });
      const d = await res.json();
      return d.data as RoleInfo[];
    },
  });

  // ── Fetch permissions for selected role ──────────────────────────────────
  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ["rbac-perms", selectedRole],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rbac/${selectedRole}`, { headers: getAuthHeaders() });
      const d = await res.json();
      return d.data as { role: string; permissions: string[]; isCustomized: boolean };
    },
  });

  // Initialise permState when data arrives
  useEffect(() => {
    if (!permData) return;
    const s: PermState = {};
    allPermissionKeys().forEach(k => { s[k] = false; });
    permData.permissions.forEach(k => { s[k] = true; });
    setPermState(s);
    setIsDirty(false);
    setSaveMsg(null);
  }, [permData]);

  // ── Save mutation ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(permState).filter(([, v]) => v).map(([k]) => k);
      const res = await fetch(`/api/admin/rbac/${selectedRole}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ permissions, userId: user?.id, userEmail: user?.email }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      return d.data;
    },
    onSuccess: (d) => {
      setSaveMsg({ type: "success", text: `Saved — ${d.added} added, ${d.removed} removed` });
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      setTimeout(() => setSaveMsg(null), 4000);
    },
    onError: (e: Error) => {
      setSaveMsg({ type: "error", text: e.message });
    },
  });

  // ── Clone mutation ───────────────────────────────────────────────────────
  const cloneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/rbac/${selectedRole}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ cloneFrom, userId: user?.id }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      return d.data;
    },
    onSuccess: () => {
      setCloneOpen(false);
      qc.invalidateQueries({ queryKey: ["rbac-perms", selectedRole] });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });

  // ── Toggle helpers ───────────────────────────────────────────────────────
  const toggle = useCallback((key: string) => {
    setPermState(s => ({ ...s, [key]: !s[key] }));
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  const setAll = useCallback((keys: string[], value: boolean) => {
    setPermState(s => {
      const n = { ...s };
      keys.forEach(k => { n[k] = value; });
      return n;
    });
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  // Toggle entire module row (parent + all subs for a given action)
  const toggleModuleAction = useCallback((mod: ModuleDef, actionId: ActionId, value: boolean) => {
    const keys: string[] = [];
    if (mod.actions.includes(actionId)) keys.push(permKey(mod.id, actionId));
    for (const sub of mod.submodules) {
      if (sub.actions.includes(actionId)) keys.push(permKey(sub.id, actionId));
    }
    setAll(keys, value);
  }, [setAll]);

  // Toggle all actions for a module (parent + subs)
  const toggleModuleAll = useCallback((mod: ModuleDef, value: boolean) => {
    const keys: string[] = [];
    for (const a of mod.actions) keys.push(permKey(mod.id, a));
    for (const sub of mod.submodules) {
      for (const a of sub.actions) keys.push(permKey(sub.id, a));
    }
    setAll(keys, value);
  }, [setAll]);

  // Select/clear all
  const selectAll = useCallback(() => {
    setAll(allPermissionKeys(), true);
  }, [setAll]);

  const clearAll = useCallback(() => {
    setAll(allPermissionKeys(), false);
  }, [setAll]);

  const resetToTemplate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["rbac-perms", selectedRole] });
    setResetOpen(false);
  }, [qc, selectedRole]);

  // ── Filtered modules ─────────────────────────────────────────────────────
  const filteredModules = useMemo(() => {
    if (!search) return PERMISSION_MODULES;
    const q = search.toLowerCase();
    return PERMISSION_MODULES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.submodules.some(s => s.label.toLowerCase().includes(q))
    );
  }, [search]);

  const selectedRoleMeta = ROLE_META.find(r => r.id === selectedRole);
  const roleInfo = rolesData?.find(r => r.id === selectedRole);
  const checkedCount = Object.values(permState).filter(Boolean).length;
  const totalCount = allPermissionKeys().length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-6 py-4 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Roles & Permissions</h1>
            <Badge variant="outline" className="text-xs font-mono">RBAC</Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isDirty && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </span>
            )}
            {saveMsg && (
              <span className={`flex items-center gap-1 text-xs ${saveMsg.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                <CheckCircle2 className="h-3 w-3" />
                {saveMsg.text}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Clone From
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              className="min-w-[80px]"
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
            </Button>
          </div>
        </div>

        {/* Role selector row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Editing role:</span>
            <Select value={selectedRole} onValueChange={v => { setSelectedRole(v as RoleId); setIsDirty(false); }}>
              <SelectTrigger className="h-8 text-sm max-w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Platform</div>
                {ROLE_META.filter(r => r.group === "platform").map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </SelectItem>
                ))}
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">Business</div>
                {ROLE_META.filter(r => r.group === "business").map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleMeta && (
              <span className="text-xs text-muted-foreground hidden sm:block">— {selectedRoleMeta.description}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {roleInfo?.isCustomized && (
              <Badge variant="secondary" className="text-[10px]">Customized</Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono">{checkedCount}/{totalCount}</span>
          </div>
        </div>

        {/* Search + quick actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search modules…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll} className="h-8 text-xs">
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="h-8 text-xs">
            <Square className="h-3.5 w-3.5 mr-1" />
            Clear All
          </Button>
          <Button
            variant={showExtended ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowExtended(v => !v)}
            className="h-8 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            {showExtended ? "Hide" : "Show"} Advanced
          </Button>
        </div>
      </div>

      {/* ── Matrix ──────────────────────────────────────────────────────── */}
      {permLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: MOD_W + visibleActions.length * COL_W }}>
            {/* Sticky header */}
            <thead>
              <tr className="bg-muted/60 border-b sticky top-0 z-30">
                <th
                  className="text-left px-4 py-2.5 font-semibold text-muted-foreground bg-muted/60 sticky left-0 z-40 border-r"
                  style={{ minWidth: MOD_W, width: MOD_W }}
                >
                  Module / Submodule
                </th>
                {visibleActions.map(action => (
                  <th
                    key={action.id}
                    className="text-center py-2.5 font-semibold"
                    style={{ width: COL_W, minWidth: COL_W }}
                    title={action.description}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: action.color }}
                      >
                        {action.label}
                      </span>
                      {action.isExtended && (
                        <span className="text-[8px] text-muted-foreground">adv</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {MODULE_GROUPS.map(group => {
                const mods = filteredModules.filter(m => m.group === group.id);
                if (mods.length === 0) return null;
                const groupExpanded = expandedGroups.has(group.id);

                return (
                  <>
                    {/* Group header row */}
                    <tr
                      key={`grp-${group.id}`}
                      className="bg-accent/40 border-y border-border/60 cursor-pointer select-none hover:bg-accent/60 transition-colors"
                      onClick={() => setExpandedGroups(prev => {
                        const n = new Set(prev);
                        n.has(group.id) ? n.delete(group.id) : n.add(group.id);
                        return n;
                      })}
                    >
                      <td
                        className="px-4 py-2 font-semibold text-foreground/80 sticky left-0 bg-accent/40 border-r z-10"
                        style={{ width: MOD_W }}
                        colSpan={1}
                      >
                        <div className="flex items-center gap-2">
                          {groupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span className="text-[11px] uppercase tracking-wider">{group.label}</span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{mods.length}</Badge>
                        </div>
                      </td>
                      {visibleActions.map(a => (
                        <td key={a.id} className="text-center py-2 text-muted-foreground/40">—</td>
                      ))}
                    </tr>

                    {/* Module rows */}
                    {groupExpanded && mods.map(mod => {
                      const modExpanded = expandedModules.has(mod.id);
                      const modState = getModuleState(mod, visibleActions.map(a => a.id), permState);

                      return (
                        <>
                          {/* Parent module row */}
                          <tr
                            key={`mod-${mod.id}`}
                            className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${modState === "all" ? "bg-primary/3" : ""}`}
                          >
                            <td
                              className="px-4 py-2 sticky left-0 bg-background border-r z-10 hover:bg-muted/30"
                              style={{ width: MOD_W }}
                            >
                              <div className="flex items-center gap-2">
                                {mod.submodules.length > 0 ? (
                                  <button
                                    onClick={() => setExpandedModules(prev => {
                                      const n = new Set(prev);
                                      n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id);
                                      return n;
                                    })}
                                    className="flex items-center gap-1.5 text-left group"
                                  >
                                    {modExpanded
                                      ? <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                                      : <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                                    }
                                    <span className="font-medium text-foreground/90 text-[11px]">{mod.label}</span>
                                    <span className="text-[9px] text-muted-foreground">({mod.submodules.length})</span>
                                  </button>
                                ) : (
                                  <span className="ml-5 font-medium text-foreground/90 text-[11px]">{mod.label}</span>
                                )}
                                {modState === "some" && (
                                  <span className="ml-auto">
                                    <Minus className="h-2.5 w-2.5 text-amber-500" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {visibleActions.map(action => {
                              const supported = mod.actions.includes(action.id);
                              if (!supported) {
                                return (
                                  <td key={action.id} className="text-center py-2">
                                    <span className="text-muted-foreground/20 text-[10px]">—</span>
                                  </td>
                                );
                              }
                              const key = permKey(mod.id, action.id);
                              const colState = getActionStateForModule(mod.id, mod.submodules, action.id, permState);
                              const allChecked = colState === 'all';
                              const someChecked = colState === 'some';

                              return (
                                <td key={action.id} className="text-center py-2">
                                  <IndeterminateCheckbox
                                    checked={allChecked}
                                    indeterminate={someChecked}
                                    onChange={() => {
                                      if (mod.submodules.length > 0) {
                                        toggleModuleAction(mod, action.id, colState !== 'all');
                                      } else {
                                        toggle(key);
                                      }
                                    }}
                                  />
                                </td>
                              );
                            })}
                          </tr>

                          {/* Submodule rows */}
                          {modExpanded && mod.submodules.map(sub => (
                            <tr
                              key={`sub-${sub.id}`}
                              className="border-b border-border/20 hover:bg-muted/20 transition-colors bg-muted/5"
                            >
                              <td
                                className="sticky left-0 bg-muted/5 border-r z-10 hover:bg-muted/20"
                                style={{ width: MOD_W }}
                              >
                                <div className="flex items-center pl-10 pr-4 py-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mr-2 shrink-0" />
                                  <span className="text-[10px] text-muted-foreground">{sub.label}</span>
                                </div>
                              </td>
                              {visibleActions.map(action => {
                                const supported = sub.actions.includes(action.id);
                                if (!supported) {
                                  return (
                                    <td key={action.id} className="text-center py-1.5">
                                      <span className="text-muted-foreground/15 text-[9px]">—</span>
                                    </td>
                                  );
                                }
                                const key = permKey(sub.id, action.id);
                                return (
                                  <td key={action.id} className="text-center py-1.5">
                                    <IndeterminateCheckbox
                                      checked={!!permState[key]}
                                      indeterminate={false}
                                      onChange={() => toggle(key)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Clone Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Clone Permissions
            </DialogTitle>
            <DialogDescription>
              Copy all permissions from another role into <strong>{selectedRoleMeta?.label}</strong>.
              This will overwrite the current permission set.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Select value={cloneFrom} onValueChange={v => setCloneFrom(v as RoleId)}>
              <SelectTrigger>
                <SelectValue placeholder="Select source role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_META.filter(r => r.id !== selectedRole).map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloneOpen(false)}>Cancel</Button>
            <Button onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending}>
              {cloneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Clone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </DialogTitle>
            <DialogDescription>
              This will discard all customizations for <strong>{selectedRoleMeta?.label}</strong> and restore the factory default permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={resetToTemplate}>Reset to Default</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
