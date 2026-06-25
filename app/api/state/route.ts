import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase, saveAppStateToSupabase } from "@/lib/supabase-state";
import type { AppState } from "@/lib/types";

export const dynamic = "force-static";

export async function GET() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      mode: "local"
    });
  }

  try {
    const state = await loadAppStateFromSupabase(supabase);
    return NextResponse.json({
      configured: true,
      mode: "supabase",
      hasData: state.clients.length > 0 || state.mealTypes.length > 0,
      state
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        mode: "supabase-error",
        message: error instanceof Error ? error.message : "Unknown Supabase error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      synced: false
    });
  }

  try {
    const state = (await request.json()) as AppState;
    await saveAppStateToSupabase(supabase, state);
    return NextResponse.json({
      configured: true,
      synced: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        synced: false,
        message: error instanceof Error ? error.message : "Unknown Supabase error"
      },
      { status: 500 }
    );
  }
}
