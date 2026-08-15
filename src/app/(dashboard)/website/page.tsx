import Link from "next/link";
import { Eye, FileText, Inbox, Scale, TrendingUp, Users } from "lucide-react";

import { cmsDb } from "@/lib/cms-db";
import { getTrafficSummary } from "@/lib/cms-traffic";

export default async function WebsiteDashboardPage() {
  const [inquiryNew, inquiryTotal, areas, lawyers, posts, traffic] = await Promise.all([
    cmsDb.contactInquiry.count({ where: { status: "NEW" } }),
    cmsDb.contactInquiry.count(),
    cmsDb.practiceArea.count(),
    cmsDb.lawyer.count(),
    cmsDb.post.count(),
    getTrafficSummary(),
  ]);

  const cards = [
    {
      href: "/website/inquiries",
      label: "Yêu cầu mới",
      value: inquiryNew,
      hint: `${inquiryTotal} tổng cộng`,
      icon: Inbox,
    },
    {
      href: "/website/traffic",
      label: "Lượt xem hôm nay",
      value: traffic.today,
      hint: `${traffic.last7Days} trong 7 ngày qua`,
      icon: Eye,
    },
    {
      href: "/website/practice-areas",
      label: "Lĩnh vực hành nghề",
      value: areas,
      icon: Scale,
    },
    {
      href: "/website/lawyers",
      label: "Luật sư",
      value: lawyers,
      icon: Users,
    },
    {
      href: "/website/posts",
      label: "Bài viết",
      value: posts,
      icon: FileText,
    },
  ];

  const recent = await cmsDb.contactInquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      practiceArea: {
        include: { translations: { where: { locale: "vi" }, take: 1 } },
      },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan Website</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nội dung website công khai NSLAW. Tài khoản nhân sự vẫn quản lý ở đây —
          các mục dưới điều khiển nội dung hiển thị trên trang public.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="interactive-press rounded-md border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">{card.value}</p>
              {"hint" in card && card.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              ) : null}
            </Link>
          );
        })}
      </div>

      <section className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            Yêu cầu tư vấn gần đây
          </h2>
          <Link
            href="/website/inquiries"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {recent.length === 0 ? (
            <li className="px-5 py-8 text-sm text-muted-foreground">
              Chưa có yêu cầu nào.
            </li>
          ) : (
            recent.map((item) => (
              <li key={item.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground">{item.fullName}</p>
                  <span className="text-xs text-muted-foreground">
                    {item.createdAt.toLocaleString("vi-VN")}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {item.email} · {item.phone}
                  {item.practiceArea?.translations[0]
                    ? ` · ${item.practiceArea.translations[0].name}`
                    : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-foreground/80">{item.message}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
