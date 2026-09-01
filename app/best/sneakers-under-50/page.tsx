import { articles } from '@/lib/articles-data';
import EmailCapture from '@/components/EmailCapture';
import type { Metadata } from 'next';

const bestOfData: Record<string, { title: string; description: string; articleSlug: string }> = {
  'comfortable-work-shoes': { title: 'Best Comfortable Work Shoes for Women 2026', description: 'Our editors tested 30+ work shoes to find the ones that actually keep your feet happy from 9 to 5.', articleSlug: 'best-comfortable-work-shoes-for-women' },
  'sneakers-under-50': { title: 'Best Sneakers Under $50 in 2026', description: 'Affordable sneakers that deliver style and comfort without breaking the bank.', articleSlug: 'best-affordable-sneakers-under-50' },
  'best-shapewear': { title: 'Best Shapewear for Tummy Control 2026', description: 'Smooth, flatten, and sculpt with these comfortable shapewear picks.', articleSlug: 'best-shapewear-for-tummy-control' },
  'summer-sandals': { title: 'Best Summer Sandals Under $100 2026', description: 'From poolside slides to dressy strappy heels for every summer occasion.', articleSlug: 'best-summer-sandals-under-100' },
  'tiktok-beauty-picks': { title: 'Best TikTok Viral Beauty Products 2026', description: 'Tested and approved: the viral beauty products that actually deliver.', articleSlug: 'best-tiktok-viral-beauty-products' },
};

export async function generateStaticParams() {
  return ["comfortable-work-shoes", "sneakers-under-50", "best-shapewear", "summer-sandals", "tiktok-beauty-picks"].map((s: string) => ({ slug: s }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = bestOfData[params.slug];
  if (!data) return {};
  return {
    title: data.title + ' | Fashionistas.ai',
    description: data.description,
    robots: { index: true, follow: true },
  };
}

export default function BestOfPage({ params }: { params: { slug: string } }) {
  const data = bestOfData[params.slug];
  const article = articles.find((a) => a.slug === data?.articleSlug);
  if (!data || !article) return null;

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh', padding: '100px 20px 80px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ backgroundColor: '#E91E63', color: 'white', padding: '12px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'system-ui, sans-serif', display: 'inline-block', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
          Our Top Picks
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: 'Georgia, serif', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
          {data.title}
        </h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
          {data.description}
        </p>

        <div style={{ backgroundColor: '#FFF0F5', border: '1px solid #E91E63', borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#E91E63' }}>Quick Picks</h2>
          {article.quickPicks?.map((pick, i) => (
            <div key={i} style={{ padding: '12px 16px', backgroundColor: 'white', borderRadius: 8, marginBottom: 8, border: '1px solid #F8BBD0' }}>
              <a href={pick.affiliateUrl} rel="nofollow sponsored" style={{ color: '#333', fontWeight: 600, textDecoration: 'none' }}>
                {pick.label}
              </a>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: '#333' }} className="blog-content" dangerouslySetInnerHTML={{ __html: article.content }} />

        <div style={{ marginTop: 40, padding: '24px 0', borderTop: '1px solid #eee' }}>
          <p style={{ color: '#999', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
            <strong>Affiliate Disclosure:</strong> Fashionistas.ai is reader-supported. When you buy through links on our site, we may earn an affiliate commission at no extra cost to you.
          </p>
        </div>

        <EmailCapture />

        <div style={{ marginTop: 40 }}>
          <a href="/blog" style={{ color: '#E91E63', fontSize: 14, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
            ← Back to All Articles
          </a>
        </div>
      </div>
    </div>
  );
}
