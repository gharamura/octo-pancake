"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecipientReportRow {
  id:     string;
  name:   string;
  months: Record<number, number>;
  total:  number;
}

type SortKey = "name" | "total" | number; // number = month (1–12)
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(val: number): string {
  if (val === 0) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function valColor(val: number): string {
  if (val === 0) return "text-muted-foreground";
  return val > 0
    ? "text-green-700 dark:text-green-400"
    : "text-red-600   dark:text-red-400";
}

function mv(row: RecipientReportRow, m: number): number {
  return (row.months as Record<string, number>)[String(m)] ?? 0;
}

function grandMonthSum(rows: RecipientReportRow[], m: number): number {
  return rows.reduce((s, r) => s + mv(r, m), 0);
}

function grandTotal(rows: RecipientReportRow[]): number {
  return rows.reduce((s, r) => s + r.total, 0);
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return sortDir === "asc"
    ? <ArrowUp   className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

// ---------------------------------------------------------------------------
// CSS helpers
// ---------------------------------------------------------------------------

const TD_STICKY =
  "sticky left-0 z-10 whitespace-nowrap px-3 py-2";
const TH_STICKY =
  "sticky left-0 z-20 whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide";
const TD_NUM =
  "px-3 py-2 text-right tabular-nums text-sm";
const TD_NUM_TOTAL =
  "px-3 py-2 text-right tabular-nums text-sm font-semibold border-l";
const TH_SORT =
  "cursor-pointer select-none hover:bg-muted/60 transition-colors";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RecipientReport() {
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [data,    setData]    = useState<RecipientReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/recipients?year=${year}`)
      .then((r) => r.json())
      .then(({ report }: { report: RecipientReportRow[] }) => {
        setData(report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name")  return factor * a.name.localeCompare(b.name);
      if (sortKey === "total") return factor * (a.total - b.total);
      return factor * (mv(a, sortKey) - mv(b, sortKey));
    });
  }, [data, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* Year picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Year</span>
        <Select
          value={String(year)}
          onValueChange={(v) => setYear(Number(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          No matched recipients found for {year}.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th
                  onClick={() => handleSort("name")}
                  className={`${TH_STICKY} bg-muted/40 min-w-[220px] ${TH_SORT}`}
                >
                  Recipient
                  <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                {MONTHS.map((m, i) => (
                  <th
                    key={m}
                    onClick={() => handleSort(i + 1)}
                    className={`px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide min-w-[90px] ${TH_SORT}`}
                  >
                    {m}
                    <SortIcon col={i + 1} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                <th
                  onClick={() => handleSort("total")}
                  className={`px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide min-w-[110px] border-l ${TH_SORT}`}
                >
                  Total
                  <SortIcon col="total" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  className="border-b bg-background transition-colors hover:brightness-95"
                >
                  <td className={`${TD_STICKY} bg-background`}>
                    <span className="text-sm font-medium">{row.name}</span>
                  </td>
                  {MONTHS.map((_, i) => {
                    const val = mv(row, i + 1);
                    return (
                      <td key={i} className={`${TD_NUM} ${valColor(val)}`}>
                        {fmt(val)}
                      </td>
                    );
                  })}
                  <td className={`${TD_NUM_TOTAL} ${valColor(row.total)}`}>
                    {fmt(row.total)}
                  </td>
                </tr>
              ))}

              {/* Grand total row */}
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td className={`${TD_STICKY} bg-muted/50 text-sm font-bold`}>
                  Total
                </td>
                {MONTHS.map((_, i) => {
                  const val = grandMonthSum(data, i + 1);
                  return (
                    <td key={i} className={`${TD_NUM} font-semibold ${valColor(val)}`}>
                      {fmt(val)}
                    </td>
                  );
                })}
                <td className={`${TD_NUM_TOTAL} font-bold ${valColor(grandTotal(data))}`}>
                  {fmt(grandTotal(data))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
