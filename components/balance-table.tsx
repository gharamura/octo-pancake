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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BalanceForm, type BalanceRow } from "@/components/balance-form";
import { ChevronDown, ListFilter, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.slice(0, 10);
  const [year, month, day] = s.split("-");
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Filter header (same pattern as account-table)
// ---------------------------------------------------------------------------

function FilterHeader({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const active = selected.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors">
          {label}
          {active
            ? <ListFilter className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-40" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selected.includes(opt)}
            onCheckedChange={() => onToggle(opt)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt}
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
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  record?: BalanceRow;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceTable() {
  const [records,  setRecords]  = useState<BalanceRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sheet,    setSheet]    = useState<SheetState>({ open: false, mode: "create" });
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    fetch("/api/balances")
      .then((r) => r.json())
      .then((data: BalanceRow[]) => {
        setRecords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Account filter options (names of accounts that appear in data)
  const accountOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.accountName).filter(Boolean) as string[])).sort(),
    [records]
  );

  const toggleAccount = useCallback((a: string) =>
    setSelectedAccounts((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]), []);
  const clearAccounts = useCallback(() => setSelectedAccounts([]), []);

  const filteredRecords = useMemo(() => {
    if (!selectedAccounts.length) return records;
    return records.filter((r) => r.accountName && selectedAccounts.includes(r.accountName));
  }, [records, selectedAccounts]);

  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback(
    (r: BalanceRow) => setSheet({ open: true, mode: "edit", record: r }),
    []
  );

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchRecords();
  }, [fetchRecords]);

  const columns = useMemo<ColumnDef<BalanceRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{formatDate(row.getValue("date"))}</span>
        ),
      },
      {
        accessorKey: "accountName",
        header: () => (
          <FilterHeader
            label="Account"
            options={accountOptions}
            selected={selectedAccounts}
            onToggle={toggleAccount}
            onClear={clearAccounts}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("accountName") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => {
          const val = parseFloat(row.getValue("balance") ?? "0");
          const color = val >= 0
            ? "text-green-700 dark:text-green-400"
            : "text-red-600 dark:text-red-400";
          return (
            <span className={`tabular-nums font-medium ${color}`}>
              {val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
    [openEdit, accountOptions, selectedAccounts, toggleAccount, clearAccounts]
  );

  const table = useReactTable({
    data: filteredRecords,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
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
      <div className="flex justify-end">
        <Button variant="success" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Balance
        </Button>
      </div>

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
                  No balance records yet. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.mode === "create" ? "Add Balance" : "Edit Balance"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <BalanceForm
              key={sheet.mode === "edit" ? sheet.record?.id : "create"}
              record={sheet.record}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
