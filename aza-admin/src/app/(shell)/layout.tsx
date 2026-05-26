"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens } from "@/lib/admin-api";
import { SupportWsProvider, useSupportWs } from "@/lib/support-ws-context";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Headset,
  ArrowLeftRight,
  LogOut,
  Menu,
  Wallet,
  BarChart3,
  ScrollText,
  Bell,
  AlertTriangle,
  Scale,
  FileBarChart2,
  Settings,
  Coins,
  MessageSquare,
  Store,
  Flag,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch?: boolean;
  badge?: "inbox";
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "User Management",
    items: [
      { href: "/kyc", label: "KYC Review", icon: ShieldCheck, exactMatch: true },
      { href: "/kyc-analytics", label: "KYC Analytics", icon: BarChart3 },
      { href: "/users", label: "Users", icon: Users },
      { href: "/wallets", label: "Wallets", icon: Wallet },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/merchants", label: "Merchants", icon: Store },
      { href: "/miniapps", label: "Mini App Reports", icon: Flag },
      { href: "/disputes", label: "Disputes", icon: Scale },
      { href: "/fees", label: "Fee Management", icon: Coins },
      { href: "/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Compliance & Risk",
    items: [
      { href: "/compliance", label: "Compliance / AML", icon: ShieldCheck },
      { href: "/risk", label: "Risk Management", icon: AlertTriangle },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support", label: "Inbox", icon: Headset, exactMatch: true, badge: "inbox" },
      { href: "/support/analytics", label: "Analytics", icon: MessageSquare },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "System Settings", icon: Settings },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

function isActive(href: string, pathname: string, exactMatch?: boolean): boolean {
  if (exactMatch) return pathname === href;
  if (href === "/kyc") return pathname === "/kyc" || pathname.startsWith("/kyc/");
  if (href === "/support") return pathname === "/support";
  return pathname.startsWith(href);
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const { unreadCount } = useSupportWs();

  useEffect(() => {
    const token = localStorage.getItem("aza_admin_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  if (!ready) return null;

  const sidebar = (
    <aside className="flex flex-col h-full bg-[#161616] border-r border-white/5">
      <div className="h-16 flex items-center px-6 border-b border-white/5 flex-shrink-0">
        <span className="text-xl font-semibold tracking-tight">
          aza{" "}
          <span className="text-[#F5A623] text-xs font-normal ml-1">admin</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, exactMatch, badge }) => {
                const active = isActive(href, pathname, exactMatch);
                const showBadge = badge === "inbox" && unreadCount > 0 && !active;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? "bg-[#F5A623]/15 text-[#F5A623]"
                        : "text-white/55 hover:text-white hover:bg-white/5"
                      }
                    `}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F5A623] text-black text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
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
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0">
        {sidebar}
      </div>

      {/* Mobile overlay sidebar */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
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
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 lg:hidden flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
            )}
          </button>
          <span className="text-sm font-semibold tracking-tight">
            aza <span className="text-[#F5A623]">admin</span>
          </span>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportWsProvider>
      <ShellContent>{children}</ShellContent>
    </SupportWsProvider>
  );
}
