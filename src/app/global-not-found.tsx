import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://yulalab.com"),
  title: "404 · YULA Lab",
  description: "Aradığınız sayfa bulunamadı.",
  openGraph: {
    title: "404 · YULA Lab",
    description: "Aradığınız sayfa bulunamadı.",
    images: [
      {
        url: "https://yulalab.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "YULA Lab — product lab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://yulalab.com/opengraph-image"],
  },
};

export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          color: "#f7f4ff",
          background: "#09060e",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 14px",
                color: "#aaa0ba",
                fontSize: 11,
                letterSpacing: "0.18em",
              }}
            >
              404 · YULA LAB
            </p>
            <h1 style={{ maxWidth: 720, margin: 0, fontSize: "clamp(42px, 8vw, 88px)" }}>
              Bu sayfa burada değil.
            </h1>
            <Link
              href="/"
              style={{
                display: "inline-block",
                marginTop: 32,
                padding: "13px 20px",
                border: "1px solid rgba(247, 244, 255, 0.24)",
                borderRadius: 999,
                color: "inherit",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Ana sayfaya dön
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
