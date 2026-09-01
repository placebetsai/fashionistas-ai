import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import type { Metadata } from 'next';

const categoryMap: Record<string, { title: string; description: string; filter: (a: any) => boolean }> = {
  shoes: {
    title: 'Shoes',
    description: 'Comfort, style, and performance — the best shoes for every occasion and need.',
    filter: (a: any) => a.category === 'Shoes',
  },
  beauty: {
    title: 'Beauty',
    description: 'Skincare routines, makeup picks, hair care, and beauty tools reviewed by experts.',
    filter: (a: any) => a.category === 'Beauty',
  },
  fashion: {
    title: 'Fashion',
    description: 'Outfit ideas, style guides, trend reports, and wardrobe building advice.',
    filter: (a: any) => a.category === 'Fashion',
  },
  deals: {
    title: 'Deals & Sales',
    description: 'The best fashion and beauty deals, updated regularly.',
    filter: (a: any) => a.subcategory === 'Deals' || a.subcategory === 'Shopping',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const cat = categoryMap['beauty'];
  return {
    title: cat ? cat.title + ' | Fashionistas.ai' : 'Fashionistas.ai',
    description: cat?.description || '',
    robots: { index: true, follow: true },
  };
}

export default function CategoryPage() {
  const cat = categoryMap['beauty'];
  if (!cat) return null;
  const filtered = articles.filter(cat.filter);

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>
            Category
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 12 }}>
            {cat.title}
          </h1>
          <p style={{ color: '#666', fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            {cat.description}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 24,
        }}>
          {filtered.map((article) => (
            <a
              key={article.slug}
              href={`/blog/${article.slug}`}
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #eee',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
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
                }}>{article.subcategory}</span>
                <span style={{ color: '#ccc', fontSize: 24 }}>📰</span>
              </div>
              <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 17, lineHeight: 1.4, marginBottom: 8, fontWeight: 600 }}>{article.title}</h2>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <span style={{ color: '#999', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{article.readTime}</span>
                  <span style={{ color: '#E91E63', fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>Read →</span>
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
