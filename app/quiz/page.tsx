'use client';

import dynamic from 'next/dynamic';

const QuizEngine = dynamic(() => import('@/components/QuizEngine'), { ssr: false });

export default function QuizPage() {
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
          }}>Style Finder Quiz</h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 15,
            maxWidth: 460,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            10 quick questions to unlock your personal style profile, curated recommendations, and outfit ideas.
          </p>
        </div>
        <QuizEngine />
      </div>
    </div>
  );
}
