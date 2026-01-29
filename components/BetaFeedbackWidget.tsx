/**
 * Beta Feedback Widget
 * Floating widget for beta testers to submit feedback with screenshots
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { submitFeedback } from '../services/betaFeedbackService';
import { BetaFeedbackCategory } from '../types';

interface BetaFeedbackWidgetProps {
  userId?: string;
  userEmail?: string;
}

const CATEGORIES: { value: BetaFeedbackCategory; label: string; color: string }[] = [
  { value: 'bug', label: 'Bug Report', color: 'text-red-500' },
  { value: 'feature', label: 'Feature Request', color: 'text-purple-500' },
  { value: 'ux', label: 'UX Issue', color: 'text-cyan-500' },
  { value: 'other', label: 'Other', color: 'text-[#A8A3B3]' },
];

const BetaFeedbackWidget: React.FC<BetaFeedbackWidgetProps> = ({ userId, userEmail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BetaFeedbackCategory>('bug');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('bug');
    setScreenshot(null);
    setSubmitStatus('idle');
    setErrorMessage('');
  };

  const handleClose = () => {
    setIsOpen(false);
    if (submitStatus === 'success') {
      resetForm();
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Screenshot must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
        setErrorMessage('');
      };
      reader.readAsDataURL(file);
    }
  };

  const captureScreenshot = async () => {
    try {
      // Use native browser screenshot API if available
      if ('getDisplayMedia' in navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        stream.getTracks().forEach(track => track.stop());
        setScreenshot(canvas.toDataURL('image/png'));
      } else {
        // Fallback to file upload
        fileInputRef.current?.click();
      }
    } catch (err) {
      // User cancelled or permission denied - fallback to file upload
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setErrorMessage('Please fill in title and description');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await submitFeedback({
        userId,
        userEmail,
        title: title.trim(),
        description: description.trim(),
        category,
        screenshotDataUrl: screenshot || undefined,
      });

      setSubmitStatus('success');
      setTimeout(() => {
        handleClose();
        resetForm();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setErrorMessage('Failed to submit feedback. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Hidden file input for screenshot upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleScreenshotUpload}
        className="hidden"
      />

      {/* Floating Widget */}
      <div className="fixed bottom-6 right-6 z-[9999]">
        <AnimatePresence mode="wait">
          {!isOpen ? (
            // Collapsed Button
            <motion.button
              key="collapsed"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-white shadow-2xl shadow-amber-500/30 flex items-center justify-center transition-colors"
              title="Report Bug / Feedback"
            >
              <Icons.Bug size={24} />
            </motion.button>
          ) : (
            // Expanded Form
            <motion.div
              key="expanded"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-[380px] bg-[#1A1625] border border-[#9F8FD4]/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-[#262033]/50 border-b border-[#9F8FD4]/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Icons.Bug size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-amber-500">Beta</div>
                    <div className="text-sm font-bold text-white">Report Feedback</div>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-[#A8A3B3] hover:text-white transition-colors"
                >
                  <Icons.X size={18} />
                </button>
              </div>

              {/* Success State */}
              {submitStatus === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-[#9F8FD4]/20 flex items-center justify-center mx-auto mb-4">
                    <Icons.Check size={32} className="text-[#9F8FD4]" />
                  </div>
                  <div className="text-lg font-bold text-white mb-2">Thank You!</div>
                  <div className="text-sm text-[#A8A3B3]">Your feedback has been submitted successfully.</div>
                </motion.div>
              ) : (
                // Form
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-[#A8A3B3] mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      className="w-full px-4 py-3 bg-[#262033] border border-[#9F8FD4]/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-[#A8A3B3] mb-2">
                      Category
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          disabled={isSubmitting}
                          className={`px-3 py-2 rounded-lg text-sm font-black uppercase tracking-wider transition-all ${
                            category === cat.value
                              ? `bg-zinc-700 ${cat.color} border border-current`
                              : 'bg-[#262033] text-[#A8A3B3] border border-transparent hover:border-[#9F8FD4]/15'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-[#A8A3B3] mb-2">
                      Description *
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please describe what happened, steps to reproduce, and expected behavior..."
                      rows={4}
                      className="w-full px-4 py-3 bg-[#262033] border border-[#9F8FD4]/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-none"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Screenshot */}
                  <div>
                    <label className="block text-sm font-medium text-[#A8A3B3] mb-2">
                      Screenshot (Optional)
                    </label>
                    {screenshot ? (
                      <div className="relative group">
                        <img
                          src={screenshot}
                          alt="Screenshot preview"
                          className="w-full h-32 object-cover rounded-xl border border-[#9F8FD4]/15"
                        />
                        <button
                          type="button"
                          onClick={() => setScreenshot(null)}
                          disabled={isSubmitting}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Icons.X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={captureScreenshot}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-3 bg-[#262033] border border-[#9F8FD4]/15 rounded-xl text-sm text-[#A8A3B3] hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
                        >
                          <Icons.Camera size={16} />
                          Capture Screen
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="flex-1 px-4 py-3 bg-[#262033] border border-[#9F8FD4]/15 rounded-xl text-sm text-[#A8A3B3] hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
                        >
                          <Icons.Image size={16} />
                          Upload
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                      {errorMessage}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-[#262033] text-zinc-300 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !title.trim() || !description.trim()}
                      className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Icons.Loader size={14} className="animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Feedback'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default BetaFeedbackWidget;
