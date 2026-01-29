
import { getFirebaseDb, getFirebaseStorage, doc, setDoc, getDoc, updateDoc, Timestamp, ref, uploadString, getDownloadURL } from './firebase';
import { WebsiteBlueprint, Business } from '../types';

export interface PreviewDeployment {
  id: string;
  businessId: string;
  businessName: string;
  blueprint: WebsiteBlueprint;
  previewUrl: string;
  status: 'deploying' | 'live' | 'expired' | 'error';
  createdAt: string;
  expiresAt: string;
  errorMessage?: string;
}

// Generate a unique preview ID
const generatePreviewId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Calculate expiration date (5 days from now)
const getExpirationDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date;
};

// Format date for display
export const formatExpirationDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Calculate days remaining until expiration
export const getDaysRemaining = (expiresAt: string): number => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Generate static HTML from blueprint for preview deployment
// Matches the WebsiteRenderer.tsx component styling exactly
const generateStaticHTML = (blueprint: WebsiteBlueprint, businessName: string, isProduction: boolean = false): string => {
  const { brand, sections, navbar, footer } = blueprint;

  const fontFamily = brand.fontFamily || 'Outfit';
  const fontLink = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@300;400;500;600;700;800;900&display=swap`;
  const primaryColor = brand.primaryColor || '#10b981';
  const secondaryColor = brand.secondaryColor || '#8B5CF6';

  // Generate sections HTML matching WebsiteRenderer exactly
  const sectionsHTML = sections.map(section => {
    const hasValidImage = section.imageUrl &&
      (section.imageUrl.startsWith('http') || section.imageUrl.startsWith('/') || section.imageUrl.startsWith('data:'));

    switch (section.type) {
      case 'hero':
        return `
    <section class="hero-section">
      ${hasValidImage ? `
      <div class="hero-bg">
        <img src="${section.imageUrl}" alt="Hero" />
        <div class="hero-overlay"></div>
      </div>` : ''}
      <div class="hero-content">
        ${brand.logoUrl ? `
        <div class="hero-logo">
          <img src="${brand.logoUrl}" alt="${businessName} Logo" />
        </div>` : ''}
        <h1 class="hero-title">${section.title || 'Welcome'}</h1>
        <p class="hero-description">${section.content || ''}</p>
        ${section.cta ? `<button class="hero-cta">${section.cta}</button>` : ''}
      </div>
    </section>`;

      case 'services':
        const serviceItems = (section.content || '').split('. ').filter(s => s.trim());
        return `
    <section class="services-section">
      <div class="services-container">
        <h3 class="services-title">${section.title || 'Our Services'}</h3>
        <div class="services-grid">
          <div class="services-list">
            ${serviceItems.map((item, idx) => `
            <div class="service-item">
              <div class="service-number">${idx + 1}</div>
              <p class="service-text">${item}</p>
            </div>`).join('')}
          </div>
          ${hasValidImage ? `
          <div class="services-image">
            <img src="${section.imageUrl}" alt="${section.title}" />
          </div>` : ''}
        </div>
      </div>
    </section>`;

      case 'trust':
        return `
    <section class="trust-section">
      <div class="trust-container">
        <div class="trust-content">
          <h3 class="trust-title">${section.title || 'Why Choose Us'}</h3>
          <p class="trust-text">${section.content || ''}</p>
        </div>
        <div class="trust-stats">
          <div class="stat">
            <div class="stat-value">5.0</div>
            <div class="stat-label">Rating</div>
          </div>
          <div class="stat">
            <div class="stat-value">24h</div>
            <div class="stat-label">Service</div>
          </div>
        </div>
      </div>
    </section>`;

      case 'contact':
        return `
    <section class="contact-section">
      <div class="contact-container">
        <div class="contact-info">
          <h2 class="contact-title">${section.title || 'Contact Us'}</h2>
          <p class="contact-description">${section.content || ''}</p>
          <div class="contact-card">
            <div class="contact-card-label">Book a Session</div>
            <div class="contact-card-value">Call Now Available</div>
          </div>
        </div>
        <div class="contact-form">
          <div class="form-group">
            <label class="form-label">Your Name</label>
            <input type="text" class="form-input" placeholder="Enter your name" />
          </div>
          <button class="form-submit">${section.cta || 'Book Now'}</button>
        </div>
      </div>
    </section>`;

      case 'about':
        return `
    <section class="about-section" id="${section.id}">
      <div class="about-container">
        ${hasValidImage ? `
        <div class="about-image">
          <img src="${section.imageUrl}" alt="${section.title || 'About'}" />
        </div>` : ''}
        <div class="about-content">
          <h2 class="about-title">${section.title || 'About Us'}</h2>
          <p class="about-text">${section.content || ''}</p>
        </div>
      </div>
    </section>`;

      case 'testimonials':
        return `
    <section class="testimonials-section" id="${section.id}">
      <div class="testimonials-container">
        <h3 class="testimonials-title">${section.title || 'What Our Clients Say'}</h3>
        <p class="testimonials-subtitle">${section.content || ''}</p>
        <div class="testimonials-grid">
          ${[1, 2, 3].map(idx => `
          <div class="testimonial-card">
            <div class="testimonial-stars">★★★★★</div>
            <p class="testimonial-quote">"Amazing service! Highly recommended for anyone looking for quality."</p>
            <div class="testimonial-author">
              <div class="testimonial-avatar"></div>
              <div>
                <div class="testimonial-name">Happy Customer ${idx}</div>
                <div class="testimonial-role">Verified Buyer</div>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'pricing':
        return `
    <section class="pricing-section" id="${section.id}">
      <div class="pricing-container">
        <h3 class="pricing-title">${section.title || 'Pricing Plans'}</h3>
        <p class="pricing-subtitle">${section.content || 'Choose the plan that fits your needs'}</p>
        <div class="pricing-grid">
          ${['Basic', 'Pro', 'Enterprise'].map((plan, idx) => `
          <div class="pricing-card ${idx === 1 ? 'pricing-featured' : ''}">
            ${idx === 1 ? '<div class="pricing-badge">Most Popular</div>' : ''}
            <h4 class="pricing-plan-name">${plan}</h4>
            <div class="pricing-price">$${idx === 0 ? '29' : idx === 1 ? '79' : '199'}<span>/mo</span></div>
            <ul class="pricing-features">
              <li>✓ Feature one</li>
              <li>✓ Feature two</li>
              <li>✓ Feature three</li>
              ${idx > 0 ? '<li>✓ Premium feature</li>' : ''}
              ${idx > 1 ? '<li>✓ Enterprise feature</li>' : ''}
            </ul>
            <button class="pricing-cta ${idx === 1 ? 'pricing-cta-featured' : ''}">Get Started</button>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'faq':
        return `
    <section class="faq-section" id="${section.id}">
      <div class="faq-container">
        <h3 class="faq-title">${section.title || 'Frequently Asked Questions'}</h3>
        <p class="faq-subtitle">${section.content || ''}</p>
        <div class="faq-list">
          ${['How does it work?', 'What is included?', 'How can I get started?', 'What is your refund policy?', 'Do you offer support?'].map(q => `
          <div class="faq-item">
            <div class="faq-question">${q}</div>
            <p class="faq-answer">This is a placeholder answer. The AI will generate specific answers based on your business.</p>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'gallery':
        return `
    <section class="gallery-section" id="${section.id}">
      <div class="gallery-container">
        <h3 class="gallery-title">${section.title || 'Our Work'}</h3>
        <p class="gallery-subtitle">${section.content || ''}</p>
        <div class="gallery-grid">
          ${[1, 2, 3, 4, 5, 6].map(idx => `
          <div class="gallery-item">
            ${hasValidImage ? `<img src="${section.imageUrl}" alt="Gallery ${idx}" />` : '<div class="gallery-placeholder">📷</div>'}
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'team':
        return `
    <section class="team-section" id="${section.id}">
      <div class="team-container">
        <h3 class="team-title">${section.title || 'Meet Our Team'}</h3>
        <p class="team-subtitle">${section.content || ''}</p>
        <div class="team-grid">
          ${['CEO', 'CTO', 'Designer', 'Developer'].map(role => `
          <div class="team-member">
            <div class="team-avatar">👤</div>
            <h4 class="team-name">Team Member</h4>
            <p class="team-role">${role}</p>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'features':
        return `
    <section class="features-section" id="${section.id}">
      <div class="features-container">
        <h3 class="features-title">${section.title || 'Features'}</h3>
        <p class="features-subtitle">${section.content || ''}</p>
        <div class="features-grid">
          ${['Fast', 'Reliable', 'Secure', 'Scalable', 'Modern', 'Support'].map(feature => `
          <div class="feature-card">
            <div class="feature-icon">✓</div>
            <h4 class="feature-name">${feature}</h4>
            <p class="feature-desc">A brief description of this feature and its benefits.</p>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

      case 'cta':
        return `
    <section class="cta-section" id="${section.id}">
      <div class="cta-container">
        <h3 class="cta-title">${section.title || 'Ready to Get Started?'}</h3>
        <p class="cta-subtitle">${section.content || ''}</p>
        ${section.cta ? `<button class="cta-button">${section.cta}</button>` : ''}
      </div>
    </section>`;

      default:
        return '';
    }
  }).join('\n');

  // Generate navbar HTML
  const navbarHTML = navbar?.enabled ? `
  <nav class="navbar ${navbar.style || 'solid'} ${navbar.position === 'fixed' ? 'navbar-fixed' : ''}">
    <div class="navbar-container">
      <div class="navbar-brand">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="Logo" class="navbar-logo" />` : `<span class="navbar-brand-text">${businessName}</span>`}
      </div>
      <div class="navbar-links">
        ${(navbar.links || []).map(link => `<a href="${link.href}" class="navbar-link">${link.label}</a>`).join('')}
      </div>
      ${navbar.ctaButton ? `<a href="${navbar.ctaButton.href}" class="navbar-cta">${navbar.ctaButton.label}</a>` : ''}
    </div>
  </nav>` : '';

  // Generate footer HTML
  const footerHTML = footer?.enabled ? (
    footer.style === 'minimal' ? `
  <footer class="footer-minimal">
    <div class="footer-container">
      <p class="footer-copyright">${footer.copyright || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`}</p>
      ${footer.socialLinks ? `
      <div class="footer-social">
        ${footer.socialLinks.facebook ? '<a href="' + footer.socialLinks.facebook + '" class="social-link">FB</a>' : ''}
        ${footer.socialLinks.instagram ? '<a href="' + footer.socialLinks.instagram + '" class="social-link">IG</a>' : ''}
        ${footer.socialLinks.twitter ? '<a href="' + footer.socialLinks.twitter + '" class="social-link">TW</a>' : ''}
        ${footer.socialLinks.linkedin ? '<a href="' + footer.socialLinks.linkedin + '" class="social-link">LI</a>' : ''}
      </div>` : ''}
    </div>
  </footer>` : `
  <footer class="footer-detailed">
    <div class="footer-container">
      ${footer.columns && footer.columns.length > 0 ? `
      <div class="footer-columns">
        ${footer.columns.map(col => `
        <div class="footer-column">
          <h4 class="footer-column-title">${col.title}</h4>
          ${col.links.map(link => `<a href="${link.href}" class="footer-link">${link.label}</a>`).join('')}
        </div>`).join('')}
      </div>` : ''}
      ${footer.showNewsletter ? `
      <div class="footer-newsletter">
        <h4 class="footer-newsletter-title">Subscribe to our newsletter</h4>
        <p class="footer-newsletter-desc">Get the latest updates and offers.</p>
        <div class="footer-newsletter-form">
          <input type="email" placeholder="Enter your email" class="footer-newsletter-input" />
          <button class="footer-newsletter-btn">Subscribe</button>
        </div>
      </div>` : ''}
      <div class="footer-bottom">
        <p class="footer-copyright">${footer.copyright || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`}</p>
        ${footer.socialLinks ? `
        <div class="footer-social">
          ${footer.socialLinks.facebook ? '<a href="' + footer.socialLinks.facebook + '" class="social-link">FB</a>' : ''}
          ${footer.socialLinks.instagram ? '<a href="' + footer.socialLinks.instagram + '" class="social-link">IG</a>' : ''}
          ${footer.socialLinks.twitter ? '<a href="' + footer.socialLinks.twitter + '" class="social-link">TW</a>' : ''}
          ${footer.socialLinks.linkedin ? '<a href="' + footer.socialLinks.linkedin + '" class="social-link">LI</a>' : ''}
        </div>` : ''}
      </div>
    </div>
  </footer>`
  ) : `
  <footer class="footer">
    <p>© ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
  </footer>`;

  const previewBanner = !isProduction ? `
  <div class="preview-banner">
    <span>✨ Live AI Generation Draft</span>
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${businessName} - Professional services">
  <meta name="theme-color" content="${primaryColor}">
  <title>${businessName}${!isProduction ? ' - Preview' : ''}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontLink}" rel="stylesheet">

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --font: '${fontFamily}', system-ui, sans-serif;
    }

    html { scroll-behavior: smooth; }
    body { font-family: var(--font); background: #fff; color: #18181b; }

    /* Preview Banner - matches WebsiteRenderer */
    .preview-banner {
      background: #09090b;
      padding: 0.625rem;
      text-align: center;
      font-size: 9px;
      font-weight: 900;
      color: #10b981;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    /* Hero Section - matches WebsiteRenderer exactly */
    .hero-section {
      position: relative;
      min-height: 600px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 6rem 2rem;
      background: #09090b;
      overflow: hidden;
      color: white;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
    }

    .hero-bg img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.4;
    }

    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, #09090b, rgba(9,9,11,0.6), transparent);
    }

    .hero-content {
      position: relative;
      z-index: 10;
      max-width: 64rem;
    }

    .hero-logo {
      margin-bottom: 3rem;
      display: flex;
      justify-content: center;
    }

    .hero-logo img {
      height: 4rem;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 25px 25px rgba(0,0,0,0.25));
    }

    @media (min-width: 768px) {
      .hero-logo img { height: 6rem; }
    }

    .hero-title {
      font-size: clamp(3.75rem, 8vw, 9rem);
      font-weight: 900;
      margin-bottom: 2rem;
      line-height: 0.9;
      letter-spacing: -0.05em;
      color: var(--primary);
    }

    .hero-description {
      font-size: clamp(1.25rem, 2vw, 1.5rem);
      color: #d4d4d8;
      margin-bottom: 3rem;
      line-height: 1.6;
      max-width: 42rem;
      margin-left: auto;
      margin-right: auto;
      font-weight: 300;
    }

    .hero-cta {
      padding: 1.5rem 4rem;
      border-radius: 1rem;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      color: white;
      background: var(--primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }

    .hero-cta:hover { transform: scale(1.05); }

    /* Services Section */
    .services-section {
      padding: 6rem 2rem;
      background: white;
    }

    .services-container {
      max-width: 72rem;
      margin: 0 auto;
    }

    .services-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      letter-spacing: -0.025em;
      margin-bottom: 4rem;
      font-style: italic;
    }

    .services-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 3rem;
    }

    @media (min-width: 768px) {
      .services-grid { grid-template-columns: 1fr 1fr; }
    }

    .services-list {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      text-align: left;
    }

    .service-item {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }

    .service-number {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-weight: 900;
      color: white;
      background: var(--secondary);
    }

    .service-text {
      font-size: 1.25rem;
      color: #52525b;
      font-weight: 300;
    }

    .services-image {
      border-radius: 2.5rem;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      height: 400px;
    }

    .services-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Trust Section */
    .trust-section {
      padding: 6rem 2rem;
      background: #09090b;
      color: white;
    }

    .trust-container {
      max-width: 72rem;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 3rem;
      align-items: center;
      text-align: left;
    }

    @media (min-width: 768px) {
      .trust-container {
        flex-direction: row;
        justify-content: space-between;
      }
    }

    .trust-content {
      max-width: 36rem;
    }

    .trust-title {
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: -0.05em;
      font-style: italic;
      margin-bottom: 1.5rem;
      color: var(--primary);
    }

    .trust-text {
      color: #a1a1aa;
      font-size: 1.25rem;
      font-weight: 300;
      line-height: 1.6;
    }

    .trust-stats {
      display: flex;
      gap: 4rem;
    }

    .stat-value {
      font-size: 2.25rem;
      font-weight: 900;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #52525b;
      letter-spacing: 0.1em;
    }

    /* Contact Section */
    .contact-section {
      padding: 8rem 2rem;
      background: #fafafa;
    }

    .contact-container {
      max-width: 72rem;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 5rem;
      align-items: center;
    }

    @media (min-width: 768px) {
      .contact-container { grid-template-columns: 1fr 1fr; }
    }

    .contact-info {
      text-align: left;
    }

    .contact-title {
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: -0.05em;
      margin-bottom: 2rem;
      font-style: italic;
    }

    .contact-description {
      color: #71717a;
      font-size: 1.25rem;
      line-height: 1.6;
      margin-bottom: 3rem;
      font-weight: 300;
    }

    .contact-card {
      padding: 2rem;
      background: white;
      border-radius: 1.5rem;
      border: 1px solid #f4f4f5;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
      display: inline-block;
    }

    .contact-card-label {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a1a1aa;
      margin-bottom: 0.5rem;
    }

    .contact-card-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .contact-form {
      background: white;
      padding: 3rem;
      border-radius: 3rem;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
      border: 1px solid #fafafa;
    }

    .form-group {
      margin-bottom: 2rem;
      text-align: left;
    }

    .form-label {
      display: block;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a1a1aa;
      margin-bottom: 0.5rem;
    }

    .form-input {
      width: 100%;
      padding: 1.5rem;
      background: #fafafa;
      border: none;
      border-radius: 1rem;
      outline: none;
      font-family: inherit;
      font-size: 1rem;
    }

    .form-input:focus {
      box-shadow: 0 0 0 4px rgba(16,185,129,0.1);
    }

    .form-submit {
      width: 100%;
      padding: 1.5rem;
      color: white;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      border-radius: 1rem;
      border: none;
      cursor: pointer;
      background: var(--primary);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }

    /* About Section */
    .about-section {
      padding: 6rem 2rem;
      background: white;
    }

    .about-container {
      max-width: 72rem;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: 3rem;
      align-items: center;
    }

    @media (min-width: 768px) {
      .about-container { grid-template-columns: 1fr 1fr; }
    }

    .about-image {
      border-radius: 2.5rem;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
    }

    .about-image img {
      width: 100%;
      height: auto;
    }

    .about-content {
      text-align: left;
    }

    .about-title {
      font-size: clamp(2rem, 3vw, 3rem);
      font-weight: 900;
      letter-spacing: -0.025em;
      margin-bottom: 1.5rem;
      font-style: italic;
    }

    .about-text {
      color: #71717a;
      font-size: 1.1rem;
      line-height: 1.8;
      font-weight: 300;
    }

    /* Footer */
    .footer {
      padding: 2rem;
      background: #09090b;
      color: #52525b;
      text-align: center;
      font-size: 0.875rem;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    /* Navbar Styles */
    .navbar {
      width: 100%;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .navbar.solid { background: #09090b; }
    .navbar.glass { background: rgba(9,9,11,0.8); backdrop-filter: blur(12px); }
    .navbar.transparent { background: transparent; }
    .navbar-fixed { position: fixed; top: 0; left: 0; right: 0; z-index: 50; }
    .navbar-container {
      max-width: 80rem;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .navbar-logo { height: 2rem; width: auto; }
    .navbar-brand-text { color: white; font-weight: 700; font-size: 1.125rem; }
    .navbar-links { display: flex; gap: 2rem; }
    .navbar-link { color: #a1a1aa; font-size: 0.875rem; text-decoration: none; transition: color 0.2s; }
    .navbar-link:hover { color: white; }
    .navbar-cta {
      padding: 0.625rem 1.5rem;
      border-radius: 0.75rem;
      color: white;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
      background: var(--primary);
    }
    @media (max-width: 768px) {
      .navbar-links { display: none; }
    }

    /* Footer Styles */
    .footer-minimal, .footer-detailed {
      background: #09090b;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .footer-minimal .footer-container {
      max-width: 72rem;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .footer-detailed .footer-container {
      max-width: 72rem;
      margin: 0 auto;
      padding: 4rem 1.5rem;
    }
    .footer-columns {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      margin-bottom: 3rem;
    }
    @media (max-width: 768px) {
      .footer-columns { grid-template-columns: repeat(2, 1fr); }
    }
    .footer-column-title { color: white; font-weight: 700; margin-bottom: 1rem; }
    .footer-link { display: block; color: #a1a1aa; font-size: 0.875rem; text-decoration: none; margin-bottom: 0.5rem; }
    .footer-link:hover { color: white; }
    .footer-copyright { color: #52525b; font-size: 0.875rem; }
    .footer-social { display: flex; gap: 1rem; }
    .social-link { color: #52525b; text-decoration: none; transition: color 0.2s; }
    .social-link:hover { color: white; }
    .footer-newsletter {
      padding: 2rem;
      background: rgba(255,255,255,0.05);
      border-radius: 1rem;
      margin-bottom: 3rem;
    }
    .footer-newsletter-title { color: white; font-weight: 700; margin-bottom: 0.5rem; }
    .footer-newsletter-desc { color: #71717a; font-size: 0.875rem; margin-bottom: 1rem; }
    .footer-newsletter-form { display: flex; gap: 0.5rem; }
    .footer-newsletter-input {
      flex: 1;
      padding: 0.75rem 1rem;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 0.75rem;
      color: white;
      font-size: 0.875rem;
      outline: none;
    }
    .footer-newsletter-btn {
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      color: white;
      font-size: 0.875rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      background: var(--primary);
    }
    .footer-bottom {
      padding-top: 2rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    /* Testimonials Section */
    .testimonials-section { padding: 6rem 2rem; background: white; }
    .testimonials-container { max-width: 72rem; margin: 0 auto; }
    .testimonials-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
    }
    .testimonials-subtitle { text-align: center; color: #71717a; font-size: 1.25rem; margin-bottom: 4rem; max-width: 42rem; margin-left: auto; margin-right: auto; }
    .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    @media (max-width: 768px) { .testimonials-grid { grid-template-columns: 1fr; } }
    .testimonial-card { padding: 2rem; background: #fafafa; border-radius: 1.5rem; }
    .testimonial-stars { color: var(--primary); margin-bottom: 1rem; letter-spacing: 0.2em; }
    .testimonial-quote { color: #52525b; font-size: 1.125rem; font-style: italic; margin-bottom: 1.5rem; }
    .testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
    .testimonial-avatar { width: 2.5rem; height: 2.5rem; border-radius: 50%; background: #e4e4e7; }
    .testimonial-name { font-weight: 700; color: #18181b; }
    .testimonial-role { font-size: 0.875rem; color: #71717a; }

    /* Pricing Section */
    .pricing-section { padding: 6rem 2rem; background: #09090b; color: white; }
    .pricing-container { max-width: 72rem; margin: 0 auto; }
    .pricing-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
      color: var(--primary);
    }
    .pricing-subtitle { text-align: center; color: #a1a1aa; font-size: 1.25rem; margin-bottom: 4rem; max-width: 42rem; margin-left: auto; margin-right: auto; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    @media (max-width: 768px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card { padding: 2rem; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); }
    .pricing-featured { border-width: 2px; border-color: var(--primary); background: rgba(16,185,129,0.1); transform: scale(1.05); }
    .pricing-badge { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); margin-bottom: 1rem; }
    .pricing-plan-name { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .pricing-price { font-size: 2.5rem; font-weight: 900; margin-bottom: 1.5rem; }
    .pricing-price span { font-size: 0.875rem; color: #71717a; font-weight: 400; }
    .pricing-features { list-style: none; margin-bottom: 2rem; }
    .pricing-features li { color: #a1a1aa; padding: 0.5rem 0; }
    .pricing-cta {
      width: 100%;
      padding: 1rem;
      border-radius: 0.75rem;
      font-weight: 700;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
    }
    .pricing-cta-featured { background: var(--primary); border-color: var(--primary); }

    /* FAQ Section */
    .faq-section { padding: 6rem 2rem; background: white; }
    .faq-container { max-width: 48rem; margin: 0 auto; }
    .faq-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
    }
    .faq-subtitle { text-align: center; color: #71717a; font-size: 1.25rem; margin-bottom: 4rem; }
    .faq-list { display: flex; flex-direction: column; gap: 1rem; }
    .faq-item { padding: 1.5rem; background: #fafafa; border-radius: 1rem; }
    .faq-question { font-weight: 700; font-size: 1.125rem; margin-bottom: 1rem; }
    .faq-answer { color: #71717a; font-size: 0.875rem; }

    /* Gallery Section */
    .gallery-section { padding: 6rem 2rem; background: #fafafa; }
    .gallery-container { max-width: 72rem; margin: 0 auto; }
    .gallery-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
    }
    .gallery-subtitle { text-align: center; color: #71717a; font-size: 1.25rem; margin-bottom: 4rem; }
    .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    @media (max-width: 768px) { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }
    .gallery-item { aspect-ratio: 1; background: #e4e4e7; border-radius: 1rem; overflow: hidden; }
    .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
    .gallery-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: #a1a1aa; }

    /* Team Section */
    .team-section { padding: 6rem 2rem; background: white; }
    .team-container { max-width: 72rem; margin: 0 auto; }
    .team-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
    }
    .team-subtitle { text-align: center; color: #71717a; font-size: 1.25rem; margin-bottom: 4rem; }
    .team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
    @media (max-width: 768px) { .team-grid { grid-template-columns: repeat(2, 1fr); } }
    .team-member { text-align: center; }
    .team-avatar { width: 8rem; height: 8rem; margin: 0 auto 1rem; border-radius: 50%; background: #e4e4e7; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: #a1a1aa; }
    .team-name { font-weight: 700; font-size: 1.125rem; }
    .team-role { color: #71717a; }

    /* Features Section */
    .features-section { padding: 6rem 2rem; background: #09090b; color: white; }
    .features-container { max-width: 72rem; margin: 0 auto; }
    .features-title {
      font-size: clamp(2.25rem, 4vw, 3.75rem);
      font-weight: 900;
      text-align: center;
      font-style: italic;
      margin-bottom: 1rem;
      color: var(--primary);
    }
    .features-subtitle { text-align: center; color: #a1a1aa; font-size: 1.25rem; margin-bottom: 4rem; max-width: 42rem; margin-left: auto; margin-right: auto; }
    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    @media (max-width: 768px) { .features-grid { grid-template-columns: 1fr; } }
    .feature-card { padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 1rem; border: 1px solid rgba(255,255,255,0.1); }
    .feature-icon { width: 3rem; height: 3rem; border-radius: 0.75rem; background: rgba(16,185,129,0.2); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.5rem; margin-bottom: 1rem; }
    .feature-name { font-weight: 700; font-size: 1.25rem; margin-bottom: 0.5rem; }
    .feature-desc { color: #71717a; font-size: 0.875rem; }

    /* CTA Section */
    .cta-section { padding: 6rem 2rem; background: var(--primary); }
    .cta-container { max-width: 48rem; margin: 0 auto; text-align: center; }
    .cta-title { font-size: clamp(2.25rem, 4vw, 3.75rem); font-weight: 900; color: white; margin-bottom: 1.5rem; }
    .cta-subtitle { color: rgba(255,255,255,0.8); font-size: 1.25rem; margin-bottom: 3rem; }
    .cta-button {
      padding: 1.5rem 4rem;
      border-radius: 1rem;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      background: white;
      color: var(--primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }

    /* Navbar padding for fixed nav */
    .navbar-fixed ~ main { padding-top: 4rem; }
  </style>
</head>
<body>
  ${previewBanner}
  ${navbarHTML}
  <main>
    ${sectionsHTML}
  </main>
  ${footerHTML}
</body>
</html>`;
};

/**
 * Deploy a preview website to Firebase Storage
 * Returns the preview deployment info including a public URL
 */
export const deployPreview = async (
  business: Business,
  blueprint: WebsiteBlueprint
): Promise<PreviewDeployment> => {
  const previewId = generatePreviewId();
  const now = new Date();
  const expiresAt = getExpirationDate();

  // Create preview deployment record with placeholder URL
  const deployment: PreviewDeployment = {
    id: previewId,
    businessId: business.id,
    businessName: business.name,
    blueprint,
    previewUrl: '', // Will be set after upload
    status: 'deploying',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  try {
    console.log('[Preview Deploy] Starting deployment for:', business.name);
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    // Generate static HTML for the preview
    console.log('[Preview Deploy] Generating static HTML...');
    const staticHTML = generateStaticHTML(blueprint, business.name);
    console.log('[Preview Deploy] HTML generated, size:', staticHTML.length, 'bytes');

    // Upload HTML to Firebase Storage
    if (storage) {
      console.log('[Preview Deploy] Uploading to Firebase Storage...');
      const storageRef = ref(storage, `previews/${previewId}/index.html`);

      // Upload the HTML string with content type
      await uploadString(storageRef, staticHTML, 'raw', {
        contentType: 'text/html; charset=utf-8',
        customMetadata: {
          businessName: business.name,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        }
      });
      console.log('[Preview Deploy] Upload complete, getting download URL...');

      // Get the public download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log('[Preview Deploy] Got download URL:', downloadUrl);
      deployment.previewUrl = downloadUrl;
    } else {
      throw new Error('Firebase Storage not initialized. Please check your Firebase configuration.');
    }

    // Save deployment record to Firestore (metadata only, no HTML - it's in Storage)
    if (db) {
      console.log('[Preview Deploy] Saving to Firestore...');
      await setDoc(doc(db, 'preview_deployments', previewId), {
        id: deployment.id,
        businessId: deployment.businessId,
        businessName: deployment.businessName,
        previewUrl: deployment.previewUrl,
        status: deployment.status,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt)
      });
      console.log('[Preview Deploy] Saved preview_deployments');
      // Note: HTML is stored in Firebase Storage, not Firestore (Firestore has 1MB doc limit)
    }

    // Update status to live
    deployment.status = 'live';

    if (db) {
      await updateDoc(doc(db, 'preview_deployments', previewId), {
        status: 'live',
        previewUrl: deployment.previewUrl
      });
      console.log('[Preview Deploy] Updated status to live');
    }

    console.log('[Preview Deploy] Deployment complete!', deployment.previewUrl);
    return deployment;
  } catch (error: any) {
    console.error('[Preview Deploy] Error:', error);
    deployment.status = 'error';
    deployment.errorMessage = error.message || 'Failed to deploy preview';

    // Update error status in Firestore (metadata only)
    const db = getFirebaseDb();
    if (db) {
      try {
        await setDoc(doc(db, 'preview_deployments', previewId), {
          id: deployment.id,
          businessId: deployment.businessId,
          businessName: deployment.businessName,
          previewUrl: deployment.previewUrl,
          status: 'error',
          errorMessage: deployment.errorMessage,
          createdAt: Timestamp.fromDate(now),
          expiresAt: Timestamp.fromDate(expiresAt)
        });
      } catch (e) {
        // Ignore Firestore errors when logging deployment errors
        console.error('[Preview Deploy] Failed to log error to Firestore:', e);
      }
    }

    throw error;
  }
};

/**
 * Get preview deployment by ID
 */
export const getPreviewDeployment = async (previewId: string): Promise<PreviewDeployment | null> => {
  const db = getFirebaseDb();
  if (!db) return null;

  const docRef = doc(db, 'preview_deployments', previewId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    ...data,
    blueprint: JSON.parse(data.blueprint),
    createdAt: data.createdAt.toDate().toISOString(),
    expiresAt: data.expiresAt.toDate().toISOString()
  } as PreviewDeployment;
};

/**
 * Check if a preview deployment has expired
 */
export const isPreviewExpired = (deployment: PreviewDeployment): boolean => {
  const now = new Date();
  const expiresAt = new Date(deployment.expiresAt);
  return now > expiresAt;
};

/**
 * Mark expired previews as expired (cleanup job)
 */
export const markExpiredPreviews = async (): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) return;

  // This would typically be run as a Cloud Function scheduled task
  // For client-side, we just check on access
};

/**
 * Deploy raw HTML site (for Vibe Editor)
 * Wraps the AI-generated HTML body content in a complete HTML document
 */
export const deployHTMLPreview = async (
  businessName: string,
  businessId: string,
  htmlContent: string
): Promise<PreviewDeployment> => {
  const previewId = generatePreviewId();
  const now = new Date();
  const expiresAt = getExpirationDate();

  // Create preview deployment record with placeholder URL
  const deployment: PreviewDeployment = {
    id: previewId,
    businessId: businessId,
    businessName: businessName,
    blueprint: {} as WebsiteBlueprint, // Empty blueprint for HTML-based sites
    previewUrl: '',
    status: 'deploying',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  try {
    console.log('[HTML Preview Deploy] Starting deployment for:', businessName);
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    // Wrap AI-generated HTML in a complete document with Tailwind 4.0 + Framer Motion
    // The Tailwind CDN is configured with extended colors and glassmorphism support
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${businessName} - Professional services">
  <title>${businessName}</title>
  <!-- Tailwind CSS CDN with v4-compatible configuration -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: 'var(--color-primary, #10b981)',
            secondary: 'var(--color-secondary, #8B5CF6)',
            accent: 'var(--color-accent, #34d399)',
          },
          backdropBlur: {
            xl: '24px',
            '2xl': '40px',
          },
          borderRadius: {
            '3xl': '24px',
            '4xl': '32px',
          },
          boxShadow: {
            'glow': '0 0 20px rgba(var(--color-primary-rgb, 16, 185, 129), 0.3)',
            'glow-lg': '0 0 40px rgba(var(--color-primary-rgb, 16, 185, 129), 0.4)',
          },
        }
      }
    }
  </script>
  <!-- Framer Motion for animations -->
  <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js"></script>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* Base styles */
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 0; overflow-x: hidden; }

    /* SaaS Glossy Animations */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-30px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
    .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
    .animate-slide-in-left { animation: slideInLeft 0.8s ease-out forwards; }
    .animate-float { animation: float 3s ease-in-out infinite; }

    /* Staggered animation delays */
    .animation-delay-100, .delay-100 { animation-delay: 100ms; opacity: 0; }
    .animation-delay-200, .delay-200 { animation-delay: 200ms; opacity: 0; }
    .animation-delay-300, .delay-300 { animation-delay: 300ms; opacity: 0; }
    .animation-delay-400, .delay-400 { animation-delay: 400ms; opacity: 0; }
    .animation-delay-500, .delay-500 { animation-delay: 500ms; opacity: 0; }
    .animation-delay-600, .delay-600 { animation-delay: 600ms; opacity: 0; }
    .delay-700 { animation-delay: 700ms; opacity: 0; }
    .delay-800 { animation-delay: 800ms; opacity: 0; }
    .delay-900 { animation-delay: 900ms; opacity: 0; }
    .delay-1000 { animation-delay: 1000ms; opacity: 0; }

    /* Smooth scroll */
    html { scroll-behavior: smooth; }

    /* Glassmorphism utilities */
    .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .glass-dark { background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .glass-card {
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
    }

    /* Glass & Glow v4.0 */
    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3); }
      50% { box-shadow: 0 0 40px rgba(var(--color-accent-rgb, 96, 165, 250), 0.6); }
    }
    @keyframes fadeInLeft {
      from { opacity: 0; transform: translateX(-40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeInRight {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
    .animate-fade-in-left { animation: fadeInLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .animate-fade-in-right { animation: fadeInRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

    /* Glow Effects */
    .glow { box-shadow: 0 0 30px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3); }
    .glow-lg { box-shadow: 0 0 60px rgba(var(--color-accent-rgb, 96, 165, 250), 0.4); }
    .glow-text { text-shadow: 0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.5); }

    /* Mesh Gradient Background */
    .mesh-bg {
      background-image:
        radial-gradient(at 40% 20%, rgba(var(--color-accent-rgb, 96, 165, 250), 0.3) 0px, transparent 50%),
        radial-gradient(at 80% 0%, rgba(var(--color-primary-rgb, 59, 130, 246), 0.2) 0px, transparent 50%),
        radial-gradient(at 0% 50%, rgba(var(--color-accent-rgb, 96, 165, 250), 0.2) 0px, transparent 50%);
    }

    /* Premium Button */
    .btn-glow {
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      box-shadow: 0 4px 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3);
      transition: all 0.3s ease;
    }
    .btn-glow:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 40px rgba(var(--color-accent-rgb, 96, 165, 250), 0.5);
    }

    /* Gradient Text with Glow */
    .gradient-text {
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gradient-text-glow {
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3));
    }

    /* Card Effects */
    .card-hover {
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .card-hover:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .img-reveal {
      overflow: hidden;
      border-radius: 24px;
    }
    .img-reveal img {
      transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .img-reveal:hover img {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    console.log('[HTML Preview Deploy] HTML document generated, size:', fullHTML.length, 'bytes');

    // Upload HTML to Firebase Storage
    if (storage) {
      console.log('[HTML Preview Deploy] Uploading to Firebase Storage...');
      const storageRef = ref(storage, `previews/${previewId}/index.html`);

      await uploadString(storageRef, fullHTML, 'raw', {
        contentType: 'text/html; charset=utf-8',
        customMetadata: {
          businessName: businessName,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          type: 'vibe-editor'
        }
      });
      console.log('[HTML Preview Deploy] Upload complete, getting download URL...');

      const downloadUrl = await getDownloadURL(storageRef);
      console.log('[HTML Preview Deploy] Got download URL:', downloadUrl);
      deployment.previewUrl = downloadUrl;
    } else {
      throw new Error('Firebase Storage not initialized.');
    }

    // Save deployment record to Firestore
    if (db) {
      console.log('[HTML Preview Deploy] Saving to Firestore...');
      await setDoc(doc(db, 'preview_deployments', previewId), {
        id: deployment.id,
        businessId: deployment.businessId,
        businessName: deployment.businessName,
        previewUrl: deployment.previewUrl,
        status: 'live',
        type: 'vibe-editor',
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt)
      });
      console.log('[HTML Preview Deploy] Saved to Firestore');
    }

    deployment.status = 'live';
    console.log('[HTML Preview Deploy] Deployment complete!', deployment.previewUrl);
    return deployment;
  } catch (error: any) {
    console.error('[HTML Preview Deploy] Error:', error);
    deployment.status = 'error';
    deployment.errorMessage = error.message || 'Failed to deploy preview';

    const db = getFirebaseDb();
    if (db) {
      try {
        await setDoc(doc(db, 'preview_deployments', previewId), {
          id: deployment.id,
          businessId: deployment.businessId,
          businessName: deployment.businessName,
          previewUrl: deployment.previewUrl,
          status: 'error',
          errorMessage: deployment.errorMessage,
          type: 'vibe-editor',
          createdAt: Timestamp.fromDate(now),
          expiresAt: Timestamp.fromDate(expiresAt)
        });
      } catch (e) {
        console.error('[HTML Preview Deploy] Failed to log error to Firestore:', e);
      }
    }

    throw error;
  }
};
