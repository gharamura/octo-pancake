"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fragment, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const COL_SPAN = 14; // 1 (name) + 12 (months) + 1 (total)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthData {
  received: number;
  paid:     number;
}

interface AccountRow {
  id:            string;
  name:          string;
  type:          string;
  months:        Record<number, MonthData>;
  totalReceived: number;
  totalPaid:     number;
}

interface ReportData {
  year:        number;
  assets:      AccountRow[];
  liabilities: AccountRow[];
}

// ---------------------------------------------------------------------------
// Helpers (module-level — pure functions)
// ---------------------------------------------------------------------------

function fmt(val: number): string {
  if (val === 0) return "—";
  return val.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function colorPos(val: number): string {
  return val === 0
    ? "text-muted-foreground"
    : "text-green-700 dark:text-green-400";
}

function colorNeg(val: number): string {
  return val === 0
    ? "text-muted-foreground"
    : "text-red-600 dark:text-red-400";
}

function colorNet(val: number): string {
  if (val === 0) return "text-muted-foreground";
  return val > 0
    ? "text-green-700 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
}

function mv(row: AccountRow, m: number): MonthData {
  return (row.months as Record<string, MonthData>)[String(m)] ?? { received: 0, paid: 0 };
}

// ---------------------------------------------------------------------------
// CSS constants
// ---------------------------------------------------------------------------

const TD_STICKY =
  "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5";
const TH_STICKY =
  "sticky left-0 z-20 whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide";
const TD_NUM =
  "px-3 py-1.5 text-right tabular-nums text-sm";
const TD_TOTAL =
  "px-3 py-1.5 text-right tabular-nums text-sm font-semibold border-l";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountReport() {
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/accounts?year=${year}`)
      .then((r) => r.json())
      .then((d: ReportData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const all = data ? [...data.assets, ...data.liabilities] : [];

  function netMonth(m: number) {
    return all.reduce((s, a) => s + mv(a, m).received - mv(a, m).paid, 0);
  }

  const netTotal = all.reduce((s, a) => s + a.totalReceived - a.totalPaid, 0);

  // ---------------------------------------------------------------------------
  // Section aggregate helpers
  // ---------------------------------------------------------------------------

  function secMonthIn(accs: AccountRow[], m: number)  { return accs.reduce((s, a) => s + mv(a, m).received, 0); }
  function secMonthOut(accs: AccountRow[], m: number) { return accs.reduce((s, a) => s + mv(a, m).paid,     0); }
  function secTotIn(accs: AccountRow[])               { return accs.reduce((s, a) => s + a.totalReceived,    0); }
  function secTotOut(accs: AccountRow[])              { return accs.reduce((s, a) => s + a.totalPaid,        0); }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderSectionHeader(label: string) {
    return (
      <tr className="bg-muted/20 border-y">
        <td
          colSpan={COL_SPAN}
          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </td>
      </tr>
    );
  }

  function renderAccountRows(acc: AccountRow) {
    return (
      <>
        {/* In row */}
        <tr className="bg-background transition-colors hover:brightness-95">
          <td className={`${TD_STICKY} bg-background`}>
            <span className="text-sm font-medium">{acc.name}</span>
            <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
              In
            </span>
          </td>
          {MONTHS.map((_, i) => {
            const val = mv(acc, i + 1).received;
            return (
              <td key={i} className={`${TD_NUM} ${colorPos(val)}`}>
                {fmt(val)}
              </td>
            );
          })}
          <td className={`${TD_TOTAL} ${colorPos(acc.totalReceived)}`}>
            {fmt(acc.totalReceived)}
          </td>
        </tr>

        {/* Out row */}
        <tr className="border-b bg-background transition-colors hover:brightness-95">
          <td className={`${TD_STICKY} bg-background`}>
            <span className="ml-3 text-[9px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
              Out
            </span>
          </td>
          {MONTHS.map((_, i) => {
            const val = mv(acc, i + 1).paid;
            return (
              <td key={i} className={`${TD_NUM} ${colorNeg(val)}`}>
                {fmt(val)}
              </td>
            );
          })}
          <td className={`${TD_TOTAL} ${colorNeg(acc.totalPaid)}`}>
            {fmt(acc.totalPaid)}
          </td>
        </tr>
      </>
    );
  }

  function renderSectionTotals(label: string, accs: AccountRow[]) {
    const totIn  = secTotIn(accs);
    const totOut = secTotOut(accs);
    return (
      <>
        <tr className="bg-muted/30">
          <td className={`${TD_STICKY} bg-muted/30 text-xs font-bold text-muted-foreground`}>
            {label} — In
          </td>
          {MONTHS.map((_, i) => {
            const val = secMonthIn(accs, i + 1);
            return (
              <td key={i} className={`${TD_NUM} font-semibold ${colorPos(val)}`}>
                {fmt(val)}
              </td>
            );
          })}
          <td className={`${TD_TOTAL} font-bold ${colorPos(totIn)}`}>
            {fmt(totIn)}
          </td>
        </tr>
        <tr className="border-b-2 bg-muted/30">
          <td className={`${TD_STICKY} bg-muted/30 text-xs font-bold text-muted-foreground`}>
            {label} — Out
          </td>
          {MONTHS.map((_, i) => {
            const val = secMonthOut(accs, i + 1);
            return (
              <td key={i} className={`${TD_NUM} font-semibold ${colorNeg(val)}`}>
                {fmt(val)}
              </td>
            );
          })}
          <td className={`${TD_TOTAL} font-bold ${colorNeg(totOut)}`}>
            {fmt(totOut)}
          </td>
        </tr>
      </>
    );
  }

  const isEmpty = data && all.length === 0;

  return (
    <div className="space-y-4">
      {/* Year picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Year</span>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          No transactions found for {year}.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className={`${TH_STICKY} bg-muted/40 min-w-[200px]`}>
                  Account
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide min-w-[90px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide min-w-[110px] border-l">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── Assets ── */}
              {data!.assets.length > 0 && (
                <>
                  {renderSectionHeader("Assets")}
                  {data!.assets.map((acc) => (
                    <Fragment key={acc.id}>{renderAccountRows(acc)}</Fragment>
                  ))}
                  {renderSectionTotals("Assets", data!.assets)}
                </>
              )}

              {/* ── Liabilities ── */}
              {data!.liabilities.length > 0 && (
                <>
                  {renderSectionHeader("Liabilities")}
                  {data!.liabilities.map((acc) => (
                    <Fragment key={acc.id}>{renderAccountRows(acc)}</Fragment>
                  ))}
                  {renderSectionTotals("Liabilities", data!.liabilities)}
                </>
              )}

              {/* ── Net Savings ── */}
              <tr className="border-t-2 bg-muted/50">
                <td className={`${TD_STICKY} bg-muted/50 text-sm font-bold`}>
                  Net Savings
                </td>
                {MONTHS.map((_, i) => {
                  const val = netMonth(i + 1);
                  return (
                    <td key={i} className={`${TD_NUM} font-semibold ${colorNet(val)}`}>
                      {fmt(val)}
                    </td>
                  );
                })}
                <td className={`${TD_TOTAL} font-bold ${colorNet(netTotal)}`}>
                  {fmt(netTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
