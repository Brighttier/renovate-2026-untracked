
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
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
              Privacy Policy
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
                RenovateMySite ("RenovateMySite," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit or use our website, application, and related services (collectively, the "Service").
              </p>
              <p className="text-[#1E1B4B] leading-relaxed mb-4">
                RenovateMySite is a product operated by <strong>Bright Tier Solutions, LLC</strong> ("Bright Tier Solutions").
              </p>
              <p className="text-[#1E1B4B] leading-relaxed">
                By accessing or using the Service, you agree to the collection and use of information in accordance with this Privacy Policy.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">1</span>
                Information We Collect
              </h2>
              <p className="text-[#6B7280] mb-6">
                We collect information you provide directly to us, information collected automatically, and information from third parties.
              </p>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">1.1 Information You Provide to Us</h3>
              <p className="text-[#6B7280] mb-3">This may include:</p>
              <ul className="space-y-2 mb-6">
                {[
                  'Name',
                  'Email address',
                  'Account login credentials',
                  'Billing and payment information (processed by third-party payment providers)',
                  'Business information you input (e.g., business names, websites, locations)',
                  'Content you generate or upload (e.g., AI prompts, instructions, website previews)',
                  'Communications with us (support requests, emails, feedback)'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">1.2 Information Collected Automatically</h3>
              <p className="text-[#6B7280] mb-3">When you use the Service, we may automatically collect:</p>
              <ul className="space-y-2 mb-6">
                {[
                  'IP address',
                  'Device type, browser type, operating system',
                  'Usage data (pages viewed, actions taken, timestamps)',
                  'Cookies and similar tracking technologies'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="text-xl font-semibold text-[#1E1B4B] mb-4">1.3 Information from Third Parties</h3>
              <p className="text-[#6B7280] mb-3">We may receive information from:</p>
              <ul className="space-y-2">
                {[
                  'Payment processors (e.g., Stripe)',
                  'Analytics providers (e.g., Google Analytics)',
                  'Advertising platforms (e.g., Meta, TikTok)',
                  'Authentication providers (if applicable)'
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
                How We Use Your Information
              </h2>
              <p className="text-[#6B7280] mb-3">We use the information we collect to:</p>
              <ul className="space-y-2">
                {[
                  'Provide, operate, and maintain the Service',
                  'Create and manage user accounts',
                  'Generate AI-powered website previews and related features',
                  'Process payments and subscriptions',
                  'Communicate with you (service updates, support, marketing where permitted)',
                  'Improve our products, features, and user experience',
                  'Monitor usage, prevent fraud, and ensure security',
                  'Comply with applicable U.S. laws and regulations'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">3</span>
                AI & Generated Content
              </h2>
              <p className="text-[#6B7280] mb-4">
                RenovateMySite uses AI technologies to generate website previews, content, images, and recommendations.
              </p>
              <ul className="space-y-2">
                {[
                  'User inputs may be processed by AI systems to produce outputs.',
                  'We do not claim ownership over your generated content.',
                  'AI outputs are provided "as is" and should be reviewed before use.',
                  'We may log anonymized or aggregated AI usage data to monitor system performance and costs.'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">4</span>
                Cookies & Tracking Technologies
              </h2>
              <p className="text-[#6B7280] mb-3">We use cookies and similar technologies to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Enable core functionality',
                  'Remember preferences',
                  'Analyze usage and performance',
                  'Support marketing and advertising efforts'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                You can control cookies through your browser settings. Disabling cookies may affect functionality.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">5</span>
                How We Share Your Information
              </h2>
              <div className="bg-[#F5F3FF] rounded-xl p-4 mb-4">
                <p className="text-[#1E1B4B] font-semibold">We do not sell your personal information.</p>
              </div>
              <p className="text-[#6B7280] mb-3">We may share your information with:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Service providers (hosting, analytics, payment processing, AI services)',
                  'Business partners acting on our behalf',
                  'Legal authorities if required by law',
                  'In connection with a business transfer (merger, acquisition, asset sale)'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                All service providers are contractually required to protect your information.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">6</span>
                Data Retention
              </h2>
              <p className="text-[#6B7280] mb-3">We retain your information only as long as necessary to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Provide the Service',
                  'Comply with legal obligations',
                  'Resolve disputes',
                  'Enforce agreements'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                You may request deletion of your account and associated data, subject to legal requirements.
              </p>
            </div>

            {/* Section 7 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">7</span>
                Your Privacy Rights (U.S. Residents)
              </h2>
              <p className="text-[#6B7280] mb-3">Depending on your state of residence, you may have the right to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Request access to the personal information we collect',
                  'Request deletion of your personal information',
                  'Request correction of inaccurate information',
                  'Opt out of certain data uses where applicable'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[#6B7280]">
                    <div className="w-2 h-2 bg-[#9B8CF7] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[#6B7280]">
                To exercise your rights, contact us at <a href="mailto:support@renovatemysite.com" className="text-[#9B8CF7] hover:text-[#8B5CF6] transition-colors font-medium">support@renovatemysite.com</a>.
              </p>
            </div>

            {/* Section 8 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">8</span>
                Data Security
              </h2>
              <p className="text-[#6B7280]">
                We implement reasonable technical and organizational safeguards to protect your information. However, no system is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            {/* Section 9 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">9</span>
                Third-Party Links
              </h2>
              <p className="text-[#6B7280]">
                The Service may contain links to third-party websites or services. We are not responsible for their privacy practices. Please review their policies separately.
              </p>
            </div>

            {/* Section 10 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">10</span>
                Children's Privacy
              </h2>
              <p className="text-[#6B7280]">
                RenovateMySite is not intended for children under 13. We do not knowingly collect personal data from children.
              </p>
            </div>

            {/* Section 11 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">11</span>
                Changes to This Privacy Policy
              </h2>
              <p className="text-[#6B7280]">
                We may update this Privacy Policy from time to time. We will post the updated version with a revised "Last updated" date. Continued use of the Service constitutes acceptance of the updated policy.
              </p>
            </div>

            {/* Section 12 - Contact */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-[#1E1B4B] mb-6 headline-font flex items-center gap-3">
                <span className="w-10 h-10 bg-[#9B8CF7] rounded-xl flex items-center justify-center text-white text-lg font-bold">12</span>
                Contact Us
              </h2>
              <p className="text-[#6B7280] mb-4">
                If you have questions or concerns about this Privacy Policy or our data practices, contact us at:
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

export default PrivacyPolicy;
