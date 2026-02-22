"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { CoaAccount } from "@/lib/db/schema";
import type { RecipientCoaRow, RecipientDetail } from "@/lib/repositories/recipient.repository";
import { Check, ChevronsUpDown, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecipientFormProps {
  record?: RecipientDetail;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipientForm({ record, onSuccess }: RecipientFormProps) {
  const isEdit = !!record;

  // Basic fields
  const [name,     setName]     = useState(record?.name     ?? "");
  const [notes,    setNotes]    = useState(record?.notes    ?? "");
  const [isActive, setIsActive] = useState(record?.isActive ?? true);

  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Aliases (edit only)
  const [aliases,    setAliases]    = useState<string[]>(record?.aliases.map((a) => a.alias) ?? []);
  const [newAlias,   setNewAlias]   = useState("");
  const [addingAlias, setAddingAlias] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);

  // COA links (edit only)
  const [coas,    setCoas]    = useState<RecipientCoaRow[]>(record?.coas ?? []);
  const [coaList, setCoaList] = useState<CoaAccount[]>([]);
  const [coaOpen, setCoaOpen] = useState(false);
  const [newCoaCode,   setNewCoaCode]   = useState("");
  const [newCoaPrimary, setNewCoaPrimary] = useState(false);
  const [addingCoa, setAddingCoa] = useState(false);
  const [coaError,  setCoaError]  = useState<string | null>(null);

  // Merge (edit only)
  const [recipientsList, setRecipientsList] = useState<{ id: string; name: string }[]>([]);
  const [mergeTargetId,  setMergeTargetId]  = useState("");
  const [mergeOpen,      setMergeOpen]      = useState(false);
  const [confirmMerge,   setConfirmMerge]   = useState(false);
  const [merging,        setMerging]        = useState(false);
  const [mergeError,     setMergeError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      fetch("/api/coa").then((r) => r.json()),
      fetch("/api/recipients").then((r) => r.json()),
    ])
      .then(([coa, recs]) => {
        setCoaList(coa);
        setRecipientsList(
          (recs as { id: string; name: string }[]).filter((r) => r.id !== record!.id)
        );
      })
      .catch(() => {});
  }, [isEdit, record]);

  // ---------------------------------------------------------------------------
  // Basic info submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!name.trim()) { setError("Name is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/recipients/${record.id}` : "/api/recipients",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), notes: notes || null, isActive }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete recipient
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!record) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipients/${record.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete recipient.");
        setConfirmDelete(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Alias management (immediate API calls)
  // ---------------------------------------------------------------------------

  async function handleAddAlias() {
    const alias = newAlias.trim().toUpperCase();
    if (!alias) return;
    setAliasError(null);
    setAddingAlias(true);
    try {
      const res = await fetch(`/api/recipients/${record!.id}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAliasError(data.error ?? "Could not add alias.");
        return;
      }
      setAliases((prev) => [...prev, alias].sort());
      setNewAlias("");
    } catch {
      setAliasError("Something went wrong.");
    } finally {
      setAddingAlias(false);
    }
  }

  async function handleRemoveAlias(alias: string) {
    try {
      await fetch(`/api/recipients/${record!.id}/aliases`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      setAliases((prev) => prev.filter((a) => a !== alias));
    } catch {
      // silent — UI still removes optimistically
    }
  }

  // ---------------------------------------------------------------------------
  // COA management (immediate API calls)
  // ---------------------------------------------------------------------------

  async function handleAddCoa() {
    if (!newCoaCode) return;
    setCoaError(null);
    setAddingCoa(true);
    try {
      const res = await fetch(`/api/recipients/${record!.id}/coa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coaCode: newCoaCode, isPrimary: newCoaPrimary }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCoaError(data.error ?? "Could not add COA link.");
        return;
      }
      const created = await res.json();
      const coaEntry = coaList.find((c) => c.code === newCoaCode);
      const newRow: RecipientCoaRow = { ...created, coaName: coaEntry?.name ?? null };

      setCoas((prev) => {
        const updated = newCoaPrimary
          ? prev.map((c) => ({ ...c, isPrimary: false }))
          : prev;
        return [...updated, newRow];
      });
      setNewCoaCode("");
      setNewCoaPrimary(false);
    } catch {
      setCoaError("Something went wrong.");
    } finally {
      setAddingCoa(false);
    }
  }

  async function handleSetPrimary(coaLinkId: string) {
    try {
      await fetch(`/api/recipients/${record!.id}/coa/${coaLinkId}`, { method: "PATCH" });
      setCoas((prev) =>
        prev.map((c) => ({ ...c, isPrimary: c.id === coaLinkId }))
      );
    } catch {
      // silent
    }
  }

  async function handleRemoveCoa(coaLinkId: string) {
    try {
      await fetch(`/api/recipients/${record!.id}/coa/${coaLinkId}`, { method: "DELETE" });
      setCoas((prev) => prev.filter((c) => c.id !== coaLinkId));
    } catch {
      // silent
    }
  }

  // ---------------------------------------------------------------------------
  // Merge
  // ---------------------------------------------------------------------------

  async function handleMerge() {
    if (!mergeTargetId) return;
    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/recipients/${record!.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTargetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMergeError(data.error ?? "Could not merge recipients.");
        setConfirmMerge(false);
        return;
      }
      onSuccess();
    } catch {
      setMergeError("Something went wrong.");
    } finally {
      setMerging(false);
    }
  }

  const selectedCoa = coaList.find((c) => c.code === newCoaCode) ?? null;
  const usedCoaCodes = new Set(coas.map((c) => c.coaCode));
  const mergeTarget = recipientsList.find((r) => r.id === mergeTargetId) ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 pt-2">
      {/* ── Basic fields ── */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix"
            autoFocus={!isEdit}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {isEdit && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )
          )}
          <Button
            type="button"
            variant={isEdit ? "warning" : "success"}
            disabled={saving || !name.trim()}
            className={isEdit ? "" : "ml-auto"}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Recipient"}
          </Button>
        </div>
      </div>

      {/* ── Aliases (edit only) ── */}
      {isEdit && (
        <div className="space-y-3 border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Aliases
          </p>

          {aliases.length > 0 && (
            <ul className="space-y-1">
              {aliases.map((alias) => (
                <li
                  key={alias}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-xs">{alias}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemoveAlias(alias)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value.toUpperCase())}
              placeholder="e.g. NETFLIX BRASIL"
              className="font-mono text-sm uppercase"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAlias(); } }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addingAlias || !newAlias.trim()}
              onClick={handleAddAlias}
            >
              Add
            </Button>
          </div>
          {aliasError && <p className="text-xs text-destructive">{aliasError}</p>}
        </div>
      )}

      {/* ── COA links (edit only) ── */}
      {isEdit && (
        <div className="space-y-3 border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            COA Accounts
          </p>

          {coas.length > 0 && (
            <ul className="space-y-1">
              {coas.map((coa) => (
                <li
                  key={coa.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <span className="flex-1 truncate">
                    <span className="font-mono text-xs text-muted-foreground mr-1.5">{coa.coaCode}</span>
                    {coa.coaName ?? ""}
                  </span>
                  <button
                    type="button"
                    title={coa.isPrimary ? "Primary" : "Set as primary"}
                    className={`transition-colors ${coa.isPrimary ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
                    onClick={() => !coa.isPrimary && handleSetPrimary(coa.id)}
                    disabled={coa.isPrimary}
                  >
                    <Star className="h-3.5 w-3.5" fill={coa.isPrimary ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemoveCoa(coa.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 items-center">
            <Popover open={coaOpen} onOpenChange={setCoaOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="flex-1 justify-between font-normal text-sm truncate"
                >
                  <span className="truncate">
                    {selectedCoa ? `${selectedCoa.code} · ${selectedCoa.name}` : "Select COA…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by code or name…" />
                  <CommandList>
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandGroup>
                      {coaList
                        .filter((c) => !usedCoaCodes.has(c.code))
                        .map((c) => (
                          <CommandItem
                            key={c.code}
                            value={`${c.code} ${c.name}`}
                            onSelect={() => { setNewCoaCode(c.code); setCoaOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${newCoaCode === c.code ? "opacity-100" : "opacity-0"}`} />
                            {c.code} · {c.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              title={newCoaPrimary ? "Primary (click to unset)" : "Set as primary"}
              className={`transition-colors ${newCoaPrimary ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
              onClick={() => setNewCoaPrimary((p) => !p)}
            >
              <Star className="h-4 w-4" fill={newCoaPrimary ? "currentColor" : "none"} />
            </button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addingCoa || !newCoaCode}
              onClick={handleAddCoa}
            >
              Add
            </Button>
          </div>
          {coaError && <p className="text-xs text-destructive">{coaError}</p>}
        </div>
      )}

      {/* ── Merge (edit only) ── */}
      {isEdit && (
        <div className="space-y-3 border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Merge into Another Recipient
          </p>
          <p className="text-xs text-muted-foreground">
            All aliases and COA links will be moved to the selected recipient, then this one will be deleted.
          </p>

          <Popover open={mergeOpen} onOpenChange={setMergeOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal text-sm"
              >
                <span className="truncate">
                  {mergeTarget ? mergeTarget.name : "Select recipient…"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search recipient…" />
                <CommandList>
                  <CommandEmpty>No recipient found.</CommandEmpty>
                  <CommandGroup>
                    {recipientsList.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.name}
                        onSelect={() => {
                          setMergeTargetId(r.id);
                          setConfirmMerge(false);
                          setMergeOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${mergeTargetId === r.id ? "opacity-100" : "opacity-0"}`} />
                        {r.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {mergeTargetId && (
            confirmMerge ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">
                  This will delete <strong>{record!.name}</strong> and move everything to <strong>{mergeTarget?.name}</strong>. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={merging}
                    onClick={handleMerge}
                  >
                    {merging ? "Merging…" : "Confirm Merge"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmMerge(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmMerge(true)}
              >
                Merge
              </Button>
            )
          )}

          {mergeError && <p className="text-xs text-destructive">{mergeError}</p>}
        </div>
      )}
    </div>
  );
}
