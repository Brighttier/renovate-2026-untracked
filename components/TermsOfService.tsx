
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';

interface TermsOfServiceProps {
  onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] bg-white/98 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-10 w-10 group-hover:scale-105 transition-transform duration-300" />
            <span className="font-semibold text-lg text-[#1E1B4B] tracking-tight headline-font">
              Renovate<span className="text-[#9B8CF7]">MySite</span>
            </span>
          </button>
          <button
            onClick={onBack}
            className="nav-link-reveal text-sm font-medium text-[#9B8CF7] hover:text-[#8B5CF6]"
          >
            <span className="flex items-center gap-2">
              <Icons.ArrowLeft size={16} />
              Back to Home
            </span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-[#F5F3FF] to-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-[#1E1B4B] mb-4 headline-font">
              Terms of Service
            </h1>
            <p className="text-[#6B7280] text-lg">
              Last updated: January 2026
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="prose prose-lg max-w-none"
          >
            {/* Introduction */}
            <div className="bg-[#F9FAFB] rounded-[20px] p-8 mb-8">
              <p className="text-[#1E1B4B] leading-relaxed mb-4">
                These Terms of Service ("Terms") govern your access to and use of the RenovateMySite website, application, and related services (collectively, the "Service").
              </p>
              <p className="text-[#1E1B4B] leading-relaxed mb-4">
                RenovateMySite ("RenovateMySite," "RMS," "we," "us," or "our") is a product operated by <strong>Bright Tier Solutions, LLC</strong> ("Bright Tier Solutions").
              </p>
              <p className="text-[#1E1B4B] leading-relaxed">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">1</span>
                Eligibility
              </h2>
              <p className="text-[#6B7280] mb-4">
                You must be at least 18 years old to use RenovateMySite.
              </p>
              <p className="text-[#6B7280] mb-3">By using the Service, you represent that:</p>
              <ul className="space-y-2">
                {[
                  'You are legally able to enter into a binding contract',
                  'You are using the Service for lawful purposes only'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 2 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">2</span>
                Description of the Service
              </h2>
              <p className="text-[#6B7280] mb-3">RenovateMySite is an AI-powered platform that enables users to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Discover local businesses by type and location',
                  'Generate AI-created website previews',
                  'Share previews as sales pitches',
                  'Set pricing and manage client outreach',
                  'Upsell optional AI-powered features'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="bg-[#F5F3FF] rounded-xl p-4">
                <p className="text-[#1E1B4B] font-semibold">RenovateMySite provides tools only. We do not guarantee sales, income, or business outcomes.</p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">3</span>
                Account Registration
              </h2>
              <p className="text-[#6B7280] mb-4">
                To access certain features, you must create an account.
              </p>
              <p className="text-[#6B7280] mb-3">You agree to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Provide accurate and complete information',
                  'Keep your login credentials secure',
                  'Be responsible for all activity under your account'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                We reserve the right to suspend or terminate accounts that violate these Terms.
              </p>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">4</span>
                Subscriptions, Payments & Billing
              </h2>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">4.1 Subscriptions</h3>
              <p className="text-[#6B7280] mb-6">
                Some features require a paid subscription. Pricing, usage limits, and plan details are displayed at checkout.
              </p>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">4.2 Payments</h3>
              <p className="text-[#6B7280] mb-6">
                Payments are processed by third-party payment providers (e.g., Stripe). We do not store your full payment details.
              </p>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">4.3 Fees & Refunds</h3>
              <ul className="space-y-2">
                {[
                  'Subscription fees are billed in advance',
                  'All fees are non-refundable unless otherwise stated',
                  'We reserve the right to change pricing with reasonable notice'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">5</span>
                User Responsibilities
              </h2>
              <p className="text-[#6B7280] mb-3">You are solely responsible for:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'How you use generated website previews',
                  'Communications with potential clients',
                  'Setting prices, negotiating terms, and collecting payment from your clients',
                  'Ensuring compliance with applicable laws when offering services to third parties'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="bg-[#F5F3FF] rounded-xl p-4">
                <p className="text-[#1E1B4B] font-semibold">RenovateMySite does not act as an employer, agent, broker, or intermediary.</p>
              </div>
            </div>

            {/* Section 6 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">6</span>
                AI-Generated Content Disclaimer
              </h2>
              <p className="text-[#6B7280] mb-4">
                RenovateMySite uses artificial intelligence to generate content.
              </p>
              <p className="text-[#6B7280] mb-3">You acknowledge that:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'AI-generated outputs may contain inaccuracies or incomplete information',
                  'You are responsible for reviewing and validating outputs before use',
                  'AI content is provided "as is" without warranties'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                We are not responsible for decisions made based on AI-generated content.
              </p>
            </div>

            {/* Section 7 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">7</span>
                Intellectual Property
              </h2>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">7.1 Our Property</h3>
              <p className="text-[#6B7280] mb-3">
                All software, branding, trademarks, UI elements, and platform features are owned by Bright Tier Solutions.
              </p>
              <p className="text-[#6B7280] mb-3">You may not:</p>
              <ul className="space-y-2 mb-6">
                {[
                  'Copy, modify, or reverse-engineer the Service',
                  'Use our branding without permission'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">7.2 Your Content</h3>
              <p className="text-[#6B7280] mb-3">
                You retain ownership of content you input and generate using the Service.
              </p>
              <p className="text-[#6B7280]">
                By using the Service, you grant us a limited license to process your content solely to operate and improve the platform.
              </p>
            </div>

            {/* Section 8 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">8</span>
                Prohibited Uses
              </h2>
              <p className="text-[#6B7280] mb-3">You agree not to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Use the Service for illegal or fraudulent activities',
                  'Misrepresent yourself or RMS to third parties',
                  'Violate intellectual property or privacy rights',
                  'Attempt to bypass usage limits or security measures',
                  'Scrape, resell, or abuse platform resources'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                We reserve the right to suspend or terminate accounts for violations.
              </p>
            </div>

            {/* Section 9 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">9</span>
                Third-Party Services
              </h2>
              <p className="text-[#6B7280] mb-4">
                The Service may integrate with third-party services (e.g., hosting, domains, analytics).
              </p>
              <p className="text-[#6B7280] mb-3">We are not responsible for:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Third-party terms or performance',
                  'Issues arising from external platforms'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                Your use of third-party services is governed by their own terms.
              </p>
            </div>

            {/* Section 10 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">10</span>
                Termination
              </h2>
              <p className="text-[#6B7280] mb-4">
                You may cancel your account at any time.
              </p>
              <p className="text-[#6B7280] mb-3">We may suspend or terminate your access if:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'You violate these Terms',
                  'Your usage poses legal, security, or operational risk',
                  'Required by law'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                Upon termination, your access to the Service will cease.
              </p>
            </div>

            {/* Section 11 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">11</span>
                Disclaimer of Warranties
              </h2>
              <div className="bg-[#F5F3FF] rounded-xl p-4 mb-4">
                <p className="text-[#1E1B4B] font-semibold">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."</p>
              </div>
              <p className="text-[#6B7280] mb-3">We disclaim all warranties, including:</p>
              <ul className="space-y-2">
                {[
                  'Fitness for a particular purpose',
                  'Accuracy of AI-generated content',
                  'Guaranteed income, results, or performance'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 12 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">12</span>
                Limitation of Liability
              </h2>
              <p className="text-[#6B7280] mb-4">
                To the maximum extent permitted by law:
              </p>
              <p className="text-[#6B7280] mb-3">RenovateMySite and Bright Tier Solutions shall not be liable for:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Lost profits or revenue',
                  'Business interruptions',
                  'Indirect, incidental, or consequential damages'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                Our total liability shall not exceed the amount you paid us in the preceding 12 months.
              </p>
            </div>

            {/* Section 13 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">13</span>
                Indemnification
              </h2>
              <p className="text-[#6B7280] mb-3">
                You agree to indemnify and hold harmless RenovateMySite and Bright Tier Solutions from claims arising out of:
              </p>
              <ul className="space-y-2">
                {[
                  'Your use of the Service',
                  'Your interactions with third parties',
                  'Your violation of these Terms'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 14 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">14</span>
                Governing Law & Dispute Resolution
              </h2>
              <p className="text-[#6B7280] mb-4">
                These Terms are governed by the laws of the United States and the State of Georgia, without regard to conflict of law principles.
              </p>
              <p className="text-[#6B7280]">
                Any disputes shall be resolved exclusively in the appropriate courts of that jurisdiction.
              </p>
            </div>

            {/* Section 15 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">15</span>
                Changes to These Terms
              </h2>
              <p className="text-[#6B7280]">
                We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.
              </p>
            </div>

            {/* Section 16 - Contact */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">16</span>
                Contact Information
              </h2>
              <p className="text-[#6B7280] mb-4">
                If you have questions about these Terms, contact us at:
              </p>
              <div className="bg-[#F9FAFB] rounded-[20px] p-8">
                <p className="text-[#1E1B4B] font-semibold text-lg mb-2">RenovateMySite</p>
                <p className="text-[#6B7280] mb-2">Operated by Bright Tier Solutions, LLC</p>
                <p className="text-[#6B7280]">
                  Email: <a href="mailto:support@renovatemysite.com" className="text-[#9B8CF7] hover:text-[#8B5CF6] transition-colors font-medium">support@renovatemysite.com</a>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#1E1B4B]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 group"
            >
              <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-10 w-10 rounded-lg" />
              <span className="font-semibold text-lg text-white tracking-tight headline-font">
                Renovate<span className="text-[#9B8CF7]">MySite</span>
              </span>
            </button>
            <div className="text-white/40 text-sm text-center md:text-right">
              <p>© 2026 RenovateMySite. All rights reserved.</p>
              <p>RenovateMySite is a product of Bright Tier Solutions, LLC.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 w-12 h-12 bg-[#9B8CF7] text-white rounded-full shadow-lg hover:bg-[#8B5CF6] transition-colors flex items-center justify-center"
      >
        <Icons.ArrowUp size={20} />
      </button>
    </div>
  );
};

export default TermsOfService;
