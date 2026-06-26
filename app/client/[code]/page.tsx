import { notFound } from "next/navigation";
import { ClientApp } from "@/components/client-app";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const { code } = resolvedParams;
  
  const supabase = createSupabaseAdminClient();
  const rawState = supabase ? await loadAppStateFromSupabase(supabase) : undefined;
  
  if (!rawState) {
    return <ClientApp />;
  }

  // Find the specific client by inviteCode
  const client = rawState.clients.find(c => c.inviteCode === code);
  if (!client) {
    notFound();
  }

  // Filter the state to ONLY include this client's data!
  const filteredState = {
    ...rawState,
    clients: [client],
    defaultQuantities: rawState.defaultQuantities.filter(q => q.clientId === client.id),
    orders: rawState.orders.filter(o => o.clientId === client.id),
    orderChangeLogs: rawState.orderChangeLogs.filter(l => l.clientId === client.id),
    changeRequests: rawState.changeRequests.filter(r => r.clientId === client.id),
    holidays: rawState.holidays.filter(h => h.clientId === client.id || !h.clientId), // Global holidays don't have clientId
    notifications: rawState.notifications.filter(n => n.clientId === client.id && n.target === "client"),
    auditLogs: [], // Clients don't need admin audit logs
    deliveryOverrides: {} // Clients don't need to know delivery routes of others
  };

  return <ClientApp initialState={filteredState} />;
}
