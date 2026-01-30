import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { AccountStatus, AdminTab } from '../../types';
import { AUDIT_ACTION_LABELS } from '../../constants';
import { vibeEditorService } from '../../services/vibeEditorService';

const AdminDashboard: React.FC = () => {
  const { platformStats, users, auditLogs, systemHealth, refreshSystemHealth, metricsChanges, setActiveTab, exportAuditLogs } = useAdmin();

  // Vibe Editor Metrics State
  const [vibeMetrics, setVibeMetrics] = useState<{
    totalEdits: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    costPerEdit: number;
  } | null>(null);

  // Refresh system health on mount
  useEffect(() => {
    refreshSystemHealth();
  }, [refreshSystemHealth]);

  // Load vibe editor metrics
  useEffect(() => {
    const loadVibeMetrics = async () => {
      const metrics = await vibeEditorService.getMetrics();
      if (metrics) {
        setVibeMetrics(metrics);
      }
    };
    loadVibeMetrics();
  }, []);

  const recentUsers = users
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentLogs = auditLogs.slice(0, 8);

  const metrics = [
    {
      label: 'Total Revenue',
      value: `$${platformStats.totalRevenue.toLocaleString()}`,
      change: metricsChanges?.revenueChange ? `${parseFloat(metricsChanges.revenueChange) >= 0 ? '+' : ''}${metricsChanges.revenueChange}%` : 'No history',
      positive: !metricsChanges?.revenueChange || parseFloat(metricsChanges.revenueChange) >= 0,
      icon: <Icons.CRM size={20} />
    },
    {
      label: 'Monthly Recurring',
      value: `$${platformStats.totalMRR.toLocaleString()}`,
      change: metricsChanges?.mrrChange ? `${parseFloat(metricsChanges.mrrChange) >= 0 ? '+' : ''}${metricsChanges.mrrChange}%` : 'No history',
      positive: !metricsChanges?.mrrChange || parseFloat(metricsChanges.mrrChange) >= 0,
      icon: <Icons.Rocket size={20} />
    },
    {
      label: 'Active Users',
      value: platformStats.activeUsers.toString(),
      change: `${platformStats.totalUsers} total`,
      positive: true,
      icon: <Icons.User size={20} />
    },
    {
      label: 'AI Cost (MTD)',
      value: `$${platformStats.totalAICost.toFixed(2)}`,
      change: `${platformStats.totalAICalls} calls`,
      positive: false,
      icon: <Icons.Sparkles size={20} />
    },
    {
      label: 'Vibe Edits',
      value: vibeMetrics?.totalEdits.toLocaleString() || '0',
      change: vibeMetrics ? `${vibeMetrics.successRate.toFixed(1)}% success` : 'No data',
      positive: !vibeMetrics || vibeMetrics.successRate >= 90,
      icon: <Icons.Sparkles size={20} />
    }
  ];

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return { dot: 'bg-[#9F8FD4]', text: 'text-[#9F8FD4]' };
      case 'degraded':
        return { dot: 'bg-yellow-500', text: 'text-yellow-500' };
      case 'outage':
        return { dot: 'bg-red-500', text: 'text-red-500' };
      default:
        return { dot: 'bg-zinc-500', text: 'text-[#6B6478]' };
    }
  };

  // Build health services list from real data or fallback
  const healthServices = systemHealth?.services
    ? [
        { name: 'API Gateway', key: 'apiGateway' },
        { name: 'Firestore Database', key: 'firestore' },
        { name: 'Gemini AI', key: 'geminiAI' },
        { name: 'Firebase Hosting', key: 'firebaseHosting' },
        { name: 'Webhook Delivery', key: 'webhookDelivery' }
      ].map(service => ({
        name: service.name,
        status: systemHealth.services[service.key]?.status || 'operational',
        message: systemHealth.services[service.key]?.message
      }))
    : [
        { name: 'API Gateway', status: 'operational' },
        { name: 'Firestore Database', status: 'operational' },
        { name: 'Gemini AI', status: 'operational' },
        { name: 'Firebase Hosting', status: 'operational' },
        { name: 'Webhook Delivery', status: 'operational' }
      ];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-5 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center text-[#9F8FD4]">
                {metric.icon}
              </div>
              <span className={`text-xs font-bold ${metric.positive ? 'text-[#9F8FD4]' : 'text-[#6B6478]'}`}>
                {metric.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-xs text-[#6B6478]">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Vibe Editor Detailed Metrics */}
      {vibeMetrics && (
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Vibe Editor Performance</h3>
            <div className="text-xs text-[#9F8FD4]">Real-time metrics</div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-[#0D0B14]/50 rounded-xl">
              <div className="text-xs text-[#6B6478] mb-1">Total Edits</div>
              <div className="text-2xl font-bold text-white">{vibeMetrics.totalEdits.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-[#0D0B14]/50 rounded-xl">
              <div className="text-xs text-[#6B6478] mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-[#9F8FD4]">{vibeMetrics.successRate.toFixed(1)}%</div>
            </div>
            <div className="p-4 bg-[#0D0B14]/50 rounded-xl">
              <div className="text-xs text-[#6B6478] mb-1">Avg Latency</div>
              <div className="text-2xl font-bold text-white">{vibeMetrics.avgLatency.toFixed(0)}ms</div>
            </div>
            <div className="p-4 bg-[#0D0B14]/50 rounded-xl">
              <div className="text-xs text-[#6B6478] mb-1">Cost/Edit</div>
              <div className="text-2xl font-bold text-white">${vibeMetrics.costPerEdit.toFixed(4)}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#9F8FD4]/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6B6478]">Total AI Cost</span>
              <span className="text-white font-bold">${vibeMetrics.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Users */}
        <div className="col-span-2 bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Recent Users</h3>
            <button onClick={() => setActiveTab(AdminTab.ACCOUNTS)} className="text-xs text-[#9F8FD4] hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-[#0D0B14]/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#262033] rounded-lg flex items-center justify-center text-[#A8A3B3] text-xs font-bold">
                    {user.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{user.name}</div>
                    <div className="text-sm text-[#6B6478]">{user.ownerEmail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">${user.stats.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm text-[#6B6478]">{user.stats.totalSites} sites</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-sm font-bold uppercase ${
                    user.status === AccountStatus.ACTIVE
                      ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                      : user.status === AccountStatus.SUSPENDED
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {user.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Activity Feed</h3>
            <button onClick={() => setActiveTab(AdminTab.AUDIT_LOGS)} className="text-xs text-[#9F8FD4] hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#9F8FD4] rounded-full mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">
                    <span className="text-[#A8A3B3]">{log.actorEmail || log.actorId}</span>
                    {' '}
                    <span className="text-[#9F8FD4]">{AUDIT_ACTION_LABELS[log.action] || log.action}</span>
                    {' '}
                    {log.resourceId && (
                      <span className="text-[#6B6478]">{log.resource}</span>
                    )}
                  </div>
                  <div className="text-sm text-[#6B6478] mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions & System Health */}
      <div className="grid grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab(AdminTab.ACCOUNTS)}
              className="flex items-center gap-3 p-4 bg-[#0D0B14]/50 rounded-xl hover:bg-[#262033]/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center text-[#9F8FD4]">
                <Icons.User size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Add User</div>
                <div className="text-sm text-[#6B6478]">Create new account</div>
              </div>
            </button>
            <button
              onClick={() => setActiveTab(AdminTab.AI_OPTIMIZATION)}
              className="flex items-center gap-3 p-4 bg-[#0D0B14]/50 rounded-xl hover:bg-[#262033]/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center text-[#9F8FD4]">
                <Icons.Sparkles size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">AI Settings</div>
                <div className="text-sm text-[#6B6478]">Configure models</div>
              </div>
            </button>
            <button
              onClick={() => setActiveTab(AdminTab.API_WEBHOOKS)}
              className="flex items-center gap-3 p-4 bg-[#0D0B14]/50 rounded-xl hover:bg-[#262033]/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center text-[#9F8FD4]">
                <Icons.Rocket size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">API Keys</div>
                <div className="text-sm text-[#6B6478]">Manage access</div>
              </div>
            </button>
            <button
              onClick={() => exportAuditLogs()}
              className="flex items-center gap-3 p-4 bg-[#0D0B14]/50 rounded-xl hover:bg-[#262033]/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center text-[#9F8FD4]">
                <Icons.History size={18} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Export Logs</div>
                <div className="text-sm text-[#6B6478]">Download audit trail</div>
              </div>
            </button>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">System Health</h3>
            <button
              onClick={refreshSystemHealth}
              className="text-xs text-[#9F8FD4] hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-4">
            {healthServices.map((service) => {
              const colors = getStatusColor(service.status);
              return (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 ${colors.dot} rounded-full`} />
                    <span className="text-sm text-white">{service.name}</span>
                  </div>
                  <span className={`text-xs ${colors.text} capitalize`}>
                    {service.status}
                  </span>
                </div>
              );
            })}
          </div>
          {systemHealth?.lastUpdated && (
            <div className="mt-4 pt-3 border-t border-[#9F8FD4]/10">
              <div className="text-sm text-[#6B6478]">
                Last checked: {new Date(systemHealth.lastUpdated).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
