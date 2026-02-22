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
import { AccountForm } from "@/components/account-form";
import { type FinancialAccount, type FinancialAccountType } from "@/lib/db/schema";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<FinancialAccountType, string> = {
  savings:     "Savings",
  checking:    "Checking",
  credit_card: "Credit Card",
  investment:  "Investment",
  other:       "Other",
};

const TYPE_BADGE: Record<FinancialAccountType, string> = {
  savings:     "bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400",
  checking:    "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
  credit_card: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  investment:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  other:       "bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300",
};

// ---------------------------------------------------------------------------
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  account?: FinancialAccount;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountTable() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create" });

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: FinancialAccount[]) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit = useCallback(
    (account: FinancialAccount) => setSheet({ open: true, mode: "edit", account }),
    []
  );

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchAccounts();
  }, [fetchAccounts]);

  const columns = useMemo<ColumnDef<FinancialAccount>[]>(
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
          const t = row.getValue("type") as FinancialAccountType;
          return (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[t]}`}>
              {TYPE_LABELS[t]}
            </span>
          );
        },
      },
      {
        accessorKey: "institution",
        header: "Institution",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("institution") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "owner",
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("owner") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "accountNumber",
        header: "Number",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue("accountNumber") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "openingBalance",
        header: "Opening Balance",
        cell: ({ row }) => {
          const val = parseFloat(row.getValue("openingBalance") ?? "0");
          return (
            <span className="tabular-nums">
              {val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) =>
          row.getValue("isActive") ? (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Inactive
            </span>
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
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-32" />
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
          New Account
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No accounts yet. Create one to get started.
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
              {sheet.mode === "create" ? "New Account" : "Edit Account"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <AccountForm
              key={sheet.mode === "edit" ? sheet.account?.id : "create"}
              account={sheet.account}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
