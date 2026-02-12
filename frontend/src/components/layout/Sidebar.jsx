import React from 'react';
import { 
  LayoutGrid, 
  Wallet, 
  Settings as SettingsIcon, 
  Users, 
  LogOut, 
  TrendingUp,
  PieChart,
  MessageSquare
} from 'lucide-react';
import Clock from '../common/Clock';

export default function Sidebar({ currentView, setCurrentView, isMultiUserMode, isAdmin, logout }) {
  const menuItems = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutGrid },
    { id: 'list', label: '基金市场', icon: TrendingUp },
    { id: 'account', label: '资产组合', icon: PieChart },
    { id: 'ai-chat', label: 'AI 分析师', icon: MessageSquare }, // New Feature
    { id: 'settings', label: '系统设置', icon: SettingsIcon },
  ];

  if (isMultiUserMode && isAdmin) {
    menuItems.push({ id: 'users', label: '用户管理', icon: Users });
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 z-50 flex flex-col">
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Wallet className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            FundVal
          </h1>
          <p className="text-xs text-slate-500 tracking-wider">LIVE MONITOR</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] border border-blue-500/20' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
      {isActive && (
                <div
                  className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full"
                />
              )}
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="p-4 border-t border-slate-800/50">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition-colors group"
        >
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-medium">退出登录</span>
        </button>
        
        <div className="mt-4">
          <Clock />
        </div>
      </div>
    </aside>
  );
}
