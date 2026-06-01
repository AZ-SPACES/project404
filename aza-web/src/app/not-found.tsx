import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-4xl font-medium tracking-tight">404</h1>
        <p className="text-base text-muted-foreground">
          The page you are looking for cannot be found.
        </p>
        <div className="pt-4 flex justify-center">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors border border-border rounded-md hover:bg-muted text-foreground"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
