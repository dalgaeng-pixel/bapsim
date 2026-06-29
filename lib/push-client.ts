export type PushNotificationStatus = "unsupported" | "blocked" | "off" | "on";

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function blockedMessage() {
  return (
    "브라우저 알림 권한이 차단되어 앱에서 바로 켤 수 없습니다.\n\n" +
    "주소창 왼쪽의 자물쇠/사이트 설정을 누른 뒤 알림 권한을 '허용'으로 바꾸고 다시 눌러주세요."
  );
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (!isPushSupported()) {
    return "unsupported";
  }

  if (Notification.permission === "denied") {
    return "blocked";
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    alert(
      "카카오톡 등 일부 브라우저에서는 푸시 알림을 지원하지 않습니다.\n\n" +
      "알림을 받으시려면 아이폰은 Safari, 안드로이드는 Chrome 브라우저로 접속한 뒤 '홈 화면에 추가(앱 설치)'를 진행해주세요."
    );
    return "unsupported" satisfies PushNotificationStatus;
  }

  if (Notification.permission === "denied") {
    alert(blockedMessage());
    return "blocked" satisfies PushNotificationStatus;
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();

  if (permission !== "granted") {
    return "off" satisfies PushNotificationStatus;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.error("VAPID public key is missing");
        alert("알림 설정값이 아직 배포 환경에 등록되지 않았습니다.");
        return "off" satisfies PushNotificationStatus;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      throw new Error("Failed to save subscription to server");
    }

    alert("알림이 켜졌습니다. 주문 변경 시 알림을 받습니다.");
    return "on" satisfies PushNotificationStatus;
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    alert("알림 설정 중 오류가 발생했습니다.");
    return getPushNotificationStatus();
  }
}

export async function disablePushNotifications() {
  if (!isPushSupported()) {
    return "unsupported" satisfies PushNotificationStatus;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return "off" satisfies PushNotificationStatus;
    }

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch((error) => {
      console.error("Failed to remove push subscription from server:", error);
    });

    await subscription.unsubscribe();
    alert("알림이 꺼졌습니다.");
    return "off" satisfies PushNotificationStatus;
  } catch (error) {
    console.error("Error disabling push notifications:", error);
    alert("알림 해제 중 오류가 발생했습니다.");
    return getPushNotificationStatus();
  }
}

export async function togglePushNotifications() {
  const status = await getPushNotificationStatus();

  if (status === "on") {
    return disablePushNotifications();
  }

  if (status === "blocked") {
    alert(blockedMessage());
    return status;
  }

  if (status === "unsupported") {
    alert(
      "현재 브라우저에서는 푸시 알림을 지원하지 않습니다.\n\n" +
      "Chrome, Edge, Safari 같은 일반 브라우저에서 앱을 열어주세요."
    );
    return status;
  }

  return enablePushNotifications();
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
