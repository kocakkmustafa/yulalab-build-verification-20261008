"use client";

/* eslint-disable @next/next/no-img-element -- registry captures do not publish
   dimensions; native images preserve each file's intrinsic aspect ratio. */
import { TrackedLink } from "@/components/common/TrackedLink";
import type { ExperienceCopy, ExperienceProduct } from "./types";
import {
  ExperienceClosingContent,
  ExperienceHeader,
  ProofLedger,
  useExperienceSiteDate,
} from "./ExperienceOverlay";
import styles from "./Experience.module.css";

type StaticExperienceProps = {
  copy: ExperienceCopy;
  products: ExperienceProduct[];
  soundEnabled: boolean;
  onSoundToggle: () => void;
};

/** Complete linear rendering for reduced motion and WebGL/context failure. */
export function StaticExperience({
  copy,
  products,
  soundEnabled,
  onSoundToggle,
}: StaticExperienceProps) {
  const today = useExperienceSiteDate();

  return (
    <div className={styles.staticExperience} data-experience-static="true">
      <ExperienceHeader
        copy={copy}
        soundEnabled={soundEnabled}
        onSoundToggle={onSoundToggle}
      />

      <section id="experience-hero" className={styles.staticHero}>
        <p className={styles.kicker}>{copy.hero.eyebrow}</p>
        <h1>{copy.hero.title}</h1>
        <p className={styles.staticLede}>{copy.hero.lede}</p>
        <a href={copy.locale === "tr" ? "/consulting" : "/en/consulting"} className={styles.productLink}>{copy.navigation.consulting} <span aria-hidden="true">↗</span></a>
        <p className={styles.staticNotice}>{copy.hero.notice}</p>
        <TrackedLink
          href="#experience-portfolio"
          event="home_primary_cta"
          className={styles.productLink}
        >
          {copy.hero.scroll}
          <span aria-hidden="true">↘</span>
        </TrackedLink>
        <p className={styles.fallbackNotice}>
          <span>{copy.fallback.label}</span>
          {copy.fallback.reason}
        </p>
      </section>

      <section id="experience-portfolio" className={styles.staticSection}>
        <header className={styles.staticSectionHeading}>
          <p className={styles.kicker}>{copy.portfolio.kicker}</p>
          <h2>{copy.navigation.projects}</h2>
        </header>
        <div className={styles.staticProducts}>
          {products.map((product, index) => (
            <article key={product.slug} className={styles.staticProduct}>
              <div className={styles.productMeta}>
                <span>{String(index + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}</span>
                <span>{product.category}</span>
              </div>
              <div className={styles.lifecycleRow}>
                <span data-lifecycle={product.lifecycle}>{product.lifecycleLabel}</span>
                {product.lifecycle === "research" ? <strong>{copy.portfolio.noPublicBuild}</strong> : null}
              </div>
              <h3>{product.name}</h3>
              <p className={styles.productTagline}>{product.tagline}</p>
              <p className={styles.productShort}>{product.short}</p>

              {product.screenshots.length > 0 ? (
                <div className={styles.staticScreenshots}>
                  {product.screenshots.map((shot) => (
                    <figure key={shot.path}>
                      <img
                        src={shot.path}
                        alt={shot.alt}
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption>
                        <span>{shot.sourceBuild}</span>
                        <time dateTime={shot.capturedAt}>{shot.capturedAt}</time>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div
                  className={styles.staticResearchSurface}
                  aria-label={
                    product.lifecycle === "research"
                      ? copy.portfolio.noPublicBuild
                      : product.lifecycleLabel
                  }
                >
                  <span aria-hidden="true">{product.monogram}</span>
                  <strong>
                    {product.lifecycle === "research"
                      ? copy.portfolio.noPublicBuild
                      : product.lifecycleLabel}
                  </strong>
                </div>
              )}

              <TrackedLink
                href={product.href}
                event="product_primary_cta"
                product={product.slug}
                className={styles.productLink}
              >
                {product.ctaLabel}
                <span aria-hidden="true">↗</span>
              </TrackedLink>

              <div className={styles.staticProof}>
                <h4>{copy.proof.title}</h4>
                <ProofLedger copy={copy} product={product} today={today} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="experience-proof" className={`${styles.staticSection} ${styles.staticManifesto}`}>
        <p className={styles.kicker}>{copy.proof.kicker}</p>
        <h2>{copy.proof.title}</h2>
        <p>{copy.fallback.reason}</p>
      </section>

      <section id="experience-manifesto" className={`${styles.staticSection} ${styles.staticManifesto}`}>
        <article>
          <p className={styles.kicker}>{copy.mission.kicker}</p>
          <h2>{copy.mission.title}</h2>
          <p>{copy.mission.body}</p>
        </article>
        <article>
          <p className={styles.kicker}>{copy.vision.kicker}</p>
          <h2>{copy.vision.title}</h2>
          <p>{copy.vision.body}</p>
        </article>
      </section>

      <section className={styles.staticSection}>
        <header className={styles.staticSectionHeading}>
          <p className={styles.kicker}>{copy.values.kicker}</p>
          <h2>{copy.values.title}</h2>
        </header>
        <div className={styles.staticValues}>
          {copy.values.items.map((value, index) => (
            <article key={value.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{value.title}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.staticClosing}>
        <ExperienceClosingContent copy={copy} headingId="static-experience-closing-title" />
      </footer>
    </div>
  );
}

export default StaticExperience;
