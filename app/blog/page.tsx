'use client';

import ArticleCard from '@/components/ArticleCard';

const articles = [
  { title: 'What to Wear to a Fall Wedding Under $100', excerpt: 'Budget-friendly wedding guest outfits that look expensive. From midi dresses to tailored separates that won\'t break the bank.', category: 'Occasion', readTime: '6 min', date: 'Aug 2026', href: '#' },
  { title: 'Fall 2026 Fashion Trends: What to Buy & Skip', excerpt: 'The definitive guide to this season\'s biggest trends — which ones are worth investing in and which to pass on.', category: 'Trends', readTime: '8 min', date: 'Aug 2026', href: '#' },
  { title: 'Everlane vs. Reformation: Which Brand Is Worth It?', excerpt: 'We compare two sustainable fashion favorites on quality, price, style, and ethics. The results might surprise you.', category: 'Brand Guide', readTime: '10 min', date: 'Aug 2026', href: '#' },
  { title: 'Capsule Wardrobe Essentials 2026', excerpt: 'The 30 pieces you need to build a wardrobe that works for every occasion. Minimal effort, maximum style.', category: 'Guide', readTime: '12 min', date: 'Aug 2026', href: '#' },
  { title: 'Date Night Outfit Ideas for Every Season', excerpt: 'From casual dinner dates to fancy nights out — outfit inspiration for every romantic occasion and temperature.', category: 'Outfits', readTime: '7 min', date: 'Aug 2026', href: '#' },
  { title: 'Workwear Outfits That Actually Look Good', excerpt: 'Office attire that doesn\'t bore. Professional looks that still feel like you — from creative to corporate.', category: 'Workwear', readTime: '8 min', date: 'Aug 2026', href: '#' },
  { title: 'How to Build a Capsule Wardrobe on a Budget', excerpt: 'You don\'t need a fortune to dress well. Here\'s how to curate a versatile wardrobe for under $500.', category: 'Guide', readTime: '9 min', date: 'Aug 2026', href: '#' },
  { title: 'The Best White Sneakers for Every Budget', excerpt: 'From $30 to $300 — the ultimate guide to finding your perfect pair of white sneakers.', category: 'Shopping', readTime: '6 min', date: 'Aug 2026', href: '#' },
  { title: 'What to Wear to a Job Interview in 2026', excerpt: 'Interview outfit ideas for every industry — tech, finance, creative, and beyond. Make a first impression that lasts.', category: 'Workwear', readTime: '7 min', date: 'Aug 2026', href: '#' },
  { title: 'Wedding Guest Dress Codes Explained', excerpt: 'Black tie optional, cocktail attire, garden party — what to actually wear for every dress code.', category: 'Occasion', readTime: '8 min', date: 'Aug 2026', href: '#' },
  { title: 'The 10 Best Sustainable Clothing Brands 2026', excerpt: 'Brands that prove you can look good and do good. From everyday basics to luxury pieces.', category: 'Brand Guide', readTime: '11 min', date: 'Aug 2026', href: '#' },
  { title: 'How to Style a Leather Jacket 15 Ways', excerpt: 'The most versatile piece in your wardrobe — here\'s how to wear it from brunch to nightlife.', category: 'Styling', readTime: '7 min', date: 'Aug 2026', href: '#' },
  { title: 'Summer to Fall Transition Outfits', excerpt: 'Those tricky in-between weeks when you can\'t decide on shorts or sweaters. Layering looks that solve everything.', category: 'Outfits', readTime: '6 min', date: 'Aug 2026', href: '#' },
  { title: 'The Best ASOS Finds Under $30', excerpt: 'Our editors hand-pick the best budget buys from ASOS this month. Trending pieces that look expensive.', category: 'Shopping', readTime: '5 min', date: 'Aug 2026', href: '#' },
  { title: 'How to Find Your Personal Style (A Complete Guide)', excerpt: 'Not sure if you\'re minimalist or maximalist? Take our quiz and read our guide to discovering your fashion identity.', category: 'Guide', readTime: '15 min', date: 'Aug 2026', href: '#' },
  { title: 'Vacation Outfit Packing List: 2 Weeks in 10 Pieces', excerpt: 'Pack light and look amazing. The ultimate travel capsule wardrobe for warm-weather destinations.', category: 'Travel', readTime: '8 min', date: 'Aug 2026', href: '#' },
  { title: 'Reformation Dresses Worth the Splurge', excerpt: 'We reviewed 20 Reformation dresses to find the ones actually worth the price tag. Ranked by cost-per-wear.', category: 'Shopping', readTime: '9 min', date: 'Aug 2026', href: '#' },
  { title: 'Brunch Outfit Ideas That Go Beyond the Basic Dress', excerpt: 'Fresh ideas for your weekend brunch looks — from coordinated sets to elevated casual.', category: 'Outfits', readTime: '6 min', date: 'Aug 2026', href: '#' },
  { title: 'The Best Jeans for Every Body Type', excerpt: 'Skinny, straight, wide-leg, barrel — finding your perfect denim fit based on your body shape.', category: 'Guide', readTime: '10 min', date: 'Aug 2026', href: '#' },
  { title: 'Color Theory for Your Wardrobe', excerpt: 'Why some colors make you glow and others wash you out. A practical guide to building a palette that works.', category: 'Guide', readTime: '11 min', date: 'Aug 2026', href: '#' },
];

const categories = ['All', 'Guide', 'Trends', 'Outfits', 'Brand Guide', 'Shopping', 'Workwear', 'Occasion', 'Styling', 'Travel'];

export default function BlogPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{
            color: 'var(--accent-gold)',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            marginBottom: 8,
            fontFamily: 'system-ui, sans-serif',
          }}>Style Journal</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>Blog</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Fashion guides, trend reports, brand comparisons, and outfit inspiration.
          </p>
        </div>

        {/* Category Filter */}
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
              backgroundColor: cat === 'All' ? 'var(--accent-gold)' : 'var(--bg-card)',
              color: cat === 'All' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${cat === 'All' ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap' as const,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>{cat}</span>
          ))}
        </div>

        {/* Articles Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {articles.map((article, i) => (
            <ArticleCard key={i} {...article} />
          ))}
        </div>

        {/* SEO Content Block */}
        <div style={{
          marginTop: 60,
          padding: 40,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{ fontSize: 22, fontFamily: 'Georgia, serif', marginBottom: 16 }}>About Fashionistas.ai</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, maxWidth: 700 }}>
            <p style={{ marginBottom: 12 }}>
              Fashionistas.ai is your AI-powered fashion destination. We combine cutting-edge artificial intelligence with expert fashion knowledge to deliver personalized style recommendations, trend forecasts, and curated shopping guides.
            </p>
            <p style={{ marginBottom: 12 }}>
              Whether you&apos;re building a capsule wardrobe, searching for the perfect wedding guest outfit, or comparing sustainable brands, our AI stylist and editorial team have you covered.
            </p>
            <p>
              Our mission is to make great style accessible to everyone — regardless of budget, body type, or fashion experience. With personalized quizzes, AI-generated outfit ideas, and honest brand comparisons, we help you discover and own your unique style.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
