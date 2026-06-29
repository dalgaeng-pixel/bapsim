import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminAuditLog,
  AppNotification,
  AppState,
  ChangeRequest,
  Client,
  DailyMealOrder,
  DefaultMealQuantity,
  Holiday,
  MealType,
  OrderChangeLog
} from "@/lib/types";

type ClientRow = {
  id: string;
  name: string;
  address: string;
  address_detail: string;
  manager_name: string;
  manager_phone: string;
  delivery_memo: string;
  delivery_order: number;
  status: Client["status"];
  invite_code: string;
  invite_pin: string;
  last_seen_at: string | null;
};

type MealTypeRow = {
  id: string;
  name: string;
  cutoff_time: string;
  enabled: boolean;
};

type DefaultMealQuantityRow = {
  id: string;
  client_id: string;
  meal_type_id: string;
  weekday: number;
  quantity: number;
};

type DailyMealOrderRow = {
  id: string;
  order_date: string;
  client_id: string;
  meal_type_id: string;
  base_quantity: number;
  final_quantity: number;
  status: DailyMealOrder["status"];
  memo: string | null;
  requires_review: boolean;
  acknowledged: boolean;
  updated_at: string;
};

type OrderChangeLogRow = {
  id: string;
  order_id: string;
  client_id: string;
  meal_type_id: string;
  order_date: string;
  actor_type: OrderChangeLog["actorType"];
  actor_name: string;
  before_quantity: number;
  after_quantity: number;
  memo: string | null;
  created_at: string;
};

type ChangeRequestRow = {
  id: string;
  type: ChangeRequest["type"];
  status: ChangeRequest["status"];
  client_id: string;
  order_id: string | null;
  meal_type_id: string | null;
  order_date: string | null;
  current_quantity: number | null;
  requested_quantity: number | null;
  current_address: string | null;
  requested_address: string | null;
  current_address_detail: string | null;
  requested_address_detail: string | null;
  current_manager_name: string | null;
  requested_manager_name: string | null;
  current_manager_phone: string | null;
  requested_manager_phone: string | null;
  memo: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type HolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
  client_id: string | null;
};

type NotificationRow = {
  id: string;
  target: AppNotification["target"];
  client_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  action: AdminAuditLog["action"];
  admin_name: string;
  target_label: string;
  detail: string;
  created_at: string;
};

type DeliveryOverrideRow = {
  order_date: string;
  meal_type_id: string;
  client_order: string[];
};

async function selectRows<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const { data, error } = await client.from(table).select("*");

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return (data ?? []) as T[];
}

