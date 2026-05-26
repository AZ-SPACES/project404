import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
      <div className="text-center">
        <p className="text-5xl font-bold text-white/10 mb-4">404</p>
        <p className="text-white/50 text-sm mb-6">Page not found</p>
        <Link href="/dashboard" className="text-sm text-[#10b981] hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
