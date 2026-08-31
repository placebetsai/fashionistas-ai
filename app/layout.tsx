import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fashionistas.ai — Your AI Fashion Stylist',
  description: 'Discover your personal style with AI-powered recommendations, trend guides, outfit ideas, and curated fashion content. From capsule wardrobes to date night looks.',
  keywords: ['fashion', 'AI stylist', 'outfit ideas', 'style quiz', 'fashion trends', 'capsule wardrobe', 'date night outfits'],
  openGraph: {
    title: 'Fashionistas.ai — Your AI Fashion Stylist',
    description: 'AI-powered fashion recommendations, trend guides, and curated outfit ideas.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fashionistas.ai — Your AI Fashion Stylist',
    description: 'AI-powered fashion recommendations, trend guides, and curated outfit ideas.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main style={{ minHeight: '100vh' }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Nav() {
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: 'rgba(10,10,10,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            letterSpacing: '-0.5px',
          }}>
            <span style={{ color: 'var(--accent-gold)' }}>Fashionista</span>
            <span style={{ color: 'var(--accent-blush)' }}>.ai</span>
          </span>
        </a>
        <div style={{
          display: 'flex',
          gap: 32,
          alignItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          letterSpacing: '0.5px',
        }}>
          <a href="/quiz" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Style Quiz</a>
          <a href="/trends" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Trends</a>
          <a href="/outfit-ideas" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Outfits</a>
          <a href="/brands" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Brands</a>
          <a href="/blog" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Blog</a>
          <a href="/ai-stylist" style={{
            background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
            color: 'var(--bg-primary)',
            padding: '8px 20px',
            borderRadius: 24,
            fontWeight: 600,
            fontSize: 13,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
          }}>AI Stylist</a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-primary)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '60px 20px 40px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 40,
          marginBottom: 40,
        }}>
          <div>
            <h4 style={{ color: 'var(--accent-gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Discover</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/quiz" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Style Finder Quiz</a>
              <a href="/ai-stylist" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AI Stylist</a>
              <a href="/trends" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>2026 Trends</a>
              <a href="/outfit-ideas" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Outfit Ideas</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Content</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/blog" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Blog</a>
              <a href="/brands" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Brand Comparisons</a>
              <a href="/blog" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Capsule Wardrobe Guide</a>
              <a href="/blog" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Seasonal Lookbooks</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Connect</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Pinterest</a>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Instagram</a>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Newsletter</a>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Contact</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--accent-gold)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Privacy Policy</a>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Terms of Service</a>
              <a href="#" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Affiliate Disclosure</a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 24,
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', lineHeight: 1.8, maxWidth: 800 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Affiliate Disclosure:</strong> Fashionistas.ai is supported by our readers. When you purchase through links on our site, we may earn an affiliate commission at no cost to you. We only recommend products we genuinely love and think you will too. Prices and availability are subject to change.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginTop: 16 }}>
            &copy; 2026 Fashionistas.ai — Your AI Fashion Stylist. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
