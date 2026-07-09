import { todayKey } from "@/lib/date";
import type {
  AppState,
  Client,
  DailyMealOrder,
  DefaultMealQuantity,
  Holiday,
  MealType
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

export type WeeklyQuantities = Record<string, Record<number, number>>;

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
  const mealTypes = normalizeMealTypes(state.mealTypes ?? []);
  const defaultQuantities = normalizeDefaultQuantities({
    clients: state.clients ?? [],
    mealTypes,
    defaultQuantities: state.defaultQuantities ?? []
  });

  return {
    ...state,
    mealTypes,
    defaultQuantities,
    orders: state.orders ?? [],
    orderChangeLogs: state.orderChangeLogs ?? [],
    changeRequests: state.changeRequests ?? [],
    holidays: (state.holidays ?? []).map(normalizeHoliday),
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
