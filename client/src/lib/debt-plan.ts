export type DebtStrategy = "snowball" | "avalanche" | "hybrid";

export interface DebtInput {
  id: string;
  name: string;
  totalAmount: string | number;
  monthlyPayment: string | number;
  interestRate: string | number;
}

export interface DebtPlanMonth {
  month: number;
  targetDebtId: string | null;
  targetDebtName: string;
  totalBalance: number;
  totalPayment: number;
  interestPaid: number;
  debts: Array<{
    id: string;
    name: string;
    balanceBefore: number;
    interest: number;
    payment: number;
    remainingAfter: number;
    paidOff: boolean;
  }>;
}

export interface DebtPlanSummary {
  strategy: DebtStrategy;
  totalBalance: number;
  minimumPaymentTotal: number;
  totalInterest: number;
  monthsToDebtFree: number | null;
  firstTargetName: string;
  months: DebtPlanMonth[];
}

export function parseMoney(value: unknown): number {
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function buildDebtPlan(
  debts: DebtInput[],
  strategy: DebtStrategy,
  extraPayment: number,
  maxMonths = 360
): DebtPlanSummary {
  const workingDebts = debts
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: Math.max(0, parseMoney(debt.totalAmount)),
      minimumPayment: Math.max(0, parseMoney(debt.monthlyPayment)),
      interestRate: Math.max(0, parseMoney(debt.interestRate)),
    }))
    .filter((debt) => debt.balance > 0);

  const totalBalance = workingDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const minimumPaymentTotal = workingDebts.reduce((sum, debt) => sum + debt.minimumPayment, 0);

  if (!workingDebts.length || minimumPaymentTotal + extraPayment <= 0) {
    return {
      strategy,
      totalBalance,
      minimumPaymentTotal,
      totalInterest: 0,
      monthsToDebtFree: null,
      firstTargetName: "",
      months: [],
    };
  }

  const months: DebtPlanMonth[] = [];
  let freedPayment = 0;
  let totalInterest = 0;
  let firstTargetName = "";

  for (let month = 1; month <= maxMonths && workingDebts.some((debt) => debt.balance > 0.01); month += 1) {
    const activeDebts = workingDebts.filter((debt) => debt.balance > 0.01);
    const target = chooseTarget(activeDebts, strategy, month);
    if (!firstTargetName) firstTargetName = target?.name || "";

    const monthRows: DebtPlanMonth["debts"] = [];
    let monthPayment = 0;
    let monthInterest = 0;

    for (const debt of activeDebts) {
      const balanceBeforeInterest = debt.balance;
      const interest = balanceBeforeInterest * (debt.interestRate / 100 / 12);
      debt.balance += interest;
      monthInterest += interest;

      const targetBoost = debt.id === target?.id ? extraPayment + freedPayment : 0;
      const desiredPayment = debt.minimumPayment + targetBoost;
      const payment = Math.min(debt.balance, desiredPayment);
      debt.balance -= payment;
      monthPayment += payment;

      if (debt.balance <= 0.01) {
        freedPayment += debt.minimumPayment;
        debt.balance = 0;
      }

      monthRows.push({
        id: debt.id,
        name: debt.name,
        balanceBefore: balanceBeforeInterest,
        interest,
        payment,
        remainingAfter: debt.balance,
        paidOff: debt.balance <= 0,
      });
    }

    totalInterest += monthInterest;
    months.push({
      month,
      targetDebtId: target?.id || null,
      targetDebtName: target?.name || "",
      totalBalance: workingDebts.reduce((sum, debt) => sum + debt.balance, 0),
      totalPayment: monthPayment,
      interestPaid: monthInterest,
      debts: monthRows,
    });
  }

  return {
    strategy,
    totalBalance,
    minimumPaymentTotal,
    totalInterest,
    monthsToDebtFree: months.length ? months[months.length - 1].month : null,
    firstTargetName,
    months,
  };
}

function chooseTarget(
  debts: Array<{ id: string; name: string; balance: number; interestRate: number }>,
  strategy: DebtStrategy,
  month: number
) {
  if (!debts.length) return null;

  const sorted = [...debts];
  if (strategy === "avalanche") {
    return sorted.sort((left, right) => right.interestRate - left.interestRate || left.balance - right.balance)[0];
  }

  if (strategy === "hybrid" && month > 1) {
    return sorted.sort((left, right) => right.interestRate - left.interestRate || left.balance - right.balance)[0];
  }

  return sorted.sort((left, right) => left.balance - right.balance || right.interestRate - left.interestRate)[0];
}
