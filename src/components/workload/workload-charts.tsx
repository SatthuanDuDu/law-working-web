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
  const chartMinWidth = Math.max(320, taskData.length * 56);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Số việc đang mở / quá hạn</CardTitle>
      </CardHeader>
      <CardContent className="min-h-80 h-[22rem] sm:h-80">
        <div className="-mx-2 overflow-x-auto px-2">
          <div style={{ minWidth: chartMinWidth, height: "100%" }} className="h-72 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={taskData}
                margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                <Tooltip />
                <Bar dataKey="open" fill="#152D4F" name="Đang mở" radius={4} />
                <Bar dataKey="overdue" fill="#ef4444" name="Quá hạn" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
