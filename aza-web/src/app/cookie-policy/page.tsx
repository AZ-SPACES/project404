import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | AZA',
  description: 'Cookie Policy for the AZA application.',
};

export default function CookiePolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Cookie Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

      <div className="prose prose-zinc max-w-none space-y-6 text-gray-700">
        <p>
          This Cookie Policy explains how AZA Financial Services Ltd ("we", "our", or "us") uses cookies and similar technologies when you visit our website or use our application.
        </p>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">1. What are cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device when you visit a website. They help the website remember your actions and preferences over a period of time, so you don't have to keep re-entering them.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">2. How we use cookies</h2>
          <p>
            We use cookies for various purposes, including:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Essential cookies:</strong> Required for the operation of our website and services.</li>
            <li><strong>Performance cookies:</strong> To analyze how our website is used and improve its performance.</li>
            <li><strong>Functional cookies:</strong> To remember your preferences and personalize your experience.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">3. Managing your cookie preferences</h2>
          <p>
            Most web browsers allow you to control cookies through their settings. However, if you disable essential cookies, some parts of our website may not function properly.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-medium text-gray-900 mb-3">4. Contact Us</h2>
          <p>
            If you have any questions about our use of cookies, please contact us through the Help &amp; Support section of our application.
          </p>
        </div>
      </div>
    </main>
  );
}
