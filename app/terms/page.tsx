import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Fashionistas.ai',
  description: 'Terms of service for Fashionistas.ai. Read our terms and conditions for using the website.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const lastUpdated = 'September 3, 2026';

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 80px' }}>
        <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
          Legal
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ color: '#999', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 32 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: '#333', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <p style={{ marginBottom: 20 }}>
            Welcome to Fashionistas.ai. These Terms of Service govern your use of our website located at fashionistas.ai. By accessing or using our website, you agree to be bound by these Terms.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Intellectual Property</h2>
          <p style={{ marginBottom: 20 }}>
            All content published on Fashionistas.ai, including articles, images, graphics, logos, and software, is the property of Fashionistas.ai or its content suppliers and is protected by international copyright laws. You may not reproduce, distribute, or create derivative works from any content without our express written permission.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>User Conduct</h2>
          <p style={{ marginBottom: 20 }}>By using our website, you agree not to:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}>Use our website for any unlawful purpose</li>
            <li style={{ marginBottom: 8 }}>Attempt to gain unauthorized access to any portion of the website</li>
            <li style={{ marginBottom: 8 }}>Use automated systems to access or collect data from our website</li>
            <li style={{ marginBottom: 8 }}>Interfere with or disrupt the website or servers</li>
            <li style={{ marginBottom: 8 }}>Reproduce, duplicate, or exploit any content for commercial purposes without authorization</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Affiliate Links</h2>
          <p style={{ marginBottom: 20 }}>
            Fashionistas.ai participates in affiliate marketing programs. Some links on our site are affiliate links, meaning we earn a commission if you make a purchase through those links, at no additional cost to you. We only recommend products we genuinely believe in and have independently reviewed.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Disclaimer</h2>
          <p style={{ marginBottom: 20 }}>
            The information on Fashionistas.ai is provided on an &quot;as is&quot; basis. We make no warranties, expressed or implied, regarding the website or its content. We do not guarantee that the website will be available at all times, that it will be free of errors, or that it will meet your expectations.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Limitation of Liability</h2>
          <p style={{ marginBottom: 20 }}>
            In no event shall Fashionistas.ai, its editors, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the website or any content therein. We are not responsible for the accuracy of product reviews, pricing information, or external links.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>External Links</h2>
          <p style={{ marginBottom: 20 }}>
            Our website may contain links to external websites. We are not responsible for the content, privacy policies, or practices of any third-party sites. Use of external links is at your own risk.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Modifications</h2>
          <p style={{ marginBottom: 20 }}>
            We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting. Your continued use of the website after any modifications constitutes acceptance of the new Terms.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Governing Law</h2>
          <p style={{ marginBottom: 20 }}>
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at <a href="mailto:israeljoffe@gmail.com" style={{ color: '#E91E63', textDecoration: 'underline' }}>israeljoffe@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
