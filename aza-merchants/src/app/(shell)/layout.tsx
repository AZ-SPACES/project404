"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getMe, Merchant } from "@/lib/merchant-api";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Link2,
  Key,
  Webhook,
  ArrowDownToLine,
  Settings,
  LogOut,
  Menu,
  X,
  QrCode,
  Users,
  FileText,
  ShieldAlert,
  ClipboardList,
  UserCog,
  Repeat,
  Landmark,
  Tag,
  SendHorizonal,
  Bell,
  Code2,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Payments",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/payment-links", label: "Payment Links", icon: Link2 },
      { href: "/store-qr", label: "Store QR", icon: QrCode },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/bulk-transfers", label: "Bulk Transfers", icon: SendHorizonal },
      { href: "/payouts", label: "Payouts", icon: ArrowDownToLine },
      { href: "/settlements", label: "Settlements", icon: Landmark },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/disputes", label: "Disputes", icon: ShieldAlert },
      { href: "/discount-codes", label: "Discount Codes", icon: Tag },
      { href: "/plans", label: "Plans & Subscriptions", icon: Repeat },
    ],
  },
  {
    label: "Developer",
    items: [
      { href: "/api-keys", label: "API Keys", icon: Key },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/embed", label: "Embed Widget", icon: Code2 },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/team", label: "Team", icon: UserCog },
      { href: "/audit-logs", label: "Audit Log", icon: ClipboardList },
      { href: "/notification-preferences", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function MerchantAvatar({ merchant }: { merchant: Merchant }) {
  if (merchant.logoUrl) {
    return (
      <img
        src={merchant.logoUrl}
        alt={merchant.businessName}
        className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
      />
    );
  }
  const initials = merchant.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-7 h-7 rounded-lg bg-[#B7EE7A]/20 border border-[#B7EE7A]/30 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-[#B7EE7A]">{initials}</span>
    </div>
  );
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aza_merchant_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe()
      .then((me) => {
        if (!me || (me.status !== "ACTIVE" && me.status !== "SUSPENDED")) {
          if (!me || me.status === "PENDING_KYB") {
            router.replace("/onboarding");
          } else {
            router.replace("/onboarding/status");
          }
          return;
        }
        setMerchant(me);
        setReady(true);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  if (!ready) return null;

  const sidebar = (
    <aside className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo + business name */}
      <div className="h-16 flex items-center px-4 border-b border-border flex-shrink-0 gap-2.5">
        <img src="/logo.png" alt="Aza Merchants" className="h-6 w-auto flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {merchant?.businessName}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? "bg-[#B7EE7A]/12 text-[#B7EE7A]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }
                    `}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: theme toggle + account + logout */}
      <div className="p-3 border-t border-border flex-shrink-0 space-y-1">
        {merchant && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <MerchantAvatar merchant={merchant} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">@{merchant.businessHandle}</p>
              <p className={`text-[10px] font-medium ${merchant.status === "ACTIVE" ? "text-[#B7EE7A]" : "text-amber-400"}`}>
                {merchant.status === "ACTIVE" ? "Live" : "Suspended"}
              </p>
            </div>
          </div>
        )}
        <ThemeToggle className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-56 flex-shrink-0">{sidebar}</div>

      {/* Mobile overlay */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border lg:hidden flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="Aza Merchants" className="h-6 w-auto" />
          <ThemeToggle className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
