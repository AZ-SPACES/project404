"use client";

import { useState, useRef } from "react";
import { WaitlistBackground } from "./WaitlistBackground";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistSuccess, WaitlistSharePrompt } from "./WaitlistSuccess";
import { useConfetti } from "@/hooks/useConfetti";
import { WAITLIST_COUNT_LABEL } from "@/lib/constants";
import Image from "next/image";
import azaZ from "../../app/assets/aza-z.png";

type Status = "idle" | "loading" | "success";

export function WaitlistHero() {
  const [email, setEmail]       = useState("");
  const [status, setStatus]     = useState<Status>("idle");
  const [error, setError]       = useState("");
  const [position, setPosition] = useState<number | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fire } = useConfetti(canvasRef);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || status === "loading") return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setPosition(typeof data.position === "number" ? data.position : undefined);
        setStatus("success");
        setEmail("");
        fire();
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "already_registered") {
          setError("You're already on the waitlist!");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        setStatus("idle");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStatus("idle");
    }
  };

  return (
    <div
      id="waitlist"
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: "#09090b", minHeight: "600px" }}
    >
      <WaitlistBackground />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, #09090b 10%, rgba(9,9,11,0.8) 40%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 w-full flex flex-col items-center justify-end pb-16 md:pb-24 pt-40 md:pt-48 gap-5 px-4">
        {/* App icon */}
        <Image
          src={azaZ}
          alt="Aza"
          className="w-16 h-16 rounded-2xl mb-2 ring-1 ring-white/10 object-cover"
        />

        <div
          className="inline-flex items-center gap-2 px-[14px] py-[6px] rounded-md text-[0.8rem] font-semibold"
          style={{
            background: "rgba(183,238,122,0.12)",
            border: "1px solid rgba(183,238,122,0.25)",
            color: "#B7EE7A",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 7, height: 7,
              background: "#B7EE7A",
              borderRadius: 999,
              animation: "badgePulse 2s infinite",
              flexShrink: 0,
            }}
          />
          Launching in Ghana
        </div>

        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-center tracking-tight"
          style={{ color: "#ffffff" }}
        >
          Get early access.{" "}
          <span style={{ color: "#B7EE7A" }}>Be first.</span>
        </h2>

        <p
          className="text-base md:text-lg font-medium text-center max-w-md"
          style={{ color: "#94a3b8" }}
        >
          Join the waitlist and be among the first to send money, chat with
          friends, and access the Aza Hub — all in one secure app.
        </p>

        {/* Social proof counter */}
        {status !== "success" && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["#174717", "#2B5EA7", "#C8102E", "#E60000"].map((bg, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[0.55rem] font-black"
                  style={{ background: bg, borderColor: "#09090b", color: "#ffffff" }}
                  aria-hidden="true"
                >
                  {["K", "A", "Y", "E"][i]}
                </div>
              ))}
            </div>
            <p className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              <span style={{ color: "#B7EE7A", fontWeight: 700 }}>{WAITLIST_COUNT_LABEL}</span> people already waiting
            </p>
          </div>
        )}

        {/* Form container */}
        <div className="w-full max-w-md mt-2 h-[60px] relative">
          <canvas
            ref={canvasRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-50"
            aria-hidden="true"
          />
          <WaitlistSuccess show={status === "success"} position={position} />
          <WaitlistForm
            email={email}
            status={status}
            onChange={(e) => setEmail(e.target.value)}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Share prompt — shown after signup */}
        <WaitlistSharePrompt show={status === "success"} position={position} />

        {/* Error message */}
        {error && status === "idle" && (
          <p
            className="text-sm text-center mt-1"
            style={{ color: "#f87171" }}
            role="alert"
          >
            {error}
          </p>
        )}

        {status !== "success" && (
          <p className="text-[0.75rem] text-center mt-1" style={{ color: "#4b5563" }}>
            No spam. Unsubscribe anytime.
          </p>
        )}
      </div>
    </div>
  );
}
