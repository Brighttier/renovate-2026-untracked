/**
 * Admin Beta Errors/Feedback Panel
 * View and manage beta tester feedback and bug reports
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { BetaFeedback, BetaFeedbackStatus, BetaFeedbackCategory } from '../../types';
import { getFeedback, updateFeedbackStatus, getFeedbackStats } from '../../services/betaFeedbackService';

const STATUS_CONFIG: Record<BetaFeedbackStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  in_progress: { label: 'In Progress', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  resolved: { label: 'Resolved', color: 'text-[#9F8FD4]', bgColor: 'bg-[#9F8FD4]/10' },
};

const CATEGORY_CONFIG: Record<BetaFeedbackCategory, { label: string; color: string; bgColor: string }> = {
  bug: { label: 'Bug', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  feature: { label: 'Feature', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ux: { label: 'UX', color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  other: { label: 'Other', color: 'text-[#A8A3B3]', bgColor: 'bg-zinc-500/10' },
};

const AdminBetaErrors: React.FC = () => {
  const [feedback, setFeedback] = useState<BetaFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    byCategory: Record<BetaFeedbackCategory, number>;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<BetaFeedbackStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<BetaFeedbackCategory | 'all'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<BetaFeedback | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Load feedback on mount
  useEffect(() => {
    loadFeedback();
    loadStats();
  }, []);

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const data = await getFeedback();
      setFeedback(data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getFeedbackStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const filteredFeedback = useMemo(() => {
    return feedback.filter(fb => {
      const matchesSearch =
        !searchTerm ||
        fb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fb.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fb.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || fb.status === selectedStatus;
      const matchesCategory = selectedCategory === 'all' || fb.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [feedback, searchTerm, selectedStatus, selectedCategory]);

  const handleStatusUpdate = async (feedbackId: string, newStatus: BetaFeedbackStatus) => {
    setIsUpdating(true);
    try {
      await updateFeedbackStatus(
        feedbackId,
        newStatus,
        newStatus === 'resolved' ? resolutionNote : undefined
      );

      // Update local state
      setFeedback(prev => prev.map(fb =>
        fb.id === feedbackId
          ? { ...fb, status: newStatus, resolution: newStatus === 'resolved' ? resolutionNote : fb.resolution, updatedAt: new Date().toISOString() }
          : fb
      ));

      // Update selected feedback if it's the one being updated
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => prev ? { ...prev, status: newStatus, resolution: newStatus === 'resolved' ? resolutionNote : prev.resolution } : null);
      }

      setResolutionNote('');
      loadStats(); // Refresh stats
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Beta Feedback & Errors</h2>
          <p className="text-sm text-[#6B6478]">Review and manage feedback from beta testers</p>
        </div>
        <button
          onClick={() => { loadFeedback(); loadStats(); }}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors disabled:opacity-50"
        >
          <Icons.History size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-[#6B6478]">Total Reports</div>
          </div>
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-500">{stats.open}</div>
            <div className="text-xs text-[#6B6478]">Open</div>
          </div>
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
            <div className="text-xs text-[#6B6478]">In Progress</div>
          </div>
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-[#9F8FD4]">{stats.resolved}</div>
            <div className="text-xs text-[#6B6478]">Resolved</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6478]" />
          <input
            type="text"
            placeholder="Search by title, description, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder:text-[#6B6478] outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
          />
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as BetaFeedbackStatus | 'all')}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as BetaFeedbackCategory | 'all')}
          className="px-4 py-2.5 bg-[#1A1625] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none"
        >
          <option value="all">All Categories</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="ux">UX Issue</option>
          <option value="other">Other</option>
        </select>

        <div className="text-sm text-[#6B6478]">
          {filteredFeedback.length} entries
        </div>
      </div>

      {/* Feedback Table */}
      <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#9F8FD4]/10">
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Date</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Title</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Category</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Reporter</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Status</th>
              <th className="text-left text-sm font-bold text-[#6B6478] uppercase tracking-wider px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Icons.Loader size={32} className="mx-auto text-[#6B6478] animate-spin mb-4" />
                  <p className="text-[#6B6478]">Loading feedback...</p>
                </td>
              </tr>
            ) : filteredFeedback.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Icons.Bug size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-[#6B6478]">No feedback found</p>
                </td>
              </tr>
            ) : (
              filteredFeedback.map((fb, index) => (
                <motion.tr
                  key={fb.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-[#9F8FD4]/10 hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => setSelectedFeedback(fb)}
                >
                  <td className="px-5 py-4">
                    <div className="text-xs text-white">{formatDate(fb.createdAt)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm text-white font-medium truncate max-w-[200px]">{fb.title}</div>
                    <div className="text-xs text-[#6B6478] truncate max-w-[200px]">{fb.description}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold uppercase ${CATEGORY_CONFIG[fb.category].color} ${CATEGORY_CONFIG[fb.category].bgColor}`}>
                      {CATEGORY_CONFIG[fb.category].label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-xs text-[#A8A3B3] truncate max-w-[150px]">
                      {fb.userEmail || fb.userId || 'Anonymous'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold uppercase ${STATUS_CONFIG[fb.status].color} ${STATUS_CONFIG[fb.status].bgColor}`}>
                      {STATUS_CONFIG[fb.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFeedback(fb); }}
                      className="px-3 py-1.5 bg-[#262033] hover:bg-zinc-700 rounded-lg text-xs text-white transition-colors"
                    >
                      View
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setSelectedFeedback(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#9F8FD4]/10">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-sm font-bold uppercase ${CATEGORY_CONFIG[selectedFeedback.category].color} ${CATEGORY_CONFIG[selectedFeedback.category].bgColor}`}>
                    {CATEGORY_CONFIG[selectedFeedback.category].label}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-sm font-bold uppercase ${STATUS_CONFIG[selectedFeedback.status].color} ${STATUS_CONFIG[selectedFeedback.status].bgColor}`}>
                    {STATUS_CONFIG[selectedFeedback.status].label}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-[#A8A3B3] hover:text-white transition-colors"
                >
                  <Icons.X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{selectedFeedback.title}</h3>
                  <p className="text-sm text-[#A8A3B3] whitespace-pre-wrap">{selectedFeedback.description}</p>
                </div>

                {/* Screenshot */}
                {selectedFeedback.screenshotUrl && (
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-2">
                      Screenshot
                    </label>
                    <img
                      src={selectedFeedback.screenshotUrl}
                      alt="Feedback screenshot"
                      className="w-full rounded-xl border border-[#9F8FD4]/15 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(selectedFeedback.screenshotUrl, '_blank')}
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-1">
                      Reporter
                    </label>
                    <div className="text-sm text-white">
                      {selectedFeedback.userEmail || selectedFeedback.userId || 'Anonymous'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-1">
                      Page URL
                    </label>
                    <div className="text-sm text-[#A8A3B3] font-mono truncate">
                      {selectedFeedback.pageUrl || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-1">
                      Submitted
                    </label>
                    <div className="text-sm text-[#A8A3B3]">
                      {new Date(selectedFeedback.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-1">
                      ID
                    </label>
                    <div className="text-sm text-[#6B6478] font-mono truncate">
                      {selectedFeedback.id}
                    </div>
                  </div>
                </div>

                {/* Resolution Note */}
                {selectedFeedback.resolution && (
                  <div>
                    <label className="block text-sm font-bold text-[#6B6478] font-medium mb-2">
                      Resolution
                    </label>
                    <div className="px-4 py-3 bg-[#9F8FD4]/10 border border-[#9F8FD4]/20 rounded-xl text-sm text-[#B5A8E0]">
                      {selectedFeedback.resolution}
                    </div>
                  </div>
                )}

                {/* Status Update */}
                <div className="border-t border-[#9F8FD4]/10 pt-6">
                  <label className="block text-sm font-bold text-[#6B6478] font-medium mb-3">
                    Update Status
                  </label>
                  <div className="flex gap-2 mb-4">
                    {(['open', 'in_progress', 'resolved'] as BetaFeedbackStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          if (status === 'resolved' && !resolutionNote.trim()) {
                            // Don't update yet, let user add resolution note
                            return;
                          }
                          handleStatusUpdate(selectedFeedback.id, status);
                        }}
                        disabled={isUpdating || selectedFeedback.status === status}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                          selectedFeedback.status === status
                            ? `${STATUS_CONFIG[status].bgColor} ${STATUS_CONFIG[status].color} border-2 border-current`
                            : 'bg-[#262033] text-[#A8A3B3] hover:bg-zinc-700 hover:text-white'
                        }`}
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>

                  {/* Resolution Note Input */}
                  {selectedFeedback.status !== 'resolved' && (
                    <div>
                      <label className="block text-sm font-bold text-[#6B6478] font-medium mb-2">
                        Resolution Note (required for resolved)
                      </label>
                      <textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Describe how this was resolved..."
                        rows={3}
                        className="w-full px-4 py-3 bg-[#262033] border border-[#9F8FD4]/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#9F8FD4]/50 resize-none"
                      />
                      {resolutionNote.trim() && (
                        <button
                          onClick={() => handleStatusUpdate(selectedFeedback.id, 'resolved')}
                          disabled={isUpdating}
                          className="mt-3 px-4 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating...' : 'Mark as Resolved'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBetaErrors;
