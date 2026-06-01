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
import { RecurringForm } from "@/components/recurring-form";
import type { RecurringTransaction } from "@/lib/db/schema";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  record?: RecurringTransaction;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecurringTable() {
  const [records, setRecords] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet,   setSheet]   = useState<SheetState>({ open: false, mode: "create" });

  const fetchRecords = useCallback(() => {
    setLoading(true);
    fetch("/api/recurring")
      .then((r) => r.json())
      .then((data: RecurringTransaction[]) => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback((r: RecurringTransaction) => setSheet({ open: true, mode: "edit", record: r }), []);
  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchRecords();
  }, [fetchRecords]);

  const columns = useMemo<ColumnDef<RecurringTransaction>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name")}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const t = row.getValue<string>("type");
          return (
            <span
              className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                t === "income"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {t}
            </span>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const val = parseFloat(row.getValue("amount") ?? "0");
          const t   = row.original.type;
          return (
            <span
              className={`tabular-nums font-medium ${
                t === "income"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {t === "expense" ? "–" : "+"}
              {fmt.format(val)}
            </span>
          );
        },
      },
      {
        accessorKey: "accountId",
        header: "Account",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
            {row.getValue("accountId")}
          </span>
        ),
      },
      {
        accessorKey: "coaCode",
        header: "COA",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue("coaCode") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "dayOfMonth",
        header: "Day",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.getValue("dayOfMonth")}</span>
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

  if (loading) {
    return (
      <div className="space-y-3">
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
      <div className="flex items-center justify-end">
        <Button variant="success" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Recurring
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
                  No recurring transactions yet. Add one to get started.
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
              {sheet.mode === "create" ? "Add Recurring Transaction" : "Edit Recurring Transaction"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <RecurringForm
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
