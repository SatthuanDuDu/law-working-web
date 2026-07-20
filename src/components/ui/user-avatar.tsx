"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

const SIZE_CLASS = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-lg",
} as const;

function AvatarShell({
  name,
  size,
  className,
  children,
}: {
  name: string;
  size: keyof typeof SIZE_CLASS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-muted font-semibold text-primary",
        SIZE_CLASS[size],
        className,
      )}
      title={name}
    >
      {children}
    </span>
  );
}

function AvatarPhoto({
  userId,
  name,
  avatarKey,
  size,
  className,
}: {
  userId: string;
  name: string;
  avatarKey: string;
  size: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cacheKey = avatarKey.slice(-16);

  if (failed) {
    return (
      <AvatarShell name={name} size={size} className={className}>
        <span aria-hidden>{initialsFromName(name)}</span>
      </AvatarShell>
    );
  }

  return (
    <AvatarShell name={name} size={size} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/users/${userId}/avatar?v=${encodeURIComponent(cacheKey)}`}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </AvatarShell>
  );
}

export function UserAvatar({
  userId,
  name,
  avatarKey,
  size = "sm",
  className,
}: {
  userId: string;
  name: string;
  avatarKey?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  if (!avatarKey) {
    return (
      <AvatarShell name={name} size={size} className={className}>
        <span aria-hidden>{initialsFromName(name)}</span>
      </AvatarShell>
    );
  }

  return (
    <AvatarPhoto
      key={avatarKey}
      userId={userId}
      name={name}
      avatarKey={avatarKey}
      size={size}
      className={className}
    />
  );
}
