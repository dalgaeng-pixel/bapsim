import { notFound } from "next/navigation";
import { ClientApp } from "@/components/client-app";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadAppStateFromSupabase } from "@/lib/supabase-state";
import { filterStateForContactAccessGroup } from "@/lib/contact-groups";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return {
    manifest: `/api/manifest?code=${code}`
  };
}

export default async function ClientPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const { code } = resolvedParams;
  
  const supabase = createSupabaseAdminClient();
  const rawState = supabase ? await loadAppStateFromSupabase(supabase) : undefined;
  
  if (!rawState) {
    return <ClientApp />;
  }

  const contactAccessGroup = rawState.contactAccessGroups.find(
    (group) => group.inviteCode === code && group.status === "active"
  );
  if (!contactAccessGroup) {
    notFound();
  }

  // The customer bundle only contains locations explicitly assigned to this contact group.
  const filteredState = filterStateForContactAccessGroup(rawState, contactAccessGroup.id);
  if (filteredState.clients.length === 0) {
    notFound();
  }

  return <ClientApp initialState={filteredState} contactAccessGroup={rawState.groupStorageReady ? contactAccessGroup : undefined} />;
}
