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
  Line,
  LineChart,
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

type Period = "3m" | "6m" | "12m" | "all";

/** Compute the YYYY-MM from/to range for a given period (using last complete month as "to"). */
function computeRange(period: Period): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  const now    = new Date();
  // last day of the previous (complete) month
  const toDate = new Date(now.getFullYear(), now.getMonth(), 0);
  const toYear = toDate.getFullYear();
  const toMo   = toDate.getMonth() + 1; // 1-based
  const n      = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  let fromMo   = toMo - n + 1;
  let fromYear = toYear;
  while (fromMo <= 0) { fromMo += 12; fromYear--; }
  const pad = (x: number) => String(x).padStart(2, "0");
  return { from: `${fromYear}-${pad(fromMo)}`, to: `${toYear}-${pad(toMo)}` };
}

/** Format a "YYYY-MM" string as "Jan '25". */
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type AssetOption = { id: string; name: string; currency: string };

export function AssetPerformanceDashboard() {
  const [period,         setPeriod]         = useState<Period>("12m");
  const [allAssets,      setAllAssets]      = useState<AssetOption[]>([]);
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);
  const [data,           setData]           = useState<PerformanceResponse | null>(null);
  const [loadingAssets,  setLoadingAssets]  = useState(true);
  const [loadingData,    setLoadingData]    = useState(false);

  // Fetch asset list on mount
  useEffect(() => {
    fetch("/api/assets")
      .then(r => r.json())
      .then((assets: AssetOption[]) => {
        setAllAssets(assets.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingAssets(false);
      })
      .catch(() => setLoadingAssets(false));
  }, []);

  // Fetch performance data when period or selection changes
  useEffect(() => {
    setLoadingData(true);
    const { from, to } = computeRange(period);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    if (selectedIds.length > 0) params.set("assetIds", selectedIds.join(","));
    fetch(`/api/assets/performance?${params}`)
      .then(r => r.json())
      .then((d: PerformanceResponse) => { setData(d); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [period, selectedIds]);

  const toggleAsset = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // -------------------------------------------------------------------------
  // Chart data
  // -------------------------------------------------------------------------

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.months.map(m => ({
      label:               m.label,
      month:               m.month,
      balance:             m.balance,
      contributions:       m.contributions > 0 ? m.contributions : null,
      withdrawals:         m.withdrawals   > 0 ? -m.withdrawals  : null, // negative for chart
      netCashFlow:         m.contributions > 0 || m.withdrawals > 0
                             ? m.contributions - m.withdrawals
                             : null,
      returnPct:           m.returnPct,
      cumulativeReturnPct: m.cumulativeReturnPct,
    }));
  }, [data]);

  // Per-asset chart data (for multi-asset breakdown)
  const assetChartData = useMemo(() => {
    if (!data) return [];
    return data.months.map(m => {
      const key = `${m.year}:${m.month}`;
      const obj: Record<string, number | string | null> = { label: m.label };
      for (const asset of data.assetDetails) {
        obj[asset.id] = asset.months[key] ?? null;
      }
      return obj;
    });
  }, [data]);

  // -------------------------------------------------------------------------
  // Summary card values
  // -------------------------------------------------------------------------

  const ytd      = data?.ytd;
  const retPct   = ytd?.returnPct;
  const pnl      = ytd?.pnl;
  const retTrend: "up" | "down" | "neutral" =
    retPct == null ? "neutral" : retPct >= 0 ? "up" : "down";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Last 3 months</SelectItem>
            <SelectItem value="6m">Last 6 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {data?.from && data?.to && (
          <span className="text-xs text-muted-foreground">
            {fmtYM(data.from)} – {fmtYM(data.to)}
          </span>
        )}

        {!loadingAssets && allAssets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-normal">
                {selectedIds.length > 0
                  ? <ListFilter className="h-3.5 w-3.5 text-primary" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                Assets
                {selectedIds.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary leading-4">
                    {selectedIds.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[240px] max-h-80 overflow-y-auto">
              {allAssets.map(a => (
                <DropdownMenuCheckboxItem
                  key={a.id}
                  checked={selectedIds.includes(a.id)}
                  onCheckedChange={() => toggleAsset(a.id)}
                  onSelect={e => e.preventDefault()}
                >
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">{a.currency}</span>
                </DropdownMenuCheckboxItem>
              ))}
              {selectedIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-xs text-muted-foreground"
                    onSelect={() => setSelectedIds([])}
                  >
                    Clear filter (show all)
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {data && (
          <span className="text-xs text-muted-foreground">
            {data.assetCount} asset{data.assetCount !== 1 ? "s" : ""}
            {selectedIds.length > 0 ? " selected" : " total"}
          </span>
        )}
      </div>

      {/* ---- Loading skeleton ---- */}
      {loadingData && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Current Balance"
              value={ytd?.currentBalance != null ? fmtBrl(ytd.currentBalance) : "—"}
              sub="BRL equivalent"
            />
            <StatCard
              label="YTD Return"
              value={retPct != null ? fmtPct(retPct) : "—"}
              sub="Compound"
              trend={retTrend}
            />
            <StatCard
              label="YTD P&L"
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
                <YAxis
                  yAxisId="bal"
                  orientation="left"
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11 }}
                  width={62}
                />
                <YAxis
                  yAxisId="cf"
                  orientation="right"
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11 }}
                  width={62}
                />
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
                <Bar
                  yAxisId="cf"
                  dataKey="contributions"
                  name="Contributions"
                  maxBarSize={24}
                  fill="#22c55e"
                  opacity={0.8}
                />
                <Bar
                  yAxisId="cf"
                  dataKey="withdrawals"
                  name="Withdrawals"
                  maxBarSize={24}
                  fill="#ef4444"
                  opacity={0.8}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Return charts side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monthly Return % */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Monthly Return %</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={v => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip content={<BalanceTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <Bar dataKey="returnPct" name="Return %" maxBarSize={28} radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={(d.returnPct ?? 0) >= 0 ? "#22c55e" : "#ef4444"}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative Return */}
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
                  <YAxis
                    tickFormatter={v => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip content={<BalanceTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeReturnPct"
                    name="Cumulative Return %"
                    stroke="#8b5cf6"
                    fill="url(#gradCum)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8b5cf6" }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-asset breakdown (only when multiple assets have data) */}
          {data.assetDetails.length > 1 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Asset Balance Breakdown (BRL)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={assetChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={62} />
                  <Tooltip content={<BalanceTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.assetDetails.map((asset, i) => (
                    <Line
                      key={asset.id}
                      type="monotone"
                      dataKey={asset.id}
                      name={asset.name}
                      stroke={ASSET_COLORS[i % ASSET_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

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
                  </tr>
                </thead>
                <tbody>
                  {data.months
                    .filter(m => m.balance !== null || m.contributions > 0 || m.withdrawals > 0 || m.income > 0)
                    .map(m => {
                      const hasReturn = m.returnPct !== null;
                      return (
                        <tr key={m.month} className="border-t hover:bg-muted/20 transition-colors">
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
                        </tr>
                      );
                    })}
                </tbody>
                {/* YTD totals row */}
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
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Performance methodology note */}
          <p className="text-xs text-muted-foreground">
            <strong>Return calculation:</strong> Monthly return = (End balance − Start balance − Contributions + Withdrawals + Income) ÷ Start balance.
            Cumulative return is compounded month-over-month. Balances are converted to BRL using the nearest prior exchange rate.
          </p>
        </>
      )}
    </div>
  );
}
