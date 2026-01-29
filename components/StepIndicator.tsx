
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  const { isDark } = useTheme();
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <div className="flex justify-between items-center mb-3">
        <span className={`text-xs font-medium ${isDark ? 'text-[#A8B3B7]' : 'text-[#63696c]'}`}>
          Step {currentStep} of {totalSteps}
        </span>
        <span className={`text-xs font-medium ${isDark ? 'text-[#A8B3B7]' : 'text-[#63696c]'}`}>
          {Math.round(progress)}% Complete
        </span>
      </div>
      <div className={`w-full h-2 rounded-full overflow-visible relative ${isDark ? 'bg-[#1D2D33]' : 'bg-[#E8E8E8]'}`}>
        <div
          className="h-full bg-gradient-to-r from-[#9B8CF7] via-[#8B5CF6] to-[var(--accent-pink)] transition-all duration-500 ease-out rounded-full"
          style={{
            width: `${progress}%`,
            boxShadow: progress > 0 ? '0 0 12px var(--accent-pink-glow), 0 0 20px var(--accent-pink-glow)' : 'none'
          }}
        />
      </div>
    </div>
  );
};

export default StepIndicator;
