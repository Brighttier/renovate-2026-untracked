/**
 * DomainConnectionProgress Component
 *
 * Real-time progress UI for domain connection flow.
 * Shows step-by-step progress with status indicators.
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { customDomainService } from '../services/customDomainService';
import { GetDomainStatusResponse, DomainConnectionStatus } from '../types';

interface DomainConnectionProgressProps {
  domainConnectionId: string;
  domain: string;
  onComplete: (success: boolean, domain: string) => void;
  onError?: (error: string) => void;
}

interface Step {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

const DomainConnectionProgress: React.FC<DomainConnectionProgressProps> = ({
  domainConnectionId,
  domain,
  onComplete,
  onError
}) => {
  const [currentStatus, setCurrentStatus] = useState<GetDomainStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Define the steps
  const getSteps = (status: GetDomainStatusResponse | null): Step[] => {
    const steps: Step[] = [
      {
        id: 'registered',
        label: 'Domain Registered',
        description: 'Domain added to Firebase Hosting',
        status: status?.steps.domainRegistered ? 'completed' : 'pending'
      },
      {
        id: 'dns',
        label: 'Configuring DNS',
        description: 'Adding A records and TXT verification',
        status: 'pending'
      },
      {
        id: 'verification',
        label: 'Verifying Ownership',
        description: 'Checking TXT record propagation',
        status: 'pending'
      },
      {
        id: 'ssl',
        label: 'Provisioning SSL',
        description: 'Generating SSL certificate',
        status: 'pending'
      }
    ];

    if (!status) return steps;

    // Update step statuses based on current domain status
    const domainStatus = status.status;

    // DNS Configuration
    if (['dns_propagating', 'pending_ssl', 'ssl_provisioning', 'connected'].includes(domainStatus)) {
      steps[1].status = 'completed';
    } else if (domainStatus === 'pending_dns' || domainStatus === 'pending_verification') {
      steps[1].status = 'active';
    }

    // Verification
    if (status.steps.ownershipVerified || ['pending_ssl', 'ssl_provisioning', 'connected'].includes(domainStatus)) {
      steps[2].status = 'completed';
    } else if (domainStatus === 'dns_propagating' || domainStatus === 'pending_verification') {
      steps[2].status = 'active';
    } else if (domainStatus === 'verification_failed') {
      steps[2].status = 'error';
    }

    // SSL
    if (status.steps.sslProvisioned || domainStatus === 'connected') {
      steps[3].status = 'completed';
    } else if (domainStatus === 'ssl_provisioning' || domainStatus === 'pending_ssl') {
      steps[3].status = 'active';
    }

    return steps;
  };

  // Start polling on mount
  useEffect(() => {
    cleanupRef.current = customDomainService.pollDomainStatus(
      domainConnectionId,
      (status) => {
        setCurrentStatus(status);

        // Check for completion
        if (status.status === 'connected') {
          onComplete(true, domain);
        }

        // Check for error
        if (customDomainService.isErrorStatus(status.status)) {
          const errorMsg = status.errorMessage || status.message || 'Domain connection failed';
          setError(errorMsg);
          if (onError) onError(errorMsg);
        }
      },
      {
        intervalMs: 15000, // Check every 15 seconds
        maxAttempts: 40,   // Up to 10 minutes
        onError: (err) => {
          const errorMsg = err instanceof Error ? err.message : 'Connection error';
          setError(errorMsg);
          if (onError) onError(errorMsg);
        }
      }
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [domainConnectionId, domain, onComplete, onError]);

  const steps = getSteps(currentStatus);

  const StepIcon = ({ status }: { status: Step['status'] }) => {
    switch (status) {
      case 'completed':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-8 h-8 rounded-full bg-[#9B8CF7] flex items-center justify-center"
          >
            <Icons.Check size={16} className="text-white" />
          </motion.div>
        );
      case 'active':
        return (
          <div className="w-8 h-8 rounded-full bg-[#9B8CF7] flex items-center justify-center">
            <Icons.Loader size={16} className="text-white animate-spin" />
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center">
            <Icons.AlertCircle size={16} className="text-white" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icons.Globe size={32} className="text-[#9B8CF7]" />
        </div>
        <h2 className="text-2xl font-bold text-[#1E1B4B] mb-2">
          Connecting <span className="text-[#9B8CF7]">{domain}</span>
        </h2>
        <p className="text-[#6B7280] text-sm">
          {currentStatus?.message || 'Please wait while we configure your domain...'}
        </p>
      </motion.div>

      {/* Progress Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
              step.status === 'active'
                ? 'bg-[#F5F3FF] border border-[#9B8CF7]/20'
                : step.status === 'completed'
                ? 'bg-[#ECFDF5] border border-[#9B8CF7]/20'
                : step.status === 'error'
                ? 'bg-[#FEF2F2] border border-[#EF4444]/20'
                : 'bg-[#F9FAFB] border border-transparent'
            }`}
          >
            <StepIcon status={step.status} />
            <div className="flex-1">
              <h3 className={`font-semibold ${
                step.status === 'active' ? 'text-[#9B8CF7]' :
                step.status === 'completed' ? 'text-[#9B8CF7]' :
                step.status === 'error' ? 'text-[#EF4444]' :
                'text-[#6B7280]'
              }`}>
                {step.label}
              </h3>
              <p className="text-sm text-[#9CA3AF]">{step.description}</p>
            </div>
            {step.status === 'active' && (
              <span className="text-xs text-[#9B8CF7] font-medium">In progress</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 bg-[#FEF2F2] border border-[#EF4444]/20 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Icons.AlertCircle size={20} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#EF4444]">Connection Error</p>
                <p className="text-sm text-[#B91C1C]">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success State */}
      <AnimatePresence>
        {currentStatus?.status === 'connected' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-[#9B8CF7] rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Icons.Check size={40} className="text-white" />
            </motion.div>
            <h3 className="text-xl font-bold text-[#9B8CF7] mb-2">Domain Connected!</h3>
            <p className="text-[#6B7280]">
              Your site is now live at{' '}
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9B8CF7] hover:underline"
              >
                {domain}
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estimated Time */}
      {currentStatus?.status !== 'connected' && !error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-xs text-[#9CA3AF]"
        >
          This typically takes 5-15 minutes. You can leave this page and come back later.
        </motion.p>
      )}
    </div>
  );
};

export default DomainConnectionProgress;
