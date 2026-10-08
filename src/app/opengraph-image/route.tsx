import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";

const imageSize = { width: 1200, height: 630 };

/**
 * Default OpenGraph image for the umbrella landing page. Lives at the
 * top of the app tree (not inside [locale]) so the Next.js metadata
 * router doesn't fight the next-intl `as-needed` rewrite. Content is
 * in Turkish — the lab's default voice — and stays readable in EN.
 */
export function GET() {
  const heroTitle = "Geleceğin ürünlerini bugün tasarlıyoruz.";
  const eyebrow = "Product Lab · Türkiye";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0A0B",
          color: "#F4F4F5",
          padding: "72px",
          position: "relative",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -260,
            left: -260,
            width: 820,
            height: 820,
            background:
              "radial-gradient(closest-side, rgba(195,244,0,0.30), transparent 70%)",
            filter: "blur(60px)",
            borderRadius: 9999,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            right: -260,
            width: 760,
            height: 760,
            background:
              "radial-gradient(closest-side, rgba(0,209,255,0.18), transparent 70%)",
            filter: "blur(80px)",
            borderRadius: 9999,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 2,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background:
                "linear-gradient(135deg,#C3F400 0%,#E9B3FF 60%,#FFB3B5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0A0A0B",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            YL
          </div>
          <span style={{ display: "flex" }}>YULA Lab</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            zIndex: 2,
            paddingTop: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9A9AA3",
              marginBottom: 22,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              color: "#F4F4F5",
              maxWidth: 980,
            }}
          >
            {heroTitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
            fontSize: 22,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9A9AA3",
            paddingTop: 36,
          }}
        >
          <span style={{ display: "flex" }}>yulalab.com</span>
          <span style={{ display: "flex", gap: 16 }}>
            <span style={{ display: "flex" }}>Braavolabs</span>
            <span style={{ display: "flex", color: "#3A3A42" }}>·</span>
            <span style={{ display: "flex" }}>Burun Farkı</span>
            <span style={{ display: "flex", color: "#3A3A42" }}>·</span>
            <span style={{ display: "flex" }}>LifeOS</span>
          </span>
        </div>
      </div>
    ),
    { ...imageSize },
  );
}
