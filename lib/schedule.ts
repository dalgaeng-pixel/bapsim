import { isPastCutoffForDate, todayKey } from "@/lib/date";
import { getClientsForSettlementAccount, normalizeContactGroupState } from "@/lib/contact-groups";
import type {
  AppState,
  Client,
  DailyMealOrder,
  DefaultMealQuantity,
  Holiday,
  MealType,
  MealSupplyType,
  MonthlyAdjustment
} from "@/lib/types";

export const WEEKDAYS = [
  { index: 1, label: "월" },
  { index: 2, label: "화" },
  { index: 3, label: "수" },
  { index: 4, label: "목" },
  { index: 5, label: "금" },
  { index: 6, label: "토" },
  { index: 0, label: "일" }
] as const;

export const BASE_MEAL_TYPES: MealType[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "점심",
    cutoffTime: "10:00",
    enabled: true
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    name: "저녁",
    cutoffTime: "15:00",
    enabled: true
  }
];

const RULE_PREFIX = "__BAPSIM_MEAL_RULE__:";
const CLIENT_SETTINGS_PREFIX = "__BAPSIM_CLIENT_SETTINGS__:";
const CLIENT_SETTINGS_DATE = "1900-01-01";
const MONTHLY_ADJUSTMENT_PREFIX = "__BAPSIM_MONTHLY_ADJUSTMENT__:";

export const DEFAULT_MEAL_UNIT_PRICE = 8000;

export type WeeklyQuantities = Record<string, Record<number, number>>;

export const MEAL_SUPPLY_TYPE_LABELS: Record<MealSupplyType, string> = {
  regular: "일반 식수",
  lunchbox: "개인도시락"
};

export function getClientMealSupplyType(client: Pick<Client, "mealSupplyType"> | undefined) {
  return client?.mealSupplyType ?? "regular";
}

export function mealSupplyTypeLabel(type: MealSupplyType | undefined) {
  return MEAL_SUPPLY_TYPE_LABELS[type ?? "regular"];
}

export function isClientStartedOnDate(client: Pick<Client, "deliveryStartDate"> | undefined, date: string) {
  return !client?.deliveryStartDate || date >= client.deliveryStartDate;
}

export function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getWeekStart(dateKey = todayKey()) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return todayKey(date);
}

