"use client";

import {
  type ColumnDef,
  type Row,
  getCoreRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionForm, type TransactionRow } from "@/components/transaction-form";
import { LinkTransferDialog, UnlinkTransferDialog } from "@/components/link-transfer-dialog";
import { LinkRecipientDialog } from "@/components/link-recipient-dialog";
import { SuggestCategoriesSheet } from "@/components/suggest-categories-sheet";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Link2,
  ListFilter,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Unlink2,
  UserRound,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const TRANSFER_CODES = new Set(["3110", "3120"]);
const ASSET_COA_CODES = new Set(["1060", "4110", "4210"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.slice(0, 10);
  const [year, month, day] = s.split("-");
  return `${day}/${month}/${year}`;
}

/** Normalise a Date | string | null to "YYYY-MM-DD" or "". */
function toISO(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Multi-select filter button
// ---------------------------------------------------------------------------

function MultiFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const active = selected.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          {active
            ? <ListFilter className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-50" />}
          {label}
          {active && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary leading-4">
              {selected.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px] max-h-72 overflow-y-auto">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => onToggle(opt.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-xs text-muted-foreground"
              onSelect={onClear}
            >
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Date-range filter button
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
] as const;

function DateRangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
  onClear,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onClear: () => void;
}) {
  const active = !!from || !!to;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <CalendarDays className="h-3 w-3 opacity-50" />
          {label}
          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>

        {/* Presets */}
        <div className="flex flex-col gap-1">
          {DATE_PRESETS.map(({ label: pl, days }) => (
            <button
              key={days}
              className="text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              onClick={() => { onFrom(daysAgo(days)); onTo(today()); }}
            >
              {pl}
            </button>
          ))}
        </div>

        <div className="border-t pt-2 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {active && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={onClear}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Single-month filter button
// ---------------------------------------------------------------------------

function MonthFilter({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const active = !!value;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <CalendarDays className="h-3 w-3 opacity-50" />
          {label}
          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input
            type="month"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        {active && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={onClear}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Bulk edit bar
// ---------------------------------------------------------------------------

type CoaOption = { code: string; name: string };

function BulkEditBar({
  selectedCount,
  coaOptions,
  onApply,
  onClear,
}: {
  selectedCount: number;
  coaOptions: CoaOption[];
  onApply: (data: { coaCode?: string | null; accountingDate?: string | null }) => Promise<void>;
  onClear: () => void;
}) {
  const [coaCode,         setCoaCode]         = useState("");   // "" = no change; "__clear__" = set null
  const [accountingMonth, setAccountingMonth] = useState("");   // "YYYY-MM" or ""
  const [applying, setApplying] = useState(false);

  const hasChanges = !!coaCode || !!accountingMonth;

  const handleApply = async () => {
    if (!hasChanges) return;
    setApplying(true);
    const data: { coaCode?: string | null; accountingDate?: string | null } = {};
    if (coaCode)         data.coaCode        = coaCode === "__clear__" ? null : coaCode;
    if (accountingMonth) data.accountingDate = `${accountingMonth}-01`;
    await onApply(data);
    setApplying(false);
    setCoaCode("");
    setAccountingMonth("");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium text-primary">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-border" />

      {/* COA selector */}
      <Select value={coaCode} onValueChange={setCoaCode}>
        <SelectTrigger className="h-8 w-60 text-xs">
          <SelectValue placeholder="Set COA account…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground italic">— Clear COA —</span>
          </SelectItem>
          {coaOptions.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="font-mono text-xs text-muted-foreground mr-1.5">{c.code}</span>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Accounting period (month picker) */}
      <Input
        type="month"
        value={accountingMonth}
        onChange={(e) => setAccountingMonth(e.target.value)}
        className="h-8 w-40 text-xs"
        placeholder="Accounting period"
      />

      <Button size="sm" className="h-8" onClick={handleApply} disabled={!hasChanges || applying}>
        {applying ? "Applying…" : "Apply"}
      </Button>

      <Button variant="ghost" size="sm" className="h-8 ml-auto text-muted-foreground" onClick={onClear}>
        <X className="h-3 w-3 mr-1" />
        Clear selection
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  transaction?: TransactionRow;
}

// ---------------------------------------------------------------------------
// Memoised table row — prevents all rows re-rendering on checkbox toggle
// ---------------------------------------------------------------------------

type MemoRowProps = {
  row:        Row<TransactionRow>;
  isSelected: boolean;
  onToggle:   (id: string) => void;
};

const MemoRow = memo(
  function MemoRow({ row, isSelected, onToggle }: MemoRowProps) {
    return (
      <TableRow>
        <TableCell className="pr-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          />
        </TableCell>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  },
  (prev, next) =>
    prev.row.original === next.row.original &&
    prev.isSelected   === next.isSelected   &&
    prev.onToggle     === next.onToggle
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionTableProps {
  initialCoa?:       string;
  initialFrom?:      string;
  initialTo?:        string;
  initialAccFrom?:   string;
  initialAccTo?:     string;
  initialRecipient?: string;
}

export function TransactionTable({ initialCoa, initialFrom, initialTo, initialAccFrom, initialAccTo, initialRecipient }: TransactionTableProps = {}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sheet, setSheet]               = useState<SheetState>({ open: false, mode: "create" });

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterAccounts,  setFilterAccounts]  = useState<string[]>([]);
  const [filterCoa,       setFilterCoa]       = useState<string[]>(() => initialCoa ? [initialCoa] : []);
  const [filterRecipient, setFilterRecipient] = useState(initialRecipient ?? "");
  // If an accounting date range is provided (e.g. from COA report), skip the
  // default 30-day transaction date filter so the accounting date filter
  // (client-side) can match across the full dataset.
  const [txFrom,  setTxFrom]  = useState(() => (initialAccFrom || initialRecipient) ? (initialFrom ?? "") : (initialFrom ?? daysAgo(30)));
  const [txTo,    setTxTo]    = useState(() => (initialAccTo   || initialRecipient) ? (initialTo   ?? "") : (initialTo   ?? today()));
  const [accMonth, setAccMonth] = useState(() => initialAccFrom?.slice(0, 7) ?? "");
  const [filterOrphans,        setFilterOrphans]        = useState(false);
  const [filterOrphanAssets,   setFilterOrphanAssets]   = useState(false);
  const [filterUncategorized,  setFilterUncategorized]  = useState(false);

  // ── Draft filter state (pending until Apply is clicked) ────────────────────
  const [draftFilterAccounts,  setDraftFilterAccounts]  = useState<string[]>([]);
  const [draftFilterCoa,       setDraftFilterCoa]       = useState<string[]>(() => initialCoa ? [initialCoa] : []);
  const [draftFilterRecipient, setDraftFilterRecipient] = useState(initialRecipient ?? "");
  const [draftTxFrom,  setDraftTxFrom]  = useState(() => (initialAccFrom || initialRecipient) ? (initialFrom ?? "") : (initialFrom ?? daysAgo(30)));
  const [draftTxTo,    setDraftTxTo]    = useState(() => (initialAccTo   || initialRecipient) ? (initialTo   ?? "") : (initialTo   ?? today()));
  const [draftAccMonth, setDraftAccMonth] = useState(() => initialAccFrom?.slice(0, 7) ?? "");

  // ── Transfer dialog state ─────────────────────────────────────────────────
  const [linkDialog,   setLinkDialog]   = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });
  const [unlinkDialog, setUnlinkDialog] = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });

  // ── Bulk edit state ───────────────────────────────────────────────────────
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [allCoaOptions, setAllCoaOptions] = useState<CoaOption[]>([]);

  // ── Link recipient dialog state ───────────────────────────────────────────
  const [linkRecipientDialog, setLinkRecipientDialog] = useState<{
    open: boolean; transaction: TransactionRow | null;
  }>({ open: false, transaction: null });
  const [allRecipients, setAllRecipients] = useState<RecipientDetail[]>([]);

  // ── Suggest categories sheet state ────────────────────────────────────────
  const [suggestSheet, setSuggestSheet] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (txFrom) params.set("from", txFrom);
    if (txTo)   params.set("to",   txTo);
    const url = `/api/transactions${params.size ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: TransactionRow[]) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [txFrom, txTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/coa")
      .then((r) => r.json())
      .then((data: { code: string; name: string; parentCode: string | null }[]) => {
        const parentCodes = new Set(data.map((c) => c.parentCode).filter(Boolean));
        setAllCoaOptions(
          data
            .filter((c) => !parentCodes.has(c.code))
            .map(({ code, name }) => ({ code, name }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/recipients")
      .then((r) => r.json())
      .then((data: RecipientDetail[]) => setAllRecipients(data))
      .catch(() => {});
  }, []);

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback(
    (t: TransactionRow) => setSheet({ open: true, mode: "edit", transaction: t }),
    []
  );

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSaved = useCallback((id: string) => {
    setSheet((s) => ({ ...s, open: false }));
    fetch(`/api/transactions/${id}`)
      .then((r) => r.json())
      .then((updated: TransactionRow) =>
        setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      )
      .catch(() => fetchTransactions());
  }, [fetchTransactions]);

  const handleDeleted = useCallback((id: string) => {
    setSheet((s) => ({ ...s, open: false }));
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleCreated = useCallback(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const flipSign = useCallback((row: TransactionRow) => {
    const newAmount = String(-parseFloat(row.amount));
    setTransactions((prev) =>
      prev.map((t) => t.id === row.id ? { ...t, amount: newAmount } : t)
    );
    fetch(`/api/transactions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate: row.transactionDate,
        accountingDate:  row.accountingDate,
        accountId:       row.accountId,
        coaCode:         row.coaCode,
        amount:          newAmount,
        currency:        row.currency,
        recipient:       row.recipient,
        notes:           row.notes,
      }),
    }).catch(() => {
      setTransactions((prev) =>
        prev.map((t) => t.id === row.id ? { ...t, amount: row.amount } : t)
      );
    });
  }, []);

  // ── Filter options (derived from raw data) ────────────────────────────────
  const accountOptions = useMemo(() =>
    Array.from(new Set(transactions.map((t) => t.accountName).filter(Boolean) as string[]))
      .sort()
      .map((name) => ({ value: name, label: name })),
    [transactions]
  );

  const coaOptions = useMemo(() => {
    const seen = new Map<string, string>();
    transactions.forEach((t) => {
      if (t.coaCode && !seen.has(t.coaCode)) seen.set(t.coaCode, t.coaName ?? t.coaCode);
    });
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, name]) => ({ value: code, label: `${code} – ${name}` }));
  }, [transactions]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterAccounts.length && !filterAccounts.includes(t.accountName ?? "")) return false;
      if (filterCoa.length      && !filterCoa.includes(t.coaCode ?? ""))           return false;
      if (filterRecipient && !t.recipient?.toLowerCase().includes(filterRecipient.toLowerCase())) return false;
      const txDate  = toISO(t.transactionDate);
      if (txFrom && txDate < txFrom) return false;
      if (txTo   && txDate > txTo)   return false;
      if (accMonth) {
        const acM = toISO(t.accountingDate).slice(0, 7);
        if (!acM || acM !== accMonth) return false;
      }
      if (filterOrphans       && !(TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId)) return false;
      if (filterOrphanAssets  && !(ASSET_COA_CODES.has(t.coaCode ?? "") && !t.assetId))  return false;
      if (filterUncategorized && !!t.coaCode) return false;
      return true;
    });
  }, [transactions, filterAccounts, filterCoa, filterRecipient, txFrom, txTo, accMonth, filterOrphans, filterOrphanAssets, filterUncategorized]);

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const t of filtered) {
      const v = parseFloat(t.amount ?? "0");
      if (v >= 0) totalIn += v; else totalOut += v;
    }
    return { totalIn, totalOut, net: totalIn + totalOut };
  }, [filtered]);

  const orphanCount = useMemo(
    () => transactions.filter((t) => TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId).length,
    [transactions]
  );

  const orphanAssetCount = useMemo(
    () => transactions.filter((t) => ASSET_COA_CODES.has(t.coaCode ?? "") && !t.assetId).length,
    [transactions]
  );

  const uncategorizedCount = useMemo(
    () => transactions.filter((t) => !t.coaCode).length,
    [transactions]
  );

  const uncategorizedTransactions = useMemo(
    () => transactions.filter((t) => !t.coaCode),
    [transactions]
  );

  const anyFilter =
    filterAccounts.length > 0 || filterCoa.length > 0 ||
    !!filterRecipient || !!txFrom || !!txTo || !!accMonth ||
    filterOrphans || filterOrphanAssets || filterUncategorized;

  const clearAll = useCallback(() => {
    const defFrom = daysAgo(30);
    const defTo   = today();
    setDraftFilterAccounts([]);
    setDraftFilterCoa([]);
    setDraftFilterRecipient("");
    setDraftTxFrom(defFrom); setDraftTxTo(defTo);
    setDraftAccMonth("");
    setFilterAccounts([]);
    setFilterCoa([]);
    setFilterRecipient("");
    setTxFrom(defFrom); setTxTo(defTo);
    setAccMonth("");
    setFilterOrphans(false);
    setFilterOrphanAssets(false);
    setFilterUncategorized(false);
  }, []);

  const toggleAccount = useCallback((v: string) =>
    setDraftFilterAccounts((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);
  const toggleCoa = useCallback((v: string) =>
    setDraftFilterCoa((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);

  const applyFilters = useCallback(() => {
    setFilterAccounts(draftFilterAccounts);
    setFilterCoa(draftFilterCoa);
    setFilterRecipient(draftFilterRecipient);
    setTxFrom(draftTxFrom);
    setTxTo(draftTxTo);
    setAccMonth(draftAccMonth);
  }, [draftFilterAccounts, draftFilterCoa, draftFilterRecipient, draftTxFrom, draftTxTo, draftAccMonth]);

  const isDirty =
    draftTxFrom !== txFrom ||
    draftTxTo !== txTo ||
    draftAccMonth !== accMonth ||
    JSON.stringify(draftFilterAccounts) !== JSON.stringify(filterAccounts) ||
    JSON.stringify(draftFilterCoa) !== JSON.stringify(filterCoa) ||
    draftFilterRecipient !== filterRecipient;

  // ── Bulk edit handlers ────────────────────────────────────────────────────
  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkApply = useCallback(async (
    data: { coaCode?: string | null; accountingDate?: string | null }
  ) => {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), ...data }),
    });
    fetchTransactions();
    setSelectedIds(new Set());
  }, [selectedIds, fetchTransactions]);

  // ── Header checkbox ref (indeterminate state) ─────────────────────────────
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    const n = filtered.filter((t) => selectedIds.has(t.id)).length;
    el.checked       = n === filtered.length && filtered.length > 0;
    el.indeterminate = n > 0 && n < filtered.length;
  }, [selectedIds, filtered]);

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: "transactionDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatDate(row.getValue("transactionDate"))}
          </span>
        ),
      },
      {
        accessorKey: "accountName",
        header: "Account",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("accountName") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const val      = parseFloat(row.getValue("amount") ?? "0");
          const currency = row.original.currency ?? "BRL";
          const color    = val >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400";
          return (
            <div className="flex items-center gap-1">
              <span className={`tabular-nums font-medium ${color}`}>
                {val.toLocaleString("pt-BR", { style: "currency", currency })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); flipSign(row.original); }}
                title={val >= 0 ? "Mark as expense (negative)" : "Mark as income (positive)"}
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        id: "recipient",
        header: "Recipient",
        cell: ({ row }) => {
          const t = row.original;
          const directLinked = !!t.recipientId;
          const aliasLinked  = !directLinked && !!t.aliasRecipientId;
          return (
            <div className="flex flex-col gap-0.5 group/rec">
              <div className="flex items-center gap-1">
                <span className={directLinked ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {directLinked ? (t.linkedRecipientName ?? t.recipient ?? "—") : (t.recipient ?? "—")}
                </span>
                <button
                  title={directLinked ? "Change linked recipient" : "Link to recipient"}
                  className={`transition-opacity text-muted-foreground hover:text-foreground ${
                    directLinked ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover/rec:opacity-60 hover:!opacity-100"
                  }`}
                  onClick={(e) => { e.stopPropagation(); setLinkRecipientDialog({ open: true, transaction: t }); }}
                >
                  <UserRound className="h-3.5 w-3.5" />
                </button>
              </div>
              {aliasLinked && (
                <span className="text-[10px] text-primary/80 leading-none">
                  {t.aliasRecipientName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "coaName",
        header: "COA Account",
        cell: ({ row }) => {
          const t = row.original;
          if (!t.coaCode) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm">
              <span className="font-mono text-xs text-muted-foreground mr-1">{t.coaCode}</span>
              {t.coaName}
            </span>
          );
        },
      },
      {
        accessorKey: "accountingDate",
        header: "Accounting Date",
        cell: ({ row }) => {
          const v = row.getValue("accountingDate") as string | null | undefined;
          if (!v) return <span className="text-muted-foreground">—</span>;
          const [year, month] = v.slice(0, 10).split("-");
          return (
            <span className="tabular-nums text-sm text-muted-foreground">
              {month}/{year}
            </span>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.getValue("notes") ?? "—"}</span>
        ),
      },
      {
        id: "transfer",
        header: "",
        cell: ({ row }) => {
          const t = row.original;
          if (!TRANSFER_CODES.has(t.coaCode ?? "")) return null;
          if (t.transferId) {
            return (
              <button
                title="Linked transfer — click to unlink"
                className="text-green-600 hover:text-green-700 transition-colors"
                onClick={(e) => { e.stopPropagation(); setUnlinkDialog({ open: true, transaction: t }); }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            );
          }
          return (
            <button
              title="Orphan transfer — click to link"
              className="text-amber-500 hover:text-amber-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLinkDialog({ open: true, transaction: t }); }}
            >
              <Unlink2 className="h-3.5 w-3.5" />
            </button>
          );
        },
      },
      {
        id: "asset",
        header: "",
        cell: ({ row }) => {
          const t = row.original;
          if (!ASSET_COA_CODES.has(t.coaCode ?? "")) return null;
          if (t.assetId) {
            return (
              <span title={t.assetName ?? "Asset linked"} className="text-green-600">
                <Package className="h-3.5 w-3.5" />
              </span>
            );
          }
          return (
            <button
              title="Orphan asset — click to edit and link"
              className="text-amber-500 hover:text-amber-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); openEdit(t); }}
            >
              <PackageOpen className="h-3.5 w-3.5" />
            </button>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [openEdit, flipSign, setLinkDialog, setUnlinkDialog, setLinkRecipientDialog]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {loading ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="rounded-md border">
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Recipient search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search recipient…"
            value={draftFilterRecipient}
            onChange={(e) => setDraftFilterRecipient(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-8 h-8 text-sm"
          />
          {draftFilterRecipient && (
            <button
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              onClick={() => setDraftFilterRecipient("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Account multi-select */}
        <MultiFilter
          label="Account"
          options={accountOptions}
          selected={draftFilterAccounts}
          onToggle={toggleAccount}
          onClear={() => setDraftFilterAccounts([])}
        />

        {/* COA multi-select */}
        <MultiFilter
          label="COA"
          options={coaOptions}
          selected={draftFilterCoa}
          onToggle={toggleCoa}
          onClear={() => setDraftFilterCoa([])}
        />

        {/* Transaction date range */}
        <DateRangeFilter
          label="Tx Period"
          from={draftTxFrom}
          to={draftTxTo}
          onFrom={setDraftTxFrom}
          onTo={setDraftTxTo}
          onClear={() => { setDraftTxFrom(""); setDraftTxTo(""); }}
        />

        {/* Accounting month */}
        <MonthFilter
          label="Acc Month"
          value={draftAccMonth}
          onChange={setDraftAccMonth}
          onClear={() => setDraftAccMonth("")}
        />

        {/* Apply filters */}
        <Button
          variant={isDirty ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={applyFilters}
        >
          Apply
        </Button>

        {/* Uncategorized toggle */}
        <Button
          variant={filterUncategorized ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs font-normal"
          onClick={() => setFilterUncategorized((v) => !v)}
        >
          Uncategorized
          {uncategorizedCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground leading-4">
              {uncategorizedCount}
            </span>
          )}
        </Button>

        {/* Suggest categories */}
        {uncategorizedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-normal"
            onClick={() => setSuggestSheet(true)}
          >
            <Sparkles className="h-3 w-3" />
            Suggest
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground leading-4">
              {uncategorizedCount}
            </span>
          </Button>
        )}

        {/* Orphan transfers toggle */}
        <Button
          variant={filterOrphans ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs font-normal"
          onClick={() => setFilterOrphans((v) => !v)}
        >
          <Unlink2 className="h-3 w-3" />
          Orphan transfers
          {orphanCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 leading-4">
              {orphanCount}
            </span>
          )}
        </Button>

        {/* Orphan assets toggle */}
        <Button
          variant={filterOrphanAssets ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs font-normal"
          onClick={() => setFilterOrphanAssets((v) => !v)}
        >
          <PackageOpen className="h-3 w-3" />
          Orphan assets
          {orphanAssetCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 leading-4">
              {orphanAssetCount}
            </span>
          )}
        </Button>

        {/* Clear all */}
        {anyFilter && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}

        {/* Row count */}
        {anyFilter && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} / {transactions.length}
          </span>
        )}

        {/* New transaction */}
        <Button variant="success" size="sm" onClick={openCreate} className={anyFilter ? "" : "ml-auto"}>
          <Plus className="h-4 w-4 mr-1" />
          New Transaction
        </Button>
      </div>

      {/* ── Bulk edit bar ────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <BulkEditBar
          selectedCount={selectedIds.size}
          coaOptions={allCoaOptions}
          onApply={handleBulkApply}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-md border overflow-auto max-h-[calc(100svh-16rem)]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="pr-0 w-10">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? new Set(filtered.map((t) => t.id)) : new Set()
                      )
                    }
                    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                  />
                </TableHead>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <MemoRow
                  key={row.id}
                  row={row}
                  isSelected={selectedIds.has(row.original.id)}
                  onToggle={toggleRow}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  {anyFilter ? "No transactions match the current filters." : "No transactions yet. Add one to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Totals ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-6 px-3 py-2 text-sm tabular-nums">
          <span className="text-muted-foreground">
            In{" "}
            <span className="font-medium text-green-700 dark:text-green-400">
              {totals.totalIn.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </span>
          <span className="text-muted-foreground">
            Out{" "}
            <span className="font-medium text-red-600 dark:text-red-400">
              {totals.totalOut.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </span>
          <span className="text-muted-foreground">
            Net{" "}
            <span className={`font-medium ${totals.net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totals.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </span>
        </div>
      )}
        </>
      )}

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.mode === "create" ? "New Transaction" : "Edit Transaction"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <TransactionForm
              key={sheet.mode === "edit" ? sheet.transaction?.id : "create"}
              transaction={sheet.transaction}
              onSuccess={handleFormSuccess}
              onCreated={handleCreated}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Link transfer dialog ──────────────────────────────────────────── */}
      {linkDialog.transaction && (
        <LinkTransferDialog
          open={linkDialog.open}
          onOpenChange={(open) => setLinkDialog((s) => ({ ...s, open }))}
          transaction={linkDialog.transaction}
          candidates={transactions.filter(
            (t) =>
              TRANSFER_CODES.has(t.coaCode ?? "") &&
              !t.transferId &&
              t.id !== linkDialog.transaction!.id
          )}
          onLinked={(transferId) => {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === linkDialog.transaction!.id || t.id === transactions.find(
                  (x) => TRANSFER_CODES.has(x.coaCode ?? "") && !x.transferId && x.id !== linkDialog.transaction!.id
                )?.id
                  ? { ...t, transferId }
                  : t
              )
            );
            fetchTransactions();
          }}
        />
      )}

      {/* ── Link recipient dialog ─────────────────────────────────────────── */}
      {linkRecipientDialog.transaction && (
        <LinkRecipientDialog
          open={linkRecipientDialog.open}
          onOpenChange={(open) => setLinkRecipientDialog((s) => ({ ...s, open }))}
          transaction={linkRecipientDialog.transaction}
          allRecipients={allRecipients}
          onLinked={(recipientId, recipientName) => {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === linkRecipientDialog.transaction!.id
                  ? { ...t, recipientId, linkedRecipientName: recipientName }
                  : t
              )
            );
          }}
        />
      )}

      {/* ── Suggest categories sheet ─────────────────────────────────────── */}
      <SuggestCategoriesSheet
        open={suggestSheet}
        onOpenChange={setSuggestSheet}
        uncategorized={uncategorizedTransactions}
        allRecipients={allRecipients}
        onApplied={fetchTransactions}
      />

      {/* ── Unlink transfer dialog ────────────────────────────────────────── */}
      {unlinkDialog.transaction && (
        <UnlinkTransferDialog
          open={unlinkDialog.open}
          onOpenChange={(open) => setUnlinkDialog((s) => ({ ...s, open }))}
          transaction={unlinkDialog.transaction}
          partner={transactions.find(
            (t) =>
              t.transferId === unlinkDialog.transaction!.transferId &&
              t.id !== unlinkDialog.transaction!.id
          )}
          onUnlinked={() => {
            const tid = unlinkDialog.transaction!.transferId;
            setTransactions((prev) =>
              prev.map((t) => (t.transferId === tid ? { ...t, transferId: null } : t))
            );
          }}
        />
      )}
    </>
  );
}
