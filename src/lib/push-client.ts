"use client";

const SW_PATH = "/sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  // Scope is `/` for `/sw.js`; look up by document URL, not script path.
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });
  }
  await navigator.serviceWorker.ready;
  return registration;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const registration = await ensureServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const registration = await ensureServiceWorker();
  if (!registration) {
    throw new Error("Trình duyệt không hỗ trợ thông báo đẩy.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Bạn đã từ chối quyền thông báo trên trình duyệt.");
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      vapidPublicKey,
    ) as BufferSource,
  });
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

/** Show a system notification immediately via the service worker (no network). */
export async function showLocalSystemNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  const registration = await ensureServiceWorker();
  if (!registration) {
    throw new Error("Service worker chưa sẵn sàng.");
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Bạn đã từ chối quyền thông báo trên trình duyệt.");
    }
  }
  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/favicon.png",
    tag: payload.tag || "nslaw-local-test",
    data: { url: payload.url || "/dashboard" },
  });
}

export function serializeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: {
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
  };
}
