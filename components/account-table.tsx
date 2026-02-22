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
// Pill helper
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  active,
  className,
  onClick,
  onDoubleClick,
}: {
  label: string;
  active: boolean;
  className?: string;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={[
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity select-none",
        active ? "" : "opacity-30",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<FinancialAccountType, string> = {
  savings:     "Savings",
  checking:    "Checking",
  credit_card: "Credit Card",
  investment:  "Investment",
  benefits:    "Benefits",
  other:       "Other",
};

const TYPE_BADGE: Record<FinancialAccountType, string> = {
  savings:     "bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400",
  checking:    "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
  credit_card: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  investment:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  benefits:    "bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-400",
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
  const [selectedTypes, setSelectedTypes] = useState<FinancialAccountType[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.owner).filter(Boolean) as string[])).sort(),
    [accounts]
  );

  const institutionOptions = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.institution).filter(Boolean) as string[])).sort(),
    [accounts]
  );

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

  const toggleType = useCallback((t: FinancialAccountType) =>
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]), []);
  const soloType = useCallback((t: FinancialAccountType) => setSelectedTypes([t]), []);

  const toggleOwner = useCallback((o: string) =>
    setSelectedOwners((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]), []);
  const soloOwner = useCallback((o: string) => setSelectedOwners([o]), []);

  const toggleInstitution = useCallback((i: string) =>
    setSelectedInstitutions((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]), []);
  const soloInstitution = useCallback((i: string) => setSelectedInstitutions([i]), []);

  const filteredAccounts = useMemo(() => {
    let data = accounts;
    if (selectedTypes.length)        data = data.filter((a) => selectedTypes.includes(a.type));
    if (selectedOwners.length)       data = data.filter((a) => a.owner && selectedOwners.includes(a.owner));
    if (selectedInstitutions.length) data = data.filter((a) => a.institution && selectedInstitutions.includes(a.institution));
    return data;
  }, [accounts, selectedTypes, selectedOwners, selectedInstitutions]);

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
    data: filteredAccounts,
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(TYPE_LABELS) as FinancialAccountType[]).map((t) => (
              <FilterPill
                key={t}
                label={TYPE_LABELS[t]}
                active={selectedTypes.length === 0 || selectedTypes.includes(t)}
                className={TYPE_BADGE[t]}
                onClick={() => toggleType(t)}
                onDoubleClick={() => soloType(t)}
              />
            ))}
          </div>

          {/* Owner filters */}
          {ownerOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {ownerOptions.map((o) => (
                <FilterPill
                  key={o}
                  label={o}
                  active={selectedOwners.length === 0 || selectedOwners.includes(o)}
                  className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  onClick={() => toggleOwner(o)}
                  onDoubleClick={() => soloOwner(o)}
                />
              ))}
            </div>
          )}

          {/* Institution filters */}
          {institutionOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {institutionOptions.map((i) => (
                <FilterPill
                  key={i}
                  label={i}
                  active={selectedInstitutions.length === 0 || selectedInstitutions.includes(i)}
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  onClick={() => toggleInstitution(i)}
                  onDoubleClick={() => soloInstitution(i)}
                />
              ))}
            </div>
          )}
        </div>

        <Button variant="success" size="sm" onClick={openCreate} className="shrink-0">
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
