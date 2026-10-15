# Badge — research

Status: done · Wave: 3

A small piece of status text: a count on an icon button ("3"), a label on a row
("Beta", "Draft"), a dot meaning "unread". It has no state and no interaction. All of
its difficulty is in what assistive technology hears: whether the badge text reaches
the accessible name of the control it sits on, what a "99+" or a bare dot means when
read aloud, and that a badge is never a live region.

Sources: shallow clones read 2026-10-14 (paths repo-relative; React Aria / Spectrum S2
through `git show HEAD:<path>` in the `react-spectrum` clone). Bug history: `gh search
issues` over the ten trackers in [README.md](README.md) (`badge`, `role=alert`) plus
Material UI and Chakra UI, which ship the most used styled Badges; ~60 hits, 12 badge
issues read in full.

## Pattern

- WAI-ARIA APG: **none**. A badge is plain text; ARIA has no `badge` role.
- Roles and attributes: none on the badge itself. The relevant rules are about the
  **host**:
  - A `button`, `link`, `tab`, `menuitem`, `option`, `treeitem` gets its name from
    content (accname §2F) unless it has `aria-labelledby` or `aria-label`. A badge inside
    the host is therefore part of the name — **unless the host has `aria-label`**, which
    replaces the whole content, badge included (accname §2C).
  - A `span` has the `generic` role, on which `aria-label` is prohibited (ARIA 1.2) and
    ignored by most AT (accessibility.md rule 4). A badge cannot carry its own name.
  - The text a badge shows is often not what it means: "99+" is read "ninety-nine plus",
    a dot is read as nothing, "3" alone is ambiguous ("3 what?").
- Keyboard: none. A badge is never a tab stop.
- WCAG: 1.3.1 and 4.1.2 (the count must reach AT through the host's name or
  description), 1.4.1 (a dot or colour alone conveys nothing), 1.4.3 (badge text
  contrast on its fill), 1.4.4 / 1.4.12 (a "99+" must not clip at 200 % zoom or with text
  spacing), 4.1.3 (a changing count is *not* automatically a status message; when the
  change matters, announce it explicitly).

## How the others built it

Only Kobalte ships a headless Badge (components.md). React Spectrum, Ariakit UI,
Material UI and Chakra UI ship styled ones; their trackers hold the lessons.

### Kobalte

- Source: `kobalte/packages/core/src/badge/badge-root.tsx`.
- API: `Badge.Root` (`span`), `textValue?: string` "accessible text description of the
  badge if child is not text".
- Output: `role="status"` **always**, `aria-label={textValue}`.
- Problems: `role="status"` makes every badge a polite live region (`aria-live=polite`,
  `aria-atomic=true` implied): a page of twenty status badges is twenty live regions, and
  a count that updates is spoken wherever the user is, even when the count belongs to a
  control far away. The maintainer's sketch in [KB#363](https://github.com/kobaltedev/kobalte/issues/363)
  asked only for "an optional prop `textValue` for auto populating the `aria-label`"; the
  live role arrived with it. `aria-label` on a `status` element names the region, but the
  host button still does not include it when the host has its own `aria-label`.

### React Spectrum (Spectrum v3 and S2)

