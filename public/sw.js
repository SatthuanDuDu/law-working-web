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
  const clientsList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clientsList) {
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
  return clientsList;
}

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const targetUrl = data.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await notifyOpenClients(data);
      const hasFocusedVisible = clientsList.some(
        (client) => client.visibilityState === "visible" && client.focused,
      );

      // Chrome requires a notification for userVisibleOnly pushes. When the app
      // tab is already focused, prefer the in-app toast and immediately close a
      // silent system notification so users do not get a duplicate OS banner.
      if (hasFocusedVisible) {
        const silentTag = `nslaw-silent:${data.tag || "notification"}`;
        await self.registration.showNotification(data.title || "NSLAW", {
          body: data.body || "",
          tag: silentTag,
          silent: true,
          renotify: false,
          requireInteraction: false,
          data: { url: targetUrl },
        });
        const notes = await self.registration.getNotifications({
          tag: silentTag,
        });
        for (const note of notes) note.close();
        return;
      }

      await self.registration.showNotification(data.title || "NSLAW", {
        body: data.body || "",
        icon: absoluteUrl("/icon-192.png"),
        badge: absoluteUrl("/favicon.png"),
        tag: data.tag || "nslaw-notification",
        renotify: true,
        requireInteraction: false,
        data: { url: targetUrl },
      });
    })(),
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
        if (!("focus" in client)) continue;
        await client.focus();
        // Chrome mobile often ignores Client.navigate for SPA tabs — message the page.
        client.postMessage({
          type: "NSLAW_NAVIGATE",
          url: targetUrl,
        });
        return;
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
