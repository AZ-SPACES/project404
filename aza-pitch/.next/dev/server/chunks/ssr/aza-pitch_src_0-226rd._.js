module.exports = [
"[project]/aza-pitch/src/components/deck/Deck.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Deck",
    ()=>Deck
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/components/deck/ThemeToggle.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/lib/utils.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const PREV_KEYS = new Set([
    "ArrowUp",
    "ArrowLeft",
    "PageUp"
]);
const NEXT_KEYS = new Set([
    "ArrowDown",
    "ArrowRight",
    "PageDown",
    " "
]);
function Deck({ slides, trackName, onExit, children }) {
    const scrollerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [hasNavigated, setHasNavigated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const goTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((index)=>{
        const clamped = Math.max(0, Math.min(slides.length - 1, index));
        const el = scrollerRef.current?.querySelectorAll("[data-slide]")[clamped];
        if (!el) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        /* Focus first, scroll second. A rail click leaves focus on the button and it
         has to come back so the next arrow key reaches the deck — but calling
         focus() *after* scrollIntoView aborts the smooth scroll it just started,
         which strands the deck on the slide it was leaving. */ scrollerRef.current?.focus({
            preventScroll: true
        });
        el.scrollIntoView({
            behavior: reduced ? "auto" : "smooth",
            block: "start"
        });
        setHasNavigated(true);
    }, [
        slides.length
    ]);
    /* Active-slide tracking. The observer is the only writer of `active`, so
     scrolling, keyboard jumps and rail clicks all converge on one code path
     instead of three that can disagree. */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const nodes = Array.from(scroller.querySelectorAll("[data-slide]"));
        const observer = new IntersectionObserver((entries)=>{
            let best = null;
            for (const entry of entries){
                if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
            }
            if (!best || best.intersectionRatio < 0.35) return;
            const index = nodes.indexOf(best.target);
            if (index >= 0) setActive(index);
            /* `is-live` is added and never removed. Replaying a 600ms stagger every
           time the presenter scrolls back to re-explain a slide reads as a
           glitch, not as polish. */ best.target.classList.add("is-live");
        }, {
            root: scroller,
            threshold: [
                0.35,
                0.6,
                0.9
            ]
        });
        for (const node of nodes)observer.observe(node);
        return ()=>observer.disconnect();
    }, []);
    /* The scroller owns keyboard navigation, so it has to actually hold focus.
     Without this the arrow keys depend on wherever focus happened to land — which
     is the document body on a cold load, but the theme toggle or a rail dot after
     any click, and nothing at all if the page is reached from browser chrome.
     `preventScroll` matters: focusing a snap container otherwise nudges it. */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        scrollerRef.current?.focus({
            preventScroll: true
        });
    }, []);
    /* Deep links: `/#unit-economics` opens on that slide. Done without setState so
     the observer above stays the single writer of `active`. */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const hash = window.location.hash.slice(1);
        if (!hash) return;
        const index = slides.findIndex((s)=>s.id === hash);
        if (index <= 0) return;
        scrollerRef.current?.querySelectorAll("[data-slide]")[index]?.scrollIntoView({
            behavior: "auto",
            block: "start"
        });
    }, [
        slides
    ]);
    /* Keep the address bar in step, but with replaceState — pushState here would
     make the browser Back button walk the deck backwards one slide at a time. */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const id = slides[active]?.id;
        if (!id) return;
        const url = new URL(window.location.href);
        url.hash = active === 0 ? "" : id;
        window.history.replaceState(null, "", url.toString());
    }, [
        active,
        slides
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        function onKeyDown(event) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target;
            if (target?.closest("input, textarea, select, [contenteditable]")) return;
            if (NEXT_KEYS.has(event.key)) {
                event.preventDefault();
                goTo(active + 1);
            } else if (PREV_KEYS.has(event.key)) {
                event.preventDefault();
                goTo(active - 1);
            } else if (event.key === "Home") {
                event.preventDefault();
                goTo(0);
            } else if (event.key === "End") {
                event.preventDefault();
                goTo(slides.length - 1);
            } else if (event.key === "Escape") {
                event.preventDefault();
                onExit();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return ()=>window.removeEventListener("keydown", onKeyDown);
    }, [
        active,
        goTo,
        onExit,
        slides.length
    ]);
    const meta = slides[active];
    const progress = slides.length > 1 ? active / (slides.length - 1) : 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "deck-chrome deck-chrome--top",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "deck-brand",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deck-wordmark",
                                children: "AZA"
                            }, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 147,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deck-brand-sep",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 148,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "deck-track",
                                onClick: onExit,
                                title: "Change track — Esc",
                                children: [
                                    trackName,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        "aria-hidden": "true",
                                        children: "⇅"
                                    }, void 0, false, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                        lineNumber: 156,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 149,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 146,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "deck-counter mono",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThemeToggle"], {}, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 161,
                                columnNumber: 11
                            }, this),
                            meta?.ref ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deck-ref",
                                children: meta.ref
                            }, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 162,
                                columnNumber: 24
                            }, this) : null,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    String(active + 1).padStart(2, "0"),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "dim",
                                        children: [
                                            " / ",
                                            String(slides.length).padStart(2, "0")
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                        lineNumber: 165,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 163,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 160,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 145,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "deck-rail",
                "aria-label": "Slides",
                children: slides.map((slide, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("deck-dot", i === active && "is-active"),
                        "aria-current": i === active ? "true" : undefined,
                        "aria-label": `Slide ${i + 1}: ${slide.label}`,
                        onClick: ()=>goTo(i),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deck-dot-mark",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 180,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deck-dot-label",
                                "aria-hidden": "true",
                                children: slide.label
                            }, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                                lineNumber: 181,
                                columnNumber: 13
                            }, this)
                        ]
                    }, slide.id, true, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 172,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "deck-progress",
                "aria-hidden": "true",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "deck-progress-fill",
                    style: {
                        transform: `scaleX(${progress})`
                    }
                }, void 0, false, {
                    fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                    lineNumber: 189,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 188,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "sr-only",
                role: "status",
                "aria-live": "polite",
                children: [
                    "Slide ",
                    active + 1,
                    " of ",
                    slides.length,
                    ": ",
                    meta?.label
                ]
            }, void 0, true, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["cn"])("deck-hint", (hasNavigated || active > 0) && "is-gone"),
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "mono",
                        children: "Scroll"
                    }, void 0, false, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 200,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "deck-hint-sep",
                        children: "or"
                    }, void 0, false, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 201,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("kbd", {
                        children: "←"
                    }, void 0, false, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 202,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("kbd", {
                        children: "→"
                    }, void 0, false, {
                        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                        lineNumber: 203,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 196,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "deck",
                ref: scrollerRef,
                tabIndex: -1,
                role: "region",
                "aria-label": `${trackName} deck`,
                children: children
            }, void 0, false, {
                fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
                lineNumber: 206,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/aza-pitch/src/components/deck/Deck.tsx",
        lineNumber: 144,
        columnNumber: 5
    }, this);
}
}),
"[project]/aza-pitch/src/components/deck/DeckShell.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DeckShell",
    ()=>DeckShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$Deck$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/components/deck/Deck.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$Gate$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/components/deck/Gate.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/lib/deck.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
