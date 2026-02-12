import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';


export default function MainLayout({ 
  children, 
  currentView, 
  setCurrentView, 
  isMultiUserMode, 
  isAdmin, 
  logout,
  currentUser,
  onSearchSelect
}) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isMultiUserMode={isMultiUserMode}
        isAdmin={isAdmin}
        logout={logout}
      />

      <div className="pl-64 relative z-10 transition-all duration-300">
        <TopBar 
          currentUser={currentUser}
          onSearchSelect={onSearchSelect}
          isMultiUserMode={isMultiUserMode}
        />
        
        <main className="p-8">
          <div className="max-w-7xl mx-auto">
              {children}
          </div>
        </main>
      </div>
    </div>
  );
}
