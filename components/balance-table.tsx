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
import { type FinancialAccount } from "@/lib/db/schema";
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
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
  // All accounts (for the multi-select)
  const [allAccounts,      setAllAccounts]      = useState<FinancialAccount[]>([]);
  const [accountsLoading,  setAccountsLoading]  = useState(true);

  // Filters — initialized after accounts load
  const [selectedIds,  setSelectedIds]  = useState<string[]>([]);
  const [from,         setFrom]         = useState(daysAgo(30));
  const [to,           setTo]           = useState(today());

  // Table data
  const [records,  setRecords]  = useState<BalanceRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [sheet,    setSheet]    = useState<SheetState>({ open: false, mode: "create" });

  // Fetch all accounts on mount and default-select checking ones
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: FinancialAccount[]) => {
        setAllAccounts(data);
        const checking = data.filter((a) => a.type === "checking").map((a) => a.id);
        setSelectedIds(checking.length ? checking : data.map((a) => a.id));
        setAccountsLoading(false);
      })
      .catch(() => setAccountsLoading(false));
  }, []);

  // Fetch records whenever filters change (skip until accounts are loaded)
  const fetchRecords = useCallback(() => {
    if (accountsLoading) return;
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (selectedIds.length) params.set("accountIds", selectedIds.join(","));
    fetch(`/api/balances?${params}`)
      .then((r) => r.json())
      .then((data: BalanceRow[]) => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to, selectedIds, accountsLoading]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Account multi-select helpers
  const toggleAccount = useCallback((id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]), []);

  const selectAll  = useCallback(() => setSelectedIds(allAccounts.map((a) => a.id)), [allAccounts]);
  const clearAll   = useCallback(() => setSelectedIds([]), []);

  const accountLabel = useMemo(() => {
    if (!selectedIds.length) return "No accounts";
    if (selectedIds.length === allAccounts.length) return "All accounts";
    if (selectedIds.length === 1) {
      return allAccounts.find((a) => a.id === selectedIds[0])?.name ?? "1 account";
    }
    return `${selectedIds.length} accounts`;
  }, [selectedIds, allAccounts]);

  const isFiltered = selectedIds.length > 0 && selectedIds.length < allAccounts.length;

  // Sheet
  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback((r: BalanceRow) => setSheet({ open: true, mode: "edit", record: r }), []);
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
        header: "Account",
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
    [openEdit]
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (accountsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
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
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Account multi-select */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Accounts</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
                <span className="truncate">{accountLabel}</span>
                {isFiltered
                  ? <ListFilter className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />
                  : <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-72 overflow-y-auto">
              {allAccounts.map((account) => (
                <DropdownMenuCheckboxItem
                  key={account.id}
                  checked={selectedIds.includes(account.id)}
                  onCheckedChange={() => toggleAccount(account.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="flex flex-col">
                    <span>{account.name}</span>
                    {account.type && (
                      <span className="text-[11px] text-muted-foreground capitalize">{account.type.replace(/_/g, " ")}</span>
                    )}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex gap-1 px-2 py-1">
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={selectAll}>All</Button>
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={clearAll}>None</Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label htmlFor="bal-from" className="text-xs text-muted-foreground">From</Label>
          <Input
            id="bal-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-36 h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bal-to" className="text-xs text-muted-foreground">To</Label>
          <Input
            id="bal-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-36 h-9"
          />
        </div>

        <div className="ml-auto">
          <Button variant="success" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Balance
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-md border">
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ) : (
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
                    No balance records for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

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
