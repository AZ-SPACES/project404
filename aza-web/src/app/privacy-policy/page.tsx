import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | AZA',
  description: 'Privacy Policy for the AZA application.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">AZA Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <div className="prose prose-zinc max-w-none space-y-6 text-gray-700">
        <p>
          At AZA Financial Services Ltd, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
        </p>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">1. Information We Collect</h2>
          <p>
            We may collect personal information such as your name, email address, phone number, date of birth, and financial information when you register for an account or use our services.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">2. How We Use Your Information</h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, process transactions, communicate with you, and comply with legal obligations.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">3. Sharing Your Information</h2>
          <p>
            We do not sell your personal information. We may share your information with trusted third-party service providers to help us operate our business, or as required by law.
          </p>
        </div>
        
        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">4. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">5. Your Rights</h2>
          <p>
            You have the right to access, update, or delete your personal information. You can manage your privacy settings within the AZA app or contact our support team.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">6. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, please contact us through the Help &amp; Support section of the app.
          </p>
        </div>
      </div>
    </main>
  );
}
