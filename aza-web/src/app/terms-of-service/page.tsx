import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | AZA',
  description: 'Terms of Service for the AZA application.',
};

export default function TermsOfServicePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">AZA Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <div className="prose prose-zinc max-w-none space-y-6 text-gray-700">
        <p>
          Welcome to AZA. These Terms of Service (&quot;Terms&quot;) govern your use of the AZA mobile application and related services provided by AZA Financial Services Ltd (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). By using our services, you agree to these Terms.
        </p>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">1. Eligibility</h2>
          <p>
            You must be at least 18 years old to use our services. By using AZA, you represent and warrant that you meet this requirement.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">2. Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">3. Use of Services</h2>
          <p>
            You agree not to use AZA for any unlawful or prohibited activities. We reserve the right to suspend or terminate your account if you violate these Terms.
          </p>
        </div>
        
        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">4. Transactions</h2>
          <p>
            All transactions made through AZA are subject to our review. We may delay or cancel transactions that appear suspicious or violate our policies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">5. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of any material changes via the app or email. Continued use of AZA constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">6. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us through the Help &amp; Support section of the app.
          </p>
        </div>
      </div>
    </main>
  );
}
