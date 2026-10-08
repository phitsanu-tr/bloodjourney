import React from "react";

export const YearAreaChart = React.lazy(() => import("recharts").then((R) => ({
  default: function YearAreaChart({ data }) {
    return (
      <R.ResponsiveContainer width="100%" height="100%">
        <R.AreaChart data={data} margin={{ top: 22, right: 12, left: -20, bottom: 0 }} accessibilityLayer={false}>
          <defs>
            <linearGradient id="yearAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9A3B33" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#9A3B33" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <R.CartesianGrid strokeDasharray="3 3" stroke="#EEDEDA" vertical={false} />
          <R.XAxis dataKey="year" tick={{ fontSize: 11, fill: "#7A6360" }} axisLine={{ stroke: "#EEDEDA" }} tickLine={false} padding={{ left: 16, right: 16 }} />
          <R.YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7A6360" }} axisLine={false} tickLine={false} width={24} />
          <R.Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EEDEDA" }} formatter={(v) => [`${v} ครั้ง`, ""]} labelFormatter={(l) => `ปี ${l}`} />
          <R.Area type="monotone" dataKey="count" stroke="#9A3B33" strokeWidth={2.5} fill="url(#yearAreaGrad)" dot={{ r: 4, fill: "#9A3B33", strokeWidth: 0 }} activeDot={{ r: 5 }}>
            {/* The count on each point -- the left axis is mostly hidden, so without this nobody could read the numbers. */}
            <R.LabelList dataKey="count" position="top" offset={8} style={{ fontSize: 11, fill: "#5C4A46", fontWeight: 600 }} />
          </R.Area>
        </R.AreaChart>
      </R.ResponsiveContainer>
    );
  },
})));
