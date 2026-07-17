"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const categories = [
  { key: "all",           label: "All"           },
  { key: "Business",      label: "Business"      },
  { key: "Finance",       label: "Finance"       },
  { key: "Games",         label: "Games"         },
  { key: "Entertainment", label: "Entertainment" },
  { key: "Productivity",  label: "Productivity"  },
];

const apps = [
  { id: "aza_business", name: "Aza Business",    desc: "Accept payments, manage payouts and API keys.", icon: "/hub-apps/aza-business.png", category: "Business",      featured: true  },
  { id: "aza_dev",      name: "AZA Developer",   desc: "Manage OAuth apps and Sign in with AZA.",      icon: "/hub-apps/aza-developer.png", category: "Business",     featured: false },
  { id: "cedirates",    name: "CediRates",        desc: "Live exchange rates and fuel prices.",          icon: "/hub-apps/cedirates.png",     category: "Finance",      featured: false },
  { id: "2048",         name: "2048",             desc: "Join the numbers and get to 2048!",             icon: "/hub-apps/2048.png",          category: "Games",        featured: false },
  { id: "snake",        name: "Snake",            desc: "Eat apples, grow your snake.",                  icon: "/hub-apps/snakegame.png",     category: "Games",        featured: false },
  { id: "connect4",     name: "Connect 4",        desc: "Connect 4 in a row to win!",                   icon: "/hub-apps/connect4.png",      category: "Games",        featured: false },
  { id: "sm",           name: "Salifu & Master",  desc: "Play Salifu and Master.",                      icon: "/hub-apps/sm.png",            category: "Games",        featured: false },
  { id: "radio",        name: "Radio",            desc: "Listen to live radio stations.",               icon: "/hub-apps/radio.png",         category: "Entertainment", featured: false },
  { id: "notepad",      name: "Notepad",          desc: "Take notes quickly inside Aza.",               icon: "/hub-apps/notepad.png",       category: "Productivity",  featured: false },
];

export function HubSection() {
  const [activeCat, setActiveCat] = useState("all");
  const filtered = apps.filter((a) => activeCat === "all" || a.category === activeCat);
  const featured = filtered.find((a) => a.featured) ?? filtered[0];
  const rest = filtered.filter((a) => a.id !== featured?.id);

  return (
    <section id="hub" className="apple-white section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        {/* Centered heading */}
        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Mini apps.<br />
            <span style={{ color: "#6e6e73" }}>Built right in.</span>
          </h2>
          <p className="apple-body max-w-[420px] mx-auto" style={{ color: "#6e6e73" }}>
            Games, tools, and services — no installs, no new accounts, no switching apps.
          </p>
          <Link
            href="/mini-apps"
            className="inline-flex items-center gap-1.5 mt-4 text-[0.85rem] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "#174717" }}
          >
            See what&apos;s inside
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap justify-center mb-8 reveal" role="tablist" aria-label="App categories">
          {categories.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={activeCat === c.key}
              onClick={() => setActiveCat(c.key)}
              className="px-4 py-1.5 rounded-lg text-[0.8rem] font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.97]"
              style={{
                background: activeCat === c.key ? "#1d1d1f" : "rgba(0,0,0,0.05)",
                color: activeCat === c.key ? "#ffffff" : "#6e6e73",
                border: "1px solid " + (activeCat === c.key ? "transparent" : "rgba(0,0,0,0.08)"),
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Featured spotlight */}
        {featured && (
          <div
            className="reveal rounded-2xl p-5 flex gap-4 items-center mb-6"
            style={{ background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md">
              <Image src={featured.icon} alt={featured.name} width={56} height={56} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[0.9rem] font-semibold" style={{ color: "#1d1d1f", letterSpacing: "-0.01em" }}>{featured.name}</span>
                <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold" style={{ background: "rgba(23,71,23,0.1)", color: "#174717" }}>Featured</span>
              </div>
              <p className="text-[0.8rem]" style={{ color: "#6e6e73" }}>{featured.desc}</p>
            </div>
            <span className="text-[0.75rem]" style={{ color: "#6e6e73" }}>{featured.category}</span>
          </div>
        )}

        {/* App grid */}
        <ul role="list" className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))" }}>
          {rest.map((app) => (
            <li key={app.id} className="hub-app flex flex-col items-center gap-2 group">
              <div className="hub-app__icon-wrap w-14 h-14 rounded-2xl overflow-hidden shadow-sm transition-transform duration-200 group-hover:scale-105">
                <Image src={app.icon} alt={app.name} width={56} height={56} className="w-full h-full object-cover" />
              </div>
              <span className="text-[0.72rem] font-medium text-center leading-tight" style={{ color: "#6e6e73" }}>
                {app.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
