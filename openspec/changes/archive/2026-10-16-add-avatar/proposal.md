## Why

Every library that ships an Avatar has the same bug history: the fallback flashes for
cached images (worst on SSR), never comes back after the picture is removed, waits for a
delay when there is no image at all, and the image ignores `loading="lazy"`,
`referrerpolicy`, preload hints and framework image components — because the status comes
from a hidden `new Image()` probe instead of the element the user sees. Reado shows
person avatars everywhere and has no error fallback today. Avatar is small; getting its
loading status right once also gives the later Image component its core.

Research: [avatar](../../../docs/research/avatar.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md) §1.4,
§2, §8, rules 1, 4, 6 · [assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 K · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (archived: runtime, read-only status, delayed
transitions, contracts with `{ skip }` and prop steps, drivers, `testMachine`, React
adapter with ids, `render`, expected-part rules), `add-a11y-foundations` (`messages`,
dev name check, invariants, platform) and `add-theme-system` (tokens, family matrix — a
request is listed in design.md).

## What Changes

- New shared capability **`image-loading-status`**: the status of a rendered `<img>` —
  `idle | loading | loaded | error` — read from the element itself (load/error events
  plus a `complete` check when the image registers, for images finished before
  hydration), never from a probe; lazy-safe rendering (no `display:none` while loading).
- New capability **`avatar`**: Root / Image / Fallback / Group / GroupOverflow; one stable
  accessible name on Root (`role="img"`) or decorative (`aria-hidden`); fallback rules
  (immediate for no image or error, optional delay only while loading, never re-hidden);
  `data-state` per part; contract, driver, theme.
- `@rind-ui/core`: `avatar` machine, connect, contract, messages; `core/dom/image-status.ts`.
- `@rind-ui/react`: `Avatar.Root`, `Image`, `Fallback`, `Group`, `GroupOverflow`.
- `@rind-ui/testing`: `getAvatar` driver; browser fixtures for slow, broken and cached
  images.
- Theme stylesheet (tier-3 `--rind-avatar-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `image-loading-status`: observing a rendered image's loading status, shared by Avatar
  and the future Image component.
- `avatar`: the Avatar component and Avatar Group.

### Modified Capabilities

None. The theme family request is listed in design.md "Requests to other changes".

## Non-goals

- A detached preload probe, retry/back-off policies, cache busting (retry = change `src`;
  documented).
- An initials or colour-hash helper (scripts vary; a docs recipe with `Intl.Segmenter`
  replaces it). Reado keeps its hue function.
- Presence/status indicators (online dot), badges — consumer markup or Badge later.
- An interactive avatar (button/link) or overflow "show all" popover: composition with
  Button, Popover.
- Group layout logic (`max` counting, overlap): the consumer slices the list; overlap is
  theme CSS.
- `<object>`/`<picture>`-based fallbacks; Image component (wave 3, reuses
  `image-loading-status`).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/image-status/image-status.machine.ts` (shared with Image), `packages/core/src/components/avatar/{avatar.machine,avatar.connect,avatar.contract,avatar.messages}.ts`,
  `packages/core/src/dom/image-status.ts`, `packages/react/src/avatar/*`, `getAvatar` in
  `@rind-ui/testing`, `packages/theme/src/avatar.css`, stories, generated docs page.
- Public API: `avatar` machine/connect/contract, `Avatar` parts, `getAvatar`.
- Reado: `atoms/PersonAvatar.tsx` becomes a decorative `Avatar` and gains an error
  fallback.
- No new runtime dependency.
