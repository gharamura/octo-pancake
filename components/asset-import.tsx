"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssetWithAccount } from "@/lib/repositories/asset.repository";
import { CheckCheck, Upload, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  name:            "Name",
  asset_class:     "Class",
  geography:       "Geography",
  risk_factor:     "Risk Factor",
  index:           "Index",
  liquidity:       "Liquidity",
  custodian:       "Custodian",
  currency:        "Currency",
  expiration_date: "Expiration",
  rule:            "Rule",
  is_active:       "Active",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  return s.includes("T") ? s.split("T")[0] : s;
}

function getExistingValue(asset: AssetWithAccount, csvField: string): string {
  switch (csvField) {
    case "name":            return asset.name ?? "";
    case "asset_class":     return asset.assetClass ?? "";
    case "geography":       return asset.geography ?? "";
    case "risk_factor":     return asset.riskFactor ?? "";
    case "index":           return (asset as any).index ?? "";
    case "liquidity":       return asset.liquidity ?? "";
    case "custodian":       return asset.custodian ?? "";
    case "currency":        return asset.currency ?? "";
    case "expiration_date": return fmtDate(asset.expirationDate);
    case "rule":            return asset.rule ?? "";
    case "is_active":       return asset.isActive ? "true" : "false";
    default:                return "";
  }
}

