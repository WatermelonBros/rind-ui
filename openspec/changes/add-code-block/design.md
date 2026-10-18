## Context

See proposal.md for why. Sources, bug history and the accessibility analysis are in
[docs/research/code-block.md](../../../docs/research/code-block.md); its Decisions section is
binding unless this document says otherwise.

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, controllable `wrapped` / `expanded`, effects, scheduler, contracts, drivers, `testMachine` |
| `add-a11y-foundations` | press, `messages` + provider, the Announcer (copy feedback), `core/dom/visually-hidden` (the highlighted-lines description) |
| `tabs` | `Files` / `File` are a Tabs composition |
| `react-adapter` | `render`, ids, instance scoping, merged consumer props |

## Goals / Non-Goals

**Goals:** server HTML that reads completely without JavaScript; a copy whose result is the
truth of the write and is announced; no line number ever in the text; no highlighter in the
package.

**Non-Goals:** the proposal's Non-goals.

## Decisions

### 1. Layout

```
packages/core/src/env/clipboard.ts            Clipboard interface (+ fake factory for tests)
packages/core/src/dom/clipboard.ts            DOM implementation (API, fallback near the trigger)
packages/core/src/components/code-block/
├─ code-block.lines.ts      splitLines (CRLF, trailing newline), parseRanges (1-based, inclusive)
├─ code-block.machine.ts    copy · wrap · expand · scrollable
├─ code-block.connect.ts
├─ code-block.contract.ts
├─ code-block.messages.ts
└─ code-block.meta.ts
packages/core/src/dom/overflow.ts             overflow watch (ResizeObserver, remeasure)
packages/react/src/code-block/                Root, Header, Title, CopyTrigger, WrapTrigger,
                                              CollapseTrigger, Content, Line
packages/theme/src/code-block.css
```

`trustedCodeHtml()` and the `TrustedCodeHtml` brand live in `code-block.lines.ts` (core, no DOM).

### 2. Machine

The runtime has no parallel regions: the states are the copy's; wrap and expanded are
controllable values beside them (no state mapping); scrollable is context:

```
copy:      idle ──COPY──► copying ──COPY.DONE──► copied ──after feedback──► idle
                             └──COPY.FAILED──► error ──after feedback──► idle
           copied/error ──COPY──► copying            (a press restarts)
wrap:      bound to `wrapped` (controllable), WRAP.TOGGLE proposes
expanded:  bound to `expanded` (controllable), EXPAND.TOGGLE proposes; default from maxLines
scrollable: context flag, set by OVERFLOW.CHANGE from the measurement effect
```

- `COPY` runs the `writeClipboard` effect (`env.clipboard.writeText(code, { near })`); the effect
  sends `COPY.DONE` / `COPY.FAILED` (late results after unmount are dropped by the runtime).
- `copied` / `error` entries announce (`env.announcer`, polite, key `code-block-${id}`) and call
  `onCopy({ ok, error? })`.
- The feedback duration is a delayed transition through the scheduler (fake time in tests).
- The measurement effect (`core/dom`) observes Content's size and `scrollWidth`/`scrollHeight`
  with a ResizeObserver and re-measures on `data-wrapped` / `data-expanded` changes.

### 3. Lines

`splitLines(code)` normalises `\r\n` and `\r`, drops one trailing `\n`, and returns the lines;
an empty line renders an empty `span` that the theme keeps one line tall
(`min-block-size: 1lh`); no invisible character is added to the text, so copy and selection
stay exact. `html` as a single
string is split the same way (highlighters keep tags balanced per line for highlight.js and Shiki
line output; the docs say to pass per-line HTML when the highlighter spans tags across lines).

### 4. Connect

Content: `dir="ltr"`, `tabindex` `0` only while `scrollable`, `aria-labelledby` Title id or
`aria-label` `messages.label`, `aria-describedby` the highlighted-lines description id when any
line is highlighted. Code: `style` sets `counter-reset: rind-code-line <start-1>` through a CSS
variable (`--rind-code-block-start`). Line: `data-line`, `data-highlighted`. Triggers: buttons
via `buttonLikeProps`, WrapTrigger `aria-pressed`, CollapseTrigger `aria-expanded` +
`aria-controls`, hidden (`hidden`) when not collapsible.

### 5. Several files

A Tabs composition, documented and tested: one block per `Tabs.Panel`; the driver takes the
only block in a panel. No files part (granularity: Tabs already is the part).

### 5b. Content naming

A generic `pre` may not carry `aria-label` (ARIA prohibits naming `generic`). While Content
overflows it gets `tabindex="0"`, `role="group"` and its name; a block that fits has none of
them. The highlighted-lines description (`aria-describedby`) is always present when lines are
highlighted.

### 5c. Lines as inline blocks

Lines are separated by newline text nodes inside `code`, so the text content, a selection and
copy are the source with or without a stylesheet. The theme makes each line an inline block of
at least the scroll width (highlight background on scroll), numbers a `::before` counter with
`user-select: none`, absolutely placed at the line's first row (aligned under wrap).

### 5d. Contract and the copy outcome

The contract's `copy` presses the trigger; `settleCopy` waits (advancing fake time) until the
write settled; `COPY.DONE` and `COPY.FAILED` both map to it, and which one happens is the fake
clipboard's choice: the model test runs once with a succeeding and once with a rejecting fake,
each skipping the other edge. `fakeClipboard({ scheduler, latency })` keeps `copying`
observable on a virtual clock. The copy states are transient for the examples harness (no
static page holds them).

### 6. Theme

`code-block.css`: tokens `--rind-code-block-*` (bg, fg, border, radius, font, line-height,
highlight-bg, highlight-border, gutter-color, max-lines); lines as a grid so a line's background
spans the scroll width; numbers by `::before` with `counter(rind-code-line)` and
`user-select: none`; highlighted line border-inline-start (non-colour cue; `Highlight` under
forced colors); collapse by `max-block-size: calc(var(--rind-code-block-max-lines) * 1lh)`;
contrast of the trigger buttons checked against the code surface.

## Risks / Trade-offs

- [Single-string `html` split on `\n` can break tags that span lines] → documented; per-line HTML
  recommended; tokens are the safe default.
- [`TrustedCodeHtml` is a brand, not a sanitizer] → named and documented as "highlighter output
  only"; the docs show why.
- [New Environment capability] → small, injected, faked; reusable by a later Clipboard
  component.

## Open Questions (answered)

1. `clipboard` Environment capability: yes (`DomEnvironmentOptions.clipboard`, faked in tests).
2. Diff/focus lines: no built-in; `Content`'s `children(line)` lets the consumer put `data-*`
   (and a text alternative) on each `Line`.
3. Several files: a documented Tabs composition, not parts.
