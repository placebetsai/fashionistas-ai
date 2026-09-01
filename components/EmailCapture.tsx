'use client';

import { useState } from 'react';

export default function EmailCapture({ variant = 'inline' }: { variant?: 'inline' | 'sidebar' | 'hero' }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  if (subscribed) {
    return (
      <div style={{
        backgroundColor: '#FFF0F5',
        borderRadius: 12,
        padding: 24,
        border: '1px solid #E91E63',
        textAlign: 'center',
      }}>
        <p style={{ color: '#E91E63', fontSize: 16, fontWeight: 600 }}>Welcome to Fashionistas!</p>
        <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Check your inbox for your free Capsule Wardrobe Guide.</p>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div style={{
        backgroundColor: '#FFF0F5',
        borderRadius: 16,
        padding: '40px 32px',
        textAlign: 'center',
        border: '1px solid #F8BBD0',
      }}>
        <h3 style={{ fontSize: 22, fontFamily: 'Georgia, serif', marginBottom: 8 }}>Get Our Free Capsule Wardrobe Guide</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Plus weekly style tips, trend alerts, and exclusive deals.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, maxWidth: 400, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '12px 16px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
          />
          <button type="submit" style={{
            backgroundColor: '#E91E63',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}>Subscribe Free</button>
        </form>
        <p style={{ color: '#999', fontSize: 11, marginTop: 10, fontFamily: 'system-ui, sans-serif' }}>
          Join 12,000+ fashion lovers. No spam, ever.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#FFF0F5',
      borderRadius: 12,
      padding: 24,
      border: '1px solid #F8BBD0',
      marginTop: 32,
    }}>
      <h3 style={{ fontSize: 18, fontFamily: 'Georgia, serif', marginBottom: 8 }}>Enjoyed this article?</h3>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>Get our free Capsule Wardrobe Guide + weekly style tips.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
        />
        <button type="submit" style={{
          backgroundColor: '#E91E63',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '10px 20px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}>Subscribe</button>
      </form>
    </div>
  );
}
