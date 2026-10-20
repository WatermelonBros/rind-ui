## Why

Every documentation page has an "On this page" list that marks the section being read. Each
implementation re-learns the same failures:
- the last sections are never current (Starlight #1954, Fumadocs #670);
- the highlight flickers through other sections while a click scrolls (tocbot #376);
- sticky headers and scroll containers break detection (tocbot #231, #391);
- the list does not follow the current item (Starlight #3617);
- parts share ids (zag#3378);
- after a click, focus stays in the list while the page moved.

Zag ships one, but it marks every visible heading as current. Our own site has a hand-made
one that the component will replace.

Research: [table-of-contents](../../../docs/research/table-of-contents.md)

Depends on: `add-foundations`, `add-a11y-foundations` (focus, motion), `add-theme-system`.

## What Changes

- A public **Table of Contents** in `@rind-ui/core` (machine, connect, contract, messages,
  meta; `core/dom/reading-position.ts` with `collectHeadings`) and `@rind-ui/react`
  (parts `Root`, `Title`, `List`, `Item`, `Link`, `Indicator`).
- One current section, chosen by a configurable reading line, with the end of the scroll
  range handled. The link to it carries `aria-current="location"`. Visible sections are
  marked too, but are not current.
- Native anchor links:
  - after a click, the target is current at once, with no flicker;
  - focus moves to the heading;
  - the jump is the browser's own (history, `scroll-behavior`, `scroll-margin-top`).
- A window or container scroll root, a sticky-header offset, and an auto-scroll of the list.
- The site's "On this page" is rebuilt on the component.
- `getTableOfContents` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `table-of-contents`; the site's `components/toc.tsx` is rebuilt on it.
- `@rind-ui/testing`: a link to an element of the same document jumps instead of being
  cancelled by the navigation interceptor (a jump never unloads the page).
