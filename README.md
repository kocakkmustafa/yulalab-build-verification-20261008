<div align="center">

# YULA Lab — Umbrella Site

**[yulalab.com](https://yulalab.com)** · The public marketing and showcase site for YULA Lab — an independent product lab designing AI-native, data-driven products that simplify everyday life.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](./LICENSE)

</div>

---

## What this is

A public product-lab site with an interactive portfolio, product pages, support and privacy information. The current public contact flow uses email links. Optional lead intake, data-request verification, attribution and mail/retention handlers also exist in the source; their runtime configuration is separate from the public pages.

Project pages are prerendered and revalidate every 900 seconds so evidence freshness does not remain frozen at build time. API handlers and the standalone verification page are dynamic Node routes. `next-intl` uses TR / EN with `as-needed` locale prefixes (Turkish at the root, English at `/en`).

## The ventures we showcase

Eight products total — three shipped (live/beta), five coming soon.

| Slug          | Project                    | Status      | Highlight                                              |
| ------------- | -------------------------- | ----------- | ------------------------------------------------------- |
| `braavolabs`  | Autonomous AI Company OS   | Beta        | 9 primitives, 14 LLM providers, transparent cost         |
| `burunfarki`  | Transparent racing AI      | Live        | Dated performance records, model reasoning and scope   |
| `lifeos`      | Personal life OS (mobile)  | Live        | Offline‑first, AES‑256 on‑device, 5 life domains         |
| `gravita`     | Skills & strength coach    | Coming soon | Handstand & bodyweight skills, on-device pose tracking   |
| `lissom`      | Mobility & flexibility coach | Coming soon | On-device pose tracking, zero cloud                    |
| `jablab`      | Solo boxing coach          | Coming soon | Shadow training, on-device pose tracking                 |
| `ostinato`    | Music practice coach       | Coming soon | Camera/audio practice feedback in development          |
| `choreia`     | Global dance coach         | Coming soon | On-device pose tracking, zero cloud                      |

Each project is configured in [`src/data/projects/<slug>.ts`](./src/data/projects/) and rendered through [`ProductPage`](./src/components/projects/ProductPage.tsx). The homepage uses [`YulaExperience`](./src/components/experience/YulaExperience.tsx). Public claim dates and publication evidence live in [`public-registry.ts`](./src/data/public-registry.ts); a registry entry is not proof of another product's authenticated runtime or legal rights.

## Tech stack

| Layer        | Choice                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| Framework    | **Next.js 15** App Router · React 19 · TypeScript 5.7                     |
| Styling      | TailwindCSS 4 · `@tailwindcss/typography` · per-project CSS variables     |
| Motion       | Framer Motion · CSS-only reveal hook for accessibility                    |
| Icons        | Lucide                                                                    |
| i18n         | `next-intl` 4 — TR (default) and EN                                       |
| SEO          | Dynamic [`sitemap.ts`](./src/app/sitemap.ts) + [`robots.ts`](./src/app/robots.ts) + OpenGraph + Twitter |
| Hosting      | Netlify with the pinned Next.js adapter                                  |
| Package mgr  | pnpm 10.33.0; Node.js 26.9.0 build, Node.js 24 function runtime            |

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm lint
pnpm build
```

Optional environment variables:

```bash
# .env.local — only needed if you want to override the canonical origin
NEXT_PUBLIC_SITE_URL=https://yulalab.com
```

Metadata can fall back to Vercel's `VERCEL_URL`; the sitemap defaults to
`https://yulalab.com`. Verification email links always use that canonical
origin. See [`.env.example`](./.env.example) for the optional server features.
The three DB roles, schema, sender/template bindings and challenge settings
must be configured and verified before enabling intake. Verification and mail
for already accepted requests may continue after new intake is disabled.

## Verification

Keep the `yulalab-links` repository checked out as the sibling `../links`; claim
checks inspect its `index.html` and `README.md`. The unit suite uses a dedicated
local PostgreSQL test database and creates/drops test schemas and roles. Use a
disposable database with the permissions in [CI](./.github/workflows/ci.yml),
never a production connection.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:render-mode
pnpm exec playwright install chromium
pnpm test:e2e
pnpm verify:links
pnpm audit --prod --audit-level high
```

Browser tests include API interception for UI failure cases; these do not prove
real email delivery, account deletion or a provider deployment. A release needs
the final source/build identity, independent review, Security results and live
route/header readback as well as tests.

## Adding a new venture

1. Create `src/data/projects/<slug>.ts` and export a `ProjectConfig` (typed via [`src/lib/types.ts`](./src/lib/types.ts)).
2. Register it in [`src/data/projects/index.ts`](./src/data/projects/index.ts).
3. Drop visual assets into `public/projects/<slug>/`.
4. Add its public registry record and TR/EN product copy; keep the homepage's
   explicit product order consistent. Use real dated captures and claim sources.
5. Run `pnpm export:registry` and the verification commands above.

The route `/projects/<slug>` (and its `/en/projects/<slug>` mirror) is generated automatically, and the dynamic sitemap picks it up on the next build.

## Project structure

```
src/
├── app/[locale]/                # All routes are locale-scoped
│   ├── page.tsx                 # Landing
│   ├── manifesto/page.tsx       # Vision · mission · values
│   ├── projects/page.tsx        # Index
│   ├── projects/[slug]/page.tsx # Showcase (generateStaticParams)
│   ├── contact/page.tsx
│   ├── not-found.tsx
│   └── layout.tsx               # Fonts, metadata, IntlProvider
├── app/sitemap.ts               # Dynamic sitemap.xml
├── app/robots.ts                # Dynamic robots.txt
├── components/
│   ├── layout/                  # Header, Footer, LocaleSwitcher
│   ├── landing/                 # Sections used on the home page
│   ├── projects/                # Reusable showcase blocks
│   ├── manifesto/, contact/     # Page-specific bits
│   └── common/                  # Atoms (icons, monogram, marks, banner)
├── data/
│   ├── company.ts               # YULA Lab identity (vision, mission, socials)
│   └── projects/                # One file per venture
├── i18n/                        # next-intl routing, navigation, request config
├── lib/                         # types.ts, utils.ts
└── middleware.ts                # next-intl locale routing
messages/
├── tr.json                      # Turkish copy
└── en.json                      # English copy
public/
├── brand/                       # YULA Lab logo / banner
├── projects/<slug>/             # Per-project brand assets
├── icon.svg, apple-icon.svg
└── manifest.webmanifest
```

## Accessibility & performance budgets

- Server-render everything that does not need client interactivity.
- All interactive elements have a `focusable` outline and keyboard-reachable
  behavior; `aria-label`s on icon-only buttons.
- Critical fonts use `display: swap` and `optimizePackageImports` is set for
  Lucide and Framer Motion to keep client bundles tight.
- Honors `prefers-reduced-motion` via the CSS-only reveal hook in
  [`src/components/common/useReveal.ts`](./src/components/common/useReveal.ts).

## Transactional mail admission

Both public producers take the same PostgreSQL transaction advisory lock before
checking capacity and writing their source, consent and outbox records. The
shared budget is 100 new mail jobs in a rolling 24-hour window and 100 pending
jobs. Leads cost two jobs and can use at most 40 of either budget, preserving
60 pending places for data-request verification even during a delivery outage.
The worker uses the same 100-job constant for its per-run batch.

An exact lead retry within 24 hours, including across UTC midnight, returns its
existing receipt without new work. Changed content gets a new receipt only when
stored. Admission does not disclose address-only submission history. Exhausted
lead capacity returns 429; data requests retain their generic 202 envelope.
Delivery, verification and normal queue cleanup do not refund recent admissions:
accounting uses the retained source rows. A trusted manual early erasure of those
rows changes that accounting and must be considered before such maintenance.

## Deployment

[yulalab.com](https://yulalab.com) uses the existing Netlify project
`yulalab-web` (`65a77e28-286e-415c-a0d1-fab7370a3c57`). The 2026-10-08
provider readback confirmed its Git connection to `kocakkmustafa/yulalab-web`:
`main` automatically publishes production, and pull requests enable deploy
previews. The last healthy deployment was
`6abe74c20082f700082a053c` at source
`66dd2ff9e048e71214cffabfc20b997aa0d8263c`; the retained preceding deployment
`6ab6a95798c19600083d6a5e` is a rollback reference, not a rollback performed
by this candidate.

The separately installed Netlify CLI, its lockfile, and local upload commands
have been removed. Publication uses the existing connected Git build. Local
verification uses the frozen product lock, `pnpm build`, and the existing
localhost tests; it does not produce or accept Netlify packages.

`netlify.toml` retains `pnpm build`, `.next`, the pinned Next.js adapter and
registry headers. A small native Build Plugin runs the existing render-mode
and artifact contracts after Netlify packages Functions and middleware, before
the adapter swaps the publish directory. The contract receives the provider's
absolute output directories, checks the same ZIP, ESZIP, middleware, build-ID,
registry and explicit Node 24 runtime assertions, and fails the build before
deployment if any assertion fails. Python 3.11 or later is required for its
standard-library TOML parser. Provider execution of this plugin is unverified
until a permitted build actually completes it.

Next and its lint preset are pinned to 15.5.27, with the Netlify adapter pinned
to 5.16.2. This follows the [September 30 Netlify compatibility and security
guidance](https://www.netlify.com/changelog/2026-09-30-nextjs-react-security-vulnerabilities/).
The version refresh retains all existing lint rules and artifact assertions;
it does not remove the remaining lint and embedded-adapter braces paths.

Build Node is pinned to 26.9.0 and pnpm to 10.33.0. Verify the effective provider
versions in the build log. `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` must be verified
in the provider environment; Netlify does not support this runtime setting in
`netlify.toml`. The artifact contract rejects a missing or different runtime.
Local native image compatibility exercises Next's own Sharp consumer, rather
than retaining the removed CLI's IPX server.

Before any branch push or PR, inspect every connected provider and GitHub
workflow trigger. The current repository runs GitHub Actions on pull requests
and has a Vercel commit status; a free Netlify preview does not establish that
these other listeners are free or authorized. Do not publish production until
the exact candidate, independent review, dependency gates, provider package
proof and live TR/EN routes, API behavior, ISR, headers and CSP are accepted.
Record the actual deployment ID and final source revision separately.

Vercel Web Analytics is rendered only when the platform exposes `VERCEL=1`.
Local and non-Vercel builds do not request the provider-specific
`/_vercel/insights/script.js` endpoint. Do not set that variable on another
provider to enable analytics; any replacement needs its own implementation
and privacy review.

The hosting policy is free tier only; keep deployments within the Free
allowance and do not enable paid overage. Preserve ISR, API and verification CSP behavior.
`vercel.json` cron entries are Vercel-specific: they do not schedule
jobs on Netlify. Configuring an alternative scheduler and proving delivery and
retention are prerequisites for activating those server workflows there.

## License

Proprietary. See [`LICENSE`](./LICENSE) for permitted use and trademark notice.

## Contact

- **Support and contact:** [support@yulalab.com](mailto:support@yulalab.com)
- **Founder:** [Mustafa Kaan Koçak](https://www.linkedin.com/in/mkkocak)