async function upsertRows<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  onConflict = "id"
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows as never, { onConflict });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function deleteRows(client: SupabaseClient, table: string, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const { error } = await client.from(table).delete().in("id", uniqueIds);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

export async function loadAppStateFromSupabase(client: SupabaseClient): Promise<AppState> {
  const [
    clientRows,
    mealTypeRows,
    defaultRows,
    orderRows,
    logRows,
    requestRows,
    holidayRows,
    notificationRows,
    auditRows,
    deliveryOverrideRows
  ] = await Promise.all([
    selectRows<ClientRow>(client, "clients"),
    selectRows<MealTypeRow>(client, "meal_types"),
    selectRows<DefaultMealQuantityRow>(client, "default_meal_quantities"),
    selectRows<DailyMealOrderRow>(client, "daily_meal_orders"),
    selectRows<OrderChangeLogRow>(client, "order_change_logs"),
    selectRows<ChangeRequestRow>(client, "change_requests"),
    selectRows<HolidayRow>(client, "holidays"),
    selectRows<NotificationRow>(client, "notifications"),
    selectRows<AuditLogRow>(client, "admin_audit_logs"),
    selectRows<DeliveryOverrideRow>(client, "delivery_order_overrides")
  ]);

  const deliveryOverrides = Object.fromEntries(
    deliveryOverrideRows.map((row) => [`${row.order_date}:${row.meal_type_id}`, row.client_order])
  );

  return {
    clients: clientRows.map((row): Client => ({
      id: row.id,
      name: row.name,
      address: row.address,
      addressDetail: row.address_detail,
      managerName: row.manager_name,
      managerPhone: row.manager_phone,
      deliveryMemo: row.delivery_memo,
      deliveryOrder: row.delivery_order,
      status: row.status,
      inviteCode: row.invite_code,
      invitePin: row.invite_pin,
      lastSeenAt: row.last_seen_at ?? undefined
    })),
    mealTypes: mealTypeRows.map((row): MealType => ({
      id: row.id,
      name: row.name,
      cutoffTime: row.cutoff_time.slice(0, 5),
      enabled: row.enabled
    })),
    defaultQuantities: defaultRows.map((row): DefaultMealQuantity => ({
      id: row.id,
      clientId: row.client_id,
      mealTypeId: row.meal_type_id,
      weekday: row.weekday,
      quantity: row.quantity
    })),
    orders: orderRows.map((row): DailyMealOrder => ({
      id: row.id,
      date: row.order_date,
      clientId: row.client_id,
      mealTypeId: row.meal_type_id,
      baseQuantity: row.base_quantity,
      finalQuantity: row.final_quantity,
      status: row.status,
      memo: row.memo ?? undefined,
      requiresReview: row.requires_review,
      acknowledged: row.acknowledged,
      updatedAt: row.updated_at
    })),
    orderChangeLogs: logRows.map((row): OrderChangeLog => ({
      id: row.id,
      orderId: row.order_id,
      clientId: row.client_id,
      mealTypeId: row.meal_type_id,
      date: row.order_date,
      actorType: row.actor_type,
      actorName: row.actor_name,
      beforeQuantity: row.before_quantity,
      afterQuantity: row.after_quantity,
      memo: row.memo ?? undefined,
      createdAt: row.created_at
    })),
    changeRequests: requestRows.map((row): ChangeRequest => ({
      id: row.id,
      type: row.type,
      status: row.status,
      clientId: row.client_id,
      orderId: row.order_id ?? undefined,
      mealTypeId: row.meal_type_id ?? undefined,
      date: row.order_date ?? undefined,
      currentQuantity: row.current_quantity ?? undefined,
      requestedQuantity: row.requested_quantity ?? undefined,
      currentAddress: row.current_address ?? undefined,
      requestedAddress: row.requested_address ?? undefined,
      currentAddressDetail: row.current_address_detail ?? undefined,
      requestedAddressDetail: row.requested_address_detail ?? undefined,
      currentManagerName: row.current_manager_name ?? undefined,
      requestedManagerName: row.requested_manager_name ?? undefined,
      currentManagerPhone: row.current_manager_phone ?? undefined,
      requestedManagerPhone: row.requested_manager_phone ?? undefined,
      memo: row.memo ?? undefined,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: row.resolved_by ?? undefined
    })),
    holidays: holidayRows.map((row): Holiday => ({
      id: row.id,
      date: row.holiday_date,
      name: row.name,
      clientId: row.client_id ?? undefined
    })),
    notifications: notificationRows.map((row): AppNotification => ({
      id: row.id,
      target: row.target,
      clientId: row.client_id ?? undefined,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at
    })),
    auditLogs: auditRows.map((row): AdminAuditLog => ({
      id: row.id,
      action: row.action,
      adminName: row.admin_name,
      targetLabel: row.target_label,
      detail: row.detail,
      createdAt: row.created_at
    })),
    deliveryOverrides
  };
}

export async function saveAppStateToSupabase(client: SupabaseClient, state: AppState) {
  await upsertRows(
    client,
    "clients",
    state.clients.map((item) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      address_detail: item.addressDetail,
      manager_name: item.managerName,
      manager_phone: item.managerPhone,
      delivery_memo: item.deliveryMemo,
      delivery_order: item.deliveryOrder,
      status: item.status,
      invite_code: item.inviteCode,
      invite_pin: item.invitePin,
      last_seen_at: item.lastSeenAt ?? null
    }))
  );

  await upsertRows(
    client,
    "meal_types",
    state.mealTypes.map((item) => ({
      id: item.id,
      name: item.name,
      cutoff_time: item.cutoffTime,
      enabled: item.enabled
    }))
  );

  await upsertRows(
    client,
    "default_meal_quantities",
    state.defaultQuantities.map((item) => ({
      id: item.id,
      client_id: item.clientId,
      meal_type_id: item.mealTypeId,
      weekday: item.weekday,
      quantity: item.quantity
    }))
  );

  await upsertRows(
    client,
    "daily_meal_orders",
    state.orders.map((item) => ({
      id: item.id,
      order_date: item.date,
      client_id: item.clientId,
      meal_type_id: item.mealTypeId,
      base_quantity: item.baseQuantity,
      final_quantity: item.finalQuantity,
      status: item.status,
      memo: item.memo ?? null,
      requires_review: item.requiresReview,
      acknowledged: item.acknowledged,
      updated_at: item.updatedAt
    }))
  );

  await upsertRows(
    client,
    "order_change_logs",
    state.orderChangeLogs.map((item) => ({
      id: item.id,
      order_id: item.orderId,
      client_id: item.clientId,
      meal_type_id: item.mealTypeId,
      order_date: item.date,
      actor_type: item.actorType,
      actor_name: item.actorName,
      before_quantity: item.beforeQuantity,
      after_quantity: item.afterQuantity,
      memo: item.memo ?? null,
      created_at: item.createdAt
    }))
  );

  await upsertRows(
    client,
    "change_requests",
    state.changeRequests.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      client_id: item.clientId,
      order_id: item.orderId ?? null,
      meal_type_id: item.mealTypeId ?? null,
      order_date: item.date ?? null,
      current_quantity: item.currentQuantity ?? null,
      requested_quantity: item.requestedQuantity ?? null,
      current_address: item.currentAddress ?? null,
      requested_address: item.requestedAddress ?? null,
      current_address_detail: item.currentAddressDetail ?? null,
      requested_address_detail: item.requestedAddressDetail ?? null,
      current_manager_name: item.currentManagerName ?? null,
      requested_manager_name: item.requestedManagerName ?? null,
      current_manager_phone: item.currentManagerPhone ?? null,
      requested_manager_phone: item.requestedManagerPhone ?? null,
      memo: item.memo ?? null,
      requested_at: item.requestedAt,
      resolved_at: item.resolvedAt ?? null,
      resolved_by: item.resolvedBy ?? null
    }))
  );

  await upsertRows(
    client,
    "holidays",
    state.holidays.map((item) => ({
      id: item.id,
      holiday_date: item.date,
      name: item.name,
      client_id: item.clientId ?? null
    }))
  );

  await upsertRows(
    client,
    "notifications",
    state.notifications.map((item) => ({
      id: item.id,
      target: item.target,
      client_id: item.clientId ?? null,
      title: item.title,
      body: item.body,
      read: item.read,
      created_at: item.createdAt
    }))
  );

  await upsertRows(
    client,
    "admin_audit_logs",
    state.auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      admin_name: item.adminName,
      target_label: item.targetLabel,
      detail: item.detail,
      created_at: item.createdAt
    }))
  );

  await upsertRows(
    client,
    "delivery_order_overrides",
    Object.entries(state.deliveryOverrides).map(([key, clientOrder]) => {
      const [orderDate, mealTypeId] = key.split(":");
      return {
        order_date: orderDate,
        meal_type_id: mealTypeId,
        client_order: clientOrder
      };
    }),
    "order_date,meal_type_id"
  );
}

