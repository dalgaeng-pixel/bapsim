import type { AppState, DailyMealOrder } from "@/lib/types";
import { todayKey } from "@/lib/date";
import { getMonthlySettlementForClient } from "@/lib/schedule";

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
    ["순서", "업체명", "식사", "수량", "주소", "상세주소", "배달 메모", "상태"],
    ...orders.map((order, index) => {
      const client = state.clients.find((item) => item.id === order.clientId);
      const mealType = state.mealTypes.find((item) => item.id === order.mealTypeId);
      return [
        index + 1,
        client?.name,
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
    ["월", "업체명", "납품 시작일", "기본 수량 합계", "자동 최종", "정산 최종", "거절 건수", "변경 건수", "정산 메모"],
    ...state.clients.map((client) => {
      const settlement = getMonthlySettlementForClient(state, client.id, month);
      return [
        month,
        client.name,
        client.deliveryStartDate ?? "즉시",
        settlement.computedBaseQuantity,
        settlement.computedFinalQuantity,
        settlement.settlementFinalQuantity,
        settlement.rejectedCount,
        settlement.changedCount,
        settlement.adjustment?.memo
      ];
    })
  ];
}
