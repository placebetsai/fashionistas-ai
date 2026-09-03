'use client';

import { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot: 'hero' | 'inContent' | 'sidebar' | 'footer' | 'mobile';
  format?: string;
  style?: React.CSSProperties;
}

const SLOT_CONFIG: Record<string, { className: string; minHeight: number }> = {
  hero: { className: 'ad-hero', minHeight: 90 },
  inContent: { className: 'ad-in-content', minHeight: 250 },
  sidebar: { className: 'ad-sidebar', minHeight: 600 },
  footer: { className: 'ad-footer', minHeight: 90 },
  mobile: { className: 'ad-mobile', minHeight: 100 },
};

export default function AdUnit({ slot, format = 'auto', style }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const config = SLOT_CONFIG[slot] || SLOT_CONFIG.inContent;

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        (window as any).adsbygoogle.push({});
      }
    } catch (e) {
      console.warn('AdSense error:', e);
    }
  }, []);

  return (
    <div
      ref={adRef}
      className={`ad-container ${config.className}`}
      style={{
        minHeight: config.minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '24px auto',
        maxWidth: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: config.minHeight }}
        data-ad-client="ca-pub-7215975042937417"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
