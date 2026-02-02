import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Hide small labels

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const PortfolioChart = ({ positions }) => {
  if (!positions || positions.length === 0) return null;

  // Group by 'type' (sector)
  // Logic: Use existing 'type' from fund info, or infer.
  // Since 'positions' from backend currently might not have 'type', we might need to rely on 'name' grouping or update backend.
  // Wait, `get_all_positions` calls `get_combined_valuation` which returns `type`. 
  // Let's verify backend response structure. `services/account.py` calls `get_combined_valuation`.
  // `get_combined_valuation` returns `type: sector` based on `MAJOR_CATEGORIES`.
  // Wait, `get_fund_intraday` does the sector logic, `get_combined_valuation` only does prices.
  // **CRITICAL FIX**: `account.py` needs to populate `type`.

  // Assuming backend will be fixed to provide 'type'. 
  // For now, let's group by `name` keywords as a fallback or if `type` is missing.
  
  // Let's group by type if available, otherwise by name keywords (mock logic for now).
  const dataMap = {};
  
  positions.forEach(p => {
    // Fallback classification if backend type is missing
    let type = p.type || "其他";
    
    // Simple frontend classification fallback
    if (!p.type) {
        if (p.name.includes("债")) type = "债券";
        else if (p.name.includes("指数") || p.name.includes("ETF") || p.name.includes("股票")) type = "权益";
        else if (p.name.includes("货币")) type = "货币";
        else if (p.name.includes("QDII") || p.name.includes("美") || p.name.includes("纳斯达克")) type = "QDII";
        else type = "混合/其他";
    }

    if (!dataMap[type]) dataMap[type] = 0;
    dataMap[type] += p.market_value || p.est_market_value;
  });

  const data = Object.keys(dataMap).map(key => ({
    name: key,
    value: dataMap[key]
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-80 flex flex-col">
      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">资产分布</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
            <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
            >
                {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
            </Pie>
            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }}/>
            <Tooltip 
                formatter={(value) => `¥${value.toLocaleString()}`}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
