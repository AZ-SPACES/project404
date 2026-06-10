import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Login | Aza",
  description: "Sign in to your Aza developer account to access the API Explorer and developer tools.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