/** Back/forward are the only navigation this page does not perform itself. */ function subscribe(onChange) {
    window.addEventListener("popstate", onChange);
    return ()=>window.removeEventListener("popstate", onChange);
}
function readTrackFromUrl() {
    const param = new URLSearchParams(window.location.search).get("track");
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isTrackId"])(param) ? param : null;
}
function DeckShell({ defence, investor, partner, academic }) {
    const urlTrack = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribe, readTrackFromUrl, ()=>null);
    const [chosen, setChosen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    /* An explicit in-session choice wins; the URL is what a cold visit reads. Both
     writes below use replaceState, so the snapshot is re-read on the next render
     without a popstate ever firing. */ const track = chosen ?? urlTrack;
    const choose = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((next)=>{
        setChosen(next);
        const url = new URL(window.location.href);
        url.searchParams.set("track", next);
        url.hash = "";
        window.history.replaceState(null, "", url.toString());
    }, []);
    const exit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setChosen(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("track");
        url.hash = "";
        window.history.replaceState(null, "", url.toString());
    }, []);
    if (!track) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$Gate$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Gate"], {
        onChoose: choose
    }, void 0, false, {
        fileName: "[project]/aza-pitch/src/components/deck/DeckShell.tsx",
        lineNumber: 64,
        columnNumber: 22
    }, this);
    const children = {
        defence,
        investor,
        partner,
        academic
    }[track];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$Deck$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Deck"], {
        slides: __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRACKS"][track].slides,
        trackName: __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRACKS"][track].name,
        onExit: exit,
        children: children
    }, track, false, {
        fileName: "[project]/aza-pitch/src/components/deck/DeckShell.tsx",
        lineNumber: 69,
        columnNumber: 5
    }, this);
}
}),
"[project]/aza-pitch/src/components/deck/Gate.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Gate",
    ()=>Gate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/lib/deck.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/components/deck/ThemeToggle.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/src/lib/utils.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function Gate({ onChoose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "gate is-live",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full max-w-[1180px] mx-auto",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-start justify-between gap-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "eyebrow anim anim-fade",
                            style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(0),
                            children: [
                                "AZA · ",
                                __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AUTHORS"]
                            ]
                        }, void 0, true, {
                            fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                            lineNumber: 20,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "anim anim-fade",
                            style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(0),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$components$2f$deck$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThemeToggle"], {}, void 0, false, {
                                fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                lineNumber: 24,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                            lineNumber: 23,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                    lineNumber: 19,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "display mt-7 anim",
                    style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(1),
                    children: [
                        "Same system. Four ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "accent",
                            children: "different arguments"
                        }, void 0, false, {
                            fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                            lineNumber: 29,
                            columnNumber: 29
                        }, this),
                        "."
                    ]
                }, void 0, true, {
                    fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                    lineNumber: 28,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "lede mt-5 anim",
                    style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(2),
                    children: "AZA is a mobile-first payments platform for Ghana — one ledger carrying a wallet, a chat, a merchant rail, an agent cash network and a developer platform. Pick who is in the room, and how long you have."
                }, void 0, false, {
                    fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                    lineNumber: 32,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    className: "gate-grid mt-12",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRACK_ORDER"].map((id, i)=>{
                        const track = __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$deck$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRACKS"][id];
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "anim",
                            style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(3 + i),
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "gate-card",
                                onClick: ()=>onChoose(id),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "eyebrow",
                                        children: track.promise
                                    }, void 0, false, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                        lineNumber: 44,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "gate-card-name",
                                        children: track.name
                                    }, void 0, false, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                        lineNumber: 45,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "body-sm gate-card-blurb",
                                        children: track.blurb
                                    }, void 0, false, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                        lineNumber: 46,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "gate-card-foot",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "mono text-[0.72rem] text-[var(--text-tertiary)]",
                                                children: track.duration
                                            }, void 0, false, {
                                                fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                                lineNumber: 48,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "gate-card-arrow",
                                                "aria-hidden": "true",
                                                children: "→"
                                            }, void 0, false, {
                                                fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                                lineNumber: 51,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                        lineNumber: 47,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                                lineNumber: 43,
                                columnNumber: 17
                            }, this)
                        }, id, false, {
                            fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                            lineNumber: 42,
                            columnNumber: 15
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "body-sm mt-10 anim",
                    style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stagger"])(7),
                    children: "Every figure in all four decks is drawn from the repository and the internal strategy documents, and each is dated. Nothing here is a projection presented as a measurement."
                }, void 0, false, {
                    fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
                    lineNumber: 61,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
            lineNumber: 18,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/aza-pitch/src/components/deck/Gate.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
}),
"[project]/aza-pitch/src/components/deck/ThemeToggle.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeToggle",
    ()=>ThemeToggle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const STORAGE_KEY = "aza-pitch-theme";
