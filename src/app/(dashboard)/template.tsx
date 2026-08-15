"use client";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-transition flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
