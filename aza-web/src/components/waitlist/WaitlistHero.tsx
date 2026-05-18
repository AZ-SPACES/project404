"use client";

import { useState, useRef } from "react";
import { WaitlistBackground } from "./WaitlistBackground";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistSuccess } from "./WaitlistSuccess";
import { useConfetti } from "@/hooks/useConfetti";

type Status = "idle" | "loading" | "success";

export function WaitlistHero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fire } = useConfetti(canvasRef);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setTimeout(() => {
      setStatus("success");
      setEmail("");
      fire();
    }, 1500);
  };

  return (
    <div
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
      <div className="relative z-20 w-full flex flex-col items-center justify-end pb-16 md:pb-24 pt-40 md:pt-48 gap-6 px-4">
        {/* App icon */}
        <div
          className="w-16 h-16 rounded-2xl mb-2 ring-1 ring-white/10 flex items-center justify-center"
          style={{ backgroundColor: "#174717" }}
        >
          <span
            style={{
              color: "#B7EE7A",
              fontSize: "28px",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            A
          </span>
        </div>

        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-center tracking-tight"
          style={{ color: "#ffffff" }}
        >
          Send money.{" "}
          <span style={{ color: "#B7EE7A" }}>Effortlessly.</span>
        </h2>

        <p
          className="text-base md:text-lg font-medium text-center max-w-md"
          style={{ color: "#94a3b8" }}
        >
          Send and request money, chat with friends, scan QR codes, and access
          powerful mini-apps — all in one secure platform.
        </p>

        {/* Form container */}
        <div className="w-full max-w-md mt-4 h-[60px] relative">
          <canvas
            ref={canvasRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-50"
            aria-hidden="true"
          />
          <WaitlistSuccess show={status === "success"} />
          <WaitlistForm
            email={email}
            status={status}
            onChange={(e) => setEmail(e.target.value)}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
