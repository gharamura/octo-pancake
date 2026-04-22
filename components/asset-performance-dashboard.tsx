"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ListFilter } from "lucide-react";
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
// Ledger tokens — mirrors CSS custom properties for Recharts (which needs
// literal hex) and for non-CSS color decisions.
// ---------------------------------------------------------------------------

const LM = {
  bg:        "#0a0a0a",
  surface:   "#0f0f0f",
  surface2:  "#141414",
  border:    "#1f1f1f",
  border2:   "#2a2a2a",
  fg:        "#e8e6df",
  fgMuted:   "#8a8680",
  fgDim:     "#555049",
  fgGhost:   "#3a3632",
  gain:      "#6ba368",
  gainSoft:  "rgba(107,163,104,0.10)",
  loss:      "#c84e4e",
  lossSoft:  "rgba(200,78,78,0.10)",
  pending:   "#c89c4e",
} as const;

// Muted earth-tone palette for pie slices — semantic-adjacent, not rainbow
const LM_PIE = [
  LM.fg,        // primary neutral
  LM.gain,      // credit
  LM.loss,      // debit / risk
  LM.pending,   // attention
  LM.fgMuted,   // muted
  "#7a8b6e",    // muted olive
  "#9d7a52",    // muted sand
  "#6b7f89",    // muted slate
  "#a88260",    // muted ochre
  LM.fgDim,
  "#8d6e5a",
  "#5e7a6a",
];

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const MONTHS_PTBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const RADIAN = Math.PI / 180;

type Period = "3m" | "6m" | "12m" | "12m_current" | "all";