export function getDateRange(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

export function getClientPlanningDates(baseDate = todayKey()) {
  return getDateRange(getWeekStart(baseDate), 14);
}

export function getTomorrowKey(baseDate = todayKey()) {
  return addDays(baseDate, 1);
}

export function getWeekday(dateKey: string) {
  return parseDateKey(dateKey).getDay();
}

export function getLastDayOfMonth(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function enabledMealTypes(state: Pick<AppState, "mealTypes">) {
  return state.mealTypes.filter((mealType) => mealType.enabled);
}

export function normalizeAppState(state: AppState): AppState {
  const grouping = normalizeContactGroupState({
    clients: (state.clients ?? []).map((client) => ({
      ...client,
      mealSupplyType: client.mealSupplyType ?? "regular"
    })),
    settlementAccounts: (state.settlementAccounts ?? []).map((account) => ({
      ...account,
      billingAddress: account.billingAddress ?? "",
      defaultUnitPrice: account.defaultUnitPrice ?? DEFAULT_MEAL_UNIT_PRICE
    })),
    contactAccessGroups: state.contactAccessGroups ?? [],
    contactAccessGroupMembers: state.contactAccessGroupMembers ?? []
  });
  const mealTypes = normalizeMealTypes(state.mealTypes ?? []);
  const defaultQuantities = normalizeDefaultQuantities({
    clients: grouping.clients,
    mealTypes,
    defaultQuantities: state.defaultQuantities ?? []
  });

  return {
    ...state,
    ...grouping,
    groupStorageReady: state.groupStorageReady === true,
    settlementPricingStorageReady: state.settlementPricingStorageReady !== false,
    deliveryCorrectionStorageReady: state.deliveryCorrectionStorageReady !== false,
    supplierProfileStorageReady: state.supplierProfileStorageReady === true,
    settlementAccountDetailsStorageReady: state.settlementAccountDetailsStorageReady === true,
    supplierProfile: {
      id: state.supplierProfile?.id ?? "primary",
      businessName: state.supplierProfile?.businessName ?? "밥심",
      businessRegistrationNumber: state.supplierProfile?.businessRegistrationNumber ?? "",
      address: state.supplierProfile?.address ?? "",
      phone: state.supplierProfile?.phone ?? "",
      email: state.supplierProfile?.email ?? "",
      bankName: state.supplierProfile?.bankName ?? "",
      bankAccountNumber: state.supplierProfile?.bankAccountNumber ?? "",
      accountHolder: state.supplierProfile?.accountHolder ?? ""
    },
    mealTypes,
    defaultQuantities,
    orders: (state.orders ?? []).map((order) => ({
      ...order,
      isAdminCorrection: order.isAdminCorrection === true,
      settlementIncluded: order.settlementIncluded !== false
    })),
    orderChangeLogs: state.orderChangeLogs ?? [],
    changeRequests: state.changeRequests ?? [],
    holidays: (state.holidays ?? []).map(normalizeHoliday),
    monthlyAdjustments: state.monthlyAdjustments ?? [],
    notifications: state.notifications ?? [],
    auditLogs: state.auditLogs ?? [],
    deliveryOverrides: state.deliveryOverrides ?? {}
  };
}

export function normalizeMealTypes(mealTypes: MealType[]) {
  const next = [...mealTypes];

  for (const base of BASE_MEAL_TYPES) {
    if (!next.some((mealType) => mealType.name === base.name)) {
      next.push(base);
    }
  }

  return next
    .map((mealType) => ({
      ...mealType,
      cutoffTime: mealType.cutoffTime || BASE_MEAL_TYPES.find((item) => item.name === mealType.name)?.cutoffTime || "10:00",
      enabled: mealType.enabled !== false
    }))
    .sort((a, b) => mealSortIndex(a.name) - mealSortIndex(b.name));
}

function mealSortIndex(name: string) {
  const index = BASE_MEAL_TYPES.findIndex((mealType) => mealType.name === name);
  return index === -1 ? 100 : index;
}

function normalizeDefaultQuantities({
  clients,
  mealTypes,
  defaultQuantities
}: {
  clients: Client[];
  mealTypes: MealType[];
  defaultQuantities: DefaultMealQuantity[];
}) {
  const next = [...defaultQuantities];

  for (const client of clients) {
    const firstExistingQuantity =
      next.find((item) => item.clientId === client.id && item.quantity > 0)?.quantity ?? 0;

    for (const mealType of mealTypes) {
      const sameMealQuantity =
        next.find((item) => item.clientId === client.id && item.mealTypeId === mealType.id)?.quantity ??
        (mealType.name === "점심" ? firstExistingQuantity : 0);

      for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
        if (
          !next.some(
            (item) =>
              item.clientId === client.id &&
              item.mealTypeId === mealType.id &&
              item.weekday === weekday
          )
        ) {
          next.push({
            id: createLocalId("default"),
            clientId: client.id,
            mealTypeId: mealType.id,
            weekday,
            quantity: sameMealQuantity
          });
        }
      }
    }
  }

  return next;
}

export function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getBaseQuantity(state: AppState, clientId: string, mealTypeId: string, date: string) {
  if (isNoMealByRule(state, clientId, mealTypeId, date)) {
    return 0;
  }

  const weekday = getWeekday(date);
  return (
    state.defaultQuantities.find(
      (item) =>
        item.clientId === clientId && item.mealTypeId === mealTypeId && item.weekday === weekday
    )?.quantity ?? 0
  );
}

export function getExceptionLabel(
  state: AppState,
  clientId: string,
  mealTypeId: string,
  date: string
) {
  const rule = state.holidays.find((holiday) => holidayMatches(holiday, clientId, mealTypeId, date));
  return rule?.name;
}

export function isNoMealByRule(state: AppState, clientId: string, mealTypeId: string, date: string) {
  return state.holidays.some((holiday) => holidayMatches(holiday, clientId, mealTypeId, date));
}

export function holidayMatches(
  holiday: Holiday,
  clientId: string,
  mealTypeId: string,
  date: string
) {
  if (holiday.enabled === false) {
    return false;
  }

  if (holiday.clientId && holiday.clientId !== clientId) {
    return false;
  }

  if (holiday.mealTypeIds?.length && !holiday.mealTypeIds.includes(mealTypeId)) {
    return false;
  }

  if (!holiday.ruleType) {
    return holiday.date === date;
  }

  if (holiday.ruleType === "specific_date") {
    return holiday.date === date;
  }

  const day = Number(date.split("-")[2]);

  if (holiday.ruleType === "monthly_day") {
    return day === holiday.monthDay;
  }

  return day === getLastDayOfMonth(date);
}

export function getOrderForSlot(
  state: AppState,
  clientId: string,
  mealTypeId: string,
  date: string
): DailyMealOrder {
  const existing = state.orders.find(
    (order) => order.clientId === clientId && order.mealTypeId === mealTypeId && order.date === date
  );

  if (existing) {
    return existing;
  }

  return buildBaseOrder(state, clientId, mealTypeId, date);
}

export function getOrdersForDate(state: AppState, date: string, mealTypeId?: string) {
  return state.clients
    .flatMap((client) =>
      enabledMealTypes(state)
        .filter((mealType) => !mealTypeId || mealType.id === mealTypeId)
        .map((mealType) => getOrderForSlot(state, client.id, mealType.id, date))
    )
    .sort((a, b) => {
      const leftClient = state.clients.find((client) => client.id === a.clientId);
      const rightClient = state.clients.find((client) => client.id === b.clientId);
      const leftMeal = state.mealTypes.findIndex((mealType) => mealType.id === a.mealTypeId);
      const rightMeal = state.mealTypes.findIndex((mealType) => mealType.id === b.mealTypeId);
      return (
        (leftClient?.deliveryOrder ?? 0) - (rightClient?.deliveryOrder ?? 0) ||
        leftMeal - rightMeal
      );
    });
}

export function getBillableOrdersForClient(state: AppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  return state.orders.filter(
    (order) => order.clientId === clientId && isClientStartedOnDate(client, order.date)
  );
}

export function getSettlementDatesForMonth(month: string, now = new Date()) {
  const currentMonth = todayKey(now).slice(0, 7);

  if (month > currentMonth) {
    return [];
  }

  const lastDate = month === currentMonth
    ? todayKey(now)
    : `${month}-${String(getLastDayOfMonth(`${month}-01`)).padStart(2, "0")}`;

  return getDateRange(`${month}-01`, Number(lastDate.slice(-2)));
}

export function getBillableOrdersForClientMonth(state: AppState, clientId: string, month: string) {
  const client = state.clients.find((item) => item.id === clientId);

  return getSettlementDatesForMonth(month)
    .flatMap((date) =>
      enabledMealTypes(state).map((mealType) => {
        const order = getOrderForSlot(state, clientId, mealType.id, date);
        return { mealType, order };
      })
    )
    .filter(({ mealType, order }) => order.isAdminCorrection || isPastCutoffForDate(order.date, mealType.cutoffTime))
    .map(({ order }) => order)
    .filter((order) => isClientStartedOnDate(client, order.date) || order.isAdminCorrection)
    .filter((order) => order.settlementIncluded !== false);
}

export function getAdminDeliveryCorrectionsForMonth(state: AppState, month: string) {
  return state.orders
    .filter((order) => order.isAdminCorrection && order.date.startsWith(`${month}-`))
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      (state.clients.find((client) => client.id === left.clientId)?.deliveryOrder ?? 0) -
        (state.clients.find((client) => client.id === right.clientId)?.deliveryOrder ?? 0)
    );
}

