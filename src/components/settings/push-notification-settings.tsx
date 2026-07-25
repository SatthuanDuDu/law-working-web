"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getExistingPushSubscription,
  isPushSupported,
  serializeSubscription,
  showLocalSystemNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type Status = {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
};

function subscribeNoop() {
  return () => undefined;
}

export function PushNotificationSettings() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => isPushSupported(),
    () => false,
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/push/subscription");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Status;
        const browserSub = await getExistingPushSubscription();
        if (cancelled) return;

        if (data.configured && browserSub && !data.subscribed) {
          const payload = serializeSubscription(browserSub);
          const syncRes = await fetch("/api/push/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!cancelled && syncRes.ok) {
            setStatus({ ...data, subscribed: true });
            return;
          }
        }

        setStatus({
          ...data,
          subscribed: Boolean(data.subscribed && browserSub),
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  async function refreshStatus() {
    try {
      const res = await fetch("/api/push/subscription");
      if (!res.ok) return;
      const data = (await res.json()) as Status;
      const browserSub = await getExistingPushSubscription();

      // Browser still has a subscription but DB lost it (e.g. after SW update) → re-sync.
      if (data.configured && browserSub && !data.subscribed) {
        const payload = serializeSubscription(browserSub);
        const syncRes = await fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (syncRes.ok) {
          setStatus({ ...data, subscribed: true });
          return;
        }
      }

      setStatus({
        ...data,
        subscribed: Boolean(data.subscribed && browserSub),
      });
    } catch {
      // ignore
    }
  }

  function handleEnable() {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        if (!status?.publicKey) {
          setError(t("pushNotConfigured"));
          return;
        }
        const subscription = await subscribeToPush(status.publicKey);
        const payload = serializeSubscription(subscription);
        const res = await fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(
            typeof data.error === "string" ? data.error : t("pushEnableFailed"),
          );
          return;
        }
        setMessage(t("pushEnabled"));
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pushEnableFailed"));
      }
    });
  }

  function handleDisable() {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const endpoint = await unsubscribeFromPush();
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpoint ? { endpoint } : {}),
        });
        setMessage(t("pushDisabled"));
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pushDisableFailed"));
      }
    });
  }

  function handleTestPopup() {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        // 1) Local SW notification — proves OS/browser permission without network.
        await showLocalSystemNotification({
          title: t("pushTestLocalTitle"),
          body: t("pushTestLocalBody"),
          url: "/settings",
          tag: "nslaw-local-test",
        });

        // 2) Server → FCM → SW push — proves end-to-end Web Push.
        const res = await fetch("/api/push/test", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            typeof data.error === "string" ? data.error : t("pushTestFailed"),
          );
          return;
        }
        setMessage(t("pushTestSent"));
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pushTestFailed"));
      }
    });
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("pushTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("pushUnsupported")}</p>
        </CardContent>
      </Card>
    );
  }

  const subscribed = Boolean(status?.subscribed);
  const configured = Boolean(status?.configured);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pushTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("pushHint")}</p>
        <p className="text-xs text-muted-foreground">{t("pushIosHint")}</p>
        <p className="text-xs text-muted-foreground">{t("pushBellVsOs")}</p>
        {!configured && status ? (
          <p className="text-sm text-amber-700">{t("pushNotConfigured")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {subscribed ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleDisable}
                className="interactive-press"
              >
                <BellOff className="h-4 w-4" />
                {isPending ? tCommon("saving") : t("pushDisable")}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isPending || !status}
                onClick={handleEnable}
                className="interactive-press"
              >
                <Bell className="h-4 w-4" />
                {isPending ? tCommon("saving") : t("pushEnable")}
              </Button>
            )}
            {subscribed ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleTestPopup}
                className="interactive-press"
              >
                <BellRing className="h-4 w-4" />
                {isPending ? tCommon("saving") : t("pushTest")}
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {subscribed ? t("pushStatusOn") : t("pushStatusOff")}
            </span>
          </div>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
