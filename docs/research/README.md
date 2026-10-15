# Research

Before building a component we study how every library that ships it built it —
their code is open, so we read the source, not just the docs — and write down
what to copy, what to avoid and what to do differently.

One file per component, named after its row in
[components.md](../components.md) (`dialog.md`, `date-picker.md`). Start from
[_template.md](_template.md). Infrastructure gets notes too (`machine-runtime.md`,
`testing.md`, `focus-trap.md`).

A research note is done when its **Bug history** and **Accessibility** sections are
filled in and its **Decisions** section is concrete enough to write the OpenSpec
change for the component from it. No spec is written before that.

Cross-cutting notes, read before any component note:

- [accessibility.md](accessibility.md) — standards and rules for every component
- [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) — screen reader / browser quirks from real bugs; how we test accessibility
- [native-platform.md](native-platform.md) — which native primitives we build on
- What came out of them: the [support matrix](../accessibility/support-matrix.md) and the
  [manual protocol](../accessibility/manual-protocol.md)
- [machine-runtime.md](machine-runtime.md), [testing.md](testing.md), [overlay-infrastructure.md](overlay-infrastructure.md), [floating-positioning.md](floating-positioning.md), [theme-system.md](theme-system.md) — foundations

## Where to look

| Library | Source | What to look at |
|---|---|---|
| Ark UI / Zag.js | github.com/chakra-ui/zag (`packages/machines/*`) | The machine, the connect function, tests |
| Radix | github.com/radix-ui/primitives (`packages/react/*`) | Composition, DismissableLayer, FocusScope |
| React Aria | github.com/adobe/react-spectrum (`packages/@react-aria/*`, `react-aria-components`) | Interactions, i18n, test-utils |
| Base UI | github.com/mui/base-ui | Newest API decisions, `render` prop |
| Headless UI | github.com/tailwindlabs/headlessui | Minimal APIs, transitions |
| Ariakit | github.com/ariakit/ariakit | Stores, Composite, ariakit-test |
| Reka UI | github.com/unovue/reka-ui | Vue port of Radix + additions (dates, colours) |
| Bits UI | github.com/huntabyte/bits-ui | Svelte 5 patterns |
| Kobalte | github.com/kobaltedev/kobalte | Solid patterns, React Aria-inspired |

Also: the component's WAI-ARIA APG pattern (w3.org/WAI/ARIA/apg/patterns) and the
**issue trackers** — closed bugs are the cheapest lessons available.
