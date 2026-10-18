## 0. Prerequisites

- [x] 0.1 Coordinator answers design.md's open questions (clipboard capability, diff lines, Files parts) before section 1

## 1. Clipboard capability

- [x] 1.1 `core/env/clipboard.ts`: the interface on the Environment, a fake (log, reject, absent) for node and DOM tests
- [x] 1.2 `core/dom/clipboard.ts`: Clipboard API checked at call time, fallback node next to `near`, selection and focus restored, reject without throwing; tests for every `clipboard` scenario (insecure context, modal `<dialog>`, restore, both fail)

## 2. Lines and machine

- [x] 2.1 `code-block.lines.ts`: `splitLines` (CRLF, `\r`, trailing newline, empty lines), `parseRanges` (1-based inclusive, numbers and ranges), `trustedCodeHtml` + `TrustedCodeHtml` brand (type test: a raw string is rejected); node tests incl. rehype-pretty-code#157, #180, #238
- [x] 2.2 `code-block.machine.ts`: copy region (`idle | copying | copied | error`, feedback delay, restart on press), wrap and expanded bound to their controllable props, `scrollable` from `OVERFLOW.CHANGE`; announcements and `onCopy`; node tests with the fake clipboard and fake time (Zag "copied before the write" regression)
- [x] 2.3 Overflow measurement effect in `core/dom` (ResizeObserver, re-measure on wrap/expand); browser test

## 3. Connect, messages, meta

- [x] 3.1 `code-block.connect.ts` per design §4; `code-block.messages.ts` (`label`, `copy`, `copied`, `copyFailed`, `wrap`, `expand`, `highlighted`); `code-block.meta.ts` + meta test; unit tests for every attribute in the spec

## 4. React parts

- [x] 4.1 `CodeBlock.Root`, `Header`, `Title`, `CopyTrigger`, `WrapTrigger`, `CollapseTrigger`, `Content`, `Line` (several files: a Tabs composition); `render` on each; tokens rendered as text spans, `html` injected per line
- [x] 4.2 SSR + hydration tests (no mismatch with `html`, Strict Mode), no-JS reading test (server HTML complete), RTL page (`dir="ltr"` on Content)

## 5. Contract and driver

- [x] 5.1 `code-block.contract.ts` (locate, actions `copy` / `settleCopy` / `setWrapped` / `setExpanded`, queries, fake-clipboard event mapping) and `getCodeBlock` in `@rind-ui/testing` with the announcement log; driver tests in jsdom and browser (Playwright fixture deferred to the backlog)

## 6. Tests

- [x] 6.1 Model-based walk (`testMachine`) over copy (success / failure through the fake), wrap and expand, pointer / keyboard / virtual
- [x] 6.2 Browser tests: tab stop only when scrolling (and after resize/wrap), numbers not copied (select-all + copy), numbers aligned under wrap (docusaurus#7907), highlight across horizontal scroll (chakra-ui#10239) in the theme browser test; copy inside a modal `<dialog>` with the fallback (docusaurus#11109) in the clipboard DOM test; indentation kept (#11414) in the DOM test; 3 engines in CI

## 6b. Built-in highlighting (amendment 2026-10-18)

- [x] 6b.1 Research addendum (sugar-high, Prism, highlight.js, Shiki/lezer; known bugs)
- [x] 6b.2 `code-block.highlight.ts` (lexer, `CodeGrammar`, `highlightCode`) and `code-block.grammars.ts` (ts/tsx/js/jsx, css, html, json, bash, aliases, `resolveGrammar`); node tests per grammar for the tricky cases and a 5,000-line input
- [x] 6b.3 Connect `token(type)` + meta; React `language` prop, `data-token` spans, `CodeToken.token`; DOM tests (spans, copy fidelity, unknown language, escape hatch wins, SSR + hydration)
- [x] 6b.4 Theme: `--rind-color-code-*` in tokens.css, `--rind-code-token-*` in code-block.css, dark default scheme, padding (block on content, inline on lines), forced colors; browser tests (contrast in both schemes, override, padding, RTL)
- [x] 6b.5 Site skin `apps/site/skins/code-block.css` (crisp/juicy/bare, the site's code look); every example uses `language`; docs page (when to use, colours, own grammar)

## 7. Theme, site examples, docs

- [x] 7.1 `packages/theme/src/code-block.css` per design §6, imported from `index.css`, family row in `families.ts`; theme browser test (numbers `user-select: none`, highlight cue under forced colors, collapse clip, trigger contrast)
- [x] 7.2 Site examples (`apps/site/examples/code-block.tsx`): plain, tokens, a highlight.js adapter example (`trustedCodeHtml`), line numbers, highlighted lines, wrap, collapse, multi-file Tabs, RTL page, copy failure (fake), driver example; `states` for every contract state; ARIA snapshots for the state examples
- [x] 7.3 Docs page `docs/components/code-block.md` (generated API facts + guide: input forms and why HTML is "trusted", line numbers, copy and its failure modes, SSR without JS, adapters); no other library named
- [x] 7.4 Mark `docs/research/code-block.md` done on archive; set Code Block `done` in `docs/components.md`; changeset for core, react, testing, theme; `pnpm lint`, `pnpm typecheck`, `pnpm docs:check` green
