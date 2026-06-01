import { RecurringTable } from "@/components/recurring-table";

export default function RecurringPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Recurring Transactions</h1>
      <RecurringTable />
    </div>
  );
}
