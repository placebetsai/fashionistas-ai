import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7215975042937417"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Header />
        <main style={{ minHeight: '100vh' }}>{children}</main>
        <Footer />
      </body>
    </html>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 40,
          marginBottom: 40,
        }}>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Categories</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['/shoes', 'Best Shoes'],
                ['/beauty', 'Beauty Picks'],
                ['/fashion', 'Fashion Guides'],
                ['/deals', 'Deals & Sales'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Best Of</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['/best/comfortable-work-shoes', 'Work Shoes'],
                ['/best/sneakers-under-50', 'Sneakers Under $50'],
                ['/best/summer-sandals', 'Summer Sandals'],
                ['/best/tiktok-beauty-picks', 'TikTok Beauty'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Tools</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['/quiz', 'Style Quiz'],
                ['/ai-stylist', 'AI Stylist'],
                ['/trends', '2026 Trends'],
                ['/outfit-ideas', 'Outfit Ideas'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Connect</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/about" style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'none' }}>About</a>
              <a href="/contact" style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'none' }}>Contact</a>
              <a href="/privacy" style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="/terms" style={{ color: '#666', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'none' }}>Terms of Service</a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #eee',
          paddingTop: 24,
        }}>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.8, maxWidth: 800 }}>
            <strong style={{ color: '#666' }}>Affiliate Disclosure:</strong> Fashionistas.ai is supported by our readers. When you purchase through links on our site, we may earn an affiliate commission at no cost to you. We only recommend products we genuinely love.
          </p>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 16 }}>
            &copy; 2026 Fashionistas.ai — Your AI Fashion Stylist. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
