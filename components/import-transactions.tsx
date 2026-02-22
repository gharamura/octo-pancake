"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ParsedRow } from "@/lib/parsers/types";
import { CheckCircle2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Parser registry (metadata only — no server imports)
// ---------------------------------------------------------------------------

const AVAILABLE_PARSERS = [
  { id: "btg-checking",          name: "BTG Pactual – Extrato",  accept: ".xls,.xlsx" },
  { id: "contabilizei-checking", name: "Contabilizei – Extrato", accept: ".csv"       },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtAmount(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "preview" | "done";

interface Account {
  id:            string;
  name:          string;
  type:          string;
  institution:   string | null;
  accountNumber: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportTransactions() {
  // ── Step ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("upload");

  // ── Upload step state ───────────────────────────────────────────────────
  const [accounts,  setAccounts]  = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [parserId,  setParserId]  = useState(AVAILABLE_PARSERS[0].id);
  const [file,      setFile]      = useState<File | null>(null);
  const [parsing,   setParsing]   = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Preview step state ──────────────────────────────────────────────────
  const [rows,     setRows]     = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importError,  setImportError]  = useState<string | null>(null);

  // ── Done step state ─────────────────────────────────────────────────────
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        if (data.length === 1) setAccountId(data[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Parse ──────────────────────────────────────────────────────────────

  async function handleParse() {
    if (!file || !accountId || !parserId) return;
    setParseError(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file",     file);
      form.append("parserId", parserId);

      const res = await fetch("/api/import/parse", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        setParseError(data.error ?? "Could not parse file.");
        return;
      }
      const { rows: parsed } = await res.json() as { rows: ParsedRow[] };
      setRows(parsed);
      setSelected(new Set(parsed.map((r) => r.tempId)));
      setStep("preview");
    } catch {
      setParseError("Something went wrong.");
    } finally {
      setParsing(false);
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter((r) => selected.has(r.tempId));
    if (toImport.length === 0) return;

    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/import/execute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          accountId,
          rows: toImport.map((r) => ({
            date:             r.date,
            description:      r.description,
            amount:           r.amount,
            suggestedCoaCode: r.suggestedCoaCode,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setImportError(data.error ?? "Import failed.");
        return;
      }
      const { inserted } = await res.json() as { inserted: number };
      setImportedCount(inserted);
      setStep("done");
    } catch {
      setImportError("Something went wrong.");
    } finally {
      setImporting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  function reset() {
    setStep("upload");
    setFile(null);
    setRows([]);
    setSelected(new Set());
    setParseError(null);
    setImportError(null);
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Selection helpers ──────────────────────────────────────────────────

  const allSelected  = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.tempId)));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedParser = AVAILABLE_PARSERS.find((p) => p.id === parserId)!;

  // ── Render ─────────────────────────────────────────────────────────────

  // Step 1: Upload
  if (step === "upload") {
    return (
      <div className="max-w-lg space-y-5">
        {/* Account */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Account</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex flex-col">
                    <span>{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[a.type, a.institution, a.accountNumber].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Parser */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">File format</label>
          <Select value={parserId} onValueChange={setParserId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_PARSERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">File</label>
          <div
            className="flex items-center gap-3 rounded-md border border-dashed px-4 py-5 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : "Click to select file…"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={selectedParser.accept}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}

        <Button
          variant="success"
          disabled={!file || !accountId || parsing}
          onClick={handleParse}
        >
          {parsing ? "Parsing…" : "Parse File"}
        </Button>
      </div>
    );
  }

  // Step 2: Preview
  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={reset}>
              ← Back
            </Button>
            <span className="text-sm text-muted-foreground">
              {rows.length} rows parsed · {selected.size} selected
            </span>
          </div>
          <Button
            variant="success"
            size="sm"
            disabled={selected.size === 0 || importing}
            onClick={handleImport}
          >
            {importing ? "Importing…" : `Import ${selected.size} selected`}
          </Button>
        </div>

        {importError && <p className="text-sm text-destructive">{importError}</p>}

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide">Recipient</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Amount</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide">COA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = selected.has(row.tempId);
                return (
                  <tr
                    key={row.tempId}
                    className={`border-b transition-colors cursor-pointer ${isSelected ? "bg-background hover:brightness-95" : "bg-muted/20 opacity-50"}`}
                    onClick={() => toggleRow(row.tempId)}
                  >
                    <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.tempId)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground text-xs">
                      {fmtDate(row.date)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[260px] truncate">
                      {row.description}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap ${row.amount >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmtAmount(row.amount)}
                    </td>
                    <td className="px-3 py-2">
                      {row.suggestedCoaCode ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-muted-foreground">{row.suggestedCoaCode}</span>
                          <span className="truncate max-w-[160px]">{row.suggestedCoaName}</span>
                          {row.suggestionSource === "ai" && (
                            <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              AI
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

  // Step 3: Done
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <div className="space-y-1">
        <p className="text-xl font-semibold">{importedCount} transactions imported</p>
        <p className="text-sm text-muted-foreground">They are now available in the transactions list.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Import more
        </Button>
        <Button asChild variant="success">
          <Link href="/transactions">View Transactions →</Link>
        </Button>
      </div>
    </div>
  );
}
