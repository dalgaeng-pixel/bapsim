import type { AppState, Client, SettlementAccount } from "@/lib/types";
import { getBillableOrdersForClientMonth, getMonthlySettlementForSettlementAccount } from "@/lib/schedule";

export type TransactionStatementDay = {
  date: string;
  lunchQuantity: number;
  dinnerQuantity: number;
  lunchAmount: number;
  dinnerAmount: number;
  totalAmount: number;
  memo?: string;
};

export type TransactionStatementLocation = {
  client: Client;
  days: TransactionStatementDay[];
  lunchQuantity: number;
  dinnerQuantity: number;
  lunchAmount: number;
  dinnerAmount: number;
  totalQuantity: number;
  totalAmount: number;
};

export type TransactionStatement = {
  account: SettlementAccount;
  month: string;
  unitPrice: number;
  locations: TransactionStatementLocation[];
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

function buildLocationStatement(
  state: AppState,
  accountId: string,
  month: string,
  client: Client,
  unitPrice: number
): TransactionStatementLocation {
  const byDate = new Map<string, { lunchQuantity: number; dinnerQuantity: number }>();

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

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, quantities]) => {
      const memo = state.transactionStatementRemarks.find(
        (item) =>
          item.settlementAccountId === accountId &&
          item.clientId === client.id &&
          item.date === date
      )?.memo;
      return {
        date,
        ...quantities,
        lunchAmount: quantities.lunchQuantity * unitPrice,
        dinnerAmount: quantities.dinnerQuantity * unitPrice,
        totalAmount: (quantities.lunchQuantity + quantities.dinnerQuantity) * unitPrice,
        memo: memo || undefined
      };
    });

  const lunchQuantity = days.reduce((sum, day) => sum + day.lunchQuantity, 0);
  const dinnerQuantity = days.reduce((sum, day) => sum + day.dinnerQuantity, 0);

  return {
    client,
    days,
    lunchQuantity,
    dinnerQuantity,
    lunchAmount: lunchQuantity * unitPrice,
    dinnerAmount: dinnerQuantity * unitPrice,
    totalQuantity: lunchQuantity + dinnerQuantity,
    totalAmount: (lunchQuantity + dinnerQuantity) * unitPrice
  };
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
  const unitPrice = settlement.unitPrice;
  const locations = [...settlement.clients]
    .sort((left, right) => left.deliveryOrder - right.deliveryOrder || left.name.localeCompare(right.name))
    .map((client) => buildLocationStatement(state, settlementAccountId, month, client, unitPrice));

  const byDate = new Map<string, { lunchQuantity: number; dinnerQuantity: number }>();
  for (const location of locations) {
    for (const day of location.days) {
      const total = byDate.get(day.date) ?? { lunchQuantity: 0, dinnerQuantity: 0 };
      total.lunchQuantity += day.lunchQuantity;
      total.dinnerQuantity += day.dinnerQuantity;
      byDate.set(day.date, total);
    }
  }

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, quantities]) => ({
      date,
      ...quantities,
      lunchAmount: quantities.lunchQuantity * unitPrice,
      dinnerAmount: quantities.dinnerQuantity * unitPrice,
      totalAmount: (quantities.lunchQuantity + quantities.dinnerQuantity) * unitPrice
    }));
  const lunchQuantity = locations.reduce((sum, location) => sum + location.lunchQuantity, 0);
  const dinnerQuantity = locations.reduce((sum, location) => sum + location.dinnerQuantity, 0);

  return {
    account,
    month,
    unitPrice,
    locations,
    days,
    lunchQuantity,
    dinnerQuantity,
    lunchAmount: lunchQuantity * unitPrice,
    dinnerAmount: dinnerQuantity * unitPrice,
    totalQuantity: lunchQuantity + dinnerQuantity,
    totalAmount: (lunchQuantity + dinnerQuantity) * unitPrice
  };
}
