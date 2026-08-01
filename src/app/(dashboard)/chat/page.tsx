import dynamic from "next/dynamic";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { requireAuth } from "@/lib/session";
import { getTranslations } from "next-intl/server";

const ChatWorkspace = dynamic(
  () =>
    import("@/components/chat/chat-workspace").then((m) => m.ChatWorkspace),
  {
    loading: () => (
      <div className="h-[calc(var(--vv-height,100dvh)-var(--page-header-offset,3.5rem)-0.75rem)] min-h-[24rem] -mb-3 animate-pulse rounded-md bg-muted sm:h-[calc(var(--vv-height,100dvh)-var(--page-header-offset,3.5rem)-1.5rem)] sm:-mb-6 lg:h-[calc(var(--vv-height,100dvh)-var(--page-header-offset,3.5rem)-2rem)] lg:-mb-8" />
    ),
  },
);

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
      <PageHeaderSlot title={tPages("title")} />
      <ChatWorkspace initialConversationId={params.c ?? null} />
    </>
  );
}
