import { useQuery } from "@tanstack/react-query";
import { WalletCards } from "lucide-react";
import DebtDashboard from "@/components/debt-dashboard";

export default function Debt() {
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user/profile"],
  });

  const monthlyIncome = Number.parseFloat(user?.monthlyIncome || "0");

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#202133] text-amber-400">
              <WalletCards className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">Debt Management</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-200">
              Compare snowball, avalanche, and hybrid payoff plans using your balances, minimum payments, and APRs.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#202133] px-4 py-3 text-right">
            <div className="text-xs text-slate-400">Monthly income</div>
            <div className="text-lg font-semibold">
              ${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <DebtDashboard monthlyIncome={monthlyIncome} />
      </div>
    </main>
  );
}
