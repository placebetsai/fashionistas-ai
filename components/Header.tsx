'use client';

import { useState, useEffect } from 'react';

const navLinks = [
  { href: '/shoes', label: 'Shoes' },
  { href: '/beauty', label: 'Beauty' },
  { href: '/fashion', label: 'Fashion' },
  { href: '/blog', label: 'Blog' },
  { href: '/quiz', label: 'Quiz' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 0, textDecoration: 'none' }}>
            <span style={{
              fontSize: 24,
              fontWeight: 800,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: '-0.5px',
              lineHeight: 1,
            }}>
              <span style={{ color: '#1a1a1a' }}>FASHIONISTA</span>
              <span style={{ color: '#E91E63' }}>S</span>
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#E91E63',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginLeft: 2,
            }}>.AI</span>
          </a>

          <div className="nav-links" style={{
            display: 'flex',
            gap: 32,
            alignItems: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.3px',
          }}>
            {navLinks.map(link => (
              <a key={link.href} href={link.href} style={{
                color: '#555',
                transition: 'color 0.2s',
                padding: '4px 0',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#E91E63'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#555'; }}
              >{link.label}</a>
            ))}
            <a href="/ai-stylist" style={{
              backgroundColor: '#E91E63',
              color: 'white',
              padding: '10px 24px',
              borderRadius: 24,
              fontWeight: 700,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'all 0.2s',
              boxShadow: '0 2px 12px rgba(233,30,99,0.25)',
            }}>AI Stylist</a>
          </div>

          <button
            className={`nav-hamburger ${open ? 'open' : ''}`}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        {navLinks.map(link => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
        ))}
        <a href="/ai-stylist" className="mobile-cta" onClick={() => setOpen(false)}>AI Stylist</a>
      </div>
    </>
  );
}
