import { Suspense } from "react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { requireAuth } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  await requireAuth();
  const tPages = await getTranslations("pages.chat");
  const params = await searchParams;

  return (
    <>
      <PageHeaderSlot title={tPages("title")} description={tPages("description")} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
        <ChatWorkspace initialConversationId={params.c ?? null} />
      </Suspense>
    </>
  );
}
