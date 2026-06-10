"use client";

import { useState } from "react";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";

const categories = [
  { key: "all",           label: "All"               },
  { key: "Business",      label: "Business"          },
  { key: "Finance",       label: "Finance"           },
  { key: "Games",         label: "Games"             },
  { key: "Entertainment", label: "Entertainment"     },
  { key: "Productivity",  label: "Productivity"      },
];

const apps = [
  {
    id: "aza_business",
    name: "Aza Business",
    desc: "Accept payments, manage payouts and API keys",
    icon: "/hub-apps/aza-business.png",
    category: "Business",
  },
  {
    id: "aza_developer",
    name: "AZA Developer",
    desc: "Manage OAuth apps and Sign in with AZA",
    icon: "/hub-apps/aza-developer.png",
    category: "Business",
  },
  {
    id: "cedirates",
    name: "CediRates",
    desc: "Live exchange rates and fuel prices",
    icon: "/hub-apps/cedirates.png",
    category: "Finance",
  },
  {
    id: "play_2048",
    name: "2048",
    desc: "Join the numbers and get to the 2048 tile!",
    icon: "/hub-apps/2048.png",
    category: "Games",
  },
  {
    id: "snake",
    name: "Snake",
    desc: "Eat apples, grow your snake, avoid crashing!",
    icon: "/hub-apps/snakegame.png",
    category: "Games",
  },
  {
    id: "connect4",
    name: "Connect 4",
    desc: "Connect 4 in a row to win!",
    icon: "/hub-apps/connect4.png",
    category: "Games",
  },
  {
    id: "sm",
    name: "Salifu & Master",
    desc: "Play Salifu and Master",
    icon: "/hub-apps/sm.png",
    category: "Games",
  },
  {
    id: "radio",
    name: "Radio",
    desc: "Listen to live radio stations",
    icon: "/hub-apps/radio.png",
    category: "Entertainment",
  },
  {
    id: "notepad",
    name: "Notepad",
    desc: "Take notes quickly inside Aza",
    icon: "/hub-apps/notepad.png",
    category: "Productivity",
  },
];

export function HubSection() {
  const [activeCat, setActiveCat] = useState("all");
  const visible = apps.filter((a) => activeCat === "all" || a.category === activeCat);

  return (
    <section id="hub" className="section-py" style={{ background: "var(--aza-bg)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <SectionHeader
          label="The Aza Hub"
          heading="Mini apps built into Aza"
          description="Games, tools, and services — all running inside the app. No installs, no switching."
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
        <ul
          role="list"
          className="grid gap-6 max-w-[800px] mx-auto"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
        >
          {visible.map((app) => (
            <li key={app.id} className="hub-app flex flex-col items-center gap-2 group">
              <div
                className="hub-app__icon-wrap w-16 h-16 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden shadow-md transition-transform group-hover:scale-105"
                aria-label={`${app.name} — ${app.desc}`}
              >
                <Image
                  src={app.icon}
                  alt=""
                  width={72}
                  height={72}
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className="text-[0.75rem] md:text-[0.8rem] font-semibold text-center leading-tight"
                style={{ color: "var(--aza-text)" }}
              >
                {app.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
