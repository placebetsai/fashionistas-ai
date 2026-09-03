import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us — Fashionistas.ai',
  description: 'Learn about Fashionistas.ai, an AI-powered fashion recommendation platform founded in 2026 to help you find your personal style.',
  openGraph: {
    title: 'About Us — Fashionistas.ai',
    description: 'AI-powered fashion recommendations curated by editors.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 80px' }}>
        <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
          About Us
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2, marginBottom: 32 }}>
          The Story Behind Fashionistas.ai
        </h1>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: '#333', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <p style={{ marginBottom: 20 }}>
            Fashionistas.ai was founded in 2026 with a simple mission: make expert fashion advice accessible to everyone, not just those who can afford a personal stylist. We combine AI-powered recommendations with hands-on editorial testing to bring you honest, practical style guidance.
          </p>

          <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Our Approach</h2>
          <p style={{ marginBottom: 20 }}>
            Every product we recommend has been tested by our editorial team. We do not accept payment for reviews. When you see a recommendation on Fashionistas.ai, it is because our editors genuinely believe in the product. We earn revenue through affiliate links, which means we only succeed when you find something you love.
          </p>

          <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginTop: 32, marginBottom: 16 }}>AI-Powered, Editor-Curated</h2>
          <p style={{ marginBottom: 20 }}>
            Our AI tools help analyze trends, compare products across hundreds of data points, and surface options you might not find on your own. But every recommendation passes through our editorial team before it reaches you. Technology amplifies our expertise; it does not replace our judgment.
          </p>

          <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginTop: 32, marginBottom: 16 }}>What We Cover</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}><strong>Shoes &amp; Sneakers:</strong> Comfort-first reviews for work, casual, and athletic footwear</li>
            <li style={{ marginBottom: 8 }}><strong>Beauty &amp; Skincare:</strong> Product reviews, routines, and ingredient breakdowns</li>
            <li style={{ marginBottom: 8 }}><strong>Fashion &amp; Outfits:</strong> Trend reports, capsule wardrobes, and occasion-based styling</li>
            <li style={{ marginBottom: 8 }}><strong>Deals &amp; Sales:</strong> Curated picks at every price point</li>
          </ul>

          <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Our Commitment to You</h2>
          <p style={{ marginBottom: 20 }}>
            We believe good fashion advice should be free, honest, and useful. No paywalls, no clickbait, no sponsored posts disguised as reviews. Just straightforward guidance to help you feel confident in what you wear.
          </p>

          <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Get in Touch</h2>
          <p>
            Have a question, suggestion, or partnership inquiry? Visit our <a href="/contact" style={{ color: '#E91E63', textDecoration: 'underline' }}>contact page</a> or email us directly at <a href="mailto:israeljoffe@gmail.com" style={{ color: '#E91E63', textDecoration: 'underline' }}>israeljoffe@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
