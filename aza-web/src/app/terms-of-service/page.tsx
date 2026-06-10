import React from 'react';
import { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | Aza',
  description: 'Terms of Service for the Aza application.',
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--aza-text)' }}>
        Aza Terms of Service
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--aza-text-secondary)' }}>
        Last updated:{' '}
        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <div className="space-y-6 text-[0.95rem] leading-[1.7]" style={{ color: 'var(--aza-text-secondary)' }}>
        <p>
          Welcome to Aza. These Terms of Service (&quot;Terms&quot;) govern your use of the Aza mobile
          application and related services provided by AZA Financial Services Ltd (&quot;we&quot;,
          &quot;our&quot;, or &quot;us&quot;). By using our services, you agree to these Terms.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            1. Eligibility
          </h2>
          <p>
            You must be at least 18 years old to use our services. By using Aza, you represent and
            warrant that you meet this requirement.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            2. Account Security
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You
            agree to notify us immediately of any unauthorized use of your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            3. Use of Services
          </h2>
          <p>
            You agree not to use Aza for any unlawful or prohibited activities. We reserve the right
            to suspend or terminate your account if you violate these Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            4. Transactions
          </h2>
          <p>
            All transactions made through Aza are subject to our review. We may delay or cancel
            transactions that appear suspicious or violate our policies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            5. Changes to Terms
          </h2>
          <p>
            We may update these Terms from time to time. We will notify you of any material changes
            via the app or email. Continued use of Aza constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            6. Contact Us
          </h2>
          <p>
            If you have any questions about these Terms, please contact us at{' '}
            <a
              href="mailto:support@aza.systems"
              className="font-medium underline underline-offset-2"
              style={{ color: '#174717' }}
            >
              support@aza.systems
            </a>
            .
          </p>
        </div>
      </div>
    </LegalLayout>
  );
}
