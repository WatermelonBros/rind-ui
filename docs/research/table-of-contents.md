# Table of Contents — research

"On this page": the list of a document's sections, with the one being read marked as you
scroll, and links that take you to a section. The hard part is deciding *which* section is
being read in every situation (short sections, the last ones near the bottom, sticky
headers, a scroll container), not jumping around while a click scrolls the page, and getting
keyboard and screen-reader users to the section, not just scrolling it into view.

One of the nine libraries ships it: Zag / Ark (`toc`). The docs frameworks all have one:
tocbot, Starlight, Docusaurus, Fumadocs, and rind-ui's own site (`apps/site/components/toc.tsx`).

Sources read (October 2026): Zag `packages/machines/toc/src` (`toc.connect.ts`,
`toc.types.ts`, `toc.props.ts`), the issue trackers of Zag, Ark, tocbot, Starlight,
Docusaurus and Fumadocs, and our site's TOC.

## Pattern

No APG pattern. It is a **navigation landmark** (`<nav>` with a name, "On this page") with
a list of links (nested by heading depth). The link to the section being read carries
`aria-current="location"` ("the current location within an environment"). Following a link
is native anchor navigation (`#id`), which updates the URL and the history.

## How the others built it

### Zag / Ark (`toc`)

- `items` (`{ value, depth }`), observed with an IntersectionObserver (`rootMargin`,
  `threshold`, optional `scrollEl`): **every visible heading is active** (`activeIds`, an
  array, controllable, `onActiveChange`).
- Parts: root (`nav`, labelled by a title), title, list, item (`data-depth`, `data-active`,
  `data-first`, `data-last`), link (`aria-current="location"` when active), indicator (its
  rect from the active items).
- Click: scrolls the heading into view (`scrollBehavior`, the container or
  `scrollIntoView`), keeps new-tab and download clicks native, updates the hash with a
  synthetic `hashchange`. `autoScroll` keeps the active item visible in a scrolling TOC.
- Bugs: #3378 (closed) controlled `onActiveChange` reported old values; Root and Nav shared an
  id; Ark #4187 (closed) the same duplicate id.

### tocbot

- Scroll listener with a fixed offset; "bottom mode" for the last headings.
- #376 (closed) a link click broke the highlighting while the page scrolled; #273 (closed)
  flash while scrolling and wrong landing spot; #231 (closed) wrong active with a sticky TOC;
  #391 (closed) bottom-mode detection wrong with a custom scroll container, active link
  "locked"; #392 (open) custom container and refresh.

### Starlight (`starlight-toc` custom element)

- IntersectionObserver over the headings and the content between them.
- #1954 (closed) the last section never highlighted on a large window; #3617 (closed) the TOC
  did not scroll itself to the active item; #1120 (closed) layout shift when highlighting;
  #3940, #4209 (closed) finding a heading's section went exponential and froze the tab.

### Docusaurus

- #1024 scrollspy added late; #1569 (closed) non-Latin headings not highlighted (slug
  mismatch); #2341 slugs differ between TOC and anchors; #11519 TOC not updated for headings
  inside tabs; #11358 (closed) hash links break accessibility and translation.

### Fumadocs

- #670 (closed) items near the bottom of the page could never be highlighted; #1732 (closed)
  the indicator misaligned while scrolling; #3429 (closed) TOC links to headings inside
  inactive tabs did nothing.

### rind-ui site (`apps/site/components/toc.tsx`)

- One current section: the last heading above a reading line one third down the viewport; at
  the very bottom of the page, the last section. `aria-current="location"`, a moving marker.
  Window scroll only; clicks are native anchors; focus is not moved.

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt.

## Accessibility

- A `nav` landmark named "On this page" (or the consumer's title via `aria-labelledby`).
- **One** `aria-current="location"`: the section being read. Several "current" links (Zag's
  visible set) dilute the meaning; visible sections can be styled, but only one is current.
- Links are real `<a href="#id">`: open in a new tab, copy link, history all work.
- **Focus follows the click**: after a keyboard or virtual activation, focus moves to the
  heading (`tabindex="-1"` added if needed), so the next Tab continues in that section and a
  screen reader reads from there. Without it, focus stays in the TOC while the page moved
  (Docusaurus #11358's hash-link problems are the same family).
- Reduced motion: no smooth scrolling.
- The current item's change is **not announced** (it changes constantly while reading).

## Bug history (the patterns)

- Last sections never current at the bottom (Starlight #1954, Fumadocs #670, tocbot #391).
- Highlight jumping through intermediate sections during a click's smooth scroll (tocbot #376,
  #273).
- Sticky headers and containers offset the detection (tocbot #231, #391, #392).
- The TOC list does not follow the current item (Starlight #3617).
- Exponential section lookups freezing the tab (Starlight #3940, #4209).
- Duplicate ids between parts (Zag #3378, Ark #4187); stale controlled values (Zag #3378).
- Slug mismatches and non-Latin ids (Docusaurus #1569, #2341): ids come from the consumer.
- Headings inside hidden panels (Docusaurus #11519, Fumadocs #3429): a target that is not
  rendered or hidden cannot be current or scrolled to.

## Decisions

1. **One current section by a reading line** (our site's rule, made configurable): the last
   heading whose top is above `offset` + `ratio` × viewport height (default 0 + 1/3) in the
   scroll root; at the end of the scroll range, the last heading whose top is in view. It is
   deterministic, has no "nothing active" gaps, and handles short final sections.
2. **Visible sections too**: every item whose section intersects the viewport gets
   `data-visible` (for range indicators), without being current.
3. **Click**: native anchor; the current item is set to the target at once and scroll-driven
   updates are suspended until the scroll settles (no flicker through intermediate items);
   keyboard and virtual activations move focus to the heading. Modifier clicks stay native.
   Smooth scroll unless reduced motion; `scroll-margin-top` on headings is honoured (the
   browser's), `offset` covers sticky headers in detection.
4. **Scroll root**: the window by default, or a `scrollEl`; one scroll listener coalesced per
   frame, headings measured by `getBoundingClientRect` (linear, no section walking).
5. **List auto-scroll**: when the TOC itself scrolls, the current item is kept in view
   (nearest), without scrolling the page.
6. **Items from the consumer** (`{ id, label, depth }`) or `collectHeadings(root, selector)`
   in `core/dom`; missing or hidden targets are skipped.
7. **Indicator part**: positioned by CSS variables from the current item's box.
8. Controllable `value` (current id) with `onValueChange`; the reading line drives it unless
   controlled.

## Open questions

- Heading-level filtering (h2–h3 by default?) is the consumer's selector.
