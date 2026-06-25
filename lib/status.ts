import type { OrderStatus, RequestType } from "@/lib/types";

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    normal: "정상",
    changed: "변경",
    rejected: "거절",
    pending: "승인대기",
    holiday: "휴무"
  };

  return labels[status];
}

export function orderStatusClass(status: OrderStatus) {
  const classes: Record<OrderStatus, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    changed: "border-amber-200 bg-amber-50 text-amber-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    pending: "border-sky-200 bg-sky-50 text-sky-800",
    holiday: "border-stone-200 bg-stone-100 text-stone-700"
  };

  return classes[status];
}

export function requestTypeLabel(type: RequestType) {
  const labels: Record<RequestType, string> = {
    late_quantity: "마감 후 수량 변경",
    late_rejection: "마감 후 식사 거절",
    address_update: "주소 변경 요청",
    contact_update: "담당자 변경 요청"
  };

  return labels[type];
}
