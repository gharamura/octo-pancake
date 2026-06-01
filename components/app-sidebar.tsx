"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Ledger sidebar
//
// 48px collapsed → 196px on hover. Mono in everything, 2-letter route codes,
// hairline group separators, 2px left border for active route, sync pulse at
// the bottom. Replaces the stock shadcn sidebar.
// ---------------------------------------------------------------------------

type NavItem = {
  code:  string;        // 2-letter route code, uppercase
  label: string;
  href:  string;
  hot?:  string;        // keyboard hotkey reference (display only)
};

type NavGroup = { g: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { g: "MAIN", items: [
    { code: "HM", label: "Home",          href: "/dashboard",    hot: "H" },
    { code: "TX", label: "Transações",    href: "/transactions", hot: "T" },
    { code: "IM", label: "Importar",      href: "/import",       hot: "I" },
  ]},
  { g: "ACCT", items: [
    { code: "CT", label: "Contas",        href: "/accounts",     hot: "C" },
    { code: "BL", label: "Saldos",        href: "/balances",     hot: "B" },
  ]},
  { g: "FLOW", items: [
    { code: "CF", label: "Cash Flow",     href: "/cash-flow",             hot: "F" },
    { code: "RE", label: "Recorrentes",   href: "/cash-flow/recurring" },
  ]},
  { g: "INV", items: [
    { code: "AT", label: "Ativos",        href: "/assets",       hot: "A" },
    { code: "AB", label: "Posições",      href: "/assets/balances" },
    { code: "BH", label: "Histórico",     href: "/assets/report" },
    { code: "PF", label: "Performance",   href: "/assets/performance", hot: "P" },
    { code: "FX", label: "Câmbio",        href: "/exchange-rates" },
  ]},
  { g: "PEOPLE", items: [
    { code: "RC", label: "Recipients",    href: "/recipients",   hot: "R" },
    { code: "OR", label: "Órfãos",        href: "/recipients/orphans" },
  ]},
  { g: "CAT", items: [
    { code: "CG", label: "Categorias",    href: "/coa",          hot: "G" },
  ]},
  { g: "RPT", items: [
    { code: "CR", label: "COA",           href: "/reports/coa" },
    { code: "RR", label: "Recipients",    href: "/reports/recipients" },
    { code: "AR", label: "Contas",        href: "/reports/accounts" },
  ]},
];

const W_CLOSED = 48;
const W_OPEN   = 196;

interface AppSidebarProps {
  user: {
    name?:  string | null;
    email?: string | null;
    image?: string | null;
  };
}

function useNowHHMM() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  // exact match or deeper path under this route
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const now = useNowHHMM();

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        width: open ? W_OPEN : W_CLOSED,
        transition: "width 140ms ease-out",
      }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-[color:var(--color-lm-border-2)] bg-[color:var(--color-lm-bg)] text-[color:var(--color-lm-fg)]"
    >
      {/* Brand */}
      <div className="flex h-9 items-center gap-2.5 border-b border-[color:var(--color-lm-border-2)] px-[14px]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-[11px] tracking-[2px] text-[color:var(--color-lm-fg)] hover:opacity-90"
        >
          <span className="text-[color:var(--color-lm-gain)]">■</span>
          {open && <span>LEDGER</span>}
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-hidden py-2">
        {NAV.map((group) => (
          <div key={group.g} className="mb-2.5">
            <div
              className={`flex h-3.5 items-center ${open ? "justify-start px-[14px]" : "justify-center"} text-[8px] tracking-[1.5px] text-[color:var(--color-lm-fg-dim)]`}
            >
              {open ? group.g : "·"}
            </div>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.code + item.href}
                  href={item.href}
                  className={`flex h-[26px] items-center gap-2.5 ${open ? "px-[14px] pl-[11px] justify-start" : "justify-center"} text-[11px] transition-colors`}
                  style={{
                    borderLeft: active ? "2px solid var(--color-lm-fg)" : "2px solid transparent",
                    background: active ? "rgba(255,255,255,0.035)" : "transparent",
                    color: active ? "var(--color-lm-fg)" : "var(--color-lm-fg-muted)",
                  }}
                  title={item.label}
                >
                  <span
                    className="min-w-5 text-center text-[9px] tracking-[0.5px]"
                    style={{ color: active ? "var(--color-lm-fg)" : "var(--color-lm-fg-dim)" }}
                  >
                    {item.code}
                  </span>
                  {open && (
                    <>
                      <span className="flex-1 whitespace-nowrap">{item.label}</span>
                      {item.hot && (
                        <span className="text-[9px] text-[color:var(--color-lm-fg-ghost)]">
                          {item.hot}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User · sign out (collapsed: single glyph; expanded: name + logout) */}
      <div className="border-t border-[color:var(--color-lm-border-2)]">
        {open ? (
          <div className="flex items-center gap-2.5 px-[14px] py-2 text-[10px] text-[color:var(--color-lm-fg-muted)]">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center border border-[color:var(--color-lm-border-2)] text-[10px] text-[color:var(--color-lm-fg)]"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1 truncate">{user.email ?? user.name ?? "—"}</div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
              className="text-[9px] tracking-[1px] text-[color:var(--color-lm-fg-dim)] hover:text-[color:var(--color-lm-loss)]"
              title="Log out"
            >
              EXIT
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
            className="flex h-8 w-full items-center justify-center text-[10px] text-[color:var(--color-lm-fg-dim)] hover:text-[color:var(--color-lm-loss)]"
            title={`Sign out (${user.email ?? ""})`}
          >
            {initial}
          </button>
        )}
      </div>

      {/* Sync pulse */}
      <div className="flex items-center gap-2 border-t border-[color:var(--color-lm-border-2)] px-[14px] py-2 text-[9px] text-[color:var(--color-lm-fg-dim)]">
        <span className="text-[color:var(--color-lm-gain)]">●</span>
        {open && (
          <>
            <span>sync</span>
            <span className="flex-1" />
            <span className="text-[color:var(--color-lm-fg-muted)]">{now}</span>
          </>
        )}
      </div>
    </aside>
  );
}
