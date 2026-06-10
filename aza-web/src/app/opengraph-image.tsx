import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Aza — Send Money. Effortlessly.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          background: "linear-gradient(135deg, #061206 0%, #0e2a0e 55%, #174717 100%)",
          padding: "72px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative rings */}
        <div
          style={{
            position: "absolute",
            right: 60,
            top: "50%",
            width: 440,
            height: 440,
            borderRadius: "50%",
            border: "1px solid rgba(183,238,122,0.12)",
            transform: "translateY(-50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 120,
            top: "50%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "1px solid rgba(183,238,122,0.08)",
            background: "rgba(183,238,122,0.04)",
            transform: "translateY(-50%)",
          }}
        />
        {/* Centre dot */}
        <div
          style={{
            position: "absolute",
            right: 276,
            top: "50%",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(183,238,122,0.15)",
            transform: "translateY(-50%)",
          }}
        />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Brand chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(183,238,122,0.12)",
              border: "1px solid rgba(183,238,122,0.25)",
              borderRadius: 8,
              padding: "6px 14px",
              width: "fit-content",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#B7EE7A",
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#B7EE7A",
                fontFamily: "sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              AZA
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              fontFamily: "sans-serif",
            }}
          >
            Send money.
          </div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              color: "#B7EE7A",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              fontFamily: "sans-serif",
            }}
          >
            Effortlessly.
          </div>

          {/* URL */}
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "sans-serif",
              marginTop: 8,
            }}
          >
            aza.systems
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
