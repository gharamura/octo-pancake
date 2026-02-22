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
import { AccountForm } from "@/components/account-form";
import { type FinancialAccount, type FinancialAccountType } from "@/lib/db/schema";
import { ChevronDown, ListFilter, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
// Filter header
// ---------------------------------------------------------------------------

function FilterHeader<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
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
      <DropdownMenuContent align="start" className="min-w-[160px]">
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

  // ---------------------------------------------------------------------------
  // Faceted filter options
  // Each filter's available options are derived from accounts that already
  // match the OTHER two active filters, so any selectable value is guaranteed
  // to produce at least one result.
  // ---------------------------------------------------------------------------

  const typeFilterBase = useMemo(() => {
    let data = accounts;
    if (selectedOwners.length)       data = data.filter((a) => a.owner && selectedOwners.includes(a.owner));
    if (selectedInstitutions.length) data = data.filter((a) => a.institution && selectedInstitutions.includes(a.institution));
    return data;
  }, [accounts, selectedOwners, selectedInstitutions]);

  const ownerFilterBase = useMemo(() => {
    let data = accounts;
    if (selectedTypes.length)        data = data.filter((a) => selectedTypes.includes(a.type));
    if (selectedInstitutions.length) data = data.filter((a) => a.institution && selectedInstitutions.includes(a.institution));
    return data;
  }, [accounts, selectedTypes, selectedInstitutions]);

  const institutionFilterBase = useMemo(() => {
    let data = accounts;
    if (selectedTypes.length)  data = data.filter((a) => selectedTypes.includes(a.type));
    if (selectedOwners.length) data = data.filter((a) => a.owner && selectedOwners.includes(a.owner));
    return data;
  }, [accounts, selectedTypes, selectedOwners]);

  const availableTypes        = useMemo(() => new Set(typeFilterBase.map((a) => a.type)), [typeFilterBase]);
  const availableOwners       = useMemo(() => Array.from(new Set(ownerFilterBase.map((a) => a.owner).filter(Boolean) as string[])).sort(), [ownerFilterBase]);
  const availableInstitutions = useMemo(() => Array.from(new Set(institutionFilterBase.map((a) => a.institution).filter(Boolean) as string[])).sort(), [institutionFilterBase]);

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
  const clearTypes = useCallback(() => setSelectedTypes([]), []);

  const toggleOwner = useCallback((o: string) =>
    setSelectedOwners((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]), []);
  const clearOwners = useCallback(() => setSelectedOwners([]), []);

  const toggleInstitution = useCallback((i: string) =>
    setSelectedInstitutions((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]), []);
  const clearInstitutions = useCallback(() => setSelectedInstitutions([]), []);

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

  const typeOptions = useMemo(
    () => (Object.keys(TYPE_LABELS) as FinancialAccountType[])
      .filter((v) => availableTypes.has(v))
      .map((v) => ({ value: v, label: TYPE_LABELS[v] })),
    [availableTypes]
  );

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
        header: () => (
          <FilterHeader
            label="Type"
            options={typeOptions}
            selected={selectedTypes}
            onToggle={toggleType}
            onClear={clearTypes}
          />
        ),
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
        header: () => (
          <FilterHeader
            label="Institution"
            options={availableInstitutions.map((v: string) => ({ value: v, label: v }))}
            selected={selectedInstitutions}
            onToggle={toggleInstitution}
            onClear={clearInstitutions}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("institution") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "owner",
        header: () => (
          <FilterHeader
            label="Owner"
            options={availableOwners.map((v: string) => ({ value: v, label: v }))}
            selected={selectedOwners}
            onToggle={toggleOwner}
            onClear={clearOwners}
          />
        ),
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
        accessorKey: "currency",
        header: "Currency",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">
            {row.getValue("currency")}
          </span>
        ),
      },
      {
        accessorKey: "openingBalance",
        header: "Opening Balance",
        cell: ({ row }) => {
          const val      = parseFloat(row.getValue("openingBalance") ?? "0");
          const currency = (row.original.currency ?? "BRL") as string;
          return (
            <span className="tabular-nums">
              {val.toLocaleString("pt-BR", { style: "currency", currency })}
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
    [openEdit, typeOptions, selectedTypes, toggleType, clearTypes, availableInstitutions, selectedInstitutions, toggleInstitution, clearInstitutions, availableOwners, selectedOwners, toggleOwner, clearOwners]
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
