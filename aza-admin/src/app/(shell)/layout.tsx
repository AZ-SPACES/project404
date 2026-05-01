"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens } from "@/lib/admin-api";
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
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kyc", label: "KYC Review", icon: ShieldCheck },
  { href: "/kyc-analytics", label: "KYC Analytics", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/support", label: "Support", icon: Headset },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
];

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

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

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#161616] border-r border-white/5 flex flex-col
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <span className="text-xl font-semibold tracking-tight">
            aza{" "}
            <span className="text-[#F5A623] text-xs font-normal ml-1">
              admin
            </span>
          </span>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/kyc"
                ? pathname === "/kyc" || pathname.startsWith("/kyc/")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    active
                      ? "bg-[#F5A623]/15 text-[#F5A623]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="text-white/60 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-medium">aza admin</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
