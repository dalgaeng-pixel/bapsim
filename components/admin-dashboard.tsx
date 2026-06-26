"use client";

import {
  AlertTriangle,
  Bell,
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
import { useMemo, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "@/components/logo";
import { logoutAdminAction } from "@/app/actions/auth";
import { subscribeToPushNotifications } from "@/lib/push-client";
import { buildDeliveryRows, buildMonthlyRows, downloadCsv } from "@/lib/export";
import { formatKoreanDate, isPastCutoff } from "@/lib/date";
import { orderStatusClass, orderStatusLabel, requestTypeLabel } from "@/lib/status";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import type { Client, DailyMealOrder, AppState } from "@/lib/types";

const tabs = [
  { id: "overview", label: "오늘 현황", icon: ListChecks },
  { id: "important", label: "중요 변경", icon: AlertTriangle },
  { id: "clients", label: "거래처", icon: Building2 },
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

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone: "red" | "gold" | "green" | "stone";
}) {
  const toneClass = {
    red: "border-red-100 bg-red-50 text-bapsim-red",
    gold: "border-amber-100 bg-amber-50 text-amber-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
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

export function AdminDashboard({ initialState }: { initialState?: AppState }) {
  const store = useBapsimStore(initialState);
  const [tab, setTab] = useState<TabId>("overview");
  const [adminName, setAdminName] = useState("밥심관리자");
  const [search, setSearch] = useState("");

  const { state, activeMealType, totals } = store;
  const cutoffPassed = isPastCutoff(activeMealType?.cutoffTime);

  const sortedOrders = useMemo(() => {
    const key = `${state.orders[0]?.date ?? ""}:${activeMealType?.id ?? ""}`;
    const override = state.deliveryOverrides[key];
    const activeClientIds = [...state.clients]
      .filter((client) => client.status === "active")
      .sort((a, b) => a.deliveryOrder - b.deliveryOrder)
      .map((client) => client.id);
    const orderIds = override ?? activeClientIds;

    return [...state.orders].sort((a, b) => {
      const left = orderIds.indexOf(a.clientId);
      const right = orderIds.indexOf(b.clientId);
      return left - right;
    });
  }, [activeMealType?.id, state.clients, state.deliveryOverrides, state.orders]);

  const visibleOrders = sortedOrders.filter((order) => {
    const client = store.getClient(order.clientId);
    const haystack = `${client?.name ?? ""} ${client?.address ?? ""} ${client?.managerName ?? ""}`;
    return haystack.includes(search);
  });

  const deliveryOrders = visibleOrders.filter(
    (order) => order.status !== "rejected" && order.status !== "holiday" && order.finalQuantity > 0
  );

  const pendingRequests = state.changeRequests.filter((request) => request.status === "pending");
  const reviewOrders = state.orders.filter((order) => order.requiresReview && !order.acknowledged);
  const adminUnreadCount = state.notifications.filter((n) => n.target === "admin" && !n.read).length;

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
            {formatKoreanDate(state.orders[0]?.date ?? "")}
            <span className="rounded-full bg-stone-100 px-3 py-1">
              {cutoffPassed ? "마감됨" : "변경 가능"}
            </span>
            <span className="rounded-full bg-bapsim-rice px-3 py-1 text-bapsim-red">
              {storageModeLabel[store.storageMode]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="relative focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200"
              onClick={() => {
                store.markNotificationsRead("admin");
                subscribeToPushNotifications();
              }}
              title="실시간 알림 켜기 및 알림 읽음 처리"
            >
              <Bell size={16} />
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="오늘 총 식수" value={`${totals.finalQuantity}개`} tone="red" />
            <StatCard label="승인 대기" value={store.pendingRequestCount} tone="gold" />
            <StatCard label="중요 확인" value={store.reviewOrderCount} tone="stone" />
            <StatCard label="식사 거절" value={totals.rejectedCount} tone="green" />
          </div>

          {tab === "overview" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft print-surface">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">오늘 현황</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    {activeMealType?.name ?? "식사"} 기준 최종 수량과 거래처 상태
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

          {tab === "clients" ? (
            <ClientManager adminName={adminName} store={store} />
          ) : null}

          {tab === "delivery" ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft print-surface">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">오늘 배달표</h2>
                  <p className="text-sm font-semibold text-stone-500">
                    거절/휴무 거래처는 배달 대상에서 제외됩니다.
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
                    onClick={() => window.print()}
                  >
                    <Printer size={16} />
                    인쇄
                  </button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs font-black text-stone-500">
                      <th className="py-3">순서</th>
                      <th>업체</th>
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">월별 집계</h2>
                  <p className="text-sm font-semibold text-stone-500">현재 MVP는 샘플 일자 기준 집계입니다.</p>
                </div>
                <button
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold"
                  onClick={() => downloadCsv("bapsim-monthly.csv", buildMonthlyRows(state))}
                >
                  <Download size={16} />
                  엑셀
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs font-black text-stone-500">
                      <th className="py-3">업체</th>
                      <th className="hidden sm:table-cell">기본</th>
                      <th>최종</th>
                      <th className="hidden sm:table-cell">거절</th>
                      <th className="hidden sm:table-cell">변경</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.clients.map((client) => {
                      const orders = state.orders.filter((order) => order.clientId === client.id);
                      return (
                        <tr key={client.id} className="border-b border-stone-100">
                          <td className="py-3 font-black">{client.name}</td>
                          <td className="hidden sm:table-cell">{orders.reduce((sum, order) => sum + order.baseQuantity, 0)}개</td>
                          <td className="font-black text-bapsim-red">
                            {orders.reduce((sum, order) => sum + order.finalQuantity, 0)}개
                          </td>
                          <td className="hidden sm:table-cell">{orders.filter((order) => order.status === "rejected").length}건</td>
                          <td className="hidden sm:table-cell">{orders.filter((order) => order.status === "changed").length}건</td>
                        </tr>
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
            <th className="py-3">업체</th>
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

type ClientFormState = Pick<
  Client,
  "name" | "address" | "addressDetail" | "managerName" | "managerPhone" | "deliveryMemo"
> & {
  defaultQuantity: number;
};

const emptyClientForm: ClientFormState = {
  name: "",
  address: "",
  addressDetail: "",
  managerName: "",
  managerPhone: "",
  deliveryMemo: "",
  defaultQuantity: 0
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

  const getInviteLink = (inviteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/client/${inviteCode}`;
    }
    return "";
  };

  const copyInviteLink = (client: Client) => {
    const link = getInviteLink(client.inviteCode);
    const message = `저희 밥심을 이용해주셔서 감사합니다. 아래 링크를 클릭하시면 간편 배달 화면으로 이동됩니다. 기본정보는 저희 식당에서 입력하여 제공되오니, 변동사항이 있을시 링크를 통하여 식사인원 변경이 있거나, 식사가 필요없을시 이용하여 주시기 바랍니다.\n\n▶ 전용 접속 링크: ${link}\n▶ 보안 PIN 번호: ${client.invitePin}`;
    
    navigator.clipboard.writeText(message).then(() => {
      alert("초대 링크와 PIN 번호, 안내 메시지가 복사되었습니다!\n(카카오톡 등에 바로 붙여넣기 하시면 됩니다.)");
    });
  };

  const startCreate = () => {
    setEditingClientId(null);
    setForm(emptyClientForm);
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
      defaultQuantity: 0
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
      const { defaultQuantity: _defaultQuantity, ...clientUpdates } = form;
      store.updateClientRecord(editingClientId, clientUpdates, adminName);
    } else {
      store.createClientRecord(
        {
          ...form,
          defaultQuantity: Math.max(0, form.defaultQuantity)
        },
        adminName
      );
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
              label="기본 수량"
              type="number"
              value={String(form.defaultQuantity)}
              disabled={Boolean(editingClientId)}
              onChange={(value) =>
                setForm((current) => ({ ...current, defaultQuantity: Number(value) || 0 }))
              }
            />
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
                <QRCodeSVG value={getInviteLink(qrClient.inviteCode)} size={200} />
              </div>
            </div>

            <div className="mt-8 rounded-lg bg-stone-100 p-3 text-center">
              <p className="text-sm font-bold text-stone-700">고유 PIN 번호</p>
              <p className="mt-1 text-3xl font-black tracking-[0.2em] text-bapsim-red">
                {qrClient.invitePin}
              </p>
            </div>

            <button
              className="focus-ring mt-4 flex w-full justify-center rounded-lg bg-stone-800 py-3 text-sm font-bold text-white"
              onClick={() => copyInviteLink(qrClient.inviteCode)}
            >
              링크 함께 복사하기
            </button>
          </div>
        </div>
      ) : null}
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
  type?: "text" | "number";
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