export function getMonthlyAdjustment(state: AppState, clientId: string, month: string) {
  return state.monthlyAdjustments.find(
    (adjustment) => adjustment.clientId === clientId && adjustment.month === month
  );
}

export function getMonthlySettlementForClient(state: AppState, clientId: string, month: string) {
  const orders = getBillableOrdersForClientMonth(state, clientId, month);
  const adjustment = getMonthlyAdjustment(state, clientId, month);
  const computedFinalQuantity = orders.reduce((sum, order) => sum + order.finalQuantity, 0);

  return {
    orders,
    adjustment,
    computedBaseQuantity: orders.reduce((sum, order) => sum + order.baseQuantity, 0),
    computedFinalQuantity,
    settlementFinalQuantity: adjustment?.finalQuantity ?? computedFinalQuantity,
    rejectedCount: orders.filter((order) => order.status === "rejected").length,
    changedCount: orders.filter((order) => order.status === "changed").length
  };
}

export function getSettlementAccountMonthlyAdjustment(
  state: AppState,
  settlementAccountId: string,
  month: string
) {
  return state.monthlyAdjustments.find(
    (adjustment) => adjustment.settlementAccountId === settlementAccountId && adjustment.month === month
  );
}

export type SettlementDailyQuantity = {
  date: string;
  regularQuantity: number;
  lunchboxQuantity: number;
  finalQuantity: number;
};