const CHANGE_EVENT = "aza-pitch-theme-change";
/* The <html> data-theme attribute is the source of truth — it is set by the inline
   script in layout.tsx before first paint, so reading it here (rather than holding a
   second copy in React state) is what keeps the button and the ground from ever
   disagreeing. */ function subscribe(onChange) {
    window.addEventListener(CHANGE_EVENT, onChange);
    return ()=>window.removeEventListener(CHANGE_EVENT, onChange);
}
function getTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function ThemeToggle() {
    const theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribe, getTheme, ()=>"light");
    const toggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        const next = getTheme() === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch  {
        /* Private mode or blocked site data: the attribute still applies for this visit. */ }
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        className: "theme-toggle",
        onClick: toggle,
        "aria-label": `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        title: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        children: theme === "dark" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 24 24",
            width: "15",
            height: "15",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                    cx: "12",
                    cy: "12",
                    r: "4.2",
                    fill: "currentColor"
                }, void 0, false, {
                    fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
                    lineNumber: 45,
                    columnNumber: 11
                }, this),
                [
                    0,
                    45,
                    90,
                    135,
                    180,
                    225,
                    270,
                    315
                ].map((deg)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: "12",
                        y1: "1.8",
                        x2: "12",
                        y2: "4.4",
                        stroke: "currentColor",
                        strokeWidth: "1.8",
                        strokeLinecap: "round",
                        transform: `rotate(${deg} 12 12)`
                    }, deg, false, {
                        fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
                        lineNumber: 47,
                        columnNumber: 13
                    }, this))
            ]
        }, void 0, true, {
            fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
            lineNumber: 44,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 24 24",
            width: "15",
            height: "15",
            "aria-hidden": "true",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z",
                fill: "currentColor"
            }, void 0, false, {
                fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
                lineNumber: 62,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
            lineNumber: 61,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/aza-pitch/src/components/deck/ThemeToggle.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}),
"[project]/aza-pitch/src/lib/deck.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Track definitions. Each track is a self-contained running order; the deck shows
 * one at a time and the gate slide is what chooses between them.
 *
 * These lists drive the rail, the counter and the keyboard jumps, and they match
 * the rendered slides *by position*, so a track's array here and its JSX in
 * `page.tsx` must be edited together.
 */ __turbopack_context__.s([
    "AUTHORS",
    ()=>AUTHORS,
    "TRACKS",
    ()=>TRACKS,
    "TRACK_ORDER",
    ()=>TRACK_ORDER,
    "isTrackId",
    ()=>isTrackId
]);
/**
 * The seven-minute running order. Not a subset of ACADEMIC — the slides are their
 * own components, because condensing eighteen slides into nine is a rewrite rather
 * than a filter. ACADEMIC is kept intact alongside it as the long-form deck and as
 * the deep-linkable Q&A backup.
 *
 * Budgeted at roughly 45 seconds a slide, which leaves a little air on the cover
 * and the close.
 */ const DEFENCE = [
    {
        id: "cover",
        label: "Cover"
    },
    {
        id: "problem",
        label: "The problem",
        ref: "§1.1"
    },
    {
        id: "response",
        label: "Gap & scope",
        ref: "§1.2–1.5"
    },
    {
        id: "built",
        label: "What we built",
        ref: "§1.7"
    },
    {
        id: "money-engine",
        label: "Money engine",
        ref: "§5.3–5.4"
    },
    {
        id: "e2ee",
        label: "Withdrawn property",
        ref: "§12.4a"
    },
    {
        id: "business-model",
        label: "How it earns"
    },
    {
        id: "controls",
        label: "Controls & licence"
    },
    {
        id: "results",
        label: "Results",
        ref: "§12–13"
    },
    {
        id: "close",
        label: "Close"
    }
];
const INVESTOR = [
    {
        id: "cover",
        label: "Cover"
    },
    {
        id: "problem",
        label: "The problem"
    },
    {
        id: "product",
        label: "The product"
    },
    {
        id: "built",
        label: "Already built"
    },
    {
        id: "cash-network",
        label: "Cash network"
    },
    {
        id: "safeguarding",
        label: "Where money enters"
    },
    {
        id: "flywheel",
        label: "The flywheel"
    },
    {
        id: "unit-economics",
        label: "Unit economics"
    },
    {
        id: "fees-consumer",
        label: "Consumer fees"
    },
    {
        id: "fees-merchant",
        label: "Merchant engine"
    },
    {
        id: "fees-treasury",
        label: "Partner & treasury"
    },
    {
        id: "agent-economics",
        label: "Agent economics"
    },
    {
        id: "brand",
        label: "Keeping “free”"
    },
    {
        id: "roadmap",
        label: "Sequencing"
    },
    {
        id: "close",
        label: "Open items"
    }
];
const ACADEMIC = [
    {
        id: "cover",
        label: "Cover"
    },
    {
        id: "problem",
        label: "The problem",
        ref: "§1.1"
    },
    {
        id: "gap",
        label: "The gap",
        ref: "§1.2"
    },
    {
        id: "objectives",
        label: "Aim & objectives",
        ref: "§1.3–1.4"
    },
    {
        id: "scope",
        label: "Scope",
        ref: "§1.5"
    },
    {
        id: "artefact",
        label: "The artefact",
        ref: "§1.7"
    },
    {
        id: "architecture",
        label: "Architecture",
        ref: "§4.2"
    },
    {
        id: "money-engine",
        label: "Money engine",
        ref: "§5.3"
    },
    {
        id: "invariants",
        label: "Nine invariants",
        ref: "§5.4"
    },
    {
        id: "invariant-four",
        label: "Invariant 4",
        ref: "§5.4a"
    },
    {
        id: "e2ee",
        label: "Withdrawn property",
        ref: "§12.4a"
    },
    {
        id: "testing",
        label: "Testing",
        ref: "§11"
    },
    {
        id: "concurrency",
        label: "Concurrency",
        ref: "§12.5"
    },
    {
        id: "delivery",
        label: "Delivery",
        ref: "§10"
    },
    {
        id: "results",
        label: "Results",
        ref: "§12.3"
    },
    {
        id: "contributions",
        label: "Contributions",
        ref: "§1.6"
    },
    {
        id: "limitations",
        label: "Limitations",
        ref: "§13"
    },
    {
        id: "close",
        label: "Close"
    }
];
const PARTNER = [
    {
        id: "cover",
        label: "Cover"
    },
    {
        id: "position",
        label: "Our position"
    },
    {
        id: "closed-loop",
        label: "Closed loop"
    },
    {
        id: "safeguarding",
        label: "Safeguarding"
    },
    {
        id: "controls",
        label: "Money controls"
    },
    {
        id: "agent-controls",
        label: "Agent controls"
    },
    {
        id: "kyc-risk",
        label: "KYC & risk"
    },
    {
        id: "maker-checker",
        label: "Maker–checker"
    },
    {
        id: "audit",
        label: "Audit & recon"
    },
    {
        id: "security",
        label: "Security posture"
    },
    {
        id: "close",
        label: "Open items"
    }
];
const TRACKS = {
    defence: {
        id: "defence",
        name: "Defence · 7 min",
        promise: "The presentation",
        blurb: "The examined deck, cut to a seven-minute slot: problem, scope, the artefact, the money engine, the withdrawn E2EE property, how it earns, the licensing position, and the limitations — stated rather than conceded.",
        duration: "≈7 min · 10 slides",
        slides: DEFENCE
    },
    investor: {
        id: "investor",
        name: "Investor",
        promise: "The business",
        blurb: "How AZA moves cash without a payment processor, what it charges, and where the margin actually is. Leads with the agent network, the flywheel and the unit economics.",
        duration: "≈15 min · 15 slides",
        slides: INVESTOR
    },
    partner: {
        id: "partner",
        name: "Partner & regulator",
        promise: "The controls",
        blurb: "The closed-loop ledger, the safeguarding invariant, agent due diligence, maker–checker and the audit trail — plus an honest statement of the licensing position.",
        duration: "≈12 min · 11 slides",
        slides: PARTNER
    },
    academic: {
        id: "academic",
        name: "Academic",
        promise: "The argument",
        blurb: "The thesis defence: objectives, architecture, the nine money invariants, the concurrency measurements, and the security property that was built and then deliberately withdrawn.",
        duration: "≈20 min · 18 slides",
        slides: ACADEMIC
    }
};
const TRACK_ORDER = [
    "defence",
    "academic",
    "investor",
    "partner"
];
function isTrackId(value) {
    return value === "defence" || value === "investor" || value === "academic" || value === "partner";
}
const AUTHORS = "Dussey Caleb Semekor · Andam-Cobbold Paapa Kobbina";
}),
"[project]/aza-pitch/src/lib/utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn,
    "stagger",
    ()=>stagger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/aza-pitch/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$aza$2d$pitch$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
function stagger(i) {
    return {
        "--i": i
    };
}
}),
];

//# sourceMappingURL=aza-pitch_src_0-226rd._.js.map