import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { AdminRole, AccountStatus } from '../../types';

const AdminSecurity: React.FC = () => {
  const {
    users,
    currentAdmin,
    admins,
    adminsLoading,
    inviteAdmin,
    updateAdminRole,
    activeSessions,
    sessionsLoading,
    terminateSession,
    terminateAllSessions,
    securityPolicies,
    updateSecurityPolicies
  } = useAdmin();

  const [activeSection, setActiveSection] = useState<'admins' | 'users' | 'sessions' | 'policies'>('admins');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>(AdminRole.ADMIN);
  const [isInviting, setIsInviting] = useState(false);

  // Use real admin data or fallback to current admin
  const adminUsers = admins.length > 0 ? admins : (currentAdmin ? [currentAdmin] : []);

  // Local state for security policies (for immediate UI feedback)
  const [localPolicies, setLocalPolicies] = useState(securityPolicies || {
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expirationDays: 90
    },
    oauthProviders: {
      google: true,
      github: false,
      microsoft: false
    }
  });

  const handleInviteAdmin = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await inviteAdmin(inviteEmail, inviteName || inviteEmail.split('@')[0], inviteRole);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
    } catch (error) {
      console.error('Failed to invite admin:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await terminateSession(sessionId);
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  const handleTerminateAllSessions = async () => {
    if (currentAdmin?.id) {
      try {
        await terminateAllSessions(currentAdmin.id);
      } catch (error) {
        console.error('Failed to terminate all sessions:', error);
      }
    }
  };

  const handlePolicyChange = async (policyType: 'passwordPolicy' | 'oauthProviders', key: string, value: any) => {
    const updatedPolicies = {
      ...localPolicies,
      [policyType]: {
        ...localPolicies[policyType],
        [key]: value
      }
    };
    setLocalPolicies(updatedPolicies);

    // Persist to backend
    try {
      await updateSecurityPolicies(updatedPolicies);
    } catch (error) {
      console.error('Failed to update security policies:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#1A1625]/50 rounded-xl w-fit">
        {[
          { id: 'admins', label: 'Platform Admins' },
          { id: 'users', label: 'Platform Users' },
          { id: 'sessions', label: 'Active Sessions' },
          { id: 'policies', label: 'Security Policies' }
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === section.id
                ? 'bg-[#9F8FD4] text-white'
                : 'text-[#A8A3B3] hover:text-white'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Platform Admins */}
      {activeSection === 'admins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Platform Administrators</h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Icons.User size={16} />
              Invite Admin
            </button>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#9F8FD4]/10">
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Admin</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Role</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Last Login</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
                  <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(admin => (
                  <tr key={admin.id} className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#9F8FD4]/10 rounded-lg flex items-center justify-center text-[#9F8FD4]">
                          <Icons.User size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{admin.displayName}</div>
                          <div className="text-xs text-[#6B6478]">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                        admin.role === AdminRole.SUPER_ADMIN
                          ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                          : admin.role === AdminRole.ADMIN
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-zinc-500/10 text-[#A8A3B3]'
                      }`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#A8A3B3]">
                      {new Date(admin.lastLoginAt || '').toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        admin.isActive ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {admin.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-[#A8A3B3] hover:text-white">
                          <Icons.Settings size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform Users */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Platform Users ({users.length})</h3>
            <div className="relative">
              <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-64 pl-10 pr-4 py-2 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none"
              />
            </div>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#9F8FD4]/10">
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">User</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Account</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Plan</th>
                  <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
                  <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map(user => (
                  <tr key={user.id} className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#262033] rounded-lg flex items-center justify-center text-[#A8A3B3]">
                          <Icons.User size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{user.ownerEmail}</div>
                          <div className="text-xs text-[#6B6478]">Owner</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white">{user.name}</td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1 bg-[#262033] rounded-lg text-xs text-white capitalize">
                        {user.planId}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        user.status === AccountStatus.ACTIVE
                          ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-[#A8A3B3] hover:text-white" title="Reset Password">
                          <Icons.Settings size={16} />
                        </button>
                        <button className="p-2 hover:bg-red-500/10 rounded-lg text-[#A8A3B3] hover:text-red-500" title="Disable">
                          <Icons.Logout size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Sessions */}
      {activeSection === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Active Sessions ({activeSessions.length})</h3>
            <button
              onClick={handleTerminateAllSessions}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-medium text-red-500 transition-colors"
            >
              Terminate All
            </button>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
            {sessionsLoading ? (
              <div className="p-8 text-center text-[#6B6478]">Loading sessions...</div>
            ) : activeSessions.length === 0 ? (
              <div className="p-8 text-center text-[#6B6478]">No active sessions</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#9F8FD4]/10">
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">User</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Device</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">IP Address</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Started</th>
                    <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map(session => (
                    <tr key={session.id} className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="text-sm text-white">{session.adminEmail}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#A8A3B3]">{session.device || 'Unknown'}</td>
                      <td className="px-5 py-4 text-sm text-[#A8A3B3] font-mono">{session.ipAddress || 'Unknown'}</td>
                      <td className="px-5 py-4 text-sm text-[#A8A3B3]">
                        {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'Unknown'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleTerminateSession(session.id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-medium text-red-500 transition-colors"
                        >
                          Terminate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Security Policies */}
      {activeSection === 'policies' && (
        <div className="space-y-6">
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Password Policy</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div>
                  <div className="text-sm text-white">Minimum Length</div>
                  <div className="text-xs text-[#6B6478]">Require at least {localPolicies.passwordPolicy.minLength} characters</div>
                </div>
                <input
                  type="number"
                  value={localPolicies.passwordPolicy.minLength}
                  onChange={(e) => handlePolicyChange('passwordPolicy', 'minLength', parseInt(e.target.value))}
                  min={6}
                  max={32}
                  className="w-20 px-3 py-2 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-lg text-sm text-white text-center"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div>
                  <div className="text-sm text-white">Require Numbers</div>
                  <div className="text-xs text-[#6B6478]">At least one numeric character</div>
                </div>
                <button
                  onClick={() => handlePolicyChange('passwordPolicy', 'requireNumbers', !localPolicies.passwordPolicy.requireNumbers)}
                  className={`w-12 h-6 ${localPolicies.passwordPolicy.requireNumbers ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.passwordPolicy.requireNumbers ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div>
                  <div className="text-sm text-white">Require Special Characters</div>
                  <div className="text-xs text-[#6B6478]">At least one special character (!@#$%)</div>
                </div>
                <button
                  onClick={() => handlePolicyChange('passwordPolicy', 'requireSpecialChars', !localPolicies.passwordPolicy.requireSpecialChars)}
                  className={`w-12 h-6 ${localPolicies.passwordPolicy.requireSpecialChars ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.passwordPolicy.requireSpecialChars ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div>
                  <div className="text-sm text-white">Require Uppercase</div>
                  <div className="text-xs text-[#6B6478]">At least one uppercase letter</div>
                </div>
                <button
                  onClick={() => handlePolicyChange('passwordPolicy', 'requireUppercase', !localPolicies.passwordPolicy.requireUppercase)}
                  className={`w-12 h-6 ${localPolicies.passwordPolicy.requireUppercase ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.passwordPolicy.requireUppercase ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">OAuth Providers</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-lg">G</span>
                  </div>
                  <div>
                    <div className="text-sm text-white">Google</div>
                    <div className="text-xs text-[#6B6478]">Sign in with Google</div>
                  </div>
                </div>
                <button
                  onClick={() => handlePolicyChange('oauthProviders', 'google', !localPolicies.oauthProviders.google)}
                  className={`w-12 h-6 ${localPolicies.oauthProviders.google ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.oauthProviders.google ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#262033] rounded-lg flex items-center justify-center text-white">
                    <Icons.Rocket size={20} />
                  </div>
                  <div>
                    <div className="text-sm text-white">GitHub</div>
                    <div className="text-xs text-[#6B6478]">Sign in with GitHub</div>
                  </div>
                </div>
                <button
                  onClick={() => handlePolicyChange('oauthProviders', 'github', !localPolicies.oauthProviders.github)}
                  className={`w-12 h-6 ${localPolicies.oauthProviders.github ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.oauthProviders.github ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <span className="text-lg font-bold">M</span>
                  </div>
                  <div>
                    <div className="text-sm text-white">Microsoft</div>
                    <div className="text-xs text-[#6B6478]">Sign in with Microsoft</div>
                  </div>
                </div>
                <button
                  onClick={() => handlePolicyChange('oauthProviders', 'microsoft', !localPolicies.oauthProviders.microsoft)}
                  className={`w-12 h-6 ${localPolicies.oauthProviders.microsoft ? 'bg-[#9F8FD4]' : 'bg-zinc-700'} rounded-full transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${localPolicies.oauthProviders.microsoft ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Admin Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">Invite Platform Admin</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">Display Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                    className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
                  >
                    <option value={AdminRole.ADMIN}>Admin</option>
                    <option value={AdminRole.SUPPORT}>Support</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  disabled={isInviting}
                  className="flex-1 py-3 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteAdmin}
                  disabled={isInviting || !inviteEmail}
                  className="flex-1 py-3 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSecurity;