export type AppStateArrayKey =
  | "clients"
  | "mealTypes"
  | "defaultQuantities"
  | "orders"
  | "orderChangeLogs"
  | "changeRequests"
  | "holidays"
  | "notifications"
  | "auditLogs";

export type AppStateDiff = {
  clients?: Client[];
  mealTypes?: MealType[];
  defaultQuantities?: DefaultMealQuantity[];
  orders?: DailyMealOrder[];
  orderChangeLogs?: OrderChangeLog[];
  changeRequests?: ChangeRequest[];
  holidays?: Holiday[];
  notifications?: AppNotification[];
  auditLogs?: AdminAuditLog[];
  deliveryOverrides?: Record<string, string[]>;
  deleted?: Partial<Record<AppStateArrayKey, string[]>>;
};

export async function saveAppStateDiffToSupabase(client: SupabaseClient, diff: AppStateDiff) {
  if (diff.deleted) {
    await deleteRows(client, "order_change_logs", diff.deleted.orderChangeLogs ?? []);
    await deleteRows(client, "change_requests", diff.deleted.changeRequests ?? []);
    await deleteRows(client, "notifications", diff.deleted.notifications ?? []);
    await deleteRows(client, "holidays", diff.deleted.holidays ?? []);
    await deleteRows(client, "default_meal_quantities", diff.deleted.defaultQuantities ?? []);
    await deleteRows(client, "daily_meal_orders", diff.deleted.orders ?? []);
    await deleteRows(client, "admin_audit_logs", diff.deleted.auditLogs ?? []);
    await deleteRows(client, "clients", diff.deleted.clients ?? []);
    await deleteRows(client, "meal_types", diff.deleted.mealTypes ?? []);
  }

  if (diff.clients?.length) {
    await upsertRows(
      client,
      "clients",
      diff.clients.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        address_detail: item.addressDetail,
        manager_name: item.managerName,
        manager_phone: item.managerPhone,
        delivery_memo: item.deliveryMemo,
        delivery_order: item.deliveryOrder,
        status: item.status,
        invite_code: item.inviteCode,
        invite_pin: item.invitePin,
        last_seen_at: item.lastSeenAt ?? null
      }))
    );
  }

  if (diff.mealTypes?.length) {
    await upsertRows(
      client,
      "meal_types",
      diff.mealTypes.map((item) => ({
        id: item.id,
        name: item.name,
        cutoff_time: item.cutoffTime,
        enabled: item.enabled
      }))
    );
  }

  if (diff.defaultQuantities?.length) {
    await upsertRows(
      client,
      "default_meal_quantities",
      diff.defaultQuantities.map((item) => ({
        id: item.id,
        client_id: item.clientId,
        meal_type_id: item.mealTypeId,
        weekday: item.weekday,
        quantity: item.quantity
      }))
    );
  }

  if (diff.orders?.length) {
    await upsertRows(
      client,
      "daily_meal_orders",
      diff.orders.map((item) => ({
        id: item.id,
        order_date: item.date,
        client_id: item.clientId,
        meal_type_id: item.mealTypeId,
        base_quantity: item.baseQuantity,
        final_quantity: item.finalQuantity,
        status: item.status,
        memo: item.memo ?? null,
        requires_review: item.requiresReview,
        acknowledged: item.acknowledged,
        updated_at: item.updatedAt
      }))
    );
  }

  if (diff.orderChangeLogs?.length) {
    await upsertRows(
      client,
      "order_change_logs",
      diff.orderChangeLogs.map((item) => ({
        id: item.id,
        order_id: item.orderId,
        client_id: item.clientId,
        meal_type_id: item.mealTypeId,
        order_date: item.date,
        actor_type: item.actorType,
        actor_name: item.actorName,
        before_quantity: item.beforeQuantity,
        after_quantity: item.afterQuantity,
        memo: item.memo ?? null,
        created_at: item.createdAt
      }))
    );
  }

  if (diff.changeRequests?.length) {
    await upsertRows(
      client,
      "change_requests",
      diff.changeRequests.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        client_id: item.clientId,
        order_id: item.orderId ?? null,
        meal_type_id: item.mealTypeId ?? null,
        order_date: item.date ?? null,
        current_quantity: item.currentQuantity ?? null,
        requested_quantity: item.requestedQuantity ?? null,
        current_address: item.currentAddress ?? null,
        requested_address: item.requestedAddress ?? null,
        current_address_detail: item.currentAddressDetail ?? null,
        requested_address_detail: item.requestedAddressDetail ?? null,
        current_manager_name: item.currentManagerName ?? null,
        requested_manager_name: item.requestedManagerName ?? null,
        current_manager_phone: item.currentManagerPhone ?? null,
        requested_manager_phone: item.requestedManagerPhone ?? null,
        memo: item.memo ?? null,
        requested_at: item.requestedAt,
        resolved_at: item.resolvedAt ?? null,
        resolved_by: item.resolvedBy ?? null
      }))
    );
  }

  if (diff.holidays?.length) {
    await upsertRows(
      client,
      "holidays",
      diff.holidays.map((item) => ({
        id: item.id,
        holiday_date: item.date,
        name: item.name,
        client_id: item.clientId ?? null
      }))
    );
  }

  if (diff.notifications?.length) {
    await upsertRows(
      client,
      "notifications",
      diff.notifications.map((item) => ({
        id: item.id,
        target: item.target,
        client_id: item.clientId ?? null,
        title: item.title,
        body: item.body,
        read: item.read,
        created_at: item.createdAt
      }))
    );
  }

  if (diff.auditLogs?.length) {
    await upsertRows(
      client,
      "admin_audit_logs",
      diff.auditLogs.map((item) => ({
        id: item.id,
        action: item.action,
        admin_name: item.adminName,
        target_label: item.targetLabel,
        detail: item.detail,
        created_at: item.createdAt
      }))
    );
  }

  if (diff.deliveryOverrides && Object.keys(diff.deliveryOverrides).length > 0) {
    await upsertRows(
      client,
      "delivery_order_overrides",
      Object.entries(diff.deliveryOverrides).map(([key, clientOrder]) => {
        const [orderDate, mealTypeId] = key.split(":");
        return {
          order_date: orderDate,
          meal_type_id: mealTypeId,
          client_order: clientOrder
        };
      }),
      "order_date,meal_type_id"
    );
  }
}
