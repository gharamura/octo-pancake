import type { RecurringTransaction, CashFlowSpot } from "@/lib/db/schema";

// Minimal shape accepted by the calculator — satisfied by both RecurringTransaction and CashFlowSpot
type CashFlowEntry = {
  id: string;
  name: string;
  amount: string | number;
  type: string;
  accountId: string;
  coaCode?: string | null;
  dayOfMonth: number;
  isSpot?: boolean;
  pairId?: string | null;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
  currency: string;
}

export interface DayProjection {
  date: string; // ISO date YYYY-MM-DD
  dayOfMonth: number;
  transactions: {
    recurringId: string;
    name: string;
    amount: number; // positive = inflow, negative = outflow
    accountId: string;
    coaCode?: string;
    type: "income" | "expense";
    isSpot?: boolean;
    pairId?: string;
  }[];
  balances: Record<string, number>; // accountId -> running balance
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  startBalance: number;
  endBalance: number;
  minBalance: number;
  minBalanceDay: number;
  goesNegative: boolean;
  negativeFromDay?: number;
  shortfall: number; // how much is needed (0 if never negative)
  negativeDaysCount: number; // total days in the month where balance < 0
}

export interface CashFlowResult {
  month: string; // "YYYY-MM"
  timeline: DayProjection[];
  accountSummaries: AccountSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function calculateCashFlow(
  balances: AccountBalance[],
  recurring: (RecurringTransaction | CashFlowSpot | CashFlowEntry)[],
  year: number,
  month: number // 1-based
): CashFlowResult {
  const totalDays = daysInMonth(year, month);
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Build running balance map keyed by accountId
  const runningBalances: Record<string, number> = {};
  for (const b of balances) {
    runningBalances[b.accountId] = b.balance;
  }

  // Account name lookup
  const accountNames: Record<string, string> = {};
  for (const b of balances) {
    accountNames[b.accountId] = b.accountName;
  }

  // Clamp day-of-month to totalDays so >28 transactions land on last day
  // We group recurring by their effective day
  const effectiveDayMap: Record<number, CashFlowEntry[]> = {};
  for (let d = 1; d <= totalDays; d++) effectiveDayMap[d] = [];

  for (const rt of recurring) {
    const effectiveDay = Math.min(rt.dayOfMonth, totalDays);
    effectiveDayMap[effectiveDay].push(rt as CashFlowEntry);
  }

  // Build timeline
  const timeline: DayProjection[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const txsForDay = effectiveDayMap[day];
    const projectedTxs: DayProjection["transactions"] = [];

    for (const rt of txsForDay) {
      const amount = parseFloat(rt.amount as string);
      const signed = rt.type === "income" ? amount : -amount;

      // Apply to running balance
      if (runningBalances[rt.accountId] !== undefined) {
        runningBalances[rt.accountId] += signed;
      } else {
        runningBalances[rt.accountId] = signed;
      }

      projectedTxs.push({
        recurringId: rt.id,
        name: rt.name,
        amount: signed,
        accountId: rt.accountId,
        coaCode: rt.coaCode ?? undefined,
        type: rt.type as "income" | "expense",
        isSpot:  rt.isSpot  ?? false,
        pairId:  rt.pairId  ?? undefined,
      });
    }

    timeline.push({
      date: isoDate(year, month, day),
      dayOfMonth: day,
      transactions: projectedTxs,
      balances: { ...runningBalances },
    });
  }

  // Build per-account summaries
  const accountSummaries: AccountSummary[] = balances.map((b) => {
    const startBalance = b.balance;
    const endBalance = runningBalances[b.accountId] ?? startBalance;

    let minBalance = startBalance;
    let minBalanceDay = 0;
    let goesNegative = false;
    let negativeFromDay: number | undefined;
    let shortfall = 0;
    let negativeDaysCount = 0;

    for (const day of timeline) {
      const bal = day.balances[b.accountId] ?? startBalance;
      if (bal < minBalance) {
        minBalance = bal;
        minBalanceDay = day.dayOfMonth;
      }
      if (bal < 0) {
        negativeDaysCount++;
        if (!goesNegative) {
          goesNegative = true;
          negativeFromDay = day.dayOfMonth;
        }
      }
    }

    if (goesNegative) {
      shortfall = Math.abs(minBalance);
    }

    return {
      accountId: b.accountId,
      accountName: b.accountName,
      startBalance,
      endBalance,
      minBalance,
      minBalanceDay,
      goesNegative,
      negativeFromDay,
      shortfall,
      negativeDaysCount,
    };
  });

  return {
    month: monthStr,
    timeline,
    accountSummaries,
  };
}
