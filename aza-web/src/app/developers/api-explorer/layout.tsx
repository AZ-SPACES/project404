import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Explorer | Aza Developers",
  description: "Interactively explore and test the Aza REST API endpoints in your browser.",
};

export default function ApiExplorerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
