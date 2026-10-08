#!/usr/bin/env -S npx tsx
// PR/CI gate for outbound link well-formedness (Y-P0-003, mapped from
// package.json's `verify:links`). Two tiers, deliberately not equal in
// severity:
//   1. Well-formed URL, non-empty for anything claiming to be live — this
//      is OUR data being self-consistent, always checked, BLOCKING.
//   2. Actually reachable right now — this is the external world's
//      availability, which this repo doesn't control. A transient outage
//      at apps.apple.com is not a regression in this codebase, so it's
//      reported but does not fail the gate. Pass --strict to make it
//      blocking (e.g. for a manual pre-launch check).
import { publicRegistry } from "../src/data/public-registry";

type LinkCheck = { productSlug: string; kind: string; url: string };

const links: LinkCheck[] = [];
for (const record of publicRegistry) {
  for (const surface of record.surfaces) {
    if (surface.url) links.push({ productSlug: record.slug, kind: `surface:${surface.kind}`, url: surface.url });
  }
  if (record.primaryCta.url && /^https?:\/\//.test(record.primaryCta.url)) {
    links.push({ productSlug: record.slug, kind: "primaryCta", url: record.primaryCta.url });
  }
}

const malformed: string[] = [];
for (const link of links) {
  try {
    const parsed = new URL(link.url);
    if (parsed.protocol !== "https:") {
      malformed.push(`${link.productSlug} ${link.kind}: not https — ${link.url}`);
    }
  } catch {
    malformed.push(`${link.productSlug} ${link.kind}: not a valid URL — "${link.url}"`);
  }
}

if (malformed.length) {
  console.error(`verify-public-links: ${malformed.length} malformed link(s)\n`);
  for (const m of malformed) console.error(`  ✗ ${m}`);
  process.exit(1);
}

const strict = process.argv.includes("--strict");
const skipLive = process.argv.includes("--no-live");

async function checkLive() {
  const unreachable: string[] = [];
  for (const link of links) {
    try {
      const res = await fetch(link.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) unreachable.push(`${link.productSlug} ${link.kind}: HTTP ${res.status} — ${link.url}`);
    } catch (err) {
      unreachable.push(`${link.productSlug} ${link.kind}: ${(err as Error).message} — ${link.url}`);
    }
  }
  return unreachable;
}

(async () => {
  console.log(`verify-public-links: ${links.length} link(s) well-formed.`);

  if (skipLive) {
    console.log("verify-public-links: --no-live passed, skipping reachability check.");
    return;
  }

  const unreachable = await checkLive();
  if (unreachable.length) {
    console.warn(`\nverify-public-links: ${unreachable.length} link(s) not reachable right now (informational unless --strict):`);
    for (const u of unreachable) console.warn(`  ⚠ ${u}`);
    if (strict) process.exit(1);
  } else {
    console.log("verify-public-links: all links reachable.");
  }
})();
