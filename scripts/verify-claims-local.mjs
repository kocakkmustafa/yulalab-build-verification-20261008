#!/usr/bin/env node
// Y-P0-001 claim/content check — permanent, not a stopgap (decision made in
// Y-P0-003). Plain Node (no deps, no build step). Distinct role from
// scripts/verify-public-registry.ts (`verify:claims`, Y-P0-003): that one
// checks the registry OBJECT's structural shape (required fields, TR/EN
// pairs, lifecycle rules); this one greps rendered TEXT across the whole
// site+links tree for specific historically-false patterns (see FORBIDDEN
// below) that a structurally-valid registry entry could still repeat in
// prose elsewhere (a manifesto sentence, a README, a code comment). Neither
// script subsumes the other — both stay in ci.yml.
//
// Usage: node scripts/verify-claims-local.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // site/
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url)); // yulalab-com/

const failures = [];

// 1. TR/EN key parity in messages/*.json -----------------------------------
function collectKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of collectKeys(v, path)) keys.add(child);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

const tr = JSON.parse(readFileSync(join(ROOT, "messages/tr.json"), "utf8"));
const en = JSON.parse(readFileSync(join(ROOT, "messages/en.json"), "utf8"));
const trKeys = collectKeys(tr);
const enKeys = collectKeys(en);

for (const k of trKeys) {
  if (!enKeys.has(k)) failures.push(`TR/EN parity: messages/en.json is missing "${k}" (present in tr.json)`);
}
for (const k of enKeys) {
  if (!trKeys.has(k)) failures.push(`TR/EN parity: messages/tr.json is missing "${k}" (present in en.json)`);
}

// 2. Forbidden public-claim patterns -----------------------------------------
// Each entry is a regression guard for a specific claim fixed in Y-P0-001
// (2026-08-19) — see EVIDENCE-LEDGER.md for the sourced finding behind each
// one. A hit means the false/stale claim crept back in; verify the specific
// finding before assuming the checker itself is wrong.
import { FORBIDDEN } from "./forbidden-patterns.mjs";

// links/index.html and links/README.md live in a SEPARATE git repo
// (kocakkmustafa/yulalab-links). They only exist here when this script runs
// from the local multi-repo workspace layout (ventures/yulalab-com/{site,
// links}/) — a standalone checkout of this repo (e.g. GitHub Actions) will
// never have them. Missing targets are reported below, not silently
// skipped — a "0 forbidden-pattern hits" result must say what it covered.
const SCAN_TARGETS = [
  join(ROOT, "src"),
  join(ROOT, "messages"),
  join(ROOT, "LICENSE"),
  join(ROOT, "README.md"),
  join(REPO_ROOT, "links/index.html"),
  join(REPO_ROOT, "links/README.md"),
];

const TEXT_EXT = new Set([".ts", ".tsx", ".json", ".md", ".html", ""]);
const missingTargets = [];

function walk(path, out) {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) {
    missingTargets.push(path);
    return;
  }
  if (st.isDirectory()) {
    if (path.includes("node_modules") || path.includes(`${path.sep ?? "/"}.next`)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry), out);
  } else if (TEXT_EXT.has(extname(path))) {
    out.push(path);
  }
}

const files = [];
for (const target of SCAN_TARGETS) walk(target, files);

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const { pattern, note } of FORBIDDEN) {
    if (pattern.test(content)) {
      failures.push(`${file}: matches forbidden pattern ${pattern} — ${note}`);
    }
  }
}

// -----------------------------------------------------------------------
if (missingTargets.length) {
  console.warn(`verify-claims-local: ${missingTargets.length} scan target(s) not present, skipped:`);
  for (const t of missingTargets) console.warn(`  ⚠ ${t}`);
  console.warn(
    "  (expected for links/* outside the local multi-repo workspace layout — e.g. CI)",
  );
}

if (failures.length) {
  console.error(`\nverify-claims-local: ${failures.length} issue(s) found\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
} else {
  console.log(
    `\nverify-claims-local: OK — ${trKeys.size} TR keys / ${enKeys.size} EN keys in parity, ${files.length} files scanned (${missingTargets.length} target(s) unavailable), 0 forbidden-pattern hits.`,
  );
  process.exit(0);
}
