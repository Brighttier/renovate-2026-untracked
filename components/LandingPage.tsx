import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Icons } from './Icons';
import { useTheme } from '../contexts/ThemeContext';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  onSignUp: () => void;
  onJoinWaitlist: () => void;
  onPrivacyPolicy?: () => void;
  onTermsOfService?: () => void;
}

// FAQ Data
const FAQ_DATA = [
  {
    question: "What is RMS?",
    answer: "RenovateMySite (RMS) is an AI-powered platform that lets you create professional website previews for local businesses in seconds. You can then send these previews as sales pitches and earn money when businesses approve and pay for their new website."
  },
  {
    question: "Is RMS secure?",
    answer: "Yes, RMS uses enterprise-grade security with encrypted data transmission, secure authentication, and follows industry best practices. Your data and your clients' information are protected at all times."
  },
  {
    question: "What kind of businesses are supported?",
    answer: "RMS supports a wide range of local businesses including dental clinics, restaurants, salons, gyms, plumbers, contractors, medical practices, retail stores, and many more. If a business needs a website, RMS can help you create one."
  },
  {
    question: "Do I need to pay to use it?",
    answer: "RMS offers a free tier to get started. You can generate your first website previews at no cost. As you grow and need more features, we offer affordable plans that scale with your business."
  },
  {
    question: "How fast can I start making money?",
    answer: "You can start earning from day one. Once you sign up, you can immediately begin generating website previews and sending them to businesses. When a business says yes and pays, you earn your commission."
  },
  {
    question: "Do I need to verify my identity?",
    answer: "Basic account creation requires only an email. For receiving payouts above certain thresholds, we may require identity verification to comply with financial regulations and protect both you and the platform."
  },
  {
    question: "Can I access RMS on mobile?",
    answer: "Yes, RMS is fully responsive and works on any device. You can generate previews, send pitches, and manage your earnings from your phone, tablet, or desktop computer."
  },
  {
    question: "How can I contact support?",
    answer: "You can reach our support team through the in-app help center, by email at support@renovatemysite.app, or through our community Discord. We typically respond within 24 hours."
  }
];

// Testimonials Data (Placeholders)
const TESTIMONIALS = [
  {
    id: 1,
    name: "Sarah M.",
    role: "Freelancer",
    quote: "I made my first $500 in the first week. The AI does all the heavy lifting — I just send the previews!"
  },
  {
    id: 2,
    name: "Mike T.",
    role: "Part-Time Construction Worker",
    quote: "Finally a way to make money online that actually works. No technical skills needed."
  },
  {
    id: 3,
    name: "Jessica L.",
    role: "Stay-at-home Mom",
    quote: "I work on my own schedule and the businesses love the modern designs. Win-win!"
  }
];

// Stats Data - Updated to be meaningful and not made up
const STATS = [
  { number: "60", suffix: "sec", label: "To generate a website" },
  { number: "0", suffix: "$", label: "Upfront cost to start" },
  { number: "100", suffix: "%", label: "AI-powered creation" }
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.625, 0.05, 0, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: [0.625, 0.05, 0, 1] }
  }
};

const slideFromRight = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.625, 0.05, 0, 1] }
  }
};

