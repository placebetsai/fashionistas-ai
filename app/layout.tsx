import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fashionistas.ai — Your Style. Your Rules. AI-Powered.',
  description: 'Expert fashion advice, product reviews, and style guides. Find the best shoes, beauty products, and outfit ideas — powered by AI and curated by editors.',
  keywords: ['fashion', 'AI stylist', 'outfit ideas', 'style quiz', 'fashion trends', 'capsule wardrobe', 'date night outfits', 'best shoes', 'skincare'],
  openGraph: {
    title: 'Fashionistas.ai — Your Style. Your Rules.',
    description: 'Expert fashion advice, product reviews, and style guides.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fashionistas.ai — Your Style. Your Rules.',
    description: 'Expert fashion advice, product reviews, and style guides.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7215975042937417"
          crossOrigin="anonymous"
        />
      </head>
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
      backgroundColor: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid #eee',
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
            <span style={{ color: '#E91E63' }}>Fashionista</span>
            <span style={{ color: '#FF6B9D' }}>.ai</span>
          </span>
        </a>
        <div style={{
          display: 'flex',
          gap: 28,
          alignItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          letterSpacing: '0.5px',
        }}>
          <a href="/shoes" style={{ color: '#666', transition: 'color 0.2s' }}>Shoes</a>
          <a href="/beauty" style={{ color: '#666', transition: 'color 0.2s' }}>Beauty</a>
          <a href="/fashion" style={{ color: '#666', transition: 'color 0.2s' }}>Fashion</a>
          <a href="/blog" style={{ color: '#666', transition: 'color 0.2s' }}>Blog</a>
          <a href="/quiz" style={{ color: '#666', transition: 'color 0.2s' }}>Quiz</a>
          <a href="/ai-stylist" style={{
            backgroundColor: '#E91E63',
            color: 'white',
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
      backgroundColor: '#fafafa',
      borderTop: '1px solid #eee',
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
            <h4 style={{ color: '#E91E63', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Categories</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/shoes" style={{ color: '#666', fontSize: 14 }}>Best Shoes</a>
              <a href="/beauty" style={{ color: '#666', fontSize: 14 }}>Beauty Picks</a>
              <a href="/fashion" style={{ color: '#666', fontSize: 14 }}>Fashion Guides</a>
              <a href="/deals" style={{ color: '#666', fontSize: 14 }}>Deals & Sales</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Best Of</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/best/comfortable-work-shoes" style={{ color: '#666', fontSize: 14 }}>Work Shoes</a>
              <a href="/best/sneakers-under-50" style={{ color: '#666', fontSize: 14 }}>Sneakers Under $50</a>
              <a href="/best/summer-sandals" style={{ color: '#666', fontSize: 14 }}>Summer Sandals</a>
              <a href="/best/tiktok-beauty-picks" style={{ color: '#666', fontSize: 14 }}>TikTok Beauty</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Tools</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/quiz" style={{ color: '#666', fontSize: 14 }}>Style Quiz</a>
              <a href="/ai-stylist" style={{ color: '#666', fontSize: 14 }}>AI Stylist</a>
              <a href="/trends" style={{ color: '#666', fontSize: 14 }}>2026 Trends</a>
              <a href="/outfit-ideas" style={{ color: '#666', fontSize: 14 }}>Outfit Ideas</a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 13, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Connect</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ color: '#666', fontSize: 14 }}>Pinterest</a>
              <a href="#" style={{ color: '#666', fontSize: 14 }}>Instagram</a>
              <a href="#" style={{ color: '#666', fontSize: 14 }}>Newsletter</a>
              <a href="#" style={{ color: '#666', fontSize: 14 }}>Contact</a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #eee',
          paddingTop: 24,
        }}>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'system-ui, sans-serif', lineHeight: 1.8, maxWidth: 800 }}>
            <strong style={{ color: '#666' }}>Affiliate Disclosure:</strong> Fashionistas.ai is supported by our readers. When you purchase through links on our site, we may earn an affiliate commission at no cost to you. We only recommend products we genuinely love and think you will too. Prices and availability are subject to change.
          </p>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'system-ui, sans-serif', marginTop: 16 }}>
            &copy; 2026 Fashionistas.ai — Your AI Fashion Stylist. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
