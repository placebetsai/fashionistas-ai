'use client';

import { useState, useEffect } from 'react';

interface Question {
  id: number;
  question: string;
  options: { label: string; image?: string; value: string }[];
}

interface StyleResult {
  type: string;
  title: string;
  description: string;
  keyPieces: string[];
  colorPalette: string[];
  brands: string[];
  recommendations: { name: string; brand: string; price: string; affiliateUrl: string }[];
}

const questions: Question[] = [
  {
    id: 1,
    question: "When you open your closet, what do you reach for first?",
    options: [
      { label: "A crisp white shirt or tailored blazer", value: "classic" },
      { label: "A flowy dress or embroidered top", value: "bohemian" },
      { label: "A perfectly fitted tee and clean jeans", value: "minimalist" },
      { label: "An oversized hoodie or graphic tee", value: "streetwear" },
      { label: "Something with lace, ruffles, or soft textures", value: "romantic" },
      { label: "Black everything, leather, studs", value: "edgy" },
    ],
  },
  {
    id: 2,
    question: "What's your ideal weekend look?",
    options: [
      { label: "Chinos, loafers, and a nice sweater", value: "classic" },
      { label: "Maxi skirt, sandals, layered necklaces", value: "bohemian" },
      { label: "Cashmere sweater, slim trousers, white sneakers", value: "minimalist" },
      { label: "Cargo pants, sneakers, crop top or oversized tee", value: "streetwear" },
      { label: "Floral midi dress with ballet flats", value: "romantic" },
      { label: "Mini skirt, combat boots, band tee", value: "edgy" },
    ],
  },
  {
    id: 3,
    question: "Pick a color palette you're drawn to:",
    options: [
      { label: "Navy, camel, white, burgundy", value: "classic" },
      { label: "Terracotta, mustard, olive, cream", value: "bohemian" },
      { label: "Black, white, grey, beige", value: "minimalist" },
      { label: "Neons, bold primaries, camo", value: "streetwear" },
      { label: "Blush, lavender, sage, soft pink", value: "romantic" },
      { label: "Black, deep red, charcoal, metallic", value: "edgy" },
    ],
  },
  {
    id: 4,
    question: "Your dream vacation wardrobe includes:",
    options: [
      { label: "Linen sets, straw hat, elegant sandals", value: "classic" },
      { label: "Crochet pieces, layered jewelry, earth tones", value: "bohemian" },
      { label: "Neutral swimwear, coverup, minimalist accessories", value: "minimalist" },
      { label: "Bold prints, bucket hats, sporty slides", value: "streetwear" },
      { label: "Flowy sundresses, romantic blouses, delicate jewelry", value: "romantic" },
      { label: "Mesh tops, chain accessories, platform sandals", value: "edgy" },
    ],
  },
  {
    id: 5,
    question: "Which accessory do you never leave home without?",
    options: [
      { label: "A structured leather bag", value: "classic" },
      { label: "Stacked rings and bracelets", value: "bohemian" },
      { label: "A quality watch", value: "minimalist" },
      { label: "A crossbody or chain bag", value: "streetwear" },
      { label: "Delicate layered necklaces", value: "romantic" },
      { label: "Statement earrings or chains", value: "edgy" },
    ],
  },
  {
    id: 6,
    question: "How do you want your outfit to make people feel?",
    options: [
      { label: "Put-together and confident", value: "classic" },
      { label: "Free-spirited and creative", value: "bohemian" },
      { label: "Cool without trying", value: "minimalist" },
      { label: "Bold and trend-forward", value: "streetwear" },
      { label: "Soft and approachable", value: "romantic" },
      { label: "Unapologetically fierce", value: "edgy" },
    ],
  },
  {
    id: 7,
    question: "Pick a fashion decade you wish you lived in:",
    options: [
      { label: "1950s — Grace Kelly elegance", value: "classic" },
      { label: "1970s — Studio 54 freedom", value: "bohemian" },
      { label: "1990s — Minimalist chic", value: "minimalist" },
      { label: "2000s — Logos and streetwear", value: "streetwear" },
      { label: "1960s — Romantic femininity", value: "romantic" },
      { label: "1980s — Power dressing and punk", value: "edgy" },
    ],
  },
  {
    id: 8,
    question: "You're heading to a party. What are you wearing?",
    options: [
      { label: "A tailored jumpsuit or cocktail dress", value: "classic" },
      { label: "A printed maxi or vintage-inspired piece", value: "bohemian" },
      { label: "A sleek black dress, minimal jewelry", value: "minimalist" },
      { label: "Head-to-toe designer streetwear", value: "streetwear" },
      { label: "A tulle skirt or lace-trimmed ensemble", value: "romantic" },
      { label: "Leather pants and a sheer top", value: "edgy" },
    ],
  },
  {
    id: 9,
    question: "Which fabric do you prefer?",
    options: [
      { label: "Wool, cashmere, structured cotton", value: "classic" },
      { label: "Linen, suede, crochet, cotton gauze", value: "bohemian" },
      { label: "Silk, fine cotton, premium basics", value: "minimalist" },
      { label: "Nylon, technical fabrics, denim", value: "streetwear" },
      { label: "Chiffon, tulle, silk, velvet", value: "romantic" },
      { label: "Leather, PVC, mesh, lace", value: "edgy" },
    ],
  },
  {
    id: 10,
    question: "Last one — pick a celebrity style icon:",
    options: [
      { label: "Amal Clooney or David Beckham", value: "classic" },
      { label: "Florence Welch or Sienna Miller", value: "bohemian" },
      { label: "Hailey Bieber or Cate Blanchett", value: "minimalist" },
      { label: "Rihanna or Tyler the Creator", value: "streetwear" },
      { label: "Zendaya or Lily Collins", value: "romantic" },
      { label: "Dua Lipa or Harry Styles", value: "edgy" },
    ],
  },
];

