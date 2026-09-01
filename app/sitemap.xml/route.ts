import { articles } from '@/lib/articles-data';

const BASE_URL = 'https://fashionistas.ai';

export async function GET() {
  const staticPages = [
    '', '/blog', '/shoes', '/beauty', '/fashion', '/deals',
    '/quiz', '/ai-stylist', '/trends', '/outfit-ideas', '/brands',
    '/best/comfortable-work-shoes', '/best/sneakers-under-50',
    '/best/best-shapewear', '/best/summer-sandals', '/best/tiktok-beauty-picks',
  ];

  const blogPages = articles.map((a) => `/blog/${a.slug}`);

  const allPages = [...staticPages, ...blogPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((page) => `  <url>
    <loc>${BASE_URL}${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : page.startsWith('/blog') ? '0.8' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