export type SettlementLocationDailyQuantity = SettlementDailyQuantity & {
  clientId: string;
  clientName: string;
  hasAdminCorrection: boolean;
};

export function getMonthlySettlementDailyQuantitiesByLocation(
  state: AppState,
  settlementAccountId: string,
  month: string
): SettlementLocationDailyQuantity[] {
  const settlement = getMonthlySettlementForSettlementAccount(state, settlementAccountId, month);
  const deliveryOrderByClientId = new Map(settlement.clients.map((client, index) => [client.id, index]));
  const rows = settlement.clientSettlements.flatMap((clientSettlement, index) => {
    const client = settlement.clients[index];
    if (!client) {
      return [];
    }

    const supplyType = getClientMealSupplyType(client);
    const daily = new Map<string, SettlementLocationDailyQuantity>();
    clientSettlement.orders.forEach((order) => {
      const quantity = Math.max(0, order.finalQuantity);
      if (quantity === 0 && !order.isAdminCorrection) {
        return;
      }

      const current = daily.get(order.date) ?? {
        clientId: client.id,
        clientName: client.name,
        date: order.date,
        regularQuantity: 0,
        lunchboxQuantity: 0,
        finalQuantity: 0,
        hasAdminCorrection: false
      };
      if (supplyType === "lunchbox") {
        current.lunchboxQuantity += quantity;
      } else {
        current.regularQuantity += quantity;
      }
      current.finalQuantity += quantity;
      current.hasAdminCorrection ||= order.isAdminCorrection === true;
      daily.set(order.date, current);
    });

    return [...daily.values()];
  });

  return rows.sort((left, right) =>
    left.date.localeCompare(right.date) ||
    (deliveryOrderByClientId.get(left.clientId) ?? Number.MAX_SAFE_INTEGER) -
      (deliveryOrderByClientId.get(right.clientId) ?? Number.MAX_SAFE_INTEGER)
  );
}
export function getMonthlySettlementDailyQuantities(
  state: AppState,
  settlementAccountId: string,
  month: string
): SettlementDailyQuantity[] {
  const daily = new Map<string, SettlementDailyQuantity>();

  getMonthlySettlementDailyQuantitiesByLocation(state, settlementAccountId, month).forEach((item) => {
    const current = daily.get(item.date) ?? {
      date: item.date,
      regularQuantity: 0,
      lunchboxQuantity: 0,
      finalQuantity: 0
    };
    current.regularQuantity += item.regularQuantity;
    current.lunchboxQuantity += item.lunchboxQuantity;
    current.finalQuantity += item.finalQuantity;
    daily.set(item.date, current);
  });

  return [...daily.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function getMonthlySettlementForSettlementAccount(
  state: AppState,
  settlementAccountId: string,
  month: string
) {
  const account = state.settlementAccounts.find((item) => item.id === settlementAccountId);
  const clients = getClientsForSettlementAccount(state, settlementAccountId);
  const clientSettlements = clients.map((client) => getMonthlySettlementForClient(state, client.id, month));
  const computedBaseQuantity = clientSettlements.reduce(
    (sum, settlement) => sum + settlement.computedBaseQuantity,
    0
  );
  const computedFinalQuantity = clientSettlements.reduce(
    (sum, settlement) => sum + settlement.computedFinalQuantity,
    0
  );
  // Account settlement follows actual daily quantities; legacy client-level monthly overrides do not change location subtotals.
  const locationAdjustedFinalQuantity = computedFinalQuantity;
  const adjustment = getSettlementAccountMonthlyAdjustment(state, settlementAccountId, month);

  return {
    clients,
    clientSettlements,
    adjustment,
    computedBaseQuantity,
    computedFinalQuantity,
    locationAdjustedFinalQuantity,
    settlementFinalQuantity: adjustment?.finalQuantity ?? locationAdjustedFinalQuantity,
    unitPrice: adjustment?.unitPrice ?? account?.defaultUnitPrice ?? DEFAULT_MEAL_UNIT_PRICE,
    rejectedCount: clientSettlements.reduce((sum, settlement) => sum + settlement.rejectedCount, 0),
    changedCount: clientSettlements.reduce((sum, settlement) => sum + settlement.changedCount, 0)
  };
}

export function buildBaseOrder(
  state: AppState,
  clientId: string,
  mealTypeId: string,
  date: string
): DailyMealOrder {
  const baseQuantity = getBaseQuantity(state, clientId, mealTypeId, date);
  const exceptionLabel = getExceptionLabel(state, clientId, mealTypeId, date);

  return {
    id: createLocalId("order"),
    date,
    clientId,
    mealTypeId,
    baseQuantity,
    finalQuantity: baseQuantity,
    status: baseQuantity === 0 ? "holiday" : "normal",
    memo: exceptionLabel ?? (baseQuantity === 0 ? "기본 안먹음" : undefined),
    requiresReview: false,
    acknowledged: false,
    isAdminCorrection: false,
    settlementIncluded: true,
    updatedAt: new Date().toISOString()
  };
}

export function getWeeklyQuantitiesForClient(state: AppState, clientId: string): WeeklyQuantities {
  const result: WeeklyQuantities = {};

  for (const mealType of enabledMealTypes(state)) {
    result[mealType.id] = {};

    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      result[mealType.id][weekday] =
        state.defaultQuantities.find(
          (item) =>
            item.clientId === clientId &&
            item.mealTypeId === mealType.id &&
            item.weekday === weekday
        )?.quantity ?? 0;
    }
  }

  return result;
}

export function buildDefaultQuantitiesFromWeekly({
  state,
  clientId,
  weeklyQuantities
}: {
  state: AppState;
  clientId: string;
  weeklyQuantities: WeeklyQuantities;
}) {
  const rows: DefaultMealQuantity[] = [];

  for (const mealType of enabledMealTypes(state)) {
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      const existing = state.defaultQuantities.find(
        (item) =>
          item.clientId === clientId &&
          item.mealTypeId === mealType.id &&
          item.weekday === weekday
      );

      rows.push({
        id: existing?.id ?? createLocalId("default"),
        clientId,
        mealTypeId: mealType.id,
        weekday,
        quantity: Math.max(0, Number(weeklyQuantities[mealType.id]?.[weekday] ?? 0))
      });
    }
  }

  return rows;
}

