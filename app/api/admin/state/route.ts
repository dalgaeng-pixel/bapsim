import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_token")?.value !== "authenticated") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ configured: false, mode: "local" });
  }

  try {
    const state = await loadAppStateFromSupabase(supabase);
    return NextResponse.json(
      { configured: true, mode: "supabase", state },
      { headers: { "Cache-Control": "no-store" } }
    );
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