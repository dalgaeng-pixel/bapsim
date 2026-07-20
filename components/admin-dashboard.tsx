"use client";

import {
  AlertTriangle,
  Bell,
  BellOff,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  KeyRound,
  ListChecks,
  MapPin,
  Pencil,
  PlusCircle,
  Power,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  X,
  Link,
  QrCode,
  LogOut,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "@/components/logo";
import { GroupManager } from "@/components/group-manager";
import { logoutAdminAction } from "@/app/actions/auth";
import {
  getPushNotificationStatus,
  togglePushNotifications,
  type PushNotificationStatus
} from "@/lib/push-client";
import { buildDeliveryRows, buildMonthlyRows, downloadCsv } from "@/lib/export";
import { formatKoreanDate, isPastCutoffForDate, todayKey } from "@/lib/date";
import { orderStatusClass, orderStatusLabel, requestTypeLabel } from "@/lib/status";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import {
  addDays,
  createHolidayRule,
  enabledMealTypes,
  getWeeklyQuantitiesForClient,
  getClientMealSupplyType,
  getMonthlySettlementDailyQuantities,
  getMonthlySettlementForClient,
  getMonthlySettlementForSettlementAccount,
  DEFAULT_MEAL_UNIT_PRICE,
  isClientStartedOnDate,
  mealSupplyTypeLabel,
  MEAL_SUPPLY_TYPE_LABELS,
  makeRuleStorageDate,
  WEEKDAYS,
  type WeeklyQuantities
} from "@/lib/schedule";
import type { Client, DailyMealOrder, AppState, Holiday, HolidayRuleType, SettlementAccount } from "@/lib/types";

const tabs = [
  { id: "overview", label: "오늘 현황", icon: ListChecks },
  { id: "important", label: "중요 변경", icon: AlertTriangle },
  { id: "clients", label: "거래처", icon: Building2 },
  { id: "groups", label: "정산/담당자", icon: ShieldCheck },
  { id: "delivery", label: "배달표", icon: Truck },
  { id: "monthly", label: "월별 집계", icon: FileSpreadsheet },
  { id: "settings", label: "설정", icon: Settings }
] as const;

type TabId = (typeof tabs)[number]["id"];

const storageModeLabel = {
  local: "로컬 저장",
  supabase: "Supabase 연결",
  "supabase-error": "DB 확인 필요"
};

type VisiblePushStatus = PushNotificationStatus | "checking";

const pushStatusLabel: Record<VisiblePushStatus, string> = {
  checking: "확인 중",
  on: "알림 켜짐",
  off: "알림 꺼짐",
  blocked: "알림 차단",
  unsupported: "알림 미지원"
};

const pushStatusTitle: Record<VisiblePushStatus, string> = {
  checking: "알림 상태를 확인하는 중입니다.",
  on: "실시간 알림이 켜져 있습니다. 누르면 알림을 끕니다.",
  off: "실시간 알림이 꺼져 있습니다. 누르면 알림을 켭니다.",
  blocked: "브라우저에서 알림 권한이 차단되어 있습니다.",
  unsupported: "현재 브라우저에서는 푸시 알림을 지원하지 않습니다."
};

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone: "red" | "gold" | "green" | "blue" | "stone";
}) {
  const toneClass = {
    red: "border-red-100 bg-red-50 text-bapsim-red",
    gold: "border-amber-100 bg-amber-50 text-amber-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    blue: "border-sky-100 bg-sky-50 text-sky-800",
    stone: "border-stone-200 bg-white text-stone-900"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function StatusBadge({ order }: { order: DailyMealOrder }) {
  return (
    <span
      className={`inline-flex min-w-16 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-bold ${orderStatusClass(order.status)}`}
    >
      {orderStatusLabel(order.status)}
    </span>
  );
}

function mapUrl(address: string) {
  return `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function AdminDashboard({ initialState }: { initialState?: AppState }) {
  const store = useBapsimStore(initialState);
  const [tab, setTab] = useState<TabId>("overview");
  const [adminName, setAdminName] = useState("밥심관리자");
  const [search, setSearch] = useState("");
  const [pushStatus, setPushStatus] = useState<VisiblePushStatus>("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedMonth, setSelectedMonth] = useState(todayKey().slice(0, 7));
  const [selectedMealTypeId, setSelectedMealTypeId] = useState<string | null>(null);

  const { state } = store;
  const mealTypes = enabledMealTypes(state);
  const selectedMealType =
    mealTypes.find((mealType) => mealType.id === selectedMealTypeId) ?? mealTypes[0];
  const cutoffPassed = isPastCutoffForDate(selectedDate, selectedMealType?.cutoffTime);

  const sortedOrders = useMemo(() => {
    const key = `${selectedDate}:${selectedMealType?.id ?? ""}`;
    const override = state.deliveryOverrides[key];
    const activeClientIds = [...state.clients]
      .filter((client) => client.status === "active")
      .sort((a, b) => a.deliveryOrder - b.deliveryOrder)
      .map((client) => client.id);
    const orderIds = override ?? activeClientIds;

    return store.getOrdersByDate(selectedDate, selectedMealType?.id).sort((a, b) => {
      const left = orderIds.indexOf(a.clientId);
      const right = orderIds.indexOf(b.clientId);
      return left - right;
    });
  }, [selectedDate, selectedMealType?.id, state.clients, state.deliveryOverrides, store]);

  const visibleOrders = sortedOrders.filter((order) => {
    const client = store.getClient(order.clientId);
    const haystack = `${client?.name ?? ""} ${client?.address ?? ""} ${client?.managerName ?? ""}`;
    return isClientStartedOnDate(client, order.date) && haystack.includes(search);
  });

  const deliveryOrders = visibleOrders.filter(
    (order) => {
      const client = store.getClient(order.clientId);
      return (
        isClientStartedOnDate(client, order.date) &&
        order.status !== "rejected" &&
        order.status !== "holiday" &&
        order.finalQuantity > 0
      );
    }
  );
  const printDeliveryCards = () => {
    const clearPrintLayout = () => {
      delete document.body.dataset.printLayout;
      window.removeEventListener("afterprint", clearPrintLayout);
    };

    document.body.dataset.printLayout = "delivery";
    window.addEventListener("afterprint", clearPrintLayout, { once: true });
    window.requestAnimationFrame(() => window.print());
  };
  const totals = visibleOrders.reduce(
    (result, order) => {
      if (order.status === "rejected" || order.status === "holiday") {
        result.rejectedCount += 1;
      }

      if (order.status !== "holiday") {
        const supplyType = getClientMealSupplyType(store.getClient(order.clientId));
        if (supplyType === "lunchbox") {
          result.lunchboxQuantity += order.finalQuantity;
        } else {
          result.regularQuantity += order.finalQuantity;
        }
      }

      return result;
    },
    { regularQuantity: 0, lunchboxQuantity: 0, rejectedCount: 0 }
  );

  const pendingRequests = state.changeRequests.filter((request) => request.status === "pending");
  const reviewOrders = state.orders.filter(
    (order) =>
      order.date === selectedDate &&
      (!selectedMealType || order.mealTypeId === selectedMealType.id) &&
      order.requiresReview &&
      !order.acknowledged
  );
  const adminUnreadCount = state.notifications.filter((n) => n.target === "admin" && !n.read).length;
  const PushIcon = pushStatus === "on" ? Bell : BellOff;
  const pushButtonTone =
    pushStatus === "on"
      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      : pushStatus === "blocked"
        ? "bg-red-50 text-bapsim-red hover:bg-red-100"
        : "bg-stone-100 text-stone-600 hover:bg-stone-200";

  useEffect(() => {
    let active = true;

    const refreshPushStatus = () => {
      getPushNotificationStatus().then((status) => {
        if (active) {
          setPushStatus(status);
        }
      });
    };

    refreshPushStatus();
    document.addEventListener("visibilitychange", refreshPushStatus);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshPushStatus);
    };
  }, []);

  const handlePushToggle = async () => {
    if (pushBusy) {
      return;
    }

    setPushBusy(true);
    const nextStatus = await togglePushNotifications();
    setPushStatus(nextStatus);
    setPushBusy(false);
  };

  if (!store.loaded) {
    return <div className="p-8 text-sm font-semibold text-stone-600">불러오는 중</div>;
  }



  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Logo compact />
          <div className="hidden items-center gap-3 text-sm font-bold text-stone-700 md:flex">
            <CalendarDays size={18} />
            {formatKoreanDate(selectedDate)}
            <span className="rounded-full bg-stone-100 px-3 py-1">
              {cutoffPassed ? "마감됨" : "변경 가능"}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1">
              {selectedMealType?.name ?? "식사"}
            </span>
            <span className="rounded-full bg-bapsim-rice px-3 py-1 text-bapsim-red">
              {storageModeLabel[store.storageMode]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`relative focus-ring inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-black disabled:cursor-wait disabled:opacity-70 ${pushButtonTone}`}
              onClick={handlePushToggle}
              title={pushStatusTitle[pushStatus]}
              disabled={pushBusy || pushStatus === "checking"}
            >
              <PushIcon size={16} />
              <span className="hidden sm:inline">{pushStatusLabel[pushStatus]}</span>
              {adminUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bapsim-red px-1 text-[10px] font-black text-white">
                  {adminUnreadCount}
                </span>
              ) : null}
            </button>
            <span className="hidden text-sm font-bold text-stone-700 sm:inline">{adminName}</span>
            <form action={logoutAdminAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200"
              >
                <LogOut size={14} />
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-wrap gap-2 lg:flex-col no-print">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`focus-ring flex min-w-max items-center gap-2 rounded-md px-3 py-3 text-sm font-black lg:w-full ${
                  tab === item.id
                    ? "bg-bapsim-red text-white"
                    : "border border-stone-200 bg-white text-stone-700"
                }`}
                onClick={() => {
                  setTab(item.id);
                  if (item.id === "important") {
                    store.markNotificationsRead("admin");
                  }
                }}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <section className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-soft no-print">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`focus-ring rounded-md px-3 py-2 text-sm font-black ${
                    selectedDate === todayKey()
                      ? "bg-bapsim-red text-white"
                      : "border border-stone-300 bg-white"
                  }`}
                  onClick={() => setSelectedDate(todayKey())}
                >
                  오늘
                </button>
                <button
                  className={`focus-ring rounded-md px-3 py-2 text-sm font-black ${
                    selectedDate === addDays(todayKey(), 1)
                      ? "bg-bapsim-red text-white"
                      : "border border-stone-300 bg-white"
                  }`}
                  onClick={() => setSelectedDate(addDays(todayKey(), 1))}
                >
                  내일
                </button>
                <input
                  className="focus-ring rounded-md border border-stone-300 px-3 py-2 text-sm font-bold"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mealTypes.map((mealType) => (
                  <button
                    key={mealType.id}
                    className={`focus-ring rounded-md px-3 py-2 text-sm font-black ${
                      selectedMealType?.id === mealType.id
                        ? "bg-stone-900 text-white"
                        : "border border-stone-300 bg-white"
                    }`}
                    onClick={() => setSelectedMealTypeId(mealType.id)}
                  >
                    {mealType.name}
                    <span className="ml-2 text-xs opacity-70">{mealType.cutoffTime}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="일반 식수" value={`${totals.regularQuantity}개`} tone="red" />
            <StatCard label="개인도시락" value={`${totals.lunchboxQuantity}개`} tone="blue" />
            <StatCard label="승인 대기" value={store.pendingRequestCount} tone="gold" />
            <StatCard label="중요 확인" value={reviewOrders.length} tone="stone" />
            <StatCard label="안먹음/거절" value={totals.rejectedCount} tone="green" />
          </div>

          {tab === "overview" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft print-surface">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">식수 현황</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    {formatKoreanDate(selectedDate)} {selectedMealType?.name ?? "식사"} 기준 최종 수량과 거래처 상태
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 text-stone-400" size={16} />
                    <input
                      className="focus-ring w-full rounded-md border border-stone-300 py-2 pl-9 pr-3 text-sm md:w-64"
                      placeholder="업체명, 주소, 담당자"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                    onClick={() =>
                      downloadCsv("bapsim-delivery.csv", buildDeliveryRows(state, deliveryOrders))
                    }
                  >
                    <Download size={16} />
                    엑셀
                  </button>
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                    onClick={() => window.print()}
                  >
                    <Printer size={16} />
                    인쇄
                  </button>
                </div>
              </div>
              <OrderTable orders={visibleOrders} adminName={adminName} store={store} />
            </div>
          ) : null}

          {tab === "important" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
                <h2 className="text-xl font-black">승인 대기 요청</h2>
                <div className="mt-4 space-y-3">
                  {pendingRequests.length === 0 ? (
                    <EmptyState label="승인 대기 요청이 없습니다." />
                  ) : (
                    pendingRequests.map((request) => {
                      const client = store.getClient(request.clientId);
                      return (
                        <div key={request.id} className="rounded-lg border border-stone-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{client?.name}</p>
                              <p className="mt-1 text-sm font-bold text-bapsim-red">
                                {requestTypeLabel(request.type)}
                              </p>
                              <p className="mt-2 text-sm text-stone-600">
                                {request.currentQuantity !== undefined
                                  ? `${request.currentQuantity}개 -> ${request.requestedQuantity}개`
                                  : "업체 정보 변경 요청"}
                              </p>
                              {request.memo ? (
                                <p className="mt-1 text-sm text-stone-500">{request.memo}</p>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="focus-ring rounded-md bg-emerald-600 p-2 text-white"
                                title="승인"
                                onClick={() => store.resolveRequest(request.id, "approved", adminName)}
                              >
                                <Check size={18} />
                              </button>
                              <button
                                className="focus-ring rounded-md bg-stone-700 p-2 text-white"
                                title="거절"
                                onClick={() => store.resolveRequest(request.id, "rejected", adminName)}
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
                <h2 className="text-xl font-black">확인 필요 변경</h2>
                <div className="mt-4 space-y-3">
                  {reviewOrders.length === 0 ? (
                    <EmptyState label="확인할 중요 변경이 없습니다." />
                  ) : (
                    reviewOrders.map((order) => {
                      const client = store.getClient(order.clientId);
                      return (
                        <div key={order.id} className="rounded-lg border border-stone-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{client?.name}</p>
                              <p className="mt-1 text-sm text-stone-600">
                                기본 {order.baseQuantity}개, 최종 {order.finalQuantity}개
                              </p>
                              {order.memo ? (
                                <p className="mt-1 text-sm text-stone-500">{order.memo}</p>
                              ) : null}
                            </div>
                            <button
                              className="focus-ring inline-flex items-center gap-2 rounded-md bg-bapsim-red px-3 py-2 text-sm font-black text-white"
                              onClick={() => store.acknowledgeOrder(order.id, adminName)}
                            >
                              <Check size={16} />
                              확인
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "groups" ? (
            <GroupManager adminName={adminName} store={store} />
          ) : null}

          {tab === "clients" ? (
            <ClientManager adminName={adminName} store={store} />
          ) : null}

          {tab === "delivery" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft print-surface delivery-print-panel">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">배달표</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    {formatKoreanDate(selectedDate)} {selectedMealType?.name ?? "식사"} 기준, 거절/안먹음 거래처는 배달 대상에서 제외됩니다.
                  </p>
                </div>
                <div className="flex gap-2 no-print">
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                    onClick={() =>
                      downloadCsv("bapsim-delivery.csv", buildDeliveryRows(state, deliveryOrders))
                    }
                  >
                    <Download size={16} />
                    엑셀
                  </button>
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                    onClick={printDeliveryCards}
                  >
                    <Printer size={16} />
                    인쇄
                  </button>
                </div>
              </div>
              <DeliveryPrintSheet
                date={selectedDate}
                mealName={selectedMealType?.name ?? "식사"}
                orders={deliveryOrders}
                getClient={store.getClient}
              />              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs font-black text-stone-500">
                      <th className="py-3">순서</th>
                      <th>업체</th>
                      <th>배송 장소</th>
                      <th>수량</th>
                      <th>주소</th>
                      <th className="hidden md:table-cell">배달 메모</th>
                      <th className="no-print">순서 변경</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.map((order, index) => {
                      const client = store.getClient(order.clientId);
                      return (
                        <tr key={order.id} className="border-b border-stone-100">
                          <td className="py-3 font-black">{index + 1}</td>
                          <td className="font-bold">{client?.name}</td>
                          <td>
                            <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-black text-stone-700">
                              {mealSupplyTypeLabel(client?.mealSupplyType)}
                            </span>
                          </td>
                          <td className="text-lg font-black text-bapsim-red">{order.finalQuantity}개</td>
                          <td>
                            <a
                              className="inline-flex items-center gap-1 font-bold text-bapsim-red"
                              href={mapUrl(client?.address ?? "")}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MapPin size={15} />
                              {client?.address}
                            </a>
                          </td>
                          <td className="hidden md:table-cell">{client?.deliveryMemo}</td>
                          <td className="no-print">
                            <div className="flex gap-1">
                              <button
                                className="focus-ring rounded-md border border-stone-300 p-2"
                                onClick={() =>
                                  store.moveDeliveryOrder(
                                    order.date,
                                    order.mealTypeId,
                                    order.clientId,
                                    "up",
                                    adminName
                                  )
                                }
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                className="focus-ring rounded-md border border-stone-300 p-2"
                                onClick={() =>
                                  store.moveDeliveryOrder(
                                    order.date,
                                    order.mealTypeId,
                                    order.clientId,
                                    "down",
                                    adminName
                                  )
                                }
                              >
                                <ChevronDown size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "monthly" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">월별 집계</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    기본 식수와 변경/거절을 자동 계산하고, 정산 최종 수량은 별도로 수정할 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="focus-ring rounded-md border border-stone-300 px-3 py-2 text-sm font-bold"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                    onClick={() =>
                      downloadCsv(`bapsim-monthly-${selectedMonth}.csv`, buildMonthlyRows(state, selectedMonth))
                    }
                  >
                    <Download size={16} />
                    엑셀
                  </button>
                </div>
              </div>
              {!state.settlementPricingStorageReady && store.storageMode !== "local" ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
                  월별 단가 저장을 사용하려면 Supabase SQL Editor에서 <code>docs/supabase-monthly-settlement-pricing-migration.sql</code>을 한 번 실행하세요. 수량 정산은 계속 저장할 수 있습니다.
                </div>
              ) : null}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs font-black text-stone-500">
                      <th className="py-3">정산 업체</th>
                      <th>배송 장소</th>
                      <th className="min-w-40">일별 식수</th>
                      <th className="hidden lg:table-cell">기본</th>
                      <th className="hidden lg:table-cell">자동 최종</th>
                      <th>월 최종</th>
                      <th>단가</th>
                      <th>금액</th>
                      <th className="hidden lg:table-cell">거절</th>
                      <th className="hidden lg:table-cell">변경</th>
                      <th className="min-w-48">메모</th>
                      <th>저장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.settlementAccounts.map((account) => {
                      const settlement = getMonthlySettlementForSettlementAccount(state, account.id, selectedMonth);
                      return (
                        <SettlementMonthlyRow
                          key={`${selectedMonth}:${account.id}`}
                          adminName={adminName}
                          account={account}
                          month={selectedMonth}
                          settlement={settlement}
                          store={store}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">설정</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    식사 구분, 마감 시간, 감사 로그 기본 구조
                  </p>
                </div>
                <button
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                  onClick={store.resetDemoData}
                >
                  <RotateCcw size={16} />
                  샘플 초기화
                </button>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-stone-200 p-4">
                  <h3 className="font-black">식사 구분</h3>
                  {state.mealTypes.map((mealType) => (
                    <div key={mealType.id} className="mt-3 flex items-center justify-between rounded-md bg-stone-50 p-3">
                      <span className="font-bold">{mealType.name}</span>
                      <span className="text-sm font-bold text-stone-600">마감 {mealType.cutoffTime}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-stone-200 p-4">
                  <h3 className="font-black">중요 작업 이력</h3>
                  <div className="mt-3 space-y-2">
                    {state.auditLogs.length === 0 ? (
                      <EmptyState label="기록된 작업 이력이 없습니다." />
                    ) : (
                      state.auditLogs.slice(0, 8).map((log) => (
                        <div key={log.id} className="rounded-md bg-stone-50 p-3 text-sm">
                          <p className="font-black">{log.targetLabel}</p>
                          <p className="text-stone-600">{log.detail} · {log.adminName}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function OrderTable({
  orders,
  adminName,
  store
}: {
  orders: DailyMealOrder[];
  adminName: string;
  store: ReturnType<typeof useBapsimStore>;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs font-black text-stone-500">
            <th className="py-3">정산 업체</th>
            <th>배송 장소</th>
            <th>기본</th>
            <th>최종</th>
            <th>상태</th>
            <th className="hidden md:table-cell">주소</th>
            <th className="hidden md:table-cell">배달 메모</th>
            <th className="no-print">확인</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const client = store.getClient(order.clientId);
            return (
              <tr key={order.id} className="border-b border-stone-100">
                <td className="py-3">
                  <p className="font-black">{client?.name}</p>
                  <p className="text-xs font-semibold text-stone-500">{client?.managerName}</p>
                </td>
                <td>
                  <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-black text-stone-700">
                    {mealSupplyTypeLabel(client?.mealSupplyType)}
                  </span>
                </td>
                <td>{order.baseQuantity}개</td>
                <td className="text-lg font-black text-bapsim-red">{order.finalQuantity}개</td>
                <td><StatusBadge order={order} /></td>
                <td className="hidden md:table-cell">
                  <a
                    className="inline-flex items-center gap-1 font-bold text-bapsim-red"
                    href={mapUrl(client?.address ?? "")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={15} />
                    {client?.address}
                  </a>
                </td>
                <td className="hidden md:table-cell">{client?.deliveryMemo}</td>
                <td className="no-print">
                  {order.requiresReview && !order.acknowledged ? (
                    <button
                      className="focus-ring inline-flex items-center gap-2 rounded-md bg-bapsim-red px-3 py-2 text-xs font-black text-white"
                      onClick={() => store.acknowledgeOrder(order.id, adminName)}
                    >
                      <Check size={14} />
                      확인
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-stone-400">완료</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlySettlementRow({
  adminName,
  client,
  month,
  settlement,
  store
}: {
  adminName: string;
  client: Client;
  month: string;
  settlement: ReturnType<typeof getMonthlySettlementForClient>;
  store: ReturnType<typeof useBapsimStore>;
}) {
  const [quantity, setQuantity] = useState(String(settlement.settlementFinalQuantity));
  const [memo, setMemo] = useState(settlement.adjustment?.memo ?? "");

  useEffect(() => {
    setQuantity(String(settlement.settlementFinalQuantity));
    setMemo(settlement.adjustment?.memo ?? "");
  }, [client.id, month, settlement.adjustment?.memo, settlement.settlementFinalQuantity]);

  const parsedQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const normalizedMemo = memo.trim();
  const quantityChanged = parsedQuantity !== settlement.settlementFinalQuantity;
  const memoChanged = normalizedMemo !== (settlement.adjustment?.memo ?? "");
  const dirty = quantityChanged || memoChanged;
  const correction = settlement.settlementFinalQuantity - settlement.computedFinalQuantity;

  return (
    <tr className="border-b border-stone-100 align-top">
      <td className="py-3">
        <p className="font-black">{client.name}</p>
        {correction !== 0 ? (
          <p className="mt-1 text-xs font-bold text-bapsim-red">
            {correction > 0 ? `+${correction}` : correction}개 보정
          </p>
        ) : null}
      </td>
      <td className="py-3">
        <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-black text-stone-700">
          {mealSupplyTypeLabel(client.mealSupplyType)}
        </span>
      </td>
      <td className="hidden md:table-cell py-3">
        {client.deliveryStartDate ? formatKoreanDate(client.deliveryStartDate) : "즉시"}
      </td>
      <td className="hidden sm:table-cell py-3">{settlement.computedBaseQuantity}개</td>
      <td className="hidden sm:table-cell py-3">{settlement.computedFinalQuantity}개</td>
      <td className="py-3">
        <input
          className="focus-ring w-24 rounded-md border border-stone-300 px-3 py-2 text-right text-sm font-black text-bapsim-red"
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </td>
      <td className="hidden sm:table-cell py-3">{settlement.rejectedCount}건</td>
      <td className="hidden sm:table-cell py-3">{settlement.changedCount}건</td>
      <td className="py-3">
        <input
          className="focus-ring w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          value={memo}
          placeholder="정산 보정 사유"
          onChange={(event) => setMemo(event.target.value)}
        />
      </td>
      <td className="py-3">
        <div className="flex gap-1">
          <button
            className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300"
            title="정산 수정 저장"
            disabled={!dirty || quantity.trim() === ""}
            onClick={() =>
              store.updateMonthlyAdjustment(client.id, month, parsedQuantity, normalizedMemo, adminName)
            }
          >
            <Save size={16} />
          </button>
          <button
            className="focus-ring rounded-md border border-stone-300 p-2 text-stone-700"
            title="자동 최종 수량으로 복원"
            onClick={() =>
              store.updateMonthlyAdjustment(
                client.id,
                month,
                settlement.computedFinalQuantity,
                "",
                adminName
              )
            }
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SettlementMonthlyRow({
  adminName,
  account,
  month,
  settlement,
  store
}: {
  adminName: string;
  account: SettlementAccount;
  month: string;
  settlement: ReturnType<typeof getMonthlySettlementForSettlementAccount>;
  store: ReturnType<typeof useBapsimStore>;
}) {
  const [quantity, setQuantity] = useState(String(settlement.settlementFinalQuantity));
  const [unitPrice, setUnitPrice] = useState(String(settlement.unitPrice));
  const [memo, setMemo] = useState(settlement.adjustment?.memo ?? "");
  const pricingReady = store.storageMode === "local" || store.state.settlementPricingStorageReady;
  const dailyQuantities = getMonthlySettlementDailyQuantities(store.state, account.id, month);

  useEffect(() => {
    setQuantity(String(settlement.settlementFinalQuantity));
    setUnitPrice(String(settlement.unitPrice));
    setMemo(settlement.adjustment?.memo ?? "");
  }, [account.id, month, settlement.adjustment?.memo, settlement.settlementFinalQuantity, settlement.unitPrice]);

  const parsedQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const parsedUnitPrice = Math.max(0, Math.floor(Number(unitPrice) || 0));
  const normalizedMemo = memo.trim();
  const dirty =
    parsedQuantity !== settlement.settlementFinalQuantity ||
    (pricingReady && parsedUnitPrice !== settlement.unitPrice) ||
    normalizedMemo !== (settlement.adjustment?.memo ?? "");
  const correction = settlement.settlementFinalQuantity - settlement.computedFinalQuantity;
  const amount = parsedQuantity * parsedUnitPrice;

  return (
    <tr className="border-b border-stone-100 align-top">
      <td className="py-3">
        <p className="font-black">{account.name}</p>
        {correction !== 0 ? <p className="mt-1 text-xs font-bold text-bapsim-red">{correction > 0 ? `+${correction}` : correction}개 보정</p> : null}
      </td>
      <td className="py-3">
        <p className="font-semibold text-stone-700">{settlement.clients.map((client) => client.name).join(" · ") || "배달 장소 없음"}</p>
      </td>
      <td className="py-3">
        {dailyQuantities.length ? (
          <div className="space-y-1 text-xs font-bold text-stone-700">
            {dailyQuantities.map((daily) => (
              <div key={daily.date} className="flex items-center justify-between gap-2">
                <span>{daily.date.slice(5).replace("-", "/")}</span>
                <span>{daily.finalQuantity}개</span>
              </div>
            ))}
          </div>
        ) : <span className="text-xs font-bold text-stone-400">배달 없음</span>}
      </td>
      <td className="hidden lg:table-cell py-3">{settlement.computedBaseQuantity}개</td>
      <td className="hidden lg:table-cell py-3">{settlement.computedFinalQuantity}개</td>
      <td className="py-3">
        <input className="focus-ring w-24 rounded-md border border-stone-300 px-3 py-2 text-right text-sm font-black text-bapsim-red" type="number" min={0} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </td>
      <td className="py-3">
        <input className="focus-ring w-24 rounded-md border border-stone-300 px-3 py-2 text-right text-sm font-black" type="number" min={0} value={unitPrice} disabled={!pricingReady} onChange={(event) => setUnitPrice(event.target.value)} />
      </td>
      <td className="py-3 text-right font-black text-bapsim-red">{formatWon(amount)}</td>
      <td className="hidden lg:table-cell py-3">{settlement.rejectedCount}건</td>
      <td className="hidden lg:table-cell py-3">{settlement.changedCount}건</td>
      <td className="py-3">
        <input className="focus-ring w-full rounded-md border border-stone-300 px-3 py-2 text-sm" value={memo} placeholder="정산 보정 사유" onChange={(event) => setMemo(event.target.value)} />
      </td>
      <td className="py-3">
        <div className="flex gap-1">
          <button className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300" title="정산 수량·단가 저장" disabled={!dirty || quantity.trim() === "" || unitPrice.trim() === ""} onClick={() => store.updateSettlementMonthlyAdjustment(account.id, month, { finalQuantity: parsedQuantity, unitPrice: parsedUnitPrice, memo: normalizedMemo }, adminName)}>
            <Save size={16} />
          </button>
          <button className="focus-ring rounded-md border border-stone-300 p-2 text-stone-700" title="수량과 단가를 기본값으로 복원" onClick={() => store.updateSettlementMonthlyAdjustment(account.id, month, { finalQuantity: settlement.locationAdjustedFinalQuantity, unitPrice: DEFAULT_MEAL_UNIT_PRICE, memo: "" }, adminName)}>
            <RotateCcw size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function DeliveryPrintSheet({
  date,
  mealName,
  orders,
  getClient
}: {
  date: string;
  mealName: string;
  orders: DailyMealOrder[];
  getClient: (clientId: string) => Client | undefined;
}) {
  const pages = orders.reduce<DailyMealOrder[][]>((result, order, index) => {
    const pageIndex = Math.floor(index / 4);
    result[pageIndex] ??= [];
    result[pageIndex].push(order);
    return result;
  }, []);

  return (
    <div className="delivery-print-sheet" aria-hidden="true">
      {pages.map((page, pageIndex) => (
        <section key={`${date}:${mealName}:${pageIndex}`} className="delivery-print-page">
          {[...page, ...Array<DailyMealOrder | null>(Math.max(0, 4 - page.length)).fill(null)].map((order, cardIndex) => {
            const client = order ? getClient(order.clientId) : undefined;
            return (
              <article key={order?.id ?? `blank-${pageIndex}-${cardIndex}`} className={`delivery-print-card${order ? "" : " delivery-print-card--blank"}`}>
                {order ? (
                  <>
                    <div className="delivery-print-card__header">
                      <div>
                        <p className="delivery-print-card__brand">밥심 식사배달관리</p>
                        <p className="delivery-print-card__title">배달 전표</p>
                      </div>
                      <p className="delivery-print-card__order">순서 {pageIndex * 4 + cardIndex + 1}</p>
                    </div>
                    <p className="delivery-print-card__date">{formatKoreanDate(date)} · {mealName}</p>
                    <dl className="delivery-print-card__details">
                      <div><dt>업체</dt><dd>{client?.name}</dd></div>
                      <div><dt>수량</dt><dd className="delivery-print-card__quantity">{order.finalQuantity}개</dd></div>
                      <div className="delivery-print-card__address"><dt>주소</dt><dd>{client?.address}{client?.addressDetail ? ` ${client.addressDetail}` : ""}</dd></div>
                      <div className="delivery-print-card__memo"><dt>메모</dt><dd>{client?.deliveryMemo || "-"}</dd></div>
                    </dl>
                  </>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

type ClientFormState = Pick<
  Client,
  | "name"
  | "address"
  | "addressDetail"
  | "managerName"
  | "managerPhone"
  | "deliveryMemo"
  | "deliveryStartDate"
  | "mealSupplyType"
  | "settlementAccountId"
> & {
  contactAccessGroupId?: string;
  weeklyQuantities: WeeklyQuantities;
  exceptionRules: Holiday[];
};

const emptyClientForm: ClientFormState = {
  name: "",
  address: "",
  addressDetail: "",
  managerName: "",
  managerPhone: "",
  deliveryMemo: "",
  deliveryStartDate: todayKey(),
  mealSupplyType: "regular",
  settlementAccountId: "",
  contactAccessGroupId: "",
  weeklyQuantities: {},
  exceptionRules: []
};

function ClientManager({
  adminName,
  store
}: {
  adminName: string;
  store: ReturnType<typeof useBapsimStore>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [error, setError] = useState("");
  const [qrClient, setQrClient] = useState<Client | null>(null);
  const mealTypes = enabledMealTypes(store.state);

  const createBlankWeeklyQuantities = () =>
    Object.fromEntries(
      mealTypes.map((mealType) => [
        mealType.id,
        Object.fromEntries(WEEKDAYS.map((weekday) => [weekday.index, 0]))
      ])
    ) as WeeklyQuantities;

  const getInviteLink = (inviteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/client/${inviteCode}`;
    }
    return "";
  };

  const getContactAccessGroup = (client: Client) => {
    const member = store.state.contactAccessGroupMembers.find((item) => item.clientId === client.id);
    return store.state.contactAccessGroups.find((group) => group.id === member?.contactAccessGroupId);
  };

  const copyInviteLink = (client: Client) => {
    const contactGroup = getContactAccessGroup(client);
    const link = getInviteLink(contactGroup?.inviteCode ?? client.inviteCode);
    const message = `저희 밥심을 이용해주셔서 감사합니다. 아래 링크를 클릭하시면 식사 관리 화면으로 이동됩니다. 변동사항이 있을 때만 입력해 주세요.\n\n▶ 전용 접속 링크: ${link}\n▶ 보안 PIN 번호: ${contactGroup?.invitePin ?? client.invitePin}`;

    navigator.clipboard.writeText(message).then(() => {
      alert("초대 링크와 PIN 번호, 안내 메시지가 복사되었습니다.\n카카오톡 등에 바로 붙여넣기 하시면 됩니다.");
    });
  };

  const startCreate = () => {
    setEditingClientId(null);
    setForm({
      ...emptyClientForm,
      deliveryStartDate: todayKey(),
      mealSupplyType: "regular",
      weeklyQuantities: createBlankWeeklyQuantities(),
      exceptionRules: []
    });
    setError("");
    setFormOpen(true);
  };

  const startEdit = (client: Client) => {
    setEditingClientId(client.id);
    setForm({
      name: client.name,
      address: client.address,
      addressDetail: client.addressDetail,
      managerName: client.managerName,
      managerPhone: client.managerPhone,
      deliveryMemo: client.deliveryMemo,
      deliveryStartDate: client.deliveryStartDate ?? todayKey(),
      mealSupplyType: client.mealSupplyType ?? "regular",
      settlementAccountId: client.settlementAccountId ?? "",
      contactAccessGroupId: store.state.contactAccessGroupMembers.find((member) => member.clientId === client.id)?.contactAccessGroupId ?? "",
      weeklyQuantities: getWeeklyQuantitiesForClient(store.state, client.id),
      exceptionRules: store.state.holidays.filter(
        (holiday) => holiday.clientId === client.id && holiday.ruleType
      )
    });
    setError("");
    setFormOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.address.trim() || !form.managerName.trim()) {
      setError("업체명, 주소, 담당자명은 필수입니다.");
      return;
    }

    if (editingClientId) {
      store.updateClientRecord(editingClientId, form, adminName);
    } else {
      store.createClientRecord(form, adminName);
    }

    setFormOpen(false);
    setEditingClientId(null);
    setForm(emptyClientForm);
    setError("");
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-black">거래처 관리</h2>
          <p className="text-sm font-semibold text-stone-500">
            업체 정보, 초대 PIN, 사용 상태를 관리합니다.
          </p>
        </div>
        <button
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 text-sm font-black text-white w-full md:w-auto"
          onClick={startCreate}
        >
          <PlusCircle size={17} />
          거래처 등록
        </button>
      </div>

      {formOpen ? (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="업체명"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <Field
              label="담당자명"
              value={form.managerName}
              onChange={(value) => setForm((current) => ({ ...current, managerName: value }))}
            />
            <Field
              label="담당자 연락처"
              value={form.managerPhone}
              onChange={(value) => setForm((current) => ({ ...current, managerPhone: value }))}
            />
            <Field
              label="납품 시작일"
              type="date"
              value={form.deliveryStartDate ?? todayKey()}
              onChange={(value) => setForm((current) => ({ ...current, deliveryStartDate: value }))}
            />
            <label className="block">
              <span className="text-sm font-black text-stone-700">식수 유형</span>
              <select
                className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3"
                value={form.mealSupplyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mealSupplyType: event.target.value as Client["mealSupplyType"]
                  }))
                }
              >
                {Object.entries(MEAL_SUPPLY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            {(store.state.groupStorageReady || store.storageMode === "local") ? (
              <>
                <label className="block">
                  <span className="text-sm font-black text-stone-700">정산 업체</span>
                  <select
                    className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3"
                    value={form.settlementAccountId ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, settlementAccountId: event.target.value || undefined }))}
                  >
                    <option value="">새 정산 업체로 등록</option>
                    {store.state.settlementAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-black text-stone-700">담당자 접속 그룹</span>
                  <select
                    className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3"
                    value={form.contactAccessGroupId ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, contactAccessGroupId: event.target.value || undefined }))}
                  >
                    <option value="">이 장소 전용 담당자 그룹 생성</option>
                    {store.state.contactAccessGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <Field
              label="주소"
              value={form.address}
              onChange={(value) => setForm((current) => ({ ...current, address: value }))}
            />
            <Field
              label="상세주소"
              value={form.addressDetail}
              onChange={(value) => setForm((current) => ({ ...current, addressDetail: value }))}
            />
            <label className="block md:col-span-2">
              <span className="text-sm font-black text-stone-700">배달 메모</span>
              <textarea
                className="focus-ring mt-2 min-h-24 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3"
                value={form.deliveryMemo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, deliveryMemo: event.target.value }))
                }
              />
            </label>
          </div>
          <WeeklyQuantityEditor
            mealTypes={mealTypes}
            weeklyQuantities={form.weeklyQuantities}
            onChange={(weeklyQuantities) =>
              setForm((current) => ({ ...current, weeklyQuantities }))
            }
          />
          <ExceptionRuleEditor
            mealTypes={mealTypes}
            rules={form.exceptionRules}
            onChange={(exceptionRules) =>
              setForm((current) => ({ ...current, exceptionRules }))
            }
          />
          {error ? <p className="mt-3 text-sm font-black text-bapsim-red">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-bapsim-red px-4 py-3 text-sm font-black text-white"
              onClick={save}
            >
              <Save size={17} />
              저장
            </button>
            <button
              className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-black"
              onClick={() => {
                setFormOpen(false);
                setEditingClientId(null);
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {store.state.clients.map((client) => (
          <div key={client.id} className="rounded-lg border border-stone-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-black">{client.name}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      client.status === "active"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {client.status === "active" ? "사용 중" : "일시중지"}
                  </span>
                </div>
                <a
                  className="mt-2 inline-flex items-start gap-1 text-sm font-bold text-bapsim-red break-all whitespace-normal"
                  href={mapUrl(client.address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  <span>{client.address}</span>
                </a>
                <p className="mt-1 text-sm text-stone-600">{client.addressDetail}</p>
                <p className="mt-3 text-sm font-semibold text-stone-700">
                  {client.managerName} · {client.managerPhone}
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black">
                #{client.deliveryOrder}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Info label="초대 코드" value={client.inviteCode} />
              <Info label="PIN" value={client.invitePin} />
              <Info label="식수 유형" value={mealSupplyTypeLabel(client.mealSupplyType)} />
              <Info
                label="납품 시작일"
                value={client.deliveryStartDate ? formatKoreanDate(client.deliveryStartDate) : "즉시"}
              />
              <Info label="배달 메모" value={client.deliveryMemo || "-"} />
              <Info label="최근 접속" value={client.lastSeenAt?.slice(0, 10) ?? "-"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                onClick={() => copyInviteLink(client)}
              >
                <Link size={15} />
                링크 복사
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                onClick={() => setQrClient(client)}
              >
                <QrCode size={15} />
                QR코드
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black ml-auto"
                onClick={() => startEdit(client)}
              >
                <Pencil size={15} />
                수정
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                onClick={() => store.resetClientPin(client.id, adminName)}
              >
                <KeyRound size={15} />
                PIN 재발급
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                onClick={() => store.toggleClientStatus(client.id, adminName)}
              >
                <Power size={15} />
                {client.status === "active" ? "일시중지" : "사용 재개"}
              </button>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 text-red-600 px-3 py-2 text-sm font-black"
                onClick={() => {
                  if (window.confirm(`정말 '${client.name}' 업체를 완전히 삭제하시겠습니까? (이 작업은 되돌릴 수 없으며 주문 내역도 함께 삭제됩니다)`)) {
                    store.deleteClientRecord(client.id, adminName);
                  }
                }}
              >
                <Trash2 size={15} />
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {qrClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-stone-800">{qrClient.name}</h3>
              <button
                className="focus-ring rounded-full p-2 text-stone-500"
                onClick={() => setQrClient(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-stone-600">거래처 전용 접속 QR코드</p>
            
            <div className="mt-8 flex justify-center">
              <div className="rounded-xl border-4 border-bapsim-red p-4">
                <QRCodeSVG value={getInviteLink(getContactAccessGroup(qrClient)?.inviteCode ?? qrClient.inviteCode)} size={200} />
              </div>
            </div>

            <div className="mt-8 rounded-lg bg-stone-100 p-3 text-center">
              <p className="text-sm font-bold text-stone-700">고유 PIN 번호</p>
              <p className="mt-1 text-3xl font-black tracking-[0.2em] text-bapsim-red">
                {getContactAccessGroup(qrClient)?.invitePin ?? qrClient.invitePin}
              </p>
            </div>

            <button
              className="focus-ring mt-4 flex w-full justify-center rounded-lg bg-stone-800 py-3 text-sm font-bold text-white"
              onClick={() => copyInviteLink(qrClient)}
            >
              링크 함께 복사하기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WeeklyQuantityEditor({
  mealTypes,
  weeklyQuantities,
  onChange
}: {
  mealTypes: ReturnType<typeof enabledMealTypes>;
  weeklyQuantities: WeeklyQuantities;
  onChange: (weeklyQuantities: WeeklyQuantities) => void;
}) {
  const setQuantity = (mealTypeId: string, weekday: number, quantity: number) => {
    onChange({
      ...weeklyQuantities,
      [mealTypeId]: {
        ...(weeklyQuantities[mealTypeId] ?? {}),
        [weekday]: Math.max(0, quantity)
      }
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-red-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black">기본 식수표</h3>
          <p className="mt-1 text-sm font-semibold text-stone-500">
            거래처 기본값입니다. 0개는 해당 요일/식사를 안먹음으로 처리합니다.
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs font-black text-stone-500">
              <th className="py-2">식사</th>
              {WEEKDAYS.map((weekday) => (
                <th key={weekday.index} className="px-2 py-2 text-center">
                  {weekday.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mealTypes.map((mealType) => (
              <tr key={mealType.id} className="border-b border-stone-100">
                <td className="py-2 font-black">{mealType.name}</td>
                {WEEKDAYS.map((weekday) => (
                  <td key={weekday.index} className="px-2 py-2">
                    <input
                      className="focus-ring h-10 w-full rounded-md border border-stone-300 text-center font-black"
                      type="number"
                      min={0}
                      value={weeklyQuantities[mealType.id]?.[weekday.index] ?? 0}
                      onChange={(event) =>
                        setQuantity(mealType.id, weekday.index, Number(event.target.value) || 0)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExceptionRuleEditor({
  mealTypes,
  rules,
  onChange
}: {
  mealTypes: ReturnType<typeof enabledMealTypes>;
  rules: Holiday[];
  onChange: (rules: Holiday[]) => void;
}) {
  const [ruleType, setRuleType] = useState<HolidayRuleType>("monthly_last_day");
  const [monthDay, setMonthDay] = useState(31);
  const [specificDate, setSpecificDate] = useState(todayKey());
  const [selectedMealTypeIds, setSelectedMealTypeIds] = useState<string[]>(
    mealTypes.map((mealType) => mealType.id)
  );

  useEffect(() => {
    setSelectedMealTypeIds((current) =>
      current.length > 0 ? current : mealTypes.map((mealType) => mealType.id)
    );
  }, [mealTypes]);

  const toggleMealType = (mealTypeId: string) => {
    setSelectedMealTypeIds((current) =>
      current.includes(mealTypeId)
        ? current.filter((item) => item !== mealTypeId)
        : [...current, mealTypeId]
    );
  };

  const addRule = () => {
    const safeMealTypeIds =
      selectedMealTypeIds.length > 0 ? selectedMealTypeIds : mealTypes.map((mealType) => mealType.id);
    const safeMonthDay = Math.max(1, Math.min(31, monthDay));
    const label =
      ruleType === "monthly_last_day"
        ? "매달 말일 안먹음"
        : ruleType === "monthly_day"
          ? `매월 ${safeMonthDay}일 안먹음`
          : `${specificDate} 안먹음`;

    onChange([
      ...rules,
      createHolidayRule({
        date: makeRuleStorageDate(ruleType, specificDate, safeMonthDay),
        name: label,
        ruleType,
        monthDay: ruleType === "monthly_day" ? safeMonthDay : undefined,
        mealTypeIds: safeMealTypeIds
      })
    ]);
  };

  const mealNames = (mealTypeIds?: string[]) =>
    mealTypes
      .filter((mealType) => !mealTypeIds?.length || mealTypeIds.includes(mealType.id))
      .map((mealType) => mealType.name)
      .join(", ");

  return (
    <div className="mt-4 rounded-lg border border-red-100 bg-white p-4">
      <h3 className="font-black">정기 안먹음 / 특정일 예외</h3>
      <p className="mt-1 text-sm font-semibold text-stone-500">
        말일, 매월 특정일, 특정 날짜에 점심/저녁별로 안먹음을 설정합니다.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
        <select
          className="focus-ring rounded-md border border-stone-300 bg-white px-3 py-3 text-sm font-bold"
          value={ruleType}
          onChange={(event) => setRuleType(event.target.value as HolidayRuleType)}
        >
          <option value="monthly_last_day">매달 말일</option>
          <option value="monthly_day">매월 특정일</option>
          <option value="specific_date">특정 날짜 하루</option>
        </select>
        {ruleType === "monthly_day" ? (
          <input
            className="focus-ring rounded-md border border-stone-300 px-3 py-3 text-sm font-bold"
            type="number"
            min={1}
            max={31}
            value={monthDay}
            onChange={(event) => setMonthDay(Number(event.target.value) || 1)}
          />
        ) : null}
        {ruleType === "specific_date" ? (
          <input
            className="focus-ring rounded-md border border-stone-300 px-3 py-3 text-sm font-bold"
            type="date"
            value={specificDate}
            onChange={(event) => setSpecificDate(event.target.value)}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mealTypes.map((mealType) => (
          <label
            key={mealType.id}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
          >
            <input
              type="checkbox"
              checked={selectedMealTypeIds.includes(mealType.id)}
              onChange={() => toggleMealType(mealType.id)}
            />
            {mealType.name}
          </label>
        ))}
        <button
          className="focus-ring rounded-md bg-stone-900 px-4 py-2 text-sm font-black text-white"
          onClick={addRule}
          type="button"
        >
          예외 추가
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rules.length === 0 ? (
          <EmptyState label="등록된 예외 규칙이 없습니다." />
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-2 rounded-md border border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-black">{rule.name}</p>
                <p className="text-sm font-semibold text-stone-500">{mealNames(rule.mealTypeIds)}</p>
              </div>
              <button
                className="focus-ring rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-black text-bapsim-red"
                type="button"
                onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <p className="text-xs font-black text-stone-500">{label}</p>
      <p className="mt-1 font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 disabled:bg-stone-100 disabled:text-stone-500"
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm font-bold text-stone-500">
      {label}
    </div>
  );
}
