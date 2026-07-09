export type ClientStatus = "active" | "paused";
export type OrderStatus = "normal" | "changed" | "rejected" | "pending" | "holiday";
export type RequestStatus = "pending" | "approved" | "rejected";
export type RequestType =
  | "late_quantity"
  | "late_rejection"
  | "address_update"
  | "contact_update"
  | "default_quantity_update";
export type NotificationTarget = "admin" | "client";
export type HolidayRuleType = "specific_date" | "monthly_day" | "monthly_last_day";
export type AuditAction =
  | "create_client"
  | "update_client"
  | "update_meal_settings"
  | "toggle_client_status"
  | "approve_request"
  | "reject_request"
  | "acknowledge_change"
  | "reset_pin"
  | "change_delivery_order"
  | "delete_client";

export interface Client {
  id: string;
  name: string;
  address: string;
  addressDetail: string;
  managerName: string;
  managerPhone: string;
  deliveryMemo: string;
  deliveryOrder: number;
  status: ClientStatus;
  inviteCode: string;
  invitePin: string;
  lastSeenAt?: string;
}

export interface MealType {
  id: string;
  name: string;
  cutoffTime: string;
  enabled: boolean;
}

export interface DefaultMealQuantity {
  id: string;
  clientId: string;
  mealTypeId: string;
  weekday: number;
  quantity: number;
}

export interface DailyMealOrder {
  id: string;
  date: string;
  clientId: string;
  mealTypeId: string;
  baseQuantity: number;
  finalQuantity: number;
  status: OrderStatus;
  memo?: string;
  requiresReview: boolean;
  acknowledged: boolean;
  updatedAt: string;
}

export interface OrderChangeLog {
  id: string;
  orderId: string;
  clientId: string;
  mealTypeId: string;
  date: string;
  actorType: "client" | "admin";
  actorName: string;
  beforeQuantity: number;
  afterQuantity: number;
  memo?: string;
  createdAt: string;
}

export interface ChangeRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  clientId: string;
  orderId?: string;
  mealTypeId?: string;
  date?: string;
  currentQuantity?: number;
  requestedQuantity?: number;
  currentAddress?: string;
  requestedAddress?: string;
  currentAddressDetail?: string;
  requestedAddressDetail?: string;
  currentManagerName?: string;
  requestedManagerName?: string;
  currentManagerPhone?: string;
  requestedManagerPhone?: string;
  memo?: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  clientId?: string;
  ruleType?: HolidayRuleType;
  mealTypeIds?: string[];
  monthDay?: number;
  enabled?: boolean;
}

export interface AppNotification {
  id: string;
  target: NotificationTarget;
  clientId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  action: AuditAction;
  adminName: string;
  targetLabel: string;
  detail: string;
  createdAt: string;
}

export interface AppState {
  clients: Client[];
  mealTypes: MealType[];
  defaultQuantities: DefaultMealQuantity[];
  orders: DailyMealOrder[];
  orderChangeLogs: OrderChangeLog[];
  changeRequests: ChangeRequest[];
  holidays: Holiday[];
  notifications: AppNotification[];
  auditLogs: AdminAuditLog[];
  deliveryOverrides: Record<string, string[]>;
}