export function encodeHolidayName(holiday: Holiday) {
  if (!holiday.ruleType) {
    return holiday.name;
  }

  return `${RULE_PREFIX}${JSON.stringify({
    name: holiday.name,
    ruleType: holiday.ruleType,
    mealTypeIds: holiday.mealTypeIds ?? [],
    monthDay: holiday.monthDay,
    enabled: holiday.enabled !== false
  })}`;
}

export function clientSettingsHolidayId(clientId: string) {
  return `99999999${clientId.slice(8)}`;
}

export function encodeClientSettingsName(client: Pick<Client, "deliveryStartDate" | "mealSupplyType">) {
  return `${CLIENT_SETTINGS_PREFIX}${JSON.stringify({
    deliveryStartDate: client.deliveryStartDate,
    mealSupplyType: getClientMealSupplyType(client)
  })}`;
}

export function isClientSettingsName(name: string) {
  return name.startsWith(CLIENT_SETTINGS_PREFIX);
}

export function decodeClientSettingsName(name: string) {
  if (!isClientSettingsName(name)) {
    return {};
  }

  try {
    const parsed = JSON.parse(name.slice(CLIENT_SETTINGS_PREFIX.length)) as {
      deliveryStartDate?: string;
      mealSupplyType?: MealSupplyType;
    };
    return {
      deliveryStartDate: parsed.deliveryStartDate,
      mealSupplyType: parsed.mealSupplyType === "lunchbox" ? "lunchbox" : "regular"
    };
  } catch {
    return {};
  }
}

