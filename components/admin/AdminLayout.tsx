import React from 'react';
import { motion } from 'framer-motion';
import { AdminTab } from '../../types';
import { ADMIN_TABS } from '../../constants';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';

interface AdminLayoutProps {
  children: React.ReactNode;
  onExit: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onExit }) => {
  const { activeTab, setActiveTab, platformStats, currentAdmin } = useAdmin();

  const getTabIcon = (tabId: AdminTab) => {
    switch (tabId) {
      case AdminTab.DASHBOARD:
        return <Icons.CRM size={18} />;
      case AdminTab.ACCOUNTS:
        return <Icons.User size={18} />;
      case AdminTab.DOMAINS:
        return <Icons.Globe size={18} />;
      case AdminTab.AI_OPTIMIZATION:
        return <Icons.Sparkles size={18} />;
      case AdminTab.SCALING:
        return <Icons.TrendingUp size={18} />;
      case AdminTab.SECURITY:
        return <Icons.Shield size={18} />;
      case AdminTab.API_WEBHOOKS:
        return <Icons.Rocket size={18} />;
      case AdminTab.AUDIT_LOGS:
        return <Icons.History size={18} />;
      case AdminTab.SETTINGS:
        return <Icons.Settings size={18} />;
      default:
        return <Icons.Folder size={18} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0B14] flex">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0D0B14] border-r border-[#9F8FD4]/10 flex flex-col">
        {/* Logo/Title */}
        <div className="p-6 border-b border-[#9F8FD4]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#9F8FD4] rounded-xl flex items-center justify-center font-black text-white text-sm">
              CC
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">Command Center</h1>
              <p className="text-sm text-[#6B6478] uppercase tracking-wider">Platform Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                activeTab === tab.id
                  ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                  : 'text-[#A8A3B3] hover:bg-white/5 hover:text-white'
              }`}
            >
              {getTabIcon(tab.id)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{tab.label}</div>
                <div className="text-sm text-[#6B6478] truncate">{tab.description}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="p-4 border-t border-[#9F8FD4]/10">
          <div className="bg-[#1A1625]/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6B6478]">Active Users</span>
              <span className="text-white font-bold">{platformStats.activeUsers}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6B6478]">Total MRR</span>
              <span className="text-[#9F8FD4] font-bold">${platformStats.totalMRR.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6B6478]">AI Calls Today</span>
              <span className="text-white font-bold">{platformStats.totalAICalls}</span>
            </div>
          </div>
        </div>

        {/* Admin Profile */}
        <div className="p-4 border-t border-[#9F8FD4]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#262033] rounded-full flex items-center justify-center text-[#A8A3B3]">
              <Icons.User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {currentAdmin?.displayName || 'Admin'}
              </div>
              <div className="text-sm text-[#6B6478] truncate">
                {currentAdmin?.email || 'admin@renovatemysite.app'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-[#0D0B14]/50 border-b border-[#9F8FD4]/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">
              {ADMIN_TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#9F8FD4]/10 rounded-full">
              <div className="w-2 h-2 bg-[#9F8FD4] rounded-full animate-pulse" />
              <span className="text-sm font-bold text-[#9F8FD4] uppercase tracking-wider">System Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
              <input
                type="text"
                placeholder="Search..."
                className="w-64 pl-10 pr-4 py-2 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
              />
            </div>

            {/* Exit Button */}
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-4 py-2 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors"
            >
              <Icons.Logout size={16} />
              <span>Exit Studio</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
