'use client';

const fashionNews = [
  { text: "Fall 2026 Trend Alert: Burgundy is the new black this season", tag: "TRENDING" },
  { text: "Nike Air Max DN2 drops September 12 — early reviews are in", tag: "SNEAKERS" },
  { text: "Zara's leather lookalikes are going viral on TikTok", tag: "DEALS" },
  { text: "Gucci's SS27 show featured oversized blazers and kitten heels", tag: "RUNWAY" },
  { text: "Birkenstock x Manolo Blahnik collab sells out in 47 minutes", tag: "COLLAB" },
  { text: "Dermatologists weigh in: retinol vs. bakuchiol in 2026", tag: "BEAUTY" },
  { text: "The quiet luxury movement is dead — maximalism is back", tag: "TRENDING" },
  { text: "Best fall boots under $200: our editors' top 10 picks", tag: "SHOPPING" },
  { text: "Sustainable denim brands that actually look good", tag: "SUSTAINABLE" },
  { text: "Celeb street style roundup: what they wore this week", tag: "STYLE" },
];

export default function FashionTicker() {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'relative',
      height: 40,
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'inline-flex',
        animation: 'tickerScroll 60s linear infinite',
        willChange: 'transform',
      }}>
        {[...fashionNews, ...fashionNews].map((item, i) => (
          <span key={i} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginRight: 48,
            fontSize: 13,
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#fff',
          }}>
            <span style={{
              backgroundColor: '#E91E63',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}>{item.tag}</span>
            {item.text}
            <span style={{ color: '#555', margin: '0 8px' }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
