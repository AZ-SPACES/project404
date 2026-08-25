"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/states";
import {
  ApiError,
  login,
  pickTwoFactorMethod,
  sendTwoFactorCode,
  verifyLoginOtp,
  verifyTwoFactor,
} from "@/lib/superagent-api";

type Step =
  | { name: "credentials" }
  | { name: "otp" }
  | { name: "two_factor"; methods: string[]; defaultMethod: string | null; codeMethod: "EMAIL" | "SMS" | null };

/**
 * Sign-in. Three possible steps, driven by what the backend asks for: password, then an emailed
 * or texted login code for accounts that need one, then a second factor for accounts that have
 * one enabled. No factor is skipped for this portal — see the note in the login route.
 */
export default function LoginPage() {
  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function done() {
    // A full navigation, not a client push: the shell has to re-read the session cookie.
    window.location.href = "/dashboard";
  }

  async function advance(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not sign you in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const submitCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    void advance(async () => {
      const result = await login(identifier.trim(), password);
      if (result.status === "authenticated") return done();
      if (result.status === "otp_required") return setStep({ name: "otp" });

      const codeMethod = pickTwoFactorMethod(result.methods, result.defaultMethod);
      // EMAIL/SMS factors need the code dispatched; an authenticator already has one.
      if (codeMethod) await sendTwoFactorCode(codeMethod);
      setCode("");
      setStep({
        name: "two_factor",
        methods: result.methods,
        defaultMethod: result.defaultMethod,
        codeMethod,
      });
    });
  };

  const submitOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void advance(async () => {
      const result = await verifyLoginOtp(identifier.trim(), code.trim());
      if (result.status === "authenticated") return done();
      if (result.status === "two_factor_required") {
        const codeMethod = pickTwoFactorMethod(result.methods, result.defaultMethod);
        if (codeMethod) await sendTwoFactorCode(codeMethod);
        setCode("");
        setStep({
          name: "two_factor",
          methods: result.methods,
          defaultMethod: result.defaultMethod,
          codeMethod,
        });
        return;
      }
      setError("That code didn't work.");
    });
  };

  const submitTwoFactor = (e: React.FormEvent) => {
    e.preventDefault();
    void advance(async () => {
      const current = step as Extract<Step, { name: "two_factor" }>;
      const result = await verifyTwoFactor(code.trim(), current.codeMethod);
      if (result.status === "authenticated") return done();
      setError("That code didn't work.");
    });
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: the actual task. Kept narrow so the form is the only thing to look at. */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-rise">
          <Logo />

          {step.name === "credentials" ? (
            <>
              <h1 className="mt-10 text-2xl font-semibold tracking-tight">Sign in</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Master-agent access to your float and your network.
              </p>

              <form onSubmit={submitCredentials} className="mt-8 space-y-4">
                {error ? <ErrorNote message={error} /> : null}
                <Field label="Email or phone" htmlFor="identifier">
                  <Input
                    id="identifier"
                    name="identifier"
                    autoComplete="username"
                    autoFocus
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Continue
                  {busy ? null : <ArrowRight aria-hidden />}
                </Button>
              </form>
            </>
          ) : null}

          {step.name === "otp" ? (
            <>
              <h1 className="mt-10 text-2xl font-semibold tracking-tight">Check your messages</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We sent a 6-digit code to the contact on your account.
              </p>
              <form onSubmit={submitOtp} className="mt-8 space-y-4">
                {error ? <ErrorNote message={error} /> : null}
                <Field label="Login code" htmlFor="code">
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    className="tnum tracking-[0.4em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Verify
                </Button>
              </form>
            </>
          ) : null}

          {step.name === "two_factor" ? (
            <>
              <h1 className="mt-10 text-2xl font-semibold tracking-tight">One more step</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.codeMethod === "SMS"
                  ? "Enter the 6-digit code we texted you."
                  : step.codeMethod === "EMAIL"
                    ? "Enter the 6-digit code we emailed you."
                    : "Enter the 6-digit code from your authenticator app."}
              </p>
              <form onSubmit={submitTwoFactor} className="mt-8 space-y-4">
                {error ? <ErrorNote message={error} /> : null}
                <Field label="Verification code" htmlFor="twofactor">
                  <Input
                    id="twofactor"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    className="tnum tracking-[0.4em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Sign in
                </Button>
              </form>
            </>
          ) : null}

          <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Your session stays in an encrypted cookie — never in this page.
          </p>
        </div>
      </div>

      {/* Right: brand panel. Decorative only, so it is hidden from assistive tech and small screens. */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-l border-border bg-surface lg:block"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Float moves down.
            <br />
            <span className="text-primary">No margin, no delay.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Top up every till in your network from one balance, and see exactly where the cedis
            sat at the end of the day.
          </p>
        </div>
      </aside>
    </main>
  );
}
