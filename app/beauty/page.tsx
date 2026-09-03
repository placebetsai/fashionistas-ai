import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Beauty | Fashionistas.ai',
    description: 'Skincare routines, makeup picks, hair care, and beauty tools reviewed by experts.',
    robots: { index: true, follow: true },
  };
}

export default function CategoryPage() {
  const filtered = articles.filter((a) => a.category === 'Beauty');

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
            Category
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 12 }}>
            Beauty
          </h1>
          <p style={{ color: '#666', fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Skincare routines, makeup picks, hair care, and beauty tools reviewed by experts.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {filtered.map((article) => (
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
              <div className="article-img-beauty" style={{
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
                  color: '#9C27B0',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'uppercase',
                }}>{article.subcategory}</span>
                <span className="article-icon">💄</span>
              </div>
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{article.title}</h2>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>Read →</span>
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
