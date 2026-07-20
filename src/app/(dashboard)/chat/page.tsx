import dynamic from "next/dynamic";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { requireAuth } from "@/lib/session";
import { getTranslations } from "next-intl/server";

const ChatWorkspace = dynamic(
  () =>
    import("@/components/chat/chat-workspace").then((m) => m.ChatWorkspace),
  {
    loading: () => (
      <div className="h-[min(70vh,36rem)] animate-pulse rounded-md bg-muted" />
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
      <PageHeaderSlot title={tPages("title")} description={tPages("description")} />
      <ChatWorkspace initialConversationId={params.c ?? null} />
    </>
  );
}
