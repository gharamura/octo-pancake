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
import { CoaForm } from "@/components/coa-form";
import { type CoaAccount, type AccountType } from "@/lib/db/schema";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type CoaRow = CoaAccount & { depth: number };

const TYPES: AccountType[] = ["income", "expense", "asset", "liability", "equity"];

const TYPE_STYLES: Record<AccountType, { badge: string; pillActive: string; pillInactive: string }> = {
  income: {
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pillActive: "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300",
    pillInactive: "border-green-300 text-green-700 opacity-40 hover:opacity-70 dark:border-green-700 dark:text-green-500",
  },
  expense: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pillActive: "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300",
    pillInactive: "border-red-300 text-red-700 opacity-40 hover:opacity-70 dark:border-red-700 dark:text-red-500",
  },
  asset: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    pillActive: "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300",
    pillInactive: "border-blue-300 text-blue-700 opacity-40 hover:opacity-70 dark:border-blue-700 dark:text-blue-500",
  },
  liability: {
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    pillActive: "bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300",
    pillInactive: "border-orange-300 text-orange-700 opacity-40 hover:opacity-70 dark:border-orange-700 dark:text-orange-500",
  },
  equity: {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    pillActive: "bg-purple-100 border-purple-400 text-purple-800 dark:bg-purple-900/40 dark:border-purple-600 dark:text-purple-300",
    pillInactive: "border-purple-300 text-purple-700 opacity-40 hover:opacity-70 dark:border-purple-700 dark:text-purple-500",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDepthMap(accounts: CoaAccount[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of accounts) {
    map.set(a.code, a.parentCode ? (map.get(a.parentCode) ?? 0) + 1 : 0);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  account?: CoaAccount;
}

export function CoaTable() {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<AccountType[]>(TYPES);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create" });

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    fetch("/api/coa")
      .then((r) => r.json())
      .then((data: CoaAccount[]) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreate = useCallback(() => {
    setSheet({ open: true, mode: "create" });
  }, []);

  const openEdit = useCallback((account: CoaAccount) => {
    setSheet({ open: true, mode: "edit", account });
  }, []);

  const closeSheet = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
  }, []);

  const handleFormSuccess = useCallback(() => {
    closeSheet();
    fetchAccounts();
  }, [closeSheet, fetchAccounts]);

  const columns = useMemo<ColumnDef<CoaRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue("code")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const depth = row.original.depth;
          const name: string = row.getValue("name");
          return (
            <span style={{ paddingLeft: `${depth * 1.25}rem` }}>
              {depth === 0 ? <strong>{name}</strong> : name}
            </span>
          );
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = row.getValue("type") as AccountType;
          const styles = TYPE_STYLES[type];
          return (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
              {type}
            </span>
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
    [openEdit]
  );

  const data = useMemo<CoaRow[]>(() => {
    const depthMap = buildDepthMap(accounts);
    const rows = accounts.map((a) => ({ ...a, depth: depthMap.get(a.code) ?? 0 }));
    if (selectedTypes.length === 0 || selectedTypes.length === TYPES.length) return rows;
    return rows.filter((r) => selectedTypes.includes(r.type as AccountType));
  }, [accounts, selectedTypes]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function toggleType(type: AccountType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function soloType(type: AccountType) {
    setSelectedTypes([type]);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {TYPES.map((t) => <Skeleton key={t} className="h-7 w-20 rounded-full" />)}
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
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
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((type) => {
            const active = selectedTypes.includes(type);
            const styles = TYPE_STYLES[type];
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                onDoubleClick={(e) => { e.preventDefault(); soloType(type); }}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all cursor-pointer ${active ? styles.pillActive : styles.pillInactive}`}
              >
                {type}
              </button>
            );
          })}
        </div>

        <Button variant="success" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Account
        </Button>
      </div>

      {/* Data table */}
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
                  No accounts match the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit sheet */}
      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.mode === "create" ? "New Account" : "Edit Account"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <CoaForm
              key={sheet.mode === "edit" ? sheet.account?.code : "create"}
              account={sheet.account}
              accounts={accounts}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
