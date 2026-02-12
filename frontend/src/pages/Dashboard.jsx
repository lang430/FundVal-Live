import React, { useState, useEffect } from 'react';

import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getAccountPositions, getFundDetail } from '../services/api';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard({ currentAccount }) {
  const [loading, setLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState(null);
  const [marketTrend, setMarketTrend] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [currentAccount]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get Positions
      const posData = await getAccountPositions(currentAccount);
      
      // Calculate total assets
      let totalValue = 0;
      let totalCost = 0;
      let dayChange = 0;
      const holdings = [];

      // Mock market trend data for the sparkly chart
      const mockTrend = Array.from({ length: 20 }, (_, i) => ({
        time: `${9 + Math.floor(i/4)}:${(i%4)*15}`,
        value: 3000 + Math.random() * 50 - 25
      }));
      setMarketTrend(mockTrend);

      if (posData && posData.positions) {
        // Enriched positions are already calculated by backend
        posData.positions.forEach(p => {
            totalValue += p.marketValue || 0;
            totalCost += p.cost || 0;
            // Estimate day change
            if (p.estRate) {
                dayChange += (p.marketValue * p.estRate / 100);
            }
            holdings.push(p);
        });
      }

      setPortfolioData({
        totalValue,
        totalCost,
        totalReturn: totalValue - totalCost,
        totalReturnRate: totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0,
        dayChange,
        dayChangeRate: totalValue > 0 ? (dayChange / totalValue * 100) : 0,
        holdings: holdings.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0)).slice(0, 5) // Top 5
      });

    } catch (e) {
      console.error("Dashboard load failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-slate-800/50 rounded-2xl"></div>
        ))}
      </div>
    );
  }

  const { totalValue, totalReturn, totalReturnRate, dayChange, dayChangeRate, holdings } = portfolioData || {};
  const isPositive = dayChange >= 0;

  return (
    <div className="space-y-8">
      {/* 1. Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Assets */}
        <div 
          className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-500"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-blue-100 mb-1">
              <WalletIcon className="w-5 h-5" />
              <span className="font-medium">总资产</span>
            </div>
            <div className="text-4xl font-bold tracking-tight mb-4">
              ¥ {totalValue?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-4 text-sm">
                <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    今日 {dayChange > 0 ? '+' : ''}{dayChange?.toFixed(2)}
                </div>
                <div className={`${dayChangeRate >= 0 ? 'text-green-300' : 'text-red-300'} font-medium flex items-center`}>
                    {dayChangeRate >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {Math.abs(dayChangeRate)?.toFixed(2)}%
                </div>
            </div>
          </div>
        </div>

        {/* Total Return */}
        <div 
          className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Activity className="w-5 h-5" />
              <span>累计收益</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${totalReturn >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {totalReturnRate?.toFixed(2)}%
            </span>
          </div>
          <div className={`text-3xl font-bold mb-2 ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalReturn > 0 ? '+' : ''}{totalReturn?.toLocaleString()}
          </div>
          
          {/* Mini Chart */}
          <div className="h-16 mt-4 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marketTrend}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div 
          className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-3xl p-6 flex flex-col justify-center gap-4"
        >
          <h3 className="text-slate-400 font-medium mb-2">快捷操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-slate-700/50 hover:bg-blue-600 hover:text-white transition-all group">
                <div className="bg-slate-600/50 p-2 rounded-lg group-hover:bg-white/20">
                    <ArrowUpRight className="w-5 h-5" />
                </div>
                <span className="font-medium">记账</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-slate-700/50 hover:bg-indigo-600 hover:text-white transition-all group">
                <div className="bg-slate-600/50 p-2 rounded-lg group-hover:bg-white/20">
                    <PieChart className="w-5 h-5" />
                </div>
                <span className="font-medium">分析</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Positions */}
      <div
      >
        <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-500" />
            重仓基金表现
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {holdings?.map((fund, index) => (
                <div key={fund.code} className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="font-bold text-lg text-slate-200 group-hover:text-blue-400 transition-colors truncate max-w-[180px]">
                                {fund.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">{fund.code}</div>
                        </div>
                        <div className={`text-lg font-bold ${fund.estRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fund.estRate > 0 ? '+' : ''}{fund.estRate}%
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-slate-500 text-xs mb-1">持仓金额</div>
                            <div className="font-medium text-slate-300">¥{fund.marketValue?.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                             <div className="text-slate-500 text-xs mb-1">持有收益</div>
                             <div className={`font-medium ${fund.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fund.totalReturn > 0 ? '+' : ''}{fund.totalReturn?.toFixed(2)}%
                             </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function WalletIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