export function buildClientSettingsHolidayRow(client: Pick<Client, "id" | "deliveryStartDate" | "mealSupplyType">) {
  return {
    id: clientSettingsHolidayId(client.id),
    holiday_date: CLIENT_SETTINGS_DATE,
    name: encodeClientSettingsName(client),
    client_id: client.id
  };
}

export function isClientSettingsHolidayRow(row: { name: string }) {
  return isClientSettingsName(row.name);
}

export function encodeMonthlyAdjustmentName(adjustment: MonthlyAdjustment) {
  return `${MONTHLY_ADJUSTMENT_PREFIX}${JSON.stringify({
    month: adjustment.month,
    clientId: adjustment.clientId,
    finalQuantity: adjustment.finalQuantity,
    memo: adjustment.memo,
    updatedAt: adjustment.updatedAt
  })}`;
}

export function isMonthlyAdjustmentName(name: string) {
  return name.startsWith(MONTHLY_ADJUSTMENT_PREFIX);
}

export function decodeMonthlyAdjustmentName(name: string) {
  if (!isMonthlyAdjustmentName(name)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(name.slice(MONTHLY_ADJUSTMENT_PREFIX.length)) as {
      month?: string;
      clientId?: string;
      finalQuantity?: number;
      memo?: string;
      updatedAt?: string;
    };

    if (!parsed.month || !parsed.clientId || typeof parsed.finalQuantity !== "number") {
      return undefined;
    }

    return {
      month: parsed.month,
      clientId: parsed.clientId,
      finalQuantity: parsed.finalQuantity,
      memo: parsed.memo,
      updatedAt: parsed.updatedAt ?? new Date().toISOString()
    };
  } catch {
    return undefined;
  }
}

export function buildMonthlyAdjustmentHolidayRow(adjustment: MonthlyAdjustment) {
  return {
    id: adjustment.id,
    holiday_date: `${adjustment.month}-01`,
    name: encodeMonthlyAdjustmentName(adjustment),
    client_id: null
  };
}

export function isMonthlyAdjustmentHolidayRow(row: { name: string }) {
  return isMonthlyAdjustmentName(row.name);
}

export function decodeHoliday(row: { id: string; holiday_date: string; name: string; client_id: string | null }): Holiday {
  if (!row.name.startsWith(RULE_PREFIX)) {
    return {
      id: row.id,
      date: row.holiday_date,
      name: row.name,
      clientId: row.client_id ?? undefined
    };
  }

  try {
    const parsed = JSON.parse(row.name.slice(RULE_PREFIX.length)) as {
      name?: string;
      ruleType?: Holiday["ruleType"];
      mealTypeIds?: string[];
      monthDay?: number;
      enabled?: boolean;
    };

    return normalizeHoliday({
      id: row.id,
      date: row.holiday_date,
      name: parsed.name || "식사 안먹음",
      clientId: row.client_id ?? undefined,
      ruleType: parsed.ruleType,
      mealTypeIds: parsed.mealTypeIds,
      monthDay: parsed.monthDay,
      enabled: parsed.enabled
    });
  } catch {
    return {
      id: row.id,
      date: row.holiday_date,
      name: row.name,
      clientId: row.client_id ?? undefined
    };
  }
}

export function normalizeHoliday(holiday: Holiday): Holiday {
  if (!holiday.ruleType) {
    return holiday;
  }

  return {
    ...holiday,
    name: holiday.name || "식사 안먹음",
    mealTypeIds: holiday.mealTypeIds ?? [],
    enabled: holiday.enabled !== false
  };
}

export function createHolidayRule(input: Omit<Holiday, "id" | "enabled"> & { id?: string }) {
  return normalizeHoliday({
    ...input,
    id: input.id ?? createLocalId("holiday"),
    enabled: true
  });
}

export function makeRuleStorageDate(ruleType: Holiday["ruleType"], specificDate: string, monthDay: number) {
  if (ruleType === "specific_date") {
    return specificDate;
  }

  if (ruleType === "monthly_day") {
    return `2000-01-${String(Math.max(1, Math.min(31, monthDay))).padStart(2, "0")}`;
  }

  return "2000-01-31";
}
