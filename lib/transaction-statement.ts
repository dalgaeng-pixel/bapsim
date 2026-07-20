import type { AppState, SettlementAccount } from "@/lib/types";
import { getBillableOrdersForClientMonth, getMonthlySettlementForSettlementAccount } from "@/lib/schedule";

export type TransactionStatementDay = {
  date: string;
  lunchQuantity: number;
  dinnerQuantity: number;
  lunchAmount: number;
  dinnerAmount: number;
  totalAmount: number;
};

export type TransactionStatement = {
  account: SettlementAccount;
  month: string;
  unitPrice: number;
  days: TransactionStatementDay[];
  lunchQuantity: number;
  dinnerQuantity: number;
  lunchAmount: number;
  dinnerAmount: number;
  totalQuantity: number;
  totalAmount: number;
};

function mealPeriod(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("점심") || normalized.includes("중식") || normalized.includes("lunch")) {
    return "lunch" as const;
  }
  if (normalized.includes("저녁") || normalized.includes("석식") || normalized.includes("dinner")) {
    return "dinner" as const;
  }
  return null;
}

export function getTransactionStatement(
  state: AppState,
  settlementAccountId: string,
  month: string
): TransactionStatement | undefined {
  const account = state.settlementAccounts.find((item) => item.id === settlementAccountId);
  if (!account) {
    return undefined;
  }

  const settlement = getMonthlySettlementForSettlementAccount(state, settlementAccountId, month);
  const byDate = new Map<string, { lunchQuantity: number; dinnerQuantity: number }>();

  for (const client of settlement.clients) {
    for (const order of getBillableOrdersForClientMonth(state, client.id, month)) {
      if (order.finalQuantity <= 0) {
        continue;
      }

      const mealType = state.mealTypes.find((item) => item.id === order.mealTypeId);
      const period = mealType ? mealPeriod(mealType.name) : null;
      if (!period) {
        continue;
      }

      const day = byDate.get(order.date) ?? { lunchQuantity: 0, dinnerQuantity: 0 };
      day[period === "lunch" ? "lunchQuantity" : "dinnerQuantity"] += order.finalQuantity;
      byDate.set(order.date, day);
    }
  }

  const unitPrice = settlement.unitPrice;
  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, quantities]) => ({
      date,
      ...quantities,
      lunchAmount: quantities.lunchQuantity * unitPrice,
      dinnerAmount: quantities.dinnerQuantity * unitPrice,
      totalAmount: (quantities.lunchQuantity + quantities.dinnerQuantity) * unitPrice
    }));
  const lunchQuantity = days.reduce((sum, day) => sum + day.lunchQuantity, 0);
  const dinnerQuantity = days.reduce((sum, day) => sum + day.dinnerQuantity, 0);

  return {
    account,
    month,
    unitPrice,
    days,
    lunchQuantity,
    dinnerQuantity,
    lunchAmount: lunchQuantity * unitPrice,
    dinnerAmount: dinnerQuantity * unitPrice,
    totalQuantity: lunchQuantity + dinnerQuantity,
    totalAmount: (lunchQuantity + dinnerQuantity) * unitPrice
  };
}