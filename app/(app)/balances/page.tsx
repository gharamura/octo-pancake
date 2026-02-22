import { BalanceTable } from "@/components/balance-table";

export default function BalancesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Balances</h1>
      <BalanceTable />
    </div>
  );
}
