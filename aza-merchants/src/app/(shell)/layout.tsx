"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getMe, Merchant } from "@/lib/merchant-api";
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
    <div className="w-7 h-7 rounded-lg bg-[#10b981]/20 border border-[#10b981]/30 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-[#10b981]">{initials}</span>
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
    <aside className="flex flex-col h-full bg-[#161616] border-r border-white/5">
      {/* Logo + business name */}
      <div className="h-16 flex items-center px-4 border-b border-white/5 flex-shrink-0 gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">A</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {merchant?.businessName}
          </p>
          <p className="text-[10px] text-[#10b981] font-medium">merchants</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
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
                        ? "bg-[#10b981]/12 text-[#10b981]"
                        : "text-white/55 hover:text-white hover:bg-white/5"
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

      {/* Bottom: account + logout */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-1">
        {merchant && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <MerchantAvatar merchant={merchant} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">@{merchant.businessHandle}</p>
              <p className={`text-[10px] font-medium ${merchant.status === "ACTIVE" ? "text-[#10b981]" : "text-amber-400"}`}>
                {merchant.status === "ACTIVE" ? "Live" : "Suspended"}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white overflow-hidden">
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
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 lg:hidden flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold">
            aza <span className="text-[#10b981] text-xs font-normal">merchants</span>
          </span>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
