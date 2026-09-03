import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Fashionistas.ai',
  description: 'Privacy policy for Fashionistas.ai. Learn how we collect, use, and protect your personal information.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const lastUpdated = 'September 3, 2026';

  return (
    <div style={{ paddingTop: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 80px' }}>
        <p style={{ color: '#E91E63', fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700 }}>
          Legal
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#999', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 32 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: '#333', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <p style={{ marginBottom: 20 }}>
            Fashionistas.ai (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Fashionistas.ai website. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Information We Collect</h2>
          <p style={{ marginBottom: 12 }}>We may collect information about you in a variety of ways, including:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}><strong>Personal Data:</strong> Name and email address when you subscribe to our newsletter or contact us through our form.</li>
            <li style={{ marginBottom: 8 }}><strong>Derivative Data:</strong> Information automatically collected when you visit our site, such as your IP address, browser type, operating system, access times, and the pages you have viewed.</li>
            <li style={{ marginBottom: 8 }}><strong>Cookie Data:</strong> We use cookies and similar tracking technologies to enhance your experience. This includes cookies set by Google AdSense for ad personalization.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>How We Use Your Information</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}>To operate and maintain our website</li>
            <li style={{ marginBottom: 8 }}>To send you newsletters (only if you opt in)</li>
            <li style={{ marginBottom: 8 }}>To respond to your inquiries and provide customer support</li>
            <li style={{ marginBottom: 8 }}>To monitor and analyze usage trends to improve user experience</li>
            <li style={{ marginBottom: 8 }}>To display personalized advertisements through Google AdSense</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Google AdSense &amp; Cookies</h2>
          <p style={{ marginBottom: 20 }}>
            We use Google AdSense to serve advertisements on our site. Google AdSense uses cookies to serve ads based on your prior visits to our website and other websites. Google&apos;s use of advertising cookies enables it and its partners to serve ads based on your visit to our site and/or other sites on the internet.
          </p>
          <p style={{ marginBottom: 20 }}>
            You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" style={{ color: '#E91E63', textDecoration: 'underline' }}>Google Ads Settings</a>. Alternatively, you can opt out of some third-party vendors&apos; use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info/choices/" style={{ color: '#E91E63', textDecoration: 'underline' }}>www.aboutads.info</a>.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Third-Party Services</h2>
          <p style={{ marginBottom: 20 }}>
            We may employ third-party companies and individuals to facilitate our service, provide service on our behalf, perform service-related functions, or assist us in analyzing how our service is used. These third parties have access to your personal data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>GDPR Rights (EU Users)</h2>
          <p style={{ marginBottom: 20 }}>
            If you are a resident of the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR). We aim to take reasonable steps to allow you to correct, amend, delete, or limit the use of your personal data. You have the right to:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}>Access the personal information we hold about you</li>
            <li style={{ marginBottom: 8 }}>Request correction of inaccurate personal information</li>
            <li style={{ marginBottom: 8 }}>Request deletion of your personal information</li>
            <li style={{ marginBottom: 8 }}>Object to processing of your personal information</li>
            <li style={{ marginBottom: 8 }}>Request data portability</li>
            <li style={{ marginBottom: 8 }}>Withdraw consent at any time</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>CCPA Rights (California Users)</h2>
          <p style={{ marginBottom: 20 }}>
            Under the California Consumer Privacy Act (CCPA), California residents have the right to:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}>Know what personal data is being collected about them</li>
            <li style={{ marginBottom: 8 }}>Know whether their personal data is sold or disclosed and to whom</li>
            <li style={{ marginBottom: 8 }}>Say no to the sale of personal data</li>
            <li style={{ marginBottom: 8 }}>Access their personal data</li>
            <li style={{ marginBottom: 8 }}>Equal service and price, even if they exercise their privacy rights</li>
          </ul>
          <p style={{ marginBottom: 20 }}>
            To exercise any of these rights, please contact us at <a href="mailto:israeljoffe@gmail.com" style={{ color: '#E91E63', textDecoration: 'underline' }}>israeljoffe@gmail.com</a>.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Data Retention</h2>
          <p style={{ marginBottom: 20 }}>
            We retain your personal data only for as long as necessary for the purposes outlined in this Privacy Policy. We will retain and use your data to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Children&apos;s Privacy</h2>
          <p style={{ marginBottom: 20 }}>
            Our website is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us and we will take steps to remove that information.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Changes to This Policy</h2>
          <p style={{ marginBottom: 20 }}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at <a href="mailto:israeljoffe@gmail.com" style={{ color: '#E91E63', textDecoration: 'underline' }}>israeljoffe@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
