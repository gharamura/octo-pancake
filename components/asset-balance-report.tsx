"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ListFilter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetBalanceReportRow } from "@/app/api/balances/assets/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
                     "Jul","Aug","Sep","Oct","Nov","Dec"];

type Preset = "3" | "6" | "12" | "custom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "YYYY-MM" → "MMM YYYY" or "MMM" when same year */
function formatMonthKey(key: string, showYear: boolean): string {
  const [y, m] = key.split("-");
  const label = MONTH_NAMES[parseInt(m, 10) - 1];
  return showYear ? `${label} ${y}` : label;
}

/** Generate all "YYYY-MM" keys between from and to inclusive */
function monthKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

/** Months ago from today in "YYYY-MM" format */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (n - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(val: number, currency: string): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtGeneric(val: number): string {
  return val.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function mv(row: AssetBalanceReportRow, key: string): number | null {
  return row.months[key] ?? null;
}

function brlEquiv(asset: AssetBalanceReportRow, key: string): number | null {
  const balance = asset.months[key] ?? null;
  if (balance === null) return null;
  if (asset.currency === "BRL") return balance;
  const rate = asset.exchangeRates[key] ?? null;
  if (rate === null) return null;
  return balance * rate;
}

// ---------------------------------------------------------------------------
// Styles (mirroring coa-report)
// ---------------------------------------------------------------------------

const TD_STICKY =
  "sticky left-0 z-10 whitespace-nowrap px-3 py-2 bg-background";
const TH_STICKY =
  "sticky left-0 top-0 z-30 whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide bg-muted/40";
const TD_NUM =
  "px-3 py-2 text-right tabular-nums text-sm";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetBalanceReport() {
  const [preset,           setPreset]           = useState<Preset>("6");
  const [customFrom,       setCustomFrom]       = useState(monthsAgo(6));
  const [customTo,         setCustomTo]         = useState(currentMonth());
  const [assets,           setAssets]           = useState<AssetBalanceReportRow[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sort,             setSort]             = useState<"name-asc" | "name-desc" | "value-desc" | "value-asc">("name-asc");

  const periodFrom = preset === "custom" ? customFrom : monthsAgo(Number(preset));
  const periodTo   = preset === "custom" ? customTo   : currentMonth();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/balances/assets?from=${periodFrom}&to=${periodTo}`)
      .then((r) => r.json())
      .then(({ assets: data }: { assets: AssetBalanceReportRow[] }) => {
        setAssets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [periodFrom, periodTo]);

  // Unique accounts for filter options
  const accountOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assets.forEach((a) => {
      if (!seen.has(a.accountId)) seen.set(a.accountId, a.accountName ?? a.accountId);
    });
    return Array.from(seen.entries())
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, name]) => ({ id, name }));
  }, [assets]);

  const toggleAccount = useCallback((id: string) =>
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]), []);

  // Client-side account filter
  const filteredAssets = useMemo(() =>
    selectedAccounts.length === 0
      ? assets
      : assets.filter((a) => selectedAccounts.includes(a.accountId)),
    [assets, selectedAccounts]
  );

  // All month keys in the requested range
  const allMonthKeys = useMemo(() => monthKeysBetween(periodFrom, periodTo), [periodFrom, periodTo]);

  // Which month keys actually have data
  const activeMonths = useMemo(() => {
    const set = new Set<string>();
    filteredAssets.forEach((a) => Object.keys(a.months).forEach((k) => set.add(k)));
    return allMonthKeys.filter((k) => set.has(k));
  }, [filteredAssets, allMonthKeys]);

  // Does the range span multiple years? If so, show year in column headers
  const multiYear = useMemo(() => {
    if (activeMonths.length === 0) return false;
    const firstYear = activeMonths[0].slice(0, 4);
    return activeMonths.some((k) => k.slice(0, 4) !== firstYear);
  }, [activeMonths]);

  // Per-month totals grouped by currency
  const currencies = useMemo(() => Array.from(new Set(filteredAssets.map((a) => a.currency))), [filteredAssets]);

  const monthTotals = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const asset of filteredAssets) {
      for (const [key, val] of Object.entries(asset.months)) {
        if (!map[key]) map[key] = {};
        map[key][asset.currency] = (map[key][asset.currency] ?? 0) + val;
      }
    }
    return map;
  }, [filteredAssets]);

  const latestMonth = activeMonths[activeMonths.length - 1] ?? null;

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      if (sort === "name-asc")  return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      const av = latestMonth != null ? (a.months[latestMonth] ?? null) : null;
      const bv = latestMonth != null ? (b.months[latestMonth] ?? null) : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort === "value-desc" ? bv - av : av - bv;
    });
  }, [filteredAssets, sort, latestMonth]);

  const hasNonBrl = useMemo(
    () => filteredAssets.some((a) => a.currency !== "BRL"),
    [filteredAssets]
  );

  // BRL total per month
  const brlMonthTotals = useMemo(() => {
    const map: Record<string, { sum: number; partial: boolean }> = {};
    for (const key of activeMonths) {
      let sum = 0;
      let hasAny = false;
      let partial = false;
      for (const asset of filteredAssets) {
        if (asset.months[key] == null) continue;
        const equiv = brlEquiv(asset, key);
        if (equiv !== null) { sum += equiv; hasAny = true; }
        else partial = true;
      }
      if (hasAny || partial) map[key] = { sum, partial };
    }
    return map;
  }, [filteredAssets, activeMonths]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Period</span>
        <div className="flex items-center rounded-md border overflow-hidden">
          {(["3", "6", "12", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted/60 text-muted-foreground"
              } ${p !== "3" ? "border-l" : ""}`}
            >
              {p === "custom" ? "Custom" : `${p}M`}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <>
            <Input
              type="month"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-40 h-9"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="month"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-40 h-9"
            />
          </>
        )}

        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A → Z</SelectItem>
            <SelectItem value="name-desc">Name Z → A</SelectItem>
            <SelectItem value="value-desc">Latest value ↓</SelectItem>
            <SelectItem value="value-asc">Latest value ↑</SelectItem>
          </SelectContent>
        </Select>

        {accountOptions.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-normal">
                {selectedAccounts.length > 0
                  ? <ListFilter className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                Account
                {selectedAccounts.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary leading-4">
                    {selectedAccounts.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-72 overflow-y-auto">
              {accountOptions.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.id}
                  checked={selectedAccounts.includes(opt.id)}
                  onCheckedChange={() => toggleAccount(opt.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {opt.name}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedAccounts.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-xs text-muted-foreground"
                    onSelect={() => setSelectedAccounts([])}
                  >
                    Clear filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          No asset balances recorded for this period.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[calc(100vh-14rem)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className={`${TH_STICKY} min-w-[240px]`}>Asset</th>
                <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                  Type
                </th>
                <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                  Account
                </th>
                {activeMonths.map((key) => (
                  <th
                    key={key}
                    className="sticky top-0 z-20 bg-muted/40 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide min-w-[100px]"
                  >
                    {formatMonthKey(key, multiYear)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map((asset) => (
                <tr
                  key={asset.assetId}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className={TD_STICKY}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{asset.name}</span>
                      <span className="text-xs text-muted-foreground">{asset.currency}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {asset.assetClass ? asset.assetClass.replace(/_/g, " ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {asset.accountName ?? "—"}
                  </td>
                  {activeMonths.map((key) => {
                    const val = mv(asset, key);
                    const brl = asset.currency !== "BRL" ? brlEquiv(asset, key) : null;
                    return (
                      <td
                        key={key}
                        className={`${TD_NUM} ${val === null ? "text-muted-foreground/40" : "text-foreground"}`}
                      >
                        {val === null ? "—" : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{fmt(val, asset.currency)}</span>
                            {brl !== null && (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {fmt(brl, "BRL")}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Total rows — one per currency */}
              {currencies.map((ccy) => (
                <tr key={ccy} className="border-t-2 bg-muted/30 font-semibold">
                  <td className={`${TD_STICKY} bg-muted/30 text-sm`}>
                    Total{currencies.length > 1 ? ` (${ccy})` : ""}
                  </td>
                  <td className="px-3 py-2" colSpan={2} />
                  {activeMonths.map((key) => {
                    const sum = monthTotals[key]?.[ccy];
                    return (
                      <td
                        key={key}
                        className={`${TD_NUM} font-bold ${
                          sum == null
                            ? "text-muted-foreground/40"
                            : "text-foreground"
                        }`}
                      >
                        {sum == null
                          ? "—"
                          : currencies.length > 1
                            ? fmtGeneric(sum)
                            : fmt(sum, ccy)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* BRL grand total — shown only when there are non-BRL assets */}
              {hasNonBrl && (
                <tr className="border-t-2 bg-primary/5 font-semibold">
                  <td className={`${TD_STICKY} bg-primary/5 text-sm text-primary`}>
                    Total (BRL)
                  </td>
                  <td className="px-3 py-2" colSpan={2} />
                  {activeMonths.map((key) => {
                    const data = brlMonthTotals[key];
                    return (
                      <td key={key} className={`${TD_NUM} font-bold text-primary`}>
                        {data == null ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            {data.partial && (
                              <span className="text-[10px] font-normal text-muted-foreground">partial</span>
                            )}
                            {fmt(data.sum, "BRL")}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
