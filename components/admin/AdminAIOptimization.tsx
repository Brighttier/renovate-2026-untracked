import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../../contexts/AdminContext';
import { Icons } from '../Icons';
import { AI_MODELS } from '../../constants';

const AdminAIOptimization: React.FC = () => {
  const { aiConfig, updateAIConfig, aiConfigLoading, platformStats, aiUsageStats } = useAdmin();

  const [localConfig, setLocalConfig] = useState(aiConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = <K extends keyof typeof aiConfig>(key: K, value: typeof aiConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateAIConfig(localConfig);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalConfig(aiConfig);
    setHasChanges(false);
  };

  // Calculate real cost breakdown from AI usage stats
  const totalCost = aiUsageStats.totalCost || platformStats.totalAICost;
  const operationCosts = aiUsageStats.byOperation || {};

  // Map operations to display categories
  const costBreakdown = {
    siteGeneration: (operationCosts['site_generation']?.cost || 0) + (operationCosts['site_edit']?.cost || 0),
    leadSearch: operationCosts['lead_search']?.cost || 0,
    other: totalCost - ((operationCosts['site_generation']?.cost || 0) + (operationCosts['site_edit']?.cost || 0) + (operationCosts['lead_search']?.cost || 0))
  };

  // Calculate percentages
  const getPercentage = (value: number) => totalCost > 0 ? Math.round((value / totalCost) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">AI Model Configuration</h2>
          <p className="text-sm text-[#6B6478]">Configure AI models, parameters, and rate limits</p>
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
              disabled={aiConfigLoading}
              className="px-6 py-2 bg-[#9F8FD4] hover:bg-[#7C6BB5] rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
            >
              {aiConfigLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Model Settings */}
        <div className="col-span-2 space-y-6">
          {/* Primary Models */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Primary Models</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#6B6478] mb-2">Text Generation Model</label>
                <select
                  value={localConfig.primaryTextModel}
                  onChange={(e) => handleChange('primaryTextModel', e.target.value)}
                  className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
                >
                  {AI_MODELS.filter(m => m.capabilities.includes('text')).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} (${model.costPerCall}/call)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#6B6478] mb-2">Image Generation Model</label>
                <select
                  value={localConfig.primaryImageModel}
                  onChange={(e) => handleChange('primaryImageModel', e.target.value)}
                  className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
                >
                  {AI_MODELS.filter(m => m.capabilities.includes('image')).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} (${model.costPerCall}/call)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Generation Parameters */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Generation Parameters</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#6B6478]">Temperature</label>
                  <span className="text-sm text-white font-medium">{localConfig.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localConfig.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#262033] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#9F8FD4] [&::-webkit-slider-thumb]:rounded-full"
                />
                <div className="flex justify-between text-sm text-[#6B6478] mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#6B6478]">Max Tokens</label>
                  <span className="text-sm text-white font-medium">{localConfig.maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={localConfig.maxTokens}
                  onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                  className="w-full h-2 bg-[#262033] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#9F8FD4] [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0D0B14] rounded-xl">
                <div>
                  <div className="text-sm text-white font-medium">Search Grounding</div>
                  <div className="text-xs text-[#6B6478]">Enable Google Search for factual data</div>
                </div>
                <button
                  onClick={() => handleChange('enableSearchGrounding', !localConfig.enableSearchGrounding)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    localConfig.enableSearchGrounding ? 'bg-[#9F8FD4]' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    localConfig.enableSearchGrounding ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Rate Limiting */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Rate Limiting</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#6B6478] mb-2">Global Rate Limit (req/min)</label>
                <input
                  type="number"
                  value={localConfig.rateLimitPerMinute}
                  onChange={(e) => handleChange('rateLimitPerMinute', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B6478] mb-2">Per-User Limit (req/min)</label>
                <input
                  type="number"
                  value={localConfig.rateLimitPerUser}
                  onChange={(e) => handleChange('rateLimitPerUser', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#9F8FD4]/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cost & Usage Sidebar */}
        <div className="space-y-6">
          {/* Cost Overview */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Cost Overview (MTD)</h3>
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-white">${totalCost.toFixed(2)}</div>
                <div className="text-xs text-[#6B6478] mt-1">Total AI Spend</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6478]">Site Generation</span>
                  <span className="text-sm text-white">${costBreakdown.siteGeneration.toFixed(2)}</span>
                </div>
                <div className="w-full h-1.5 bg-[#262033] rounded-full overflow-hidden">
                  <div className="h-full bg-[#9F8FD4]" style={{ width: `${getPercentage(costBreakdown.siteGeneration)}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6478]">Lead Search</span>
                  <span className="text-sm text-white">${costBreakdown.leadSearch.toFixed(2)}</span>
                </div>
                <div className="w-full h-1.5 bg-[#262033] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${getPercentage(costBreakdown.leadSearch)}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6478]">Other</span>
                  <span className="text-sm text-white">${Math.max(0, costBreakdown.other).toFixed(2)}</span>
                </div>
                <div className="w-full h-1.5 bg-[#262033] rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${getPercentage(Math.max(0, costBreakdown.other))}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Usage Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#0D0B14] rounded-xl">
                <span className="text-xs text-[#6B6478]">Total Calls</span>
                <span className="text-sm text-white font-bold">{aiUsageStats.totalCalls || platformStats.totalAICalls}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0D0B14] rounded-xl">
                <span className="text-xs text-[#6B6478]">Avg Cost/Call</span>
                <span className="text-sm text-white font-bold">
                  ${aiUsageStats.totalCalls > 0
                    ? (aiUsageStats.totalCost / aiUsageStats.totalCalls).toFixed(4)
                    : '0.0000'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0D0B14] rounded-xl">
                <span className="text-xs text-[#6B6478]">Success Rate</span>
                <span className={`text-sm font-bold ${aiUsageStats.successRate >= 95 ? 'text-[#9F8FD4]' : aiUsageStats.successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {aiUsageStats.successRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Available Models */}
          <div className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Available Models</h3>
            <div className="space-y-2">
              {AI_MODELS.map(model => (
                <div
                  key={model.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    model.isEnabled ? 'bg-[#0D0B14]' : 'bg-[#0D0B14]/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${model.isEnabled ? 'bg-[#9F8FD4]' : 'bg-zinc-600'}`} />
                    <span className="text-xs text-white">{model.name}</span>
                  </div>
                  <span className="text-sm text-[#6B6478]">${model.costPerCall}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIOptimization;
