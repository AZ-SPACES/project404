import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete your account — Aza',
  description:
    'Request permanent deletion of your Aza account and personal data without using the app.',
  robots: { index: true, follow: true },
};

export default function DeleteAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
