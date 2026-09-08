import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CSSProperties } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Feeds the `--i` custom property that `.anim` multiplies into its transition-delay,
 * so a group of elements enters in sequence without a timeline or a JS tween.
 * Under `prefers-reduced-motion` the delay is dropped in CSS, not here.
 */
export function stagger(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}
