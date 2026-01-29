import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { AuditAction, AuditResource } from '../../types';
import { AUDIT_ACTION_LABELS, AUDIT_RESOURCE_LABELS } from '../../constants';

const AdminAuditLogs: React.FC = () => {
  const { auditLogs, auditLogsLoading, auditLogFilter, setAuditLogFilter, refreshAuditLogs, exportAuditLogs } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'all'>('all');
  const [selectedResource, setSelectedResource] = useState<AuditResource | 'all'>('all');
  const [selectedActorType, setSelectedActorType] = useState<'admin' | 'user' | 'system' | 'api' | 'all'>('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch =
        !searchTerm ||
        log.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = selectedAction === 'all' || log.action === selectedAction;
      const matchesResource = selectedResource === 'all' || log.resource === selectedResource;
      const matchesActorType = selectedActorType === 'all' || log.actorType === selectedActorType;

      return matchesSearch && matchesAction && matchesResource && matchesActorType;
    });
  }, [auditLogs, searchTerm, selectedAction, selectedResource, selectedActorType]);

  const handleExport = async () => {
    const csv = await exportAuditLogs();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: AuditAction): string => {
    if (action === AuditAction.LOGIN || action === AuditAction.CREATE || action === AuditAction.ACTIVATE) {
      return 'text-[#9F8FD4] bg-[#9F8FD4]/10';
    }
    if (action === AuditAction.DELETE || action === AuditAction.SUSPEND || action === AuditAction.LOGIN_FAILED || action === AuditAction.API_KEY_REVOKED) {
      return 'text-red-500 bg-red-500/10';
    }
    if (action === AuditAction.UPDATE || action === AuditAction.AI_CONFIG_CHANGED) {
      return 'text-yellow-500 bg-yellow-500/10';
    }
    if (action === AuditAction.IMPERSONATE) {
      return 'text-purple-500 bg-purple-500/10';
    }
    return 'text-[#A8A3B3] bg-zinc-500/10';
  };

  const getActorTypeColor = (actorType: string): string => {
    switch (actorType) {
      case 'admin': return 'text-[#9F8FD4]';
      case 'user': return 'text-blue-500';
      case 'system': return 'text-yellow-500';
      case 'api': return 'text-purple-500';
      default: return 'text-[#A8A3B3]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Audit Logs</h2>
          <p className="text-sm text-[#6B6478]">Track all platform activity and changes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshAuditLogs}
            disabled={auditLogsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors disabled:opacity-50"
          >
            <Icons.History size={16} className={auditLogsLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-medium text-white transition-colors"
          >
            <Icons.Folder size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
          <input
            type="text"
            placeholder="Search by actor, email, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
          />
        </div>

        {/* Actor Type Filter */}
        <select
          value={selectedActorType}
          onChange={(e) => setSelectedActorType(e.target.value as any)}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
        >
          <option value="all">All Actors</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="api">API</option>
        </select>

        {/* Action Filter */}
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value as any)}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
        >
          <option value="all">All Actions</option>
          {Object.values(AuditAction).map(action => (
            <option key={action} value={action}>{AUDIT_ACTION_LABELS[action]}</option>
          ))}
        </select>

        {/* Resource Filter */}
        <select
          value={selectedResource}
          onChange={(e) => setSelectedResource(e.target.value as any)}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
        >
          <option value="all">All Resources</option>
          {Object.values(AuditResource).map(resource => (
            <option key={resource} value={resource}>{AUDIT_RESOURCE_LABELS[resource]}</option>
          ))}
        </select>

        <div className="text-sm text-[#6B6478]">
          {filteredLogs.length} entries
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#9F8FD4]/10">
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Timestamp</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actor</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Action</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Resource</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Details</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]"
              >
                <td className="px-5 py-4">
                  <div className="text-xs text-white">{new Date(log.createdAt).toLocaleString()}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold uppercase ${getActorTypeColor(log.actorType)}`}>
                      {log.actorType}
                    </span>
                    <span className="text-xs text-[#A8A3B3] truncate max-w-[150px]">
                      {log.actorEmail || log.actorId}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2.5 py-1 rounded-lg text-sm font-bold uppercase ${getActionColor(log.action)}`}>
                    {AUDIT_ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="text-xs text-white">{AUDIT_RESOURCE_LABELS[log.resource] || log.resource}</div>
                  {log.resourceId && (
                    <div className="text-sm text-[#6B6478] font-mono truncate max-w-[100px]">{log.resourceId}</div>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="text-xs text-[#A8A3B3] max-w-[200px] truncate" title={JSON.stringify(log.details)}>
                    {Object.keys(log.details).length > 0
                      ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : '-'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs text-[#6B6478] font-mono">{log.ipAddress || '-'}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center">
            <Icons.History size={48} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-[#6B6478]">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{auditLogs.filter(l => l.actorType === 'admin').length}</div>
          <div className="text-xs text-[#6B6478]">Admin Actions</div>
        </div>
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{auditLogs.filter(l => l.actorType === 'user').length}</div>
          <div className="text-xs text-[#6B6478]">User Actions</div>
        </div>
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{auditLogs.filter(l => l.action === AuditAction.AI_GENERATION).length}</div>
          <div className="text-xs text-[#6B6478]">AI Generations</div>
        </div>
        <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-500">{auditLogs.filter(l => l.action === AuditAction.LOGIN_FAILED).length}</div>
          <div className="text-xs text-[#6B6478]">Failed Logins</div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogs;
