import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compliance | AZA',
  description: 'Compliance information for AZA.',
};

export default function CompliancePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Compliance &amp; Regulation</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <div className="prose prose-zinc max-w-none space-y-6 text-gray-700">
        <p>
          At AZA Financial Services Ltd, compliance and security are at the core of everything we do. We operate within the legal and regulatory frameworks of the jurisdictions we serve to ensure the safety of our users' funds and data.
        </p>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">1. Regulatory Oversight</h2>
          <p>
            AZA is committed to adhering strictly to anti-money laundering (AML) and counter-terrorist financing (CTF) regulations globally. We work closely with regulatory bodies to maintain the highest standards of financial compliance.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">2. KYC &amp; Verification</h2>
          <p>
            To prevent fraud and illicit activities, we implement robust Know Your Customer (KYC) procedures. All users must verify their identity before gaining full access to our financial services.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">3. Data Protection</h2>
          <p>
            We comply with major data protection regulations (such as GDPR where applicable) to safeguard your personal and financial information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">4. Licensing</h2>
          <p>
            Depending on your region, AZA operates under specific local financial licenses. Details regarding regional licenses can be provided upon request through our legal department.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">5. Contact Our Compliance Team</h2>
          <p>
            If you have questions regarding our regulatory standing or compliance practices, please contact us through the Help &amp; Support section of the app.
          </p>
        </div>
      </div>
    </main>
  );
}
