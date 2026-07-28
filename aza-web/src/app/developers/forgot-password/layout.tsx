import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Aza Developers",
  description: "Reset the password for your Aza developer account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
