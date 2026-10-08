"use client";

import type { CSSProperties } from "react";
import type { ExperienceCopy } from "./types";
import { resolveLoaderFrame } from "./loader";
import styles from "./Experience.module.css";

type ExperienceLoaderProps = {
  lines: ExperienceCopy["loader"];
  progress: number;
};

type LoaderStyle = CSSProperties & {
  "--loader-progress": number;
  "--loader-reveal": number;
  "--loader-flat": number;
  "--loader-depth": number;
  "--loader-flash": number;
  "--loader-exit": number;
};

/**
 * A self-running architectural title card, not an interaction gate.
 * Timing lives in YulaExperience so capture mode can provide an exact frame.
 */
export function ExperienceLoader({ lines, progress }: ExperienceLoaderProps) {
  const frame = resolveLoaderFrame(progress);
  const clamped = frame.progress;
  const activeLine = Math.min(lines.length - 1, Math.floor(clamped * lines.length));
  const style: LoaderStyle = {
    "--loader-progress": clamped,
    "--loader-reveal": frame.reveal,
    "--loader-flat": frame.flat,
    "--loader-depth": frame.depth,
    "--loader-flash": frame.flash,
    "--loader-exit": frame.exit,
  };

  return (
    <div
      className={styles.loader}
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-yula-loader="true"
      data-loader-progress={clamped.toFixed(3)}
    >
      <div className={styles.loaderBurst} aria-hidden="true">
        <i />
        <i />
        <span />
      </div>
      <div className={styles.loaderField} aria-hidden="true">
        <svg className={styles.loaderBlueprint} viewBox="0 0 1000 700">
          <g className={styles.loaderAxes}>
            <path d="M80 350H920" pathLength="1" />
            <path d="M500 62V638" pathLength="1" />
            <circle cx="500" cy="350" r="248" pathLength="1" />
            <circle cx="500" cy="350" r="164" pathLength="1" />
            <path d="M250 184L750 516M750 184L250 516" pathLength="1" />
          </g>
          <g className={styles.loaderGlyphWire}>
            <path d="M318 162L500 348L682 162L613 112L500 230L387 112Z" />
            <path d="M435 328H565V588H435Z" />
            <path d="M500 348L613 230L548 178L500 230L452 178L387 230Z" />
          </g>
          <g className={styles.loaderGlyphDepth}>
            <path d="M318 162L500 348L682 162L613 112L500 230L387 112Z" />
            <path d="M435 328H565V588H435Z" />
          </g>
          <g className={styles.loaderGlyphGlass}>
            <path d="M318 162L500 348L682 162L613 112L500 230L387 112Z" />
            <path d="M435 328H565V588H435Z" />
          </g>
          <g className={styles.loaderTicks}>
            {Array.from({ length: 18 }, (_, index) => {
              const x = 95 + index * 47.65;
              return <path key={index} d={`M${x} 340V360`} />;
            })}
          </g>
        </svg>
        <span className={styles.loaderCorner}>YL / SYS / 001</span>
        <span className={styles.loaderPercent}>{Math.round(clamped * 100).toString().padStart(3, "0")}</span>
      </div>

      <div className={styles.loaderReadout}>
        <span className={styles.srOnly}>{lines[activeLine]}</span>
        <ol aria-hidden="true">
          {lines.map((line, index) => (
            <li key={line} data-active={index === activeLine ? "true" : "false"}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {line}
            </li>
          ))}
        </ol>
        <div className={styles.loaderTrack} aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

export default ExperienceLoader;
