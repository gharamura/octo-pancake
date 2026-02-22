"use client";

import {
  type ColumnDef,
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
import { TransactionForm, type TransactionRow } from "@/components/transaction-form";
import { LinkTransferDialog, UnlinkTransferDialog } from "@/components/link-transfer-dialog";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Link2,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Unlink2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const TRANSFER_CODES = new Set(["3110", "3120"]);

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
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  transaction?: TransactionRow;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sheet, setSheet]               = useState<SheetState>({ open: false, mode: "create" });

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterAccounts,  setFilterAccounts]  = useState<string[]>([]);
  const [filterCoa,       setFilterCoa]       = useState<string[]>([]);
  const [filterRecipient, setFilterRecipient] = useState("");
  const [txFrom,  setTxFrom]  = useState("");
  const [txTo,    setTxTo]    = useState("");
  const [accFrom, setAccFrom] = useState("");
  const [accTo,   setAccTo]   = useState("");
  const [filterOrphans, setFilterOrphans] = useState(false);

  // ── Transfer dialog state ─────────────────────────────────────────────────
  const [linkDialog,   setLinkDialog]   = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });
  const [unlinkDialog, setUnlinkDialog] = useState<{ open: boolean; transaction: TransactionRow | null }>({ open: false, transaction: null });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(() => {
    setLoading(true);
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((data: TransactionRow[]) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  const handleCreated = useCallback(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((data: TransactionRow[]) => setTransactions(data))
      .catch(() => {});
  }, []);

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
      const acDate = toISO(t.accountingDate);
      if (accFrom && (!acDate || acDate < accFrom)) return false;
      if (accTo   && (!acDate || acDate > accTo))   return false;
      if (filterOrphans && !(TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId)) return false;
      return true;
    });
  }, [transactions, filterAccounts, filterCoa, filterRecipient, txFrom, txTo, accFrom, accTo, filterOrphans]);

  const orphanCount = useMemo(
    () => transactions.filter((t) => TRANSFER_CODES.has(t.coaCode ?? "") && !t.transferId).length,
    [transactions]
  );

  const anyFilter =
    filterAccounts.length > 0 || filterCoa.length > 0 ||
    !!filterRecipient || !!txFrom || !!txTo || !!accFrom || !!accTo || filterOrphans;

  const clearAll = useCallback(() => {
    setFilterAccounts([]);
    setFilterCoa([]);
    setFilterRecipient("");
    setTxFrom(""); setTxTo("");
    setAccFrom(""); setAccTo("");
    setFilterOrphans(false);
  }, []);

  const toggleAccount = useCallback((v: string) =>
    setFilterAccounts((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);
  const toggleCoa = useCallback((v: string) =>
    setFilterCoa((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]), []);

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
        accessorKey: "recipient",
        header: "Recipient",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("recipient") ?? "—"}</span>
        ),
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
    [openEdit, flipSign, setLinkDialog, setUnlinkDialog]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
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
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Recipient search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search recipient…"
            value={filterRecipient}
            onChange={(e) => setFilterRecipient(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {filterRecipient && (
            <button
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              onClick={() => setFilterRecipient("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Account multi-select */}
        <MultiFilter
          label="Account"
          options={accountOptions}
          selected={filterAccounts}
          onToggle={toggleAccount}
          onClear={() => setFilterAccounts([])}
        />

        {/* COA multi-select */}
        <MultiFilter
          label="COA"
          options={coaOptions}
          selected={filterCoa}
          onToggle={toggleCoa}
          onClear={() => setFilterCoa([])}
        />

        {/* Transaction date range */}
        <DateRangeFilter
          label="Tx Period"
          from={txFrom}
          to={txTo}
          onFrom={setTxFrom}
          onTo={setTxTo}
          onClear={() => { setTxFrom(""); setTxTo(""); }}
        />

        {/* Accounting date range */}
        <DateRangeFilter
          label="Acc Period"
          from={accFrom}
          to={accTo}
          onFrom={setAccFrom}
          onTo={setAccTo}
          onClear={() => { setAccFrom(""); setAccTo(""); }}
        />

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

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {anyFilter ? "No transactions match the current filters." : "No transactions yet. Add one to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
