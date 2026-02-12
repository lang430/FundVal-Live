import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User } from 'lucide-react';
import { searchFunds } from '../../services/api';

export default function TopBar({ 
  currentUser, 
  onSearchSelect, 
  isMultiUserMode
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchFunds(query);
        setResults(res || []);
        setShowResults(true);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [query]);

  const handleSelect = (fund) => {
    onSearchSelect(fund);
    setShowResults(false);
    setQuery('');
  };

  return (
    <header className="h-20 px-8 flex items-center justify-between sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl relative">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors w-5 h-5" />
          <input
            type="text"
            placeholder="搜索基金代码或名称..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setShowResults(true)}
            className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-600"
          />
          {/* Keyboard Shortcut Hint */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-50">
            <kbd className="bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-xs">Ctrl</kbd>
            <kbd className="bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-xs">K</kbd>
          </div>
        </div>

        {/* Search Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 w-full mt-2 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {loading ? (
              <div className="p-4 text-center text-slate-500">搜索中...</div>
            ) : results.length > 0 ? (
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {results.map((fund) => (
                  <button
                    key={fund.id}
                    onClick={() => handleSelect(fund)}
                    className="w-full px-6 py-4 text-left hover:bg-slate-700/50 flex items-center justify-between group transition-colors border-b border-slate-700/30 last:border-0"
                  >
                    <div>
                      <div className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
                        {fund.name}
                      </div>
                      <div className="text-sm text-slate-500 font-mono mt-1">
                        {fund.id}
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-400 group-hover:bg-blue-900/30 group-hover:text-blue-400 transition-all">
                      {fund.type}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                未找到结果
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6 ml-8">
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-xl">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-slate-900"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-slate-700/50">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-slate-200">
              {currentUser?.username || 'Guest'}
            </div>
            <div className="text-xs text-slate-500">
              {currentUser?.is_admin ? '管理员' : '普通用户'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
