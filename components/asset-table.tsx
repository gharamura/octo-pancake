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
import { AssetForm } from "@/components/asset-form";
import { type Asset, type AssetType } from "@/lib/db/schema";
import type { AssetWithAccount } from "@/lib/repositories/asset.repository";
import { ChevronDown, ListFilter, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Type labels & badges
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<AssetType, string> = {
  investment_fund: "Investment Fund",
  treasury_bonds:  "Treasury Bonds",
  cdb:             "CDB",
  corporate_bonds: "Corporate Bonds",
  etf:             "ETF",
  adr:             "ADR",
  reit:            "REIT",
  stocks:          "Stocks",
  coe:             "COE",
  crypto:          "Crypto",
  lca:             "LCA",
  pension:         "Pension",
  cri:             "CRI",
  cra:             "CRA",
  cash:            "Cash",
};

const TYPE_BADGE: Record<AssetType, string> = {
  investment_fund: "bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400",
  treasury_bonds:  "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
  cdb:             "bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-400",
  corporate_bonds: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  etf:             "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  adr:             "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  reit:            "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  stocks:          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  coe:             "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400",
  crypto:          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  lca:             "bg-lime-100   text-lime-800   dark:bg-lime-900/30   dark:text-lime-400",
  pension:         "bg-cyan-100   text-cyan-800   dark:bg-cyan-900/30   dark:text-cyan-400",
  cri:             "bg-sky-100    text-sky-800    dark:bg-sky-900/30    dark:text-sky-400",
  cra:             "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cash:            "bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300",
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
  label:    string;
  options:  { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onClear:  () => void;
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
  open:  boolean;
  mode:  "create" | "edit";
  asset?: Asset;
}

// ---------------------------------------------------------------------------
// Expiration date formatting
// ---------------------------------------------------------------------------

function formatExpiration(val: unknown): string {
  if (!val) return "—";
  const s = String(val);
  const dateStr = s.includes("T") ? s.split("T")[0] : s;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetTable() {
  const [assetList,     setAssetList]     = useState<AssetWithAccount[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [sheet,         setSheet]         = useState<SheetState>({ open: false, mode: "create" });
  const [selectedTypes, setSelectedTypes] = useState<AssetType[]>([]);

  const fetchAssets = useCallback(() => {
    setLoading(true);
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data: AssetWithAccount[]) => {
        setAssetList(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const toggleType = useCallback((t: AssetType) =>
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]), []);
  const clearTypes = useCallback(() => setSelectedTypes([]), []);

  const filteredAssets = useMemo(() => {
    if (!selectedTypes.length) return assetList;
    return assetList.filter((a) => selectedTypes.includes(a.type));
  }, [assetList, selectedTypes]);

  const availableTypes = useMemo(() => new Set(assetList.map((a) => a.type)), [assetList]);

  const typeOptions = useMemo(
    () => (Object.keys(TYPE_LABELS) as AssetType[])
      .filter((v) => availableTypes.has(v))
      .map((v) => ({ value: v, label: TYPE_LABELS[v] })),
    [availableTypes]
  );

  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback((asset: Asset) => setSheet({ open: true, mode: "edit", asset }), []);

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchAssets();
  }, [fetchAssets]);

  const columns = useMemo<ColumnDef<AssetWithAccount>[]>(
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
          const t = row.getValue("type") as AssetType;
          return (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[t]}`}>
              {TYPE_LABELS[t]}
            </span>
          );
        },
      },
      {
        accessorKey: "accountName",
        header: "Account",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("accountName") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "custodian",
        header: "Custodian",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.getValue("custodian") ?? "—"}</span>
        ),
      },
      {
        id: "currency_country",
        header: "Currency / Country",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">
            {row.original.currency} / {row.original.country}
          </span>
        ),
      },
      {
        accessorKey: "expirationDate",
        header: "Expiration",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatExpiration(row.getValue("expirationDate"))}
          </span>
        ),
      },
      {
        accessorKey: "rule",
        header: "Rule",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.getValue("rule") ?? "—"}</span>
        ),
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
    [openEdit, typeOptions, selectedTypes, toggleType, clearTypes]
  );

  const table = useReactTable({
    data: filteredAssets,
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
          New Asset
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
                  No assets yet. Create one to get started.
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
              {sheet.mode === "create" ? "New Asset" : "Edit Asset"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <AssetForm
              key={sheet.mode === "edit" ? sheet.asset?.id : "create"}
              asset={sheet.asset}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
