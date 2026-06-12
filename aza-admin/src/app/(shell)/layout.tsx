"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getStoredRoles, hasRole, type StaffRoleName } from "@/lib/admin-api";
import { SupportWsProvider, useSupportWs } from "@/lib/support-ws-context";
import { ThemeToggle } from "@/components/theme-toggle";
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
  ShieldAlert,
  PieChart,
  Scale,
  FileBarChart2,
  Settings,
  Coins,
  MessageSquare,
  Store,
  Flag,
  TrendingUp,
  Users2,
  X,
  KeyRound,
  Megaphone,
  ClipboardCheck,
  FileSearch,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch?: boolean;
  badge?: "inbox";
  /** Staff roles that can use this area (mirrors backend @PreAuthorize). ADMIN always passes. */
  roles?: StaffRoleName[];
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
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck, roles: ["FINANCE", "COMPLIANCE"] },
    ],
  },
  {
    label: "User Management",
    items: [
      { href: "/kyc", label: "KYC Review", icon: ShieldCheck, exactMatch: true, roles: ["COMPLIANCE"] },
      { href: "/kyc-analytics", label: "KYC Analytics", icon: BarChart3, roles: ["COMPLIANCE"] },
      { href: "/users", label: "Users", icon: Users, roles: ["SUPPORT", "COMPLIANCE"] },
      { href: "/wallets", label: "Wallets", icon: Wallet, roles: ["FINANCE"] },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/merchants", label: "Merchants", icon: Store, roles: ["FINANCE", "COMPLIANCE"] },
      { href: "/kyb-review", label: "KYB Review", icon: ShieldCheck, roles: ["FINANCE", "COMPLIANCE"] },
      { href: "/miniapps", label: "Mini App Reports", icon: Flag, roles: ["ADMIN"] },
      { href: "/oauth-apps", label: "OAuth Apps", icon: KeyRound, roles: ["ADMIN"] },
      { href: "/disputes", label: "Disputes", icon: Scale, roles: ["SUPPORT", "FINANCE"] },
      { href: "/limit-requests", label: "Limit Requests", icon: TrendingUp, roles: ["COMPLIANCE"] },
      { href: "/fees", label: "Fee Management", icon: Coins, roles: ["FINANCE"] },
      { href: "/reports", label: "Reports", icon: FileBarChart2, roles: ["FINANCE"] },
      { href: "/reconciliation", label: "Reconciliation", icon: Scale, roles: ["FINANCE"] },
    ],
  },
  {
    label: "Compliance & Risk",
    items: [
      { href: "/compliance", label: "Compliance / AML", icon: ShieldCheck, roles: ["COMPLIANCE"] },
      { href: "/risk", label: "Risk Management", icon: AlertTriangle, roles: ["COMPLIANCE"] },
      { href: "/fraud-detection", label: "Fraud Detection", icon: ShieldAlert, roles: ["COMPLIANCE"] },
      { href: "/screening", label: "Sanctions Screening", icon: ShieldAlert, roles: ["COMPLIANCE"] },
      { href: "/filings", label: "Filings & Exports", icon: FileBarChart2, roles: ["COMPLIANCE", "FINANCE"] },
      { href: "/data-requests", label: "Data Requests", icon: FileSearch, roles: ["COMPLIANCE", "SUPPORT"] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/analytics/revenue", label: "Revenue", icon: TrendingUp, roles: ["FINANCE"] },
      { href: "/analytics/cohorts", label: "Cohort Retention", icon: Users2, roles: ["FINANCE"] },
      { href: "/analytics/spending", label: "Spending", icon: PieChart, roles: ["FINANCE"] },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support", label: "Inbox", icon: Headset, exactMatch: true, badge: "inbox", roles: ["SUPPORT"] },
      { href: "/support/analytics", label: "Analytics", icon: MessageSquare, roles: ["SUPPORT"] },
      { href: "/complaints", label: "Complaints", icon: MessageSquare, roles: ["SUPPORT"] },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, roles: ["ADMIN"] },
      { href: "/staff", label: "Staff & Roles", icon: Users2, roles: ["ADMIN"] },
      { href: "/settings", label: "System Settings", icon: Settings, roles: ["ADMIN"] },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText, roles: ["COMPLIANCE"] },
    ],
  },
];

function isActive(href: string, pathname: string, exactMatch?: boolean): boolean {
  if (exactMatch) return pathname === href;
  if (href === "/kyc") return pathname === "/kyc" || pathname.startsWith("/kyc/");
  if (href === "/kyb-review") return pathname === "/kyb-review" || pathname.startsWith("/kyb-review/");
  if (href === "/support") return pathname === "/support";
  return pathname.startsWith(href);
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [roles, setRoles] = useState<StaffRoleName[]>([]);
  const { unreadCount } = useSupportWs();

  useEffect(() => {
    const token = localStorage.getItem("aza_admin_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setRoles(getStoredRoles());
    // eslint-disable-next-line
    setReady(true);
  }, [router]);

  // Hide nav areas this staff member's roles can't use. Unknown roles (sessions
  // from before staff roles existed) see everything; the backend still enforces.
  function canSee(item: NavItem): boolean {
    if (!item.roles || roles.length === 0) return true;
    return hasRole(roles, item.roles);
  }

  const visibleSections = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter(canSee) }))
    .filter((section) => section.items.length > 0);

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  if (!ready) return null;

  const sidebar = (
    <aside className="flex flex-col h-full bg-card border-r border-border">
      <div className="h-16 flex items-center px-6 border-b border-border flex-shrink-0">
        <img src="/logo.png" alt="Aza Admin" className="h-6 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
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
                        ? "bg-[#B7EE7A]/15 text-[#B7EE7A]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }
                    `}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#B7EE7A] text-black text-[10px] font-bold flex items-center justify-center">
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

      <div className="p-3 border-t border-border flex-shrink-0 space-y-1">
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
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 border-b border-border lg:hidden flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Menu size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#B7EE7A]" />
            )}
          </button>
          <img src="/logo.png" alt="Aza Admin" className="h-6 w-auto" />
          <ThemeToggle className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
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
