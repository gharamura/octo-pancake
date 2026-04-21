"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
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
import { AssetImport } from "@/components/asset-import";
import { type Asset, type AssetClass } from "@/lib/db/schema";
import type { AssetWithAccount } from "@/lib/repositories/asset.repository";
import { ChevronDown, ChevronRight, Download, ListFilter, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Class labels & badges
// ---------------------------------------------------------------------------

const CLASS_LABELS: Record<AssetClass, string> = {
  cash_equivalents:   "Cash Equivalents",
  fixed_income:       "Fixed Income",
  investment_funds:   "Investment Funds",
  structured_products: "Structured Products",
  variable_income:    "Variable Income",
  crypto:             "Crypto",
  pension:            "Pension",
};

const CLASS_BADGE: Record<AssetClass, string> = {
  cash_equivalents:   "bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300",
  fixed_income:       "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
  investment_funds:   "bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400",
  structured_products: "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400",
  variable_income:    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  crypto:             "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pension:            "bg-pink-100   text-pink-800   dark:bg-pink-900/30   dark:text-pink-400",
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
// Asset grouping
// ---------------------------------------------------------------------------

type GroupedAsset = AssetWithAccount & {
  _groupIds:          string[];
  _groupAccountNames: string[];
  subRows?:           GroupedAsset[];
};

function assetGroupKey(a: AssetWithAccount): string {
  const exp = a.expirationDate ? String(a.expirationDate).split("T")[0] : "";
  return [a.name, a.currency, a.assetClass ?? "", (a as any).index ?? "", a.liquidity ?? "", exp].join("|");
}

function groupAssets(list: AssetWithAccount[]): GroupedAsset[] {
  const map = new Map<string, AssetWithAccount[]>();
  for (const a of list) {
    const k = assetGroupKey(a);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(a);
  }
  return Array.from(map.values()).map((group) => {
    const first        = group[0];
    const accountNames = group.map((a) => a.accountName).filter(Boolean) as string[];
    const isGrouped    = group.length > 1;

    const subRows: GroupedAsset[] | undefined = isGrouped
      ? group.map((a) => ({
          ...a,
          _groupIds:          [a.id],
          _groupAccountNames: [a.accountName ?? ""],
          subRows:            undefined,
        }))
      : undefined;

    return {
      ...first,
      accountName: isGrouped
        ? `${accountNames[0]} +${accountNames.length - 1}`
        : accountNames[0] ?? null,
      _groupIds:          group.map((a) => a.id),
      _groupAccountNames: accountNames,
      subRows,
    };
  });
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
  const [selectedLiquidities, setSelectedLiquidities] = useState<string[]>([]);
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

  const toggleLiquidity = useCallback((l: string) =>
    setSelectedLiquidities((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]), []);
  const clearLiquidities = useCallback(() => setSelectedLiquidities([]), []);

  const toggleAccount   = useCallback((a: string) =>
    setSelectedAccounts((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]), []);
  const clearAccounts   = useCallback(() => setSelectedAccounts([]), []);

  const filteredAssets = useMemo(() => {
    return assetList.filter((a) => {
      if (selectedClasses.length    && !(a.assetClass && selectedClasses.includes(a.assetClass)))       return false;
      if (selectedLiquidities.length && !(a.liquidity  && selectedLiquidities.includes(a.liquidity))) return false;
      if (selectedAccounts.length   && !(a.accountName && selectedAccounts.includes(a.accountName)))    return false;
      return true;
    });
  }, [assetList, selectedClasses, selectedLiquidities, selectedAccounts]);

  const groupedAssets = useMemo(() => groupAssets(filteredAssets), [filteredAssets]);

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

  const liquidityOptions = useMemo(() => {
    const available = Array.from(new Set(assetList.map((a) => a.liquidity).filter(Boolean) as string[]));
    return available.sort().map((v) => ({
      value: v,
      label: v === "market" ? "Market" : v === "lockup" ? "Lock-up" : `${v}d`,
    }));
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

  const exportRows = useCallback((format: "csv" | "xlsx") => {
    const fmtDate = (val: unknown) => {
      if (!val) return "";
      const s = String(val);
      return s.includes("T") ? s.split("T")[0] : s;
    };

    const rows = assetList.map((a) => ({
      id:             a.id,
      name:           a.name,
      account_id:     a.accountId,
      account_name:   a.accountName ?? "",
      asset_class:    a.assetClass  ?? "",
      geography:      a.geography   ?? "",
      risk_factor:    a.riskFactor  ?? "",
      liquidity:      a.liquidity   ?? "",
      custodian:      a.custodian   ?? "",
      currency:       a.currency,
      expiration_date: fmtDate(a.expirationDate),
      index:          a.index       ?? "",
      rule:           a.rule        ?? "",
      is_active:      a.isActive ? "true" : "false",
      created_at:     fmtDate(a.createdAt),
      updated_at:     fmtDate(a.updatedAt),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    const filename = `assets_${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") {
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
    }
  }, [assetList]);

  const columns = useMemo<ColumnDef<GroupedAsset>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
          if (!row.getCanExpand()) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={row.getToggleExpandedHandler()}
            >
              {row.getIsExpanded()
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className={`font-medium ${row.depth > 0 ? "pl-4 text-muted-foreground" : ""}`}>
            {row.depth > 0 ? "↳" : ""} {row.getValue("name")}
          </span>
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
          if (v === "market")  return <span className="text-xs">Market</span>;
          if (v === "lockup")  return <span className="text-xs">Lock-up</span>;
          return <span className="text-xs">{v}d</span>;
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
        cell: ({ row }) => {
          const name = row.depth > 0
            ? row.original._groupAccountNames[0] ?? row.getValue("accountName")
            : row.getValue("accountName");
          return <span className="text-muted-foreground">{name ?? "—"}</span>;
        },
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
        accessorKey: "index",
        header: "Index",
        cell: ({ row }) => {
          const v = row.getValue("index") as string | null;
          return v
            ? <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400">{v}</span>
            : <span className="text-muted-foreground text-xs">—</span>;
        },
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
        cell: ({ row }) => {
          // Show edit on single assets or on expanded sub-rows; hide on collapsed group header
          if (row.original._groupIds.length > 1) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          );
        },
      },
    ],
    [openEdit, classOptions, selectedClasses, toggleClass, clearClasses,
     liquidityOptions, selectedLiquidities, toggleLiquidity, clearLiquidities,
     accountOptions, selectedAccounts, toggleAccount, clearAccounts]
  );

  const table = useReactTable({
    data:              groupedAssets,
    columns,
    getSubRows:        (row) => row.subRows,
    getCoreRowModel:   getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={assetList.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Export
              <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => exportRows("xlsx")}>
              Download as XLSX
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportRows("csv")}>
              Download as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AssetImport assets={assetList} onApplied={fetchAssets} />

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
                <TableRow
                  key={row.id}
                  className={row.depth > 0 ? "bg-muted/30" : undefined}
                >
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
