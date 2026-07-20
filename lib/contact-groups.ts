import type {
  AppState,
  Client,
  ContactAccessGroup,
  ContactAccessGroupMember,
  SettlementAccount
} from "@/lib/types";

export function legacySettlementAccountForClient(client: Client): SettlementAccount {
  return {
    id: client.id,
    name: client.name,
    status: client.status === "active" ? "active" : "paused"
  };
}

export function legacyContactAccessGroupForClient(client: Client): ContactAccessGroup {
  return {
    id: client.id,
    name: `${client.name} 담당자`,
    managerName: client.managerName,
    managerPhone: client.managerPhone,
    inviteCode: client.inviteCode,
    invitePin: client.invitePin,
    status: client.status === "active" ? "active" : "paused"
  };
}

export function normalizeContactGroupState(state: Pick<AppState, "clients" | "settlementAccounts" | "contactAccessGroups" | "contactAccessGroupMembers">) {
  const settlementAccounts = state.settlementAccounts?.length
    ? state.settlementAccounts
    : state.clients.map(legacySettlementAccountForClient);
  const clients = state.clients.map((client) => ({
    ...client,
    settlementAccountId: client.settlementAccountId ?? client.id
  }));
  const contactAccessGroups = state.contactAccessGroups?.length
    ? state.contactAccessGroups
    : clients.map(legacyContactAccessGroupForClient);
  const contactAccessGroupMembers = state.contactAccessGroupMembers?.length
    ? state.contactAccessGroupMembers
    : clients.map((client) => ({
        id: `legacy-member-${client.id}`,
        contactAccessGroupId: client.id,
        clientId: client.id
      }));

  return { clients, settlementAccounts, contactAccessGroups, contactAccessGroupMembers };
}

export function getSettlementAccountForClient(state: Pick<AppState, "settlementAccounts">, client: Client) {
  return state.settlementAccounts.find((account) => account.id === client.settlementAccountId);
}

export function getClientsForSettlementAccount(state: Pick<AppState, "clients">, settlementAccountId: string) {
  return state.clients.filter((client) => client.settlementAccountId === settlementAccountId);
}

export function getContactAccessGroupsForClient(
  state: Pick<AppState, "contactAccessGroups" | "contactAccessGroupMembers">,
  clientId: string
) {
  const groupIds = new Set(
    state.contactAccessGroupMembers
      .filter((member) => member.clientId === clientId)
      .map((member) => member.contactAccessGroupId)
  );
  return state.contactAccessGroups.filter((group) => groupIds.has(group.id));
}

export function getPrimaryContactAccessGroupForClient(
  state: Pick<AppState, "contactAccessGroups" | "contactAccessGroupMembers">,
  clientId: string
) {
  return getContactAccessGroupsForClient(state, clientId)[0];
}

export function getClientsForContactAccessGroup(
  state: Pick<AppState, "clients" | "contactAccessGroupMembers">,
  contactAccessGroupId: string
) {
  const clientIds = new Set(
    state.contactAccessGroupMembers
      .filter((member) => member.contactAccessGroupId === contactAccessGroupId)
      .map((member) => member.clientId)
  );
  return state.clients.filter((client) => clientIds.has(client.id));
}

export function filterStateForContactAccessGroup(state: AppState, contactAccessGroupId: string): AppState {
  const group = state.contactAccessGroups.find((item) => item.id === contactAccessGroupId);
  const clients = getClientsForContactAccessGroup(state, contactAccessGroupId);
  const clientIds = new Set(clients.map((client) => client.id));

  return {
    ...state,
    clients,
    settlementAccounts: [],
    contactAccessGroups: group ? [group] : [],
    contactAccessGroupMembers: state.contactAccessGroupMembers.filter(
      (member) => member.contactAccessGroupId === contactAccessGroupId && clientIds.has(member.clientId)
    ),
    defaultQuantities: state.defaultQuantities.filter((item) => clientIds.has(item.clientId)),
    orders: state.orders.filter((item) => clientIds.has(item.clientId)),
    orderChangeLogs: state.orderChangeLogs.filter((item) => clientIds.has(item.clientId)),
    changeRequests: state.changeRequests.filter((item) => clientIds.has(item.clientId)),
    holidays: state.holidays.filter((item) => !item.clientId || clientIds.has(item.clientId)),
    monthlyAdjustments: [],
    supplierProfileStorageReady: false,
    settlementAccountDetailsStorageReady: false,
    supplierProfile: {
      id: "primary",
      businessName: "밥심",
      businessRegistrationNumber: "",
      address: "",
      phone: "",
      email: "",
      bankName: "",
      bankAccountNumber: "",
      accountHolder: ""
    },
    notifications: state.notifications.filter(
      (item) => item.target === "client" && !!item.clientId && clientIds.has(item.clientId)
    ),
    auditLogs: [],
    deliveryOverrides: {}
  };
}