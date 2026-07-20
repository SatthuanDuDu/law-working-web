"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/utils";

import type { Notification } from "@prisma/client";

export function NotificationList({
  notifications,
}: {
  notifications: Notification[];
}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("title")}</CardTitle>
        <Button variant="outline" size="sm" disabled={isPending} onClick={markAllRead}>
          {t("markAllRead")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg border p-4 ${notification.isRead ? "bg-surface" : "bg-primary-muted border-primary/20"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(notification.createdAt, locale)}
                  </p>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="interactive-link mt-2 inline-block text-sm text-primary"
                      onClick={() => markRead(notification.id)}
                    >
                      {tCommon("details")}
                    </Link>
                  )}
                </div>
                {!notification.isRead && (
                  <Badge variant="warning">{t("unread")}</Badge>
                )}
              </div>
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  disabled={isPending}
                  onClick={() => markRead(notification.id)}
                >
                  {t("markAllRead")}
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
