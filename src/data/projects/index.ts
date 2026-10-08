import type { ProjectConfig } from "@/lib/types";
import { braavolabs } from "./braavolabs";
import { burunfarki } from "./burunfarki";
import { lifeos } from "./lifeos";
import { gravita } from "./gravita";
import { lissom } from "./lissom";
import { jablab } from "./jablab";
import { ostinato } from "./ostinato";
import { choreia } from "./choreia";

// Order field keeps the three live/beta products first; the five
// "coming-soon" products (gravita/lissom/jablab/ostinato/choreia, order 4-8)
// sort after them everywhere this array is consumed (homepage, /projects
// grid, footer, sitemap) — see ProjectConfig.order doc comment.
export const projects: ProjectConfig[] = [
  braavolabs,
  burunfarki,
  lifeos,
  gravita,
  lissom,
  jablab,
  ostinato,
  choreia,
].sort((a, b) => a.order - b.order);

export function getProjectBySlug(slug: string): ProjectConfig | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getProjectSlugs(): string[] {
  return projects.map((p) => p.slug);
}
