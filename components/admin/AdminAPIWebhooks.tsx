import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { APIScope, WebhookEventType } from '../../types';
import { API_SCOPE_LABELS, WEBHOOK_EVENT_LABELS } from '../../constants';

const AdminAPIWebhooks: React.FC = () => {
  const { apiKeys, webhooks, createAPIKey, revokeAPIKey, createWebhook, deleteWebhook, users } = useAdmin();

  const [activeTab, setActiveTab] = useState<'apikeys' | 'webhooks'>('apikeys');
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyUser, setNewKeyUser] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<APIScope[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookUser, setNewWebhookUser] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEventType[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleCreateKey = async () => {
    if (!newKeyName || !newKeyUser || newKeyScopes.length === 0) return;

    const result = await createAPIKey(newKeyUser, newKeyName, newKeyScopes as any);
    setGeneratedKey(result.key);
  };

  const handleCloseKeyModal = () => {
    setShowCreateKeyModal(false);
    setNewKeyName('');
    setNewKeyUser('');
    setNewKeyScopes([]);
    setGeneratedKey(null);
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl || !newWebhookUser || newWebhookEvents.length === 0) return;

    await createWebhook(newWebhookUser, newWebhookUrl, newWebhookEvents as any);
    setShowCreateWebhookModal(false);
    setNewWebhookUrl('');
    setNewWebhookUser('');
    setNewWebhookEvents([]);
  };

  const toggleScope = (scope: APIScope) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const toggleEvent = (event: WebhookEventType) => {
    setNewWebhookEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 p-1 bg-[#1A1625]/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'apikeys' ? 'bg-[#9F8FD4] text-white' : 'text-[#A8A3B3] hover:text-white'
          }`}
        >
          API Keys
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'webhooks' ? 'bg-[#9F8FD4] text-white' : 'text-[#A8A3B3] hover:text-white'
          }`}
        >
          Webhooks
        </button>
      </div>

      {/* API Keys Tab */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">API Keys ({apiKeys.length})</h3>
              <p className="text-xs text-[#6B6478]">Manage API access for users</p>
            </div>
            <button
              onClick={() => setShowCreateKeyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Icons.Rocket size={16} />
              Create API Key
            </button>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="py-12 text-center">
                <Icons.Rocket size={48} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-[#6B6478]">No API keys created yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#9F8FD4]/10">
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Name</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Key</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Scopes</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Created</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
                    <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(key => (
                    <tr key={key.id} className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-white">{key.name}</div>
                        <div className="text-xs text-[#6B6478]">
                          {users.find(u => u.id === key.userId)?.name || key.userId}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-xs text-[#A8A3B3] font-mono">{key.keyPrefix}...</code>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.slice(0, 2).map(scope => (
                            <span key={scope} className="px-2 py-0.5 bg-[#262033] rounded text-sm text-[#A8A3B3]">
                              {API_SCOPE_LABELS[scope]?.label || scope}
                            </span>
                          ))}
                          {key.scopes.length > 2 && (
                            <span className="px-2 py-0.5 bg-[#262033] rounded text-sm text-[#A8A3B3]">
                              +{key.scopes.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#A8A3B3]">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                          key.isActive ? 'bg-[#9F8FD4]/10 text-[#9F8FD4]' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {key.isActive && (
                            <button
                              onClick={() => revokeAPIKey(key.id)}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-medium text-red-500 transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Webhook Endpoints ({webhooks.length})</h3>
              <p className="text-xs text-[#6B6478]">Configure event notifications</p>
            </div>
            <button
              onClick={() => setShowCreateWebhookModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Icons.Rocket size={16} />
              Create Webhook
            </button>
          </div>

          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
            {webhooks.length === 0 ? (
              <div className="py-12 text-center">
                <Icons.Rocket size={48} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-[#6B6478]">No webhooks configured yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#9F8FD4]/10">
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Endpoint</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Events</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Last Triggered</th>
                    <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
                    <th className="text-right text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map(webhook => (
                    <tr key={webhook.id} className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="text-sm font-mono text-white truncate max-w-xs">{webhook.url}</div>
                        <div className="text-xs text-[#6B6478]">
                          {users.find(u => u.id === webhook.userId)?.name || webhook.userId}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 2).map(event => (
                            <span key={event} className="px-2 py-0.5 bg-[#262033] rounded text-sm text-[#A8A3B3]">
                              {WEBHOOK_EVENT_LABELS[event]?.label || event}
                            </span>
                          ))}
                          {webhook.events.length > 2 && (
                            <span className="px-2 py-0.5 bg-[#262033] rounded text-sm text-[#A8A3B3]">
                              +{webhook.events.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#A8A3B3]">
                        {webhook.lastTriggeredAt
                          ? new Date(webhook.lastTriggeredAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                          webhook.isActive
                            ? webhook.failureCount > 0
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-[#9F8FD4]/10 text-[#9F8FD4]'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {webhook.isActive ? (webhook.failureCount > 0 ? 'Degraded' : 'Active') : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-white/5 rounded-lg text-[#A8A3B3] hover:text-white" title="Test">
                            <Icons.Rocket size={14} />
                          </button>
                          <button
                            onClick={() => deleteWebhook(webhook.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-[#A8A3B3] hover:text-red-500"
                            title="Delete"
                          >
                            <Icons.Logout size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      <AnimatePresence>
        {showCreateKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={handleCloseKeyModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {generatedKey ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#9F8FD4]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icons.Rocket size={32} className="text-[#9F8FD4]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">API Key Created</h3>
                  <p className="text-sm text-[#A8A3B3] mb-4">Copy this key now. You won't be able to see it again.</p>
                  <div className="p-4 bg-[#0D0B14] rounded-xl mb-6">
                    <code className="text-sm text-[#9F8FD4] font-mono break-all">{generatedKey}</code>
                  </div>
                  <button
                    onClick={handleCloseKeyModal}
                    className="w-full py-3 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-white mb-4">Create API Key</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-[#6B6478] mb-2">Key Name</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Production API Key"
                        className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6B6478] mb-2">User</label>
                      <select
                        value={newKeyUser}
                        onChange={(e) => setNewKeyUser(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
                      >
                        <option value="">Select user...</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6B6478] mb-2">Scopes</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(APIScope).map(scope => (
                          <button
                            key={scope}
                            onClick={() => toggleScope(scope)}
                            className={`p-3 rounded-xl text-left transition-colors ${
                              newKeyScopes.includes(scope)
                                ? 'bg-[#9F8FD4]/10 border border-[#9F8FD4]/30'
                                : 'bg-[#0D0B14] border border-[#9F8FD4]/10'
                            }`}
                          >
                            <div className={`text-xs font-medium ${newKeyScopes.includes(scope) ? 'text-[#9F8FD4]' : 'text-white'}`}>
                              {API_SCOPE_LABELS[scope]?.label}
                            </div>
                            <div className="text-sm text-[#6B6478]">{API_SCOPE_LABELS[scope]?.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={handleCloseKeyModal}
                      className="flex-1 py-3 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName || !newKeyUser || newKeyScopes.length === 0}
                      className="flex-1 py-3 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                    >
                      Create Key
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Webhook Modal */}
      <AnimatePresence>
        {showCreateWebhookModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={() => setShowCreateWebhookModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">Create Webhook</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">Endpoint URL</label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://api.example.com/webhooks"
                    className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">User</label>
                  <select
                    value={newWebhookUser}
                    onChange={(e) => setNewWebhookUser(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
                  >
                    <option value="">Select user...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#6B6478] mb-2">Events</label>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {Object.values(WebhookEventType).map(event => (
                      <button
                        key={event}
                        onClick={() => toggleEvent(event)}
                        className={`w-full p-3 rounded-xl text-left transition-colors ${
                          newWebhookEvents.includes(event)
                            ? 'bg-[#9F8FD4]/10 border border-[#9F8FD4]/30'
                            : 'bg-[#0D0B14] border border-[#9F8FD4]/10'
                        }`}
                      >
                        <div className={`text-xs font-medium ${newWebhookEvents.includes(event) ? 'text-[#9F8FD4]' : 'text-white'}`}>
                          {WEBHOOK_EVENT_LABELS[event]?.label}
                        </div>
                        <div className="text-sm text-[#6B6478]">{WEBHOOK_EVENT_LABELS[event]?.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setShowCreateWebhookModal(false)}
                  className="flex-1 py-3 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWebhook}
                  disabled={!newWebhookUrl || !newWebhookUser || newWebhookEvents.length === 0}
                  className="flex-1 py-3 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                >
                  Create Webhook
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAPIWebhooks;
