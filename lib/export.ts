import type { AppState, DailyMealOrder } from "@/lib/types";
import { todayKey } from "@/lib/date";
import { getMonthlySettlementDailyQuantities, getMonthlySettlementForSettlementAccount, mealSupplyTypeLabel } from "@/lib/schedule";

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
    ["구분", "정산 업체", "일자", "일반 식수", "개인도시락", "일일 합계", "월 최종 식수", "단가", "금액", "정산 메모"],
    ...state.settlementAccounts.flatMap((account) => {
      const settlement = getMonthlySettlementForSettlementAccount(state, account.id, month);
      const dailyQuantities = getMonthlySettlementDailyQuantities(state, account.id, month);
      const totalAmount = settlement.settlementFinalQuantity * settlement.unitPrice;

      return [
        ...dailyQuantities.map((daily) => [
          "일별",
          account.name,
          daily.date,
          daily.regularQuantity,
          daily.lunchboxQuantity,
          daily.finalQuantity,
          "",
          "",
          "",
          ""
        ]),
        [
          "월 최종",
          account.name,
          "",
          "",
          "",
          "",
          settlement.settlementFinalQuantity,
          settlement.unitPrice,
          totalAmount,
          settlement.adjustment?.memo
        ]
      ];
    })
  ];
}
