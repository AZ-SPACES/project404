import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-4xl font-medium tracking-tight text-white">404</h1>
        <p className="text-base text-neutral-400">
          The page you are looking for cannot be found.
        </p>
        <div className="pt-4 flex justify-center">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-colors border border-neutral-800 rounded-md hover:bg-neutral-900"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
