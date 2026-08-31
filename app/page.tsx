'use client';

import { useState } from 'react';
import ArticleCard from '@/components/ArticleCard';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const trendingItems = [
    { name: 'Ballet Flats', brand: 'Reformation', price: '$148', affiliateUrl: '#', tag: 'Trending' },
    { name: 'Oversized Linen Blazer', brand: 'COS', price: '$175', affiliateUrl: '#', tag: 'New' },
    { name: 'Low-Rise Cargo Pants', brand: 'ASOS', price: '$42', affiliateUrl: '#', tag: 'Hot' },
    { name: 'Chain-Link Necklace', brand: 'Zara', price: '$25', affiliateUrl: '#', tag: 'Trending' },
    { name: 'Satin Midi Skirt', brand: 'Everlane', price: '$88', affiliateUrl: '#', tag: 'Sale' },
    { name: 'Platform Sandals', brand: 'Free People', price: '$198', affiliateUrl: '#', tag: 'New' },
  ];

  const styleProfiles = [
    { type: 'Classic', emoji: '🏛️', desc: 'Refined, investment-worthy pieces that never go out of style.', color: 'var(--accent-gold)' },
    { type: 'Bohemian', emoji: '🌿', desc: 'Eclectic vintage finds and globally inspired textures.', color: '#c49a6c' },
    { type: 'Minimalist', emoji: '◻️', desc: 'Edited, intentional basics that let fit do the talking.', color: 'var(--text-secondary)' },
    { type: 'Streetwear', emoji: '🔥', desc: 'Bold logos, hype drops, and urban confidence.', color: '#e85d4a' },
    { type: 'Romantic', emoji: '🌸', desc: 'Soft, feminine dreaminess in every detail.', color: 'var(--accent-blush)' },
    { type: 'Edgy', emoji: '⚡', desc: 'Dark, daring, and unapologetically bold.', color: '#b44a7a' },
  ];

  const latestArticles = [
    { title: 'What to Wear to a Fall Wedding Under $100', excerpt: 'Budget-friendly wedding guest outfits that look expensive. From midi dresses to tailored separates.', category: 'Occasion', readTime: '6 min read', date: 'Aug 2026', href: '/blog' },
    { title: 'Fall 2026 Fashion Trends: What to Buy & Skip', excerpt: 'The definitive guide to this season\'s trends — which ones are worth investing in and which to skip.', category: 'Trends', readTime: '8 min read', date: 'Aug 2026', href: '/blog' },
    { title: 'Capsule Wardrobe Essentials 2026', excerpt: 'The 30 pieces you need to build a wardrobe that works for every occasion. Minimal effort, maximum style.', category: 'Guide', readTime: '10 min read', date: 'Aug 2026', href: '/blog' },
    { title: 'Date Night Outfits for Every Season', excerpt: 'From casual dinner dates to fancy nights out — outfit inspiration for every romantic occasion.', category: 'Outfits', readTime: '7 min read', date: 'Aug 2026', href: '/blog' },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div style={{ paddingTop: 64 }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 20px',
        overflow: 'hidden',
      }}>
        {/* Background glow effects */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(212,165,116,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '20%',
          right: '20%',
          width: 350,
          height: 350,
          background: 'radial-gradient(circle, rgba(232,196,196,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}></div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, animation: 'fadeInUp 0.8s ease-out' }}>
          <p style={{
            color: 'var(--accent-gold)',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '4px',
            marginBottom: 20,
            fontFamily: 'system-ui, sans-serif',
          }}>AI-Powered Fashion</p>
          <h1 style={{
            fontSize: 'clamp(36px, 7vw, 72px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 24,
            letterSpacing: '-1px',
          }}>
            Discover Your<br />
            <span style={{
              background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-blush))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Perfect Style</span>
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 'clamp(16px, 2vw, 20px)',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 520,
            margin: '0 auto 40px',
          }}>
            Take our AI-powered style quiz and get personalized outfit recommendations, trend alerts, and curated shopping — all tailored to you.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/quiz" style={{
              background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
              color: 'var(--bg-primary)',
              padding: '16px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(212,165,116,0.3)',
            }}>Take the Style Quiz</a>
            <a href="/ai-stylist" style={{
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold)',
              padding: '16px 40px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              textTransform: 'uppercase' as const,
              letterSpacing: '1.5px',
              display: 'inline-block',
              transition: 'all 0.3s',
            }}>AI Stylist</a>
          </div>
        </div>
      </section>

      {/* Trending Now */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: 'var(--accent-gold)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>What&apos;s Hot</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: 'Georgia, serif' }}>Trending Now</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}>
          {trendingItems.map((item, i) => (
            <ProductCard key={i} {...item} />
          ))}
        </div>
      </section>

      {/* Style Profiles */}
      <section style={{ padding: '60px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: 'var(--accent-blush)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Find Your Aesthetic</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: 'Georgia, serif' }}>Style Personality</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {styleProfiles.map((profile, i) => (
            <a key={i} href="/quiz" style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 12,
              padding: 24,
              border: '1px solid var(--border-subtle)',
              display: 'block',
              transition: 'all 0.3s',
              textDecoration: 'none',
              color: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = profile.color;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <span style={{ fontSize: 28, marginBottom: 12, display: 'block' }}>{profile.emoji}</span>
              <h3 style={{ fontSize: 18, marginBottom: 8, color: profile.color, fontFamily: 'Georgia, serif' }}>{profile.type}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{profile.desc}</p>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/quiz" style={{
            border: '1px solid var(--accent-gold)',
            color: 'var(--accent-gold)',
            padding: '12px 32px',
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            display: 'inline-block',
            transition: 'all 0.3s',
          }}>Take the Full Quiz →</a>
        </div>
      </section>

      {/* Latest Articles */}
      <section style={{ padding: '60px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: 'var(--accent-gold)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Style Journal</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontFamily: 'Georgia, serif' }}>Latest Articles</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {latestArticles.map((article, i) => (
            <ArticleCard key={i} {...article} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/blog" style={{
            color: 'var(--accent-gold)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}>View All Articles →</a>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{
        padding: '80px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(212,165,116,0.05) 0%, rgba(232,196,196,0.03) 100%)',
        }}></div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 500, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontFamily: 'Georgia, serif', marginBottom: 12 }}>
            Stay Ahead of the Trends
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
            Weekly style tips, trend alerts, and exclusive deals — straight to your inbox.
          </p>
          {subscribed ? (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 12,
              padding: 24,
              border: '1px solid var(--accent-gold)',
            }}>
              <p style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 600 }}>Welcome to the club! ✨</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Check your inbox for a welcome surprise.</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 8, maxWidth: 400, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 240,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'system-ui, sans-serif',
                }}
              />
              <button type="submit" style={{
                background: 'linear-gradient(135deg, var(--accent-gold), #c49464)',
                border: 'none',
                borderRadius: 12,
                padding: '14px 24px',
                color: 'var(--bg-primary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap' as const,
              }}>Subscribe</button>
            </form>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12, fontFamily: 'system-ui, sans-serif' }}>
            Join 12,000+ fashion lovers. No spam, ever.
          </p>
        </div>
      </section>
    </div>
  );
}
