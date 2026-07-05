import type Lenis from "lenis";

// Shared handle to the single Lenis instance created in <SmoothScroll />.
// The cinematic splash uses this to stop()/start() Lenis while it's on screen —
// body { overflow: hidden } alone doesn't lock Lenis (it drives the wheel on
// window), so without this the page scrolls behind the overlay.
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};

export const getLenis = () => instance;
