"use client";

import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Home,
  Minus,
  Moon,
  Plus,
  Save,
  Send
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { formatKoreanDate, isPastCutoffForDate, todayKey } from "@/lib/date";
import { orderStatusClass, orderStatusLabel } from "@/lib/status";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import { usePWAInstall } from "@/lib/use-pwa-install";
import {
  enabledMealTypes,
  getClientPlanningDates,
  getExceptionLabel,
  getHolidayLabelForDate,
  getWeekday,
  getTomorrowKey,
  getOvertimeMealEntry,
  getPreviousOvertimeMealEntry,
  isDinnerMealType,
  isOvertimeMealRegistrationDay,
  mealSupplyTypeLabel,
  WEEKDAYS
} from "@/lib/schedule";
import type { AppState, ContactAccessGroup, DailyMealOrder } from "@/lib/types";

type ClientTab = "today" | "overtime" | "week" | "history" | "profile" | "alerts";

const clientTabs = [
  { id: "overtime", label: "야근 인원", icon: Moon },
  { id: "today", label: "오늘/내일", icon: Home },
  { id: "week", label: "주간 설정", icon: CalendarDays },
  { id: "history", label: "변경 내역", icon: Clock },
  { id: "profile", label: "내 업체", icon: Building2 },
  { id: "alerts", label: "알림", icon: Bell }
] as const;

function slotKey(order: DailyMealOrder) {
  return `${order.clientId}:${order.date}:${order.mealTypeId}`;
}

