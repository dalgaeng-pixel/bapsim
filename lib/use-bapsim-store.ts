"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTime, isPastCutoff } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import type {
  AdminAuditLog,
  AppNotification,
  AppState,
  ChangeRequest,
  Client,
  DailyMealOrder,
  DefaultMealQuantity,
  OrderChangeLog
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
import type { AppStateDiff } from "@/lib/supabase-state";

function calculateDiff(prev: AppState, next: AppState): AppStateDiff {
  const diff: AppStateDiff = {};

  const arrayKeys: (keyof AppState)[] = [
    "clients",
    "mealTypes",
    "defaultQuantities",
    "orders",
    "orderChangeLogs",
    "changeRequests",
    "holidays",
    "notifications",
    "auditLogs"
  ];

  for (const key of arrayKeys) {
    if (key === "deliveryOverrides") continue;
    
    const prevArr = prev[key] as any[];
    const nextArr = next[key] as any[];
    
    const changed = nextArr.filter((nextItem) => {
      const prevItem = prevArr.find((p) => p.id === nextItem.id);
      return !prevItem || prevItem !== nextItem;
    });

    if (changed.length > 0) {
      (diff as any)[key] = changed;
    }
  }

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

export function useBapsimStore(initialState?: AppState) {
  const [state, setState] = useState<AppState>(() => initialState ?? createInitialState());
  const [loaded, setLoaded] = useState(!!initialState);
  const [storageMode, setStorageMode] = useState<StorageMode>(initialState ? "supabase" : "local");
  const remoteEnabledRef = useRef(!!initialState);

  useEffect(() => {
    if (initialState) {
      return;
    }

    // fallback for local storage if no initial state
    let nextState = createInitialState();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          nextState = JSON.parse(saved) as AppState;
        } catch {
          nextState = createInitialState();
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
          void syncAppStateDiffAction(diff);
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
        const cutoffPassed = isPastCutoff(mealType?.cutoffTime);
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
      input: Pick<
        Client,
        "name" | "address" | "addressDetail" | "managerName" | "managerPhone" | "deliveryMemo"
      > & { defaultQuantity: number },
      adminName: string
    ) => {
      commit((previous) => {
        const createdAt = new Date().toISOString();
        const date = previous.orders[0]?.date ?? new Date().toISOString().slice(0, 10);
        const mealTypeId = previous.mealTypes[0]?.id ?? "meal-lunch";
        const weekday = new Date(`${date}T00:00:00`).getDay();
        const deliveryOrder =
          Math.max(0, ...previous.clients.map((client) => client.deliveryOrder)) + 1;
        const clientId = id("client");
        const inviteCode = `CLIENT-${String(deliveryOrder).padStart(2, "0")}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;

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
          inviteCode,
          invitePin: createPin(),
          lastSeenAt: undefined
        };

        const defaultQuantity: DefaultMealQuantity = {
          id: id("default"),
          clientId,
          mealTypeId,
          weekday,
          quantity: input.defaultQuantity
        };

        const order: DailyMealOrder = {
          id: id("order"),
          date,
          clientId,
          mealTypeId,
          baseQuantity: input.defaultQuantity,
          finalQuantity: input.defaultQuantity,
          status: "normal",
          requiresReview: false,
          acknowledged: false,
          updatedAt: createdAt
        };

        return {
          ...previous,
          clients: [...previous.clients, client],
          defaultQuantities: [...previous.defaultQuantities, defaultQuantity],
          orders: [...previous.orders, order],
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
        Pick<
          Client,
          "name" | "address" | "addressDetail" | "managerName" | "managerPhone" | "deliveryMemo"
        >
      >,
      adminName: string
    ) => {
      commit((previous) => {
        const client = previous.clients.find((item) => item.id === clientId);
        if (!client) {
          return previous;
        }

        return {
          ...previous,
          clients: previous.clients.map((item) =>
            item.id === clientId ? { ...item, ...updates } : item
          ),
          auditLogs: [
            {
              id: id("audit"),
              action: "update_client",
              adminName,
              targetLabel: updates.name ?? client.name,
              detail: "거래처 정보 수정",
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
    addNotification,
    addAuditLog,
    changeQuantity,
    acknowledgeOrder,
    resolveRequest,
    submitInfoRequest,
    moveDeliveryOrder,
    resetDemoData,
    markNotificationsRead,
    createClientRecord,
    updateClientRecord,
    toggleClientStatus,
    resetClientPin
  };
}
