"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ListFilter, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceResponse } from "@/app/api/assets/performance/route";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ASSET_COLORS = ["#3b82f6","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#10b981","#f97316","#ef4444","#14b8a6","#a855f7"];
const PIE_COLORS   = ["#3b82f6","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#10b981","#f97316","#ef4444","#14b8a6","#a855f7","#84cc16","#6366f1"];
const RADIAN = Math.PI / 180;

type Period = "3m" | "6m" | "12m" | "12m_current" | "all";

function computeRange(period: Period): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");

  // "12m_current" uses current month as "to"; all others use last complete month
  const toYear = period === "12m_current" ? now.getFullYear() : new Date(now.getFullYear(), now.getMonth(), 0).getFullYear();
  const toMo   = period === "12m_current" ? now.getMonth() + 1 : new Date(now.getFullYear(), now.getMonth(), 0).getMonth() + 1;

  const n = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  let fromMo   = toMo - n + 1;
  let fromYear = toYear;
  while (fromMo <= 0) { fromMo += 12; fromYear--; }
  return { from: `${fromYear}-${pad(fromMo)}`, to: `${toYear}-${pad(toMo)}` };
}

function fmtYM(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} '${String(y).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtBrl(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(val / 1_000).toFixed(0)}k`;
  return val.toFixed(0);
}

