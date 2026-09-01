import { Article } from '@/lib/articles-data';
import EmailCapture from './EmailCapture';

export default function BlogPost({ article }: { article: Article }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    author: { '@type': 'Organization', name: article.author },
    datePublished: article.date,
    publisher: { '@type': 'Organization', name: 'Fashionistas.ai' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article style={{ maxWidth: 780, margin: '0 auto' }}>
        <header style={{ marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>
            {article.category}
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: 'Georgia, serif', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            {article.title}
          </h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#666', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
            <span>{article.author}</span>
            <span>·</span>
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime} read</span>
          </div>
        </header>

        {article.quickPicks && article.quickPicks.length > 0 && (
          <div style={{
            backgroundColor: '#FFF0F5',
            border: '1px solid #E91E63',
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#E91E63', fontFamily: 'system-ui, sans-serif' }}>
              Quick Picks
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {article.quickPicks.map((pick, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <a href={pick.affiliateUrl} rel="nofollow sponsored" style={{ color: '#333', fontSize: 14, textDecoration: 'underline' }}>
                    {pick.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: '#333',
          }}
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <div style={{ marginTop: 40, padding: '24px 0', borderTop: '1px solid #eee' }}>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
            <strong>Affiliate Disclosure:</strong> Fashionistas.ai is reader-supported. When you buy through links on our site, we may earn an affiliate commission at no extra cost to you.
          </p>
        </div>

        <EmailCapture />
      </article>
    </>
  );
}
