import { TransactionTable } from "@/components/transaction-table";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ coa?: string; from?: string; to?: string; accFrom?: string; accTo?: string; recipient?: string }>;
}) {
  const { coa, from, to, accFrom, accTo, recipient } = await searchParams;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TransactionTable
        initialCoa={coa}
        initialFrom={from}
        initialTo={to}
        initialAccFrom={accFrom}
        initialAccTo={accTo}
        initialRecipient={recipient}
      />
    </div>
  );
}
