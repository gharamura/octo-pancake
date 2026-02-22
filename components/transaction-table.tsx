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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionForm, type TransactionRow } from "@/components/transaction-form";
import { ArrowUpDown, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Avoid timezone shift: parse YYYY-MM-DD directly
  const s = value.slice(0, 10);
  const [year, month, day] = s.split("-");
  return `${day}/${month}/${year}`;
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
    // Optimistic update
    setTransactions((prev) =>
      prev.map((t) => t.id === row.id ? { ...t, amount: newAmount } : t)
    );
    fetch(`/api/transactions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate:  row.transactionDate,
        accountingDate:   row.accountingDate,
        accountId:        row.accountId,
        coaCode:          row.coaCode,
        amount:           newAmount,
        currency:         row.currency,
        recipient:        row.recipient,
        notes:            row.notes,
      }),
    }).catch(() => {
      // Revert on failure
      setTransactions((prev) =>
        prev.map((t) => t.id === row.id ? { ...t, amount: row.amount } : t)
      );
    });
  }, []);

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
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatDate(row.getValue("accountingDate"))}
          </span>
        ),
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
    [openEdit, flipSign]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
      <div className="flex justify-end">
        <Button variant="success" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Transaction
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
                  No transactions yet. Add one to get started.
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
    </>
  );
}
