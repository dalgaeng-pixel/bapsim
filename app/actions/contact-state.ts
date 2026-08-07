"use server";

import { sendWebPushNotification } from "@/app/actions/push";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { type AppStateDiff, saveAppStateDiffToSupabase } from "@/lib/supabase-state";

type ClientActivityAction =
  | "client_change_before_cutoff"
  | "client_change_after_cutoff"
  | "client_overtime_change";

type ClientActivityRow = {
  id: string;
  action: ClientActivityAction;
  admin_name: string;
  target_label: string;
  detail: string;
};

function getKoreanClock(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function isPastKoreanCutoff(orderDate: string, cutoffTime: string, now: Date) {
  const koreanClock = getKoreanClock(now);
  if (orderDate < koreanClock.date) {
    return true;
  }
  if (orderDate > koreanClock.date) {
    return false;
  }

  const [hour, minute] = cutoffTime.split(":").map(Number);
  return koreanClock.minutes >= hour * 60 + minute;
}

function memoDetail(memo?: string) {
  const value = memo?.trim();
  return value ? ` · 메모: ${value}` : "";
}

const forbiddenKeys: Array<keyof AppStateDiff> = [
  "clients",
  "settlementAccounts",
  "contactAccessGroups",
  "contactAccessGroupMembers",
  "mealTypes",
  "defaultQuantities",
  "holidays",
  "monthlyAdjustments",
  "transactionStatementRemarks",
  "auditLogs",
  "deliveryOverrides"
];

function isAllowedContactDiff(diff: AppStateDiff, allowedClientIds: Set<string>) {
  if (forbiddenKeys.some((key) => diff[key] !== undefined)) {
    return false;
  }

  if (diff.deleted && Object.values(diff.deleted).some((ids) => ids && ids.length > 0)) {
    return false;
  }

  const clientIds = [
    ...(diff.orders ?? []).map((item) => item.clientId),
    ...(diff.overtimeMealEntries ?? []).map((item) => item.clientId),
    ...(diff.orderChangeLogs ?? []).map((item) => item.clientId),
    ...(diff.changeRequests ?? []).map((item) => item.clientId),
    ...(diff.notifications ?? []).flatMap((item) => item.clientId ? [item.clientId] : [])
  ];

  return clientIds.every((clientId) => allowedClientIds.has(clientId));
}

export async function syncContactAccessGroupDiffAction(
  inviteCode: string,
  invitePin: string,
  diff: AppStateDiff
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    const { data: group, error: groupError } = await supabase
      .from("contact_access_groups")
      .select("id, name, manager_name")
      .eq("invite_code", inviteCode)
      .eq("invite_pin", invitePin)
      .eq("status", "active")
      .maybeSingle();

    if (groupError || !group) {
      return { success: false, error: "Invalid contact access" };
    }

    const { data: members, error: memberError } = await supabase
      .from("contact_access_group_members")
      .select("client_id")
      .eq("contact_access_group_id", group.id);

    if (memberError) {
      return { success: false, error: memberError.message };
    }

    const allowedClientIds = new Set((members ?? []).map((member) => member.client_id));
    if (!isAllowedContactDiff(diff, allowedClientIds)) {
      return { success: false, error: "Unauthorized delivery location" };
    }

    const mealChanges = (diff.orderChangeLogs ?? []).filter((log) => log.actorType === "client");
    const lateMealRequests = (diff.changeRequests ?? []).filter(
      (request) => request.type === "late_quantity" || request.type === "late_rejection"
    );
    const overtimeEntries = diff.overtimeMealEntries ?? [];
    const overtimeNotifications = (diff.notifications ?? []).filter(
      (notification) => notification.title === "야근 인원 등록" || notification.title === "야근 인원 수정"
    );

    if (mealChanges.length || lateMealRequests.length || overtimeEntries.length) {
      const mealTypeIds = [
        ...new Set([
          ...mealChanges.map((log) => log.mealTypeId),
          ...lateMealRequests.flatMap((request) => request.mealTypeId ? [request.mealTypeId] : [])
        ])
      ];
      const memberClientIds = [...allowedClientIds];
      const { data: clientRows, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", memberClientIds);
      if (clientError) {
        return { success: false, error: clientError.message };
      }

      const mealRowsResult = mealTypeIds.length
        ? await supabase.from("meal_types").select("id, name, cutoff_time").in("id", mealTypeIds)
        : { data: [], error: null };
      if (mealRowsResult.error) {
        return { success: false, error: mealRowsResult.error.message };
      }

      const overtimeDates = [...new Set(overtimeEntries.map((entry) => entry.date))];
      const currentOvertimeResult = overtimeDates.length
        ? await supabase
          .from("overtime_meal_entries")
          .select("client_id, order_date, quantity")
          .in("client_id", memberClientIds)
          .in("order_date", overtimeDates)
        : { data: [], error: null };
      if (currentOvertimeResult.error) {
        return { success: false, error: currentOvertimeResult.error.message };
      }

      const clientNames = new Map((clientRows ?? []).map((client) => [client.id, client.name]));
      const mealTypes = new Map(
        (mealRowsResult.data ?? []).map((mealType) => [mealType.id, mealType])
      );
      const currentOvertime = new Map(
        (currentOvertimeResult.data ?? []).map((entry) => [
          `${entry.client_id}:${entry.order_date}`,
          entry.quantity
        ])
      );
      const serverReceivedAt = new Date();
      const actorName = group.manager_name?.trim() || group.name?.trim() || "거래처 담당자";
      const activityRows: ClientActivityRow[] = [];

      for (const log of mealChanges) {
        const mealType = mealTypes.get(log.mealTypeId);
        const cutoffTime = String(mealType?.cutoff_time ?? "10:00").slice(0, 5);
        const afterCutoff = isPastKoreanCutoff(log.date, cutoffTime, serverReceivedAt);
        activityRows.push({
          id: log.id,
          action: afterCutoff ? "client_change_after_cutoff" : "client_change_before_cutoff",
          admin_name: actorName,
          target_label: clientNames.get(log.clientId) ?? "거래처",
          detail: `${log.date} ${mealType?.name ?? "식사"} ${log.beforeQuantity}개 -> ${log.afterQuantity}개 · ${afterCutoff ? "마감 후 저장 시도" : "마감 전 저장"} (마감 ${cutoffTime})${memoDetail(log.memo)}`
        });
      }

      for (const request of lateMealRequests) {
        if (!request.mealTypeId || !request.date) {
          continue;
        }
        const mealType = mealTypes.get(request.mealTypeId);
        const cutoffTime = String(mealType?.cutoff_time ?? "10:00").slice(0, 5);
        const afterCutoff = isPastKoreanCutoff(request.date, cutoffTime, serverReceivedAt);
        activityRows.push({
          id: request.id,
          action: afterCutoff ? "client_change_after_cutoff" : "client_change_before_cutoff",
          admin_name: actorName,
          target_label: clientNames.get(request.clientId) ?? "거래처",
          detail: `${request.date} ${mealType?.name ?? "식사"} ${request.currentQuantity ?? 0}개 -> ${request.requestedQuantity ?? 0}개 · ${afterCutoff ? "마감 후 변경 요청" : "마감 전 변경 요청"} (마감 ${cutoffTime})${memoDetail(request.memo)}`
        });
      }

      for (const entry of overtimeEntries) {
        const sourceNotification = overtimeNotifications.find(
          (notification) => notification.clientId === entry.clientId
        );
        if (!sourceNotification) {
          continue;
        }
        const beforeQuantity = currentOvertime.get(`${entry.clientId}:${entry.date}`);
        activityRows.push({
          id: sourceNotification.id,
          action: "client_overtime_change",
          admin_name: actorName,
          target_label: clientNames.get(entry.clientId) ?? "거래처",
          detail: beforeQuantity === undefined
            ? `${entry.date} 야근 석식 ${entry.quantity}명 등록`
            : `${entry.date} 야근 석식 ${beforeQuantity}명 -> ${entry.quantity}명`
        });
      }

      if (activityRows.length) {
        const { error: activityError } = await supabase
          .from("admin_audit_logs")
          .upsert(activityRows, { onConflict: "id", ignoreDuplicates: true });
        if (activityError) {
          return { success: false, error: activityError.message };
        }
      }
    }

    await saveAppStateDiffToSupabase(supabase, {
      ...diff,
      groupStorageReady: false,
      settlementPricingStorageReady: false
    });

    const adminNotifications = (diff.notifications ?? []).filter(
      (notification) => notification.target === "admin" && !notification.read
    );
    await Promise.allSettled(
      adminNotifications.map((notification) => sendWebPushNotification(notification.title, notification.body))
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to sync contact access group diff:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown Supabase error"
    };
  }
}
