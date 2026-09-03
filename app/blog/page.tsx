import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import AdUnit from '@/components/AdUnit';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Fashion Tips, Reviews & Style Guides | Fashionistas.ai',
  description: 'Expert fashion advice, product reviews, style guides, and trend reports. Your go-to resource for looking your best.',
  openGraph: {
    title: 'Blog — Fashionistas.ai',
    description: 'Expert fashion advice, product reviews, style guides, and trend reports.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const categories = ['All', 'Shoes', 'Beauty', 'Fashion'];

function getPattern(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('shoe') || c.includes('sneaker')) return 'article-img-shoes';
  if (c.includes('beauty') || c.includes('skin')) return 'article-img-beauty';
  if (c.includes('fashion') || c.includes('outfit') || c.includes('trend')) return 'article-img-fashion';
  if (c.includes('deal') || c.includes('best')) return 'article-img-deals';
  return 'article-img-default';
}

function getIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('shoe') || c.includes('sneaker')) return '👟';
  if (c.includes('beauty') || c.includes('skin')) return '💄';
  if (c.includes('fashion') || c.includes('outfit')) return '👗';
  if (c.includes('deal') || c.includes('best')) return '🏷️';
  return '✨';
}

export default function BlogPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
            Style Journal
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 12 }}>
            Blog
          </h1>
          <p style={{ color: '#666', fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Fashion guides, trend reports, product reviews, and outfit inspiration.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 40,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {categories.map((cat) => (
            <span key={cat} style={{
              backgroundColor: cat === 'All' ? '#E91E63' : 'white',
              color: cat === 'All' ? 'white' : '#666',
              border: `1px solid ${cat === 'All' ? '#E91E63' : '#eee'}`,
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap' as const,
            }}>{cat}</span>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {articles.slice(0, 3).map((article) => (
            <a key={article.slug} href={`/blog/${article.slug}`} className="category-card" style={{
              backgroundColor: 'white',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
            }}>
              <div className={getPattern(article.category)} style={{
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
                  color: '#E91E63',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>{article.category}</span>
                <span className="article-icon">{getIcon(article.category)}</span>
              </div>
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{article.title}</h2>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 14, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.date}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>Read More →</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <AdUnit slot="inContent" />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
          marginTop: 24,
        }}>
          {articles.slice(3).map((article) => (
            <a key={article.slug} href={`/blog/${article.slug}`} className="category-card" style={{
              backgroundColor: 'white',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
            }}>
              <div className={getPattern(article.category)} style={{
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
                  color: '#E91E63',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>{article.category}</span>
                <span className="article-icon">{getIcon(article.category)}</span>
              </div>
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{article.title}</h2>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 14, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.date}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>Read More →</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ marginTop: 60 }}>
          <EmailCapture variant="hero" />
        </div>
      </div>
    </div>
  );
}
