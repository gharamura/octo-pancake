"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountType } from "@/lib/db/schema";
import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// Groups in display order; "result" is synthetic and handled separately
const SECTIONS: { type: AccountType; label: string; positiveIsGood: boolean }[] = [
  { type: "income",    label: "Income",      positiveIsGood: true  },
  { type: "expense",   label: "Expenses",    positiveIsGood: false },
  { type: "liability", label: "Liabilities", positiveIsGood: false },
  { type: "asset",     label: "Assets",      positiveIsGood: true  },
  { type: "equity",    label: "Equity",      positiveIsGood: true  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoaReportRow {
  code:       string;
  name:       string;
  type:       AccountType;
  parentCode: string | null;
  months:     Record<number, number>;
  total:      number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(val: number): string {
  if (val === 0) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valColor(val: number, positiveIsGood: boolean): string {
  if (val === 0) return "text-muted-foreground";
  if (val > 0) return positiveIsGood
    ? "text-green-700 dark:text-green-400"
    : "text-red-600   dark:text-red-400";
  return positiveIsGood
    ? "text-red-600   dark:text-red-400"
    : "text-green-700 dark:text-green-400";
}

function mv(row: CoaReportRow, m: number): number {
  return (row.months as Record<string, number>)[String(m)] ?? 0;
}

function sectionMonthSum(rows: CoaReportRow[], m: number): number {
  return rows.reduce((s, r) => s + mv(r, m), 0);
}

function sectionTotal(rows: CoaReportRow[]): number {
  return rows.reduce((s, r) => s + r.total, 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TD_STICKY =
  "sticky left-0 z-10 whitespace-nowrap px-3 py-2";
const TH_STICKY =
  "sticky left-0 z-20 whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide";
const TD_NUM =
  "px-3 py-2 text-right tabular-nums text-sm";
const TD_NUM_TOTAL =
  "px-3 py-2 text-right tabular-nums text-sm font-semibold border-l";

function AccountRow({
  row,
  positiveIsGood,
  bg,
}: {
  row:            CoaReportRow;
  positiveIsGood: boolean;
  bg:             string;
}) {
  return (
    <tr className={`border-b transition-colors hover:brightness-95 ${bg}`}>
      <td className={`${TD_STICKY} ${bg}`}>
        <span className="font-mono text-xs text-muted-foreground mr-2">{row.code}</span>
        <span className="text-sm font-medium">{row.name}</span>
      </td>
      {MONTHS.map((_, i) => {
        const val = mv(row, i + 1);
        return (
          <td key={i} className={`${TD_NUM} ${valColor(val, positiveIsGood)}`}>
            {fmt(val)}
          </td>
        );
      })}
      <td className={`${TD_NUM_TOTAL} ${valColor(row.total, positiveIsGood)}`}>
        {fmt(row.total)}
      </td>
    </tr>
  );
}

function SectionRows({
  label,
  rows,
  positiveIsGood,
}: {
  label:          string;
  rows:           CoaReportRow[];
  positiveIsGood: boolean;
}) {
  if (rows.length === 0) return null;

  const bg    = "bg-background";
  const subBg = "bg-muted/30";

  return (
    <>
      {/* Section header */}
      <tr>
        <td
          colSpan={15}
          className="bg-muted/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </td>
      </tr>

      {/* Account rows */}
      {rows.map((row) => (
        <AccountRow
          key={row.code}
          row={row}
          positiveIsGood={positiveIsGood}
          bg={bg}
        />
      ))}

      {/* Section subtotal */}
      <tr className={`border-b-2 border-t ${subBg} font-semibold`}>
        <td className={`${TD_STICKY} ${subBg} text-sm`}>
          {label} Total
        </td>
        {MONTHS.map((_, i) => {
          const val = sectionMonthSum(rows, i + 1);
          return (
            <td key={i} className={`${TD_NUM} font-semibold ${valColor(val, positiveIsGood)}`}>
              {fmt(val)}
            </td>
          );
        })}
        <td className={`${TD_NUM_TOTAL} font-bold ${valColor(sectionTotal(rows), positiveIsGood)}`}>
          {fmt(sectionTotal(rows))}
        </td>
      </tr>
    </>
  );
}

function ResultRow({
  incomeRows,
  expenseRows,
}: {
  incomeRows:  CoaReportRow[];
  expenseRows: CoaReportRow[];
}) {
  const resultBg = "bg-muted/50";
  return (
    <tr className={`border-y-2 ${resultBg}`}>
      <td className={`${TD_STICKY} ${resultBg} text-sm font-bold`}>
        Result
      </td>
      {MONTHS.map((_, i) => {
        const m   = i + 1;
        const val = sectionMonthSum(incomeRows, m) + sectionMonthSum(expenseRows, m);
        return (
          <td key={i} className={`${TD_NUM} font-bold ${valColor(val, true)}`}>
            {fmt(val)}
          </td>
        );
      })}
      <td className={`${TD_NUM_TOTAL} font-bold ${valColor(
        sectionTotal(incomeRows) + sectionTotal(expenseRows),
        true
      )}`}>
        {fmt(sectionTotal(incomeRows) + sectionTotal(expenseRows))}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CoaReport() {
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [data,    setData]    = useState<CoaReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/coa?year=${year}`)
      .then((r) => r.json())
      .then(({ report }: { report: CoaReportRow[] }) => {
        setData(report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  const byType = useMemo(() => {
    const map: Partial<Record<AccountType, CoaReportRow[]>> = {};
    for (const row of data) {
      if (!map[row.type]) map[row.type] = [];
      map[row.type]!.push(row);
    }
    return map;
  }, [data]);

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
          No transactions found for {year}.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className={`${TH_STICKY} bg-muted/40 min-w-[260px]`}>
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
              <SectionRows
                label="Income"
                rows={byType.income ?? []}
                positiveIsGood={true}
              />
              <SectionRows
                label="Expenses"
                rows={byType.expense ?? []}
                positiveIsGood={false}
              />
              {(byType.income?.length || byType.expense?.length) ? (
                <ResultRow
                  incomeRows={byType.income ?? []}
                  expenseRows={byType.expense ?? []}
                />
              ) : null}
              <SectionRows
                label="Liabilities"
                rows={byType.liability ?? []}
                positiveIsGood={false}
              />
              <SectionRows
                label="Assets"
                rows={byType.asset ?? []}
                positiveIsGood={true}
              />
              <SectionRows
                label="Equity"
                rows={byType.equity ?? []}
                positiveIsGood={true}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
