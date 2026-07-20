"use server";

import { sendWebPushNotification } from "@/app/actions/push";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { type AppStateDiff, saveAppStateDiffToSupabase } from "@/lib/supabase-state";

const forbiddenKeys: Array<keyof AppStateDiff> = [
  "clients",
  "settlementAccounts",
  "contactAccessGroups",
  "contactAccessGroupMembers",
  "mealTypes",
  "defaultQuantities",
  "holidays",
  "monthlyAdjustments",
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
      .select("id")
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