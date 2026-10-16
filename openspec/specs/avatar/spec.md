# avatar Specification

## Purpose
Defines rind-ui's Avatar: an image of a person or entity with a fallback, a stable
accessible name, fallback timing, server rendering, Avatar Group, data attributes,
contract and theme. The loading status itself is `image-loading-status`. Research:
`docs/research/avatar.md`.
## Requirements
### Requirement: Anatomy

An Avatar SHALL consist of `Root` (a `span`), at most one `Image` (an `img`) and any
number of `Fallback` parts (a `span` each). `Group` (a `div`) and `GroupOverflow` (a
`span`) SHALL compose several avatars. Every part SHALL accept the `render` prop; the
Image part's props and `render` callback SHALL be typed as `img` props. Rendering more
than one Image in a Root SHALL be a development warning.

#### Scenario: Minimal avatar

- **WHEN** `<Avatar.Root aria-label="Ada Lovelace">` with an Image and a Fallback "AL"
  is rendered
- **THEN** exactly one element has role `img`, named "Ada Lovelace"

#### Scenario: Image render types (mui/base-ui#5102)

- **WHEN** a consumer writes a `render` callback for Image that reads `props.src` and
  `props.alt`
- **THEN** it type-checks without casts

### Requirement: One Accessible Name For Every Status

A named Avatar SHALL expose its name on Root: when Root has a consumer `aria-label` or
`aria-labelledby` and is not `aria-hidden`, connect SHALL set `role="img"` on Root. The
Image SHALL render `alt=""` unless the consumer passes `alt`, and the Fallback's text
SHALL NOT be the name, so the accessible name is the same in `idle`, `loading`,
`loaded` and `error`. An Avatar with neither a name nor `aria-hidden="true"` SHALL cause
a development error (the dev name check of `add-a11y-foundations`).

#### Scenario: Name does not change with loading

- **WHEN** an avatar named "Ada Lovelace" goes `loading` → `error` and shows the
  Fallback "AL"
- **THEN** its accessible name stays "Ada Lovelace" and no element named "AL" or with an
  image name is exposed

#### Scenario: Inside a button

- **WHEN** an avatar named "Ada Lovelace" is the only content of a button
- **THEN** the button's accessible name is "Ada Lovelace"

#### Scenario: Unnamed avatar

- **WHEN** an avatar is rendered without a name and without `aria-hidden`
- **THEN** a development error names the Avatar and asks for `aria-label`,
  `aria-labelledby` or `aria-hidden="true"`

### Requirement: Decorative Avatars

When Root has `aria-hidden="true"`, connect SHALL NOT set `role="img"`, the Image SHALL
keep `alt=""`, and no part SHALL be exposed to assistive technology.

#### Scenario: Avatar beside the author's name

- **WHEN** a message shows the author name "Ada Lovelace" next to an avatar with
  `aria-hidden="true"`
- **THEN** the accessibility tree contains the name once, from the text

### Requirement: Fallback Visibility

A Fallback SHALL be rendered while the status is not `loaded` and SHALL be unmounted
when it is `loaded`. Root's `fallbackDelay` (milliseconds, default 0) SHALL delay only
the `loading` status: in `idle` and `error` the Fallback SHALL be shown at once
(after the first commit when `fallbackDelay > 0`). Once a Fallback has been shown, the
delay SHALL NOT hide it again, including after a source change. Each Fallback SHALL
carry `data-state` with the current status so consumers can render different content
for missing, loading and broken images.

#### Scenario: No image waits for nothing (mui/base-ui#5988)

- **WHEN** an avatar with `fallbackDelay={1000}` has no image source
- **THEN** the Fallback is shown in the first commit, not after 1000 ms

#### Scenario: Failed image does not wait for the delay (mui/base-ui#5988)

- **WHEN** an avatar with `fallbackDelay={1000}` gets an image error after 50 ms
- **THEN** the Fallback is shown at 50 ms

#### Scenario: Fast load hides nothing

- **WHEN** an avatar with `fallbackDelay={300}` loads its image in 100 ms
- **THEN** the Fallback is never rendered

#### Scenario: Transparent image

- **WHEN** a PNG with a transparent background reaches `loaded`
- **THEN** no Fallback is rendered behind it

#### Scenario: Fallback content per status (unovue/reka-ui#1169)

- **WHEN** a consumer renders one Fallback with an icon and checks its `data-state`
- **THEN** `data-state` is `idle` without a source and `error` after a failure

### Requirement: Server Rendering

With `fallbackDelay` 0, the server HTML SHALL contain both the Image (with its `src`)
and the Fallback, and hydration SHALL produce no mismatch. With `fallbackDelay > 0` the
server HTML SHALL contain no Fallback (the delay is a client-side setting; documented).
Ids SHALL derive from the root id.

#### Scenario: Image in server HTML (unovue/reka-ui#751)

