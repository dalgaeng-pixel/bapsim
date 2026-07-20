import type { AppState, DailyMealOrder } from "@/lib/types";
import { todayKey } from "@/lib/date";
import { getMonthlySettlementForSettlementAccount, mealSupplyTypeLabel } from "@/lib/schedule";

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | undefined>>) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildDeliveryRows(state: AppState, orders: DailyMealOrder[]) {
  return [
    ["순서", "업체명", "유형", "식사", "수량", "주소", "상세주소", "배달 메모", "상태"],
    ...orders.map((order, index) => {
      const client = state.clients.find((item) => item.id === order.clientId);
      const mealType = state.mealTypes.find((item) => item.id === order.mealTypeId);
      return [
        index + 1,
        client?.name,
        mealSupplyTypeLabel(client?.mealSupplyType),
        mealType?.name,
        order.finalQuantity,
        client?.address,
        client?.addressDetail,
        client?.deliveryMemo,
        order.status
      ];
    })
  ];
}

export function buildMonthlyRows(state: AppState, month = todayKey().slice(0, 7)) {
  return [
    ["월", "정산 업체", "배송 장소", "기본 수량 합계", "자동 최종", "정산 최종", "일반 식수", "개인도시락", "거절 건수", "변경 건수", "정산 메모"],
    ...state.settlementAccounts.map((account) => {
      const settlement = getMonthlySettlementForSettlementAccount(state, account.id, month);
      const regularQuantity = settlement.clientSettlements.reduce(
        (sum, item, index) => sum + (settlement.clients[index]?.mealSupplyType === "regular" ? item.settlementFinalQuantity : 0),
        0
      );
      const lunchboxQuantity = settlement.clientSettlements.reduce(
        (sum, item, index) => sum + (settlement.clients[index]?.mealSupplyType === "lunchbox" ? item.settlementFinalQuantity : 0),
        0
      );

      return [
        month,
        account.name,
        settlement.clients.map((client) => client.name).join(" · "),
        settlement.computedBaseQuantity,
        settlement.computedFinalQuantity,
        settlement.settlementFinalQuantity,
        regularQuantity,
        lunchboxQuantity,
        settlement.rejectedCount,
        settlement.changedCount,
        settlement.adjustment?.memo
      ];
    })
  ];
}
