import type { AppState, DailyMealOrder } from "@/lib/types";

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

export function buildMonthlyRows(state: AppState) {
  return [
    ["업체명", "기본 수량 합계", "최종 수량 합계", "거절 건수", "변경 건수"],
    ...state.clients.map((client) => {
      const orders = state.orders.filter((order) => order.clientId === client.id);
      return [
        client.name,
        orders.reduce((sum, order) => sum + order.baseQuantity, 0),
        orders.reduce((sum, order) => sum + order.finalQuantity, 0),
        orders.filter((order) => order.status === "rejected").length,
        orders.filter((order) => order.status === "changed").length
      ];
    })
  ];
}
