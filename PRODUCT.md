# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Developers adopting rind-ui** (React today, other frameworks later) who want
  accessible, well-tested components and a default look good enough to ship as-is.
- **White-label teams** who re-skin one product for many brands or tenants from a
  handful of brand inputs, at runtime, without forking CSS.
- **Contributors and the maintainers**, who live in Storybook while building.
- **LLM coding agents** reading the generated docs (`llms.txt`) to use the library.

## Product Purpose

rind-ui is an open-source headless component library written from scratch, aiming at
100% of Ark UI's components plus more (AI-UI primitives). Behaviour lives in
framework-neutral state machines; each component exposes `data-*`/ARIA attributes
that are both the styling and the testing contract. `@rind-ui/theme` is an optional
CSS theme on top: it must look polished out of the box, and stay a re-skinnable base.

## Positioning

- Accessibility researched per component against other libraries' bug histories.
- Testing as a feature: every component ships a contract and drivers (Testing Library
  and Playwright) and model-based tests.
- White-label theming: brand inputs → derived tokens in CSS (OKLCH relative colour,
  `light-dark()`), plus a typed builder that validates WCAG contrast in light and dark.

## Operating Context

The theme is judged first on the future documentation site (Ark-UI-like: live demos
per component), then in Storybook, then inside customers' white-labelled apps. The
first real consumer is Reado, an IDE (dense, long sessions, light and dark).

## Capabilities and Constraints

- Theme architecture is fixed: three token tiers (brand inputs → semantic → component),
  `@layer rind.*` so unlayered consumer CSS wins, scopes via `[data-rind-theme]`,
  light/dark orthogonal, consumer-set `data-variant` (solid/soft/outline/ghost),
  `data-size` (sm/md/lg), `data-tone` (accent/neutral/danger/warning/success).
- Token names and the builder API stay; values, presets (which exist and their names),
  typography, spacing, radius, elevation, motion and component stylesheets may change.
- Styles select only on `data-scope`/`data-part`/`data-state`, never classes; no
  CSS-in-JS runtime; CSP-safe; SSR without flash; forced colors and reduced motion.
- Icons: Phosphor glyphs as CSS mask tokens (`--rind-icon-*`).
- Components implemented so far: Link, Heading, Button; the theme must scale to ~100.

## Brand Commitments

Name: rind-ui (part of Watermelon). No logo or visual identity yet. The user judged
the first theme's look unacceptable ("fa cagare") and asked for a complete visual
redesign; the old look is evidence only.

## Evidence on Hand

No benchmarks, testimonials or adopters yet; do not fabricate any. Real content:
the components, `docs/components/*.md`, `docs/theme/*.md`, Storybook stories.

## Product Principles

1. Accessible by construction; contrast is validated, never hoped for.
2. Beautiful defaults, owned by the consumer: any brand re-skins everything.
3. Native platform first; behaviour is honest about what the browser does.
4. Every surface is testable and documented from the code.

## Accessibility & Inclusion

WCAG 2.2 AA in light and dark (text 4.5:1, UI and focus 3:1), forced colors,
reduced motion, 200% text zoom, touch targets via hit-area tokens.
