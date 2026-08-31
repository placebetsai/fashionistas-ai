'use client';

import ProductCard from '@/components/ProductCard';

const trends = [
  {
    season: 'Fall 2026',
    title: 'Quiet Luxury',
    description: 'The "stealth wealth" trend continues with elevated basics, tonal dressing, and logo-free elegance.',
    pieces: [
      { name: 'Cashmere Crewneck', brand: 'Everlane', price: '$100', affiliateUrl: '#', tag: 'Essential' },
      { name: 'Tailored Wool Trousers', brand: 'COS', price: '$135', affiliateUrl: '#', tag: 'Must-Have' },
      { name: 'Leather Tote Bag', brand: 'Reformation', price: '$278', affiliateUrl: '#', tag: 'Invest' },
      { name: 'Cashmere Scarf', brand: 'Arket', price: '$69', affiliateUrl: '#', tag: 'Add On' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Cherry Red',
    description: 'Bold cherry red is the color of the season — from accessories to head-to-toe monochrome looks.',
    pieces: [
      { name: 'Red Wool Coat', brand: 'Zara', price: '$129', affiliateUrl: '#', tag: 'Statement' },
      { name: 'Cherry Leather Bag', brand: 'ASOS', price: '$48', affiliateUrl: '#', tag: 'Trending' },
      { name: 'Red Lipstick Dress', brand: 'Reformation', price: '$198', affiliateUrl: '#', tag: 'Splurge' },
      { name: 'Ruby Pointed Flats', brand: 'ASOS', price: '$34', affiliateUrl: '#', tag: 'Budget' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Boho Revival',
    description: '70s-inspired bohemian pieces come back with modern proportions and luxe fabrics.',
    pieces: [
      { name: 'Suede Fringe Jacket', brand: 'Free People', price: '$298', affiliateUrl: '#', tag: 'Iconic' },
      { name: 'Embroidered Maxi', brand: 'Anthropologie', price: '$168', affiliateUrl: '#', tag: 'Romance' },
      { name: 'Woven Leather Belt', brand: 'Free People', price: '$58', affiliateUrl: '#', tag: 'Accent' },
      { name: 'Suede Ankle Boots', brand: 'Free People', price: '$248', affiliateUrl: '#', tag: 'Staple' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Prep School',
    description: 'Varsity-inspired layers, pleated skirts, and collegiate knuckles get a sophisticated update.',
    pieces: [
      { name: 'Cable Knit Vest', brand: 'COS', price: '$89', affiliateUrl: '#', tag: 'Layer' },
      { name: 'Pleated Midi Skirt', brand: 'ASOS', price: '$38', affiliateUrl: '#', tag: 'Classic' },
      { name: 'Oxford Shirt', brand: 'Everlane', price: '$58', affiliateUrl: '#', tag: 'Essential' },
      { name: 'Loafers', brand: 'Reformation', price: '$168', affiliateUrl: '#', tag: 'Finish' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Metallics',
    description: 'Liquid silver, gold lamé, and chrome accessories bring futuristic glamour to everyday wear.',
    pieces: [
      { name: 'Silver Mini Bag', brand: 'Zara', price: '$39', affiliateUrl: '#', tag: 'Fun' },
      { name: 'Metallic Pleated Skirt', brand: 'ASOS', price: '$42', affiliateUrl: '#', tag: 'Party' },
      { name: 'Chrome Chain Necklace', brand: 'Zara', price: '$22', affiliateUrl: '#', tag: 'Accent' },
      { name: 'Gold Loafers', brand: 'COS', price: '$145', affiliateUrl: '#', tag: 'Statement' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Leather Everything',
    description: 'From butter-soft blazers to wide-leg trousers — leather is having its biggest moment yet.',
    pieces: [
      { name: 'Leather Blazer', brand: 'AllSaints', price: '$349', affiliateUrl: '#', tag: 'Invest' },
      { name: 'Leather Trousers', brand: 'ASOS', price: '$58', affiliateUrl: '#', tag: 'Budget' },
      { name: 'Leather Skirt', brand: 'Reformation', price: '$178', affiliateUrl: '#', tag: 'Feminine' },
      { name: 'Leather Crossbody', brand: 'Everlane', price: '$128', affiliateUrl: '#', tag: 'Daily' },
    ],
  },
];

export default function TrendsPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <p style={{
            color: 'var(--accent-gold)',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            marginBottom: 8,
            fontFamily: 'system-ui, sans-serif',
          }}>Fall 2026</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>Fashion Trends</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            The trends defining this season — with shoppable picks at every price point.
          </p>
        </div>

        {trends.map((trend, i) => (
          <div key={i} style={{ marginBottom: 60 }}>
            <div style={{ marginBottom: 24 }}>
              <p style={{
                color: 'var(--accent-blush)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: 6,
                fontFamily: 'system-ui, sans-serif',
              }}>{trend.season}</p>
              <h2 style={{
                fontSize: 'clamp(22px, 3.5vw, 32px)',
                fontFamily: 'Georgia, serif',
                fontWeight: 600,
                marginBottom: 8,
              }}>{trend.title}</h2>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: 14,
                maxWidth: 600,
                lineHeight: 1.6,
              }}>{trend.description}</p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {trend.pieces.map((piece, j) => (
                <ProductCard key={j} {...piece} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
