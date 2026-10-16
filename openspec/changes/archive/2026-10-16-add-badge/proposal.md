## Why

Counts on icon buttons, "Beta" labels and unread dots are everywhere, and they fail
assistive-technology users in the same few ways: the host button's `aria-label` drops
the count (Reado's activity bar today, mui/material-ui#49441), "99+" and dots mean
nothing read aloud, `aria-label` on a `span` is ignored and untranslated
(mui/material-ui#22070), and the only headless Badge makes every badge a live region
(Kobalte's `role="status"`). The component is tiny; specifying the rules once — and a
development check for the host-name case — removes the whole class of bugs.

Research: [badge](../../../docs/research/badge.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md)
rules 1, 4, 23 · [assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 K · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (archived: contracts, drivers, React adapter with
`render`, ids, instance scoping), `add-a11y-foundations` (dev logger, `core/dom/visually-hidden`,
invariants incl. rule 23) and `add-theme-system` (tokens, `status` family, stylesheet
convention). Stateless and connect-only, following `add-separator`.

## What Changes

- `@rind-ui/core`: `badge` connect (pure function, no machine), contract, development
  checks (exposed badge with no text; badge hidden by its host's `aria-label`; live
  roles passed to it).
- Behaviour: a `span` with no role and no live region; an optional `label` gives the
  text assistive technology hears (visible text `aria-hidden`, label visually hidden);
  the count reaches the host through name-from-content, or through the host's
  `aria-describedby` when the host keeps an `aria-label`.
- `@rind-ui/react`: `Badge.Root` with `render`.
- `@rind-ui/testing`: `getBadge` driver.
- Theme stylesheet (`--rind-badge-*`, `status` family), stories, docs page with the
  icon-button recipe.

## Capabilities

### New Capabilities

- `badge`: the Badge component — anatomy, no live region, AT text, host naming rules
  and their development check, `data-*`, contract and driver, theme expectations.

### Modified Capabilities

None.

## Non-goals

- Announcing count changes: the app calls the Announcer when a change is a status
  message (documented); a badge never speaks.
- Count formatting (`max`, "99+", plurals): consumer code with `Intl.NumberFormat` and
  its own messages; the docs show the recipe.
- Positioning a badge on a corner of its host (consumer / theme CSS with logical
  properties) and show/hide animation.
- An interactive badge (removable chip, filter): that is Tag Group.
- A badge slot on Button that wires `aria-describedby` automatically (research Open
  question; not before a second host needs it).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/badge/{badge.connect,badge.contract}.ts`,
  `packages/react/src/badge/*`, `getBadge` in `@rind-ui/testing`,
  `packages/theme/src/badge.css`, stories, generated docs page.
- Public API: `badgeConnect`, `badgeContract`, `Badge`, `getBadge`.
- Reado: `atoms/Badge.tsx` becomes a themed `Badge.Root`; the activity bar's icon
  buttons stop hiding their counts (Migration in design.md).
- No new runtime dependency.
