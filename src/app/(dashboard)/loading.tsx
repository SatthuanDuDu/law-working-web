export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-md bg-white/80" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="h-28 rounded-md bg-white/80" />
        <div className="h-28 rounded-md bg-white/80" />
        <div className="h-28 rounded-md bg-white/80" />
      </div>
      <div className="h-64 rounded-md bg-white/80" />
    </div>
  );
}
