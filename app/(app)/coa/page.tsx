import { db } from "@/lib/db";
import { coaAccounts, type CoaAccount } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

const TYPE_STYLES: Record<string, string> = {
  income:    "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400",
  expense:   "bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400",
  asset:     "bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400",
  liability: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  equity:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function buildDepthMap(accounts: CoaAccount[]) {
  const map = new Map<string, number>();
  for (const a of accounts) {
    map.set(a.code, a.parentCode ? (map.get(a.parentCode) ?? 0) + 1 : 0);
  }
  return map;
}

export default async function CoaPage() {
  const accounts = await db
    .select()
    .from(coaAccounts)
    .orderBy(asc(coaAccounts.code));

  const depth = buildDepthMap(accounts);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chart of Accounts</h1>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium w-24">Code</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium w-28">Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const d = depth.get(account.code) ?? 0;
              return (
                <tr
                  key={account.code}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {account.code}
                  </td>
                  <td
                    className="py-2 pr-4"
                    style={{ paddingLeft: `${(d + 1) * 1.25}rem` }}
                  >
                    {d === 0 ? (
                      <span className="font-semibold">{account.name}</span>
                    ) : (
                      account.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[account.type] ?? ""}`}
                    >
                      {account.type}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
