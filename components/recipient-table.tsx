"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecipientForm } from "@/components/recipient-form";
import { Pencil, Plus, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecipientDetail } from "@/lib/repositories/recipient.repository";

// ---------------------------------------------------------------------------
// Sheet state
// ---------------------------------------------------------------------------

interface SheetState {
  open:   boolean;
  mode:   "create" | "edit";
  record?: RecipientDetail;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipientTable() {
  const [records, setRecords] = useState<RecipientDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [sheet,   setSheet]   = useState<SheetState>({ open: false, mode: "create" });

  const fetchRecords = useCallback(() => {
    setLoading(true);
    fetch("/api/recipients")
      .then((r) => r.json())
      .then((data: RecipientDetail[]) => {
        setRecords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openCreate = useCallback(() => setSheet({ open: true, mode: "create" }), []);
  const openEdit   = useCallback(
    (r: RecipientDetail) => setSheet({ open: true, mode: "edit", record: r }),
    []
  );

  const handleFormSuccess = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }));
    fetchRecords();
  }, [fetchRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.aliases.some((a) => a.alias.toLowerCase().includes(q))
    );
  }, [records, search]);

  const columns = useMemo<ColumnDef<RecipientDetail>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name")}</span>
        ),
      },
      {
        id: "aliases",
        header: "Aliases",
        cell: ({ row }) => {
          const aliases = row.original.aliases;
          if (aliases.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
          const shown = aliases.slice(0, 3);
          const rest  = aliases.length - shown.length;
          return (
            <div className="flex flex-wrap gap-1">
              {shown.map((a) => (
                <Badge key={a.alias} variant="secondary" className="font-mono text-xs">
                  {a.alias}
                </Badge>
              ))}
              {rest > 0 && (
                <Badge variant="outline" className="text-xs">+{rest}</Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "primaryCoa",
        header: "Primary COA",
        cell: ({ row }) => {
          const primary = row.original.coas.find((c) => c.isPrimary);
          if (!primary) return <span className="text-muted-foreground text-sm">—</span>;
          return (
            <span className="flex items-center gap-1.5 text-sm">
              <Star className="h-3 w-3 text-amber-500 shrink-0" fill="currentColor" />
              <span className="font-mono text-xs text-muted-foreground">{primary.coaCode}</span>
              <span className="truncate max-w-[140px]">{primary.coaName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) => (
          <Badge variant={row.getValue("isActive") ? "default" : "outline"} className="text-xs">
            {row.getValue("isActive") ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [openEdit]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name or alias…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-64"
        />
        <Button variant="success" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Recipient
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search ? "No recipients match your search." : "No recipients yet. Add one to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.mode === "create" ? "New Recipient" : "Edit Recipient"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <RecipientForm
              key={sheet.mode === "edit" ? sheet.record?.id : "create"}
              record={sheet.record}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
