"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { type AppStateDiff, saveAppStateDiffToSupabase } from "@/lib/supabase-state";
import { sendWebPushNotification } from "@/app/actions/push";

export async function syncAppStateDiffAction(diff: AppStateDiff) {
  const supabase = createSupabaseAdminClient();
  
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    await saveAppStateDiffToSupabase(supabase, diff);

    // Send push notifications for new admin notifications
    if (diff.notifications && diff.notifications.length > 0) {
      const newAdminNotifications = diff.notifications.filter(
        (n) => n.target === "admin" && !n.read
      );
      // Notify asynchronously but ensure we await it before returning so Vercel doesn't kill the worker
      await Promise.allSettled(
        newAdminNotifications.map((n) => sendWebPushNotification(n.title, n.body))
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to sync state diff:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown Supabase error" 
    };
  }
}
