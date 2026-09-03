import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — Fashionistas.ai',
  description: 'Get in touch with the Fashionistas.ai editorial team. Send us your questions, feedback, or partnership inquiries.',
  openGraph: {
    title: 'Contact Us — Fashionistas.ai',
    description: 'Get in touch with the Fashionistas.ai editorial team.',
    siteName: 'Fashionistas.ai',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px 80px' }}>
        <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
          Contact
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
          Get in Touch
        </h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.7, marginBottom: 40, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Have a question, feedback, or want to work together? We would love to hear from you. Fill out the form below and we will get back to you as soon as possible.
        </p>

        <form
          action="https://formsubmit.co/israeljoffe@gmail.com"
          method="POST"
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <input type="hidden" name="_next" value="https://fashionistas.ai/contact" />
          <input type="hidden" name="_captcha" value="true" />

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 15,
                fontFamily: 'Inter, system-ui, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 15,
                fontFamily: 'Inter, system-ui, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Subject
            </label>
            <input
              type="text"
              name="subject"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 15,
                fontFamily: 'Inter, system-ui, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif' }}>
              Message
            </label>
            <textarea
              name="message"
              required
              rows={5}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 15,
                fontFamily: 'Inter, system-ui, sans-serif',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: '#E91E63',
              color: 'white',
              padding: '14px 32px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              border: 'none',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              boxShadow: '0 4px 20px rgba(233,30,99,0.3)',
            }}
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
