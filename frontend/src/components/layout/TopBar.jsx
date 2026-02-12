import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, X, User, LogOut, Settings, KeyRound, ChevronDown, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function TopBar({ onMenuClick, showMobileMenu, onChangePassword }) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchInputRef = useRef(null);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  
  const { user, logout } = useAuth();

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.replace('/');
    } finally {
      setShowUserMenu(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length > 0) {
      setIsSearching(true);
      setShowResults(true);
      // Simulate search delay
      setTimeout(() => {
        setSearchResults([
          { id: 1, name: 'Fund A', code: '001234' },
          { id: 2, name: 'Fund B', code: '005678' },
        ].filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || item.code.includes(query)));
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  return (
    <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40 px-4 flex items-center justify-between transition-all duration-300">
      
      {/* Left: Mobile Menu & Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
        >
          {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        {/* Logo - Click to Home */}
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
            <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 hidden sm:block">
            FundVal
            </span>
        </Link>
      </div>

      {/* Center: Search Bar (Hidden on very small screens, or handled differently) */}
      <div className="flex-1 max-w-2xl mx-4 hidden md:block">
        <div className="relative group">
          <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${isSearchFocused ? 'text-blue-500' : 'text-slate-400'}`}>
            <Search size={18} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className={`block w-full pl-10 pr-3 py-2 border ${isSearchFocused ? 'border-blue-500/50 ring-2 ring-blue-500/10' : 'border-slate-200'} rounded-xl bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-300`}
            placeholder="搜索基金代码 / 名称..."
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              setIsSearchFocused(false);
              // Delay hiding results to allow clicking them
              setTimeout(() => setShowResults(false), 200);
            }}
          />
          {/* Search Shortcuts Hint */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 border border-slate-200 rounded-md text-xs text-slate-400 bg-white font-sans">Ctrl K</kbd>
          </div>

          {/* Search Dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {isSearching ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  搜索中...
                </div>
              ) : searchResults.length > 0 ? (
                <ul className="py-2">
                  {searchResults.map(result => (
                    <li key={result.id}>
                      <button className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between group">
                        <span className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors">{result.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">{result.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm">
                  未找到相关基金
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-all relative group"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-slate-700 text-sm">通知</span>
                <button className="text-xs text-blue-600 hover:text-blue-700">全部已读</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-8 text-center text-slate-400 text-sm">
                  暂无新通知
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 pl-2 pr-1 sm:pr-2 hover:bg-slate-100 rounded-xl sm:rounded-full border border-transparent hover:border-slate-200 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
              {user?.username?.[0]?.toUpperCase() || <User size={16} />}
            </div>
            
            <div className="hidden sm:flex flex-col items-start mr-1">
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                    {user?.username || 'User'}
                </span>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
              <div className="p-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{user?.username || 'Guest'}</p>
                <p className="text-xs text-slate-500 mt-0.5">普通用户</p>
              </div>
              <div className="p-1.5">
                <button className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2">
                  <User size={16} />
                  <span>个人资料</span>
                </button>
                <button 
                  onClick={() => {
                     if (onChangePassword) onChangePassword();
                     setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2"
                >
                    <KeyRound size={16} />
                    <span>修改密码</span>
                </button>
              </div>
              <div className="p-1.5 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut size={16} />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
