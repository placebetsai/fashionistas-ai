import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import AdUnit from '@/components/AdUnit';
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
  { name: 'Comfort Shoes', emoji: '👟', href: '/shoes', gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)', accent: '#E91E63' },
  { name: 'Beauty Picks', emoji: '💄', href: '/beauty', gradient: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)', accent: '#9C27B0' },
  { name: 'Outfit Ideas', emoji: '👗', href: '/fashion', gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', accent: '#FF6B9D' },
  { name: 'Best Deals', emoji: '🏷️', href: '/deals', gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', accent: '#FF9800' },
  { name: 'Style Quiz', emoji: '✨', href: '/quiz', gradient: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)', accent: '#00BCD4' },
  { name: 'Trends', emoji: '🔥', href: '/trends', gradient: 'linear-gradient(135deg, #fbe9e7 0%, #ffccbc 100%)', accent: '#F44336' },
];

function getArticlePattern(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('shoe') || c.includes('sneaker') || c.includes('sandal')) return 'article-img-shoes';
  if (c.includes('beauty') || c.includes('skin') || c.includes('makeup')) return 'article-img-beauty';
  if (c.includes('fashion') || c.includes('outfit') || c.includes('trend')) return 'article-img-fashion';
  if (c.includes('deal') || c.includes('sale') || c.includes('best')) return 'article-img-deals';
  return 'article-img-default';
}

function getArticleIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('shoe') || c.includes('sneaker')) return '👟';
  if (c.includes('beauty') || c.includes('skin')) return '💄';
  if (c.includes('fashion') || c.includes('outfit')) return '👗';
  if (c.includes('deal') || c.includes('sale')) return '🏷️';
  if (c.includes('trend')) return '🔥';
  return '✨';
}

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
        background: '#ffffff',
      }}>
        <div className="hero-fashion-pattern" />
        <div className="hero-gradient-overlay" />

        {/* Decorative circles */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(233,30,99,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '5%',
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,157,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700 }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(233,30,99,0.08)',
            borderRadius: 20,
            padding: '6px 16px',
            marginBottom: 24,
          }}>
            <p style={{
              color: '#E91E63',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 700,
              margin: 0,
            }}>AI-Powered Fashion</p>
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 7vw, 72px)',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 24,
            letterSpacing: '-1px',
            color: '#1a1a1a',
          }}>
            Your Style.<br />
            <span style={{ color: '#E91E63' }}>Your Rules.</span>
          </h1>
          <p style={{
            color: '#666',
            fontSize: 'clamp(16px, 2vw, 19px)',
            lineHeight: 1.7,
            maxWidth: 520,
            margin: '0 auto 40px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Expert reviews, trend reports, and outfit inspiration — curated by editors and powered by AI. Find what works for you.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/blog" style={{
              backgroundColor: '#E91E63',
              color: 'white',
              padding: '16px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(233,30,99,0.3)',
              textDecoration: 'none',
            }}>Read the Blog</a>
            <a href="/quiz" style={{
              border: '2px solid #E91E63',
              color: '#E91E63',
              padding: '14px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
              textDecoration: 'none',
            }}>Take the Style Quiz</a>
          </div>
        </div>
      </section>

      <AdUnit slot="hero" />

      {/* Trending Categories */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Explore</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>What Are You Looking For?</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 16,
        }}>
          {trendingCategories.map((cat, i) => (
            <a key={i} href={cat.href} className="category-card" style={{
              borderRadius: 16,
              padding: '28px 16px',
              border: '1px solid rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit',
              background: cat.gradient,
            }}>
              <span style={{
                fontSize: 36,
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>{cat.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: cat.accent, fontFamily: 'Inter, system-ui, sans-serif' }}>{cat.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Featured Articles */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Latest</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>Featured Articles</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {latestArticles.map((article) => (
            <a key={article.slug} href={`/blog/${article.slug}`} style={{
              backgroundColor: 'white',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              textDecoration: 'none',
              color: 'inherit',
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(233,30,99,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className={getArticlePattern(article.category)} style={{
                width: '100%',
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#E91E63',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>{article.category}</span>
                <span className="article-icon">{getArticleIcon(article.category)}</span>
              </div>
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{
                  fontSize: 17,
                  lineHeight: 1.4,
                  marginBottom: 8,
                  fontWeight: 700,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>{article.title}</h3>
                <p style={{
                  color: '#666',
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginBottom: 14,
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>Read More →</span>
                </div>
              </div>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/blog" style={{
            color: '#E91E63',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'Inter, system-ui, sans-serif',
            textDecoration: 'none',
            letterSpacing: '0.5px',
          }}>
            View All {articles.length} Articles →
          </a>
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          <div>
            <div className="stat-number" style={{ fontSize: 40, fontWeight: 800, color: '#E91E63', fontFamily: "'Playfair Display', Georgia, serif" }}>{articles.length}+</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>Expert Articles</div>
          </div>
          <div>
            <div className="stat-number" style={{ fontSize: 40, fontWeight: 800, color: '#E91E63', fontFamily: "'Playfair Display', Georgia, serif" }}>Growing</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>Reader Community</div>
          </div>
          <div>
            <div className="stat-number" style={{ fontSize: 40, fontWeight: 800, color: '#E91E63', fontFamily: "'Playfair Display', Georgia, serif" }}>New</div>
            <div style={{ color: '#666', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>Products Tested</div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="newsletter-pattern" style={{ padding: '60px 20px', maxWidth: 600, margin: '0 auto' }}>
        <EmailCapture variant="hero" />
      </section>
    </div>
  );
}
