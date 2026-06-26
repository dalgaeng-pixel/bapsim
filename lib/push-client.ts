export async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert(
      "카카오톡 등 일부 브라우저에서는 푸시 알림을 지원하지 않습니다.\n\n" +
      "알림을 받으시려면 아이폰은 Safari, 안드로이드는 Chrome 브라우저로 접속한 뒤 '홈 화면에 추가(앱 설치)'를 진행해주세요."
    );
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("푸시 알림 권한이 차단되었습니다.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.error("VAPID public key is missing");
        return false;
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

    alert("알림 설정이 완료되었습니다! 주문 변경 시 알림을 받습니다.");
    return true;
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    alert("알림 설정 중 오류가 발생했습니다.");
    return false;
  }
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
