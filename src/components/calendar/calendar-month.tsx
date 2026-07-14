"use client";

import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

type CalendarTask = {
  id: string;
  title: string;
  dueDate: string;
  status: keyof typeof TASK_STATUS_LABELS;
  priority: keyof typeof TASK_PRIORITY_LABELS;
  assigneeName: string;
  matterCode?: string | null;
};

export function CalendarMonth({
  tasks,
  showAllFilter,
  scope,
}: {
  tasks: CalendarTask[];
  showAllFilter: boolean;
  scope: "mine" | "all";
}) {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthTasks = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return tasks.filter((task) => {
      const due = new Date(task.dueDate);
      return due >= start && due <= end;
    });
  }, [tasks, month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of monthTasks) {
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [monthTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-48 text-center text-lg font-semibold capitalize text-primary">
            {format(month, "MMMM yyyy", { locale: vi })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {showAllFilter && (
          <div className="flex rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={scope === "mine" ? "default" : "ghost"}
              onClick={() => router.push("/calendar?scope=mine")}
            >
              Của tôi
            </Button>
            <Button
              size="sm"
              variant={scope === "all" ? "default" : "ghost"}
              onClick={() => router.push("/calendar?scope=all")}
            >
              Tất cả
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-slate-500">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];

              return (
                <div
                  key={key}
                  className={`min-h-28 rounded-lg border p-2 text-left ${
                    isSameMonth(day, month)
                      ? "border-border bg-white"
                      : "border-transparent bg-muted/50 text-slate-400"
                  } ${isSameDay(day, new Date()) ? "ring-2 ring-primary/40" : ""}`}
                >
                  <p className="text-xs font-semibold">{format(day, "d")}</p>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href="/tasks"
                        className="block truncate rounded bg-primary-muted px-1.5 py-0.5 text-[11px] text-primary hover:bg-accent-muted"
                        title={task.title}
                      >
                        {task.title}
                      </Link>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[10px] text-slate-500">+{dayTasks.length - 3} khác</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hạn trong tháng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monthTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Không có hạn nào trong tháng này.</p>
          ) : (
            monthTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Hạn {format(new Date(task.dueDate), "dd/MM/yyyy")} • {task.assigneeName}
                  {task.matterCode ? ` • ${task.matterCode}` : ""}
                </p>
                <Badge variant="warning" className="mt-2">
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
