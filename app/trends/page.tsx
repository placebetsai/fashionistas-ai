'use client';

import ProductCard from '@/components/ProductCard';

const trends = [
  {
    season: 'Fall 2026',
    title: 'Gothic Romance',
    description: 'The biggest mood of the season — moody lace, velvet, corsetry, and asymmetric hems. Saint Laurent, McQueen, and Ann Demeulemeester led the charge with dark, poetic silhouettes.',
    pieces: [
      { name: 'Lace Midi Dress', brand: 'Reformation', price: '$278', affiliateUrl: '#', tag: 'Statement' },
      { name: 'Velvet Blazer', brand: 'AllSaints', price: '$329', affiliateUrl: '#', tag: 'Invest' },
      { name: 'Corset Top', brand: 'COS', price: '$89', affiliateUrl: '#', tag: 'Trending' },
      { name: 'Asymmetric Skirt', brand: 'ASOS', price: '$42', affiliateUrl: '#', tag: 'Budget' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Tartan Revival',
    description: 'Plaid and tartan dominated every runway this season. Chloé built an entire collection around checks, while Burberry brought the British heritage angle. The new tartan reads darker — forest green, burgundy, navy.',
    pieces: [
      { name: 'Tartan Midi Skirt', brand: 'Chloé', price: '$1,250', affiliateUrl: '#', tag: 'Runway' },
      { name: 'Check Overshirt', brand: 'Burberry', price: '$890', affiliateUrl: '#', tag: 'Heritage' },
      { name: 'Plaid Wool Trousers', brand: 'COS', price: '$125', affiliateUrl: '#', tag: 'Essential' },
      { name: 'Gingham Blazer', brand: 'Zara', price: '$89', affiliateUrl: '#', tag: 'Budget' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Color Blocking',
    description: 'Bold two-tone combinations are everywhere — purple meets red, chartreuse meets blue, forest green meets pink. At Mugler, Akris, and Valentino, the idea of a color "clash" has been entirely forgotten.',
    pieces: [
      { name: 'Purple Wool Coat', brand: 'Mango', price: '$159', affiliateUrl: '#', tag: 'Statement' },
      { name: 'Two-Tone Knit', brand: '& Other Stories', price: '$79', affiliateUrl: '#', tag: 'Trending' },
      { name: 'Colorblock Dress', brand: 'Zara', price: '$69', affiliateUrl: '#', tag: 'Fun' },
      { name: 'Cobalt Blue Bag', brand: 'DeMellier', price: '$395', affiliateUrl: '#', tag: 'Invest' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Tactile Textures',
    description: 'From shearling coats to faux fur, brocade, and velvet — texture did the heavy lifting this season. Bottega Veneta, Dior, and Louis Vuitton made fashion that begs to be touched.',
    pieces: [
      { name: 'Shearling Coat', brand: 'Bottega Veneta', price: '$4,200', affiliateUrl: '#', tag: 'Luxe' },
      { name: 'Faux Fur Jacket', brand: 'Free People', price: '$298', affiliateUrl: '#', tag: 'Cruelty-Free' },
      { name: 'Brocade Blazer', brand: 'Dior', price: '$3,800', affiliateUrl: '#', tag: 'Runway' },
      { name: 'Velvet Trousers', brand: 'Mango', price: '$59', affiliateUrl: '#', tag: 'Budget' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'The Updated Lady',
    description: 'Power dressing gets softened — sculpted jackets, sloping waists, and rich textures that balance strength with ease. Chanel, Givenchy, and Balenciaga redefined the skirt suit for 2026.',
    pieces: [
      { name: 'Sculpted Blazer', brand: 'Chanel', price: '$5,800', affiliateUrl: '#', tag: 'Iconic' },
      { name: 'Pencil Skirt Suit', brand: 'COS', price: '$199', affiliateUrl: '#', tag: 'Essential' },
      { name: 'Peplum Cardigan', brand: 'Reformation', price: '$148', affiliateUrl: '#', tag: 'Trending' },
      { name: 'Pointed-Toe Pumps', brand: 'Jil Sander', price: '$890', affiliateUrl: '#', tag: 'Finish' },
    ],
  },
  {
    season: 'Fall 2026',
    title: 'Art Deco Evening',
    description: 'The roaring \'20s return with dropped waists, intricate beading, fringe, and velvet. Khaite, Fendi, and Rabanne channeled Gatsby-era opulence for modern eveningwear.',
    pieces: [
      { name: 'Beaded Slip Dress', brand: 'Khaite', price: '$2,400', affiliateUrl: '#', tag: 'Evening' },
      { name: 'Fringe Jacket', brand: 'Rabanne', price: '$1,650', affiliateUrl: '#', tag: 'Statement' },
      { name: 'Drop-Waist Skirt', brand: 'Zara', price: '$49', affiliateUrl: '#', tag: 'Budget' },
      { name: 'Velvet Clutch', brand: 'Chloé', price: '$1,100', affiliateUrl: '#', tag: 'Invest' },
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
            The trends defining this season — from gothic romance to tartan revival, with shoppable picks at every price point.
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
