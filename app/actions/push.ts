"use server";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    "mailto:admin@bapsim.com",
    publicVapidKey,
    privateVapidKey
  );
}

export async function sendWebPushNotification(title: string, body: string, url: string = "/admin") {
  if (!publicVapidKey || !privateVapidKey) {
    console.warn("VAPID keys are not configured. Web Push is disabled.");
    return;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { data: subscriptions } = await supabase.from("push_subscriptions").select("*");

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    url,
    icon: "/bapsim-logo.png",
  });

  const promises = subscriptions.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, payload);
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription has expired or is no longer valid
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("Error sending push notification", error);
      }
    }
  });

  await Promise.allSettled(promises);
}