function computeRange(period: Period): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");

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
  return `${MONTHS_PTBR[m - 1]}/${String(y).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtBrl(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtBrlRaw(val: number): string {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const PERIOD_LABEL: Record<Period, string> = {
  "3m":          "3M",
  "6m":          "6M",
  "12m":         "12M",
  "12m_current": "12M·AT",
  "all":         "MAX",
};

// ---------------------------------------------------------------------------
// Ledger primitives — hairline buttons, KPIs, chart tooltip
// ---------------------------------------------------------------------------

function LmFilterButton({
  active,
  children,
  onClick,
}: {
  active?:  boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
        active
          ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
          : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function LmKpi({
  label,
  value,
  sub,
  negative,
  emphasis,
  trend,
}: {
  label:     string;
  value:     string;
  sub?:      string;
  negative?: boolean;
  emphasis?: boolean;
  trend?:    "up" | "down" | "neutral";
}) {
  const color = trend === "down" || negative
    ? LM.loss
    : trend === "up"
      ? LM.fg
      : LM.fg;
  const subColor = trend === "up"
    ? LM.gain
    : trend === "down"
      ? LM.loss
      : LM.fgDim;

  return (
    <div className="min-w-0 border-r border-[color:var(--color-lm-border)] px-3.5 py-3 last:border-r-0">
      <div className="mb-1.5 text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">
        {label}
      </div>
      <div
        className="font-mono tabular-nums"
        style={{ color, fontSize: emphasis ? 22 : 15, letterSpacing: emphasis ? -0.5 : -0.2, lineHeight: 1 }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mt-1.5 font-mono text-[9px]"
          style={{ color: subColor }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// Custom Recharts tooltip — hairline dark surface with mono numbers
interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string; fill?: string; dataKey?: string }>;
  label?: string | number;
}

function LedgerTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[180px] space-y-0.5 border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] p-2.5 font-mono text-[11px] text-[color:var(--color-lm-fg)]"
    >
      <div className="mb-1 text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">
        {label}
      </div>
      {payload.map((entry, i) => {
        const isPct = entry.name?.toLowerCase().includes("return")
          || entry.name?.toLowerCase().includes("%")
          || entry.name?.toLowerCase().includes("retorno");
        const val = typeof entry.value === "number"
          ? (isPct ? fmtPct(entry.value) : fmtBrl(entry.value))
          : "—";
        return (
          <div key={i} className="flex justify-between gap-4 tabular-nums">
            <span style={{ color: entry.color ?? entry.fill }}>{entry.name}</span>
            <span>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

interface PieTooltipPayload {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function LedgerPieTooltip({ active, payload }: PieTooltipPayload) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="min-w-[160px] space-y-0.5 border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] p-2.5 font-mono text-[11px] text-[color:var(--color-lm-fg)]">
      <div className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">{fmtLabel(name)}</div>
      <div className="tabular-nums">{fmtBrl(value)}</div>
    </div>
  );
}

interface PieSliceLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function PieSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieSliceLabelProps) {
  if (!cx || !cy || midAngle == null || innerRadius == null || outerRadius == null || !percent) return null;
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill={LM.bg} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} fontFamily="JetBrains Mono, monospace">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function PieLegend({ data, total }: { data: { name: string; value: number }[]; total: number }) {
  return (
    <div className="mt-3 space-y-1">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 font-mono text-[10px]">
          <span className="h-2 w-2 shrink-0" style={{ background: LM_PIE[i % LM_PIE.length] }} />
          <span className="flex-1 truncate text-[color:var(--color-lm-fg-muted)]">{fmtLabel(d.name)}</span>
          <span className="shrink-0 tabular-nums text-[color:var(--color-lm-fg)]">{fmtBrl(d.value)}</span>
          <span className="w-10 shrink-0 text-right tabular-nums text-[color:var(--color-lm-fg-dim)]">
            {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[color:var(--color-lm-border)] px-3.5 py-2">
      <span className="text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">
        {children}
      </span>
      <span className="flex-1" />
      {right}
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] ${className ?? ""}`}>
      {children}
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
  ids:         string[];
  name:        string;
  currency:    string;
  accountName: string;
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

  const allAssetsMap = useMemo(
    () => new Map(allAssets.map(a => [a.id, a])),
    [allAssets]
  );

  const availableClasses = useMemo(
    () => Array.from(new Set(allAssets.map(a => a.assetClass).filter(Boolean) as string[])).sort(),
    [allAssets]
  );

  const allAccountsMap = useMemo(
    () => new Map(allAccounts.map(a => [a.id, a.name])),
    [allAccounts]
  );

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

  const effectiveIds = useMemo(() => {
    let filtered = allAssets;
    if (selectedAccountId) filtered = filtered.filter(a => a.accountId === selectedAccountId);
    if (selectedClasses.length > 0) filtered = filtered.filter(a => a.assetClass != null && selectedClasses.includes(a.assetClass));
    if (selectedIds.length > 0) filtered = filtered.filter(a => selectedIds.includes(a.id));
    return filtered.map(a => a.id);
  }, [allAssets, selectedAccountId, selectedClasses, selectedIds]);

  const hasActiveFilters = selectedAccountId != null || selectedClasses.length > 0 || selectedIds.length > 0;

  useEffect(() => {
    if (loadingAssets) return;
    setLoadingData(true);
    const { from, to } = computeRange(period);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    if (hasActiveFilters && effectiveIds.length < allAssets.length) {
      params.set("assetIds", effectiveIds.join(","));
    }
    fetch(`/api/assets/performance?${params}`)
      .then(r => r.json())
      .then((d: PerformanceResponse) => { setData(d); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [period, effectiveIds, hasActiveFilters, allAssets.length, loadingAssets]);

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
      contributions:          m.contributions > 0 ?  m.contributions : null,
      withdrawals:            m.withdrawals   > 0 ? -m.withdrawals   : null,
      netCashFlow:            m.contributions > 0 || m.withdrawals > 0 ? m.contributions - m.withdrawals : null,
      returnPct:              m.returnPct,
      cumulativeReturnPct:    m.cumulativeReturnPct,
      twrReturnPct:           m.twrReturnPct,
      twrCumulativeReturnPct: m.twrCumulativeReturnPct,
    }));
  }, [data]);

  const latestKey = useMemo(() => {
    if (!data?.to) return null;
    const [y, m] = data.to.split("-").map(Number);
    return `${y}:${m}`;
  }, [data]);

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

  // Summary values
  const ytd    = data?.ytd;
  const retPct = ytd?.returnPct;
  const twrPct = ytd?.twrReturnPct;
  const pnl    = ytd?.pnl;

  const activeFilterCount =
    (selectedAccountId ? 1 : 0) + selectedClasses.length + selectedIds.length;

  // Most recent month's Δ (vs prior balance) for hero sub-line
  const lastMonth = useMemo(() => {
    if (!data?.months) return null;
    const withBalance = data.months.filter(m => m.balance != null);
    return withBalance.length > 0 ? withBalance[withBalance.length - 1] : null;
  }, [data]);
  const lastMonthDelta =
    lastMonth && lastMonth.balance != null && lastMonth.prevBalance != null
      ? lastMonth.balance - lastMonth.prevBalance
      : null;
  const lastMonthDeltaPct =
    lastMonth && lastMonth.balance != null && lastMonth.prevBalance && lastMonth.prevBalance > 0
      ? ((lastMonth.balance - lastMonth.prevBalance) / lastMonth.prevBalance) * 100
      : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Filter prompt ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--color-lm-border)] bg-[color:var(--color-lm-bg)] px-3.5 py-2 font-mono text-[11px]">
        <span className="text-[color:var(--color-lm-gain)]">$</span>
        <span className="text-[color:var(--color-lm-fg)]">performance</span>

        {/* Period segmented */}
        <div className="flex border border-[color:var(--color-lm-border-2)]">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p, i, arr) => {
            const active = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-2.5 py-0.5 font-mono text-[10px] tracking-[1px] uppercase"
                style={{
                  color: active ? LM.bg : LM.fgMuted,
                  background: active ? LM.fg : "transparent",
                  borderRight: i < arr.length - 1 ? `1px solid ${LM.border2}` : "none",
                }}
              >
                {PERIOD_LABEL[p]}
              </button>
            );
          })}
        </div>

        {data?.from && data?.to && (
          <span className="text-[color:var(--color-lm-fg-dim)]">
            {fmtYM(data.from)} → {fmtYM(data.to)}
          </span>
        )}

        {/* Account filter */}
        {!loadingAssets && allAccounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
                  selectedAccountId
                    ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
                    : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
                }`}
              >
                {selectedAccountId
                  ? <ListFilter className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3 opacity-50" />}
                {selectedAccountId
                  ? (allAccounts.find(a => a.id === selectedAccountId)?.name ?? "conta")
                  : "conta"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-80 overflow-y-auto border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-[11px]">
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
                  <DropdownMenuItem className="justify-center text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]" onSelect={() => setSelectedAccountId(null)}>
                    limpar
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
              <button
                className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
                  selectedClasses.length > 0
                    ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
                    : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
                }`}
              >
                {selectedClasses.length > 0
                  ? <ListFilter className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3 opacity-50" />}
                classe
                {selectedClasses.length > 0 && (
                  <span className="bg-[color:var(--color-lm-fg)] px-1 text-[9px] font-semibold text-[color:var(--color-lm-bg)] leading-[14px]">
                    {selectedClasses.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] max-h-80 overflow-y-auto border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-[11px]">
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
                  <DropdownMenuItem className="justify-center text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]" onSelect={() => setSelectedClasses([])}>
                    limpar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Per-asset filter */}
        {!loadingAssets && groupedAssetOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex h-7 items-center gap-1.5 whitespace-nowrap border border-[color:var(--color-lm-border-2)] px-2.5 font-mono text-[10px] tracking-[1px] uppercase ${
                  selectedIds.length > 0
                    ? "bg-[rgba(255,255,255,0.04)] text-[color:var(--color-lm-fg)]"
                    : "text-[color:var(--color-lm-fg-muted)] hover:text-[color:var(--color-lm-fg)]"
                }`}
              >
                {selectedIds.length > 0
                  ? <ListFilter className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3 opacity-50" />}
                ativos
                {selectedIds.length > 0 && (
                  <span className="bg-[color:var(--color-lm-fg)] px-1 text-[9px] font-semibold text-[color:var(--color-lm-bg)] leading-[14px]">
                    {groupedAssetOptions.filter(g => g.ids.every(id => selectedIds.includes(id))).length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px] max-h-80 overflow-y-auto border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)] font-mono text-[11px]">
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
                    <span className="ml-2 text-[9px] text-[color:var(--color-lm-fg-muted)]">{g.currency}</span>
                    {g.ids.length > 1 && (
                      <span className="ml-1 text-[9px] text-[color:var(--color-lm-fg-dim)]">{g.accountName}</span>
                    )}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {selectedIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg-muted)]" onSelect={() => setSelectedIds([])}>
                    limpar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {activeFilterCount > 0 && (
          <LmFilterButton
            onClick={() => { setSelectedAccountId(null); setSelectedClasses([]); setSelectedIds([]); }}
          >
            limpar tudo
          </LmFilterButton>
        )}

        <span className="flex-1" />

        {data && (
          <span className="text-[color:var(--color-lm-fg-muted)]">
            {data.assetCount} ativo{data.assetCount !== 1 ? "s" : ""}
            {activeFilterCount > 0 ? " · filtrado" : ""}
          </span>
        )}
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Loading */}
        {loadingData && (
          <div className="space-y-3 p-3.5">
            <div className="grid grid-cols-7 gap-px bg-[color:var(--color-lm-border)]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse bg-[rgba(255,255,255,0.02)]" />
              ))}
            </div>
            <div className="h-64 animate-pulse bg-[rgba(255,255,255,0.02)]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-56 animate-pulse bg-[rgba(255,255,255,0.02)]" />
              <div className="h-56 animate-pulse bg-[rgba(255,255,255,0.02)]" />
            </div>
          </div>
        )}

        {/* No data */}
        {!loadingData && data && data.assetCount === 0 && (
          <div className="flex h-48 items-center justify-center text-[11px] text-[color:var(--color-lm-fg-muted)]">
            nenhum dado de saldo encontrado no período selecionado.
          </div>
        )}

        {/* Dashboard */}
        {!loadingData && data && data.assetCount > 0 && (
          <>
            {/* ── Hero + KPI band ──────────────────────────────────────── */}
            <div
              className="grid border-b border-[color:var(--color-lm-border-2)]"
              style={{ gridTemplateColumns: "1.5fr repeat(6, 1fr)" }}
            >
              {/* Hero: Patrimônio líquido */}
              <div className="min-w-0 border-r border-[color:var(--color-lm-border)] px-3.5 py-3">
                <div className="mb-1.5 text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]">
                  Patrimônio líquido
                </div>
                <div
                  className="font-mono tabular-nums"
                  style={{ color: LM.fg, fontSize: 24, letterSpacing: -0.5, lineHeight: 1 }}
                >
                  <span className="mr-1 text-[14px] text-[color:var(--color-lm-fg-dim)]">R$</span>
                  {ytd?.currentBalance != null ? fmtBrlRaw(ytd.currentBalance) : "—"}
                </div>
                {lastMonthDelta != null && (
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                    <span style={{ color: lastMonthDelta >= 0 ? LM.gain : LM.loss }}>
                      {lastMonthDelta >= 0 ? "↑" : "↓"} {lastMonthDelta >= 0 ? "+" : "−"}R$ {fmtBrlRaw(Math.abs(lastMonthDelta))}
                    </span>
                    {lastMonthDeltaPct != null && (
                      <span className="text-[color:var(--color-lm-fg-dim)]">
                        {lastMonth?.label ?? "último mês"} · {fmtPct(lastMonthDeltaPct)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <LmKpi
                label="Retorno simples"
                value={retPct != null ? fmtPct(retPct) : "—"}
                sub="P&L ÷ saldo inicial"
                trend={retPct == null ? "neutral" : retPct >= 0 ? "up" : "down"}
                emphasis
              />
              <LmKpi
                label="TWR"
                value={twrPct != null ? fmtPct(twrPct) : "—"}
                sub="tempo-ponderado"
                trend={twrPct == null ? "neutral" : twrPct >= 0 ? "up" : "down"}
              />
              <LmKpi
                label="P&L"
                value={pnl != null ? `${pnl >= 0 ? "+" : "−"}R$ ${fmtBrlRaw(Math.abs(pnl))}` : "—"}
                sub="lucro / prejuízo"
                trend={pnl == null ? "neutral" : pnl >= 0 ? "up" : "down"}
              />
              <LmKpi
                label="Aportes"
                value={ytd ? fmtBrl(ytd.contributions) : "—"}
                sub="total investido"
              />
              <LmKpi
                label="Resgates"
                value={ytd ? fmtBrl(ytd.withdrawals) : "—"}
                sub="total resgatado"
                negative={ytd != null && ytd.withdrawals > 0}
              />
              <LmKpi
                label="Proventos"
                value={ytd ? fmtBrl(ytd.income) : "—"}
                sub="juros / dividendos"
              />
            </div>

            {/* ── Balance + Cash Flow chart ────────────────────────────── */}
            <Panel className="mx-3.5 mt-3.5">
              <SectionTitle>NAV · saldo e fluxos</SectionTitle>
              <div className="px-3.5 pb-3 pt-4">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 55, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={LM.fg} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={LM.fg} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={LM.border} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                      axisLine={{ stroke: LM.border }}
                      tickLine={{ stroke: LM.border }}
                    />
                    <YAxis
                      yAxisId="bal"
                      orientation="left"
                      tickFormatter={fmtK}
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                      axisLine={{ stroke: LM.border }}
                      tickLine={{ stroke: LM.border }}
                      width={56}
                    />
                    <YAxis
                      yAxisId="cf"
                      orientation="right"
                      tickFormatter={fmtK}
                      tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                      axisLine={{ stroke: LM.border }}
                      tickLine={{ stroke: LM.border }}
                      width={52}
                    />
                    <Tooltip content={<LedgerTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                    <Legend
                      wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: LM.fgMuted, letterSpacing: 1, textTransform: "uppercase" }}
                      iconSize={8}
                      iconType="square"
                    />
                    <Area
                      yAxisId="bal"
                      type="monotone"
                      dataKey="balance"
                      name="saldo (BRL)"
                      fill="url(#gradBalance)"
                      stroke={LM.fg}
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                    <Bar yAxisId="cf" dataKey="contributions" name="aportes"  maxBarSize={18} fill={LM.gain} opacity={0.85} />
                    <Bar yAxisId="cf" dataKey="withdrawals"   name="resgates" maxBarSize={18} fill={LM.loss} opacity={0.85} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* ── Return charts ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3.5 px-3.5 pt-3.5 md:grid-cols-2">
              <Panel>
                <SectionTitle>Retorno mensal</SectionTitle>
                <div className="px-3.5 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={LM.border} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                        axisLine={{ stroke: LM.border }}
                        tickLine={{ stroke: LM.border }}
                      />
                      <YAxis
                        tickFormatter={v => `${v.toFixed(1)}%`}
                        tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                        axisLine={{ stroke: LM.border }}
                        tickLine={{ stroke: LM.border }}
                        width={48}
                      />
                      <Tooltip content={<LedgerTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                      <ReferenceLine y={0} stroke={LM.border2} strokeWidth={1} />
                      <Bar dataKey="returnPct" name="retorno %" maxBarSize={22}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={(d.returnPct ?? 0) >= 0 ? LM.fg : LM.loss} opacity={0.9} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel>
                <SectionTitle>Retorno acumulado</SectionTitle>
                <div className="px-3.5 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradCum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={LM.fg} stopOpacity={0.12} />
                          <stop offset="95%" stopColor={LM.fg} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke={LM.border} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                        axisLine={{ stroke: LM.border }}
                        tickLine={{ stroke: LM.border }}
                      />
                      <YAxis
                        tickFormatter={v => `${v.toFixed(1)}%`}
                        tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: LM.fgMuted }}
                        axisLine={{ stroke: LM.border }}
                        tickLine={{ stroke: LM.border }}
                        width={48}
                      />
                      <Tooltip content={<LedgerTooltip />} cursor={{ stroke: LM.border2 }} />
                      <Legend
                        wrapperStyle={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: LM.fgMuted, letterSpacing: 1, textTransform: "uppercase" }}
                        iconSize={8}
                        iconType="square"
                      />
                      <ReferenceLine y={0} stroke={LM.border2} strokeWidth={1} />
                      <Area
                        type="monotone"
                        dataKey="cumulativeReturnPct"
                        name="simples %"
                        stroke={LM.fg}
                        fill="url(#gradCum)"
                        strokeWidth={1}
                        dot={{ r: 2, fill: LM.fg, stroke: LM.fg }}
                        connectNulls={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="twrCumulativeReturnPct"
                        name="twr %"
                        stroke={LM.pending}
                        fill="none"
                        strokeWidth={1}
                        strokeDasharray="4 2"
                        dot={{ r: 2, fill: LM.pending, stroke: LM.pending }}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* ── Monthly breakdown ─────────────────────────────────── */}
            <div className="mx-3.5 mt-3.5 border border-[color:var(--color-lm-border-2)]">
              <SectionTitle>Breakdown mensal</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-[color:var(--color-lm-surface)]">
                      {["Mês", "Saldo", "vs Anterior", "Aportes", "Resgates", "Proventos", "P&L", "Retorno %", "Acumulado", "TWR Acum."].map((h, i) => (
                        <th
                          key={i}
                          className="whitespace-nowrap border-b border-[color:var(--color-lm-border-2)] px-3 py-1.5 text-[9px] uppercase tracking-[1.2px] text-[color:var(--color-lm-fg-dim)]"
                          style={{ textAlign: i === 0 ? "left" : "right" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.months
                      .filter(m => m.balance !== null || m.contributions > 0 || m.withdrawals > 0 || m.income > 0)
                      .map((m, rowIdx) => {
                        const hasReturn = m.returnPct !== null;
                        const cellBase = "px-3 py-1 tabular-nums whitespace-nowrap";
                        return (
                          <tr
                            key={`${m.year}:${m.month}`}
                            className="border-b border-[color:var(--color-lm-border)]"
                            style={{ background: rowIdx % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent" }}
                          >
                            <td className={`${cellBase} text-left text-[color:var(--color-lm-fg)]`}>{m.label}</td>
                            <td className={`${cellBase} text-right`} style={{ color: m.balance != null ? LM.fg : LM.fgGhost }}>
                              {m.balance != null ? fmtBrl(m.balance) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`}>
                              {m.balance != null && m.prevBalance != null ? (
                                (() => {
                                  const diff = m.balance - m.prevBalance;
                                  return (
                                    <span style={{ color: diff >= 0 ? LM.fg : LM.loss }}>
                                      {diff >= 0 ? "+" : ""}{fmtBrl(diff)}
                                    </span>
                                  );
                                })()
                              ) : <span className="text-[color:var(--color-lm-fg-ghost)]">—</span>}
                            </td>
                            <td className={`${cellBase} text-right`} style={{
                              color:      m.contributions > 0 ? LM.gain      : LM.fgGhost,
                              background: m.contributions > 0 ? LM.gainSoft  : "transparent",
                            }}>
                              {m.contributions > 0 ? fmtBrl(m.contributions) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{
                              color:      m.withdrawals > 0 ? LM.loss      : LM.fgGhost,
                              background: m.withdrawals > 0 ? LM.lossSoft  : "transparent",
                            }}>
                              {m.withdrawals > 0 ? fmtBrl(m.withdrawals) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{ color: m.income > 0 ? LM.pending : LM.fgGhost }}>
                              {m.income > 0 ? fmtBrl(m.income) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{ color: m.pnl == null ? LM.fgGhost : m.pnl >= 0 ? LM.fg : LM.loss }}>
                              {m.pnl != null ? `${m.pnl >= 0 ? "+" : ""}${fmtBrl(m.pnl)}` : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{ color: !hasReturn ? LM.fgGhost : m.returnPct! >= 0 ? LM.fg : LM.loss }}>
                              {hasReturn ? fmtPct(m.returnPct!) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{ color: m.cumulativeReturnPct == null ? LM.fgGhost : m.cumulativeReturnPct >= 0 ? LM.fg : LM.loss }}>
                              {m.cumulativeReturnPct != null ? fmtPct(m.cumulativeReturnPct) : "—"}
                            </td>
                            <td className={`${cellBase} text-right`} style={{ color: m.twrCumulativeReturnPct == null ? LM.fgGhost : m.twrCumulativeReturnPct >= 0 ? LM.pending : LM.loss }}>
                              {m.twrCumulativeReturnPct != null ? fmtPct(m.twrCumulativeReturnPct) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-surface)]">
                      <td className="px-3 py-1.5 text-left text-[10px] uppercase tracking-[1px] text-[color:var(--color-lm-fg)]">YTD Σ</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[color:var(--color-lm-fg)]">
                        {ytd?.currentBalance != null ? fmtBrl(ytd.currentBalance) : "—"}
                      </td>
                      <td />
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: LM.gain }}>
                        {ytd && ytd.contributions > 0 ? fmtBrl(ytd.contributions) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: LM.loss }}>
                        {ytd && ytd.withdrawals > 0 ? fmtBrl(ytd.withdrawals) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: LM.pending }}>
                        {ytd && ytd.income > 0 ? fmtBrl(ytd.income) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: ytd?.pnl == null ? LM.fgGhost : ytd.pnl >= 0 ? LM.fg : LM.loss }}>
                        {ytd?.pnl != null ? `${ytd.pnl >= 0 ? "+" : ""}${fmtBrl(ytd.pnl)}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: ytd?.returnPct == null ? LM.fgGhost : ytd.returnPct >= 0 ? LM.fg : LM.loss }}>
                        {ytd?.returnPct != null ? fmtPct(ytd.returnPct) : "—"}
                      </td>
                      <td />
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: ytd?.twrReturnPct == null ? LM.fgGhost : ytd.twrReturnPct >= 0 ? LM.pending : LM.loss }}>
                        {ytd?.twrReturnPct != null ? fmtPct(ytd.twrReturnPct) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <p className="mx-3.5 mt-3 font-mono text-[10px] leading-relaxed text-[color:var(--color-lm-fg-muted)]">
              <span className="text-[color:var(--color-lm-fg)]">Retorno simples</span>: P&L acumulado ÷ saldo inicial.{" "}
              <span className="text-[color:var(--color-lm-fg)]">TWR (retorno tempo-ponderado)</span>: compõe os sub-períodos mensais. Aportes considerados no início do mês seguinte. Saldos convertidos em BRL pela taxa de câmbio mais próxima.
            </p>

            {/* ── Pie charts ────────────────────────────────────────── */}
            {(pieByClass.length > 0 || pieByRisk.length > 0 || pieByAccount.length > 0) && (
              <div className="grid grid-cols-1 gap-3.5 px-3.5 py-3.5 md:grid-cols-3">
                {pieByClass.length > 0 && (
                  <Panel>
                    <SectionTitle>Saldo · classe</SectionTitle>
                    <div className="p-3.5">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieByClass}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                            label={PieSliceLabel}
                            stroke={LM.bg}
                            strokeWidth={1}
                          >
                            {pieByClass.map((_, i) => (
                              <Cell key={i} fill={LM_PIE[i % LM_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<LedgerPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <PieLegend data={pieByClass} total={pieClassTotal} />
                    </div>
                  </Panel>
                )}

                {pieByRisk.length > 0 && (
                  <Panel>
                    <SectionTitle>Saldo · fator de risco</SectionTitle>
                    <div className="p-3.5">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieByRisk}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                            label={PieSliceLabel}
                            stroke={LM.bg}
                            strokeWidth={1}
                          >
                            {pieByRisk.map((_, i) => (
                              <Cell key={i} fill={LM_PIE[i % LM_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<LedgerPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <PieLegend data={pieByRisk} total={pieRiskTotal} />
                    </div>
                  </Panel>
                )}

                {pieByAccount.length > 0 && (
                  <Panel>
                    <SectionTitle>Saldo · conta</SectionTitle>
                    <div className="p-3.5">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieByAccount}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                            label={PieSliceLabel}
                            stroke={LM.bg}
                            strokeWidth={1}
                          >
                            {pieByAccount.map((_, i) => (
                              <Cell key={i} fill={LM_PIE[i % LM_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<LedgerPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <PieLegend data={pieByAccount} total={pieAccountTotal} />
                    </div>
                  </Panel>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      {data && data.assetCount > 0 && (
        <div className="flex items-center gap-5 border-t border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.5px] text-[color:var(--color-lm-fg-dim)]">
          <span>
            {data.assetCount} ativos · {data.months.length} meses
          </span>
          <span className="flex-1" />
          <span>
            Σ aportes <span className="text-[color:var(--color-lm-gain)]">{ytd ? fmtBrl(ytd.contributions) : "—"}</span>
          </span>
          <span>
            Σ resgates <span className="text-[color:var(--color-lm-loss)]">{ytd ? fmtBrl(ytd.withdrawals) : "—"}</span>
          </span>
          <span>
            retorno <span className="text-[color:var(--color-lm-fg)]">{retPct != null ? fmtPct(retPct) : "—"}</span>
          </span>
        </div>
      )}
    </div>
  );
}
