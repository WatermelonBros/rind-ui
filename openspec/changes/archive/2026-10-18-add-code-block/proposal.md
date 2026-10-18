## Why

The docs site shows code everywhere (example frames, Markdown fences) and Reado shows code in
its reader; both need the same thing: code readable as server HTML, a copy button that tells
screen-reader users it worked (or didn't), line numbers that are never copied, highlighted
lines that mean something without colour, soft wrap, a collapsed preview for long blocks, and
tabs for multi-file examples. Only Chakra UI ships a code block (on Ark's Clipboard); Mantine,
Expressive Code and Docusaurus ship styled ones. Their bug history repeats: "Copied" shown when
the write failed (Zag's clipboard machine), feedback only by renaming the button (Zag,
Docusaurus), copy broken outside HTTPS (docusaurus#11791) or inside a modal dialog (#11109),
indentation lost by copying the rendered text (#11414), line numbers misaligned under wrap
(#7907), a tab stop on every block or none on scrolling ones, highlighted backgrounds cut on
horizontal scroll (chakra-ui#10239), empty and CRLF lines miscounted (rehype-pretty-code#157,
#180).

Research: [docs/research/code-block.md](../../../docs/research/code-block.md) (sources, bug
history, accessibility, decisions) · [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md).

**Depends on** `add-foundations`, `add-a11y-foundations` (machine runtime, contracts, drivers,
press, messages, Announcer), `tabs` (multi-file blocks) and `react-adapter`.

## What Changes

- A new injected Environment capability **`clipboard`** in `@rind-ui/core`:
  `writeText(text, { near })` resolving or rejecting; DOM implementation with the Clipboard API
  and an `execCommand("copy")` fallback inserted next to `near` (inside its layer); a fake for
  tests.
- A `code-block` component (machine, connect, contract) and React parts: `Root`, `Header`,
  `Title`, `CopyTrigger`, `WrapTrigger`, `CollapseTrigger`, `Content` (the `pre` and its `code`)
  and `Line`. Several files are a Tabs composition (one block per panel), documented, not a part.
- Built-in highlighting (user decision 2026-10-18, reversing the highlighter-agnostic v1: "the
  highlighting should live directly in the component's code and let you pick the colours at
  most"): a `language` prop; a pure-TypeScript state-stack lexer in `@rind-ui/core` with no
  dependency; grammars for ts/tsx/js/jsx, css, html, json and bash; a public `CodeGrammar` type for
  more languages; tokens as `data-token` spans from a fixed set; colours only through theme custom
  properties `--rind-code-token-*` (light and dark defaults at 4.5:1, forced-colors fallback).
- Escape hatch: `code` plus either `lines` (tokens, rendered as spans) or `html`
  (pre-highlighted HTML, a branded `TrustedCodeHtml` made with `trustedCodeHtml()`) for an
  external highlighter.
- Copy states `idle | copying | copied | error` decided by the write's promise, announced through
  the Announcer (polite), the trigger's name never changes.
- Line numbers by CSS counters (never in the text), 1-based `highlightLines` described once on
  the block, `dir="ltr"` content, a tab stop on Content only while it scrolls.
- Server HTML is complete for reading; no client JavaScript is needed to read the code.
- Driver `getCodeBlock`, theme `code-block.css`, site examples, docs page; the site's example
  frame and Markdown fences move to Code Block (site session, after this change).

## Capabilities

### New Capabilities

- `clipboard`: the injected clipboard capability and its DOM implementation.
- `code-block`: the component.

## Non-goals

- An external highlighter dependency, language detection, JS theme objects, editor-grade
  accuracy (TextMate grammars: the escape hatch covers it), embedded languages in HTML
  (`<script>`/`<style>` bodies render plain).
- Editing (that's an editor), inline code (`<code>` in prose), diff semantics beyond `data-*`
  hooks, line annotations/callouts, character-range highlights.
- Virtualization of very long blocks.
- A standalone Clipboard component (the capability is reusable by one later).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/code-block/code-block.{highlight,grammars}.ts`,
  `apps/site/skins/code-block.css`, `packages/core/src/env/clipboard.ts` (+ DOM implementation in `dom-environment`),
  `packages/core/src/components/code-block/*`, `packages/react/src/code-block/*`,
  `getCodeBlock` in `@rind-ui/testing` (+ fake clipboard in the test environment),
  `packages/theme/src/code-block.css`, site examples, a docs page.
- No new runtime dependency.
- `docs/components.md`: Code Block status → `done` on archive.
