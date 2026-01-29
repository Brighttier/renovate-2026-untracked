
import React, { useState } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { WebsiteBlueprint, WebsiteSection, WebsitePlugin, WebsiteNavbar, WebsiteFooter } from '../types';
import { Icons } from './Icons';

interface WebsiteRendererProps {
  blueprint: WebsiteBlueprint;
  isPreview?: boolean;
}

// ==========================================
// NAVBAR COMPONENT
// ==========================================
const NavbarComponent: React.FC<{
  navbar?: WebsiteNavbar;
  brand: any;
  primaryColor: string;
}> = ({ navbar, brand, primaryColor }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!navbar?.enabled) return null;

  const navStyle = navbar.style || 'solid';
  const navPosition = navbar.position || 'static';

  const bgClasses = {
    transparent: 'bg-transparent',
    solid: 'bg-[#0D0B14]',
    glass: 'bg-[#0D0B14]/80 backdrop-blur-xl',
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`
        ${navPosition === 'fixed' ? 'fixed top-0 left-0 right-0 z-50' : ''}
        ${bgClasses[navStyle]}
        border-b border-[#9F8FD4]/15 w-full
      `}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="Logo" className="h-8 w-auto" />
          ) : (
            <span className="text-white font-bold text-lg">{brand.name || 'Brand'}</span>
          )}
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navbar.links?.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="text-[#A8A3B3] hover:text-white text-sm font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-4">
          {navbar.ctaButton && (
            <motion.a
              href={navbar.ctaButton.href}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="hidden md:block px-6 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {navbar.ctaButton.label}
            </motion.a>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0D0B14] border-t border-[#9F8FD4]/15"
          >
            <div className="px-6 py-4 space-y-4">
              {navbar.links?.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="block text-[#A8A3B3] hover:text-white text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              {navbar.ctaButton && (
                <a
                  href={navbar.ctaButton.href}
                  className="block w-full text-center px-6 py-3 rounded-xl text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {navbar.ctaButton.label}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

// ==========================================
// FOOTER COMPONENT
// ==========================================
const FooterComponent: React.FC<{
  footer?: WebsiteFooter;
  businessName: string;
  primaryColor: string;
}> = ({ footer, businessName, primaryColor }) => {
  // Default minimal footer if not configured or disabled
  if (!footer?.enabled) {
    return (
      <footer className="py-8 bg-[#0D0B14] text-center text-[#6B6478] text-sm border-t border-[#9F8FD4]/15">
        © {new Date().getFullYear()} {businessName}. All rights reserved.
      </footer>
    );
  }

  const footerStyle = footer.style || 'minimal';

  // Minimal footer
  if (footerStyle === 'minimal') {
    return (
      <footer className="py-8 bg-[#0D0B14] border-t border-[#9F8FD4]/15">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[#6B6478] text-sm">
            {footer.copyright || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`}
          </div>
          {footer.socialLinks && (
            <div className="flex gap-4">
              {footer.socialLinks.facebook && (
                <a href={footer.socialLinks.facebook} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Facebook size={20} />
                </a>
              )}
              {footer.socialLinks.instagram && (
                <a href={footer.socialLinks.instagram} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Instagram size={20} />
                </a>
              )}
              {footer.socialLinks.twitter && (
                <a href={footer.socialLinks.twitter} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Twitter size={20} />
                </a>
              )}
              {footer.socialLinks.linkedin && (
                <a href={footer.socialLinks.linkedin} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Linkedin size={20} />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    );
  }

  // Standard or Detailed footer
  return (
    <footer className="py-16 bg-[#0D0B14] border-t border-[#9F8FD4]/15">
      <div className="max-w-6xl mx-auto px-6">
        {/* Columns */}
        {footer.columns && footer.columns.length > 0 && (
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {footer.columns.map((col) => (
              <div key={col.id}>
                <h4 className="text-white font-bold mb-4">{col.title}</h4>
                <div className="space-y-2">
                  {col.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.href}
                      className="block text-[#A8A3B3] hover:text-white text-sm transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Newsletter */}
        {footer.showNewsletter && (
          <div className="mb-12 p-8 bg-[#1A1625]/50 rounded-2xl">
            <h4 className="text-white font-bold mb-2">Subscribe to our newsletter</h4>
            <p className="text-[#6B6478] text-sm mb-4">Get the latest updates and offers.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-[#262033] border border-zinc-700 rounded-xl text-white text-sm outline-none focus:border-white/30 transition-colors"
              />
              <button
                className="px-6 py-3 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                Subscribe
              </button>
            </div>
          </div>
        )}

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-[#9F8FD4]/15">
          <div className="text-[#6B6478] text-sm">
            {footer.copyright || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`}
          </div>
          {footer.socialLinks && (
            <div className="flex gap-4">
              {footer.socialLinks.facebook && (
                <a href={footer.socialLinks.facebook} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Facebook size={20} />
                </a>
              )}
              {footer.socialLinks.instagram && (
                <a href={footer.socialLinks.instagram} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Instagram size={20} />
                </a>
              )}
              {footer.socialLinks.twitter && (
                <a href={footer.socialLinks.twitter} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Twitter size={20} />
                </a>
              )}
              {footer.socialLinks.linkedin && (
                <a href={footer.socialLinks.linkedin} className="text-[#6B6478] hover:text-white transition-colors">
                  <Icons.Linkedin size={20} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

// ==========================================
// CHATBOT WIDGET
// ==========================================
const ChatbotWidget: React.FC<{ config: any, primaryColor: string }> = ({ config, primaryColor }) => (
  <motion.div 
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="fixed bottom-6 right-8 z-[100] group"
  >
    <div className="absolute bottom-20 right-0 w-80 bg-white rounded-3xl shadow-3xl border border-zinc-100 p-6 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
       <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#9F8FD4]/10 flex items-center justify-center">
             <Icons.Chatbot size={20} />
          </div>
          <div>
            <div className="text-sm font-medium text-[#A8A3B3]">AI Assistant</div>
            <div className="text-sm font-bold text-zinc-900">Virtual Concierge</div>
          </div>
       </div>
       <div className="p-4 bg-zinc-50 rounded-2xl text-xs text-zinc-600 mb-4 font-medium italic">
          "{config.greeting || 'How can I assist you today?'}"
       </div>
       <button className="w-full py-3 bg-[#7C6BB5] text-white rounded-xl text-sm font-medium">Start Chat</button>
    </div>
    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl cursor-pointer hover:scale-110 transition-transform border-4 border-white" style={{ backgroundColor: primaryColor }}>
       <Icons.Chatbot size={32} className="text-white" />
    </div>
  </motion.div>
);

const WebsiteRenderer: React.FC<WebsiteRendererProps> = ({ blueprint, isPreview = false }) => {
  // Defensive checks for empty or malformed blueprint
  if (!blueprint || !blueprint.brand || !blueprint.sections || blueprint.sections.length === 0) {
    console.error("Invalid blueprint:", blueprint);
    return (
      <div className="w-full h-96 flex items-center justify-center bg-[#1A1625] text-white rounded-2xl">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Blueprint Error</p>
          <p className="text-[#A8A3B3] text-sm">The generated blueprint is invalid or empty.</p>
        </div>
      </div>
    );
  }

  const { brand, sections, plugins, navbar, footer } = blueprint;
  const primaryColor = brand.primaryColor || '#10b981';
  const secondaryColor = brand.secondaryColor || '#8B5CF6';
  const businessName = (brand as any).name || 'Business';

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const textVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } 
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={`w-full bg-white text-zinc-900 overflow-hidden relative ${isPreview ? 'rounded-2xl shadow-2xl' : ''}`}
      style={{ fontFamily: brand.fontFamily || 'Outfit, sans-serif' }}
    >
      {isPreview && (
        <div className="bg-[#0D0B14] py-2.5 text-center text-[9px] font-black text-[#9F8FD4] uppercase tracking-[0.4em] sticky top-0 z-50 border-b border-[#9F8FD4]/15">
          ✨ Live AI Generation Draft
        </div>
      )}

      {/* Navbar */}
      <NavbarComponent navbar={navbar} brand={brand} primaryColor={primaryColor} />

      {/* Main content with padding for fixed navbar */}
      <div className={`relative ${navbar?.enabled && navbar?.position === 'fixed' ? 'pt-16' : ''}`}>
        {sections.map((section: WebsiteSection) => {
          switch (section.type) {
            case 'hero':
              return (
                <motion.section
                  key={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="relative min-h-[600px] flex items-center justify-center text-center px-8 py-24 bg-[#0D0B14] overflow-hidden text-white"
                >
                  {section.imageUrl && (
                     <motion.div 
                       initial={{ opacity: 0, scale: 1.1 }}
                       whileInView={{ opacity: 0.4, scale: 1 }}
                       transition={{ duration: 1.5 }}
                       className="absolute inset-0"
                     >
                        <img src={section.imageUrl} alt="Hero" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                     </motion.div>
                  )}
                  <div className="max-w-4xl relative z-10">
                    {brand.logoUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="mb-12 flex justify-center"
                      >
                        <img
                          src={brand.logoUrl}
                          alt="Business Logo"
                          className="h-16 md:h-24 w-auto object-contain drop-shadow-2xl"
                        />
                      </motion.div>
                    )}
                    <motion.h1
                      variants={textVariants}
                      className="text-6xl md:text-9xl font-black mb-8 leading-[0.9] tracking-tighter"
                      style={{ color: primaryColor }}
                    >
                      {section.title || 'Welcome'}
                    </motion.h1>
                    <motion.p
                      variants={textVariants}
                      className="text-xl md:text-2xl text-zinc-300 mb-12 leading-relaxed max-w-2xl mx-auto font-light"
                    >
                      {section.content || ''}
                    </motion.p>
                    {section.cta && (
                      <motion.div variants={textVariants}>
                        <motion.button 
                          whileHover={{ scale: 1.05 }} 
                          whileTap={{ scale: 0.95 }}
                          className="px-16 py-6 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-3xl" 
                          style={{ backgroundColor: primaryColor }}
                        >
                          {section.cta}
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.section>
              );

            case 'services':
              return (
                <motion.section
                  key={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-white"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-16 italic">{section.title || 'Our Services'}</motion.h3>
                    <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-8 text-left">
                         {(section.content || '').split('. ').map((s, idx) => s && (
                           <motion.div key={idx} variants={textVariants} className="flex gap-6 items-start">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-white" style={{ backgroundColor: secondaryColor }}>{idx+1}</div>
                              <p className="text-xl text-zinc-600 font-light">{s}</p>
                           </motion.div>
                         ))}
                      </div>
                      {section.imageUrl && (
                        <motion.div 
                          variants={textVariants}
                          className="rounded-3xl overflow-hidden shadow-2xl h-[400px]"
                        >
                           <img src={section.imageUrl} alt="Service" className="w-full h-full object-cover" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.section>
              );

            case 'trust':
              return (
                <motion.section
                  key={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 bg-[#0D0B14] text-white px-8"
                >
                  <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-left">
                    <div className="max-w-xl">
                      <motion.h3 variants={textVariants} className="text-5xl font-black tracking-tighter italic mb-6" style={{ color: primaryColor }}>{section.title || 'Why Choose Us'}</motion.h3>
                      <motion.p variants={textVariants} className="text-[#A8A3B3] text-xl font-light leading-relaxed">{section.content || ''}</motion.p>
                    </div>
                    <motion.div variants={textVariants} className="flex gap-16">
                       <div>
                          <div className="text-4xl font-black mb-1">5.0</div>
                          <div className="text-sm uppercase font-bold text-zinc-600 tracking-widest">Rating</div>
                       </div>
                       <div>
                          <div className="text-4xl font-black mb-1">24h</div>
                          <div className="text-sm uppercase font-bold text-zinc-600 tracking-widest">Service</div>
                       </div>
                    </motion.div>
                  </div>
                </motion.section>
              );

            case 'contact':
              return (
                <motion.section
                  key={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-32 px-8 bg-zinc-50"
                >
                  <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
                    <div className="text-left">
                      <motion.h2 variants={textVariants} className="text-5xl font-black tracking-tighter mb-8 italic">{section.title || 'Contact Us'}</motion.h2>
                      <motion.p variants={textVariants} className="text-[#6B6478] text-xl leading-relaxed mb-12 font-light">{section.content || ''}</motion.p>
                      <motion.div variants={textVariants} className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-xl inline-block">
                         <div className="font-black uppercase text-sm tracking-widest text-[#A8A3B3] mb-2">Book a Session</div>
                         <div className="text-2xl font-bold">Call Now Available</div>
                      </motion.div>
                    </div>
                    <motion.div
                      variants={textVariants}
                      className="bg-white p-12 rounded-[50px] shadow-3xl border border-zinc-50 space-y-8"
                    >
                       <div className="space-y-2 text-left">
                          <label className="text-sm font-black text-[#A8A3B3] uppercase tracking-widest">Your Name</label>
                          <input type="text" className="w-full p-6 bg-zinc-50 border-0 rounded-2xl outline-none focus:ring-4 transition-all" style={{ '--tw-ring-color': `${primaryColor}20` } as any} />
                       </div>
                       <button className="w-full py-6 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl" style={{ backgroundColor: primaryColor }}>Book Now</button>
                    </motion.div>
                  </div>
                </motion.section>
              );

            // ==========================================
            // NEW SECTION TYPES
            // ==========================================

            case 'testimonials':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-white"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic">
                      {section.title || 'What Our Clients Say'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#6B6478] text-xl text-center mb-16 max-w-2xl mx-auto">
                      {section.content || ''}
                    </motion.p>
                    <div className="grid md:grid-cols-3 gap-8">
                      {[1, 2, 3].map((idx) => (
                        <motion.div
                          key={idx}
                          variants={textVariants}
                          className="p-8 bg-zinc-50 rounded-3xl"
                        >
                          <div className="flex gap-1 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg key={star} className="w-5 h-5" fill={primaryColor} viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-zinc-600 text-lg mb-6 italic">"Amazing service! Highly recommended for anyone looking for quality."</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-200" />
                            <div>
                              <div className="font-bold text-zinc-900">Happy Customer {idx}</div>
                              <div className="text-sm text-[#6B6478]">Verified Buyer</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'pricing':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-[#0D0B14] text-white"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic" style={{ color: primaryColor }}>
                      {section.title || 'Pricing Plans'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#A8A3B3] text-xl text-center mb-16 max-w-2xl mx-auto">
                      {section.content || 'Choose the plan that fits your needs'}
                    </motion.p>
                    <div className="grid md:grid-cols-3 gap-8">
                      {['Basic', 'Pro', 'Enterprise'].map((plan, idx) => (
                        <motion.div
                          key={plan}
                          variants={textVariants}
                          className={`p-8 rounded-3xl border ${idx === 1 ? 'border-2 scale-105' : 'border-[#9F8FD4]/15'}`}
                          style={idx === 1 ? { borderColor: primaryColor, backgroundColor: 'rgba(16, 185, 129, 0.1)' } : {}}
                        >
                          {idx === 1 && (
                            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: primaryColor }}>
                              Most Popular
                            </div>
                          )}
                          <h4 className="text-2xl font-bold mb-2">{plan}</h4>
                          <div className="text-4xl font-black mb-6">
                            ${idx === 0 ? '29' : idx === 1 ? '79' : '199'}
                            <span className="text-sm text-[#6B6478] font-normal">/mo</span>
                          </div>
                          <ul className="space-y-3 mb-8">
                            {['Feature one', 'Feature two', 'Feature three', idx > 0 ? 'Premium feature' : null, idx > 1 ? 'Enterprise feature' : null].filter(Boolean).map((feature, i) => (
                              <li key={i} className="flex items-center gap-3 text-[#A8A3B3]">
                                <svg className="w-5 h-5" fill={primaryColor} viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <button
                            className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
                            style={idx === 1 ? { backgroundColor: primaryColor, color: 'white' } : { backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                          >
                            Get Started
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'faq':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-white"
                >
                  <div className="max-w-4xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic">
                      {section.title || 'Frequently Asked Questions'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#6B6478] text-xl text-center mb-16">
                      {section.content || ''}
                    </motion.p>
                    <div className="space-y-4">
                      {['How does it work?', 'What is included?', 'How can I get started?', 'What is your refund policy?', 'Do you offer support?'].map((question, idx) => (
                        <motion.div
                          key={idx}
                          variants={textVariants}
                          className="p-6 bg-zinc-50 rounded-2xl"
                        >
                          <div className="flex items-center justify-between cursor-pointer">
                            <h4 className="font-bold text-lg">{question}</h4>
                            <svg className="w-5 h-5 text-[#A8A3B3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          <p className="text-[#6B6478] mt-4 text-sm">
                            This is a placeholder answer. The AI will generate specific answers based on your business.
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'gallery':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-zinc-50"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic">
                      {section.title || 'Our Work'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#6B6478] text-xl text-center mb-16">
                      {section.content || ''}
                    </motion.p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((idx) => (
                        <motion.div
                          key={idx}
                          variants={textVariants}
                          className="aspect-square bg-zinc-200 rounded-2xl overflow-hidden"
                        >
                          {section.imageUrl ? (
                            <img src={section.imageUrl} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#A8A3B3]">
                              <Icons.Image size={48} />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'team':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-white"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic">
                      {section.title || 'Meet Our Team'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#6B6478] text-xl text-center mb-16">
                      {section.content || ''}
                    </motion.p>
                    <div className="grid md:grid-cols-4 gap-8">
                      {['CEO', 'CTO', 'Designer', 'Developer'].map((role, idx) => (
                        <motion.div
                          key={idx}
                          variants={textVariants}
                          className="text-center"
                        >
                          <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-zinc-200 overflow-hidden">
                            <div className="w-full h-full flex items-center justify-center text-[#A8A3B3]">
                              <Icons.User size={48} />
                            </div>
                          </div>
                          <h4 className="font-bold text-lg">Team Member</h4>
                          <p className="text-[#6B6478]">{role}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'features':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-[#0D0B14] text-white"
                >
                  <div className="max-w-6xl mx-auto">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center italic" style={{ color: primaryColor }}>
                      {section.title || 'Features'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-[#A8A3B3] text-xl text-center mb-16 max-w-2xl mx-auto">
                      {section.content || ''}
                    </motion.p>
                    <div className="grid md:grid-cols-3 gap-8">
                      {['Fast', 'Reliable', 'Secure', 'Scalable', 'Modern', 'Support'].map((feature, idx) => (
                        <motion.div
                          key={idx}
                          variants={textVariants}
                          className="p-6 bg-white/5 rounded-2xl border border-[#9F8FD4]/15"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
                            <Icons.Check size={24} style={{ color: primaryColor }} />
                          </div>
                          <h4 className="font-bold text-xl mb-2">{feature}</h4>
                          <p className="text-[#6B6478] text-sm">A brief description of this feature and its benefits.</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              );

            case 'cta':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="max-w-4xl mx-auto text-center">
                    <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-white">
                      {section.title || 'Ready to Get Started?'}
                    </motion.h3>
                    <motion.p variants={textVariants} className="text-white/80 text-xl mb-12">
                      {section.content || ''}
                    </motion.p>
                    {section.cta && (
                      <motion.div variants={textVariants}>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-16 py-6 rounded-2xl font-black uppercase text-xs tracking-widest bg-white shadow-3xl"
                          style={{ color: primaryColor }}
                        >
                          {section.cta}
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.section>
              );

            case 'about':
              return (
                <motion.section
                  key={section.id}
                  id={section.id}
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                  className="py-24 px-8 bg-white"
                >
                  <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                    <div className="text-left">
                      <motion.h3 variants={textVariants} className="text-4xl md:text-6xl font-black tracking-tight mb-8 italic">
                        {section.title || 'About Us'}
                      </motion.h3>
                      <motion.p variants={textVariants} className="text-zinc-600 text-xl leading-relaxed">
                        {section.content || ''}
                      </motion.p>
                      {section.cta && (
                        <motion.div variants={textVariants} className="mt-8">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest text-white"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {section.cta}
                          </motion.button>
                        </motion.div>
                      )}
                    </div>
                    {section.imageUrl && (
                      <motion.div
                        variants={textVariants}
                        className="rounded-3xl overflow-hidden shadow-2xl h-[400px]"
                      >
                        <img src={section.imageUrl} alt="About" className="w-full h-full object-cover" />
                      </motion.div>
                    )}
                  </div>
                </motion.section>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Footer */}
      <FooterComponent footer={footer} businessName={businessName} primaryColor={primaryColor} />

      {/* Plugin Layer */}
      <AnimatePresence>
        {plugins?.map((plugin) => {
          if (plugin.id === 'chatbot') return <ChatbotWidget key={plugin.id} config={plugin.config} primaryColor={primaryColor} />;
          return null;
        })}
      </AnimatePresence>
    </motion.div>
  );
};

export default WebsiteRenderer;
