# rind — site concept

Status: draft · 2026-10-15

## The idea: "everything is in a state"

rind-ui ships behaviour and state, never looks. The site makes that visible: **every
element on the page is a component in a `data-*` state, and the styling reacts to it,
in plain sight.** The logo is four letters in four states; the landing is one long
state machine you scroll through; the docs show each component bare first, then
skinned.

Two motifs carry the whole identity:

- **States** (the logo): `data-hover`, `data-loading`, `data-focus-visible`,
  `data-pressed` labelled as chips, reacting for real to pointer and keyboard.
- **Goo** (the motion): page loads, transitions and "skins" arrive as liquid. Style
  drips onto bare structure and peels off again.

## Logo — STATES

The wordmark `rind`, each letter shown in a different UI state:

| letter | state | treatment |
| --- | --- | --- |
| r | `data-hover` | lifts, leaves a hard pink offset shadow |
| ı | `data-loading` | the dot is a spinner |
| n | `data-focus-visible` | a focus ring, breathing |
| d | `data-pressed` | squashes on its baseline |

- The **static mark** (favicon, README, npm) is the wordmark at rest, with the i-dot
  drawn as an open spinner arc. The symbol is that arc alone, or `ı` + arc.
- The **live mark** in the site header is interactive: hovering, focusing or pressing
  a letter changes its state; the chips show the attribute that changed.
- Letters are currently set in Unbounded 900 for exploration; the final wordmark is
  drawn custom from it (wide, very heavy, slanted ascender/terminals).

## Palette

| token | value | use |
| --- | --- | --- |
| `acid` | `#D4FF3A` | landing ground, "on" states |
| `ink` | `#0B0B0C` | type, docs dark ground |
| `pink` | `#FF3D8B` | state accents: focus, hover shadow, selection |
| `night` | `#14001F` | goo / transition ground |
| `paper` | `#F4F2EE` | docs light ground, skeleton views |
| `wire` | `#0D6BFF` | "unstyled" outlines, anchors, wireframes |

Light and dark docs themes; the landing is fixed in its own art direction.

## Type

- **Display**: Unbounded 900 (wordmark family), huge, tight.
- **Text**: a neutral grotesk for long docs reading (Hanken Grotesk, already ours in
  reado-web; open to change).
- **Code / labels**: JetBrains Mono. Every `data-*` chip and state label is mono.

## Landing — storyboard (one page, very simple, very loud)

0. **Loader — "unstyled → styled".** The page boots as raw browser HTML: Times, blue
   links, default buttons. A pink drop falls from the top; where it lands the CSS
   "spreads" (goo mask) and the page dresses itself. Skippable, plays once per session.
1. **Hero.** Giant live wordmark on acid. Cursor proximity drives each letter's state;
   the chips below update. One line: *"Behaviour, accessibility and state. The look is
   yours."* Two buttons: `Get started` · `GitHub`. `pnpm add @rind-ui/react` copy chip.
2. **Peel (scroll, pinned).** A real component (a Select) centred. Scrolling peels its
   skin off like a sticker: the styled version curls away revealing the bare HTML, then
   the `data-*` attributes floating around it, then the state machine graph behind them.
   Camera dollies *through* those layers (perspective + translateZ).
3. **One machine, any skin.** The same Dialog is skinned 6 ways (brutal, glass,
   terminal, paper, y2k, the default theme) in a horizontal pinned strip; drag or
   scroll to swap skins, and the behaviour never changes (focus trap, Esc, etc.).
4. **Testable by design.** A Playwright test types itself out on the left while the
   component on the right is driven by it, live. Model-based test graph lights up
   node by node.
5. **Made for agents.** `llms.txt` streams in like a chat reply; a cursor "agent"
   writes a component with it.
6. **Component wall.** ~90 components as a grid of tiny live specimens. Status
   (done / in progress / planned) as `data-status` chips. Hover wakes one up.
7. **Footer.** The wordmark melts (goo) into the bottom edge. Credits, links.

## Docs

Ark-style structure, rind character:

- Left nav (components grouped), content centre, "on this page" right.
- Each component page: **live example first**, with a toggle `Styled ⇄ Bare`
  (bare = theme off, wire outlines on parts with their `data-scope`/`data-part`
  labels), then usage code, anatomy, API tables (generated from `*.meta.ts` via
  `scripts/docs-gen.ts`), keyboard map, accessibility notes, test-driver usage.
- Examples come from the Storybook stories; API never hand-written.
- Page transitions use the goo wipe; everything inside docs is calm and fast.

## Motion rules

- Expressive on the landing, quiet in the docs.
- Springy, physical: overshoot on states, squash on press, liquid on transitions.
- Lenis smooth scroll on the landing only.
- `prefers-reduced-motion`: no loader, no camera moves, no goo; states change
  instantly; everything stays readable and usable.
- The site's interactive parts are rind-ui components (dogfooding); a11y bar is the
  same as the library's.

## Stack

As reado-web: Next 15 (static export, Cloudflare), React 19, Tailwind 4, lenis,
marked + highlight.js for docs content. Plus `@rind-ui/react` via `workspace:*`.
Heavy effects (goo masks, camera) in CSS/SVG/WebGL-free first; WebGL only if a scene
truly needs it.

## Open questions

- Domain and deploy target (Cloudflare Pages like reado-web?).
- Final text font.
- Whether the theme redesign (end of project) should adopt this palette.
