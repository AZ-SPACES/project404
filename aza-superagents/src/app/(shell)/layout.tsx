"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Send,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { SessionProvider } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { ghs } from "@/lib/format";
import { ApiError, getMe, logout, type SuperAgentMe } from "@/lib/superagent-api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/distribute", label: "Move float", icon: Send },
  { href: "/distributions", label: "Ledger", icon: ArrowLeftRight },
  { href: "/agents", label: "My agents", icon: Users },
  { href: "/reconciliation", label: "Reconciliation", icon: Scale },
];

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<SuperAgentMe | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        // NONE / NOT_SUPER are entitlement answers, not errors — the account is simply not a
        // master agent, which gets an explanation rather than a bounce to the login page.
        setState(data.status === "ACTIVE" ? "ready" : "denied");
      })
      .catch((e) => {
        if (cancelled) return;
        // 401 already redirects inside the client; anything else is a real failure to show.
        if (!(e instanceof ApiError) || e.status !== 401) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The scrim is decorative, so Escape is what closes the mobile nav for anyone not using a
  // pointer. Bound only while it is open.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  /** Re-reads the profile after a float movement. A failure keeps the last good value rather
      than blanking the header — a stale figure beats no figure while the operator is working. */
  const refresh = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch {
      /* keep what we have */
    }
  }, []);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  if (state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (state === "denied") {
    return <NoAccess me={me} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X aria-hidden />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                // Closed here rather than in an effect on the path: the click is the event, and
                // an effect would fire on every navigation including ones the nav didn't cause.
                onClick={() => setNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/12 font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{me?.userName ?? "Master agent"}</p>
            <p className="tnum truncate text-xs text-muted-foreground">{me?.code ?? "—"}</p>
          </div>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={signOut}>
            <LogOut aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      {navOpen ? (
        // Decorative scrim. The close button in the sidebar is the announced control; giving
        // this one the same label would put two "Close navigation" buttons in the tree.
        <div
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Content */}
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu aria-hidden />
          </Button>
          <div className="ml-auto text-right">
            <p className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
              Available float
            </p>
            <p className="tnum text-sm font-semibold text-primary">{ghs(me?.floatBalance)}</p>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <SessionProvider value={{ me, refresh }}>{children}</SessionProvider>
        </main>
      </div>
    </div>
  );
}

/**
 * Shown to a signed-in account that is not an active master agent. It names the actual reason,
 * because "no access" alone leaves the person with nothing to do about it.
 */
function NoAccess({ me, onSignOut }: { me: SuperAgentMe | null; onSignOut: () => void }) {
  const reason =
    me?.status === "NOT_SUPER"
      ? "This account is a standard agent. Float distribution is available to master agents only — your AZA contact can upgrade the tier."
      : me?.status === "PENDING"
        ? "Your agent account is still under review. You'll be able to sign in here once it's approved."
        : me?.status === "SUSPENDED"
          ? "Your agent account is suspended. Contact support to restore access."
          : me?.status === "NONE"
            ? "This account isn't registered as an agent."
            : "We couldn't load your agent profile. Try again in a moment.";

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <Logo className="justify-center" />
        <h1 className="mt-8 text-xl font-semibold tracking-tight">No access to this portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
        <Button variant="outline" className="mt-6" onClick={onSignOut}>
          <LogOut aria-hidden />
          Sign out
        </Button>
      </div>
    </main>
  );
}
