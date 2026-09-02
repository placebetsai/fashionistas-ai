'use client';

import { useState } from 'react';

interface OutfitRecommendation {
  occasion: string;
  top: string;
  bottom: string;
  shoes: string;
  accessories: string;
  tip: string;
}

const occasions = [
  'Date Night', 'Job Interview', 'Wedding Guest', 'Brunch', 'Vacation',
  'Casual Friday', 'First Date', 'Cocktail Party', 'Gallery Opening',
  'Coffee Date', 'Anniversary Dinner', 'Concert', 'Sunday Market',
];

const weatherOptions = ['Warm', 'Mild', 'Cool', 'Cold'];
const budgetOptions = ['Under $50', '$50 — $150', '$150 — $300', 'No Budget'];
const styleOptions = ['Classic', 'Bohemian', 'Minimalist', 'Streetwear', 'Romantic', 'Edgy', 'Surprise Me'];

const sampleOutfits: Record<string, OutfitRecommendation> = {
  'Date Night': {
    occasion: 'Date Night',
    top: 'Silk camisole in champagne or a fitted cashmere sweater in black',
    bottom: 'High-waisted tailored trousers or a satin midi skirt',
    shoes: 'Strappy heeled sandals or pointed-toe mules',
    accessories: 'Delicate gold layered necklaces, small clutch bag, subtle perfume',
    tip: 'Choose one statement piece and keep the rest simple. Confidence is the best accessory.',
  },
  'Job Interview': {
    occasion: 'Job Interview',
    top: 'Crisp white button-down or a structured blazer over a neutral top',
    bottom: 'Tailored straight-leg trousers or a knee-length pencil skirt',
    shoes: 'Classic pointed-toe pumps or clean leather loafers',
    accessories: 'Minimal jewelry — stud earrings and a quality watch. Structured bag.',
    tip: 'Dress one level above the company dress code. When in doubt, navy or charcoal always works.',
  },
  'Wedding Guest': {
    occasion: 'Wedding Guest',
    top: 'Wrap blouse or one-shoulder top in a festive color',
    bottom: 'Flowing midi skirt or wide-leg palazzo pants',
    shoes: 'Block heel sandals or elegant wedges (for outdoor venues)',
    accessories: 'Statement earrings, small evening clutch, optional wrap for evening',
    tip: 'Avoid white, ivory, and black (unless specified). Jewel tones are always safe and stunning.',
  },
};

function generateOutfit(occasion: string, weather: string, budget: string, style: string): OutfitRecommendation {
  if (sampleOutfits[occasion]) return sampleOutfits[occasion];

  const styles: Record<string, { top: string[]; bottom: string[]; shoes: string[]; accessories: string[]; tips: string[] }> = {
    Classic: {
      top: ['Tailored blazer', 'Crisp button-down', 'Fitted cashmere knit'],
      bottom: ['Straight-leg trousers', 'Pencil skirt', 'Dark denim'],
      shoes: ['Pointed pumps', 'Leather loafers', 'Ankle boots'],
      accessories: ['Structured tote', 'Quality watch', 'Pearl studs'],
      tips: ['Invest in quality over quantity', 'Navy and camel go with everything', 'Fit is everything — get a tailor'],
    },
    Bohemian: {
      top: ['Embroidered blouse', 'Flowy peasant top', 'Linen camp shirt'],
      bottom: ['Wide-leg linen pants', 'Flowing maxi skirt', 'Suede shorts'],
      shoes: ['Suede ankle boots', 'Strappy sandals', 'Espadrilles'],
      accessories: ['Layered necklaces', 'Woven belt', 'Fringe bag'],
      tips: ['Mix textures freely', 'Earth tones always work', 'Vintage finds add character'],
    },
    Minimalist: {
      top: ['Perfect white tee', 'Ribbed tank', 'Oversized crewneck'],
      bottom: ['Slim black trousers', 'Straight-leg jeans', 'Culottes'],
      shoes: ['White sneakers', 'Simple mules', 'Clean ankle boots'],
      accessories: ['Minimal watch', 'Structured bag', 'Single chain necklace'],
      tips: ['Stick to a neutral palette', 'Quality fabric makes simple pieces special', 'Less is genuinely more'],
    },
    Streetwear: {
      top: ['Oversized graphic tee', 'Hoodie', 'Cropped bomber'],
      bottom: ['Cargo pants', 'Wide-leg jeans', 'Track pants'],
      shoes: ['Chunky sneakers', 'High-tops', 'Slides'],
      accessories: ['Crossbody bag', 'Baseball cap', 'Chain bracelet'],
      tips: ['Mix high and low brands', 'Proportions matter — balance oversized with fitted', 'Confidence sells any look'],
    },
    Romantic: {
      top: ['Puff-sleeve blouse', 'Lace-trim cami', 'Floral wrap top'],
      bottom: ['Tulle midi skirt', 'Pleated trousers', 'Denim midi skirt'],
      shoes: ['Ballet flats', 'Kitten heels', 'Lace-up sandals'],
      accessories: ['Pearl earrings', 'Delicate bracelets', 'Satin clutch'],
      tips: ['Soft textures are your friend', 'Pastels and jewel tones work beautifully', 'A red lip elevates any look'],
    },
    Edgy: {
      top: ['Leather jacket', 'Band tee', 'Mesh long-sleeve'],
      bottom: ['Leather pants', 'Ripped skinny jeans', 'Mini skirt'],
      shoes: ['Combat boots', 'Platform boots', 'Pointed ankle boots'],
      accessories: ['Chain necklace', 'Statement rings', 'Studded bag'],
      tips: ['Black is a complete outfit', 'Layering adds dimension', 'One bold piece per look is enough'],
    },
    'Surprise Me': {
      top: ['Something unexpected', 'A color you don\'t usually wear', 'A texture you\'ve never tried'],
      bottom: ['A silhouette outside your comfort zone', 'A print that speaks to you', 'A vintage find'],
      shoes: ['The shoes that make you feel powerful', 'Something you\'ve been eyeing', 'Your most comfortable pair'],
      accessories: ['One piece that sparks joy', 'Something handmade', 'A bold accessory'],
      tips: ['Style has no rules', 'Try it on — you might surprise yourself', 'The best outfit is the one that makes you feel like you'],
    },
  };

  const s = styles[style] || styles.Classic;

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    occasion,
    top: pick(s.top),
    bottom: pick(s.bottom),
    shoes: pick(s.shoes),
    accessories: pick(s.accessories),
    tip: pick(s.tips),
  };
}

