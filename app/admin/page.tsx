import { AdminDashboard } from "@/components/admin-dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createSupabaseAdminClient();
  const initialState = supabase ? await loadAppStateFromSupabase(supabase) : undefined;
  
  return <AdminDashboard initialState={initialState} />;
}
