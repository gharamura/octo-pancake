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
import { type FinancialAccount, type FinancialAccountType } from "@/lib/db/schema";
import { useState } from "react";

const TYPES: { value: FinancialAccountType; label: string }[] = [
  { value: "savings",     label: "Savings" },
  { value: "checking",    label: "Checking" },
  { value: "credit_card", label: "Credit Card" },
  { value: "investment",  label: "Investment" },
  { value: "other",       label: "Other" },
];

interface AccountFormProps {
  account?: FinancialAccount;
  onSuccess: () => void;
}

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<FinancialAccountType>(account?.type ?? "checking");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [owner, setOwner] = useState(account?.owner ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [openingBalance, setOpeningBalance] = useState(account?.openingBalance ?? "0");
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        name,
        type,
        institution: institution || null,
        owner: owner || null,
        accountNumber: accountNumber || null,
        openingBalance,
        notes: notes || null,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/accounts/${account.id}` : "/api/accounts",
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
      const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
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
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Itaú Checking"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as FinancialAccountType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="institution">Institution</Label>
        <Input
          id="institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="e.g. Itaú, Nubank"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="owner">Owner</Label>
        <Input
          id="owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="e.g. Gustavo, Family"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accountNumber">Account Number</Label>
        <Input
          id="accountNumber"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="****1234"
          className="font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="openingBalance">Opening Balance</Label>
        <Input
          id="openingBalance"
          type="number"
          step="0.01"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
