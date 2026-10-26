## Context

Research: [docs/research/citation.md](../../../docs/research/citation.md) ("Decisions"). v1
composes the Hover Card service for open/close and positioning; the Citation machine owns only
`pinned`.

## Decisions

### 1. Composition

The adapter runs the Hover Card machine (its open/close, delays, non-modal tab order,
positioning) with `open` controlled as `pinned || hoverOpen`. The Citation machine: states
`idle | pinned`; `PRESS` on a `button` marker toggles `pinned`; `UNPIN` (Escape, an outside
press, the hover card closing by `CLOSE`) returns to `idle`. A `link` marker follows its link on
press and is never pinned.

### 2. Marker

`kind` is `link` when `safeHref(source.url)` returns a URL (http or https only, parsed in a
`try`), else `button`. The marker's accessible name is `messages.name(index, title)` ("Source 1:
Example Domain") via `aria-label`, which contains the visible index (Label in Name). A link gets
`target` (default `_self`) and `rel="noopener noreferrer"` when `_blank`.

### 3. Pending

Without a `source` (still streaming), the Trigger renders as a plain `span` text
(`data-state="pending"`, no role, not focusable); when the source arrives it becomes the marker
in place.

### 4. Card

Hover Card's Content (non-modal; Tab moves into it after the marker). `Source` groups
`SourceTitle` (a `p`, not a heading), `SourceUrl` (the domain, `domainOf`), `SourceSnippet`,
`SourceLink` (the full link). Nothing is announced.

### 5. Helpers (`citation.helpers.ts`)

`safeHref(url, { schemes = ["http:", "https:"] })`, `domainOf(url)` (hostname without `www.`),
`splitByCitations(text, citations: { start, end, index }[])` → segments
`{ kind: "text", text } | { kind: "cite", text, index }` in order, overlapping or out-of-range
ranges dropped (UTF-16 offsets).

### 6. Attributes

Trigger: `data-scope="citation"`, `data-part`, `data-instance`, `data-state` (`closed | open |
pinned | pending`), `data-kind`, `data-pinned`. Source: `data-index`. CitedText: `data-state`.

### 7. Contract

Locate the marker by its name, else the first. Actions `show` (hover/focus), `pin` (press a
button marker), `hide` (Escape). Queries `isOpen`, `isPinned`, `kind`, `href`, `sourceTitle`.