function fmtPct(val: number, showSign = true): string {
  return `${showSign && val > 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function fmtLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, trend }: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5">
        {trend === "up"   && <TrendingUp   className="h-4 w-4 text-green-500 shrink-0" />}
        {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
        <p className={
          "text-xl font-semibold tabular-nums " +
          (trend === "up"   ? "text-green-600 dark:text-green-400" :
           trend === "down" ? "text-red-600 dark:text-red-400" : "")
        }>{value}</p>
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltips
// ---------------------------------------------------------------------------

function BalanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-lg space-y-1 min-w-[180px]">
      <p className="font-semibold text-sm">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: entry.color ?? entry.fill }}>{entry.name}</span>
          <span className="tabular-nums font-medium">
            {typeof entry.value === "number"
              ? entry.name?.toLowerCase().includes("return") || entry.name?.toLowerCase().includes("%")
                ? fmtPct(entry.value)
                : fmtBrl(entry.value)
              : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-lg space-y-0.5 min-w-[160px]">
      <p className="font-semibold">{fmtLabel(name)}</p>
      <p className="tabular-nums text-muted-foreground">{fmtBrl(value)}</p>
    </div>
  );
}

function PieLegend({ data, total }: { data: { name: string; value: number }[]; total: number }) {
  return (
    <div className="mt-3 space-y-1.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
          <span className="flex-1 truncate text-muted-foreground">{fmtLabel(d.name)}</span>
          <span className="tabular-nums font-medium shrink-0">{fmtBrl(d.value)}</span>
          <span className="tabular-nums text-muted-foreground/70 shrink-0 w-10 text-right">
            {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssetOption = {
  id:             string;
  name:           string;
  currency:       string;
  accountId:      string;
  assetClass:     string | null;
  riskFactor:     string | null;
  index:          string | null;
  liquidity:      string | null;
  expirationDate: string | null;
};

type GroupedAssetOption = {
  ids:         string[];    // all underlying asset IDs
  name:        string;
  currency:    string;
  accountName: string;      // "Account1 +N"
};

function assetGroupKey(a: AssetOption): string {
  const exp = a.expirationDate ? String(a.expirationDate).split("T")[0] : "";
  return [a.name, a.currency, a.assetClass ?? "", a.index ?? "", a.liquidity ?? "", exp].join("|");
}

type AccountOption = { id: string; name: string };

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AssetPerformanceDashboard() {
  const [period,            setPeriod]            = useState<Period>("12m");
  const [allAssets,         setAllAssets]         = useState<AssetOption[]>([]);
  const [allAccounts,       setAllAccounts]       = useState<AccountOption[]>([]);
  const [selectedIds,       setSelectedIds]       = useState<string[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedClasses,   setSelectedClasses]   = useState<string[]>([]);
  const [data,              setData]              = useState<PerformanceResponse | null>(null);
  const [loadingAssets,     setLoadingAssets]     = useState(true);
  const [loadingData,       setLoadingData]       = useState(false);

  // Fetch asset list + account list on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/assets").then(r => r.json()),
      fetch("/api/accounts").then(r => r.json()),
    ]).then(([assets, accounts]: [AssetOption[], AccountOption[]]) => {
      setAllAssets(assets.sort((a, b) => a.name.localeCompare(b.name)));
      setAllAccounts(accounts.sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingAssets(false);
    }).catch(() => setLoadingAssets(false));
  }, []);

  // Map for quick lookup: assetId → asset metadata
  const allAssetsMap = useMemo(
    () => new Map(allAssets.map(a => [a.id, a])),
    [allAssets]
  );

  // Available classes derived from loaded assets
  const availableClasses = useMemo(
    () => Array.from(new Set(allAssets.map(a => a.assetClass).filter(Boolean) as string[])).sort(),
    [allAssets]
  );

  // Account id → name (needed for grouping)
  const allAccountsMap = useMemo(
    () => new Map(allAccounts.map(a => [a.id, a.name])),
    [allAccounts]
  );

  // Grouped asset options for the asset dropdown
  const groupedAssetOptions = useMemo((): GroupedAssetOption[] => {
    const map = new Map<string, { assets: AssetOption[]; accountNames: string[] }>();
    for (const a of allAssets) {
      const k = assetGroupKey(a);
      if (!map.has(k)) map.set(k, { assets: [], accountNames: [] });
      const g = map.get(k)!;
      g.assets.push(a);
      const accName = allAccountsMap.get(a.accountId);
      if (accName) g.accountNames.push(accName);
    }
    return Array.from(map.values()).map(({ assets, accountNames }) => ({
      ids:         assets.map(a => a.id),
      name:        assets[0].name,
      currency:    assets[0].currency,
      accountName: accountNames.length > 1
        ? `${accountNames[0]} +${accountNames.length - 1}`
        : accountNames[0] ?? "",
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allAssets, allAccountsMap]);

  // Effective asset IDs considering all active filters (AND logic)
  const effectiveIds = useMemo(() => {
    let filtered = allAssets;
    if (selectedAccountId) filtered = filtered.filter(a => a.accountId === selectedAccountId);
    if (selectedClasses.length > 0) filtered = filtered.filter(a => a.assetClass != null && selectedClasses.includes(a.assetClass));
    if (selectedIds.length > 0) filtered = filtered.filter(a => selectedIds.includes(a.id));
    return filtered.map(a => a.id);
  }, [allAssets, selectedAccountId, selectedClasses, selectedIds]);

  const hasActiveFilters = selectedAccountId != null || selectedClasses.length > 0 || selectedIds.length > 0;

  // Fetch performance data when period or filters change
  useEffect(() => {
    if (loadingAssets) return; // wait for asset list first
    setLoadingData(true);
    const { from, to } = computeRange(period);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    // Send effective IDs only when it's a subset of all assets
    if (hasActiveFilters && effectiveIds.length < allAssets.length) {
      params.set("assetIds", effectiveIds.join(","));
    }
    fetch(`/api/assets/performance?${params}`)
      .then(r => r.json())
      .then((d: PerformanceResponse) => { setData(d); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [period, effectiveIds, hasActiveFilters, allAssets.length, loadingAssets]);

  const toggleAsset = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleClass = (cls: string) =>
    setSelectedClasses(prev => prev.includes(cls) ? prev.filter(x => x !== cls) : [...prev, cls]);

  // -------------------------------------------------------------------------
  // Chart data
  // -------------------------------------------------------------------------

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.months.map(m => ({
      label:                  m.label,
      month:                  m.month,
      balance:                m.balance,
      contributions:          m.contributions > 0 ? m.contributions : null,
      withdrawals:            m.withdrawals   > 0 ? -m.withdrawals  : null,
      netCashFlow:            m.contributions > 0 || m.withdrawals > 0 ? m.contributions - m.withdrawals : null,
      returnPct:              m.returnPct,
      cumulativeReturnPct:    m.cumulativeReturnPct,
      twrReturnPct:           m.twrReturnPct,
      twrCumulativeReturnPct: m.twrCumulativeReturnPct,
    }));
  }, [data]);

  // Latest month key for pie chart snapshot
  const latestKey = useMemo(() => {
    if (!data?.to) return null;
    const [y, m] = data.to.split("-").map(Number);
    return `${y}:${m}`;
  }, [data]);

  // Pie: balance by asset class
  const pieByClass = useMemo(() => {
    if (!data || !latestKey) return [];
    const map = new Map<string, number>();
    for (const detail of data.assetDetails) {
      const asset = allAssetsMap.get(detail.id);
      const cls   = asset?.assetClass ?? "(unclassified)";
      const bal   = detail.months[latestKey] ?? 0;
      if (bal > 0) map.set(cls, (map.get(cls) ?? 0) + bal);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data, latestKey, allAssetsMap]);

  // Pie: balance by risk factor
  const pieByRisk = useMemo(() => {
    if (!data || !latestKey) return [];
    const map = new Map<string, number>();
    for (const detail of data.assetDetails) {
      const asset  = allAssetsMap.get(detail.id);
      const factor = asset?.riskFactor ?? "(unclassified)";
      const bal    = detail.months[latestKey] ?? 0;
      if (bal > 0) map.set(factor, (map.get(factor) ?? 0) + bal);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data, latestKey, allAssetsMap]);

  // Pie: balance by account
  const pieByAccount = useMemo(() => {
    if (!data || !latestKey) return [];
    const map = new Map<string, number>();
    for (const detail of data.assetDetails) {
      const asset   = allAssetsMap.get(detail.id);
      const accName = (asset?.accountId ? allAccountsMap.get(asset.accountId) : null) ?? "(unknown)";
      const bal     = detail.months[latestKey] ?? 0;
      if (bal > 0) map.set(accName, (map.get(accName) ?? 0) + bal);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data, latestKey, allAssetsMap, allAccountsMap]);

  const pieClassTotal   = useMemo(() => pieByClass.reduce((s, d) => s + d.value, 0),   [pieByClass]);
  const pieRiskTotal    = useMemo(() => pieByRisk.reduce((s, d) => s + d.value, 0),    [pieByRisk]);
  const pieAccountTotal = useMemo(() => pieByAccount.reduce((s, d) => s + d.value, 0), [pieByAccount]);

  // -------------------------------------------------------------------------
  // Summary card values
  // -------------------------------------------------------------------------

  const ytd      = data?.ytd;
  const retPct   = ytd?.returnPct;
  const twrPct   = ytd?.twrReturnPct;
  const pnl      = ytd?.pnl;
  const retTrend: "up" | "down" | "neutral" =
    retPct == null ? "neutral" : retPct >= 0 ? "up" : "down";
  const twrTrend: "up" | "down" | "neutral" =
    twrPct == null ? "neutral" : twrPct >= 0 ? "up" : "down";

  // Active filter count badge
  const activeFilterCount =
    (selectedAccountId ? 1 : 0) + selectedClasses.length + selectedIds.length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period */}
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="6m">Last 6 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="12m_current">Last 12 months (incl. current)</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {data?.from && data?.to && (
          <span className="text-xs text-muted-foreground">
            {fmtYM(data.from)} – {fmtYM(data.to)}
          </span>
        )}

        {/* Account filter */}
        {!loadingAssets && allAccounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-normal">
                {selectedAccountId
                  ? <ListFilter className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                {selectedAccountId
                  ? (allAccounts.find(a => a.id === selectedAccountId)?.name ?? "Account")
                  : "Account"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-80 overflow-y-auto">
              {allAccounts.map(acc => (
                <DropdownMenuCheckboxItem
                  key={acc.id}
                  checked={selectedAccountId === acc.id}
                  onCheckedChange={() => setSelectedAccountId(prev => prev === acc.id ? null : acc.id)}
                  onSelect={e => e.preventDefault()}
                >
                  {acc.name}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedAccountId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-xs text-muted-foreground" onSelect={() => setSelectedAccountId(null)}>
                    Clear filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Class filter */}
        {!loadingAssets && availableClasses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-normal">
                {selectedClasses.length > 0
                  ? <ListFilter className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                Class
                {selectedClasses.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary leading-4">
                    {selectedClasses.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-80 overflow-y-auto">
              {availableClasses.map(cls => (
                <DropdownMenuCheckboxItem
                  key={cls}
                  checked={selectedClasses.includes(cls)}
                  onCheckedChange={() => toggleClass(cls)}
                  onSelect={e => e.preventDefault()}
                >
                  {fmtLabel(cls)}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedClasses.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-xs text-muted-foreground" onSelect={() => setSelectedClasses([])}>
                    Clear filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Per-asset filter (grouped) */}
        {!loadingAssets && groupedAssetOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-normal">
                {selectedIds.length > 0
                  ? <ListFilter className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                Assets
                {selectedIds.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary leading-4">
                    {groupedAssetOptions.filter(g => g.ids.every(id => selectedIds.includes(id))).length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px] max-h-80 overflow-y-auto">
              {groupedAssetOptions.map(g => {
                const allChecked = g.ids.every(id => selectedIds.includes(id));
                const toggle = () => {
                  if (allChecked) {
                    setSelectedIds(prev => prev.filter(id => !g.ids.includes(id)));
                  } else {
                    setSelectedIds(prev => Array.from(new Set([...prev, ...g.ids])));
                  }
                };
                return (
                  <DropdownMenuCheckboxItem
                    key={g.ids.join(",")}
                    checked={allChecked}
                    onCheckedChange={toggle}
                    onSelect={e => e.preventDefault()}
                  >
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground font-mono">{g.currency}</span>
                    {g.ids.length > 1 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">{g.accountName}</span>
                    )}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {selectedIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-xs text-muted-foreground" onSelect={() => setSelectedIds([])}>
                    Clear filter (show all)
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear all filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground"
            onClick={() => { setSelectedAccountId(null); setSelectedClasses([]); setSelectedIds([]); }}
          >
            Clear all
          </Button>
        )}

        {data && (
          <span className="text-xs text-muted-foreground">
            {data.assetCount} asset{data.assetCount !== 1 ? "s" : ""}
            {activeFilterCount > 0 ? " selected" : " total"}
          </span>
        )}
      </div>

      {/* ---- Loading skeleton ---- */}
      {loadingData && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        </div>
      )}

      {/* ---- No data ---- */}
      {!loadingData && data && data.assetCount === 0 && (
        <p className="py-12 text-center text-muted-foreground text-sm">
          No asset balance data found for the selected period.
        </p>
      )}

      {/* ---- Dashboard ---- */}
      {!loadingData && data && data.assetCount > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard
              label="Current Balance"
              value={ytd?.currentBalance != null ? fmtBrl(ytd.currentBalance) : "—"}
              sub="BRL equivalent"
            />
            <StatCard
              label="Simple Return"
              value={retPct != null ? fmtPct(retPct) : "—"}
              sub="P&L / start balance"
              trend={retTrend}
            />
            <StatCard
              label="TWR"
              value={twrPct != null ? fmtPct(twrPct) : "—"}
              sub="Time-weighted"
              trend={twrTrend}
            />
            <StatCard
              label="P&L"
              value={pnl != null ? fmtBrl(pnl) : "—"}
              sub="Profit / loss"
              trend={retTrend}
            />
            <StatCard
              label="Contributions"
              value={ytd ? fmtBrl(ytd.contributions) : "—"}
              sub="Money invested"
            />
            <StatCard
              label="Withdrawals"
              value={ytd ? fmtBrl(ytd.withdrawals) : "—"}
              sub="Money redeemed"
            />
            <StatCard
              label="Income"
              value={ytd ? fmtBrl(ytd.income) : "—"}
              sub="Dividends / interest"
            />
          </div>

          {/* Balance + Cash Flow chart */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-4">Balance Evolution &amp; Cash Flows</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 65, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="bal" orientation="left"  tickFormatter={fmtK} tick={{ fontSize: 11 }} width={62} />
                <YAxis yAxisId="cf"  orientation="right" tickFormatter={fmtK} tick={{ fontSize: 11 }} width={62} />
                <Tooltip content={<BalanceTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="bal"
                  type="monotone"
                  dataKey="balance"
                  name="Balance (BRL)"
                  fill="url(#gradBalance)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Bar yAxisId="cf" dataKey="contributions" name="Contributions" maxBarSize={24} fill="#22c55e" opacity={0.8} />
                <Bar yAxisId="cf" dataKey="withdrawals"   name="Withdrawals"   maxBarSize={24} fill="#ef4444" opacity={0.8} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Return charts side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Monthly Return %</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip content={<BalanceTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <Bar dataKey="returnPct" name="Return %" maxBarSize={28} radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={(d.returnPct ?? 0) >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Cumulative Return</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip content={<BalanceTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeReturnPct"
                    name="Simple Return %"
                    stroke="#8b5cf6"
                    fill="url(#gradCum)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8b5cf6" }}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="twrCumulativeReturnPct"
                    name="TWR %"
                    stroke="#f59e0b"
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 2, fill: "#f59e0b" }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Month</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Balance</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">vs Prior</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Contributions</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Withdrawals</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Income</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">P&amp;L</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Return %</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">Cumulative</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">TWR Cum.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months
                    .filter(m => m.balance !== null || m.contributions > 0 || m.withdrawals > 0 || m.income > 0)
                    .map(m => {
                      const hasReturn = m.returnPct !== null;
                      return (
                        <tr key={`${m.year}:${m.month}`} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{m.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {m.balance != null ? fmtBrl(m.balance) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                            {m.balance != null && m.prevBalance != null
                              ? (() => {
                                  const diff = m.balance - m.prevBalance;
                                  return (
                                    <span className={diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                      {diff >= 0 ? "+" : ""}{fmtBrl(diff)}
                                    </span>
                                  );
                                })()
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">
                            {m.contributions > 0 ? fmtBrl(m.contributions) : <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                            {m.withdrawals > 0 ? fmtBrl(m.withdrawals) : <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">
                            {m.income > 0 ? fmtBrl(m.income) : <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className={
                            "px-4 py-2.5 text-right tabular-nums font-medium " +
                            (m.pnl == null ? "text-muted-foreground/50" :
                             m.pnl >= 0    ? "text-green-600 dark:text-green-400" :
                                             "text-red-600 dark:text-red-400")
                          }>
                            {m.pnl != null ? `${m.pnl >= 0 ? "+" : ""}${fmtBrl(m.pnl)}` : "—"}
                          </td>
                          <td className={
                            "px-4 py-2.5 text-right tabular-nums font-semibold " +
                            (!hasReturn ? "text-muted-foreground/50" :
                             m.returnPct! >= 0 ? "text-green-600 dark:text-green-400" :
                                                 "text-red-600 dark:text-red-400")
                          }>
                            {hasReturn ? fmtPct(m.returnPct!) : "—"}
                          </td>
                          <td className={
                            "px-4 py-2.5 text-right tabular-nums " +
                            (m.cumulativeReturnPct == null ? "text-muted-foreground/50" :
                             m.cumulativeReturnPct >= 0    ? "text-green-600 dark:text-green-400" :
                                                             "text-red-600 dark:text-red-400")
                          }>
                            {m.cumulativeReturnPct != null ? fmtPct(m.cumulativeReturnPct) : "—"}
                          </td>
                          <td className={
                            "px-4 py-2.5 text-right tabular-nums " +
                            (m.twrCumulativeReturnPct == null ? "text-muted-foreground/50" :
                             m.twrCumulativeReturnPct >= 0    ? "text-amber-600 dark:text-amber-400" :
                                                                "text-red-600 dark:text-red-400")
                          }>
                            {m.twrCumulativeReturnPct != null ? fmtPct(m.twrCumulativeReturnPct) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5 text-sm">YTD Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm">
                      {ytd?.currentBalance != null ? fmtBrl(ytd.currentBalance) : "—"}
                    </td>
                    <td />
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">
                      {ytd && ytd.contributions > 0 ? fmtBrl(ytd.contributions) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                      {ytd && ytd.withdrawals > 0 ? fmtBrl(ytd.withdrawals) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {ytd && ytd.income > 0 ? fmtBrl(ytd.income) : "—"}
                    </td>
                    <td className={
                      "px-4 py-2.5 text-right tabular-nums text-sm " +
                      (ytd?.pnl == null ? "" : ytd.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")
                    }>
                      {ytd?.pnl != null ? `${ytd.pnl >= 0 ? "+" : ""}${fmtBrl(ytd.pnl)}` : "—"}
                    </td>
                    <td className={
                      "px-4 py-2.5 text-right tabular-nums text-sm " +
                      (ytd?.returnPct == null ? "" : ytd.returnPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")
                    }>
                      {ytd?.returnPct != null ? fmtPct(ytd.returnPct) : "—"}
                    </td>
                    <td />
                    <td className={
                      "px-4 py-2.5 text-right tabular-nums text-sm " +
                      (ytd?.twrReturnPct == null ? "" : ytd.twrReturnPct >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")
                    }>
                      {ytd?.twrReturnPct != null ? fmtPct(ytd.twrReturnPct) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>Simple Return:</strong> cumulative P&amp;L ÷ starting balance.{" "}
            <strong>TWR (Time-Weighted Return):</strong> compounds monthly sub-period returns; contributions are assumed to be deployed at the start of the following month, matching the practice of recording balances at the beginning of each month.
            Balances are converted to BRL using the nearest prior exchange rate.
          </p>

          {/* Portfolio composition pies */}
          {(pieByClass.length > 0 || pieByRisk.length > 0 || pieByAccount.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* By asset class */}
              {pieByClass.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Balance by Asset Class</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieByClass}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        labelLine={false}
                        label={PieSliceLabel}
                      >
                        {pieByClass.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={pieByClass} total={pieClassTotal} />
                </div>
              )}

              {/* By risk factor */}
              {pieByRisk.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Balance by Risk Factor</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieByRisk}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        labelLine={false}
                        label={PieSliceLabel}
                      >
                        {pieByRisk.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={pieByRisk} total={pieRiskTotal} />
                </div>
              )}

              {/* By account */}
              {pieByAccount.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Balance by Account</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieByAccount}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        labelLine={false}
                        label={PieSliceLabel}
                      >
                        {pieByAccount.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend data={pieByAccount} total={pieAccountTotal} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
