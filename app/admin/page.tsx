import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (!token || token.value !== "authenticated") {
    redirect("/admin/login");
  }

  const supabase = createSupabaseAdminClient();
  const initialState = supabase ? await loadAppStateFromSupabase(supabase) : undefined;
  
  return <AdminDashboard initialState={initialState} />;
}
