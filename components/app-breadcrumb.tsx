"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Maps URL segments to the crumb label the Ledger design uses. Unknown
// segments are lowercased as-is so UUIDs render readable.
const SEGMENT_LABELS: Record<string, string> = {
  dashboard:       "home",
  transactions:    "transactions",
  import:          "import",
  accounts:        "accounts",
  balances:        "balances",
  assets:          "assets",
  performance:     "performance",
  report:          "history",
  "exchange-rates":"fx",
  recipients:      "recipients",
  orphans:         "orphans",
  coa:             "chart of accounts",
  reports:         "reports",
};

function formatCrumbs(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const mapped = parts.map((p) => SEGMENT_LABELS[p] ?? p.toLowerCase());
  return ["LEDGER", ...mapped];
}

function formatMonth(): string {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function AppBreadcrumb() {
  const pathname = usePathname() ?? "/";
  const crumbs = formatCrumbs(pathname);
  const [month, setMonth] = useState<string>("");

  useEffect(() => {
    setMonth(formatMonth());
  }, []);

  return (
    <header className="flex h-[34px] shrink-0 items-center gap-2.5 border-b border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] px-4 text-[10px]">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-2.5">
            {i > 0 && <span className="text-[color:var(--color-lm-fg-dim)]">/</span>}
            <span
              style={{
                color: isLast ? "var(--color-lm-fg)" : "var(--color-lm-fg-muted)",
                letterSpacing: i === 0 ? 1.5 : 0,
              }}
            >
              {c}
            </span>
          </span>
        );
      })}
      <span className="flex-1" />
      {month && (
        <span className="text-[color:var(--color-lm-fg-muted)]">
          {month.toLowerCase()}
        </span>
      )}
      <span className="text-[color:var(--color-lm-fg-dim)]">conexão</span>
      <span className="text-[color:var(--color-lm-gain)]">●</span>
      <span className="text-[color:var(--color-lm-fg-muted)]">neon:ok</span>
    </header>
  );
}