export default function AIStylistPage() {
  const [occasion, setOccasion] = useState('');
  const [weather, setWeather] = useState('Mild');
  const [budget, setBudget] = useState('$50 — $150');
  const [style, setStyle] = useState('Classic');
  const [result, setResult] = useState<OutfitRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!occasion) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, weather, budget, style }),
      });
      const data = await resp.json();
      if (data.outfit) {
        setResult({ occasion, ...data.outfit });
      } else {
        const outfit = generateOutfit(occasion, weather, budget, style);
        setResult(outfit);
      }
    } catch {
      const outfit = generateOutfit(occasion, weather, budget, style);
      setResult(outfit);
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{
            color: 'var(--accent-gold)',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            marginBottom: 8,
            fontFamily: 'system-ui, sans-serif',
          }}>AI-Powered</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>AI Stylist</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 15,
            maxWidth: 460,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Tell us the occasion, and we&apos;ll generate a complete outfit recommendation — tailored to your style.
          </p>
        </div>

        {/* Input Form */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          padding: 'clamp(24px, 4vw, 32px)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 32,
        }}>
          {/* Occasion */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Occasion</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {occasions.map((occ) => (
                <button
                  key={occ}
                  onClick={() => setOccasion(occ)}
                  style={{
                    backgroundColor: occasion === occ ? 'var(--accent-gold)' : 'var(--bg-primary)',
                    color: occasion === occ ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${occasion === occ ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >{occ}</button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Weather</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {weatherOptions.map((w) => (
                <button
                  key={w}
                  onClick={() => setWeather(w)}
                  style={{
                    backgroundColor: weather === w ? 'var(--accent-gold)' : 'var(--bg-primary)',
                    color: weather === w ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${weather === w ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >{w}</button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Budget</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {budgetOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  style={{
                    backgroundColor: budget === b ? 'var(--accent-gold)' : 'var(--bg-primary)',
                    color: budget === b ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${budget === b ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >{b}</button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Style Preference</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {styleOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  style={{
                    backgroundColor: style === s ? 'var(--accent-gold)' : 'var(--bg-primary)',
                    color: style === s ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${style === s ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!occasion || loading}
            style={{
              background: (!occasion || loading) ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent-gold), #c49464)',
              border: 'none',
              borderRadius: 12,
              padding: '14px 32px',
              color: 'var(--bg-primary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: (!occasion || loading) ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              width: '100%',
              transition: 'all 0.3s',
            }}
          >
            {loading ? '✨ Generating Your Look...' : 'Generate Outfit'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{
            animation: 'fadeInUp 0.5s ease-out',
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 16,
              padding: 'clamp(24px, 4vw, 32px)',
              border: '1px solid var(--accent-gold)',
              marginBottom: 24,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <p style={{ color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>Your AI-Generated Look</p>
                <h2 style={{ fontSize: 24, fontFamily: 'Georgia, serif' }}>{result.occasion}</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Top', value: result.top, emoji: '👔' },
                  { label: 'Bottom', value: result.bottom, emoji: '👖' },
                  { label: 'Shoes', value: result.shoes, emoji: '👟' },
                  { label: 'Accessories', value: result.accessories, emoji: '✨' },
                ].map((item, i) => (
                  <div key={i} style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 12,
                    padding: 16,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span>{item.emoji}</span>
                      <span style={{ color: 'var(--accent-gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.6 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 20,
                backgroundColor: 'rgba(212,165,116,0.05)',
                borderRadius: 10,
                padding: 16,
                borderLeft: '3px solid var(--accent-gold)',
              }}>
                <p style={{ color: 'var(--accent-gold)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6, fontFamily: 'system-ui, sans-serif' }}>Style Tip</p>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{result.tip}</p>
              </div>
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Want a more personalized recommendation?</p>
              <a href="/quiz" style={{
                border: '1px solid var(--accent-blush)',
                color: 'var(--accent-blush)',
                padding: '12px 28px',
                borderRadius: 24,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'system-ui, sans-serif',
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                display: 'inline-block',
              }}>Take the Full Style Quiz →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
