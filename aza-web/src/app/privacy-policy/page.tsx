import React from 'react';
import { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | Aza',
  description: 'Privacy Policy for the Aza application.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--aza-text)' }}>
        Aza Privacy Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--aza-text-secondary)' }}>
        Last updated:{' '}
        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <div className="space-y-6 text-[0.95rem] leading-[1.7]" style={{ color: 'var(--aza-text-secondary)' }}>
        <p>
          At AZA Financial Services Ltd, we take your privacy seriously. This Privacy Policy explains
          how we collect, use, disclose, and safeguard your information when you use our mobile
          application and related services.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            1. Information We Collect
          </h2>
          <p>
            We may collect personal information such as your name, email address, phone number, date
            of birth, and financial information when you register for an account or use our services.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            2. How We Use Your Information
          </h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, process
            transactions, communicate with you, and comply with legal obligations.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            3. Sharing Your Information
          </h2>
          <p>
            We do not sell your personal information. We may share your information with trusted
            third-party service providers to help us operate our business, or as required by law.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            4. Data Security
          </h2>
          <p>
            We implement industry-standard security measures to protect your personal information
            from unauthorized access, alteration, disclosure, or destruction.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            5. Your Rights
          </h2>
          <p>
            You have the right to access, update, or delete your personal information. You can manage
            your privacy settings within the Aza app or contact our support team.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            6. Contact Us
          </h2>
          <p>
            If you have questions or concerns about this Privacy Policy, please contact us at{' '}
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
