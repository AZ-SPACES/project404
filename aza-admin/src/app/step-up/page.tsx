"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStepUpStatus, submitStepUp, clearTokens, type StepUpStatus } from "@/lib/admin-api";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { DecorIcon } from "@/components/decor-icon";
import { ThemeToggle } from "@/components/theme-toggle";

function StepUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [status, setStatus] = useState<StepUpStatus | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getStepUpStatus()
      .then((s) => {
        if (s.elevated) {
          router.replace(next);
        } else {
          setStatus(s);
        }
      })
      .catch(() => {
        // No token or no staff role — back to login
        clearTokens();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitStepUp(status?.method === "TOTP" ? { code } : { password });
      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="space-y-4">
        <img src="/logo.png" alt="AZA Admin" className="h-7 w-auto" />
        <div className="space-y-1">
          <h1 className="font-bold text-2xl tracking-wide">Verify it&apos;s you</h1>
          <p className="text-base text-muted-foreground">
            {status.method === "TOTP"
              ? "Enter the code from your authenticator app to unlock the admin console."
              : "Re-enter your password to unlock the admin console."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {status.method === "TOTP" ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Authenticator code</label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <ShieldCheck size={14} />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="text-center tracking-[0.4em] text-lg font-mono"
              />
            </InputGroup>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Lock size={14} />
              </InputGroupAddon>
              <InputGroupInput
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </InputGroup>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Unlock admin console
        </Button>

        <button
          type="button"
          onClick={() => {
            clearTokens();
            router.replace("/login");
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
        >
          Sign in as a different account
        </button>
      </form>
    </div>
  );
}

export default function StepUpPage() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8 bg-background">
      <ThemeToggle className="absolute top-5 right-5 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className={cn(
          "relative flex w-full max-w-sm flex-col p-6 md:p-8",
          "dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.08),transparent)]"
        )}
      >
        <div className="absolute -inset-y-6 -left-px w-px bg-border" />
        <div className="absolute -inset-y-6 -right-px w-px bg-border" />
        <div className="absolute -inset-x-6 -top-px h-px bg-border" />
        <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
        <DecorIcon position="top-left" />
        <DecorIcon position="top-right" />
        <DecorIcon position="bottom-left" />
        <DecorIcon position="bottom-right" />

        <Suspense fallback={null}>
          <StepUpForm />
        </Suspense>
      </div>
    </div>
  );
}
