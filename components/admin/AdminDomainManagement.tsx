/**
 * AdminDomainManagement Component
 *
 * Admin panel for managing custom domain connections across the platform.
 * Displays all domain connections with their status, allows disconnection,
 * and provides overview metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { DomainConnectionStatus } from '../../types';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, Timestamp, Firestore } from 'firebase/firestore';
import { getFirebaseDb } from '../../services/firebase';

// Domain connection data from Firestore
interface DomainConnectionRecord {
  id: string;
  domain: string;
  subdomain?: string;
  agencyId: string;
  leadId: string;
  userId: string;
  firebaseSiteId: string;
  connectionMethod: 'GoDaddy' | 'Manual';
  status: DomainConnectionStatus;
  verificationToken: string;
  ownershipVerifiedAt?: string;
  sslStatus: 'pending' | 'provisioning' | 'active' | 'failed';
  sslProvisionedAt?: string;
  sslCertExpiry?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  connectedAt?: string;
  errorMessage?: string;
  errorCount: number;
  checkCount: number;
}

const AdminDomainManagement: React.FC = () => {
  const [domains, setDomains] = useState<DomainConnectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DomainConnectionStatus | 'all'>('all');
  const [sslFilter, setSslFilter] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<DomainConnectionRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscribe to domain connections from Firestore
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      console.error('Firebase not initialized');
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'domain_connections'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const domainsData: DomainConnectionRecord[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as DomainConnectionRecord));
      setDomains(domainsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching domains:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter domains based on search and filters
  const filteredDomains = useMemo(() => {
    return domains.filter(domain => {
      const matchesSearch = domain.domain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || domain.status === statusFilter;
      const matchesSsl = sslFilter === 'all' || domain.sslStatus === sslFilter;
      return matchesSearch && matchesStatus && matchesSsl;
    });
  }, [domains, searchTerm, statusFilter, sslFilter]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: domains.length,
    connected: domains.filter(d => d.status === 'connected').length,
    pending: domains.filter(d => ['pending_verification', 'pending_dns', 'dns_propagating', 'pending_ssl', 'ssl_provisioning'].includes(d.status)).length,
    failed: domains.filter(d => ['error', 'verification_failed'].includes(d.status)).length,
    sslActive: domains.filter(d => d.sslStatus === 'active').length
  }), [domains]);

  // Handle domain deletion
  const handleDelete = async (domainId: string) => {
    setIsDeleting(true);
    try {
      const db = getFirebaseDb();
      if (!db) throw new Error('Firebase not initialized');
      await deleteDoc(doc(db, 'domain_connections', domainId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert('Failed to delete domain connection');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format timestamp
  const formatDate = (timestamp: string | Timestamp | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge color
  const getStatusColor = (status: DomainConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-[#9B8CF7]/20 text-[#9B8CF7]';
      case 'pending_verification':
      case 'pending_dns':
      case 'dns_propagating':
      case 'pending_ssl':
      case 'ssl_provisioning':
        return 'bg-[#F59E0B]/20 text-[#F59E0B]';
      case 'verification_failed':
      case 'error':
        return 'bg-[#EF4444]/20 text-[#EF4444]';
      case 'disconnected':
        return 'bg-[#6B7280]/20 text-[#6B7280]';
      default:
        return 'bg-[#6B7280]/20 text-[#6B7280]';
    }
  };

  // Get SSL badge color
  const getSslColor = (sslStatus: string) => {
    switch (sslStatus) {
      case 'active':
        return 'bg-[#9B8CF7]/20 text-[#9B8CF7]';
      case 'provisioning':
        return 'bg-[#F59E0B]/20 text-[#F59E0B]';
      case 'failed':
        return 'bg-[#EF4444]/20 text-[#EF4444]';
      default:
        return 'bg-[#6B7280]/20 text-[#6B7280]';
    }
  };

  // Format status label
  const formatStatus = (status: DomainConnectionStatus) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icons.Loader size={32} className="animate-spin text-[#9F8FD4]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Domains', value: stats.total, icon: <Icons.Globe size={20} />, color: 'text-[#9F8FD4]' },
          { label: 'Connected', value: stats.connected, icon: <Icons.Check size={20} />, color: 'text-[#9B8CF7]' },
          { label: 'Pending', value: stats.pending, icon: <Icons.Loader size={20} />, color: 'text-[#F59E0B]' },
          { label: 'Failed', value: stats.failed, icon: <Icons.AlertCircle size={20} />, color: 'text-[#EF4444]' },
          { label: 'SSL Active', value: stats.sslActive, icon: <Icons.Shield size={20} />, color: 'text-[#9B8CF7]' }
        ].map((stat, i) => (
          <div key={i} className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-[#6B6478]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DomainConnectionStatus | 'all')}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
        >
          <option value="all">All Status</option>
          <option value="connected">Connected</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="dns_propagating">DNS Propagating</option>
          <option value="ssl_provisioning">SSL Provisioning</option>
          <option value="error">Error</option>
          <option value="disconnected">Disconnected</option>
        </select>

        {/* SSL Filter */}
        <select
          value={sslFilter}
          onChange={(e) => setSslFilter(e.target.value)}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
        >
          <option value="all">All SSL</option>
          <option value="active">SSL Active</option>
          <option value="provisioning">SSL Provisioning</option>
          <option value="pending">SSL Pending</option>
          <option value="failed">SSL Failed</option>
        </select>

        <div className="text-sm text-[#6B6478]">
          {filteredDomains.length} domains
        </div>
      </div>

      {/* Domains Table */}
      <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#9F8FD4]/10">
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Domain</th>
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">SSL</th>
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Method</th>
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Created</th>
              <th className="text-left text-xs font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDomains.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[#6B6478]">
                  <Icons.Globe size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No domain connections found</p>
                </td>
              </tr>
            ) : (
              filteredDomains.map((domain) => (
                <tr key={domain.id} className="border-b border-[#9F8FD4]/5 hover:bg-[#9F8FD4]/5 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#9F8FD4]/10 rounded-lg flex items-center justify-center">
                        <Icons.Globe size={16} className="text-[#9F8FD4]" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{domain.domain}</div>
                        <div className="text-xs text-[#6B6478]">
                          {domain.connectedAt ? (
                            <a
                              href={`https://${domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#9F8FD4] hover:underline"
                            >
                              Visit site
                            </a>
                          ) : (
                            `Lead: ${domain.leadId.slice(0, 8)}...`
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(domain.status)}`}>
                      {formatStatus(domain.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSslColor(domain.sslStatus)}`}>
                      {domain.sslStatus.charAt(0).toUpperCase() + domain.sslStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-[#A8A3B3]">{domain.connectionMethod}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-[#6B6478]">{formatDate(domain.createdAt)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDomain(domain)}
                        className="p-2 hover:bg-[#9F8FD4]/10 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Icons.Eye size={16} className="text-[#A8A3B3]" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(domain.id)}
                        className="p-2 hover:bg-[#EF4444]/10 rounded-lg transition-colors"
                        title="Remove Domain"
                      >
                        <Icons.X size={16} className="text-[#EF4444]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Domain Details Modal */}
      <AnimatePresence>
        {selectedDomain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedDomain(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/20 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Domain Details</h2>
                <button
                  onClick={() => setSelectedDomain(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Icons.X size={20} className="text-[#6B6478]" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center">
                    <Icons.Globe size={24} className="text-[#9F8FD4]" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{selectedDomain.domain}</div>
                    <div className="text-sm text-[#6B6478]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDomain.status)}`}>
                        {formatStatus(selectedDomain.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">Connection Method</div>
                    <div className="text-white font-medium">{selectedDomain.connectionMethod}</div>
                  </div>
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">SSL Status</div>
                    <div className={`font-medium ${getSslColor(selectedDomain.sslStatus).replace('bg-', 'text-').split(' ')[0]}`}>
                      {selectedDomain.sslStatus.charAt(0).toUpperCase() + selectedDomain.sslStatus.slice(1)}
                    </div>
                  </div>
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">Created</div>
                    <div className="text-white text-sm">{formatDate(selectedDomain.createdAt)}</div>
                  </div>
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">Connected</div>
                    <div className="text-white text-sm">{formatDate(selectedDomain.connectedAt)}</div>
                  </div>
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">Check Count</div>
                    <div className="text-white font-medium">{selectedDomain.checkCount || 0}</div>
                  </div>
                  <div className="bg-[#262033] rounded-xl p-4">
                    <div className="text-xs text-[#6B6478] mb-1">Error Count</div>
                    <div className="text-white font-medium">{selectedDomain.errorCount || 0}</div>
                  </div>
                </div>

                {selectedDomain.errorMessage && (
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4">
                    <div className="text-xs text-[#EF4444] mb-1">Error Message</div>
                    <div className="text-[#EF4444] text-sm">{selectedDomain.errorMessage}</div>
                  </div>
                )}

                <div className="bg-[#262033] rounded-xl p-4">
                  <div className="text-xs text-[#6B6478] mb-1">Verification Token</div>
                  <div className="text-white text-xs font-mono break-all">{selectedDomain.verificationToken}</div>
                </div>

                <div className="pt-4 border-t border-[#9F8FD4]/10">
                  <div className="text-xs text-[#6B6478] mb-2">IDs</div>
                  <div className="space-y-1 text-xs font-mono text-[#A8A3B3]">
                    <div>Domain: {selectedDomain.id}</div>
                    <div>Lead: {selectedDomain.leadId}</div>
                    <div>User: {selectedDomain.userId}</div>
                    <div>Agency: {selectedDomain.agencyId}</div>
                  </div>
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
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/20 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#EF4444]/10 rounded-full flex items-center justify-center">
                  <Icons.AlertTriangle size={24} className="text-[#EF4444]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Remove Domain</h3>
                  <p className="text-sm text-[#6B6478]">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-[#A8A3B3] mb-6">
                Are you sure you want to remove this domain connection? The domain will need to be reconfigured if you want to connect it again.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 bg-[#262033] hover:bg-[#2F2941] rounded-xl text-white font-medium transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Icons.Loader size={16} className="animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Icons.X size={16} />
                      Remove
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDomainManagement;
