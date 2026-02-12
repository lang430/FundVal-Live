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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500/30 font-sans">
      {/* Background Gradient Orbs - Adjusted for Light Mode */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isMultiUserMode={isMultiUserMode}
        isAdmin={isAdmin}
        logout={logout}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="md:pl-64 relative z-10 transition-all duration-300">
        <TopBar 
          currentUser={currentUser}
          onSearchSelect={onSearchSelect}
          isMultiUserMode={isMultiUserMode}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
              {children}
          </div>
        </main>
      </div>
    </div>
  );
}
