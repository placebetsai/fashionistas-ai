'use client';

import { useState } from 'react';
import ProductCard from '@/components/ProductCard';

const occasions = [
  { id: 'date-night', label: 'Date Night', emoji: '💕' },
  { id: 'office', label: 'Office', emoji: '💼' },
  { id: 'wedding-guest', label: 'Wedding Guest', emoji: '💒' },
  { id: 'brunch', label: 'Brunch', emoji: '🥂' },
  { id: 'vacation', label: 'Vacation', emoji: '✈️' },
  { id: 'casual', label: 'Everyday', emoji: '🌿' },
];

const outfits: Record<string, { title: string; description: string; items: { name: string; brand: string; price: string; affiliateUrl: string; tag: string }[] }[]> = {
  'date-night': [
    {
      title: 'Classic Elegance',
      description: 'Timeless sophistication for a romantic evening out.',
      items: [
        { name: 'Satin Midi Dress', brand: 'Reformation', price: '$178', affiliateUrl: '#', tag: 'Dress' },
        { name: 'Strappy Heels', brand: 'ASOS', price: '$52', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Clutch Bag', brand: 'Zara', price: '$39', affiliateUrl: '#', tag: 'Bag' },
        { name: 'Gold Drop Earrings', brand: 'Zara', price: '$18', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
    {
      title: 'Modern Romance',
      description: 'Feminine and flirty with a contemporary edge.',
      items: [
        { name: 'Lace Trim Top', brand: 'ASOS', price: '$34', affiliateUrl: '#', tag: 'Top' },
        { name: 'Leather Mini Skirt', brand: 'Reformation', price: '$148', affiliateUrl: '#', tag: 'Skirt' },
        { name: 'Pointed Mules', brand: 'COS', price: '$135', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Chain Necklace', brand: 'Zara', price: '$22', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
  ],
  'office': [
    {
      title: 'Power Player',
      description: 'Command any boardroom with polished confidence.',
      items: [
        { name: 'Tailored Blazer', brand: 'COS', price: '$175', affiliateUrl: '#', tag: 'Blazer' },
        { name: 'Wide-Leg Trousers', brand: 'Everlane', price: '$88', affiliateUrl: '#', tag: 'Pants' },
        { name: 'Silk Blouse', brand: 'Everlane', price: '$78', affiliateUrl: '#', tag: 'Top' },
        { name: 'Loafers', brand: 'Reformation', price: '$168', affiliateUrl: '#', tag: 'Shoes' },
      ],
    },
    {
      title: 'Creative Casual',
      description: 'Relaxed yet professional for creative workplaces.',
      items: [
        { name: 'Oversized Cardigan', brand: 'COS', price: '$115', affiliateUrl: '#', tag: 'Layer' },
        { name: 'Midi Pencil Skirt', brand: 'ASOS', price: '$38', affiliateUrl: '#', tag: 'Skirt' },
        { name: 'Turtleneck', brand: 'Arket', price: '$49', affiliateUrl: '#', tag: 'Top' },
        { name: 'Ankle Boots', brand: 'Free People', price: '$198', affiliateUrl: '#', tag: 'Shoes' },
      ],
    },
  ],
  'wedding-guest': [
    {
      title: 'Garden Romance',
      description: 'Dreamy and elegant for outdoor celebrations.',
      items: [
        { name: 'Floral Maxi Dress', brand: 'Reformation', price: '$218', affiliateUrl: '#', tag: 'Dress' },
        { name: 'Wedge Sandals', brand: 'Free People', price: '$128', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Woven Clutch', brand: 'Anthropologie', price: '$48', affiliateUrl: '#', tag: 'Bag' },
        { name: 'Pearl Earrings', brand: 'Zara', price: '$16', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
    {
      title: 'Cocktail Chic',
      description: 'Sophisticated and festive for evening receptions.',
      items: [
        { name: 'Cocktail Dress', brand: 'ASOS', price: '$68', affiliateUrl: '#', tag: 'Dress' },
        { name: 'Strappy Heels', brand: 'ASOS', price: '$52', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Evening Clutch', brand: 'Zara', price: '$45', affiliateUrl: '#', tag: 'Bag' },
        { name: 'Statement Earrings', brand: 'Zara', price: '$22', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
  ],
  brunch: [
    {
      title: 'Weekend Ease',
      description: 'Effortlessly chic for Saturday morning vibes.',
      items: [
        { name: 'Linen Midi Dress', brand: 'Everlane', price: '$98', affiliateUrl: '#', tag: 'Dress' },
        { name: 'Ballet Flats', brand: 'Reformation', price: '$148', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Straw Tote', brand: 'Free People', price: '$68', affiliateUrl: '#', tag: 'Bag' },
        { name: 'Layered Necklace', brand: 'Zara', price: '$16', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
  ],
  vacation: [
    {
      title: 'Resort Ready',
      description: 'Sun-soaked style for tropical getaways.',
      items: [
        { name: 'Printed Maxi Dress', brand: 'Free People', price: '$148', affiliateUrl: '#', tag: 'Dress' },
        { name: 'Platform Sandals', brand: 'Free People', price: '$128', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Woven Bucket Hat', brand: 'ASOS', price: '$22', affiliateUrl: '#', tag: 'Hat' },
        { name: 'Shell Necklace', brand: 'Anthropologie', price: '$28', affiliateUrl: '#', tag: 'Jewelry' },
      ],
    },
    {
      title: 'City Explorer',
      description: 'Stylish yet practical for urban adventures.',
      items: [
        { name: 'Cargo Pants', brand: 'ASOS', price: '$42', affiliateUrl: '#', tag: 'Pants' },
        { name: 'Cropped Tank', brand: 'Everlane', price: '$28', affiliateUrl: '#', tag: 'Top' },
        { name: 'Sneakers', brand: 'Veja', price: '$120', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Crossbody Bag', brand: 'Zara', price: '$35', affiliateUrl: '#', tag: 'Bag' },
      ],
    },
  ],
  casual: [
    {
      title: 'Off-Duty Cool',
      description: 'Weekend uniform that always works.',
      items: [
        { name: 'Perfect White Tee', brand: 'Everlane', price: '$30', affiliateUrl: '#', tag: 'Top' },
        { name: 'Straight-Leg Jeans', brand: 'Everlane', price: '$78', affiliateUrl: '#', tag: 'Pants' },
        { name: 'White Sneakers', brand: 'Veja', price: '$120', affiliateUrl: '#', tag: 'Shoes' },
        { name: 'Canvas Tote', brand: 'Everlane', price: '$48', affiliateUrl: '#', tag: 'Bag' },
      ],
    },
  ],
};

export default function OutfitIdeasPage() {
  const [activeOccasion, setActiveOccasion] = useState('date-night');
  const currentOutfits = outfits[activeOccasion] || [];

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
          }}>Get Inspired</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            marginBottom: 12,
          }}>Outfit Ideas</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Complete outfit inspiration for every occasion — with shoppable pieces at every price point.
          </p>
        </div>

        {/* Occasion Tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 48,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {occasions.map((occ) => (
            <button
              key={occ.id}
              onClick={() => setActiveOccasion(occ.id)}
              style={{
                backgroundColor: activeOccasion === occ.id ? 'var(--accent-gold)' : 'var(--bg-card)',
                color: activeOccasion === occ.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: `1px solid ${activeOccasion === occ.id ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                borderRadius: 24,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                whiteSpace: 'nowrap' as const,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{occ.emoji}</span>
              {occ.label}
            </button>
          ))}
        </div>

        {/* Outfits Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {currentOutfits.map((outfit, i) => (
            <div key={i}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 24, fontFamily: 'Georgia, serif', marginBottom: 6 }}>{outfit.title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{outfit.description}</p>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
              }}>
                {outfit.items.map((item, j) => (
                  <ProductCard key={j} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pinterest CTA */}
        <div style={{
          marginTop: 60,
          textAlign: 'center',
          padding: 40,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-subtle)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Save for Later</p>
          <h3 style={{ fontSize: 22, fontFamily: 'Georgia, serif', marginBottom: 12 }}>Pin Your Favorite Looks</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Follow us on Pinterest for daily outfit inspiration and trend alerts.
          </p>
          <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" style={{
            background: 'linear-gradient(135deg, #e60023, #bd081c)',
            color: 'white',
            padding: '12px 32px',
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            display: 'inline-block',
          }}>Follow on Pinterest</a>
        </div>
      </div>
    </div>
  );
}
