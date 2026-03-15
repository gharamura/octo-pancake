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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParsedRow } from "@/lib/parsers/types";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, ChevronsUpDown, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Parser registry (metadata only — no server imports)
// ---------------------------------------------------------------------------

const AVAILABLE_PARSERS = [
  { id: "btg-checking",          name: "BTG Pactual – Extrato",          accept: ".xls,.xlsx" },
  { id: "btg-credit",            name: "BTG Pactual – Fatura Cartão",    accept: ".xlsx"      },
  { id: "contabilizei-checking", name: "Contabilizei – Extrato",         accept: ".csv"       },
  { id: "itau-checking",         name: "Itaú – Extrato Conta Corrente",  accept: ".pdf"       },
  { id: "itau-credit",            name: "Itaú – Fatura Cartão de Crédito", accept: ".pdf"       },
  { id: "btg-black-legacy",      name: "BTG Black – Legado",             accept: ".xlsx"      },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtAmount(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "preview" | "done";

interface Account {
  id:            string;
  name:          string;
  type:          string;
  institution:   string | null;
  accountNumber: string | null;
}

interface CoaOption {
  code:       string;
  name:       string;
  type:       string;
  parentCode: string | null;
}

type SortField = "date" | "description" | "amount" | "coa";
type SortDir   = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportTransactions() {
  // ── Step ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("upload");

  // ── Upload step state ───────────────────────────────────────────────────
  const [accounts,  setAccounts]  = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [parserId,  setParserId]  = useState(AVAILABLE_PARSERS[0].id);
  const [file,      setFile]      = useState<File | null>(null);
  const [parsing,   setParsing]   = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Preview step state ──────────────────────────────────────────────────
  const [rows,     setRows]     = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importError,  setImportError]  = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir,   setSortDir]   = useState<SortDir>("asc");

  // COA list for editing
  const [coaList, setCoaList] = useState<CoaOption[]>([]);
  // Per-row COA overrides: tempId → { code, name }
  const [coaOverrides, setCoaOverrides] = useState<Map<string, { code: string; name: string } | null>>(new Map());

  // Accounting date for the entire batch (YYYY-MM)
  const [batchAccountingMonth, setBatchAccountingMonth] = useState("");

  // ── Done step state ─────────────────────────────────────────────────────
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        if (data.length === 1) setAccountId(data[0].id);
      })
      .catch(() => {});
    fetch("/api/coa")
      .then((r) => r.json())
      .then((data: CoaOption[]) => setCoaList(data))
      .catch(() => {});
  }, []);

  // ── Parse ──────────────────────────────────────────────────────────────

  async function handleParse() {
    if (!file || !accountId || !parserId) return;
    setParseError(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file",     file);
      form.append("parserId", parserId);

      const res = await fetch("/api/import/parse", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        setParseError(data.error ?? "Could not parse file.");
        return;
      }
      const { rows: parsed } = await res.json() as { rows: ParsedRow[] };
      setRows(parsed);
      setSelected(new Set(parsed.map((r) => r.tempId)));
      setStep("preview");
    } catch {
      setParseError("Something went wrong.");
    } finally {
      setParsing(false);
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter((r) => selected.has(r.tempId));
    if (toImport.length === 0) return;

    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/import/execute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          accountId,
          rows: toImport.map((r) => {
            const override = coaOverrides.get(r.tempId);
            const coaCode = override !== undefined
              ? (override?.code ?? null)
              : r.suggestedCoaCode;
            const accountingDate = batchAccountingMonth
              ? `${batchAccountingMonth}-01`
              : r.accountingDate;
            return {
              date:             r.date,
              description:      r.description,
              amount:           r.amount,
              suggestedCoaCode: coaCode,
              accountingDate,
              notes:            r.notes,
            };
          }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setImportError(data.error ?? "Import failed.");
        return;
      }
      const { inserted } = await res.json() as { inserted: number };
      setImportedCount(inserted);
      setStep("done");
    } catch {
      setImportError("Something went wrong.");
    } finally {
      setImporting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  function reset() {
    setStep("upload");
    setFile(null);
    setRows([]);
    setSelected(new Set());
    setParseError(null);
    setImportError(null);
    setImportedCount(0);
    setCoaOverrides(new Map());
    setBatchAccountingMonth("");
    setSortField("date");
    setSortDir("asc");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Leaf COA list (non-parent accounts only) ──────────────────────────
  const leafCoaList = useMemo(() => {
    const parentCodes = new Set(coaList.map((c) => c.parentCode).filter(Boolean));
    return coaList.filter((c) => !parentCodes.has(c.code));
  }, [coaList]);

  // ── Effective COA for a row (override > suggested) ───────────────────
  const getRowCoa = useCallback(
    (row: ParsedRow) => {
      const override = coaOverrides.get(row.tempId);
      if (override !== undefined) return override; // null means explicitly cleared
      if (row.suggestedCoaCode) return { code: row.suggestedCoaCode, name: row.suggestedCoaName ?? "" };
      return null;
    },
    [coaOverrides],
  );

  // ── Sorted rows ──────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "date":
          return dir * a.date.localeCompare(b.date);
        case "description":
          return dir * a.description.localeCompare(b.description);
        case "amount":
          return dir * (a.amount - b.amount);
        case "coa": {
          const ca = getRowCoa(a)?.code ?? "";
          const cb = getRowCoa(b)?.code ?? "";
          return dir * ca.localeCompare(cb);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [rows, sortField, sortDir, getRowCoa]);

  // ── Totals (selected rows only) ──────────────────────────────────────
  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      if (!selected.has(r.tempId)) continue;
      if (r.amount >= 0) totalIn += r.amount;
      else totalOut += r.amount;
    }
    return { totalIn, totalOut, net: totalIn + totalOut };
  }, [rows, selected]);

  // ── Sort handler ─────────────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────

  const allSelected  = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.tempId)));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedParser = AVAILABLE_PARSERS.find((p) => p.id === parserId)!;

  // ── Render ─────────────────────────────────────────────────────────────

  // Step 1: Upload
  if (step === "upload") {
    return (
      <div className="max-w-lg space-y-5">
        {/* Account */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Account</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex flex-col">
                    <span>{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[a.type, a.institution, a.accountNumber].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Parser */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">File format</label>
          <Select value={parserId} onValueChange={setParserId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_PARSERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">File</label>
          <div
            className="flex items-center gap-3 rounded-md border border-dashed px-4 py-5 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : "Click to select file…"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={selectedParser.accept}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}

        <Button
          variant="success"
          disabled={!file || !accountId || parsing}
          onClick={handleParse}
        >
          {parsing ? "Parsing…" : "Parse File"}
        </Button>
      </div>
    );
  }

  // Step 2: Preview
  if (step === "preview") {
    const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
      return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    };

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={reset}>
              ← Back
            </Button>
            <span className="text-sm text-muted-foreground">
              {rows.length} rows parsed · {selected.size} selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Acc Month</label>
              <Input
                type="month"
                value={batchAccountingMonth}
                onChange={(e) => setBatchAccountingMonth(e.target.value)}
                className="h-8 w-36 text-xs"
                placeholder="Same as date"
              />
            </div>
            <Button
              variant="success"
              size="sm"
              disabled={selected.size === 0 || importing}
              onClick={handleImport}
            >
              {importing ? "Importing…" : `Import ${selected.size} selected`}
            </Button>
          </div>
        </div>

        {importError && <p className="text-sm text-destructive">{importError}</p>}

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th
                  className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("date")}
                >
                  <span className="inline-flex items-center gap-1">Date <SortIcon field="date" /></span>
                </th>
                <th
                  className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide cursor-pointer select-none"
                  onClick={() => toggleSort("description")}
                >
                  <span className="inline-flex items-center gap-1">Recipient <SortIcon field="description" /></span>
                </th>
                <th
                  className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort("amount")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">Amount <SortIcon field="amount" /></span>
                </th>
                <th
                  className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide cursor-pointer select-none"
                  onClick={() => toggleSort("coa")}
                >
                  <span className="inline-flex items-center gap-1">COA <SortIcon field="coa" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const isSelected = selected.has(row.tempId);
                const rowCoa = getRowCoa(row);
                return (
                  <tr
                    key={row.tempId}
                    className={`border-b transition-colors cursor-pointer ${isSelected ? "bg-background hover:brightness-95" : "bg-muted/20 opacity-50"}`}
                    onClick={() => toggleRow(row.tempId)}
                  >
                    <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.tempId)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground text-xs">
                      {fmtDate(row.date)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[260px] truncate">
                      {row.description}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${row.amount >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmtAmount(row.amount)}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <CoaCellEditor
                        rowCoa={rowCoa}
                        suggestionSource={coaOverrides.has(row.tempId) ? null : row.suggestionSource}
                        leafCoaList={leafCoaList}
                        onChange={(val) => {
                          setCoaOverrides((prev) => {
                            const next = new Map(prev);
                            next.set(row.tempId, val);
                            return next;
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex items-center justify-end gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span>
            <span className="text-muted-foreground mr-1.5">IN</span>
            <span className="font-medium tabular-nums text-green-700 dark:text-green-400">
              {fmtAmount(totals.totalIn)}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground mr-1.5">OUT</span>
            <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
              {fmtAmount(totals.totalOut)}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground mr-1.5">NET</span>
            <span className={`font-medium tabular-nums ${totals.net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {fmtAmount(totals.net)}
            </span>
          </span>
        </div>
      </div>
    );
  }

  // Step 3: Done
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <div className="space-y-1">
        <p className="text-xl font-semibold">{importedCount} transactions imported</p>
        <p className="text-sm text-muted-foreground">They are now available in the transactions list.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Import more
        </Button>
        <Button asChild variant="success">
          <Link href="/transactions">View Transactions →</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COA Cell Editor (inline popover combobox per row)
// ---------------------------------------------------------------------------

function CoaCellEditor({
  rowCoa,
  suggestionSource,
  leafCoaList,
  onChange,
}: {
  rowCoa: { code: string; name: string } | null;
  suggestionSource: "alias" | "ai" | "legacy" | null;
  leafCoaList: CoaOption[];
  onChange: (val: { code: string; name: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs w-full text-left hover:bg-muted/60 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors"
        >
          {rowCoa ? (
            <>
              <span className="font-mono text-muted-foreground">{rowCoa.code}</span>
              <span className="truncate max-w-[120px]">{rowCoa.name}</span>
              {suggestionSource === "ai" && (
                <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  AI
                </span>
              )}
              {suggestionSource === "legacy" && (
                <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  Legacy
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <ChevronsUpDown className="ml-auto h-3 w-3 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search COA…" />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <Check className={`mr-2 h-4 w-4 ${!rowCoa ? "opacity-100" : "opacity-0"}`} />
                — None —
              </CommandItem>
              {leafCoaList.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  onSelect={() => {
                    onChange({ code: c.code, name: c.name });
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${rowCoa?.code === c.code ? "opacity-100" : "opacity-0"}`} />
                  {c.code} · {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
