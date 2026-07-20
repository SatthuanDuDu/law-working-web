"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type WorkloadRow = {
  userId: string;
  name: string;
  department: string;
  openTasks: number;
  overdueTasks: number;
};

export function WorkloadCharts({ rows }: { rows: WorkloadRow[] }) {
  const sorted = [...rows]
    .filter((r) => r.openTasks > 0 || r.overdueTasks > 0)
    .sort(
      (a, b) =>
        b.openTasks + b.overdueTasks - (a.openTasks + a.overdueTasks),
    );

  const taskData = sorted.map((row) => ({
    name: row.name.split(" ").slice(-2).join(" ") || row.name,
    open: row.openTasks,
    overdue: row.overdueTasks,
  }));

  const chartHeight = Math.max(220, taskData.length * 36);

  if (taskData.length === 0) {
    return (
      <Card className="rounded-[5px]">
        <CardHeader>
          <CardTitle>Biểu đồ tải việc</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chưa có việc đang mở hoặc quá hạn.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[5px]">
      <CardHeader>
        <CardTitle>Biểu đồ tải việc</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-1 overflow-x-auto px-1">
          <div style={{ minWidth: 280, height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={taskData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" fill="#14532d" name="Đang mở" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="overdue" fill="#e11d48" name="Quá hạn" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
