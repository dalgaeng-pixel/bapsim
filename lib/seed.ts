import { todayKey, weekdayIndex } from "@/lib/date";
import type { AppState, Client, DailyMealOrder, DefaultMealQuantity } from "@/lib/types";

const nowIso = () => new Date().toISOString();

const ids = {
  lunch: "11111111-1111-4111-8111-111111111111",
  clients: [
    "22222222-2222-4222-8222-222222222201",
    "22222222-2222-4222-8222-222222222202",
    "22222222-2222-4222-8222-222222222203",
    "22222222-2222-4222-8222-222222222204",
    "22222222-2222-4222-8222-222222222205"
  ],
  defaults: [
    "33333333-3333-4333-8333-333333333301",
    "33333333-3333-4333-8333-333333333302",
    "33333333-3333-4333-8333-333333333303",
    "33333333-3333-4333-8333-333333333304",
    "33333333-3333-4333-8333-333333333305"
  ],
  orders: [
    "44444444-4444-4444-8444-444444444401",
    "44444444-4444-4444-8444-444444444402",
    "44444444-4444-4444-8444-444444444403",
    "44444444-4444-4444-8444-444444444404",
    "44444444-4444-4444-8444-444444444405"
  ],
  logs: [
    "55555555-5555-4555-8555-555555555501",
    "55555555-5555-4555-8555-555555555502"
  ],
  requests: ["66666666-6666-4666-8666-666666666601"],
  notifications: [
    "77777777-7777-4777-8777-777777777701",
    "77777777-7777-4777-8777-777777777702"
  ]
};

