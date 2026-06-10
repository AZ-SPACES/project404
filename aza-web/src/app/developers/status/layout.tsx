import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status | Aza",
  description: "Live status of the Aza API, authentication, payments, and all platform services.",
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
