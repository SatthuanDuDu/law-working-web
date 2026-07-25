/* NSLAW Web Push service worker — kept vanilla JS for broad browser support. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function absoluteUrl(path) {
  try {
    return new URL(path, self.registration.scope).href;
  } catch {
    return path;
  }
}

function parsePushData(event) {
  let data = {
    title: "NSLAW",
    body: "Bạn có thông báo mới",
    url: "/dashboard",
    tag: "nslaw-notification",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) data.body = text;
    } catch {
      // keep defaults
    }
  }
  return data;
}

async function notifyOpenClients(data) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({
      type: "NSLAW_NOTIFICATION",
      payload: {
        title: data.title,
        message: data.body,
        link: data.url || "/dashboard",
        tag: data.tag,
        notificationId: data.notificationId || null,
      },
    });
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const targetUrl = data.url || "/dashboard";

  event.waitUntil(
    Promise.all([
      notifyOpenClients(data),
      self.registration.showNotification(data.title || "NSLAW", {
        body: data.body || "",
        icon: absoluteUrl("/icon-192.png"),
        badge: absoluteUrl("/favicon.png"),
        tag: data.tag || "nslaw-notification",
        renotify: true,
        requireInteraction: false,
        data: { url: targetUrl },
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/dashboard";
  const targetUrl = absoluteUrl(rawUrl);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
            } catch {
              // ignore navigate failures
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