const styleResults: Record<string, StyleResult> = {
  classic: {
    type: 'classic',
    title: 'The Timeless Sophisticate',
    description: 'You gravitate toward refined, investment-worthy pieces that never go out of style. Your wardrobe is built on clean lines, quality fabrics, and effortless polish. Think Parisian chic meets modern power dressing.',
    keyPieces: ['Tailored blazer', 'Crisp white shirt', 'Straight-leg trousers', 'Leather loafers', 'Structured tote', 'Cashmere knit'],
    colorPalette: ['Navy', 'Camel', 'Burgundy', 'Ivory', 'Charcoal'],
    brands: ['Everlane', 'Reformation', 'COS', 'Arket', '& Other Stories'],
    recommendations: [
      { name: 'The Reformation Crop Top', brand: 'Reformation', price: '$48', affiliateUrl: 'https://shop.shareasale.com/r.cfm?b=463060' },
      { name: 'Cashmere Crew Sweater', brand: 'Everlane', price: '$100', affiliateUrl: 'https://www.everlane.com' },
      { name: 'The Way-High Drape Pant', brand: 'Everlane', price: '$98', affiliateUrl: 'https://www.everlane.com' },
      { name: 'COS Tailored Wool Blazer', brand: 'COS', price: '$175', affiliateUrl: 'https://www.cos.com' },
    ],
  },
  bohemian: {
    type: 'bohemian',
    title: 'The Free Spirit',
    description: 'Your style is an eclectic mix of vintage finds, artisan textures, and globally inspired pieces. You love earthy tones, flowing silhouettes, and accessories that tell a story.',
    keyPieces: ['Flowy maxi dress', 'Embroidered blouse', 'Suede ankle boots', 'Layered jewelry', 'Woven bag', 'Wide-brim hat'],
    colorPalette: ['Terracotta', 'Mustard', 'Olive', 'Cream', 'Rust'],
    brands: ['Free People', 'Anthropologie', 'Spell', 'Sézane', 'Doen'],
    recommendations: [
      { name: 'Embroidered Mini Dress', brand: 'Free People', price: '$128', affiliateUrl: 'https://shop.shareasale.com/r.cfm?b=508849' },
      { name: 'Suede Clog Boots', brand: 'Free People', price: '$248', affiliateUrl: 'https://shop.shareasale.com/r.cfm?b=508849' },
      { name: 'Oversized Linen Shirt', brand: 'Sézane', price: '$120', affiliateUrl: 'https://www.sezane.com' },
      { name: 'Woven Leather Belt', brand: 'Anthropologie', price: '$48', affiliateUrl: 'https://www.anthropologie.com' },
    ],
  },
  minimalist: {
    type: 'minimalist',
    title: 'The Modern Minimalist',
    description: 'Less is more — and you prove it every day. Your wardrobe is edited, intentional, and effortlessly cool. You invest in quality basics and let the fit do the talking.',
    keyPieces: ['Perfect white tee', 'Slim black trousers', 'Cashmere knit', 'White sneakers', 'Structured bag', 'Quality denim'],
    colorPalette: ['Black', 'White', 'Grey', 'Beige', 'Nude'],
    brands: ['COS', 'Arket', 'Everlane', 'Theory', 'Uniqlo U'],
    recommendations: [
      { name: 'Supima Crew Tee', brand: 'Everlane', price: '$30', affiliateUrl: 'https://www.everlane.com' },
      { name: 'Slim cropped pants', brand: 'COS', price: '$89', affiliateUrl: 'https://www.cos.com' },
      { name: 'Minimal Leather Sneakers', brand: 'Veja', price: '$120', affiliateUrl: 'https://www.veja-store.com' },
      { name: 'Structured Wool Coat', brand: 'COS', price: '$250', affiliateUrl: 'https://www.cos.com' },
    ],
  },
  streetwear: {
    type: 'streetwear',
    title: 'The Trendsetter',
    description: 'You live for hype drops, bold logos, and streetwear culture. Your style is urban, athletic, and unapologetically bold. You mix high and low with effortless confidence.',
    keyPieces: ['Oversized hoodie', 'Graphic tee', 'Cargo pants', 'Chunky sneakers', 'Crossbody bag', 'Baseball cap'],
    colorPalette: ['Black', 'White', 'Neon', 'Bold primary', 'Camo'],
    brands: ['Nike', 'ASOS', 'Zara', 'Palace', 'Kith'],
    recommendations: [
      { name: 'Nike Dunk Low Retro', brand: 'Nike', price: '$115', affiliateUrl: 'https://www.nike.com' },
      { name: 'Oversized Graphic Tee', brand: 'ASOS', price: '$28', affiliateUrl: 'https://www.asos.com' },
      { name: 'Utility Cargo Pants', brand: 'ASOS', price: '$45', affiliateUrl: 'https://www.asos.com' },
      { name: 'Crossbody Bag', brand: 'Zara', price: '$39', affiliateUrl: 'https://www.zara.com' },
    ],
  },
  romantic: {
    type: 'romantic',
    title: 'The Romantic Dreamer',
    description: 'Soft, feminine, and ethereal — your wardrobe is a garden of delicate textures, pastel hues, and dreamy silhouettes. You dress for the main character energy you radiate.',
    keyPieces: ['Floral midi dress', 'Lace blouse', 'Tulle skirt', 'Ballet flats', 'Pearl accessories', 'Silk camisole'],
    colorPalette: ['Blush', 'Lavender', 'Sage', 'Soft Pink', 'Cream'],
    brands: ['Reformation', 'Doen', 'LoveShackFancy', 'ASOS', 'Free People'],
    recommendations: [
      { name: 'Linen Midi Dress', brand: 'Reformation', price: '$178', affiliateUrl: 'https://shop.shareasale.com/r.cfm?b=463060' },
      { name: 'Satin Lace-Trim Cami', brand: 'ASOS', price: '$24', affiliateUrl: 'https://www.asos.com' },
      { name: 'Ballet Flats', brand: 'Reformation', price: '$148', affiliateUrl: 'https://shop.shareasale.com/r.cfm?b=463060' },
      { name: 'Puff Sleeve Blouse', brand: 'Doen', price: '$168', affiliateUrl: 'https://www.shopdoen.com' },
    ],
  },
  edgy: {
    type: 'edgy',
    title: 'The Bold Rebel',
    description: 'You push boundaries and break rules. Your style is dark, daring, and full of attitude. Leather, studs, and statement pieces are your love language.',
    keyPieces: ['Leather jacket', 'Mini skirt', 'Combat boots', 'Chain jewelry', 'Mesh top', 'Band tee'],
    colorPalette: ['Black', 'Deep Red', 'Charcoal', 'Metallic', 'Plum'],
    brands: ['AllSaints', 'ASOS', 'Zara', 'Free People', 'Dr. Martens'],
    recommendations: [
      { name: 'Leather Moto Jacket', brand: 'AllSaints', price: '$349', affiliateUrl: 'https://www.allsaints.com' },
      { name: 'Moto Combat Boots', brand: 'Dr. Martens', price: '$170', affiliateUrl: 'https://www.drmartens.com' },
      { name: 'Moto Mini Skirt', brand: 'ASOS', price: '$32', affiliateUrl: 'https://www.asos.com' },
      { name: 'Chunky Chain Necklace', brand: 'Zara', price: '$25', affiliateUrl: 'https://www.zara.com' },
    ],
  },
};

