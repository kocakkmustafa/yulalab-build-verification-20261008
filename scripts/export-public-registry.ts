#!/usr/bin/env -S npx tsx
// Generates public/portfolio-registry.json from src/data/public-registry.ts
// — the artifact links.yulalab.com fetches at runtime (Y-P0-003). Purely a
// serialization of static source data: no Date.now()/Math.random(), no
// network calls, so re-running this against an unchanged registry produces
// a byte-identical file (checked by verify-public-registry.ts --check-export).
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { publicRegistry } from "../src/data/public-registry";
import { validateRegistry } from "../src/lib/public-registry";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_PATH = join(ROOT, "public/portfolio-registry.json");

const errors = validateRegistry(publicRegistry);
if (errors.length) {
  console.error("export-public-registry: registry is invalid, refusing to export:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

const output = {
  generatedAt: "static", // see header comment — this file's content must be a pure function of the source data, not of when it was exported
  products: publicRegistry,
};

const json = `${JSON.stringify(output, null, 2)}\n`;

const checkOnly = process.argv.includes("--check");
if (checkOnly) {
  if (!existsSync(OUT_PATH)) {
    console.error(`export-public-registry --check: ${OUT_PATH} does not exist — run without --check first.`);
    process.exit(1);
  }
  const existing = readFileSync(OUT_PATH, "utf8");
  if (existing !== json) {
    console.error(
      "export-public-registry --check: public/portfolio-registry.json is stale — run `pnpm export:registry` and commit the result.",
    );
    process.exit(1);
  }
  console.log("export-public-registry --check: OK — generated artifact matches working tree, diff 0.");
  process.exit(0);
}

writeFileSync(OUT_PATH, json);
console.log(`export-public-registry: wrote ${OUT_PATH} (${publicRegistry.length} products).`);
