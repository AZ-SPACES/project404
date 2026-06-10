import React from 'react';
import { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: 'Compliance | Aza',
  description: 'Learn about Aza\'s regulatory compliance, licensing, and data protection standards.',
  alternates: { canonical: '/compliance' },
};

export default function CompliancePage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--aza-text)' }}>
        Compliance &amp; Regulation
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--aza-text-secondary)' }}>
        Last updated:{' '}
        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <div className="space-y-6 text-[0.95rem] leading-[1.7]" style={{ color: 'var(--aza-text-secondary)' }}>
        <p>
          At AZA Financial Services Ltd, compliance and security are at the core of everything we
          do. We operate within the legal and regulatory frameworks of the jurisdictions we serve to
          ensure the safety of our users&apos; funds and data.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            1. Regulatory Oversight
          </h2>
          <p>
            Aza is committed to adhering strictly to anti-money laundering (AML) and
            counter-terrorist financing (CTF) regulations globally. We work closely with regulatory
            bodies to maintain the highest standards of financial compliance.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            2. KYC &amp; Verification
          </h2>
          <p>
            To prevent fraud and illicit activities, we implement robust Know Your Customer (KYC)
            procedures. All users must verify their identity before gaining full access to our
            financial services.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            3. Data Protection
          </h2>
          <p>
            We comply with major data protection regulations (such as GDPR where applicable) to
            safeguard your personal and financial information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            4. Licensing
          </h2>
          <p>
            Aza operates under specific local financial licenses depending on your region. Details
            regarding regional licenses can be provided upon request through our legal department.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            5. Contact Our Compliance Team
          </h2>
          <p>
            If you have questions regarding our regulatory standing or compliance practices, please
            contact us at{' '}
            <a
              href="mailto:legal@aza.systems"
              className="font-medium underline underline-offset-2"
              style={{ color: '#174717' }}
            >
              legal@aza.systems
            </a>
            .
          </p>
        </div>
      </div>
    </LegalLayout>
  );
}
