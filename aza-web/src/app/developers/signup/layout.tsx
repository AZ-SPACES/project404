import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Developer Account | Aza",
  description: "Create a free Aza developer account to start building with the Aza API.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
