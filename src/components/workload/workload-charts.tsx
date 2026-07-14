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
  weekHours: number;
  monthHours: number;
  openTasks: number;
  overdueTasks: number;
};

export function WorkloadCharts({ rows }: { rows: WorkloadRow[] }) {
  const hoursData = rows.map((row) => ({
    name: row.name.split(" ").slice(-2).join(" ") || row.name,
    week: Number(row.weekHours.toFixed(1)),
    month: Number(row.monthHours.toFixed(1)),
  }));

  const taskData = rows.map((row) => ({
    name: row.name.split(" ").slice(-2).join(" ") || row.name,
    open: row.openTasks,
    overdue: row.overdueTasks,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Giờ làm theo nhân viên</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hoursData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="week" fill="#152D4F" name="Tuần này (giờ)" radius={4} />
              <Bar dataKey="month" fill="#3b82c4" name="Tháng này (giờ)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
    </div>
  );
}
