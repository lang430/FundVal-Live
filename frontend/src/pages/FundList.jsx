import React, { useState, useMemo, useEffect } from 'react';
import { Search, Activity, Filter, ArrowUpDown } from 'lucide-react';
import { FundCard } from '../components/FundCard';
import { getFundCategories } from '../services/api';

export const FundList = ({ watchlist, setWatchlist, onSelectFund, onSubscribe, onRemove }) => {
  const [filterSector, setFilterSector] = useState("全部");
  const [sortType, setSortType] = useState("default"); // default, rate_desc, rate_asc
  const [categories, setCategories] = useState(["全部"]);

  // Load categories from backend
  useEffect(() => {
    getFundCategories().then(cats => {
      if (cats.length > 0) {
        setCategories(["全部", ...cats]);
      }
    });
  }, []);

  // Process list
  const processedList = useMemo(() => {
    let result = [...watchlist];

    // 1. Filter
    if (filterSector !== "全部") {
        result = result.filter(f => {
            // Use fuzzy matching for major categories
            // e.g. "股票型" matches "股票型", "混合型-偏股"
            return f.type && f.type.includes(filterSector.replace("型", ""));
        });
    }

    // 2. Sort
    if (sortType === "rate_desc") {
        result.sort((a, b) => (b.estRate || 0) - (a.estRate || 0));
    } else if (sortType === "rate_asc") {
        result.sort((a, b) => (a.estRate || 0) - (b.estRate || 0));
    }

    return result;
  }, [watchlist, filterSector, sortType]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
        {/* Header / Stats */}
        <div className="text-xs text-slate-500 px-1">
          <span className="font-bold text-slate-800 text-sm">我的关注 ({watchlist.length})</span>
          <span className="ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            实时更新
          </span>
        </div>

        {/* Controls */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* Sector Filter */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                {categories.map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterSector(s)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap font-medium ${
                            filterSector === s
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Sort Toggle */}
            <button 
                onClick={() => setSortType(prev => prev === 'rate_desc' ? 'rate_asc' : 'rate_desc')}
                className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-xl text-xs hover:bg-slate-50 hover:border-slate-300 transition-all whitespace-nowrap shadow-sm hover:shadow-md active:scale-95"
            >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortType === 'default' ? '排序' : sortType === 'rate_desc' ? '涨幅 ↓' : '涨幅 ↑'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processedList.map((fund) => (
          <FundCard 
            key={fund.id} 
            fund={fund} 
            onClick={onSelectFund}
            onRemove={onRemove}
            onSubscribe={onSubscribe}
          />
        ))}

        {watchlist.length === 0 && (
          <div className="col-span-1 md:col-span-2 py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-sm">
                <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-bold mb-1">关注列表为空</h3>
            <p className="text-sm">请在上方搜索框输入代码添加基金</p>
          </div>
        )}
        
        {watchlist.length > 0 && processedList.length === 0 && (
             <div className="col-span-1 md:col-span-2 py-16 text-center text-slate-500 border border-slate-100 rounded-3xl bg-white shadow-sm">
                <Filter className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>没有找到匹配板块的基金</p>
                <button onClick={() => setFilterSector("全部")} className="text-blue-600 text-xs mt-3 font-bold hover:underline">清除筛选条件</button>
             </div>
        )}
      </div>
    </>
  );
};
