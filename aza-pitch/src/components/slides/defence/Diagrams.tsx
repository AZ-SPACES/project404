/**
 * The figures for the 7-minute defence track.
 *
 * All of them are inline SVG rather than image assets, for three reasons that
 * matter in a viva room: they stay crisp on whatever projector is in the hall,
 * they resolve their colours through the same `--accent` / `--line` tokens as
 * every other slide (so light and dark both work without a second export), and
 * they add nothing to the network path of a deck that may be presented on
 * conference wifi.
 *
 * Convention: geometry is authored against the stated viewBox and scaled by the
 * wrapper, `stroke`/`fill` never name a raw colour, and every figure carries a
 * `<title>` so the accessibility tree says what the picture says.
 */

function Figure({
  viewBox,
  title,
  children,
  className,
}: {
  viewBox: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      className={className}
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

/* Shared atoms. `vector-effect` keeps hairlines at 1px however far the figure is
   scaled up, which is the difference between a crisp diagram and a fuzzy one on
   a 4K projector. */
const HAIR = {
  fill: "none",
  stroke: "var(--line-strong)",
  strokeWidth: 1,
  vectorEffect: "non-scaling-stroke" as const,
};
const HAIR_ACCENT = { ...HAIR, stroke: "var(--accent)" };

function Label({
  x,
  y,
  children,
  size = 11,
  tone = "var(--text)",
  weight = 500,
  anchor = "middle",
  mono = false,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  tone?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  mono?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={tone}
      fontSize={size}
      fontWeight={weight}
      dominantBaseline="middle"
      style={
        mono
          ? { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", letterSpacing: "0.08em" }
          : { fontFamily: "var(--font-inter), sans-serif", letterSpacing: "-0.01em" }
      }
    >
      {children}
    </text>
  );
}

function ArrowHead({ id, tone = "var(--line-strong)" }: { id: string; tone?: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      refX="7"
      refY="4"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M0 0 L8 4 L0 8 z" fill={tone} />
    </marker>
  );
}

/* ============================================================
   1 · The problem — settlement lives outside the conversation
   ============================================================ */
export function SplitContextFigure() {
  return (
    <Figure viewBox="0 0 640 150" title="Today a payment leaves the chat, settles elsewhere, and returns as a screenshot">
      <defs>
        <ArrowHead id="split-arrow" />
      </defs>

      {[
        { x: 8, label: "Chat", sub: "the agreement" },
        { x: 236, label: "MoMo / USSD", sub: "the settlement" },
        { x: 464, label: "Chat", sub: "a screenshot" },
      ].map((box) => (
        <g key={box.x}>
          <rect x={box.x} y={30} width={168} height={72} rx={10} {...HAIR} />
          <Label x={box.x + 84} y={57} size={13} weight={600}>
            {box.label}
          </Label>
          <Label x={box.x + 84} y={77} size={10.5} tone="var(--text-tertiary)" weight={400}>
            {box.sub}
          </Label>
        </g>
      ))}

      {/* The two hops. Dashed, because neither carries any state the other can read. */}
      {[176, 404].map((x) => (
        <line
          key={x}
          x1={x + 6}
          y1={66}
          x2={x + 54}
          y2={66}
          {...HAIR}
          strokeDasharray="4 4"
          markerEnd="url(#split-arrow)"
        />
      ))}

      {/* The break: context does not survive the round trip. */}
      <g transform="translate(320 122)">
        <line x1={-92} y1={0} x2={-16} y2={0} {...HAIR} strokeDasharray="3 5" />
        <line x1={16} y1={0} x2={92} y2={0} {...HAIR} strokeDasharray="3 5" />
        <g stroke="var(--bad)" strokeWidth={1.4} vectorEffect="non-scaling-stroke">
          <line x1={-6} y1={-6} x2={6} y2={6} />
          <line x1={6} y1={-6} x2={-6} y2={6} />
        </g>
      </g>
      <Label x={320} y={144} size={10} tone="var(--text-tertiary)" weight={400} mono>
        NO SHARED AUDIT TRAIL
      </Label>
    </Figure>
  );
}

/* ============================================================
   2 · The response — five products, one ledger
   ============================================================ */
const PRODUCTS = ["Wallet", "Chat", "Merchant rail", "Agent cash", "Developer API"];

export function OneLedgerFigure() {
  return (
    <Figure viewBox="0 0 640 176" title="Five product surfaces settling on a single ledger inside one transactional boundary">
      {/* The surfaces. None of them holds a balance — that is the whole point of
          the figure, so they are drawn identical and subordinate. */}
      {PRODUCTS.map((name, i) => {
        const w = 116;
        const x = 8 + i * (w + 12);
        return (
          <g key={name}>
            <rect x={x} y={4} width={w} height={40} rx={9} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <Label x={x + w / 2} y={24} size={11.5} weight={550}>
              {name}
            </Label>
            <line x1={x + w / 2} y1={44} x2={x + w / 2} y2={76} {...HAIR} />
          </g>
        );
      })}

      {/* The ledger. Accent-filled at low alpha so it reads as the destination
          every surface points at, without competing with the headline. */}
      <rect
        x={8}
        y={76}
        width={624}
        height={58}
        rx={12}
        fill="color-mix(in oklab, var(--accent) 8%, transparent)"
        stroke="var(--accent)"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <Label x={320} y={98} size={15} weight={650}>
        One ledger · one Spring Boot application
      </Label>
      <Label x={320} y={118} size={11} tone="var(--text-secondary)" weight={400}>
        Every balance write commits here, or nowhere
      </Label>

      <line x1={8} y1={152} x2={632} y2={152} {...HAIR} strokeDasharray="4 4" />
      <Label x={320} y={168} size={10} tone="var(--text-tertiary)" weight={400} mono>
        ONE IDENTITY · ONE AUDIT TRAIL · ONE SET OF LIMITS
      </Label>
    </Figure>
  );
}

/* ============================================================
   3 · The money engine — the transactional boundary, drawn
   ============================================================ */
export function BoundaryFigure() {
  const before = ["Passcode verified", "Idempotency key checked", "Limits enforced"];
  const inside = [
    "Lock sender wallet · FOR UPDATE",
    "Lock recipient wallet · canonical order",
    "Debit · credit · write transaction",
    "Write the audit entry",
  ];
  const after = ["Risk scoring — never fails the transfer", "Push · SMS · webhook · WebSocket"];

  return (
    <Figure viewBox="0 0 400 330" title="The transfer flow: checks, then a single committed transaction, then external effects">
      <defs>
        <ArrowHead id="bnd-arrow" />
      </defs>

      {before.map((text, i) => (
        <g key={text}>
          <Label x={16} y={16 + i * 22} size={11} tone="var(--text-secondary)" weight={400} anchor="start">
            {text}
          </Label>
        </g>
      ))}
      <line x1={200} y1={72} x2={200} y2={86} {...HAIR} markerEnd="url(#bnd-arrow)" />

      {/* The boundary itself. Everything inside it is atomic; drawing it is the
          argument, so it gets the only filled panel in the figure. */}
      <rect
        x={8}
        y={92}
        width={384}
        height={132}
        rx={12}
        fill="color-mix(in oklab, var(--accent) 7%, transparent)"
        stroke="var(--accent)"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <rect x={22} y={84} width={92} height={17} rx={4} fill="var(--bg)" />
      <Label x={26} y={92} size={10} tone="var(--accent)" weight={500} anchor="start" mono>
        @TRANSACTIONAL
      </Label>

      {inside.map((text, i) => (
        <g key={text}>
          <circle cx={28} cy={120 + i * 26} r={2} fill="var(--accent)" />
          <Label x={40} y={120 + i * 26} size={11} weight={450} anchor="start">
            {text}
          </Label>
        </g>
      ))}

      <line x1={20} y1={206} x2={380} y2={206} {...HAIR_ACCENT} strokeDasharray="3 4" />
      <Label x={200} y={216} size={9.5} tone="var(--accent)" weight={500} mono>
        COMMIT
      </Label>

      <line x1={200} y1={230} x2={200} y2={246} {...HAIR} markerEnd="url(#bnd-arrow)" />
      {after.map((text, i) => (
        <Label key={text} x={16} y={262 + i * 22} size={11} tone="var(--text-secondary)" weight={400} anchor="start">
          {text}
        </Label>
      ))}

      <line x1={8} y1={300} x2={392} y2={300} {...HAIR} strokeDasharray="4 4" />
      <Label x={16} y={318} size={10} tone="var(--text-tertiary)" weight={400} anchor="start">
        A dropped webhook is a no-op — never missing money.
      </Label>
    </Figure>
  );
}

/* ============================================================
   4 · The business model — the flywheel
   ============================================================ */
export function FlywheelFigure() {
  const NODES = [
    { angle: -90, tag: "Cash in", note: "Free, always", tone: "var(--text-tertiary)" },
    { angle: 30, tag: "Spend digitally", note: "Near-pure margin", tone: "var(--accent)" },
    { angle: 150, tag: "Cash out", note: "Fee, split with agent", tone: "var(--text-tertiary)" },
  ];
  const R = 76;
  const cx = 180;
  const cy = 140;

  return (
    <Figure viewBox="0 0 360 228" title="The flywheel: free cash-in buys deposits, digital spend earns the margin, cash-out carries the only consumer fee">
      <defs>
        <ArrowHead id="fly-arrow" tone="var(--accent)" />
      </defs>

      {/* The ring, drawn as three arcs so each leg can carry its own arrowhead
          and the direction of the loop is unambiguous. */}
      {NODES.map((node, i) => {
        const a0 = ((node.angle + 16) * Math.PI) / 180;
        const a1 = ((NODES[(i + 1) % 3].angle - 16 + (i === 2 ? 360 : 0)) * Math.PI) / 180;
        return (
          <path
            key={node.tag}
            d={`M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`}
            {...HAIR_ACCENT}
            markerEnd="url(#fly-arrow)"
          />
        );
      })}

      {NODES.map((node) => {
        const a = (node.angle * Math.PI) / 180;
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);

        /* Captions sit on the ray through their own node, pushed clear of the
           ring. Anchoring by the sign of cos is what keeps the left and right
           captions growing away from the circle instead of back across it — the
           earlier fixed "above the node" placement put the two lower captions
           on top of the centre label. */
        const lx = cx + (R + 22) * Math.cos(a);
        const ly = cy + (R + (node.angle === -90 ? 32 : 22)) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";

        return (
          <g key={node.tag}>
            <circle
              cx={x}
              cy={y}
              r={7}
              fill="var(--bg)"
              stroke={node.tone}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            <Label x={lx} y={ly} size={12.5} weight={600} anchor={anchor}>
              {node.tag}
            </Label>
            <Label x={lx} y={ly + 15} size={9.5} tone="var(--text-tertiary)" weight={400} anchor={anchor}>
              {node.note}
            </Label>
          </g>
        );
      })}

      <Label x={cx} y={cy - 9} size={10.5} tone="var(--text-secondary)" weight={400}>
        The metric
      </Label>
      <Label x={cx} y={cy + 9} size={14} tone="var(--accent)" weight={650}>
        Digital ratio
      </Label>
    </Figure>
  );
}
