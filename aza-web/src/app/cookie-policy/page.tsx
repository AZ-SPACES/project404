import React from 'react';
import { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: 'Cookie Policy | Aza',
  description: 'Cookie Policy for the Aza application.',
};

export default function CookiePolicyPage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--aza-text)' }}>
        Cookie Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--aza-text-secondary)' }}>
        Last updated:{' '}
        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <div className="space-y-6 text-[0.95rem] leading-[1.7]" style={{ color: 'var(--aza-text-secondary)' }}>
        <p>
          This Cookie Policy explains how AZA Financial Services Ltd (&quot;we&quot;, &quot;our&quot;, or
          &quot;us&quot;) uses cookies and similar technologies when you visit our website or use our
          application.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            1. What are cookies?
          </h2>
          <p>
            Cookies are small text files that are stored on your device when you visit a website.
            They help the website remember your actions and preferences over a period of time, so you
            don&apos;t have to keep re-entering them.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            2. How we use cookies
          </h2>
          <p>We use cookies for various purposes, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong style={{ color: 'var(--aza-text)' }}>Essential cookies:</strong> Required for
              the operation of our website and services.
            </li>
            <li>
              <strong style={{ color: 'var(--aza-text)' }}>Performance cookies:</strong> To analyze
              how our website is used and improve its performance.
            </li>
            <li>
              <strong style={{ color: 'var(--aza-text)' }}>Functional cookies:</strong> To remember
              your preferences and personalize your experience.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            3. Managing your cookie preferences
          </h2>
          <p>
            Most web browsers allow you to control cookies through their settings. However, if you
            disable essential cookies, some parts of our website may not function properly.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--aza-text)' }}>
            4. Contact Us
          </h2>
          <p>
            If you have any questions about our use of cookies, please contact us at{' '}
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
