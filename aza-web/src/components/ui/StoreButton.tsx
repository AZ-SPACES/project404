"use client";

import { useState } from "react";

interface StoreButtonProps {
  children: React.ReactNode;
  label: string;
}

export function StoreButton({ children, label }: StoreButtonProps) {
  const [feedback, setFeedback] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (feedback) return;
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1000);
  };

  return (
    <a href="#" aria-label={label} onClick={handleClick} className="store-btn relative">
      {children}
      {feedback && (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-xl text-white font-bold text-[0.9rem]"
          style={{ background: "rgba(23,71,23,0.95)" }}
        >
          Coming soon!
        </span>
      )}
    </a>
  );
}