export function createInitialState(): AppState {
  const date = todayKey();
  const weekday = weekdayIndex();

  const clients: Client[] = [
    {
      id: ids.clients[0],
      name: "대한정밀",
      address: "경기 시흥시 공단1대로 204",
      addressDetail: "본관 1층 경비실",
      managerName: "김민재",
      managerPhone: "010-2488-1029",
      deliveryMemo: "정문 경비실에 전달",
      deliveryOrder: 1,
      status: "active",
      inviteCode: "DAEHAN-01",
      invitePin: "1234",
      deliveryStartDate: date,
      mealSupplyType: "regular",
      lastSeenAt: nowIso()
    },
    {
      id: ids.clients[1],
      name: "서해물류센터",
      address: "경기 안산시 단원구 산단로 51",
      addressDetail: "A동 물류사무실",
      managerName: "이수연",
      managerPhone: "010-7744-3321",
      deliveryMemo: "후문 하차장 이용",
      deliveryOrder: 2,
      status: "active",
      inviteCode: "SEOHAE-02",
      invitePin: "4821",
      deliveryStartDate: date,
      mealSupplyType: "regular",
      lastSeenAt: nowIso()
    },
    {
      id: ids.clients[2],
      name: "한빛사무동",
      address: "경기 화성시 동탄첨단산업1로 27",
      addressDetail: "3층 총무팀",
      managerName: "박준호",
      managerPhone: "010-1190-8891",
      deliveryMemo: "엘리베이터 앞 테이블",
      deliveryOrder: 3,
      status: "active",
      inviteCode: "HANBIT-03",
      invitePin: "9130",
      deliveryStartDate: date,
      mealSupplyType: "regular",
      lastSeenAt: nowIso()
    },
    {
      id: ids.clients[3],
      name: "신성패키징",
      address: "경기 군포시 엘에스로 172",
      addressDetail: "2공장 식당",
      managerName: "정하늘",
      managerPhone: "010-5510-4210",
      deliveryMemo: "식당 안쪽 배식대",
      deliveryOrder: 4,
      status: "active",
      inviteCode: "SINSUNG-04",
      invitePin: "7782",
      deliveryStartDate: date,
      mealSupplyType: "regular",
      lastSeenAt: nowIso()
    },
    {
      id: ids.clients[4],
      name: "중앙테크",
      address: "경기 부천시 오정로 39",
      addressDetail: "생산동 1층",
      managerName: "최유진",
      managerPhone: "010-3020-6614",
      deliveryMemo: "점심 전 담당자 통화",
      deliveryOrder: 5,
      status: "active",
      inviteCode: "JATECH-05",
      invitePin: "6650",
      deliveryStartDate: date,
      mealSupplyType: "regular",
      lastSeenAt: nowIso()
    }
  ];

  const mealTypes = [
    {
      id: ids.lunch,
      name: "점심",
      cutoffTime: "10:00",
      enabled: true
    }
  ];

  const quantities = [25, 18, 32, 14, 21];
  const defaultQuantities: DefaultMealQuantity[] = clients.map((client, index) => ({
    id: ids.defaults[index],
    clientId: client.id,
    mealTypeId: ids.lunch,
    weekday,
    quantity: quantities[index]
  }));

  const orders: DailyMealOrder[] = clients.map((client, index) => ({
    id: ids.orders[index],
    date,
    clientId: client.id,
    mealTypeId: ids.lunch,
    baseQuantity: quantities[index],
    finalQuantity: quantities[index],
    status: "normal",
    requiresReview: false,
    acknowledged: false,
    updatedAt: nowIso()
  }));

  orders[1] = {
    ...orders[1],
    finalQuantity: 10,
    status: "changed",
    memo: "현장 교육으로 인원 감소",
    requiresReview: true,
    updatedAt: nowIso()
  };

  orders[3] = {
    ...orders[3],
    finalQuantity: 0,
    status: "rejected",
    memo: "공장 자체 행사",
    requiresReview: true,
    updatedAt: nowIso()
  };

  return {
    clients,
    settlementAccounts: clients.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status === "active" ? "active" : "paused" as const
    })),
    contactAccessGroups: clients.map((client) => ({
      id: client.id,
      name: `${client.name} 담당자`,
      managerName: client.managerName,
      managerPhone: client.managerPhone,
      inviteCode: client.inviteCode,
      invitePin: client.invitePin,
      status: client.status === "active" ? "active" : "paused" as const
    })),
    contactAccessGroupMembers: clients.map((client) => ({
      id: `legacy-member-${client.id}`,
      contactAccessGroupId: client.id,
      clientId: client.id
    })),
    groupStorageReady: true,
    settlementPricingStorageReady: true,
    mealTypes,
    defaultQuantities,
    orders,
    orderChangeLogs: [
      {
        id: ids.logs[0],
        orderId: orders[1].id,
        clientId: ids.clients[1],
        mealTypeId: ids.lunch,
        date,
        actorType: "client",
        actorName: "이수연",
        beforeQuantity: 18,
        afterQuantity: 10,
        memo: "현장 교육으로 인원 감소",
        createdAt: nowIso()
      },
      {
        id: ids.logs[1],
        orderId: orders[3].id,
        clientId: ids.clients[3],
        mealTypeId: ids.lunch,
        date,
        actorType: "client",
        actorName: "정하늘",
        beforeQuantity: 14,
        afterQuantity: 0,
        memo: "공장 자체 행사",
        createdAt: nowIso()
      }
    ],
    changeRequests: [
      {
        id: ids.requests[0],
        type: "late_quantity",
        status: "pending",
        clientId: ids.clients[2],
        orderId: orders[2].id,
        mealTypeId: ids.lunch,
        date,
        currentQuantity: 32,
        requestedQuantity: 27,
        memo: "외근 인원 발생",
        requestedAt: nowIso()
      }
    ],
    holidays: [],
    monthlyAdjustments: [],
    notifications: [
      {
        id: ids.notifications[0],
        target: "admin",
        clientId: ids.clients[3],
        title: "식사 거절",
        body: "신성패키징이 오늘 점심 식사를 거절했습니다.",
        read: false,
        createdAt: nowIso()
      },
      {
        id: ids.notifications[1],
        target: "admin",
        clientId: ids.clients[2],
        title: "마감 후 변경 요청",
        body: "한빛사무동이 점심 32개에서 27개로 변경 요청했습니다.",
        read: false,
        createdAt: nowIso()
      }
    ],
    auditLogs: [],
    deliveryOverrides: {}
  };
}
