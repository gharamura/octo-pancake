"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type AccountType, type CoaAccount } from "@/lib/db/schema";
import { useState } from "react";

const TYPES: AccountType[] = ["income", "expense", "asset", "liability", "equity"];
const NONE = "__none__";

interface CoaFormProps {
  account?: CoaAccount;
  accounts: CoaAccount[];
  onSuccess: () => void;
}

export function CoaForm({ account, accounts, onSuccess }: CoaFormProps) {
  const isEdit = !!account;

  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "expense");
  const [parentCode, setParentCode] = useState(account?.parentCode ?? "");
  const [description, setDescription] = useState(account?.description ?? "");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const parentOptions = accounts.filter((a) => a.code !== account?.code);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const body = {
        ...(isEdit ? {} : { code }),
        name,
        type,
        parentCode: parentCode || null,
        description: description || null,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/coa/${account.code}` : "/api/coa",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }

      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!account) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coa/${account.code}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not delete account.");
        setConfirmDelete(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEdit ? (
        <div className="space-y-1.5">
          <Label>Code</Label>
          <Input value={account.code} disabled className="font-mono" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 2510"
            className="font-mono"
            required
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Parent Account</Label>
        <Select
          value={parentCode || NONE}
          onValueChange={(v) => setParentCode(v === NONE ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None (root)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None (root account)</SelectItem>
            {parentOptions.map((a) => (
              <SelectItem key={a.code} value={a.code}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {a.code}
                </span>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="isActive">Active</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {isEdit && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )
        )}

        <Button
          type="submit"
          variant={isEdit ? "warning" : "success"}
          disabled={saving}
          className={isEdit ? "" : "ml-auto"}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}
