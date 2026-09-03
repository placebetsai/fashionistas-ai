'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const fd = new FormData();
      fd.append('email', 'fashionistas1979@gmail.com');
      fd.append('_subject', `Fashionistas Contact: ${form.subject || 'General'}`);
      fd.append('_template', 'table');
      fd.append('_captcha', 'false');
      fd.append('_replyto', form.email);
      fd.append('name', form.name);
      fd.append('email_from', form.email);
      fd.append('subject', form.subject);
      fd.append('message', form.message);
      fd.append('_autoresponse', `Thanks for contacting Fashionistas — we'll get back to you soon! — The Fashionistas Team`);

      const res = await fetch('https://formsubmit.co/ajax/fashionistas1979@gmail.com', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fd,
      });
      if (res.ok) {
        setStatus('sent');
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh', backgroundColor: '#fafafa' }}>
      <section style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '60px 20px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>Get in Touch</p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 12 }}>Contact Us</h1>
          <p style={{ color: '#666', fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.6 }}>
            Questions, tips, collabs — we want to hear from you.
          </p>
        </div>

        {status === 'sent' ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid #e8f5e9',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💌</div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, marginBottom: 12 }}>Message Sent!</h2>
            <p style={{ color: '#666', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, lineHeight: 1.6 }}>
              Thanks for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <button
              onClick={() => setStatus('idle')}
              style={{
                marginTop: 24,
                backgroundColor: '#E91E63',
                color: 'white',
                border: 'none',
                borderRadius: 24,
                padding: '12px 32px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                cursor: 'pointer',
              }}
            >Send Another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: '32px 28px',
            border: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif', color: '#333' }}>Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  fontSize: 15,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = '#E91E63'; }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = '#ddd'; }}
                placeholder="Your name"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif', color: '#333' }}>Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  fontSize: 15,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = '#E91E63'; }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = '#ddd'; }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif', color: '#333' }}>Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  fontSize: 15,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  outline: 'none',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="">General Inquiry</option>
                <option value="fashion">Fashion Advice</option>
                <option value="collab">Collaboration</option>
                <option value="press">Press / Media</option>
                <option value="bug">Site Issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif', color: '#333' }}>Message *</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  fontSize: 15,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  outline: 'none',
                  resize: 'vertical',
                  transition: 'border 0.2s',
                  lineHeight: 1.6,
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = '#E91E63'; }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = '#ddd'; }}
                placeholder="How can we help?"
              />
            </div>
            {status === 'error' && (
              <p style={{ color: '#E91E63', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Something went wrong. Please try again or email us directly at fashionistas1979@gmail.com
              </p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                backgroundColor: status === 'sending' ? '#ccc' : '#E91E63',
                color: 'white',
                border: 'none',
                borderRadius: 24,
                padding: '14px 32px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: status === 'sending' ? 'none' : '0 4px 20px rgba(233,30,99,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: 40,
          textAlign: 'center',
          color: '#999',
          fontSize: 13,
          fontFamily: 'Inter, system-ui, sans-serif',
          lineHeight: 1.8,
        }}>
          <p>You can also email us directly at <a href="mailto:fashionistas1979@gmail.com" style={{ color: '#E91E63', textDecoration: 'underline' }}>fashionistas1979@gmail.com</a></p>
        </div>
      </section>
    </div>
  );
}
