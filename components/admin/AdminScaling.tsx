import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Icons } from '../Icons';
import { ScalingConfig, ScrapingMetrics, RateLimitStats, RateLimitConfig } from '../../types';
import { getFunctions, httpsCallable } from 'firebase/functions';

const AdminScaling: React.FC = () => {
  const [config, setConfig] = useState<ScalingConfig | null>(null);
  const [metrics, setMetrics] = useState<ScrapingMetrics | null>(null);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localConfig, setLocalConfig] = useState<ScalingConfig | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const functions = getFunctions();

  // Fetch scaling config
  const fetchConfig = useCallback(async () => {
    try {
      const getScalingConfig = httpsCallable(functions, 'getScalingConfig');
      const result = await getScalingConfig();
      const data = result.data as ScalingConfig;
      setConfig(data);
      setLocalConfig(data);
    } catch (error) {
      console.error('Failed to fetch scaling config:', error);
    }
  }, [functions]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const getScrapingMetrics = httpsCallable(functions, 'getScrapingMetrics');
      const result = await getScrapingMetrics();
      setMetrics(result.data as ScrapingMetrics);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [functions]);

  // Fetch rate limit stats
  const fetchRateLimitStats = useCallback(async () => {
    try {
      const getRateLimitStats = httpsCallable(functions, 'getRateLimitStats');
      const result = await getRateLimitStats();
      setRateLimitStats(result.data as RateLimitStats);
    } catch (error) {
      console.error('Failed to fetch rate limit stats:', error);
    }
  }, [functions]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchMetrics(), fetchRateLimitStats()]);
      setLoading(false);
    };
    loadData();

    // Refresh metrics every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      fetchRateLimitStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchConfig, fetchMetrics, fetchRateLimitStats]);

  const handleRateLimitChange = (endpoint: string, field: keyof RateLimitConfig, value: number | boolean) => {
    if (!localConfig) return;

    setLocalConfig({
      ...localConfig,
      rateLimits: {
        ...localConfig.rateLimits,
        [endpoint]: {
          ...localConfig.rateLimits[endpoint],
          [field]: value
        }
      }
    });
    setHasChanges(true);
  };

  const handleCacheToggle = (enabled: boolean) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, cacheEnabled: enabled });
    setHasChanges(true);
  };

  const handleCacheTTLChange = (days: number) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, cacheTTLDays: days });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localConfig) return;

    setSaving(true);
    try {
      const updateScalingConfig = httpsCallable(functions, 'updateScalingConfig');
      await updateScalingConfig({
        rateLimits: localConfig.rateLimits,
        cacheEnabled: localConfig.cacheEnabled,
        cacheTTLDays: localConfig.cacheTTLDays
      });
      setConfig(localConfig);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setLocalConfig(config);
    setHasChanges(false);
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the scraping cache? This cannot be undone.')) {
      return;
    }

    setClearingCache(true);
    try {
      const clearScrapingCache = httpsCallable(functions, 'clearScrapingCache');
      const result = await clearScrapingCache();
      const data = result.data as { deleted: number; hasMore?: boolean };
      alert(`Cleared ${data.deleted} cached entries${data.hasMore ? '. More entries remain - run again to continue.' : '.'}`);
      fetchMetrics();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
    setClearingCache(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9F8FD4]"></div>
      </div>
    );
  }

  const endpoints = [
    { key: 'scrapeWebsite', label: 'Web Scraping', icon: Icons.Globe },
    { key: 'generateBlueprint', label: 'Site Generation', icon: Icons.Sparkles },
    { key: 'editBlueprint', label: 'Site Editing', icon: Icons.Code },
    { key: 'generateImage', label: 'Image Generation', icon: Icons.Folder },
    { key: 'findBusinesses', label: 'Business Search', icon: Icons.Search },
    { key: 'researchBusiness', label: 'Business Research', icon: Icons.FileText }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Scaling & Performance</h2>
          <p className="text-sm text-[#6B6478]">Configure rate limits, caching, and monitor usage</p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[#262033] hover:bg-zinc-700 rounded-xl text-sm text-white transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#9F8FD4]/10 flex items-center justify-center">
              <Icons.Folder size={20} className="text-[#B5A8E0]" />
            </div>
            <span className="text-xs text-[#6B6478]">Cached URLs</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.cachedUrls.toLocaleString() || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Icons.TrendingUp size={20} className="text-blue-400" />
            </div>
            <span className="text-xs text-[#6B6478]">Requests/Hour</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.requestsLastHour.toLocaleString() || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Icons.TrendingUp size={20} className="text-purple-400" />
            </div>
            <span className="text-xs text-[#6B6478]">Requests Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.requestsToday.toLocaleString() || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Icons.Zap size={20} className="text-orange-400" />
            </div>
            <span className="text-xs text-[#6B6478]">Cache Hit Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics?.cacheHitRate || 0}%</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Rate Limits */}
        <div className="col-span-2 space-y-4">
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Rate Limits per Endpoint</h3>
              <span className="text-xs text-[#6B6478]">Requests per minute per IP</span>
            </div>

            <div className="space-y-4">
              {endpoints.map(({ key, label, icon: Icon }) => {
                const limit = localConfig?.rateLimits?.[key] || { maxRequests: 30, windowMs: 60000 };
                const stats = rateLimitStats?.[key];

                return (
                  <div key={key} className="flex items-center gap-4 p-3 bg-[#0D0B14]/50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-[#262033] flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#A8A3B3]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{label}</span>
                        {stats && (
                          <span className="text-xs text-[#6B6478]">
                            {stats.activeUsers} active users | {stats.totalRequests} req/hr
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={limit.maxRequests}
                          onChange={(e) => handleRateLimitChange(key, 'maxRequests', parseInt(e.target.value))}
                          className="flex-1 h-2 bg-[#262033] rounded-lg appearance-none cursor-pointer accent-[#9F8FD4]"
                        />
                        <div className="w-20 flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={limit.maxRequests}
                            onChange={(e) => handleRateLimitChange(key, 'maxRequests', parseInt(e.target.value) || 1)}
                            className="w-14 px-2 py-1 bg-[#262033] border border-[#9F8FD4]/10 rounded text-sm text-white text-center"
                          />
                          <span className="text-xs text-[#6B6478]">/min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cache Settings */}
        <div className="space-y-4">
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Cache Settings</h3>

            <div className="space-y-4">
              {/* Cache Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#0D0B14]/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">URL Caching</p>
                  <p className="text-xs text-[#6B6478]">Cache scraped content to reduce load</p>
                </div>
                <button
                  onClick={() => handleCacheToggle(!localConfig?.cacheEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    localConfig?.cacheEnabled ? 'bg-[#9F8FD4]' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      localConfig?.cacheEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Cache TTL */}
              <div className="p-3 bg-[#0D0B14]/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Cache Duration</p>
                  <span className="text-sm text-[#B5A8E0]">{localConfig?.cacheTTLDays || 7} days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={localConfig?.cacheTTLDays || 7}
                  onChange={(e) => handleCacheTTLChange(parseInt(e.target.value))}
                  disabled={!localConfig?.cacheEnabled}
                  className="w-full h-2 bg-[#262033] rounded-lg appearance-none cursor-pointer accent-[#9F8FD4] disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-[#6B6478] mt-1">
                  <span>1 day</span>
                  <span>30 days</span>
                </div>
              </div>

              {/* Clear Cache Button */}
              <button
                onClick={handleClearCache}
                disabled={clearingCache || (metrics?.cachedUrls || 0) === 0}
                className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearingCache ? 'Clearing...' : `Clear Cache (${metrics?.cachedUrls || 0} entries)`}
              </button>
            </div>
          </div>

          {/* Auto-Scaling Info */}
          <div className="bg-[#9F8FD4]/5 border border-[#9F8FD4]/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#9F8FD4]/10 flex items-center justify-center shrink-0">
                <Icons.Rocket size={16} className="text-[#B5A8E0]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#B5A8E0] mb-1">Full Auto-Scale Enabled</h4>
                <p className="text-xs text-[#A8A3B3]">
                  Scraping function scales automatically up to 80,000 concurrent requests.
                  Rate limits protect against abuse while allowing legitimate high traffic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminScaling;
