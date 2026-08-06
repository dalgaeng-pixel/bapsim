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
  priceNote?: string;
  lunchDirectUnitPrice?: number;
  dinnerDirectUnitPrice?: number;
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

type DayAccumulator = {
  lunchQuantity: number;
  dinnerQuantity: number;
  lunchAmount: number;
  dinnerAmount: number;
  lunchDirectUnitPrice?: number;
  dinnerDirectUnitPrice?: number;
  lunchCorrectionMemo?: string;
  dinnerCorrectionMemo?: string;
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

function formatUnitPrice(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function buildPriceNote(day: DayAccumulator) {
  const notes = [
    day.lunchDirectUnitPrice === undefined ? "" : `중식 별도 단가 ${formatUnitPrice(day.lunchDirectUnitPrice)}`,
    day.dinnerDirectUnitPrice === undefined ? "" : `석식 별도 단가 ${formatUnitPrice(day.dinnerDirectUnitPrice)}`
  ].filter(Boolean);
  return notes.join(" · ") || undefined;
}

function buildCorrectionMemo(day: DayAccumulator) {
  const lunchMemo = day.lunchCorrectionMemo?.trim();
  const dinnerMemo = day.dinnerCorrectionMemo?.trim();
  if (lunchMemo && dinnerMemo) {
    return lunchMemo === dinnerMemo
      ? lunchMemo
      : `\uC911\uC2DD: ${lunchMemo} \u00B7 \uC11D\uC2DD: ${dinnerMemo}`;
  }
  return lunchMemo || dinnerMemo || undefined;
}

function buildLocationStatement(
  state: AppState,
  accountId: string,
  month: string,
  client: Client,
  unitPrice: number
): TransactionStatementLocation {
  const byDate = new Map<string, DayAccumulator>();

  for (const order of getBillableOrdersForClientMonth(state, client.id, month)) {
    if (order.finalQuantity <= 0) {
      continue;
    }
    const mealType = state.mealTypes.find((item) => item.id === order.mealTypeId);
    const period = mealType ? mealPeriod(mealType.name) : null;
    if (!period) {
      continue;
    }

    const day = byDate.get(order.date) ?? {
      lunchQuantity: 0,
      dinnerQuantity: 0,
      lunchAmount: 0,
      dinnerAmount: 0
    };
    const orderUnitPrice = order.unitPrice ?? unitPrice;
    if (period === "lunch") {
      day.lunchQuantity += order.finalQuantity;
      day.lunchAmount += order.finalQuantity * orderUnitPrice;
      if (order.unitPrice !== undefined) {
        day.lunchDirectUnitPrice = order.unitPrice;
      }
      if (order.isAdminCorrection && order.memo?.trim()) {
        day.lunchCorrectionMemo = order.memo.trim();
      }
    } else {
      day.dinnerQuantity += order.finalQuantity;
      day.dinnerAmount += order.finalQuantity * orderUnitPrice;
      if (order.unitPrice !== undefined) {
        day.dinnerDirectUnitPrice = order.unitPrice;
      }
      if (order.isAdminCorrection && order.memo?.trim()) {
        day.dinnerCorrectionMemo = order.memo.trim();
      }
    }
    byDate.set(order.date, day);
  }

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, quantities]) => {
      const savedRemark = state.transactionStatementRemarks.find(
        (item) =>
          item.settlementAccountId === accountId &&
          item.clientId === client.id &&
          item.date === date
      );
      return {
        date,
        lunchQuantity: quantities.lunchQuantity,
        dinnerQuantity: quantities.dinnerQuantity,
        lunchAmount: quantities.lunchAmount,
        dinnerAmount: quantities.dinnerAmount,
        totalAmount: quantities.lunchAmount + quantities.dinnerAmount,
        memo: savedRemark ? savedRemark.memo || undefined : buildCorrectionMemo(quantities),
        priceNote: buildPriceNote(quantities),
        lunchDirectUnitPrice: quantities.lunchDirectUnitPrice,
        dinnerDirectUnitPrice: quantities.dinnerDirectUnitPrice
      };
    });

  const lunchQuantity = days.reduce((sum, day) => sum + day.lunchQuantity, 0);
  const dinnerQuantity = days.reduce((sum, day) => sum + day.dinnerQuantity, 0);
  const lunchAmount = days.reduce((sum, day) => sum + day.lunchAmount, 0);
  const dinnerAmount = days.reduce((sum, day) => sum + day.dinnerAmount, 0);

  return {
    client,
    days,
    lunchQuantity,
    dinnerQuantity,
    lunchAmount,
    dinnerAmount,
    totalQuantity: lunchQuantity + dinnerQuantity,
    totalAmount: lunchAmount + dinnerAmount
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

  const byDate = new Map<string, DayAccumulator>();
  for (const location of locations) {
    for (const day of location.days) {
      const total = byDate.get(day.date) ?? {
        lunchQuantity: 0,
        dinnerQuantity: 0,
        lunchAmount: 0,
        dinnerAmount: 0
      };
      total.lunchQuantity += day.lunchQuantity;
      total.dinnerQuantity += day.dinnerQuantity;
      total.lunchAmount += day.lunchAmount;
      total.dinnerAmount += day.dinnerAmount;
      byDate.set(day.date, total);
    }
  }

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, quantities]) => ({
      date,
      lunchQuantity: quantities.lunchQuantity,
      dinnerQuantity: quantities.dinnerQuantity,
      lunchAmount: quantities.lunchAmount,
      dinnerAmount: quantities.dinnerAmount,
      totalAmount: quantities.lunchAmount + quantities.dinnerAmount
    }));
  const lunchQuantity = locations.reduce((sum, location) => sum + location.lunchQuantity, 0);
  const dinnerQuantity = locations.reduce((sum, location) => sum + location.dinnerQuantity, 0);
  const lunchAmount = locations.reduce((sum, location) => sum + location.lunchAmount, 0);
  const dinnerAmount = locations.reduce((sum, location) => sum + location.dinnerAmount, 0);

  return {
    account,
    month,
    unitPrice,
    locations,
    days,
    lunchQuantity,
    dinnerQuantity,
    lunchAmount,
    dinnerAmount,
    totalQuantity: lunchQuantity + dinnerQuantity,
    totalAmount: lunchAmount + dinnerAmount
  };
}