- **WHEN** an avatar is server-rendered with an image source
- **THEN** the HTML contains the `<img>` with its `src`, so the browser fetches it before
  hydration

#### Scenario: Hydration without mismatch

- **WHEN** an avatar is server-rendered and hydrated in React Strict Mode
- **THEN** no hydration warning is logged

### Requirement: Element Substitution

The Image part rendered through `render` (a framework image component, a `<picture>`
child) SHALL behave exactly like the default `img`: it receives the ref, `alt`,
`data-*`, `hidden` and the `onLoad`/`onError` handlers, and the status follows its
events. No attribute that changes on every render SHALL be required for the status.

#### Scenario: Custom image component renders (chakra-ui/ark#4108)

- **WHEN** Image is rendered through `render` with a custom image component
- **THEN** the custom element is in the DOM while loading and the status reaches `loaded`

#### Scenario: No render loop (chakra-ui/ark#3426)

- **WHEN** Image is rendered through a framework image component that re-renders on
  every prop change
- **THEN** the component renders a bounded number of times while the image loads

### Requirement: Not A Live Region

No Avatar part SHALL be a live region, and status changes SHALL make no announcements.

#### Scenario: Status change is silent

- **WHEN** an avatar goes from `loading` to `loaded`
- **THEN** the announcement log is empty

### Requirement: Avatar Group

`Group` SHALL render `role="group"` and accept a consumer name (`aria-label` or
`aria-labelledby`); a Group without a name SHALL cause a development warning.
`GroupOverflow` SHALL take a `count` prop, render `+${count}` as visible text hidden
from assistive technology, and expose `messages.overflowLabel(count)` (default
"`${count} more`") as visually hidden text. Group SHALL keep no state and choose no
avatars: the consumer renders the avatars it wants and the overflow count.

#### Scenario: Group announced with overflow

- **WHEN** a Group named "Reviewers" has three named avatars and a GroupOverflow with
  `count={4}`
- **THEN** the accessibility tree is a group "Reviewers" containing three images and the
  text "4 more"

#### Scenario: Overflow rendered as a button

- **WHEN** GroupOverflow is rendered as a button through `render`
- **THEN** the button's accessible name is "4 more"

### Requirement: Data Attributes

Root, Image and Fallback SHALL carry `data-scope="avatar"`, `data-part` and
`data-state` (`idle | loading | loaded | error`). Group and GroupOverflow SHALL carry
`data-scope="avatar"` and `data-part="group"` / `"group-overflow"`. `data-variant`,
`data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Error state attributes

- **WHEN** an avatar's image fails
- **THEN** Root, Image and Fallback have `data-state="error"` and the Image has `hidden`

### Requirement: Messages

Every AT-facing string SHALL come from the avatar `messages`: `overflowLabel(count:
number) => string` (English default with `Intl.PluralRules`), overridable per instance
and through the provider.

#### Scenario: Localised overflow

- **WHEN** the provider supplies an Italian `overflowLabel`
- **THEN** GroupOverflow with `count={1}` exposes "1 altro"

### Requirement: Avatar Contract

The avatar contract SHALL locate an instance by role `img` and exact name, or, for a
decorative avatar, by `data-instance`; declare the queries `status()`,
`isFallbackVisible()` and `name()`; the action `waitForStatus(status)` whose
postcondition is the status (no input, every modality); map `IMAGE.LOAD`,
`IMAGE.ERROR`, `IMAGE.MOUNT` and `ROOT.MOUNT` to `{ skip }` with the reason "browser
image fixtures"; and map source changes to prop steps (`$props:src`). It SHALL declare
no traits beyond the generic invariants (name, ids, no live region).

#### Scenario: Driver waits for a slow image

- **WHEN** a test runs `await getAvatar(screen, { name: "Ada Lovelace" }).waitForStatus("loaded")`
  on an image served after 500 ms
- **THEN** it resolves after the load, and `isFallbackVisible()` returns `false`

#### Scenario: Prop step removes the source

- **WHEN** the model runner applies the prop step `src: undefined` to a loaded avatar
- **THEN** `status()` returns `"idle"` and `isFallbackVisible()` returns `true`

### Requirement: Theme

`avatar.css` SHALL style the Avatar on data attributes and `--rind-avatar-*` tokens:
Image stacked over the Fallback in the same grid area (so a still-loading or
server-rendered image paints over the fallback as its bytes arrive, with no fade that
would delay a cached image), initials sized relative to the avatar, Group overlap with logical properties (mirrors in RTL) and a separating ring.
Under `forced-colors: active` the Fallback SHALL have a `CanvasText` border. It SHALL
style its theme family's `data-variant` and `data-size` and `data-tone`.

#### Scenario: Forced colors

- **WHEN** a Fallback avatar is rendered under `forced-colors: active`
- **THEN** its outline is visible against the page

#### Scenario: Right-to-left group

- **WHEN** a Group is rendered with `dir="rtl"`
- **THEN** each avatar overlaps the one to its right