- Source: `packages/@react-spectrum/s2/src/Badge.tsx`, `@react-types/badge`.
- A `span` with an inner `span role="presentation"` wrapping `Text`; variants are
  colours; no role. Icon-only badges need a consumer `aria-label`, and Spectrum guidance
  says to avoid them ([RS#4043](https://github.com/adobe/react-spectrum/issues/4043):
  the docs' icon-only example had no label at all; the team declined to add an example
  "we don't want to encourage that").
- [RS#1341](https://github.com/adobe/react-spectrum/issues/1341) (the Badge RFC): "There
  are no hooks needed … a simple span". Confirms: no behaviour, no ARIA of its own.

### Material UI (styled, widely used)

- `Badge` wraps its child and positions `badgeContent`; `invisible` hides it.
- [MUI#22070](https://github.com/mui/material-ui/issues/22070): a link with a mail icon
  (`titleAccess="notifications"`) and a 1000-count badge gets the name "notifications
  99+"; the reporter wanted "99+ notifications". The maintainers' answer was an
  `aria-label` on the link built from the count — rejected by the reporter because
  `aria-label` is not translated by browser translation tools (Heydon Pickering, Adrian
  Roselli), so a visible-text or hidden-text solution is needed.
- [MUI#49441](https://github.com/mui/material-ui/issues/49441) (open, 2026 WCAG 2.2
  assessment): "assistive technology does not get the badge content unless the parent
  label includes it"; "the `dot` variant has no text alternative"; check "99+" is not
  clipped at 200 % zoom; `invisible` must also hide it from AT.

### Ariakit UI (styled layer)

- Slot badges inside controls; [AK#7591](https://github.com/ariakit/ariakit/issues/7591):
  in forced colors the badge fill becomes `Canvas` and there is no border, so "12" reads
  as a stray number beside the label. Standalone badges with a 1 px border survived.
  Several layout fixes (AK#7574, #7588, #7592, #7604) show the visual job is all
  theme: vertical centring of the text, min-width equal to height for one digit, not
  stretching in flex/grid parents.

### Not shipped

Radix, Reka, Bits, Base UI, Headless UI, Zag/Ark, React Aria Components: no Badge.
Radix's early "Status" idea ([RX#19](https://github.com/radix-ui/primitives/issues/19))
wrapped a badge in a live region and was closed in favour of the internal `Announce` —
the separation of *visual status text* from *announcing* that this note adopts.

### Reado

`atoms/Badge.tsx`: a `span` pill with a tone; used for counts in tabs, the activity bar
and toolbars (`ActivityBar.tsx`, `GitPanel.tsx`, `CommentsPanel.tsx`, `Editor.tsx`,
`TerminalPanel.tsx`). Two real bugs:

- **ActivityBar**: the count badge sits inside an `IconButton` whose name is
  `label={t(labelKey)}` (an `aria-label`), so the count is **not announced** — the exact
  MUI#49441 case.
- **GitPanel**: the Sync button's label already spells out the counts ("Sync (↓2 ↑1)"),
  so the badge is redundant for AT and should be `aria-hidden` — which it is not, but
  `aria-label` hides it anyway. Correct by accident.

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- **Never a live region** (rule 23). A badge is display, not announcement. When a count
  change is worth telling the user ("3 new messages"), the app announces it once through
  the Announcer; the badge does not speak on its own, and the contract declares no
  `live-region` trait so a wrapper that adds `role="status"` fails `testMachine`.
- **The count must reach the host's name.** Two supported shapes:
  1. *Name from content* (preferred): the host has no `aria-label`; its content is the
     icon's text alternative plus the badge, so the name is "Comments 3 unread". Works in
     every AT, is translated by browser translation (visible or visually hidden text, not
     an attribute), and survives VoiceOver with hints turned off.
  2. *Host keeps an `aria-label`* (some apps want a stable name for voice control):
     the host's `aria-describedby` references the badge, so it is read as the
     description ("Comments, button, 3 unread"). Weaker: VoiceOver reads descriptions as
     hints after a delay and users can turn hints off. Documented as the fallback.
  A badge inside a host whose name comes from `aria-label`/`aria-labelledby` and that does
  not describe it is a **development warning** (Reado's ActivityBar bug, MUI#49441).
- **Meaningful text for AT.** A `label` prop gives the text AT should hear ("3 unread
  comments", "more than 99 notifications", "unread"); the visible text ("3", "99+", or a
  dot) is then `aria-hidden` and the label is rendered visually hidden
  (`core/dom/visually-hidden`), never as `aria-label` on the `span` (prohibited on
  `generic`, rule 4; and not translated — MUI#22070). Same structure as Avatar's
  `GroupOverflow`.
- **Dots and icon-only badges** have no visible text: they need `label`, or the consumer
  hides them with `aria-hidden` when the host's name already says it (Reado's GitPanel).
  An empty, unlabelled, exposed badge is a development warning.
- **Order in the name.** "Comments 3 unread" vs "3 unread Comments" is DOM order; the
  docs show putting the visually hidden icon label first. We do not reorder (MUI#22070's
  maintainers: too much domain knowledge to bake in).
- **Forced colors**: the fill disappears; the theme draws a 1 px `CanvasText` border so
  the badge stays a badge (AK#7591).
- **Contrast**: badge text on the badge fill ≥ 4.5:1 per tone; the theme builder checks
  the `status` palettes (0007).
- **Zoom / text spacing**: `min-inline-size` equal to the block size, padding in `em`,
  no fixed width — "99+" grows instead of clipping (MUI#49441).
- **RTL**: a corner badge is positioned with logical properties (`inset-inline-end`).
- **Motion**: none. A "pulse" for new counts is fx, not core; if a consumer adds one it
  must respect reduced motion.
- **Native platform**: plain text; nothing native to build on.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Kobalte | [#363](https://github.com/kobaltedev/kobalte/issues/363) | Badge RFC asks only for a `textValue` → `aria-label` | — | Shipped with `role="status"` on every badge | Badge is not a live region; meaningful text through visually hidden text, not `aria-label` on a span |
| Kobalte | [#656](https://github.com/kobaltedev/kobalte/issues/656) | "Upgrade `<Badge>`" tracker (no body) | — | Closed | (No technical content; listed for completeness) |
| Material UI | [#22070](https://github.com/mui/material-ui/issues/22070) | Link with a mail icon and a badge is named "notifications 99+", not "99+ notifications" | Name from content in DOM order; "99+" read literally | Maintainers: use `aria-label` on the host; reporter: `aria-label` is not translated | Keep the count in translatable text; a `label` prop for the spoken text; order is the consumer's DOM |
| Material UI | [#49441](https://github.com/mui/material-ui/issues/49441) (open) | AT does not get the badge unless the parent label includes it; `dot` has no text alternative; "99+" clipped at 200 % | Badge is visual only; host `aria-label` overrides content | Open (WCAG 2.2 assessment) | Dev warning for a badge hidden by its host's `aria-label`; dots need `label`; no fixed width |
| React Spectrum | [#4043](https://github.com/adobe/react-spectrum/issues/4043) | Icon-only Badge example has no `aria-label`; skipped by screen readers | No visible text, no alternative | Closed: icon-only discouraged, label required | Empty / icon-only exposed badge without `label` = dev warning |
| React Spectrum | [#1341](https://github.com/adobe/react-spectrum/issues/1341) | Badge RFC | — | "No hooks needed… a simple span" | Stateless, connect-only (Separator precedent) |
| Ariakit | [#7591](https://github.com/ariakit/ariakit/issues/7591) | In forced colors slot badges lose their fill; "12" reads as a stray number | Fill replaced by `Canvas`, no border | Fixed: border in forced colors | Theme draws a `CanvasText` border under `forced-colors: active` |
| Ariakit | [#7604](https://github.com/ariakit/ariakit/issues/7604) | Badge in a card stretched to the card's width | Flex/grid stretch | Fixed (`align-self`/`justify-self`) | Theme: badge is `inline-flex`, never stretches |
| Ariakit | [#7588](https://github.com/ariakit/ariakit/issues/7588), [#7592](https://github.com/ariakit/ariakit/issues/7592) | Badge text not vertically centred | Line-height vs box height | Fixed | Theme centres with `inline-flex` + `align-items`, `line-height: 1` |
| Radix | [#19](https://github.com/radix-ui/primitives/issues/19) | "Status" component (badge in a live region) proposed | — | Closed in favour of `Announce` | Separate visual status text from announcing |
| Reado | `ActivityBar.tsx` | Activity-bar counts never announced | `IconButton label` → `aria-label` overrides the badge | Present today | Migration: drop `aria-label`, icon label + `Badge label`; or `aria-describedby` |

## Known pitfalls

- Host `aria-label` silently drops the badge (Reado, MUI#49441).
- `aria-label` on a `span` (Kobalte's `textValue`) is ignored by most AT on `generic`
  and is not translated.
- A live role on a badge (Kobalte) speaks every count change from anywhere on the page,
  and twenty badges are twenty regions.
- Hidden badges (count 0, MUI `invisible`) must also be hidden from AT: unmount, or
  `hidden`, not `opacity: 0`.
- Corner badges positioned with `left/right` break in RTL.

## Testing notes

- Nothing to load or time; no machine, no model-based test.
- Browser tests compute the host's accessible name and description with
  `dom-accessibility-api` (0008) for: icon button with visually hidden icon label +
  badge (name contains the badge `label`), icon button with `aria-label` + badge and
  `aria-describedby` (description is the badge `label`), icon button with `aria-label`
  and no description (dev warning logged).
- axe on every story; forced-colors Playwright capture.
- Driver: `getBadge(screen, { within })` → `text()` (the text AT gets: `label` or the
  content), `isExposed()`. The host's own driver (Button) asserts its name.

## Decisions

- **Parts**: `Badge.Root` (`span`), one part. No machine: stateless, connect-only like
  Separator.
- **Props**: `label?: string` — the text AT hears; when set, children are wrapped
  `aria-hidden` and the label is rendered visually hidden.
- **ARIA**: no role, never `aria-live`, never `aria-label` on the root; consumer
  `aria-hidden` passes through (decorative badge).
- **`data-*`**: `data-scope="badge"`, `data-part="root"`, `data-instance`; consumer
  `data-variant` / `data-size` / `data-tone` passed through (theme `status` family).
- **Development warnings** (logger, after mount): exposed badge with no text and no
  `label`; badge inside an interactive host named by `aria-label`/`aria-labelledby` that
  neither contains the badge text nor references the badge in `aria-describedby`;
  `role`/`aria-live` passed to the root (→ the Announcer).
- **Contract**: locate by `data-scope`/`data-part` within a container (no role, no
  name); queries `text()` (accessible text), `isExposed()`; no actions; no traits.
- **Deliberately different**: no `role="status"` (Kobalte); no `aria-label` on a span
  (Kobalte `textValue`); no count/`max` formatting helper ("99+" is the consumer's,
  `Intl.NumberFormat` + `messages` in the docs); no positioning API (CSS).

## Open questions

- Should rind-ui's Button gain a documented "badge slot" that wires
  `aria-describedby` automatically? Not before a second rind-ui host needs it; the docs
  recipe and the dev warning cover it now.
