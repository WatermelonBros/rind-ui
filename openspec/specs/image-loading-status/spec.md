# image-loading-status Specification

## Purpose
Defines how rind-ui observes the loading status of an image it renders: the status is
read from the rendered `<img>` element itself, including images that finished loading
before hydration, and the element is rendered so that native loading features keep
working. Shared by Avatar and the future Image component. Research:
`docs/research/avatar.md`.
## Requirements
### Requirement: Status Values

An image's loading status SHALL be one of `idle` (no image element is registered, or it
has neither `src` nor `srcSet`), `loading`, `loaded` or `error`. The status SHALL be
observed, not controlled: there SHALL be no `status` or `defaultStatus` prop, and every
change SHALL call `onStatusChange(status, details)` with the change details of the
machine runtime (`reason` is the event that caused it).

#### Scenario: Load succeeds

- **WHEN** an image with a valid `src` is rendered and its `load` event fires
- **THEN** the status goes `loading` → `loaded` and `onStatusChange` is called once with
  `"loaded"` and `details.reason === "IMAGE.LOAD"`

#### Scenario: No source

- **WHEN** the image part is rendered with `src={undefined}` and no `srcSet`
- **THEN** the status is `idle` and the rendered `<img>` has no `src` attribute

### Requirement: The Rendered Element Is The Loader

The status SHALL be derived only from the rendered `<img>` element (its `load` and
`error` events and its `complete`, `naturalWidth` and `decode()`); no detached image
SHALL be created to probe the source. Every attribute the consumer passes (`loading`,
`decoding`, `fetchpriority`, `srcSet`, `sizes`, `referrerPolicy`, `crossOrigin`, …)
SHALL therefore reach the one request the browser makes.

#### Scenario: One request with a framework image component (mui/base-ui#5529)

- **WHEN** the image part is rendered through `render` as a framework image component
  that rewrites `src` to an optimised URL
- **THEN** the browser makes exactly one image request, for the optimised URL, and the
  status follows it

#### Scenario: Referrer policy respected (radix-ui/primitives#1616, #3312)

- **WHEN** the image is rendered with `referrerPolicy="no-referrer"` and
  `crossOrigin="anonymous"`
- **THEN** the only request for the image is sent without a referrer and in CORS mode

#### Scenario: Preload hint used (radix-ui/primitives#3727)

- **WHEN** the page's server HTML contains `<link rel="preload" as="image">` for the
  avatar URL and the avatar is server-rendered
- **THEN** the image request starts while the HTML is parsed, before hydration

### Requirement: Images Settled Before Hydration

When the image element registers (first commit, including hydration) and when its
source changes, the status SHALL be computed synchronously from the element: `complete`
with `naturalWidth > 0` → `loaded`; `complete` with `naturalWidth === 0` → the result of
`decode()` (resolved → `loaded`, rejected → `error`); not `complete` → `loading`. A
`load` that fired before event handlers were attached SHALL therefore never be missed.

#### Scenario: Cached image on hydration (mui/base-ui#4468, radix-ui/primitives#2044)

- **WHEN** a server-rendered avatar's image finished loading from cache before React
  hydrated the page
- **THEN** the first snapshot after hydration has status `loaded` and no frame after
  hydration shows the fallback

#### Scenario: Data URL (radix-ui/primitives#2044 comment)

- **WHEN** the image `src` is a base64 data URL that is already decoded at commit
- **THEN** the status is `loaded` in the commit that registered the image, with no
  intermediate `loading` callback

#### Scenario: Broken image finished before hydration

- **WHEN** a server-rendered image failed before hydration (`complete`, `naturalWidth`
  0, `decode()` rejects)
- **THEN** the status is `error` after hydration

#### Scenario: SVG without intrinsic size

- **WHEN** a valid SVG without `width`/`height` reports `naturalWidth === 0` when complete
- **THEN** `decode()` resolves and the status is `loaded`, not `error`

### Requirement: Source Changes And Removal

A change of `src`, `srcSet` or `sizes` SHALL return the status to `loading` (or to
`idle` when no source remains) and re-run the settled check; removing the image element
SHALL return the status to `idle`. An empty string source SHALL be treated as no source
and SHALL NOT be written to the element.

#### Scenario: Profile picture deleted (radix-ui/primitives#1767, huntabyte/bits-ui#88)

- **WHEN** a loaded avatar's `src` becomes `undefined`, or the image part is unmounted
- **THEN** the status is `idle` and the fallback is shown

#### Scenario: Retry by changing the source (radix-ui/primitives#2892)

- **WHEN** an image in `error` is given a new `src` (for example with a retry query
  parameter)
- **THEN** the status is `loading` and follows the new request

#### Scenario: Empty string

- **WHEN** `src=""` is passed
- **THEN** the `<img>` has no `src` attribute and the status is `idle`

### Requirement: Lazy-Safe Rendering

While the status is `loading`, the image
element SHALL be rendered and SHALL NOT be hidden with `hidden`, `display: none` or any
inline style, so a `loading="lazy"` image can intersect the viewport and load. In
`error`, and in `idle` (no `src` and no `srcSet`), the element SHALL carry `hidden`: a
source-less `<img>` with a non-empty `alt` draws its alt text and duplicates the name. The core SHALL write no inline styles on the
image or its siblings. The rendered element SHALL receive `src` after `srcSet`, `sizes`
and `loading`, so engines that start fetching when `src` is set use the right
candidate and loading mode.

#### Scenario: Lazy avatar loads when scrolled into view (radix-ui/primitives#2512, mui/base-ui#2597)

- **WHEN** an avatar with `loading="lazy"` is rendered 3000 px below the fold
- **THEN** no request is made for it until it is scrolled near the viewport, after which
  its status reaches `loaded`

#### Scenario: No source → `<img>` hidden

- **WHEN** the image part is rendered with no `src` and no `srcSet` (status `idle`)
- **THEN** the `<img>` carries `hidden`, and it loses `hidden` once a source is given
  and the status is `loading`

#### Scenario: Attribute order

- **WHEN** the image part is rendered with `srcSet`, `sizes`, `loading="lazy"` and `src`
- **THEN** in the element's attribute order `src` comes after the other three

### Requirement: Shared Machine Location

The image status machine SHALL live at
`core/components/image-status/image-status.machine.ts`, and Avatar SHALL import it from
there (`avatarMachine` SHALL be an exported alias of it), so the Image component reuses
the same machine without moving files.

#### Scenario: Avatar and Image share one machine

- **WHEN** `avatarMachine` is imported from Avatar's entry and the machine is imported
  from `core/components/image-status/image-status.machine.ts`
- **THEN** both refer to the same machine definition

### Requirement: Consumer Handlers And Late Events

Consumer `onLoad` and `onError` handlers on the image part SHALL run for the element's
real events, in addition to the status update. Events that arrive after the service has
stopped, or that belong to a source that has since changed, SHALL NOT change the
status.

#### Scenario: Consumer onError runs (radix-ui/primitives#1651)

- **WHEN** a consumer passes `onError` and the image fails
- **THEN** the consumer handler runs once and the status is `error`

#### Scenario: Load after unmount (huntabyte/bits-ui#2050)

- **WHEN** the avatar unmounts while its image is loading and the `load` event fires
  afterwards
- **THEN** nothing is updated and no warning is logged

