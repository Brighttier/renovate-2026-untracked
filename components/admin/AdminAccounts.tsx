import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { User, AccountStatus } from '../../types';
import { PLATFORM_PLANS } from '../../constants';

const AdminAccounts: React.FC = () => {
  const { users, usersLoading, updateUserStatus, deleteUser } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesPlan = planFilter === 'all' || user.planId === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [users, searchTerm, statusFilter, planFilter]);

  const handleStatusChange = async (userId: string, newStatus: AccountStatus) => {
    await updateUserStatus(userId, newStatus);
  };

  const handleDelete = async (userId: string) => {
    await deleteUser(userId);
    setShowDeleteConfirm(null);
  };

  const getPlanName = (planId: string) => {
    return PLATFORM_PLANS.find(p => p.id === planId)?.name || planId;
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-72 pl-10 pr-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'all')}
            className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
          >
            <option value="all">All Status</option>
            <option value={AccountStatus.ACTIVE}>Active</option>
            <option value={AccountStatus.SUSPENDED}>Suspended</option>
            <option value={AccountStatus.PENDING}>Pending</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
          >
            <option value="all">All Plans</option>
            {PLATFORM_PLANS.map(plan => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#6B6478]">
          <span>{filteredUsers.length} users</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#9F8FD4]/10">
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">User</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Plan</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Sites</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Revenue</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">AI Calls</th>
              <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#262033] rounded-xl flex items-center justify-center text-[#A8A3B3] text-xs font-bold">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{user.name}</div>
                      <div className="text-xs text-[#6B6478]">{user.ownerEmail}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="px-3 py-1 bg-[#262033] rounded-lg text-xs font-medium text-white">
                    {getPlanName(user.planId)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    user.status === AccountStatus.ACTIVE
                      ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                      : user.status === AccountStatus.SUSPENDED
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-white">{user.stats.totalSites}</td>
                <td className="px-5 py-4 text-sm text-white font-medium">${user.stats.totalRevenue.toLocaleString()}</td>
                <td className="px-5 py-4 text-sm text-[#A8A3B3]">{user.stats.aiCallsThisMonth}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#A8A3B3] hover:text-white"
                      title="View Details"
                    >
                      <Icons.Search size={16} />
                    </button>
                    {user.status === AccountStatus.ACTIVE ? (
                      <button
                        onClick={() => handleStatusChange(user.id, AccountStatus.SUSPENDED)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-[#A8A3B3] hover:text-red-500"
                        title="Suspend"
                      >
                        <Icons.Settings size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(user.id, AccountStatus.ACTIVE)}
                        className="p-2 hover:bg-[#9F8FD4]/10 rounded-lg transition-colors text-[#A8A3B3] hover:text-[#9F8FD4]"
                        title="Activate"
                      >
                        <Icons.Rocket size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteConfirm(user.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-[#A8A3B3] hover:text-red-500"
                      title="Delete"
                    >
                      <Icons.Logout size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center">
            <Icons.Folder size={48} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-[#6B6478]">No users found</p>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#9F8FD4]/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#262033] rounded-xl flex items-center justify-center text-[#A8A3B3] font-bold">
                    {selectedUser.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                    <p className="text-sm text-[#6B6478]">{selectedUser.ownerEmail}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#A8A3B3]"
                >
                  <Icons.Logout size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[#0D0B14] rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{selectedUser.stats.totalLeads}</div>
                    <div className="text-xs text-[#6B6478]">Total Leads</div>
                  </div>
                  <div className="bg-[#0D0B14] rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{selectedUser.stats.totalSites}</div>
                    <div className="text-xs text-[#6B6478]">Total Sites</div>
                  </div>
                  <div className="bg-[#0D0B14] rounded-xl p-4">
                    <div className="text-2xl font-bold text-[#9F8FD4]">${selectedUser.stats.totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-[#6B6478]">Total Revenue</div>
                  </div>
                  <div className="bg-[#0D0B14] rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">${selectedUser.stats.monthlyRecurring}</div>
                    <div className="text-xs text-[#6B6478]">MRR</div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white">Account Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">Plan</div>
                      <div className="text-sm text-white font-medium">{getPlanName(selectedUser.planId)}</div>
                    </div>
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">Status</div>
                      <div className={`text-sm font-medium ${
                        selectedUser.status === AccountStatus.ACTIVE ? 'text-[#9F8FD4]' : 'text-red-500'
                      }`}>
                        {selectedUser.status}
                      </div>
                    </div>
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">Edit Tokens</div>
                      <div className="text-sm text-white">
                        {selectedUser.stats.editTokensRemaining} / {selectedUser.stats.editTokensUsed + selectedUser.stats.editTokensRemaining}
                      </div>
                    </div>
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">AI Calls (MTD)</div>
                      <div className="text-sm text-white">{selectedUser.stats.aiCallsThisMonth}</div>
                    </div>
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">Created</div>
                      <div className="text-sm text-white">{new Date(selectedUser.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="bg-[#0D0B14] rounded-xl p-4">
                      <div className="text-xs text-[#6B6478] mb-1">Last Active</div>
                      <div className="text-sm text-white">
                        {selectedUser.stats.lastActiveAt
                          ? new Date(selectedUser.stats.lastActiveAt).toLocaleString()
                          : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-[#9F8FD4]/10">
                  <button className="flex-1 py-3 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors">
                    Login as User
                  </button>
                  {selectedUser.status === AccountStatus.ACTIVE ? (
                    <button
                      onClick={() => handleStatusChange(selectedUser.id, AccountStatus.SUSPENDED)}
                      className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-bold text-red-500 transition-colors"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(selectedUser.id, AccountStatus.ACTIVE)}
                      className="px-6 py-3 bg-[#9F8FD4]/10 hover:bg-[#9F8FD4]/20 rounded-xl text-sm font-bold text-[#9F8FD4] transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Delete User?</h3>
              <p className="text-sm text-[#A8A3B3] mb-6">
                This action cannot be undone. All user data, leads, and websites will be permanently deleted.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-bold text-white transition-colors"
                >
                  Delete User
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAccounts;
