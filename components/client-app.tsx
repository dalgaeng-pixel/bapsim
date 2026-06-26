"use client";

import {
  Bell,
  Building2,
  Check,
  Clock,
  Home,
  Minus,
  Plus,
  Send,
  UserRound
} from "lucide-react";
import { useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { formatKoreanDate, isPastCutoff } from "@/lib/date";
import { orderStatusClass, orderStatusLabel } from "@/lib/status";
import { useBapsimStore } from "@/lib/use-bapsim-store";

type ClientTab = "today" | "history" | "profile" | "alerts";

const clientTabs = [
  { id: "today", label: "오늘 식수", icon: Home },
  { id: "history", label: "변경 내역", icon: Clock },
  { id: "profile", label: "내 업체", icon: Building2 },
  { id: "alerts", label: "알림", icon: Bell }
] as const;

export function ClientApp({ initialState }: { initialState?: AppState }) {
  const store = useBapsimStore(initialState);
  const [pin, setPin] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [pinError, setPinError] = useState("");
  const [tab, setTab] = useState<ClientTab>("today");
  const [quantityDraft, setQuantityDraft] = useState(0);
  const [memo, setMemo] = useState("");
  const [infoMode, setInfoMode] = useState<"address" | "contact">("address");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");

  const client = store.state.clients[0];
  const order = store.state.orders.find((item) => item.clientId === client?.id);
  const mealType = order ? store.getMealType(order.mealTypeId) : store.activeMealType;
  const cutoffPassed = isPastCutoff(mealType?.cutoffTime);

  const logs = useMemo(
    () => store.state.orderChangeLogs.filter((log) => log.clientId === client?.id),
    [client?.id, store.state.orderChangeLogs]
  );

  const requests = useMemo(
    () => store.state.changeRequests.filter((request) => request.clientId === client?.id),
    [client?.id, store.state.changeRequests]
  );

  const notifications = useMemo(
    () => store.state.notifications.filter((notification) => notification.target === "client" && notification.clientId === client?.id),
    [client?.id, store.state.notifications]
  );

  if (!store.loaded) {
    return <div className="p-8 text-sm font-semibold text-stone-600">불러오는 중...</div>;
  }

  if (!client || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-xl font-black text-stone-800">등록된 거래처가 없습니다</h2>
          <p className="mt-2 text-sm font-semibold text-stone-600">
            관리자 화면에서 거래처를 먼저 등록해주세요.
          </p>
        </div>
      </div>
    );
  }
  if (!loggedIn) {
    return (
      <main className="min-h-screen px-4 py-6">
        <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-center">
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
            <Logo />
            <div className="mt-8 rounded-lg bg-bapsim-rice p-4">
              <p className="text-sm font-bold text-stone-600">초대 거래처</p>
              <p className="mt-1 text-2xl font-black">{client.name}</p>
              <p className="mt-2 text-sm font-semibold text-stone-600">{client.address}</p>
            </div>
            <label className="mt-6 block">
              <span className="text-sm font-bold text-stone-700">4자리 PIN</span>
              <input
                className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-4 text-center text-2xl font-black tracking-[0.35em]"
                maxLength={4}
                inputMode="numeric"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, ""));
                  setPinError("");
                }}
              />
            </label>
            {pinError ? <p className="mt-2 text-sm font-bold text-bapsim-red">{pinError}</p> : null}
            <button
              className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-4 font-black text-white"
              onClick={() => {
                if (pin === client.invitePin) {
                  setLoggedIn(true);
                  setQuantityDraft(order.finalQuantity);
                  return;
                }
                setPinError("PIN이 맞지 않습니다.");
              }}
            >
              <Check size={18} />
              시작하기
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Logo compact />
          <button
            className="focus-ring rounded-full border border-stone-200 bg-white p-2"
            onClick={() => {
              if ("Notification" in window) {
                Notification.requestPermission();
              }
            }}
            title="알림 허용"
          >
            <Bell size={18} />
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-5">
        {tab === "today" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-bold text-bapsim-red">{formatKoreanDate(order.date)}</p>
              <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-black">{client.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-stone-600">{client.address}</p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-black">
                  {cutoffPassed ? "마감됨" : "변경 가능"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-stone-500">{mealType?.name ?? "식사"}</p>
                  <p className="mt-2 text-5xl font-black text-bapsim-red">{order.finalQuantity}개</p>
                  <p className="mt-2 text-sm font-semibold text-stone-600">
                    기본 {order.baseQuantity}개 · 마감 {mealType?.cutoffTime ?? "10:00"}
                  </p>
                </div>
                <span
                  className={`inline-flex min-w-20 justify-center rounded-full border px-3 py-1 text-sm font-black ${orderStatusClass(order.status)}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>

              <div className="mt-6 rounded-lg bg-stone-50 p-4">
                <p className="text-sm font-black text-stone-700">
                  {cutoffPassed ? "변경 요청 수량" : "변경 후 수량"}
                </p>
                <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-3">
                  <button
                    className="focus-ring grid h-11 place-items-center rounded-md border border-stone-300 bg-white"
                    onClick={() => setQuantityDraft(Math.max(0, quantityDraft - 1))}
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    className="focus-ring h-11 rounded-md border border-stone-300 text-center text-xl font-black"
                    inputMode="numeric"
                    value={quantityDraft}
                    onChange={(event) => setQuantityDraft(Number(event.target.value.replace(/\D/g, "")) || 0)}
                  />
                  <button
                    className="focus-ring grid h-11 place-items-center rounded-md border border-stone-300 bg-white"
                    onClick={() => setQuantityDraft(quantityDraft + 1)}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[-5, -1, 1, 5].map((step) => (
                    <button
                      key={step}
                      className="focus-ring rounded-md border border-stone-300 bg-white px-2 py-2 text-sm font-black"
                      onClick={() => setQuantityDraft(Math.max(0, quantityDraft + step))}
                    >
                      {step > 0 ? `+${step}` : step}
                    </button>
                  ))}
                </div>
                <input
                  className="focus-ring mt-3 w-full rounded-md border border-stone-300 px-3 py-3 text-sm"
                  placeholder="메모"
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    className="focus-ring flex items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 font-black text-white"
                    onClick={() => {
                      store.changeQuantity(order.id, quantityDraft, memo, client.managerName);
                      setMemo("");
                    }}
                  >
                    <Send size={17} />
                    {cutoffPassed ? "변경 요청하기" : "변경 저장"}
                  </button>
                  <button
                    className="focus-ring flex items-center justify-center gap-2 rounded-md border border-bapsim-red bg-white px-4 py-3 font-black text-bapsim-red"
                    onClick={() => {
                      store.changeQuantity(order.id, 0, memo || "식사 거절", client.managerName);
                      setQuantityDraft(0);
                    }}
                  >
                    오늘 식사 거절
                  </button>
                </div>
              </div>
            </div>

            {requests.filter((request) => request.status === "pending").length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-black text-amber-900">승인 대기 중인 요청이 있습니다.</p>
                <p className="mt-1 text-sm font-semibold text-amber-800">
                  관리자가 확인하면 결과 알림을 받을 수 있습니다.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black">변경 내역</h2>
            <div className="mt-4 space-y-3">
              {logs.length === 0 && requests.length === 0 ? (
                <Empty label="아직 변경 내역이 없습니다." />
              ) : null}
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-stone-200 p-4">
                  <p className="font-black">
                    {log.beforeQuantity}개 {"->"} {log.afterQuantity}개
                  </p>
                  <p className="mt-1 text-sm text-stone-600">{log.memo ?? "메모 없음"}</p>
                </div>
              ))}
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-stone-200 p-4">
                  <p className="font-black">요청 상태: {request.status}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {request.currentQuantity !== undefined
                      ? `${request.currentQuantity}개 -> ${request.requestedQuantity}개`
                      : "업체 정보 변경 요청"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <h2 className="text-xl font-black">내 업체 정보</h2>
              <div className="mt-4 grid gap-3">
                <Info label="업체명" value={client.name} />
                <Info label="주소" value={`${client.address} ${client.addressDetail}`} />
                <Info label="담당자" value={`${client.managerName} · ${client.managerPhone}`} />
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`focus-ring rounded-md px-3 py-3 font-black ${
                    infoMode === "address" ? "bg-bapsim-red text-white" : "border border-stone-300 bg-white"
                  }`}
                  onClick={() => setInfoMode("address")}
                >
                  주소 변경
                </button>
                <button
                  className={`focus-ring rounded-md px-3 py-3 font-black ${
                    infoMode === "contact" ? "bg-bapsim-red text-white" : "border border-stone-300 bg-white"
                  }`}
                  onClick={() => setInfoMode("contact")}
                >
                  담당자 변경
                </button>
              </div>

              {infoMode === "address" ? (
                <div className="mt-4 space-y-3">
                  <input
                    className="focus-ring w-full rounded-md border border-stone-300 px-3 py-3"
                    placeholder="새 주소"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                  <input
                    className="focus-ring w-full rounded-md border border-stone-300 px-3 py-3"
                    placeholder="상세주소"
                    value={addressDetail}
                    onChange={(event) => setAddressDetail(event.target.value)}
                  />
                  <button
                    className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 font-black text-white"
                    onClick={() => {
                      store.submitInfoRequest(client.id, "address_update", { address, addressDetail });
                      setAddress("");
                      setAddressDetail("");
                    }}
                  >
                    <Send size={17} />
                    주소 변경 요청
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <input
                    className="focus-ring w-full rounded-md border border-stone-300 px-3 py-3"
                    placeholder="새 담당자명"
                    value={managerName}
                    onChange={(event) => setManagerName(event.target.value)}
                  />
                  <input
                    className="focus-ring w-full rounded-md border border-stone-300 px-3 py-3"
                    placeholder="새 연락처"
                    value={managerPhone}
                    onChange={(event) => setManagerPhone(event.target.value)}
                  />
                  <button
                    className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 font-black text-white"
                    onClick={() => {
                      store.submitInfoRequest(client.id, "contact_update", { managerName, managerPhone });
                      setManagerName("");
                      setManagerPhone("");
                    }}
                  >
                    <Send size={17} />
                    담당자 변경 요청
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "alerts" ? (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">알림</h2>
              <button
                className="focus-ring rounded-md border border-stone-300 px-3 py-2 text-sm font-bold"
                onClick={() => store.markNotificationsRead("client", client.id)}
              >
                모두 읽음
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {notifications.length === 0 ? (
                <Empty label="받은 알림이 없습니다." />
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-lg border p-4 ${
                      notification.read ? "border-stone-200 bg-white" : "border-red-100 bg-red-50"
                    }`}
                  >
                    <p className="font-black">{notification.title}</p>
                    <p className="mt-1 text-sm text-stone-600">{notification.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white px-3 py-2">
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
          {clientTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-black ${
                  tab === item.id ? "bg-bapsim-red text-white" : "text-stone-600"
                }`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
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

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm font-bold text-stone-500">
      {label}
    </div>
  );
}
