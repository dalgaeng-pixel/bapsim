import { ClientApp } from "@/components/client-app";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const supabase = createSupabaseAdminClient();
  const initialState = supabase ? await loadAppStateFromSupabase(supabase) : undefined;
  
  return <ClientApp initialState={initialState} />;
}
