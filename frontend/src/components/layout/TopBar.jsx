import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, Menu, LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { searchFunds } from '../../services/api';
import ChangePasswordModal from '../ChangePasswordModal';

export default function TopBar({ 
  currentUser, 
  onSearchSelect, 
  onMenuClick,
  logout
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const userMenuRef = useRef(null);

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

  // Click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (fund) => {
    onSearchSelect(fund);
    setShowResults(false);
    setQuery('');
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    if (logout) await logout();
  };

  return (
    <>
      <header className="h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/50 transition-colors duration-300">
        {/* Mobile Menu Button */}
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl relative">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
            <input
              type="text"
              placeholder="搜索基金代码或名称..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query && setShowResults(true)}
              className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-900 pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-400 focus:bg-white"
            />
            {/* Keyboard Shortcut Hint */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-50">
              <kbd className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-xs font-medium">Ctrl</kbd>
              <kbd className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-xs font-medium">K</kbd>
            </div>
          </div>

          {/* Search Dropdown */}
            {showResults && (
              <div 
                className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-50"
              >
                {loading ? (
                  <div className="p-4 text-center text-slate-500">搜索中...</div>
                ) : results.length > 0 ? (
                  <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {results.map((fund) => (
                      <button
                        key={fund.id}
                        onClick={() => handleSelect(fund)}
                        className="w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center justify-between group transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div>
                          <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                            {fund.name}
                          </div>
                          <div className="text-sm text-slate-500 font-mono mt-1">
                            {fund.id}
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
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
        <div className="flex items-center gap-4 md:gap-6 ml-4 md:ml-8">
          <button className="relative p-2 text-slate-400 hover:text-slate-900 transition-colors hover:bg-slate-100 rounded-xl">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
          </button>
          
          <div className="relative pl-6 border-l border-slate-200" ref={userMenuRef}>
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                  {currentUser?.username || 'Guest'}
                </div>
                <div className="text-xs text-slate-500">
                  {currentUser?.is_admin ? '管理员' : '普通用户'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-500" />
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 py-1 overflow-hidden z-50"
              >
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  修改密码
                </button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
    </>
  );
}
