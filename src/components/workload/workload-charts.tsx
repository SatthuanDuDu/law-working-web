"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkloadRow = {
  userId: string;
  name: string;
  department: string;
  openTasks: number;
  overdueTasks: number;
};

export function WorkloadCharts({ rows }: { rows: WorkloadRow[] }) {
  const taskData = rows.map((row) => ({
    name: row.name.split(" ").slice(-2).join(" ") || row.name,
    open: row.openTasks,
    overdue: row.overdueTasks,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Số việc đang mở / quá hạn</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={taskData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="open" fill="#152D4F" name="Đang mở" radius={4} />
            <Bar dataKey="overdue" fill="#ef4444" name="Quá hạn" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
