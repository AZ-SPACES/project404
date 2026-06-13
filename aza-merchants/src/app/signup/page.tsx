"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup } from "@/lib/merchant-api";
import { Loader2, Eye, EyeOff, Phone, Mail, User, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AuthSlideshow } from "@/components/auth-slideshow";

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrong = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordStrong) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signup({ firstName, lastName, email, phone, password });
      router.replace("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden h-full flex-col p-10 lg:flex overflow-hidden">
        <AuthSlideshow />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25" />
        <img src="/logo.png" alt="AZA Merchants" className="mr-auto h-7 w-auto relative z-10" />
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl text-white">
              &ldquo;Start accepting payments in minutes. No paperwork, no delays — just results.&rdquo;
            </p>
            <footer className="font-mono font-semibold text-sm text-white/50">
              ~ AZA Merchants
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right panel */}
      <div className="relative flex min-h-screen flex-col justify-center px-8 py-10">
        <ThemeToggle className="absolute top-5 right-5 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
        {/* Ambient shades */}
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
        >
          <div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
          <div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
        </div>

        <div className="mx-auto space-y-5 sm:w-sm">
          {/* Mobile logo */}
          <img
            src="/logo.png"
            alt="AZA Merchants"
            className="h-7 w-auto lg:hidden"
          />

          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">Create your account</h1>
            <p className="text-base text-muted-foreground">
              Start accepting payments with AZA
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">First name</label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <User size={14} />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Kofi"
                  />
                </InputGroup>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Last name</label>
                <InputGroup>
                  <InputGroupInput
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Mensah"
                  />
                </InputGroup>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email address</label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Mail size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </InputGroup>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Phone number</label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Phone size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                />
              </InputGroup>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Lock size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </InputGroupAddon>
              </InputGroup>
              {password.length > 0 && !passwordStrong && (
                <p className="text-xs text-amber-400">Password must be at least 8 characters</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirm password</label>
              <InputGroup
                className={
                  confirmPassword.length > 0 && !passwordsMatch
                    ? "border-destructive/50 focus-within:border-destructive/70"
                    : ""
                }
              >
                <InputGroupAddon align="inline-start">
                  <Lock size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </InputGroupAddon>
              </InputGroup>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-[#B7EE7A] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