function buildPatchBody(row: Record<string, string>, existing: AssetWithAccount) {
  const get = (csvField: string) => String(row[csvField] ?? "").trim();
  return {
    accountId:      existing.accountId,
    name:           get("name")            || existing.name,
    assetClass:     get("asset_class")     || null,
    geography:      get("geography")       || null,
    riskFactor:     get("risk_factor")     || null,
    index:          get("index")           || null,
    liquidity:      get("liquidity")       || null,
    custodian:      get("custodian")       || null,
    currency:       get("currency")        || "BRL",
    expirationDate: get("expiration_date") || null,
    rule:           get("rule")            || null,
    isActive:       get("is_active") !== "" ? get("is_active") === "true" : existing.isActive,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldChange = {
  field:    string;
  label:    string;
  oldValue: string;
  newValue: string;
};

type AssetDiff = {
  id:          string;
  currentName: string;
  changes:     FieldChange[];
  row:         Record<string, string>;
  selected:    boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssetImportProps {
  assets:    AssetWithAccount[];
  onApplied: () => void;
}

export function AssetImport({ assets, onApplied }: AssetImportProps) {
  const [open,     setOpen]     = useState(false);
  const [phase,    setPhase]    = useState<"upload" | "review" | "done">("upload");
  const [diffs,    setDiffs]    = useState<AssetDiff[]>([]);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const assetMap = useMemo(
    () => new Map(assets.map((a) => [a.id, a])),
    [assets]
  );

  // -------------------------------------------------------------------------
  // Parse spreadsheet → compute diffs
  // -------------------------------------------------------------------------

  const parseFile = useCallback((file: File) => {
    setParseErr(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        const result: AssetDiff[] = [];

        for (const row of rows) {
          const id = String(row.id ?? "").trim();
          if (!id) continue;
          const existing = assetMap.get(id);
          if (!existing) continue;

          const changes: FieldChange[] = [];
          for (const [csvField, label] of Object.entries(FIELD_LABELS)) {
            const newVal = String(row[csvField] ?? "").trim();
            const oldVal = getExistingValue(existing, csvField);
            if (newVal !== oldVal) {
              changes.push({ field: csvField, label, oldValue: oldVal, newValue: newVal });
            }
          }

          if (changes.length > 0) {
            result.push({ id, currentName: existing.name, changes, row, selected: true });
          }
        }

        if (result.length === 0) {
          setParseErr("No changes detected. The spreadsheet matches the current data.");
          return;
        }

        setDiffs(result);
        setPhase("review");
      } catch {
        setParseErr("Could not parse file. Make sure it is a valid CSV or XLSX.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [assetMap]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  const selectedCount  = diffs.filter((d) => d.selected).length;
  const allSelected    = diffs.length > 0 && selectedCount === diffs.length;
  const someSelected   = selectedCount > 0 && !allSelected;

  const toggleAll = () =>
    setDiffs((prev) => prev.map((d) => ({ ...d, selected: !allSelected })));

  const toggleOne = (id: string) =>
    setDiffs((prev) => prev.map((d) => d.id === id ? { ...d, selected: !d.selected } : d));

  // -------------------------------------------------------------------------
  // Apply changes
  // -------------------------------------------------------------------------

  async function applyChanges() {
    const selected = diffs.filter((d) => d.selected);
    if (selected.length === 0) return;
    setApplying(true);
    setApplyErr(null);
    setProgress(0);

    let done = 0;
    const errors: string[] = [];

    for (const diff of selected) {
      const existing = assetMap.get(diff.id)!;
      const body = buildPatchBody(diff.row, existing);
      try {
        const res = await fetch(`/api/assets/${diff.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) errors.push(diff.currentName);
      } catch {
        errors.push(diff.currentName);
      }
      done++;
      setProgress(Math.round((done / selected.length) * 100));
    }

    setApplying(false);
    if (errors.length > 0) {
      setApplyErr(`Failed to update: ${errors.join(", ")}`);
    } else {
      setPhase("done");
      onApplied();
    }
  }

  // -------------------------------------------------------------------------
  // Reset on close
  // -------------------------------------------------------------------------

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        setPhase("upload");
        setDiffs([]);
        setParseErr(null);
        setApplyErr(null);
        setProgress(0);
      }, 300);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" />
        Import
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {phase === "upload" && "Import Assets"}
              {phase === "review" && `Review Changes — ${diffs.length} asset${diffs.length !== 1 ? "s" : ""} affected`}
              {phase === "done"   && "Import Complete"}
            </DialogTitle>
          </DialogHeader>

          {/* ---- Upload phase ---- */}
          {phase === "upload" && (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or XLSX file. Assets are matched by <code className="text-xs bg-muted px-1 py-0.5 rounded">id</code>.
                Only rows with changes are shown. Use the export button to get the correct format.
              </p>

              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV or XLSX</p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />

              {parseErr && (
                <p className="text-sm text-destructive">{parseErr}</p>
              )}
            </div>
          )}

          {/* ---- Review phase ---- */}
          {phase === "review" && (
            <div className="flex flex-col gap-3 min-h-0 flex-1">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-muted-foreground/40 accent-primary"
                  />
                  <span className="font-medium">
                    {selectedCount} of {diffs.length} selected
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => { setPhase("upload"); setDiffs([]); setParseErr(null); }}
                >
                  ← Upload different file
                </Button>
              </div>

              {/* Diff table */}
              <div className="overflow-auto flex-1 rounded-md border">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-muted-foreground/40 accent-primary"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Asset</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((diff, i) => (
                      <tr
                        key={diff.id}
                        className={`border-t transition-colors cursor-pointer ${diff.selected ? "bg-background hover:bg-muted/30" : "bg-muted/20 opacity-50 hover:opacity-70"}`}
                        onClick={() => toggleOne(diff.id)}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={diff.selected}
                            onChange={() => toggleOne(diff.id)}
                            className="h-4 w-4 rounded border-muted-foreground/40 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <span className="font-medium">{diff.currentName}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                            {diff.changes.map((c) => (
                              <div key={c.field} className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground font-medium shrink-0">{c.label}:</span>
                                {c.oldValue
                                  ? <span className="line-through text-muted-foreground/60">{c.oldValue}</span>
                                  : <span className="text-muted-foreground/40 italic">empty</span>}
                                <span className="text-muted-foreground/50">→</span>
                                {c.newValue
                                  ? <span className="text-foreground font-medium">{c.newValue}</span>
                                  : <span className="text-muted-foreground/40 italic">empty</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Apply bar */}
              <div className="flex items-center justify-between pt-1 border-t">
                <div className="flex-1">
                  {applying && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                    </div>
                  )}
                  {applyErr && <p className="text-xs text-destructive">{applyErr}</p>}
                </div>
                <Button
                  variant="success"
                  size="sm"
                  disabled={selectedCount === 0 || applying}
                  onClick={applyChanges}
                  className="ml-4 shrink-0"
                >
                  <CheckCheck className="h-4 w-4 mr-1.5" />
                  {applying ? `Applying… ${progress}%` : `Apply ${selectedCount} change${selectedCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          )}

          {/* ---- Done phase ---- */}
          {phase === "done" && (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-lg">All changes applied</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCount} asset{selectedCount !== 1 ? "s" : ""} updated successfully.
                </p>
              </div>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
