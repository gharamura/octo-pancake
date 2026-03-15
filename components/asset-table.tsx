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
import { type Asset, type AssetClass, type AssetLiquidity } from "@/lib/db/schema";
import type { AssetWithAccount } from "@/lib/repositories/asset.repository";
import { ChevronDown, ListFilter, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Class labels & badges
// ---------------------------------------------------------------------------

const CLASS_LABELS: Record<AssetClass, string> = {
  cash_equivalents:            "Cash Equivalents",
  fixed_income:               "Fixed Income",
  fixed_income_private_credit: "FI – Private Credit",
  fixed_income_intl_bonds:    "FI – Intl Bonds",
  structured_products:        "Structured Products",
  equities:                   "Equities",
  real_estate_agro:           "Real Estate & Agro",
  private_equity:             "Private Equity",
  crypto:                     "Crypto",
  commodities:               "Commodities",
  hedge_funds:               "Hedge Funds",
  pension:                    "Pension",
};

const CLASS_BADGE: Record<AssetClass, string> = {
  cash_equivalents:            "bg-gray-100    text-gray-700   dark:bg-gray-800       dark:text-gray-300",
  fixed_income:               "bg-green-100   text-green-800  dark:bg-green-900/30   dark:text-green-400",
  fixed_income_private_credit: "bg-teal-100    text-teal-800   dark:bg-teal-900/30    dark:text-teal-400",
  fixed_income_intl_bonds:    "bg-cyan-100    text-cyan-800   dark:bg-cyan-900/30    dark:text-cyan-400",
  structured_products:        "bg-amber-100   text-amber-800  dark:bg-amber-900/30   dark:text-amber-400",
  equities:                   "bg-blue-100    text-blue-800   dark:bg-blue-900/30    dark:text-blue-400",
  real_estate_agro:           "bg-lime-100    text-lime-800   dark:bg-lime-900/30    dark:text-lime-400",
  private_equity:             "bg-violet-100  text-violet-800 dark:bg-violet-900/30  dark:text-violet-400",
  crypto:                     "bg-yellow-100  text-yellow-800 dark:bg-yellow-900/30  dark:text-yellow-400",
  commodities:               "bg-orange-100  text-orange-800 dark:bg-orange-900/30  dark:text-orange-400",
  hedge_funds:               "bg-indigo-100  text-indigo-800 dark:bg-indigo-900/30  dark:text-indigo-400",
  pension:                    "bg-pink-100    text-pink-800   dark:bg-pink-900/30    dark:text-pink-400",
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
  const [sheet,              setSheet]              = useState<SheetState>({ open: false, mode: "create" });
  const [selectedClasses,    setSelectedClasses]    = useState<AssetClass[]>([]);
  const [selectedLiquidities, setSelectedLiquidities] = useState<AssetLiquidity[]>([]);
  const [selectedAccounts,   setSelectedAccounts]   = useState<string[]>([]);

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

  const toggleClass     = useCallback((c: AssetClass) =>
    setSelectedClasses((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]), []);
  const clearClasses    = useCallback(() => setSelectedClasses([]), []);

  const toggleLiquidity = useCallback((l: AssetLiquidity) =>
    setSelectedLiquidities((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]), []);
  const clearLiquidities = useCallback(() => setSelectedLiquidities([]), []);

  const toggleAccount   = useCallback((a: string) =>
    setSelectedAccounts((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]), []);
  const clearAccounts   = useCallback(() => setSelectedAccounts([]), []);

  const filteredAssets = useMemo(() => {
    return assetList.filter((a) => {
      if (selectedClasses.length    && !(a.assetClass && selectedClasses.includes(a.assetClass)))       return false;
      if (selectedLiquidities.length && !(a.liquidity  && selectedLiquidities.includes(a.liquidity as AssetLiquidity))) return false;
      if (selectedAccounts.length   && !(a.accountName && selectedAccounts.includes(a.accountName)))    return false;
      return true;
    });
  }, [assetList, selectedClasses, selectedLiquidities, selectedAccounts]);

  const availableClasses = useMemo(() =>
    new Set(assetList.map((a) => a.assetClass).filter(Boolean) as AssetClass[]),
    [assetList]
  );

  const classOptions = useMemo(
    () => (Object.keys(CLASS_LABELS) as AssetClass[])
      .filter((v) => availableClasses.has(v))
      .map((v) => ({ value: v, label: CLASS_LABELS[v] })),
    [availableClasses]
  );

  const LIQUIDITY_LABELS: Record<AssetLiquidity, string> = {
    daily: "Daily", d30_90: "D+30–90", lockup: "Lock-up", closed_end: "Closed-end", illiquid: "Illiquid",
  };

  const liquidityOptions = useMemo(() => {
    const available = new Set(assetList.map((a) => a.liquidity).filter(Boolean) as AssetLiquidity[]);
    return (Object.keys(LIQUIDITY_LABELS) as AssetLiquidity[])
      .filter((v) => available.has(v))
      .map((v) => ({ value: v, label: LIQUIDITY_LABELS[v] }));
  }, [assetList]);

  const accountOptions = useMemo(() => {
    const names = Array.from(new Set(assetList.map((a) => a.accountName).filter(Boolean) as string[]));
    return names.sort().map((n) => ({ value: n, label: n }));
  }, [assetList]);

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
        accessorKey: "assetClass",
        header: () => (
          <FilterHeader
            label="Class"
            options={classOptions}
            selected={selectedClasses}
            onToggle={toggleClass}
            onClear={clearClasses}
          />
        ),
        cell: ({ row }) => {
          const c = row.getValue("assetClass") as AssetClass | null;
          if (!c) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CLASS_BADGE[c] ?? "bg-muted text-muted-foreground"}`}>
              {CLASS_LABELS[c] ?? c}
            </span>
          );
        },
      },
      {
        accessorKey: "geography",
        header: "Geography",
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.getValue("geography") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "liquidity",
        header: () => (
          <FilterHeader
            label="Liquidity"
            options={liquidityOptions}
            selected={selectedLiquidities}
            onToggle={toggleLiquidity}
            onClear={clearLiquidities}
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("liquidity") as string | null;
          if (!v) return <span className="text-muted-foreground text-xs">—</span>;
          const labels: Record<string, string> = {
            daily: "Daily", d30_90: "D+30–90", lockup: "Lock-up",
            closed_end: "Closed-end", illiquid: "Illiquid",
          };
          return <span className="text-xs">{labels[v] ?? v}</span>;
        },
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
        accessorKey: "currency",
        header: "Currency",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.getValue("currency")}</span>
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
    [openEdit, classOptions, selectedClasses, toggleClass, clearClasses,
     liquidityOptions, selectedLiquidities, toggleLiquidity, clearLiquidities,
     accountOptions, selectedAccounts, toggleAccount, clearAccounts]
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
