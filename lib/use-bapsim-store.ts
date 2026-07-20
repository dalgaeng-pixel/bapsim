"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTime, isPastCutoffForDate, todayKey } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import {
  buildBaseOrder,
  buildDefaultQuantitiesFromWeekly,
  createLocalId,
  enabledMealTypes,
  getBaseQuantity,
  getMonthlySettlementForClient,
  getMonthlySettlementForSettlementAccount,
  DEFAULT_MEAL_UNIT_PRICE,
  getOrderForSlot,
  getOrdersForDate,
  normalizeAppState,
  type WeeklyQuantities
} from "@/lib/schedule";
import type {
  AdminAuditLog,
  AppNotification,
  AppState,
  ChangeRequest,
  Client,
  ContactAccessGroup,
  ContactAccessGroupMember,
  SettlementAccount,
  DailyMealOrder,
  OrderChangeLog,
  Holiday
} from "@/lib/types";

const STORAGE_KEY = "bapsim-meal-manager-state-v2";

type StorageMode = "local" | "supabase" | "supabase-error";

type RemoteStateResponse = {
  configured: boolean;
  mode: StorageMode;
  hasData?: boolean;
  state?: AppState;
  message?: string;
};

function id(prefix: string) {
  return createLocalId(prefix);
}

function writeState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Ignore Storage access errors in strict browsers (like KakaoTalk)
  }
}

import { syncAppStateDiffAction } from "@/app/actions/state";
import { syncContactAccessGroupDiffAction } from "@/app/actions/contact-state";
import type { AppStateArrayKey, AppStateDiff } from "@/lib/supabase-state";

type ContactSyncCredentials = {
  inviteCode: string;
  invitePin: string;
};

function calculateDiff(prev: AppState, next: AppState): AppStateDiff {
  const diff: AppStateDiff = {};

  const arrayKeys: AppStateArrayKey[] = [
    "clients",
    "settlementAccounts",
    "contactAccessGroups",
    "contactAccessGroupMembers",
    "mealTypes",
    "defaultQuantities",
    "orders",
    "orderChangeLogs",
    "changeRequests",
    "holidays",
    "monthlyAdjustments",
    "notifications",
    "auditLogs"
  ];

  for (const key of arrayKeys) {
    const prevArr = prev[key] as any[];
    const nextArr = next[key] as any[];
    
    const changed = nextArr.filter((nextItem) => {
      const prevItem = prevArr.find((p) => p.id === nextItem.id);
      return !prevItem || prevItem !== nextItem;
    });

    if (changed.length > 0) {
      (diff as any)[key] = changed;
    }

    const deleted = prevArr
      .filter((prevItem) => !nextArr.some((nextItem) => nextItem.id === prevItem.id))
      .map((prevItem) => prevItem.id);

    if (deleted.length > 0) {
      diff.deleted ??= {};
      diff.deleted[key] = deleted;
    }
  }

  diff.groupStorageReady = next.groupStorageReady;
  diff.settlementPricingStorageReady = next.settlementPricingStorageReady;
  diff.deliveryCorrectionStorageReady = next.deliveryCorrectionStorageReady;

  // Handle deliveryOverrides (Record<string, string[]>)
  const overridesDiff: Record<string, string[]> = {};
  let hasOverridesDiff = false;
  for (const key of Object.keys(next.deliveryOverrides)) {
    if (prev.deliveryOverrides[key] !== next.deliveryOverrides[key]) {
      overridesDiff[key] = next.deliveryOverrides[key];
      hasOverridesDiff = true;
    }
  }
  if (hasOverridesDiff) {
    diff.deliveryOverrides = overridesDiff;
  }

  if (
    (diff.defaultQuantities?.length || diff.orders?.length || diff.deleted?.defaultQuantities?.length) &&
    !diff.mealTypes
  ) {
    diff.mealTypes = next.mealTypes;
  }

  return diff;
}

function isImportantChange(beforeQuantity: number, afterQuantity: number) {
  const difference = Math.abs(afterQuantity - beforeQuantity);
  const ratio = beforeQuantity === 0 ? 1 : difference / beforeQuantity;
  return difference >= 5 || ratio >= 0.2;
}

function createPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function useBapsimStore(initialState?: AppState, contactSyncCredentials?: ContactSyncCredentials) {
  const [state, setState] = useState<AppState>(() => normalizeAppState(initialState ?? createInitialState()));
  const [loaded, setLoaded] = useState(!!initialState);
  const [storageMode, setStorageMode] = useState<StorageMode>(initialState ? "supabase" : "local");
  const remoteEnabledRef = useRef(!!initialState);
  const contactSyncRef = useRef(contactSyncCredentials);

  useEffect(() => {
    if (initialState) {
      return;
    }

    // fallback for local storage if no initial state
    let nextState = normalizeAppState(createInitialState());
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          nextState = normalizeAppState(JSON.parse(saved) as AppState);
        } catch {
          nextState = normalizeAppState(createInitialState());
        }
      }
    } catch (e) {
      // Ignore Storage access errors in strict browsers (like KakaoTalk)
    }
    setState(nextState);
    setLoaded(true);
  }, [initialState]);

  const commit = useCallback((updater: (previous: AppState) => AppState) => {
    setState((previous) => {
      const next = updater(previous);
      writeState(next);
      
      if (remoteEnabledRef.current) {
        const diff = calculateDiff(previous, next);
        if (Object.keys(diff).length > 0) {
          const credentials = contactSyncRef.current;
          if (credentials) {
            void syncContactAccessGroupDiffAction(credentials.inviteCode, credentials.invitePin, diff);
          } else {
            void syncAppStateDiffAction(diff);
          }
        }
      }
      return next;
    });
  }, []);

  const activeMealType = state.mealTypes.find((mealType) => mealType.enabled) ?? state.mealTypes[0];

  const pendingRequestCount = state.changeRequests.filter(
    (request) => request.status === "pending"
  ).length;

  const reviewOrderCount = state.orders.filter(
    (order) => order.requiresReview && !order.acknowledged
  ).length;

  const unreadNotificationCount = state.notifications.filter(
    (notification) => !notification.read
  ).length;

  const totals = useMemo(() => {
    const activeOrders = state.orders.filter((order) => order.status !== "holiday");
    const finalQuantity = activeOrders.reduce((sum, order) => sum + order.finalQuantity, 0);
    const rejectedCount = activeOrders.filter((order) => order.status === "rejected").length;
    const changedCount = activeOrders.filter((order) => order.status === "changed").length;

    return {
      finalQuantity,
      rejectedCount,
      changedCount,
      activeClientCount: state.clients.filter((client) => client.status === "active").length
    };
  }, [state.clients, state.orders]);

  const getClient = useCallback(
    (clientId: string) => state.clients.find((client) => client.id === clientId),
    [state.clients]
  );

  const getMealType = useCallback(
    (mealTypeId: string) => state.mealTypes.find((mealType) => mealType.id === mealTypeId),
    [state.mealTypes]
  );

  const getOrdersByDate = useCallback(
    (date: string, mealTypeId?: string) => getOrdersForDate(state, date, mealTypeId),
    [state]
  );

  const getClientOrdersForDate = useCallback(
    (clientId: string, date: string) =>
      enabledMealTypes(state).map((mealType) =>
        getOrderForSlot(state, clientId, mealType.id, date)
      ),
    [state]
  );

  const addNotification = useCallback(
    (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      commit((previous) => ({
        ...previous,
        notifications: [
          {
            ...notification,
            id: id("notification"),
            read: false,
            createdAt: new Date().toISOString()
          },
          ...previous.notifications
        ]
      }));
    },
    [commit]
  );

  const addAuditLog = useCallback(
    (log: Omit<AdminAuditLog, "id" | "createdAt">) => {
      commit((previous) => ({
        ...previous,
        auditLogs: [
          {
            ...log,
            id: id("audit"),
            createdAt: new Date().toISOString()
          },
          ...previous.auditLogs
        ]
      }));
    },
    [commit]
  );

  const changeQuantity = useCallback(
    (orderId: string, afterQuantity: number, memo: string, actorName: string) => {
      commit((previous) => {
        const order = previous.orders.find((item) => item.id === orderId);
        if (!order) {
          return previous;
        }

        const client = previous.clients.find((item) => item.id === order.clientId);
        const mealType = previous.mealTypes.find((item) => item.id === order.mealTypeId);
        const cutoffPassed = isPastCutoffForDate(order.date, mealType?.cutoffTime);
        const createdAt = new Date().toISOString();

        if (cutoffPassed) {
          const request: ChangeRequest = {
            id: id("request"),
            type: afterQuantity === 0 ? "late_rejection" : "late_quantity",
            status: "pending",
            clientId: order.clientId,
            orderId: order.id,
            mealTypeId: order.mealTypeId,
            date: order.date,
            currentQuantity: order.finalQuantity,
            requestedQuantity: afterQuantity,
            memo,
            requestedAt: createdAt
          };

          const notification: AppNotification = {
            id: id("notification"),
            target: "admin",
            clientId: order.clientId,
            title: "마감 후 변경 요청",
            body: `${client?.name ?? "거래처"}이 ${mealType?.name ?? "식사"} ${order.finalQuantity}개에서 ${afterQuantity}개로 변경 요청했습니다.`,
            read: false,
            createdAt
          };

          return {
            ...previous,
            changeRequests: [request, ...previous.changeRequests],
            notifications: [notification, ...previous.notifications]
          };
        }

        const important = isImportantChange(order.finalQuantity, afterQuantity);
        const nextStatus = afterQuantity === 0 ? "rejected" : afterQuantity === order.baseQuantity ? "normal" : "changed";
        const nextOrder: DailyMealOrder = {
          ...order,
          finalQuantity: afterQuantity,
          status: nextStatus,
          memo,
          requiresReview: important || afterQuantity === 0,
          acknowledged: false,
          updatedAt: createdAt
        };

        const changeLog: OrderChangeLog = {
          id: id("log"),
          orderId: order.id,
          clientId: order.clientId,
          mealTypeId: order.mealTypeId,
          date: order.date,
          actorType: "client",
          actorName,
          beforeQuantity: order.finalQuantity,
          afterQuantity,
          memo,
          createdAt
        };

        const notifications = [...previous.notifications];
        if (nextOrder.requiresReview) {
          notifications.unshift({
            id: id("notification"),
            target: "admin",
            clientId: order.clientId,
            title: afterQuantity === 0 ? "식사 거절" : "중요 수량 변경",
            body: `${client?.name ?? "거래처"} ${mealType?.name ?? "식사"} ${order.finalQuantity}개 -> ${afterQuantity}개`,
            read: false,
            createdAt
          });
        }

        return {
          ...previous,
          orders: previous.orders.map((item) => (item.id === order.id ? nextOrder : item)),
          orderChangeLogs: [changeLog, ...previous.orderChangeLogs],
          notifications
        };
      });
    },
    [commit]
  );

  const changeQuantityForSlot = useCallback(
    (
      clientId: string,
      date: string,
      mealTypeId: string,
      afterQuantity: number,
      memo: string,
      actorName: string,
      zeroStatus: "holiday" | "rejected" = "holiday"
    ) => {
      commit((previous) => {
        const existing = previous.orders.find(
          (item) =>
            item.clientId === clientId && item.date === date && item.mealTypeId === mealTypeId
        );
        const order = existing ?? buildBaseOrder(previous, clientId, mealTypeId, date);
        const client = previous.clients.find((item) => item.id === clientId);
        const mealType = previous.mealTypes.find((item) => item.id === mealTypeId);
        const cutoffPassed = isPastCutoffForDate(date, mealType?.cutoffTime);
        const createdAt = new Date().toISOString();
        const ordersWithBase = existing ? previous.orders : [...previous.orders, order];

        if (cutoffPassed) {
          const request: ChangeRequest = {
            id: id("request"),
            type: afterQuantity === 0 ? "late_rejection" : "late_quantity",
            status: "pending",
            clientId,
            orderId: order.id,
            mealTypeId,
            date,
            currentQuantity: order.finalQuantity,
            requestedQuantity: afterQuantity,
            memo,
            requestedAt: createdAt
          };

          const notification: AppNotification = {
            id: id("notification"),
            target: "admin",
            clientId,
            title: "마감 후 변경 요청",
            body: `${client?.name ?? "거래처"}이 ${mealType?.name ?? "식사"} ${order.finalQuantity}개에서 ${afterQuantity}개로 변경 요청했습니다.`,
            read: false,
            createdAt
          };

          return {
            ...previous,
            orders: ordersWithBase,
            changeRequests: [request, ...previous.changeRequests],
            notifications: [notification, ...previous.notifications]
          };
        }

        const important = isImportantChange(order.finalQuantity, afterQuantity);
        const nextStatus =
          afterQuantity === 0 ? zeroStatus : afterQuantity === order.baseQuantity ? "normal" : "changed";
        const nextOrder: DailyMealOrder = {
          ...order,
          finalQuantity: afterQuantity,
          status: nextStatus,
          memo,
          requiresReview: important || (afterQuantity === 0 && zeroStatus === "rejected"),
          acknowledged: false,
          updatedAt: createdAt
        };

        const changeLog: OrderChangeLog = {
          id: id("log"),
          orderId: order.id,
          clientId,
          mealTypeId,
          date,
          actorType: "client",
          actorName,
          beforeQuantity: order.finalQuantity,
          afterQuantity,
          memo,
          createdAt
        };

        const notifications = [...previous.notifications];
        if (nextOrder.requiresReview) {
          notifications.unshift({
            id: id("notification"),
            target: "admin",
            clientId,
            title: afterQuantity === 0 ? "식사 거절" : "중요 수량 변경",
            body: `${client?.name ?? "거래처"} ${mealType?.name ?? "식사"} ${order.finalQuantity}개 -> ${afterQuantity}개`,
            read: false,
            createdAt
          });
        }

        return {
          ...previous,
          orders: ordersWithBase.map((item) => (item.id === order.id ? nextOrder : item)),
          orderChangeLogs: [changeLog, ...previous.orderChangeLogs],
          notifications
        };
      });
    },
    [commit]
  );

  const updateAdminDeliveryCorrection = useCallback(
    (
      input: {
        clientId: string;
        date: string;
        mealTypeId: string;
        finalQuantity: number;
        settlementIncluded: boolean;
        memo: string;
      },
      adminName: string
    ) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === input.clientId);
        const mealType = previous.mealTypes.find((item) => item.id === input.mealTypeId);
        if (input.date > todayKey() || !client || !mealType) {
          return previous;
        }

        const existing = previous.orders.find(
          (item) => item.clientId === input.clientId && item.date === input.date && item.mealTypeId === input.mealTypeId
        );
        const baseOrder = existing ?? buildBaseOrder(previous, input.clientId, input.mealTypeId, input.date);
        const finalQuantity = Math.max(0, Math.floor(Number(input.finalQuantity) || 0));
        const memo = input.memo.trim() || "관리자 보정";
        const updatedAt = new Date().toISOString();
        const nextOrder: DailyMealOrder = {
          ...baseOrder,
          finalQuantity,
          status: finalQuantity === baseOrder.baseQuantity ? "normal" : "changed",
          memo,
          requiresReview: false,
          acknowledged: true,
          isAdminCorrection: true,
          settlementIncluded: input.settlementIncluded,
          updatedAt
        };
        const changeLog: OrderChangeLog = {
          id: id("log"),
          orderId: nextOrder.id,
          clientId: nextOrder.clientId,
          mealTypeId: nextOrder.mealTypeId,
          date: nextOrder.date,
          actorType: "admin",
          actorName: adminName,
          beforeQuantity: baseOrder.finalQuantity,
          afterQuantity: finalQuantity,
          memo: `${input.settlementIncluded ? "정산 포함" : "정산 제외"} · ${memo}`,
          createdAt: updatedAt
        };

        return {
          ...previous,
          orders: existing
            ? previous.orders.map((item) => (item.id === existing.id ? nextOrder : item))
            : [...previous.orders, nextOrder],
          orderChangeLogs: [changeLog, ...previous.orderChangeLogs],
          auditLogs: [
            {
              id: id("audit"),
              action: "update_delivery_correction",
              adminName,
              targetLabel: client.name,
              detail: `${input.date} ${mealType.name} 실제 납품 ${finalQuantity}개 · ${input.settlementIncluded ? "정산 포함" : "정산 제외"}`,
              createdAt: updatedAt
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const resetAdminDeliveryCorrection = useCallback(
    (clientId: string, date: string, mealTypeId: string, adminName: string) => {
      commit((previous) => {
        const existing = previous.orders.find(
          (item) => item.clientId === clientId && item.date === date && item.mealTypeId === mealTypeId
        );
        const client = previous.clients.find((item) => item.id === clientId);
        const mealType = previous.mealTypes.find((item) => item.id === mealTypeId);
        if (!existing?.isAdminCorrection || !client || !mealType) {
          return previous;
        }

        return {
          ...previous,
          orders: previous.orders.filter((item) => item.id !== existing.id),
          orderChangeLogs: previous.orderChangeLogs.filter((item) => item.orderId !== existing.id),
          auditLogs: [
            {
              id: id("audit"),
              action: "reset_delivery_correction",
              adminName,
              targetLabel: client.name,
              detail: `${date} ${mealType.name} 실제 납품 보정을 기본 수량으로 복원`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );
  const acknowledgeOrder = useCallback(
    (orderId: string, adminName: string) => {
      commit((previous) => {
        const order = previous.orders.find((item) => item.id === orderId);
        const client = order ? previous.clients.find((item) => item.id === order.clientId) : undefined;

        return {
          ...previous,
          orders: previous.orders.map((item) =>
            item.id === orderId ? { ...item, acknowledged: true, requiresReview: false } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "acknowledge_change",
              adminName,
              targetLabel: client?.name ?? "거래처",
              detail: "중요 수량 변경 확인",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const resolveRequest = useCallback(
    (requestId: string, status: "approved" | "rejected", adminName: string) => {
      commit((previous) => {
        const request = previous.changeRequests.find((item) => item.id === requestId);
        if (!request) {
          return previous;
        }

        const resolvedAt = new Date().toISOString();
        let nextOrders = previous.orders;
        let nextClients = previous.clients;
        let nextDefaultQuantities = previous.defaultQuantities;
        const client = previous.clients.find((item) => item.id === request.clientId);

        if (status === "approved" && request.orderId && request.requestedQuantity !== undefined) {
          nextOrders = previous.orders.map((order) => {
            if (order.id !== request.orderId) {
              return order;
            }

            return {
              ...order,
              finalQuantity: request.requestedQuantity ?? order.finalQuantity,
              status: request.requestedQuantity === 0 ? "rejected" : "changed",
              memo: request.memo,
              requiresReview: false,
              acknowledged: true,
              updatedAt: resolvedAt
            };
          });
        }

        if (status === "approved" && request.type === "address_update") {
          nextClients = previous.clients.map((item) =>
            item.id === request.clientId
              ? {
                  ...item,
                  address: request.requestedAddress ?? item.address,
                  addressDetail: request.requestedAddressDetail ?? item.addressDetail
                }
              : item
          );
        }

        if (status === "approved" && request.type === "contact_update") {
          nextClients = previous.clients.map((item) =>
            item.id === request.clientId
              ? {
                  ...item,
                  managerName: request.requestedManagerName ?? item.managerName,
                  managerPhone: request.requestedManagerPhone ?? item.managerPhone
                }
              : item
          );
        }

        if (status === "approved" && request.type === "default_quantity_update" && request.requestedQuantity !== undefined) {
          nextDefaultQuantities = previous.defaultQuantities.map((item) =>
            item.clientId === request.clientId
              ? { ...item, quantity: request.requestedQuantity! }
              : item
          );
        }

        const updatedRequest: ChangeRequest = {
          ...request,
          status,
          resolvedAt,
          resolvedBy: adminName
        };

        const notification: AppNotification = {
          id: id("notification"),
          target: "client",
          clientId: request.clientId,
          title: status === "approved" ? "요청 승인" : "요청 거절",
          body:
            status === "approved"
              ? "밥심에서 변경 요청을 승인했습니다."
              : "밥심에서 변경 요청을 거절했습니다.",
          read: false,
          createdAt: resolvedAt
        };

        const auditLog: AdminAuditLog = {
          id: id("audit"),
          action: status === "approved" ? "approve_request" : "reject_request",
          adminName,
          targetLabel: client?.name ?? "거래처",
          detail: status === "approved" ? "변경 요청 승인" : "변경 요청 거절",
          createdAt: resolvedAt
        };

        return {
          ...previous,
          clients: nextClients,
          defaultQuantities: nextDefaultQuantities,
          orders: nextOrders,
          changeRequests: previous.changeRequests.map((item) =>
            item.id === request.id ? updatedRequest : item
          ),
          notifications: [notification, ...previous.notifications],
          auditLogs: [auditLog, ...previous.auditLogs]
        };
      });
    },
    [commit]
  );

  const addHoliday = useCallback(
    (clientId: string, date: string, name: string) => {
      commit((previous) => {
        const holiday: Holiday = {
          id: id("holiday"),
          clientId,
          date,
          name
        };
        return {
          ...previous,
          holidays: [holiday, ...previous.holidays]
        };
      });
    },
    [commit]
  );

  const submitQuantityRequest = useCallback(
    (clientId: string, currentQuantity: number, requestedQuantity: number, memo?: string) => {
      commit((previous) => {
        const createdAt = new Date().toISOString();
        const request: ChangeRequest = {
          id: id("request"),
          type: "default_quantity_update",
          status: "pending",
          clientId,
          currentQuantity,
          requestedQuantity,
          memo,
          requestedAt: createdAt
        };

        const notification: AppNotification = {
          id: id("notification"),
          target: "admin",
          clientId,
          title: "기본 식수 변경 요청",
          body: `기본 식수를 ${currentQuantity}개에서 ${requestedQuantity}개로 변경해 달라는 요청이 들어왔습니다.`,
          read: false,
          createdAt
        };

        return {
          ...previous,
          changeRequests: [request, ...previous.changeRequests],
          notifications: [notification, ...previous.notifications]
        };
      });
    },
    [commit]
  );

  const submitInfoRequest = useCallback(
    (
      clientId: string,
      type: "address_update" | "contact_update",
      payload: {
        address?: string;
        addressDetail?: string;
        managerName?: string;
        managerPhone?: string;
        memo?: string;
      }
    ) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const request: ChangeRequest = {
          id: id("request"),
          type,
          status: "pending",
          clientId,
          currentAddress: client.address,
          requestedAddress: payload.address,
          currentAddressDetail: client.addressDetail,
          requestedAddressDetail: payload.addressDetail,
          currentManagerName: client.managerName,
          requestedManagerName: payload.managerName,
          currentManagerPhone: client.managerPhone,
          requestedManagerPhone: payload.managerPhone,
          memo: payload.memo,
          requestedAt: new Date().toISOString()
        };

        return {
          ...previous,
          changeRequests: [request, ...previous.changeRequests],
          notifications: [
            {
              id: id("notification"),
              target: "admin",
              clientId,
              title: type === "address_update" ? "주소 변경 요청" : "담당자 변경 요청",
              body: `${client.name}에서 업체 정보를 변경 요청했습니다.`,
              read: false,
              createdAt: request.requestedAt
            },
            ...previous.notifications
          ]
        };
      });
    },
    [commit]
  );

  const moveDeliveryOrder = useCallback(
    (date: string, mealTypeId: string, clientId: string, direction: "up" | "down", adminName: string) => {
      commit((previous) => {
        const key = `${date}:${mealTypeId}`;
        const baseOrder = [...previous.clients]
          .filter((client) => client.status === "active")
          .sort((a, b) => a.deliveryOrder - b.deliveryOrder)
          .map((client) => client.id);
        const order = previous.deliveryOverrides[key] ? [...previous.deliveryOverrides[key]] : baseOrder;
        const index = order.indexOf(clientId);
        const nextIndex = direction === "up" ? index - 1 : index + 1;

        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
          return previous;
        }

        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];

        return {
          ...previous,
          deliveryOverrides: {
            ...previous.deliveryOverrides,
            [key]: order
          },
          auditLogs: [
            {
              id: id("audit"),
              action: "change_delivery_order",
              adminName,
              targetLabel: "오늘 배달표",
              detail: `${formatTime()} 배달 순서 임시 변경`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const updateMonthlyAdjustment = useCallback(
    (clientId: string, month: string, finalQuantity: number, memo: string, adminName: string) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const settlement = getMonthlySettlementForClient(previous, clientId, month);
        const existing = settlement.adjustment;
        const normalizedFinalQuantity = Math.max(0, Math.floor(Number(finalQuantity) || 0));
        const normalizedMemo = memo.trim();
        const shouldRemove =
          normalizedFinalQuantity === settlement.computedFinalQuantity && normalizedMemo.length === 0;

        const monthlyAdjustments = shouldRemove
          ? previous.monthlyAdjustments.filter((item) => item.id !== existing?.id)
          : existing
            ? previous.monthlyAdjustments.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      finalQuantity: normalizedFinalQuantity,
                      memo: normalizedMemo || undefined,
                      updatedAt: new Date().toISOString()
                    }
                  : item
              )
            : [
                ...previous.monthlyAdjustments,
                {
                  id: id("monthly-adjustment"),
                  month,
                  clientId,
                  finalQuantity: normalizedFinalQuantity,
                  memo: normalizedMemo || undefined,
                  updatedAt: new Date().toISOString()
                }
              ];

        return {
          ...previous,
          monthlyAdjustments,
          auditLogs: [
            {
              id: id("audit"),
              action: "update_monthly_adjustment",
              adminName,
              targetLabel: client.name,
              detail: `${month} 월별 집계 정산 수량 수정`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const updateSettlementMonthlyAdjustment = useCallback(
    (
      settlementAccountId: string,
      month: string,
      input: { finalQuantity: number; unitPrice: number; memo: string },
      adminName: string
    ) => {
      commit((previous) => {
        const account = previous.settlementAccounts.find((item) => item.id === settlementAccountId);
        if (!account) {
          return previous;
        }

        const settlement = getMonthlySettlementForSettlementAccount(previous, settlementAccountId, month);
        const existing = settlement.adjustment;
        const normalizedFinalQuantity = Math.max(0, Math.floor(Number(input.finalQuantity) || 0));
        const normalizedUnitPrice = previous.settlementPricingStorageReady
          ? Math.max(0, Math.floor(Number(input.unitPrice) || 0))
          : DEFAULT_MEAL_UNIT_PRICE;
        const normalizedMemo = input.memo.trim();
        const hasQuantityOverride = normalizedFinalQuantity !== settlement.locationAdjustedFinalQuantity;
        const hasCustomUnitPrice =
          previous.settlementPricingStorageReady && normalizedUnitPrice !== DEFAULT_MEAL_UNIT_PRICE;
        const shouldRemove = !hasQuantityOverride && !hasCustomUnitPrice && normalizedMemo.length === 0;
        const monthlyAdjustments = shouldRemove
          ? previous.monthlyAdjustments.filter((item) => item.id !== existing?.id)
          : existing
            ? previous.monthlyAdjustments.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      finalQuantity: hasQuantityOverride ? normalizedFinalQuantity : undefined,
                      unitPrice: previous.settlementPricingStorageReady ? normalizedUnitPrice : undefined,
                      memo: normalizedMemo || undefined,
                      updatedAt: new Date().toISOString()
                    }
                  : item
              )
            : [
                ...previous.monthlyAdjustments,
                {
                  id: id("settlement-adjustment"),
                  month,
                  settlementAccountId,
                  finalQuantity: hasQuantityOverride ? normalizedFinalQuantity : undefined,
                  unitPrice: previous.settlementPricingStorageReady ? normalizedUnitPrice : undefined,
                  memo: normalizedMemo || undefined,
                  updatedAt: new Date().toISOString()
                }
              ];

        return {
          ...previous,
          monthlyAdjustments,
          auditLogs: [
            {
              id: id("audit"),
              action: "update_monthly_adjustment",
              adminName,
              targetLabel: account.name,
              detail: `${month} 월별 집계 정산 수량 또는 단가 수정`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const createSettlementAccount = useCallback(
    (name: string, adminName: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return;
      }

      commit((previous) => {
        const account: SettlementAccount = { id: id("settlement-account"), name: normalizedName, status: "active" };
        return {
          ...previous,
          settlementAccounts: [...previous.settlementAccounts, account],
          auditLogs: [
            {
              id: id("audit"),
              action: "create_settlement_account",
              adminName,
              targetLabel: account.name,
              detail: "정산 업체 등록",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const updateSettlementAccount = useCallback(
    (accountId: string, updates: Pick<SettlementAccount, "name" | "status">, adminName: string) => {
      commit((previous) => {
        const account = previous.settlementAccounts.find((item) => item.id === accountId);
        if (!account) {
          return previous;
        }

        const nextAccount = { ...account, ...updates, name: updates.name.trim() || account.name };
        return {
          ...previous,
          settlementAccounts: previous.settlementAccounts.map((item) =>
            item.id === accountId ? nextAccount : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "update_settlement_account",
              adminName,
              targetLabel: nextAccount.name,
              detail: "정산 업체 정보 수정",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const deleteSettlementAccount = useCallback(
    (accountId: string, adminName: string) => {
      commit((previous) => {
        const account = previous.settlementAccounts.find((item) => item.id === accountId);
        if (!account || previous.clients.some((client) => client.settlementAccountId === accountId)) {
          return previous;
        }

        return {
          ...previous,
          settlementAccounts: previous.settlementAccounts.filter((item) => item.id !== accountId),
          monthlyAdjustments: previous.monthlyAdjustments.filter(
            (adjustment) => adjustment.settlementAccountId !== accountId
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "delete_settlement_account",
              adminName,
              targetLabel: account.name,
              detail: "정산 업체 삭제",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const createContactAccessGroup = useCallback(
    (
      input: Pick<ContactAccessGroup, "name" | "managerName" | "managerPhone"> & { clientIds: string[] },
      adminName: string
    ) => {
      const name = input.name.trim();
      if (!name || input.clientIds.length === 0) {
        return;
      }

      commit((previous) => {
        const group: ContactAccessGroup = {
          id: id("contact-group"),
          name,
          managerName: input.managerName.trim(),
          managerPhone: input.managerPhone.trim(),
          inviteCode: `GROUP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          invitePin: createPin(),
          status: "active"
        };
        const validClientIds = [...new Set(input.clientIds)].filter((clientId) =>
          previous.clients.some((client) => client.id === clientId)
        );
        const members: ContactAccessGroupMember[] = validClientIds.map((clientId) => ({
          id: id("contact-group-member"),
          contactAccessGroupId: group.id,
          clientId
        }));

        return {
          ...previous,
          contactAccessGroups: [...previous.contactAccessGroups, group],
          contactAccessGroupMembers: [
            ...previous.contactAccessGroupMembers.filter((member) => !validClientIds.includes(member.clientId)),
            ...members
          ],
          auditLogs: [
            {
              id: id("audit"),
              action: "create_contact_access_group",
              adminName,
              targetLabel: group.name,
              detail: `${members.length}개 배송 장소 담당자 접속 그룹 등록`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const updateContactAccessGroup = useCallback(
    (
      groupId: string,
      input: Pick<ContactAccessGroup, "name" | "managerName" | "managerPhone" | "status"> & { clientIds: string[] },
      adminName: string
    ) => {
      commit((previous) => {
        const group = previous.contactAccessGroups.find((item) => item.id === groupId);
        if (!group || input.clientIds.length === 0) {
          return previous;
        }

        const nextGroup: ContactAccessGroup = {
          ...group,
          name: input.name.trim() || group.name,
          managerName: input.managerName.trim(),
          managerPhone: input.managerPhone.trim(),
          status: input.status
        };
        const validClientIds = [...new Set(input.clientIds)].filter((clientId) =>
          previous.clients.some((client) => client.id === clientId)
        );
        const nextMembers = [
          ...previous.contactAccessGroupMembers.filter((member) =>
            member.contactAccessGroupId !== groupId && !validClientIds.includes(member.clientId)
          ),
          ...validClientIds.map((clientId) => ({
            id: id("contact-group-member"),
            contactAccessGroupId: groupId,
            clientId
          }))
        ];

        return {
          ...previous,
          contactAccessGroups: previous.contactAccessGroups.map((item) =>
            item.id === groupId ? nextGroup : item
          ),
          contactAccessGroupMembers: nextMembers,
          auditLogs: [
            {
              id: id("audit"),
              action: "update_contact_access_group",
              adminName,
              targetLabel: nextGroup.name,
              detail: `${validClientIds.length}개 배송 장소 담당자 접속 그룹 수정`,
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const resetContactAccessGroupPin = useCallback(
    (groupId: string, adminName: string) => {
      commit((previous) => {
        const group = previous.contactAccessGroups.find((item) => item.id === groupId);
        if (!group) {
          return previous;
        }

        const invitePin = createPin();
        return {
          ...previous,
          contactAccessGroups: previous.contactAccessGroups.map((item) =>
            item.id === groupId ? { ...item, invitePin } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "reset_contact_access_group_pin",
              adminName,
              targetLabel: group.name,
              detail: "담당자 접속 PIN 재발급",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const deleteContactAccessGroup = useCallback(
    (groupId: string, adminName: string) => {
      commit((previous) => {
        const group = previous.contactAccessGroups.find((item) => item.id === groupId);
        const hasMembers = previous.contactAccessGroupMembers.some(
          (member) => member.contactAccessGroupId === groupId
        );
        if (!group || hasMembers) {
          return previous;
        }

        return {
          ...previous,
          contactAccessGroups: previous.contactAccessGroups.filter((item) => item.id !== groupId),
          auditLogs: [
            {
              id: id("audit"),
              action: "delete_contact_access_group",
              adminName,
              targetLabel: group.name,
              detail: "담당자 접속 그룹 삭제",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );
  const resetDemoData = useCallback(() => {
    const next = createInitialState();
    setState(next);
    writeState(next);
  }, []);

  const markNotificationsRead = useCallback(
    (target: "admin" | "client", clientId?: string) => {
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.map((notification) =>
          notification.target === target && (!clientId || notification.clientId === clientId) && !notification.read
            ? { ...notification, read: true }
            : notification
        )
      }));
    },
    [commit]
  );

  const createClientRecord = useCallback(
    (
      input: Pick<Client,
        | "name"
        | "address"
        | "addressDetail"
        | "managerName"
        | "managerPhone"
        | "deliveryMemo"
        | "deliveryStartDate"
        | "mealSupplyType"
        | "settlementAccountId"
      > & { contactAccessGroupId?: string; weeklyQuantities: WeeklyQuantities; exceptionRules: Holiday[] },
      adminName: string
    ) => {
      commit((previous) => {
        const createdAt = new Date().toISOString();
        const date = todayKey();
        const deliveryOrder =
          Math.max(0, ...previous.clients.map((client) => client.deliveryOrder)) + 1;
        const clientId = id("client");
        const inviteCode = `CLIENT-${String(deliveryOrder).padStart(2, "0")}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;

        const selectedSettlementAccount = previous.settlementAccounts.find(
          (account) => account.id === input.settlementAccountId
        );
        const settlementAccount: SettlementAccount = selectedSettlementAccount ?? {
          id: id("settlement-account"),
          name: input.name,
          status: "active"
        };
        const selectedContactGroup = previous.contactAccessGroups.find(
          (group) => group.id === input.contactAccessGroupId
        );
        const contactAccessGroup: ContactAccessGroup = selectedContactGroup ?? {
          id: id("contact-group"),
          name: `${input.name} 담당자`,
          managerName: input.managerName,
          managerPhone: input.managerPhone,
          inviteCode,
          invitePin: createPin(),
          status: "active"
        };
        const client: Client = {
          id: clientId,
          name: input.name,
          address: input.address,
          addressDetail: input.addressDetail,
          managerName: input.managerName,
          managerPhone: input.managerPhone,
          deliveryMemo: input.deliveryMemo,
          deliveryOrder,
          status: "active",
          inviteCode: contactAccessGroup.inviteCode,
          invitePin: contactAccessGroup.invitePin,
          settlementAccountId: settlementAccount.id,
          deliveryStartDate: input.deliveryStartDate || date,
          mealSupplyType: input.mealSupplyType ?? "regular",
          lastSeenAt: undefined
        };
        const contactAccessGroupMember: ContactAccessGroupMember = {
          id: id("contact-group-member"),
          contactAccessGroupId: contactAccessGroup.id,
          clientId
        };

        const temporaryState = {
          ...previous,
          clients: [...previous.clients, client],
          settlementAccounts: selectedSettlementAccount
            ? previous.settlementAccounts
            : [...previous.settlementAccounts, settlementAccount],
          contactAccessGroups: selectedContactGroup
            ? previous.contactAccessGroups
            : [...previous.contactAccessGroups, contactAccessGroup],
          contactAccessGroupMembers: [...previous.contactAccessGroupMembers, contactAccessGroupMember]
        };
        const defaultQuantities = buildDefaultQuantitiesFromWeekly({
          state: temporaryState,
          clientId,
          weeklyQuantities: input.weeklyQuantities
        });
        const holidays = input.exceptionRules.map((rule) => ({
          ...rule,
          id: id("holiday"),
          clientId
        }));
        const stateWithDefaults = normalizeAppState({
          ...temporaryState,
          defaultQuantities: [...previous.defaultQuantities, ...defaultQuantities],
          holidays: [...previous.holidays, ...holidays]
        });
        const orders = enabledMealTypes(stateWithDefaults).map((mealType) =>
          buildBaseOrder(stateWithDefaults, clientId, mealType.id, date)
        );

        return {
          ...previous,
          clients: [...previous.clients, client],
          settlementAccounts: selectedSettlementAccount
            ? previous.settlementAccounts
            : [...previous.settlementAccounts, settlementAccount],
          contactAccessGroups: selectedContactGroup
            ? previous.contactAccessGroups
            : [...previous.contactAccessGroups, contactAccessGroup],
          contactAccessGroupMembers: [...previous.contactAccessGroupMembers, contactAccessGroupMember],
          defaultQuantities: [...previous.defaultQuantities, ...defaultQuantities],
          holidays: [...previous.holidays, ...holidays],
          orders: [...previous.orders, ...orders],
          auditLogs: [
            {
              id: id("audit"),
              action: "create_client",
              adminName,
              targetLabel: client.name,
              detail: "거래처 등록",
              createdAt
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const updateClientRecord = useCallback(
    (
      clientId: string,
      updates: Partial<
        Pick<Client,
          | "name"
          | "address"
          | "addressDetail"
          | "managerName"
          | "managerPhone"
          | "deliveryMemo"
          | "deliveryStartDate"
          | "mealSupplyType"
          | "settlementAccountId"
        >
      > & { contactAccessGroupId?: string; weeklyQuantities?: WeeklyQuantities; exceptionRules?: Holiday[] },
      adminName: string
    ) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const { weeklyQuantities, exceptionRules, contactAccessGroupId, ...clientUpdates } = updates;
        let nextDefaultQuantities = previous.defaultQuantities;
        let nextHolidays = previous.holidays;
        let nextOrders = previous.orders;
        let nextContactAccessGroupMembers = previous.contactAccessGroupMembers;

        if (contactAccessGroupId && previous.contactAccessGroups.some((group) => group.id === contactAccessGroupId)) {
          nextContactAccessGroupMembers = [
            ...previous.contactAccessGroupMembers.filter((member) => member.clientId !== clientId),
            {
              id: id("contact-group-member"),
              contactAccessGroupId,
              clientId
            }
          ];
        }

        if (weeklyQuantities) {
          const replacementDefaults = buildDefaultQuantitiesFromWeekly({
            state: previous,
            clientId,
            weeklyQuantities
          });

          nextDefaultQuantities = [
            ...previous.defaultQuantities.filter((item) => item.clientId !== clientId),
            ...replacementDefaults
          ];
        }

        if (exceptionRules) {
          nextHolidays = [
            ...previous.holidays.filter((item) => !(item.clientId === clientId && item.ruleType)),
            ...exceptionRules.map((rule) => ({
              ...rule,
              id: rule.id || id("holiday"),
              clientId
            }))
          ];
        }

        if (weeklyQuantities || exceptionRules) {
          const nextForBase = normalizeAppState({
            ...previous,
            defaultQuantities: nextDefaultQuantities,
            holidays: nextHolidays
          });

          nextOrders = previous.orders.map((order) => {
            if (order.clientId !== clientId || order.date < todayKey()) {
              return order;
            }

            const baseQuantity = getBaseQuantity(nextForBase, clientId, order.mealTypeId, order.date);
            const followsDefault = order.status === "normal" || order.status === "holiday";
            const status = followsDefault ? (baseQuantity === 0 ? "holiday" : "normal") : order.status;

            return {
              ...order,
              baseQuantity,
              finalQuantity: followsDefault ? baseQuantity : order.finalQuantity,
              status,
              memo: status === "holiday" ? order.memo || "기본 안먹음" : order.memo,
              updatedAt: new Date().toISOString()
            };
          });
        }

        return {
          ...previous,
          defaultQuantities: nextDefaultQuantities,
          holidays: nextHolidays,
          orders: nextOrders,
          contactAccessGroupMembers: nextContactAccessGroupMembers,
          clients: previous.clients.map((item) =>
            item.id === clientId ? { ...item, ...clientUpdates } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: weeklyQuantities || exceptionRules ? "update_meal_settings" : "update_client",
              adminName,
              targetLabel: clientUpdates.name ?? client.name,
              detail: weeklyQuantities || exceptionRules ? "기본 식수 설정 수정" : "거래처 정보 수정",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const toggleClientStatus = useCallback(
    (clientId: string, adminName: string) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const nextStatus = client.status === "active" ? "paused" : "active";
        return {
          ...previous,
          clients: previous.clients.map((item) =>
            item.id === clientId ? { ...item, status: nextStatus } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "toggle_client_status",
              adminName,
              targetLabel: client.name,
              detail: nextStatus === "active" ? "거래처 사용 재개" : "거래처 일시중지",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const resetClientPin = useCallback(
    (clientId: string, adminName: string) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const invitePin = createPin();
        return {
          ...previous,
          clients: previous.clients.map((item) =>
            item.id === clientId ? { ...item, invitePin } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "reset_pin",
              adminName,
              targetLabel: client.name,
              detail: "PIN 재발급",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  const deleteClientRecord = useCallback(
    (clientId: string, adminName: string) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        const deliveryOverrides = Object.fromEntries(
          Object.entries(previous.deliveryOverrides).map(([key, clientOrder]) => [
            key,
            clientOrder.filter((item) => item !== clientId)
          ])
        );

        return {
          ...previous,
          clients: previous.clients.filter((item) => item.id !== clientId),
          contactAccessGroupMembers: previous.contactAccessGroupMembers.filter((item) => item.clientId !== clientId),
          orders: previous.orders.filter((item) => item.clientId !== clientId),
          defaultQuantities: previous.defaultQuantities.filter((item) => item.clientId !== clientId),
          orderChangeLogs: previous.orderChangeLogs.filter((item) => item.clientId !== clientId),
          changeRequests: previous.changeRequests.filter((item) => item.clientId !== clientId),
          holidays: previous.holidays.filter((item) => item.clientId !== clientId),
          monthlyAdjustments: previous.monthlyAdjustments.filter((item) => item.clientId !== clientId),
          notifications: previous.notifications.filter((item) => item.clientId !== clientId),
          deliveryOverrides,
          auditLogs: [
            {
              id: id("audit"),
              action: "delete_client",
              adminName,
              targetLabel: client.name,
              detail: "거래처 삭제",
              createdAt: new Date().toISOString()
            },
            ...previous.auditLogs
          ]
        };
      });
    },
    [commit]
  );

  return {
    state,
    loaded,
    storageMode,
    activeMealType,
    pendingRequestCount,
    reviewOrderCount,
    unreadNotificationCount,
    totals,
    getClient,
    getMealType,
    getOrdersByDate,
    getClientOrdersForDate,
    addNotification,
    addAuditLog,
    changeQuantity,
    changeQuantityForSlot,
    acknowledgeOrder,
    resolveRequest,
    submitInfoRequest,
    moveDeliveryOrder,
    updateMonthlyAdjustment,
    updateSettlementMonthlyAdjustment,
    updateAdminDeliveryCorrection,
    resetAdminDeliveryCorrection,
    createSettlementAccount,
    updateSettlementAccount,
    deleteSettlementAccount,
    createContactAccessGroup,
    updateContactAccessGroup,
    resetContactAccessGroupPin,
    deleteContactAccessGroup,
    resetDemoData,
    markNotificationsRead,
    createClientRecord,
    updateClientRecord,
    toggleClientStatus,
    resetClientPin,
    submitQuantityRequest,
    addHoliday,
    deleteClientRecord
  };
}
