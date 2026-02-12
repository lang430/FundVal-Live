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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Hero Cards */}
      {/* 1. Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Assets - Compact Premium Card */}
        <div 
          className="relative rounded-[1.5rem] p-6 text-white shadow-xl shadow-blue-500/20 overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-1"
        >
          {/* Advanced Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700"></div>
          
          {/* Decorative Orbs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-16 blur-2xl group-hover:bg-white/20 transition-all duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/30 rounded-full translate-y-16 -translate-x-8 blur-xl group-hover:bg-indigo-400/30 transition-all duration-1000"></div>
          
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>

          <div className="relative z-10 flex flex-col h-full justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-100 mb-1">
                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/10 shadow-inner">
                  <WalletIcon className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm opacity-90">总资产</span>
              </div>
              <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">
                ¥ {(totalValue || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-50">今日</span>
                    <span className="text-sm font-bold text-white">
                        {(dayChange || 0) > 0 ? '+' : ''}{(dayChange || 0).toFixed(2)}
                    </span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-sm flex items-center ${(!dayChangeRate || dayChangeRate >= 0) ? 'bg-emerald-400/20 text-emerald-50' : 'bg-rose-400/20 text-rose-50'}`}>
                    {(!dayChangeRate || dayChangeRate >= 0) ? <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-1.5" />}
                    <span className="font-bold text-sm">{Math.abs(dayChangeRate || 0).toFixed(2)}%</span>
                </div>
            </div>
          </div>
        </div>

        {/* Total Return - Compact Light Glass Card */}
        <div 
          className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-[1.5rem] p-6 relative overflow-hidden shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-500">
                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-slate-200 transition-colors">
                    <Activity className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-700">累计收益</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${(!totalReturn || totalReturn >= 0) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                成立以来
                </span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${(!totalReturn || totalReturn >= 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(totalReturn || 0) > 0 ? '+' : ''}{(totalReturn || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="mt-3 flex items-center gap-2 relative z-10">
               <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${(!totalReturnRate || totalReturnRate >= 0) ? 'bg-emerald-100/50 text-emerald-700' : 'bg-rose-100/50 text-rose-700'}`}>
                 {(totalReturnRate || 0).toFixed(2)}%
               </span>
               <span className="text-xs text-slate-400">总收益率</span>
          </div>
          
          {/* Mini Chart */}
          <div className="absolute bottom-0 left-0 right-0 h-16 opacity-40 mask-image-gradient pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marketTrend}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    fill="url(#colorValue)" 
                    dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions - Compact Light Card */}
        <div 
          className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-[1.5rem] p-6 flex flex-col gap-4 shadow-lg shadow-slate-200/50"
        >
          <h3 className="text-slate-800 font-bold flex items-center gap-2 text-sm">
            <span className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
            快捷操作
          </h3>
          <div className="grid grid-cols-2 gap-3 h-full">
            <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/10 transition-all group duration-300">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-100">
                    <ArrowUpRight className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-slate-600 group-hover:text-blue-600 transition-colors">记一笔</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/10 transition-all group duration-300">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100">
                    <Activity className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-slate-600 group-hover:text-indigo-600 transition-colors">分析</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Positions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-blue-600 shadow-sm">
                <PieChart className="w-5 h-5" />
            </div>
            重仓基金表现
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {holdings?.map((fund, index) => (
                <div 
                    key={fund.code} 
                    className="bg-white/90 backdrop-blur-sm border border-white/50 rounded-[1.5rem] p-6 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full -translate-y-16 translate-x-12 group-hover:bg-blue-50/50 transition-colors duration-500"></div>

                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex-1 mr-4">
                            <div className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                {fund.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-md font-mono font-medium group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    {fund.code}
                                </span>
                            </div>
                        </div>
                        <div className={`text-xl font-bold ${fund.estRate >= 0 ? 'text-rose-500 bg-rose-50 border border-rose-100' : 'text-emerald-500 bg-emerald-50 border border-emerald-100'} px-3 py-1.5 rounded-xl transition-colors`}>
                            {fund.estRate > 0 ? '+' : ''}{fund.estRate}%
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs relative z-10">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-blue-100 group-hover:shadow-sm transition-all">
                            <div className="text-slate-500 mb-1 font-medium">持仓金额</div>
                            <div className="font-bold text-slate-900 text-base">¥{fund.marketValue?.toLocaleString()}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-blue-100 group-hover:shadow-sm transition-all text-right">
                             <div className="text-slate-500 mb-1 font-medium">持有收益</div>
                             <div className={`font-bold text-base ${fund.totalReturn >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
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
