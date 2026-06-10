"use client";

import { useState, useRef } from "react";
import { WaitlistBackground } from "./WaitlistBackground";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistSuccess } from "./WaitlistSuccess";
import { useConfetti } from "@/hooks/useConfetti";
import Image from "next/image";
import azaZ from "../../app/assets/aza-z.png";

type Status = "idle" | "loading" | "success";

export function WaitlistHero() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError]   = useState("");
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
          Soon available worldwide
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

        {/* Form container */}
        <div className="w-full max-w-md mt-2 h-[60px] relative">
          <canvas
            ref={canvasRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-50"
            aria-hidden="true"
          />
          <WaitlistSuccess show={status === "success"} />
          <WaitlistForm
            email={email}
            status={status}
            error={error}
            onChange={(e) => setEmail(e.target.value)}
            onSubmit={handleSubmit}
          />
        </div>

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

        <p className="text-[0.75rem] text-center mt-1" style={{ color: "#4b5563" }}>
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
