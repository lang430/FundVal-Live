import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export const PortfolioAnalysis = ({ positions }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const handleAnalyze = async () => {
    if (!positions || positions.length === 0) return;
    setLoading(true);
    try {
      // Prepare lightweight payload
      const payload = positions.map(p => ({
        code: p.code,
        name: p.name,
        type: p.type,
        market_value: p.est_market_value,
        return_rate: p.total_return_rate
      }));

      const res = await api.post('/ai/analyze_portfolio', { positions: payload });
      setAnalysis(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setAnalysis({ error: "AI 分析服务暂时不可用" });
    } finally {
      setLoading(false);
    }
  };

  if (!positions || positions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI 持仓诊断</h3>
              <p className="text-xs text-slate-400">Powered by Linus Logic</p>
            </div>
          </div>
          <button 
            onClick={handleAnalyze}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? '分析中...' : (analysis ? '重新诊断' : '开始诊断')}
          </button>
        </div>

        {!analysis && !loading && (
          <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-700 rounded-lg">
            点击按钮，让 AI 毒舌点评你的持仓组合
          </div>
        )}

        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            <div className="h-20 bg-slate-700 rounded w-full"></div>
          </div>
        )}

        {analysis && !analysis.error && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Score / Risk */}
            <div className="flex gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg flex-1 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">健康度评分</div>
                    <div className={`text-2xl font-mono font-bold ${analysis.score >= 80 ? 'text-green-400' : analysis.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {analysis.score}
                    </div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg flex-1 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">风险评级</div>
                    <div className="text-lg font-bold text-white">
                        {analysis.risk_level}
                    </div>
                </div>
            </div>

            {/* Critique */}
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> 
                    毒舌点评
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed font-mono">
                    {analysis.critique}
                </p>
            </div>

            {/* Suggestions */}
            <div>
                <h4 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">优化建议</h4>
                <ul className="space-y-2">
                    {analysis.suggestions && analysis.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            {s}
                        </li>
                    ))}
                </ul>
            </div>
            
            <div className="text-[10px] text-slate-600 text-right pt-2">
                生成时间: {analysis.timestamp}
            </div>
          </div>
        )}
        
        {analysis && analysis.error && (
            <div className="text-red-400 text-sm py-4 text-center">
                {analysis.error}
            </div>
        )}
      </div>
    </div>
  );
};
