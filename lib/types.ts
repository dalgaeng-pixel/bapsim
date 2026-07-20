export type ClientStatus = "active" | "paused";
export type MealSupplyType = "regular" | "lunchbox";
export type SettlementAccountStatus = "active" | "paused";
export type ContactAccessGroupStatus = "active" | "paused";
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
  | "update_monthly_adjustment"
  | "update_delivery_correction"
  | "reset_delivery_correction"
  | "delete_client"
  | "create_settlement_account"
  | "update_settlement_account"
  | "delete_settlement_account"
  | "create_contact_access_group"
  | "update_contact_access_group"
  | "reset_contact_access_group_pin"
  | "delete_contact_access_group";

export interface SettlementAccount {
  id: string;
  name: string;
  status: SettlementAccountStatus;
}

export interface ContactAccessGroup {
  id: string;
  name: string;
  managerName: string;
  managerPhone: string;
  inviteCode: string;
  invitePin: string;
  status: ContactAccessGroupStatus;
}

export interface ContactAccessGroupMember {
  id: string;
  contactAccessGroupId: string;
  clientId: string;
}

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
  settlementAccountId?: string;
  deliveryStartDate?: string;
  mealSupplyType: MealSupplyType;
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
  isAdminCorrection?: boolean;
  settlementIncluded?: boolean;
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

export interface MonthlyAdjustment {
  id: string;
  month: string;
  clientId?: string;
  settlementAccountId?: string;
  finalQuantity?: number;
  unitPrice?: number;
  memo?: string;
  updatedAt: string;
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
  settlementAccounts: SettlementAccount[];
  contactAccessGroups: ContactAccessGroup[];
  contactAccessGroupMembers: ContactAccessGroupMember[];
  groupStorageReady: boolean;
  settlementPricingStorageReady: boolean;
  deliveryCorrectionStorageReady: boolean;
  mealTypes: MealType[];
  defaultQuantities: DefaultMealQuantity[];
  orders: DailyMealOrder[];
  orderChangeLogs: OrderChangeLog[];
  changeRequests: ChangeRequest[];
  holidays: Holiday[];
  monthlyAdjustments: MonthlyAdjustment[];
  notifications: AppNotification[];
  auditLogs: AdminAuditLog[];
  deliveryOverrides: Record<string, string[]>;
}
