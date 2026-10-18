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
packages/react/src/code-block/                Root, Header, Title, CopyTrigger, WrapTrigger,
                                              CollapseTrigger, Content, Code, Line, Files, File
packages/theme/src/code-block.css
```

`trustedCodeHtml()` and the `TrustedCodeHtml` brand live in `code-block.lines.ts` (core, no DOM).

### 2. Machine

Parallel regions in one machine (the runtime's existing pattern for independent flags):

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

### 5. Files

`Files` renders `Tabs.Root` with `Tabs.List`; `File` renders a `Tabs.Trigger` (title) and a
`Tabs.Panel` whose children are the block. No new keyboard code.

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

## Open Questions

1. Confirm the `clipboard` Environment capability (shared infrastructure).
2. Diff/focus lines: `data-*` hooks only (proposed) or a text alternative per line?
3. Keep `Files` / `File` as parts (proposed, per the brief) or document a Tabs composition.
