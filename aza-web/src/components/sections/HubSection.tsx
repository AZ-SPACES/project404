"use client";

import { useState, type ReactNode } from "react";
import {
  TrendingUp, BarChart3, PiggyBank,
  Zap, Wifi, Droplets, Tv,
  Clapperboard, Music, Gamepad2, Newspaper,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

const categories = [
  { key: "all",           label: "All"               },
  { key: "finance",       label: "Finance"           },
  { key: "bills",         label: "Bills & Utilities"  },
  { key: "entertainment", label: "Entertainment"     },
];

const apps: { cat: string; icon: ReactNode; bg: string; name: string }[] = [
  { cat: "finance",       icon: <TrendingUp    size={28} color="#fff" />, bg: "#174717", name: "Invest"      },
  { cat: "finance",       icon: <BarChart3     size={28} color="#fff" />, bg: "#1A5C1A", name: "Analytics"   },
  { cat: "finance",       icon: <PiggyBank     size={28} color="#fff" />, bg: "#2E7D32", name: "Savings"     },
  { cat: "bills",         icon: <Zap           size={28} color="#fff" />, bg: "#4285F4", name: "Electricity" },
  { cat: "bills",         icon: <Wifi          size={28} color="#fff" />, bg: "#1565C0", name: "Internet"    },
  { cat: "bills",         icon: <Droplets      size={28} color="#fff" />, bg: "#0288D1", name: "Water"       },
  { cat: "bills",         icon: <Tv            size={28} color="#fff" />, bg: "#F57C00", name: "Cable TV"    },
  { cat: "entertainment", icon: <Clapperboard  size={28} color="#fff" />, bg: "#E53935", name: "Movies"      },
  { cat: "entertainment", icon: <Music         size={28} color="#fff" />, bg: "#8E24AA", name: "Music"       },
  { cat: "entertainment", icon: <Gamepad2      size={28} color="#fff" />, bg: "#C62828", name: "Gaming"      },
  { cat: "entertainment", icon: <Newspaper     size={28} color="#fff" />, bg: "#AD1457", name: "News"        },
];

export function HubSection() {
  const [activeCat, setActiveCat] = useState("all");
  const visible = apps.filter((a) => activeCat === "all" || a.cat === activeCat);

  return (
    <section id="hub" className="section-py" style={{ background: "var(--aza-bg)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <SectionHeader
          label="The Aza Hub"
          heading="Your financial command center"
          description="Access a curated marketplace of mini-apps for finance, bills, and entertainment — without switching apps."
        />

        {/* Category filters */}
        <div className="flex gap-2 justify-center flex-wrap mb-8" role="tablist" aria-label="App categories">
          {categories.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={activeCat === c.key}
              onClick={() => setActiveCat(c.key)}
              className="px-4 md:px-5 py-2 rounded-lg text-[0.875rem] font-semibold transition-colors"
              style={{
                background: activeCat === c.key ? "#174717" : "transparent",
                color: activeCat === c.key ? "#fff" : "var(--aza-text-secondary)",
                border: `1.5px solid ${activeCat === c.key ? "#174717" : "var(--aza-border)"}`,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* App grid */}
        <div
          className="grid gap-4 max-w-[800px] mx-auto"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}
        >
          {visible.map((app) => (
            <div key={app.name} className="hub-app flex flex-col items-center gap-2 cursor-pointer">
              <div
                className="hub-app__icon-wrap w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: app.bg }}
              >
                {app.icon}
              </div>
              <span className="text-[0.75rem] md:text-[0.8rem] font-semibold text-center" style={{ color: "var(--aza-text)" }}>
                {app.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