export function ClientApp({ initialState, contactAccessGroup: initialContactAccessGroup }: { initialState?: AppState; contactAccessGroup?: ContactAccessGroup }) {
  const store = useBapsimStore(initialState, initialContactAccessGroup ? { inviteCode: initialContactAccessGroup.inviteCode, invitePin: initialContactAccessGroup.invitePin } : undefined);
  const [pin, setPin] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [pinError, setPinError] = useState("");
  const [tab, setTab] = useState<ClientTab>("today");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [overtimeDraft, setOvertimeDraft] = useState(0);
  const [infoMode, setInfoMode] = useState<"address" | "contact">("address");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const { deferredPrompt, promptInstall, isIOS, isInstalled } = usePWAInstall();

  const contactAccessGroup = initialContactAccessGroup ?? store.state.contactAccessGroups[0];
  const client = store.state.clients.find((item) => item.id === selectedClientId) ?? store.state.clients[0];
  const today = todayKey();
  const tomorrow = getTomorrowKey(today);
  const planningDates = useMemo(() => getClientPlanningDates(today), [today]);
  const mealTypes = enabledMealTypes(store.state);
  const hideDinnerInMealSettings = client?.overtimeMealRegistrationEnabled === true;
  const visibleMealTypes = hideDinnerInMealSettings
    ? mealTypes.filter((mealType) => !isDinnerMealType(mealType))
    : mealTypes;
  const dinnerMealTypeIds = new Set(mealTypes.filter(isDinnerMealType).map((mealType) => mealType.id));
  const overtimeEntry = useMemo(
    () => (client ? getOvertimeMealEntry(store.state, client.id, today) : undefined),
    [client?.id, store.state.overtimeMealEntries, today]
  );
  const previousOvertimeEntry = useMemo(
    () => (client ? getPreviousOvertimeMealEntry(store.state, client.id, today) : undefined),
    [client?.id, store.state.overtimeMealEntries, today]
  );
  const overtimeRegistrationAvailable = !!client && isOvertimeMealRegistrationDay(store.state, client.id, today);
  const visibleClientTabs = clientTabs.filter(
    (item) => item.id !== "overtime" || client?.overtimeMealRegistrationEnabled === true
  );

  const todayOrders = useMemo(
    () => (client ? store.getClientOrdersForDate(client.id, today) : []),
    [client, store, today]
  );
  const tomorrowOrders = useMemo(
    () => (client ? store.getClientOrdersForDate(client.id, tomorrow) : []),
    [client, store, tomorrow]
  );
  const visibleTodayOrders = hideDinnerInMealSettings
    ? todayOrders.filter((order) => !dinnerMealTypeIds.has(order.mealTypeId))
    : todayOrders;
  const visibleTomorrowOrders = hideDinnerInMealSettings
    ? tomorrowOrders.filter((order) => !dinnerMealTypeIds.has(order.mealTypeId))
    : tomorrowOrders;
  const planningOrders = useMemo(
    () => (client ? planningDates.flatMap((date) => store.getClientOrdersForDate(client.id, date)) : []),
    [client, planningDates, store]
  );

  useEffect(() => {
    if (!selectedClientId && client) {
      setSelectedClientId(client.id);
    }
  }, [client, selectedClientId]);

  useEffect(() => {
    setOvertimeDraft(overtimeEntry?.quantity ?? 0);
  }, [overtimeEntry?.id, overtimeEntry?.quantity, client?.id]);

  useEffect(() => {
    if (tab === "overtime" && client?.overtimeMealRegistrationEnabled !== true) {
      setTab("today");
    }
  }, [client?.overtimeMealRegistrationEnabled, tab]);

  useEffect(() => {
    if (contactAccessGroup) {
      try {
        const savedPin = localStorage.getItem(`bapsim_client_auth_${contactAccessGroup.id}`);
        if (savedPin === contactAccessGroup.invitePin) {
          setLoggedIn(true);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [contactAccessGroup]);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("kakaotalk")) {
      const url = window.location.href;
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    setQuantityDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const order of planningOrders) {
        const key = slotKey(order);
        if (next[key] === undefined) {
          next[key] = order.finalQuantity;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [loggedIn, planningOrders]);

  const logs = useMemo(
    () => store.state.orderChangeLogs.filter((log) => log.clientId === client?.id),
    [client?.id, store.state.orderChangeLogs]
  );

  const requests = useMemo(
    () => store.state.changeRequests.filter((request) => request.clientId === client?.id),
    [client?.id, store.state.changeRequests]
  );

  const notifications = useMemo(
    () =>
      store.state.notifications.filter(
        (notification) => notification.target === "client" && notification.clientId === client?.id
      ),
    [client?.id, store.state.notifications]
  );

  const setDraft = (order: DailyMealOrder, value: number) => {
    setQuantityDrafts((current) => ({
      ...current,
      [slotKey(order)]: Math.max(0, value)
    }));
  };

  const setMemo = (order: DailyMealOrder, value: string) => {
    setMemoDrafts((current) => ({
      ...current,
      [slotKey(order)]: value
    }));
  };

  const saveOrder = (order: DailyMealOrder, zeroStatus: "holiday" | "rejected" = "holiday") => {
    if (!client) {
      return;
    }

    const key = slotKey(order);
    const quantity = quantityDrafts[key] ?? order.finalQuantity;
    store.changeQuantityForSlot(
      client.id,
      order.date,
      order.mealTypeId,
      quantity,
      memoDrafts[key] || "식수 변경",
      client.managerName,
      zeroStatus
    );
    setMemo(order, "");
  };

  const saveWeeklyChanges = () => {
    if (!client) {
      return;
    }

    const changed = planningOrders.filter((order) => {
      const draft = quantityDrafts[slotKey(order)];
      return draft !== undefined && draft !== order.finalQuantity;
    });

    for (const order of changed) {
      store.changeQuantityForSlot(
        client.id,
        order.date,
        order.mealTypeId,
        quantityDrafts[slotKey(order)] ?? order.finalQuantity,
        "주간 설정",
        client.managerName,
        "holiday"
      );
    }

    alert(
      changed.length > 0
        ? `${changed.length}건의 식수 변경을 저장했습니다. 마감 후 항목은 승인 요청으로 들어갑니다.`
        : "변경된 식수가 없습니다."
    );
  };

  if (!store.loaded) {
    return <div className="p-8 text-sm font-semibold text-stone-600">불러오는 중...</div>;
  }

  if (!client) {
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
              <p className="text-sm font-bold text-stone-600">담당자 접속</p>
              <p className="mt-1 text-2xl font-black">{contactAccessGroup?.name ?? client.name}</p>
              <p className="mt-2 text-sm font-semibold text-stone-600">{store.state.clients.length}개 배송 장소</p>
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
                if (pin === (contactAccessGroup?.invitePin ?? client.invitePin)) {
                  setLoggedIn(true);
                  try {
                    localStorage.setItem(`bapsim_client_auth_${contactAccessGroup?.id ?? client.id}`, contactAccessGroup?.invitePin ?? client.invitePin);
                  } catch {
                    // Ignore localStorage errors
                  }
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
    <main className="min-h-screen pb-36 sm:pb-24">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Logo compact hideTextOnMobile />
          <a
            href="tel:0317983342"
            className="ml-auto whitespace-nowrap text-lg font-black leading-none text-bapsim-red sm:text-2xl"
            aria-label="밥심 전화번호 031-798-3342"
          >
            031-798-3342
          </a>
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
        {store.state.clients.length > 1 ? (
          <label className="mb-4 block rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
            <span className="text-sm font-black text-stone-700">배송 장소 선택</span>
            <select
              className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3 font-black"
              value={client.id}
              onChange={(event) => setSelectedClientId(event.target.value)}
            >
              {store.state.clients.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {tab === "today" ? (
          <div className="space-y-4">
            <ClientHeaderCard clientName={client.name} address={client.address} />
            <DateMealSection
              title="오늘"
              date={today}
              clientId={client.id}
              state={store.state}
              orders={visibleTodayOrders}
              mealTypes={visibleMealTypes}
              quantityDrafts={quantityDrafts}
              memoDrafts={memoDrafts}
              onDraftChange={setDraft}
              onMemoChange={setMemo}
              onSave={(order) => {
                saveOrder(order, "holiday");
                alert("식수 변경이 저장되었습니다.");
              }}
              onReject={(order) => {
                if (window.confirm("해당 식사를 안먹음으로 변경하시겠습니까?")) {
                  setDraft(order, 0);
                  store.changeQuantityForSlot(
                    client.id,
                    order.date,
                    order.mealTypeId,
                    0,
                    memoDrafts[slotKey(order)] || "안먹음",
                    client.managerName,
                    "holiday"
                  );
                  alert("안먹음으로 변경되었습니다.");
                }
              }}
            />
            <DateMealSection
              title="내일"
              date={tomorrow}
              clientId={client.id}
              state={store.state}
              orders={visibleTomorrowOrders}
              mealTypes={visibleMealTypes}
              quantityDrafts={quantityDrafts}
              memoDrafts={memoDrafts}
              onDraftChange={setDraft}
              onMemoChange={setMemo}
              onSave={(order) => {
                saveOrder(order, "holiday");
                alert("내일 식수 변경이 저장되었습니다.");
              }}
              onReject={(order) => {
                if (window.confirm("내일 해당 식사를 안먹음으로 변경하시겠습니까?")) {
                  setDraft(order, 0);
                  store.changeQuantityForSlot(
                    client.id,
                    order.date,
                    order.mealTypeId,
                    0,
                    memoDrafts[slotKey(order)] || "안먹음",
                    client.managerName,
                    "holiday"
                  );
                  alert("내일 안먹음 처리가 완료되었습니다.");
                }
              }}
            />
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

        {tab === "overtime" ? (
          <OvertimeMealSection
            date={today}
            quantity={overtimeDraft}
            canRegister={overtimeRegistrationAvailable}
            storageReady={store.state.overtimeMealStorageReady}
            alreadyRegistered={!!overtimeEntry}
            previousRegisteredQuantity={previousOvertimeEntry?.quantity}
            onQuantityChange={setOvertimeDraft}
            onSave={() => {
              if (!client || !store.state.overtimeMealStorageReady || !overtimeRegistrationAvailable) {
                return;
              }
              store.saveOvertimeMealEntry(client.id, today, overtimeDraft);
              alert(overtimeEntry ? "야근 인원을 수정했습니다. 관리자에게 알림이 전송됩니다." : "야근 인원을 등록했습니다. 관리자에게 알림이 전송됩니다.");
            }}
          />
        ) : null}

        {tab === "week" ? (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-black">주간 식수 설정</h2>
                <p className="mt-1 text-sm font-semibold text-stone-500">
                  이번 주와 다음 주의 특정 날짜 식수만 변경합니다. 기본 식수표는 관리자가 관리합니다.
                </p>
              </div>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 text-sm font-black text-white"
                onClick={saveWeeklyChanges}
              >
                <Save size={17} />
                저장
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs font-black text-stone-500">
                    <th className="w-[32%] px-1 py-2 sm:px-2 sm:py-3">날짜</th>
                    {visibleMealTypes.map((mealType) => (
                      <th key={mealType.id} className="px-1 py-2 text-center sm:px-2 sm:py-3">
                        {mealType.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planningDates.map((date) => {
                    const orders = planningOrders.filter((order) => order.date === date);
                    const day = new Date(`${date}T00:00:00`).getDay();
                    const weekdayLabel = WEEKDAYS.find((weekday) => weekday.index === day)?.label ?? "";
                    const isWeekend = day === 0 || day === 6;
                    const holidayLabel = client ? getHolidayLabelForDate(store.state, client.id, date) : undefined;
                    const isRedDate = isWeekend || Boolean(holidayLabel);
                    const dateLabel = holidayLabel ?? (isWeekend ? "주말" : undefined);
                    return (
                      <tr key={date} className={`border-b ${isRedDate ? "border-red-100 bg-red-50/70" : "border-stone-100"}`}>
                        <td className={`px-1 py-2 font-black leading-tight sm:px-2 sm:py-3 ${isRedDate ? "text-bapsim-red" : "text-stone-900"}`}>
                          {date.slice(5)}
                          <span className={`ml-1 text-xs ${isRedDate ? "text-bapsim-red" : "text-stone-500"}`}>{weekdayLabel}</span>
                          {dateLabel ? (
                            <span className="ml-1 inline-flex rounded-full border border-red-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-bapsim-red sm:px-2 sm:text-[10px]">
                              {dateLabel}
                            </span>
                          ) : null}
                        </td>
                        {visibleMealTypes.map((mealType) => {
                          const order = orders.find((item) => item.mealTypeId === mealType.id);
                          if (!order) {
                            return <td key={mealType.id} />;
                          }
                          return (
                            <td key={mealType.id} className="px-1 py-1.5 sm:px-2 sm:py-2">
                              <input
                                className={`focus-ring h-9 w-full rounded-md border text-center text-base font-black sm:h-10 ${isRedDate ? "border-red-200 bg-white text-bapsim-red" : "border-stone-300"}`}
                                type="number"
                                min={0}
                                value={quantityDrafts[slotKey(order)] ?? order.finalQuantity}
                                onChange={(event) => setDraft(order, Number(event.target.value) || 0)}
                              />
                              <p className={`mt-0.5 text-center text-[10px] font-bold ${isRedDate ? "text-red-500" : "text-stone-400"}`}>
                                기본 {order.baseQuantity} / {orderStatusLabel(order.status)}
                              </p>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black">변경 내역</h2>
            <div className="mt-4 space-y-3">
              {logs.length === 0 && requests.length === 0 ? (
                <Empty label="아직 변경 내역이 없습니다." />
              ) : null}
              {logs.map((log) => {
                const mealType = store.getMealType(log.mealTypeId);
                return (
                  <div key={log.id} className="rounded-lg border border-stone-200 p-4">
                    <p className="font-black">
                      {formatKoreanDate(log.date)} {mealType?.name ?? "식사"} {log.beforeQuantity}개 {"->"} {log.afterQuantity}개
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{log.memo ?? "메모 없음"}</p>
                  </div>
                );
              })}
              {requests.map((request) => {
                const mealType = request.mealTypeId ? store.getMealType(request.mealTypeId) : undefined;
                return (
                  <div key={request.id} className="rounded-lg border border-stone-200 p-4">
                    <p className="font-black">요청 상태: {request.status}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {request.date ? `${formatKoreanDate(request.date)} ` : ""}
                      {mealType?.name ? `${mealType.name} ` : ""}
                      {request.currentQuantity !== undefined
                        ? `${request.currentQuantity}개 -> ${request.requestedQuantity}개`
                        : "업체 정보 변경 요청"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="space-y-4">
            {!isInstalled && (
              <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black">바탕화면에 앱 설치하기</h2>
                <p className="mt-1 text-sm font-semibold text-stone-600">매번 링크를 찾을 필요 없이 편리하게 접속하세요.</p>
                <div className="mt-4 space-y-3 text-sm">
                  {deferredPrompt ? (
                    <button
                      className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-4 text-base font-black text-white shadow-md transition-transform hover:scale-[1.02] active:scale-95"
                      onClick={promptInstall}
                    >
                      원클릭 앱 설치하기
                    </button>
                  ) : isIOS ? (
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="font-bold text-stone-800">아이폰 Safari</p>
                      <p className="mt-1 text-stone-600">
                        화면 하단의 공유 버튼을 누른 후 홈 화면에 추가를 선택하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="font-bold text-stone-800">안드로이드 Chrome, 삼성인터넷</p>
                      <p className="mt-1 text-stone-600">
                        브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <h2 className="text-xl font-black">내 업체 정보</h2>
              <div className="mt-4 grid gap-3">
                <Info label="업체명" value={client.name} />
                <Info label="주소" value={`${client.address} ${client.addressDetail}`} />
                <Info label="담당자" value={`${client.managerName} · ${client.managerPhone}`} />
                <Info label="식수 유형" value={mealSupplyTypeLabel(client.mealSupplyType)} />
                <Info
                  label="납품 시작일"
                  value={client.deliveryStartDate ? formatKoreanDate(client.deliveryStartDate) : "즉시"}
                />
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
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1 sm:grid-cols-6">
          {visibleClientTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-black ${
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

function ClientHeaderCard({ clientName, address }: { clientName: string; address: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-bold text-bapsim-red">거래처 식수 관리</p>
      <h2 className="mt-2 text-2xl font-black">{clientName}</h2>
      <p className="mt-1 text-sm font-semibold text-stone-600">{address}</p>
    </div>
  );
}

function OvertimeMealSection({
  date,
  quantity,
  canRegister,
  storageReady,
  alreadyRegistered,
  previousRegisteredQuantity,
  onQuantityChange,
  onSave
}: {
  date: string;
  quantity: number;
  canRegister: boolean;
  storageReady: boolean;
  alreadyRegistered: boolean;
  previousRegisteredQuantity?: number;
  onQuantityChange: (quantity: number) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-bold text-bapsim-red">오늘 야근 인원</p>
      <h2 className="mt-2 text-2xl font-black">{formatKoreanDate(date)} 석식 추가</h2>
      {!storageReady ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          야근 인원 등록을 준비 중입니다. 관리자에게 데이터 설정을 요청해 주세요.
        </p>
      ) : !canRegister ? (
        <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm font-bold text-stone-600">
          주말 또는 공휴일은 야근 인원을 0명으로 처리합니다.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-stone-600">
            오늘 석식에 추가할 인원만 등록해 주세요. 야근이 없어도 0명으로 등록하면 관리자에게 알림이 갑니다.
          </p>
          <div className="mt-4 rounded-md border-2 border-red-300 bg-red-50 p-4 text-sm font-black text-red-950">
            오늘 야근 인원을 등록하지 않으면 최근 등록 인원 {previousRegisteredQuantity ?? 0}명으로 적용됩니다. 야근이 없으면 반드시 0명으로 등록해 주세요.
          </div>
          <div className="mt-6 grid grid-cols-[48px_1fr_48px] items-center gap-3">
            <button
              className="focus-ring grid h-12 place-items-center rounded-md border border-stone-300 bg-white"
              title="야근 인원 1명 감소"
              onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
            >
              <Minus size={20} />
            </button>
            <input
              className="focus-ring h-12 w-full rounded-md border border-stone-300 text-center text-2xl font-black"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => onQuantityChange(Math.max(0, Number(event.target.value.replace(/\D/g, "")) || 0))}
            />
            <button
              className="focus-ring grid h-12 place-items-center rounded-md border border-stone-300 bg-white"
              title="야근 인원 1명 증가"
              onClick={() => onQuantityChange(quantity + 1)}
            >
              <Plus size={20} />
            </button>
          </div>
          <button
            className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 font-black text-white"
            onClick={onSave}
          >
            <Save size={18} />
            {alreadyRegistered ? "야근 인원 수정" : "야근 인원 등록"}
          </button>
        </>
      )}
    </section>
  );
}

function DateMealSection({
  title,
  date,
  clientId,
  state,
  orders,
  mealTypes,
  quantityDrafts,
  memoDrafts,
  onDraftChange,
  onMemoChange,
  onSave,
  onReject
}: {
  title: string;
  date: string;
  clientId: string;
  state: AppState;
  orders: DailyMealOrder[];
  mealTypes: ReturnType<typeof enabledMealTypes>;
  quantityDrafts: Record<string, number>;
  memoDrafts: Record<string, string>;
  onDraftChange: (order: DailyMealOrder, quantity: number) => void;
  onMemoChange: (order: DailyMealOrder, memo: string) => void;
  onSave: (order: DailyMealOrder) => void;
  onReject: (order: DailyMealOrder) => void;
}) {
  const weekday = getWeekday(date);
  const isWeekend = weekday === 0 || weekday === 6;
  const holidayLabel = getHolidayLabelForDate(state, clientId, date);
  const isRedDate = isWeekend || !!holidayLabel;
  const weekdayLabel = WEEKDAYS.find((item) => item.index === weekday)?.label ?? "";

  return (
    <section className="space-y-3">
      <div className={`rounded-lg border p-4 ${isRedDate ? "border-red-200 bg-red-50" : "border-stone-200 bg-stone-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-black ${isRedDate ? "text-bapsim-red" : "text-stone-500"}`}>{title}</p>
            <h2 className={`mt-1 text-2xl font-black ${isRedDate ? "text-red-950" : "text-stone-900"}`}>
              {formatKoreanDate(date)} ({weekdayLabel})
            </h2>
          </div>
          {holidayLabel ? (
            <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-black text-bapsim-red">
              공휴일 · {holidayLabel}
            </span>
          ) : isWeekend ? (
            <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-black text-bapsim-red">주말</span>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-3 ${orders.length > 1 ? "md:grid-cols-2" : ""}`}>
        {orders.map((order) => {
          const mealType = mealTypes.find((item) => item.id === order.mealTypeId);
          const cutoffPassed = isPastCutoffForDate(order.date, mealType?.cutoffTime);
          const key = slotKey(order);
          const draft = quantityDrafts[key] ?? order.finalQuantity;
          const noMealLabel = getExceptionLabel(state, clientId, order.mealTypeId, order.date);
          const holidayLocked = Boolean(noMealLabel) && order.status === "holiday";

          return (
            <div key={key} className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-stone-500">{mealType?.name ?? "식사"}</p>
                  <p className="mt-2 text-4xl font-black text-bapsim-red">{order.finalQuantity}개</p>
                  <p className="mt-2 text-sm font-semibold text-stone-600">
                    {holidayLocked ? `${noMealLabel} · 식수 0개` : `기본 ${order.baseQuantity}개 · 마감 ${mealType?.cutoffTime ?? "10:00"}`}
                  </p>
                </div>
                <span
                  className={`inline-flex min-w-20 justify-center rounded-full border px-3 py-1 text-sm font-black ${orderStatusClass(order.status)}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>

              {holidayLocked ? (
                <p className="mt-5 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-bold text-bapsim-red">
                  공휴일 또는 등록된 휴일은 식수 변경 없이 0명으로 처리됩니다.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-[44px_1fr_44px] items-center gap-3">
                    <button
                      className="focus-ring grid h-11 place-items-center rounded-md border border-stone-300 bg-white"
                      onClick={() => onDraftChange(order, Math.max(0, draft - 1))}
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      className="focus-ring h-11 w-full min-w-0 rounded-md border border-stone-300 text-center text-xl font-black"
                      inputMode="numeric"
                      value={draft}
                      onChange={(event) => onDraftChange(order, Number(event.target.value.replace(/\D/g, "")) || 0)}
                    />
                    <button
                      className="focus-ring grid h-11 place-items-center rounded-md border border-stone-300 bg-white"
                      onClick={() => onDraftChange(order, draft + 1)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <input
                    className="focus-ring mt-3 w-full rounded-md border border-stone-300 px-3 py-3 text-sm"
                    placeholder="메모"
                    value={memoDrafts[key] ?? ""}
                    onChange={(event) => onMemoChange(order, event.target.value)}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="focus-ring flex items-center justify-center gap-2 rounded-md bg-stone-700 px-3 py-3 text-sm font-black text-white"
                      onClick={() => onSave(order)}
                    >
                      <Send size={16} />
                      {cutoffPassed ? "변경 요청" : "변경 저장"}
                    </button>
                    <button
                      className="focus-ring rounded-md border border-bapsim-red bg-white px-3 py-3 text-sm font-black text-bapsim-red"
                      onClick={() => onReject(order)}
                    >
                      안먹음
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
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
