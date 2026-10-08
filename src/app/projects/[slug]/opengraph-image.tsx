import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getProjectBySlug, getProjectSlugs } from "@/data/projects";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "YULA Lab venture showcase card";

export function generateStaticParams() {
  return getProjectSlugs().map((slug) => ({ slug }));
}

/**
 * Per-project OpenGraph image — generated at build time from each
 * venture's own brand tokens (gradient, primary color, monogram).
 *
 * Lives OUTSIDE the [locale] segment because Next.js metadata-file
 * conventions don't compose cleanly with `localePrefix: "as-needed"`
 * — the middleware redirects strip the locale prefix off the URL
 * before the metadata route can resolve. One image per project
 * (Turkish content for TR users, falls back to project.tagline for
 * EN — tagline is brand and reads fine in both languages).
 */
export default async function ProjectOgImage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const tagline = project.tagline.tr;
  const category = project.category.tr;
  const accent = project.brand.primary;
  const foreground = project.brand.foreground;
  const background = project.brand.background;
  const gradient = project.brand.gradient;
  const statusIsFilled = project.status === "live" || project.status === "beta";
  const statusLabel =
    project.status === "live"
      ? "live"
      : project.status === "beta"
        ? "beta"
        : project.status === "coming-soon"
          ? "coming soon"
          : "in development";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background,
          color: foreground,
          padding: "64px",
          position: "relative",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 720,
            height: 720,
            background: gradient,
            opacity: 0.45,
            filter: "blur(120px)",
            borderRadius: 9999,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -240,
            right: -240,
            width: 640,
            height: 640,
            background: gradient,
            opacity: 0.22,
            filter: "blur(140px)",
            borderRadius: 9999,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: background,
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              YL
            </div>
            <span style={{ display: "flex" }}>YULA Lab</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 18,
              fontWeight: 500,
              padding: "10px 18px",
              borderRadius: 9999,
              border: `1px solid ${foreground}33`,
              background: `${foreground}10`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: accent,
                display: "flex",
              }}
            />
            <span style={{ display: "flex" }}>{category}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 36,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                fontSize: 220,
                fontWeight: 900,
                letterSpacing: "-0.06em",
                lineHeight: 0.9,
                color: foreground,
                display: "flex",
                opacity: 0.95,
              }}
            >
              {project.monogram}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 84,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  color: foreground,
                  display: "flex",
                }}
              >
                {project.name}
              </span>
              <span
                style={{
                  fontSize: 28,
                  letterSpacing: "-0.01em",
                  color: `${foreground}cc`,
                  display: "flex",
                  maxWidth: 720,
                }}
              >
                {tagline}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
            fontSize: 20,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: `${foreground}aa`,
          }}
        >
          <span style={{ display: "flex" }}>yulalab.com/projects/{slug}</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: accent,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 10,
                height: 10,
                border: `2px solid ${accent}`,
                borderRadius: 9999,
                background: statusIsFilled ? accent : "transparent",
              }}
            />
            <span style={{ display: "flex" }}>{statusLabel}</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