export default function QuizEngine() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<StyleResult | null>(null);

  const progress = ((currentQuestion) / questions.length) * 100;

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowEmail(true);
    }
  };

  const calculateResult = (answerList: string[]) => {
    const counts: Record<string, number> = {};
    answerList.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return styleResults[top];
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, styleType: calculateResult(answers)?.type }),
        });
      } catch (err) {
        // Silently fail for now
      }
    }
    setResult(calculateResult(answers));
    setSubmitted(true);
    setShowResults(true);
    setShowEmail(false);
  };

  if (showResults && result) {
    return (
      <div style={{ animation: 'fadeInUp 0.6s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ color: 'var(--accent-gold)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Your Style Profile</p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 16 }}>
            {result.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>{result.description}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 48 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: 28, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ color: 'var(--accent-gold)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Key Pieces</h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.keyPieces.map((piece, i) => (
                <li key={i} style={{ color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--accent-gold)', flexShrink: 0 }}></span>
                  {piece}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: 28, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ color: 'var(--accent-blush)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>Your Color Palette</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {result.colorPalette.map((color, i) => (
                <span key={i} style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  color: 'var(--text-primary)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  border: '1px solid var(--border-subtle)',
                }}>{color}</span>
              ))}
            </div>
            <h3 style={{ color: 'var(--accent-blush)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12, marginTop: 24, fontFamily: 'system-ui, sans-serif' }}>Brands for You</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {result.brands.map((brand, i) => (
                <span key={i} style={{
                  backgroundColor: 'rgba(212,165,116,0.1)',
                  color: 'var(--accent-gold)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  border: '1px solid rgba(212,165,116,0.2)',
                }}>{brand}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 24, fontFamily: 'Georgia, serif', marginBottom: 24, textAlign: 'center' }}>
            Curated for Your Style
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {result.recommendations.map((rec, i) => (
              <a key={i} href={rec.affiliateUrl} target="_blank" rel="noopener noreferrer nofollow" style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 12,
                padding: 20,
                border: '1px solid var(--border-subtle)',
                display: 'block',
                transition: 'all 0.3s',
                textDecoration: 'none',
              }}>
                <div style={{
                  width: '100%',
                  height: 160,
                  backgroundColor: 'var(--bg-card-hover)',
                  borderRadius: 8,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  {rec.brand}
                </div>
                <p style={{ fontSize: 12, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>{rec.brand}</p>
                <p style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.4 }}>{rec.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent-blush)', fontWeight: 600, fontSize: 15 }}>{rec.price}</span>
                  <span style={{
                    backgroundColor: 'var(--accent-gold)',
                    color: 'var(--bg-primary)',
                    padding: '4px 12px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'system-ui, sans-serif',
                    textTransform: 'uppercase',
                  }}>Shop Now</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <button
            onClick={() => {
              setShowResults(false);
              setShowEmail(false);
              setSubmitted(false);
              setResult(null);
              setAnswers([]);
              setCurrentQuestion(0);
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold)',
              padding: '12px 32px',
              borderRadius: 24,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.3s',
            }}
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  if (showEmail) {
    return (
      <div style={{
        maxWidth: 440,
        margin: '0 auto',
        textAlign: 'center',
        animation: 'fadeInUp 0.5s ease-out',
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-blush))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 24,
        }}>
          ✨
        </div>
        <h2 style={{ fontSize: 28, fontFamily: 'Georgia, serif', marginBottom: 12 }}>
          Almost There!
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
          Enter your email to unlock your full style profile with personalized recommendations, outfit ideas, and exclusive content.
        </p>
        <form onSubmit={handleSubmitEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '14px 18px',
              color: 'var(--text-primary)',
              fontSize: 15,
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
            }}
          />
          <button type="submit" style={{
            background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
            border: 'none',
            borderRadius: 12,
            padding: '14px 24px',
            color: 'var(--bg-primary)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'transform 0.2s',
          }}>
            Reveal My Style
          </button>
        </form>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 16, fontFamily: 'system-ui, sans-serif' }}>
          Free forever. Unsubscribe anytime. We respect your inbox.
        </p>
      </div>
    );
  }

  const q = questions[currentQuestion];

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span style={{ color: 'var(--accent-gold)', fontSize: 12 }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 3, backgroundColor: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-blush))',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}></div>
        </div>
      </div>

      {/* Question */}
      <div style={{ animation: 'fadeInUp 0.4s ease-out' }} key={q.id}>
        <h2 style={{
          fontSize: 'clamp(20px, 3.5vw, 28px)',
          fontFamily: 'Georgia, serif',
          fontWeight: 600,
          marginBottom: 32,
          lineHeight: 1.4,
          textAlign: 'center',
        }}>
          {q.question}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {q.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(option.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '16px 20px',
                color: 'var(--text-primary)',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                transition: 'all 0.2s',
                lineHeight: 1.5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-gold)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
