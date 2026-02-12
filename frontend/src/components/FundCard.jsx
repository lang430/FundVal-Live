import React, { useState } from 'react';
import { AlertCircle, Bell, Trash2, Clock, Activity, TrendingUp } from 'lucide-react';
import { StatCard, getRateColor } from './StatCard';

export const FundCard = ({ fund, onClick, onRemove, onSubscribe }) => {
  const [removing, setRemoving] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const handleRemove = (e) => {
    e.stopPropagation();
    if (removing) return; // Prevent duplicate clicks
    setRemoving(true);
    onRemove(fund.id);
  };

  // Debug: log fund data to console
  React.useEffect(() => {
    if (fund.source === 'ml_estimate') {
      console.log('ML Estimate Fund:', fund.id, {
        source: fund.source,
        method: fund.method,
        confidence: fund.confidence
      });
    }
  }, [fund]);

  const handleBacktest = async (e) => {
    e.stopPropagation();
    if (backtestLoading) return;

    setBacktestLoading(true);
    try {
      const response = await fetch(`/api/fund/${fund.id}/backtest?days=20`);
      if (response.ok) {
        const data = await response.json();
        setBacktestData(data);
        setShowBacktest(true);
      } else {
        alert('回测失败，请稍后重试');
      }
    } catch (error) {
      console.error('Backtest error:', error);
      alert('回测失败，请稍后重试');
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div 
      onClick={() => {
        console.log("Card clicked:", fund.id);
        onClick(fund.id);
      }}
      className="bg-slate-800/40 backdrop-blur rounded-2xl p-5 border border-slate-700/50 hover:bg-slate-800/60 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer relative overflow-hidden group"
    >
      {/* Card Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-200 line-clamp-1 text-lg group-hover:text-blue-400 transition-colors">
            {fund.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-600/30">{fund.id}</span>
            {/* Warning if data looks stale/mock */}
            {(!fund.estimate && fund.estRate === 0) && (
              <span className="flex items-center gap-1 text-amber-400 text-xs bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                <AlertCircle className="w-3 h-3" /> 数据待更新
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onSubscribe(fund); }}
            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors z-10"
            title="订阅提醒"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
            title="删除"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-3 gap-4 items-end pointer-events-none">
        <div className="col-span-1">
          <span className="text-xs text-slate-500 block mb-1">盘中估算</span>
          <div className={`text-3xl font-bold tracking-tight ${fund.estRate > 0 ? 'text-red-400' : (fund.estRate < 0 ? 'text-green-400' : 'text-slate-400')}`}>
            {fund.estRate > 0 ? '+' : ''}{fund.estRate}%
          </div>
        </div>
        <div className="col-span-2 flex justify-between items-end pl-4 border-l border-slate-700/50">
          <StatCard label="估算净值" value={fund.estimate ? fund.estimate.toFixed(4) : '--'} />
          <StatCard label="昨日净值" value={fund.nav ? fund.nav.toFixed(4) : '--'} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center">
        <div className="flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {fund.time || '--:--'}
            {fund.source === 'ml_estimate' && (
              <span className="ml-2 px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-xs font-medium">
                算法估值
              </span>
            )}
          </div>
          {fund.source === 'ml_estimate' && (
            <div className="text-xs text-slate-600 italic">
              {fund.method === 'weighted_ma' && '基于近5日加权平均预测'}
            </div>
          )}
        </div>
        {fund.source === 'ml_estimate' && (
          <button
            onClick={handleBacktest}
            disabled={backtestLoading}
            className="pointer-events-auto flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
            title="查看回测准确率"
          >
            <TrendingUp className="w-3 h-3" />
            {backtestLoading ? '计算中...' : '准确率'}
          </button>
        )}
      </div>

      {/* Backtest Modal */}
      {showBacktest && backtestData && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowBacktest(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-slate-800">算法回测结果</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBacktest(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">平均误差率</div>
                <div className="text-3xl font-bold text-purple-600">
                  {backtestData.avg_error_rate}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  基于近 {backtestData.test_days} 天历史数据回测
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">方向准确率</div>
                  <div className="text-xl font-bold text-slate-700">
                    {backtestData.direction_accuracy}%
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">中位数误差</div>
                  <div className="text-xl font-bold text-slate-700">
                    {backtestData.median_error_rate}%
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="text-sm font-medium text-slate-700 mb-2">误差分布</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">误差 ≤ 0.5%</span>
                    <span className="font-medium text-emerald-600">
                      {backtestData.error_distribution.within_0_5}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">误差 ≤ 1.0%</span>
                    <span className="font-medium text-blue-600">
                      {backtestData.error_distribution.within_1_0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">误差 ≤ 2.0%</span>
                    <span className="font-medium text-slate-600">
                      {backtestData.error_distribution.within_2_0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 italic">
                算法：{backtestData.method === 'weighted_ma' ? '加权移动平均' : '简单移动平均'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Decorative Line */}
      <div className={`absolute bottom-0 left-0 w-full h-1 ${getRateColor(fund.estRate).replace('text', 'bg')} opacity-50`}></div>
    </div>
  );
};