// Scroll-triggered section component
const AnimatedSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.8, delay, ease: [0.625, 0.05, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin, onSignUp, onJoinWaitlist, onPrivacyPolicy, onTermsOfService }) => {
  const { isDark } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showPromoBanner, setShowPromoBanner] = useState(true);

  // Parallax scroll for hero
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Confetti Promo Banner */}
      {showPromoBanner && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 z-[1001] bg-[#1E1B4B] text-white py-3 px-4"
        >
          <div className="confetti-pattern absolute inset-0 opacity-30" />
          <div className="relative flex items-center justify-center gap-3">
            <span className="text-sm font-medium">
              Limited Time: Get started for <span className="text-[var(--accent-pink)] font-bold">FREE</span> — No credit card required
            </span>
            <button
              onClick={onGetStarted}
              className="bg-[#9B8CF7] text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-[#8B5CF6] transition-colors"
            >
              Start Free
            </button>
            <button
              onClick={() => setShowPromoBanner(false)}
              className="absolute right-4 text-white/60 hover:text-white transition-colors"
            >
              <Icons.X size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <nav className={`fixed ${showPromoBanner ? 'top-12' : 'top-0'} left-0 right-0 z-[1000] bg-white/98 backdrop-blur-md border-b border-gray-100 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-10 w-10 group-hover:scale-105 transition-transform duration-300" />
            <span className="font-semibold text-lg text-[#1E1B4B] tracking-tight headline-font">
              Renovate<span className="text-[#9B8CF7]">MySite</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-[#6B7280]">
            <button onClick={() => scrollToSection('features')} className="nav-link-reveal hover:text-[#1E1B4B]"><span>Features</span></button>
            <button onClick={() => scrollToSection('how-it-works')} className="nav-link-reveal hover:text-[#1E1B4B]"><span>How it works</span></button>
            <button onClick={() => scrollToSection('testimonials')} className="nav-link-reveal hover:text-[#1E1B4B]"><span>Success Stories</span></button>
            <button onClick={() => scrollToSection('faq')} className="nav-link-reveal hover:text-[#1E1B4B]"><span>FAQ</span></button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="nav-link-reveal text-sm font-medium text-[#6B7280] hover:text-[#1E1B4B]"
            >
              <span>Login</span>
            </button>
            <button
              onClick={onGetStarted}
              className="hb-btn hb-btn-navy text-sm px-6 py-2.5"
            >
              <span>Get started free</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Soft Lavender Background */}
      <section
        ref={heroRef}
        className={`${showPromoBanner ? 'pt-40' : 'pt-28'} pb-20 bg-[#F5F3FF] relative overflow-hidden`}
      >
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="max-w-6xl mx-auto px-6 relative z-10"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="mb-6">
                <span className="inline-flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full text-sm font-medium text-[#1E1B4B]">
                  <span className="w-2 h-2 bg-[var(--accent-pink)] rounded-full animate-pulse"></span>
                  Coming Soon — Join the Waitlist
                </span>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#1E1B4B] leading-[1.1] mb-6 headline-font"
              >
                Turn AI into your
                <br />
                <span className="headline-serif italic font-normal">side income</span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-lg md:text-xl text-[#1E1B4B]/70 mb-8 max-w-lg leading-relaxed"
              >
                Create stunning website previews for local businesses in seconds.
                Send them your pitch — get paid when they say yes.
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <button
                  onClick={onGetStarted}
                  className="hb-btn hb-btn-navy text-base px-8 py-4"
                >
                  <span className="flex items-center gap-2">
                    Get started for free
                    <Icons.ArrowRight size={18} />
                  </span>
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="hb-btn hb-btn-outline text-base px-8 py-4"
                >
                  <span>See how it works</span>
                </button>
              </motion.div>

              <motion.p variants={fadeInUp} className="mt-6 text-sm text-[#1E1B4B]/50">
                Free to try • No credit card required • Get started in minutes
              </motion.p>
            </motion.div>

            {/* Right Content - Floating Cards */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="relative h-[500px] hidden lg:block"
            >
              {/* Main Card - Business Search & Selection */}
              <motion.div
                variants={slideFromRight}
                className="absolute top-0 right-0 w-[420px] bg-white rounded-[20px] shadow-2xl overflow-hidden tilt-card"
                style={{ transform: 'perspective(1000px) rotateY(-5deg)' }}
              >
                {/* Step indicator */}
                <div className="bg-[#1E1B4B] px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/60 text-xs">Step 1 of 4</span>
                    <span className="text-white/60 text-xs">25% Complete</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-1/4 bg-gradient-to-r from-[#9B8CF7] via-[#8B5CF6] to-[var(--accent-pink)] rounded-full"></div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-[#1E1B4B] mb-1">Find a Business</h3>
                  <p className="text-xs text-[#6B7280] mb-4">Search for local businesses that need a website upgrade</p>

                  {/* Search input */}
                  <div className="relative mb-4">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Icons.Search size={18} className="text-[#6B7280]" />
                    </div>
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm text-[#1E1B4B]">
                      dentists in Austin, TX
                    </div>
                  </div>

                  {/* Business results */}
                  <div className="space-y-2">
                    <div className="p-3 bg-[#F5F3FF] border-2 border-[#9B8CF7] rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#9B8CF7] to-[#8B5CF6] rounded-lg flex items-center justify-center">
                        <Icons.Dentist size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-[#1E1B4B]">Smile Dental Clinic</div>
                        <div className="text-xs text-[#6B7280] flex items-center gap-2">
                          <span className="flex items-center gap-0.5">
                            <Icons.Star size={10} className="text-amber-400 fill-amber-400" />
                            4.8
                          </span>
                          <span>•</span>
                          <span className="text-[var(--accent-pink)]">No website</span>
                        </div>
                      </div>
                      <Icons.Check size={18} className="text-[#9B8CF7]" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 opacity-60">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Icons.Dentist size={20} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#1E1B4B]">Austin Family Dental</div>
                        <div className="text-xs text-[#6B7280]">Has modern website</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Card - AI Generation in Progress */}
              <motion.div
                variants={fadeInUp}
                transition={{ delay: 0.3 }}
                className="absolute bottom-10 left-0 w-[300px] bg-white rounded-[20px] shadow-xl overflow-hidden float-card"
              >
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#9B8CF7] to-[#8B5CF6] rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1E1B4B]">AI Generating Website</div>
                      <div className="text-xs text-[#6B7280]">Smile Dental Clinic</div>
                    </div>
                  </div>

                  {/* Progress steps */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                        <Icons.Check size={12} className="text-green-600" />
                      </div>
                      <span className="text-xs text-[#1E1B4B]">Analyzing business info</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                        <Icons.Check size={12} className="text-green-600" />
                      </div>
                      <span className="text-xs text-[#1E1B4B]">Selecting design template</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-[#9B8CF7] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </div>
                      <span className="text-xs text-[#9B8CF7] font-medium">Generating content...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-gray-100 rounded-full"></div>
                      <span className="text-xs text-[#6B7280]">Finalizing preview</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Notification Card - Website Ready */}
              <motion.div
                variants={scaleIn}
                transition={{ delay: 0.5 }}
                className="absolute bottom-36 right-8 bg-white rounded-2xl shadow-lg p-4 w-[240px] float-card border border-green-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-[#9B8CF7] rounded-xl flex items-center justify-center">
                    <Icons.Check size={22} className="text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1E1B4B]">Website Ready!</div>
                    <div className="text-xs text-[#6B7280]">Preview generated in 47s</div>
                  </div>
                </div>
                <button className="w-full mt-3 bg-gradient-to-r from-[#9B8CF7] via-[#8B5CF6] to-[var(--accent-pink)] text-white text-xs font-semibold py-2 rounded-lg">
                  View & Send to Client →
                </button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Lavender to white gradient transition */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white"></div>
      </section>

      {/* Stats Section - White Background */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              {STATS.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <div className="stat-number text-5xl md:text-6xl lg:text-7xl text-[#1E1B4B] mb-2">
                    {stat.number}<span className="text-[#9B8CF7]">{stat.suffix}</span>
                  </div>
                  <div className="text-[#6B7280] font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section - Navy Background */}
      <section id="features" className="py-24 bg-[#1E1B4B]">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 headline-font">
              Everything you need to
              <br />
              <span className="text-[#9B8CF7]">start earning</span>
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              No coding skills. No design experience. Just AI-powered website creation that actually converts.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Icons.Zap size={28} />,
                title: "AI-Powered",
                description: "Our AI analyzes any business and creates a perfect website in seconds."
              },
              {
                icon: <Icons.DollarSign size={28} />,
                title: "Instant Payouts",
                description: "Get paid directly when businesses approve. No waiting, no hassle."
              },
              {
                icon: <Icons.Users size={28} />,
                title: "No Experience",
                description: "Anyone can do it. If you can send an email, you can earn with RMS."
              },
              {
                icon: <Icons.TrendingUp size={28} />,
                title: "Scalable Income",
                description: "Start with one website, scale to dozens. Your income grows with you."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[20px] p-6 hover:bg-white/10 transition-all duration-500 group"
              >
                <div className="w-14 h-14 bg-[#9B8CF7] rounded-2xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2 headline-font">{feature.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Soft Lavender Background */}
      <section id="how-it-works" className="py-24 bg-[#EDE9FE]">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1E1B4B] mb-4 headline-font">
              Three steps to your
              <br />
              <span className="headline-serif italic font-normal">first paycheck</span>
            </h2>
            <p className="text-[#6B7280] text-lg max-w-2xl mx-auto">
              It's so simple, you'll wonder why you didn't start sooner.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 - Pick a Business */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, duration: 0.7 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white rounded-[20px] p-8 h-full shadow-sm hover:shadow-lg transition-shadow duration-500">
                <div className="w-16 h-16 mb-6 relative">
                  {/* Search/Target icon */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#9B8CF7] to-[#8B5CF6] rounded-2xl opacity-10"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#9B8CF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                </div>
                <div className="text-[#9B8CF7] font-bold text-sm mb-2 headline-font">01</div>
                <h3 className="text-[#1E1B4B] font-bold text-xl mb-3 headline-font">Pick a Business</h3>
                <p className="text-[#6B7280] leading-relaxed">Find any local business with an outdated website. We'll help you identify the best opportunities.</p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-[#C4B5FD] text-3xl">
                →
              </div>
            </motion.div>

            {/* Step 2 - Generate Preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white rounded-[20px] p-8 h-full shadow-sm hover:shadow-lg transition-shadow duration-500">
                <div className="w-16 h-16 mb-6 relative">
                  {/* Magic wand/sparkle icon */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#9B8CF7] to-[#8B5CF6] rounded-2xl opacity-10"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#9B8CF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                </div>
                <div className="text-[#9B8CF7] font-bold text-sm mb-2 headline-font">02</div>
                <h3 className="text-[#1E1B4B] font-bold text-xl mb-3 headline-font">Generate Preview</h3>
                <p className="text-[#6B7280] leading-relaxed">Our AI creates a stunning, modern website preview in under 60 seconds. No design skills needed.</p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-[#C4B5FD] text-3xl">
                →
              </div>
            </motion.div>

            {/* Step 3 - Send & Earn */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white rounded-[20px] p-8 h-full shadow-sm hover:shadow-lg transition-shadow duration-500">
                <div className="w-16 h-16 mb-6 relative">
                  {/* Send/rocket icon */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#9B8CF7] to-[#8B5CF6] rounded-2xl opacity-10"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#9B8CF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                </div>
                <div className="text-[#9B8CF7] font-bold text-sm mb-2 headline-font">03</div>
                <h3 className="text-[#1E1B4B] font-bold text-xl mb-3 headline-font">Send & Earn</h3>
                <p className="text-[#6B7280] leading-relaxed">Send the preview to the business. When they say yes, you get paid. It's that simple.</p>
              </div>
            </motion.div>
          </div>

          <AnimatedSection delay={0.4} className="text-center mt-12">
            <button
              onClick={onGetStarted}
              className="hb-btn hb-btn-navy text-base px-8 py-4"
            >
              <span className="flex items-center gap-2">
                Start earning now
                <Icons.ArrowRight size={18} />
              </span>
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* Showcase Section - Pink Background */}
      <section className="py-24 bg-[#FCE7F3]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1E1B4B] mb-6 headline-font">
                AI that actually
                <br />
                <span className="headline-serif italic font-normal">understands businesses</span>
              </h2>
              <p className="text-[#1E1B4B]/70 text-lg mb-8 leading-relaxed">
                Our AI doesn't just slap together templates. It analyzes each business's brand,
                industry, and audience to create websites that convert visitors into customers.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Analyzes existing website & branding",
                  "Industry-specific design patterns",
                  "Professional designs that impress clients",
                  "Ready to send in under 60 seconds"
                ].map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3 text-[#1E1B4B]"
                  >
                    <div className="w-6 h-6 bg-[#1E1B4B] rounded-full flex items-center justify-center flex-shrink-0">
                      <Icons.Check size={14} className="text-[#9B8CF7]" />
                    </div>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <button className="learn-more-link text-[#1E1B4B] font-semibold">
                See example previews
                <Icons.ArrowRight size={18} />
              </button>
            </AnimatedSection>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Stacked Website Previews - Polished Modern Examples */}
              <div className="relative">
                {/* Front Card - Dental Clinic - Full modern website mockup */}
                <motion.div
                  whileHover={{ y: -8, rotate: 0, scale: 1.02 }}
                  className="bg-white rounded-[16px] shadow-2xl overflow-hidden transform rotate-2 hover:rotate-0 transition-all duration-500 border border-gray-100"
                >
                  {/* Browser Chrome - macOS style */}
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-2.5 flex items-center gap-3 border-b border-gray-200">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-inner"></div>
                      <div className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-inner"></div>
                      <div className="w-3 h-3 rounded-full bg-[#28CA41] shadow-inner"></div>
                    </div>
                    <div className="flex-1 bg-white rounded-lg px-4 py-1.5 text-xs text-gray-500 flex items-center gap-2 shadow-sm border border-gray-200">
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>freshstartdental.com</span>
                    </div>
                  </div>

                  {/* Website Content - Modern dental site */}
                  <div className="bg-white">
                    {/* Nav */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        {/* Abstract tooth/smile logo */}
                        <div className="w-9 h-9 relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl rotate-12"></div>
                          <div className="absolute inset-1 bg-white rounded-lg rotate-12 flex items-center justify-center">
                            <div className="w-3 h-3 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full"></div>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-800 text-sm tracking-tight">Fresh Start</span>
                      </div>
                      <div className="flex items-center gap-5 text-xs">
                        <span className="text-gray-600 hover:text-gray-900">Services</span>
                        <span className="text-gray-600 hover:text-gray-900">Team</span>
                        <span className="text-gray-600 hover:text-gray-900">About</span>
                        <span className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-4 py-2 rounded-full font-medium shadow-lg shadow-cyan-500/25">Book Visit</span>
                      </div>
                    </div>

                    {/* Hero Section */}
                    <div className="px-6 py-8 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
                      <div className="flex gap-6 items-center">
                        <div className="flex-1">
                          <div className="inline-flex items-center gap-2 bg-cyan-50 text-cyan-600 px-3 py-1 rounded-full text-[10px] font-medium mb-3">
                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                            Now Accepting New Patients
                          </div>
                          <h3 className="text-gray-900 font-bold text-xl mb-2 leading-tight">Modern Care for<br/>Confident Smiles</h3>
                          <p className="text-gray-500 text-xs mb-4 leading-relaxed">Experience dentistry reimagined with cutting-edge technology and compassionate care.</p>
                          <div className="flex gap-3">
                            <button className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs px-5 py-2.5 rounded-full font-semibold shadow-lg shadow-cyan-500/30">
                              Schedule Now
                            </button>
                            <button className="text-gray-600 text-xs px-4 py-2.5 rounded-full font-medium border border-gray-200 hover:border-gray-300">
                              Virtual Tour
                            </button>
                          </div>
                        </div>
                        {/* Hero visual */}
                        <div className="w-32 h-32 relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-3xl"></div>
                          <div className="absolute inset-3 bg-gradient-to-br from-cyan-200 to-teal-200 rounded-2xl"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trust indicators */}
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 border-2 border-white"></div>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-300 to-indigo-400 border-2 border-white"></div>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 border-2 border-white"></div>
                        </div>
                        <span className="text-[10px] text-gray-500">500+ happy patients</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20">
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                          </svg>
                        ))}
                        <span className="text-[10px] text-gray-500 ml-1">4.9</span>
                      </div>
                    </div>
                  </div>

                  {/* RMS Status Footer */}
                  <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between border-t border-emerald-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#9B8CF7] rounded-full animate-pulse"></div>
                      <p className="text-gray-600 text-[10px] font-medium">AI-generated in 47 seconds</p>
                    </div>
                    <span className="bg-[#9B8CF7] text-white text-[10px] font-semibold px-3 py-1 rounded-full">Client Approved</span>
                  </div>
                </motion.div>

                {/* Back Card - Restaurant - Elegant Italian */}
                <motion.div
                  whileHover={{ y: -5, rotate: 0 }}
                  className="bg-white rounded-[16px] shadow-xl overflow-hidden absolute top-28 -left-6 transform -rotate-6 hover:rotate-0 transition-all duration-500 w-[92%] border border-gray-100"
                >
                  {/* Browser Chrome */}
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]"></div>
                    </div>
                    <div className="flex-1 bg-white rounded-md px-3 py-1 text-[10px] text-gray-400 ml-1 border border-gray-200">
                      bellaitalia.com
                    </div>
                  </div>

                  {/* Website Content - Elegant restaurant */}
                  <div className="bg-stone-50">
                    {/* Nav */}
                    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        {/* Abstract flame/leaf logo */}
                        <div className="w-8 h-8 relative">
                          <div className="absolute inset-0 bg-gradient-to-t from-orange-500 via-amber-400 to-yellow-300 rounded-full"></div>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-5 bg-gradient-to-t from-orange-600 to-amber-400 rounded-t-full"></div>
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded-t-full"></div>
                        </div>
                        <div>
                          <span className="font-serif text-gray-800 text-sm font-semibold tracking-wide">Bella Italia</span>
                          <span className="block text-[8px] text-amber-600 tracking-widest uppercase">Ristorante</span>
                        </div>
                      </div>
                      <div className="flex gap-4 text-[10px] text-gray-600">
                        <span>Menu</span>
                        <span>Wine</span>
                        <span className="bg-stone-800 text-white px-3 py-1.5 rounded-full">Reserve</span>
                      </div>
                    </div>

                    {/* Hero */}
                    <div className="px-5 py-5 bg-gradient-to-br from-amber-50 via-orange-50 to-stone-50">
                      <p className="text-amber-600 text-[9px] font-semibold tracking-[0.2em] uppercase mb-1">Est. 1987 • Authentic Italian</p>
                      <h3 className="font-serif text-stone-800 text-lg font-semibold mb-1">A Taste of Tuscany</h3>
                      <p className="text-stone-500 text-[10px] leading-relaxed">Handmade pasta, curated wines, and unforgettable moments in every dish.</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - White */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1E1B4B] mb-4 headline-font">
              What early users
              <br />
              <span className="text-[#9B8CF7]">are saying</span>
            </h2>
            <p className="text-[#6B7280] text-lg">
              Real feedback from our beta testers.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-[#F9FAFB] rounded-[20px] p-8 hover:shadow-lg transition-shadow duration-500"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Icons.Star key={i} size={18} className="text-[#9B8CF7] fill-current" />
                  ))}
                </div>
                <p className="text-[#1E1B4B] mb-6 leading-relaxed italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#1E1B4B] rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#1E1B4B]">{testimonial.name}</div>
                    <div className="text-sm text-[#6B7280]">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Light Gray */}
      <section id="faq" className="py-24 bg-[#F9FAFB]">
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1E1B4B] mb-4 headline-font">
              Frequently asked questions
            </h2>
            <p className="text-[#6B7280]">Everything you need to know about RenovateMySite.</p>
          </AnimatedSection>

          <div className="space-y-3">
            {FAQ_DATA.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
                viewport={{ once: true }}
                className="bg-white rounded-[16px] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-[#1E1B4B] pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: expandedFaq === index ? 45 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Icons.Plus size={20} className={`${expandedFaq === index ? 'text-[#9B8CF7]' : 'text-[#C4B5FD]'}`} />
                  </motion.div>
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: expandedFaq === index ? 'auto' : 0,
                    opacity: expandedFaq === index ? 1 : 0
                  }}
                  transition={{ duration: 0.3, ease: [0.625, 0.05, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 text-[#6B7280] leading-relaxed">
                    {faq.answer}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section - Soft Lavender */}
      <section className="py-28 bg-[#F5F3FF]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1E1B4B] mb-6 headline-font">
              Ready to start
              <br />
              <span className="headline-serif italic font-normal">earning with AI?</span>
            </h2>
            <p className="text-[#1E1B4B]/70 text-lg mb-10 max-w-2xl mx-auto">
              Be among the first to turn AI into real income.
              No experience required — join the waitlist today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="hb-btn hb-btn-navy text-lg px-10 py-5"
              >
                <span className="flex items-center gap-2">
                  Get started for free
                  <Icons.ArrowRight size={20} />
                </span>
              </button>
            </div>
            <p className="mt-6 text-sm text-[#1E1B4B]/50">
              Free to try • No credit card required • Get started in minutes
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer - Navy */}
      <footer className="py-16 bg-[#1E1B4B]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-10 w-10 rounded-lg" />
                <span className="font-semibold text-lg text-white tracking-tight headline-font">
                  Renovate<span className="text-[#9B8CF7]">MySite</span>
                </span>
              </div>
              <p className="text-white/60 text-sm max-w-xs leading-relaxed mb-6">
                Turn AI into extra income — create professional website previews for local businesses effortlessly.
              </p>
              <div className="flex items-center gap-4">
                <a href="https://www.instagram.com/renovatemysite" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <Icons.Instagram size={18} />
                </a>
                <a href="https://www.tiktok.com/@renovatemysite" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <Icons.TikTok size={18} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <nav className="space-y-3 text-sm text-white/60">
                <button onClick={() => scrollToSection('features')} className="block hover:text-white transition-colors">Features</button>
                <button onClick={() => scrollToSection('how-it-works')} className="block hover:text-white transition-colors">How it works</button>
                <button onClick={() => scrollToSection('testimonials')} className="block hover:text-white transition-colors">Success Stories</button>
                <button onClick={() => scrollToSection('faq')} className="block hover:text-white transition-colors">FAQ</button>
              </nav>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <nav className="space-y-3 text-sm text-white/60">
                <a href="#" className="block hover:text-white transition-colors">Contact</a>
              </nav>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-white/40 text-sm">
              <p>© 2026 RenovateMySite. All rights reserved.</p>
              <p>RenovateMySite is a product of Bright Tier Solutions, LLC.</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <button onClick={onPrivacyPolicy} className="hover:text-white transition-colors">Privacy Policy</button>
              <button onClick={onTermsOfService} className="hover:text-white transition-colors">Terms of Service</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
