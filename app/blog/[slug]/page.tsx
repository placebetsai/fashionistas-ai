import { articles } from '@/lib/articles-data';
import { notFound } from 'next/navigation';
import BlogPost from '@/components/BlogPost';
import AdUnit from '@/components/AdUnit';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = articles.find((a) => a.slug === params.slug);
  if (!article) return {};
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      type: 'article',
      siteName: 'Fashionistas.ai',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
    },
    robots: { index: true, follow: true },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const article = articles.find((a) => a.slug === params.slug);
  if (!article) notFound();

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh', padding: '100px 20px 80px' }}>
      <AdUnit slot="inContent" />
      <BlogPost article={article} />
    </div>
  );
}
