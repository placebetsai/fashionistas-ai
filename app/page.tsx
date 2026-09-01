import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fashionistas.ai — Your Style. Your Rules. AI-Powered.',
  description: 'Expert fashion advice, product reviews, and style guides. Find the best shoes, beauty products, and outfit ideas — powered by AI and curated by editors.',
  openGraph: {
    title: 'Fashionistas.ai — Your Style. Your Rules.',
    description: 'Expert fashion advice, product reviews, and style guides.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

const trendingCategories = [
  { name: 'Comfort Shoes', emoji: '👟', href: '/shoes', color: '#E91E63' },
  { name: 'Beauty Picks', emoji: '💄', href: '/beauty', color: '#9C27B0' },
  { name: 'Outfit Ideas', emoji: '👗', href: '/fashion', color: '#FF6B9D' },
  { name: 'Best Deals', emoji: '🏷️', href: '/deals', color: '#FF9800' },
  { name: 'Style Quiz', emoji: '✨', href: '/quiz', color: '#4CAF50' },
  { name: 'Trends', emoji: '🔥', href: '/trends', color: '#F44336' },
];

export default function Home() {
  const latestArticles = articles.slice(0, 6);

  return (
    <div style={{ paddingTop: 64 }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 20px',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(233,30,99,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '20%',
          right: '20%',
          width: 350,
          height: 350,
          background: 'radial-gradient(circle, rgba(255,107,157,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700 }}>
          <p style={{
            color: '#E91E63',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '4px',
            marginBottom: 20,
            fontFamily: 'system-ui, sans-serif',
          }}>AI-Powered Fashion</p>
          <h1 style={{
            fontSize: 'clamp(36px, 7vw, 72px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 24,
            letterSpacing: '-1px',
          }}>
            Your Style.<br />
            <span style={{ color: '#E91E63' }}>Your Rules.</span>
          </h1>
          <p style={{
            color: '#666',
            fontSize: 'clamp(16px, 2vw, 20px)',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 520,
            margin: '0 auto 40px',
          }}>
            Expert reviews, trend reports, and outfit inspiration — all curated by editors and powered by AI. Find what works for you.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/blog" style={{
              backgroundColor: '#E91E63',
              color: 'white',
              padding: '16px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(233,30,99,0.3)',
            }}>Read the Blog</a>
            <a href="/quiz" style={{
              border: '2px solid #E91E63',
              color: '#E91E63',
              padding: '16px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
            }}>Take the Style Quiz</a>
          </div>
        </div>
      </section>

      {/* Trending Categories */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Explore</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: 'Georgia, serif' }}>What Are You Looking For?</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}>
          {trendingCategories.map((cat, i) => (
            <a key={i} href={cat.href} style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              border: '1px solid #eee',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all 0.3s',
            }}>
              <span style={{ fontSize: 32 }}>{cat.emoji}</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: cat.color }}>{cat.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Featured Articles */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Latest</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: 'Georgia, serif' }}>Featured Articles</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 24,
        }}>
          {latestArticles.map((article) => (
            <a key={article.slug} href={`/blog/${article.slug}`} style={{
              backgroundColor: 'white',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #eee',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s',
              textDecoration: 'none',
              color: 'inherit',
            }}>
              <div style={{
                width: '100%',
                height: 180,
                backgroundColor: '#F8F8F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  backgroundColor: '#E91E63',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif',
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1,
                }}>{article.category}</span>
                <span style={{ color: '#ccc', fontSize: 24 }}>📰</span>
              </div>
              <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 600 }}>{article.title}</h3>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 14, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>Read More →</span>
                </div>
              </div>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/blog" style={{ color: '#E91E63', fontSize: 14, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
            View All {articles.length} Articles →
          </a>
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#E91E63', fontFamily: 'Georgia, serif' }}>{articles.length}+</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>Expert Articles</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#E91E63', fontFamily: 'Georgia, serif' }}>12K+</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>Newsletter Subscribers</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#E91E63', fontFamily: 'Georgia, serif' }}>500+</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>Products Reviewed</div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ padding: '60px 20px', maxWidth: 600, margin: '0 auto' }}>
        <EmailCapture variant="hero" />
      </section>
    </div>
  );
}
