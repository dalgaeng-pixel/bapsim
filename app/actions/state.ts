"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { type AppStateDiff, saveAppStateDiffToSupabase } from "@/lib/supabase-state";

export async function syncAppStateDiffAction(diff: AppStateDiff) {
  const supabase = createSupabaseAdminClient();
  
  if (!supabase) {
    return { success: false, error: "Supabase client not configured" };
  }

  try {
    await saveAppStateDiffToSupabase(supabase, diff);
    return { success: true };
  } catch (error) {
    console.error("Failed to sync state diff:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown Supabase error" 
    };
  }
}
