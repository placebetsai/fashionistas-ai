'use client';

const comparisons = [
  {
    brandA: 'Everlane',
    brandB: 'Reformation',
    category: 'Sustainable Fashion',
    summary: 'Two leaders in ethical fashion — one focused on transparency, the other on vintage-inspired femininity.',
    table: [
      { aspect: 'Price Range', a: '$28 — $250', b: '$48 — $400' },
      { aspect: 'Style', a: 'Minimalist basics', b: 'Feminine & romantic' },
      { aspect: 'Sustainability', a: 'Radical transparency', b: 'Carbon-neutral production' },
      { aspect: 'Quality', a: 'Premium basics', b: 'High-end fabrics' },
      { aspect: 'Best For', a: 'Wardrobe staples', b: 'Statement pieces' },
      { aspect: 'Sizing', a: 'XXS — XXL', b: '00 — 12' },
    ],
    verdict: 'Choose Everlane for everyday basics and transparency. Choose Reformation for special occasion pieces and romantic styles.',
  },
  {
    brandA: 'Allbirds',
    brandB: 'Nike',
    category: 'Sneakers & Activewear',
    summary: 'Comfort-first sustainability meets athletic performance and streetwear culture.',
    table: [
      { aspect: 'Price Range', a: '$98 — $160', b: '$60 — $250+' },
      { aspect: 'Style', a: 'Minimal, earthy', b: 'Bold, athletic' },
      { aspect: 'Sustainability', a: 'Carbon-neutral', b: 'Move to Zero initiative' },
      { aspect: 'Comfort', a: 'Cloud-like (wool)', b: 'React/Air cushioning' },
      { aspect: 'Best For', a: 'Everyday wear', b: 'Performance & style' },
      { aspect: 'Variety', a: 'Limited palette', b: 'Unlimited colorways' },
    ],
    verdict: 'Allbirds for all-day comfort and eco-cred. Nike for performance, variety, and streetwear cred.',
  },
  {
    brandA: 'ASOS',
    brandB: 'Zara',
    category: 'Fast Fashion',
    summary: 'Two fast-fashion giants — one online-first, the other a global retail empire.',
    table: [
      { aspect: 'Price Range', a: '$8 — $100', b: '$15 — $200' },
      { aspect: 'Style', a: 'Trend-forward, inclusive', b: 'Runway-inspired' },
      { aspect: 'Sizing', a: 'XXS — 4XL+', b: 'XS — XL' },
      { aspect: 'Quality', a: 'Hit or miss', b: 'Moderate' },
      { aspect: 'Best For', a: 'Budget trends', b: 'Elevated basics' },
      { aspect: 'Shipping', a: 'Free over $40', b: 'Free over $50' },
    ],
    verdict: 'ASOS for trend experimentation on a budget. Zara for slightly more polished fast-fashion finds.',
  },
  {
    brandA: 'COS',
    brandB: 'Arket',
    category: 'Scandinavian Minimalism',
    summary: 'H&M Group sisters — one architectural and refined, the other grounded and functional.',
    table: [
      { aspect: 'Price Range', a: '$39 — $350', b: '$29 — $250' },
      { aspect: 'Style', a: 'Architectural minimal', b: 'Scandi functionality' },
      { aspect: 'Quality', a: 'High for the price', b: 'Reliable staples' },
      { aspect: 'Aesthetic', a: 'Avant-garde basics', b: 'Everyday essentials' },
      { aspect: 'Best For', a: 'Statement minimalism', b: 'Quality basics' },
      { aspect: 'Stores', a: 'Global', b: 'Limited' },
    ],
    verdict: 'COS for architectural pieces that make a statement. Arket for everyday quality essentials.',
  },
];

export default function BrandsPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <p style={{
            color: 'var(--accent-gold)',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            marginBottom: 8,
            fontFamily: 'system-ui, sans-serif',
          }}>Expert Takes</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>Brand Comparisons</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Honest side-by-side breakdowns to help you spend smarter.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {comparisons.map((comp, i) => (
            <div key={i} style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 16,
              padding: 'clamp(24px, 4vw, 36px)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  color: 'var(--accent-blush)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: 8,
                  fontFamily: 'system-ui, sans-serif',
                }}>{comp.category}</p>
                <h2 style={{ fontSize: 24, fontFamily: 'Georgia, serif', marginBottom: 8 }}>
                  {comp.brandA} vs. {comp.brandB}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{comp.summary}</p>
              </div>

              {/* Comparison Table */}
              <div style={{ marginBottom: 24, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px' }}></th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 600 }}>{comp.brandA}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--accent-blush)', color: 'var(--accent-blush)', fontWeight: 600 }}>{comp.brandB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.table.map((row, j) => (
                      <tr key={j} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.aspect}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{row.a}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Verdict */}
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 10,
                padding: 16,
                borderLeft: '3px solid var(--accent-gold)',
              }}>
                <p style={{ color: 'var(--accent-gold)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>Our Verdict</p>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{comp.verdict}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
