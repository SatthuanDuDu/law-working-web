"use client";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-transition">{children}</div>;
}
