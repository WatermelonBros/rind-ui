# image Specification

## Purpose
Defines rind-ui's Image: a content image with loading, error and no-source fallbacks
that keeps one stable accessible name in every status, requires an explicit `alt`
decision, and leaves every native image feature intact. The loading status itself is
the shared `image-loading-status` capability. Research: `docs/research/image.md`.
## Requirements
### Requirement: Anatomy

An Image SHALL consist of `Root` (a `span`), exactly one `Img` (an `img`) and any number
of `Fallback` parts (a `span` each). Every part SHALL accept the `render` prop; the Img
part's props and `render` callback SHALL be typed as `img` props without `alt` (the
`alt` is Root's). The status of the Img SHALL follow `image-loading-status`, with the
fallback timing rules Avatar uses (`fallbackDelay` on Root, default 0, applying only
while `loading`; Fallback shown at once in `idle` and `error`; never re-hidden by the
delay). Rendering more than one Img in a Root SHALL be a development warning.

#### Scenario: Minimal image

- **WHEN** `<Image.Root alt="A red bicycle"><Image.Img src="/bike.jpg" /></Image.Root>`
  is rendered and the image loads
- **THEN** exactly one element is exposed as an image, the `img`, named "A red bicycle"

### Requirement: Alt Is Required

`alt` on Root SHALL be a required `string` in the public types, so omitting it is a
compile error; `alt=""` SHALL mean decorative. When `alt` is missing at runtime
(untyped callers), a development error SHALL name the Image and ask for a text
alternative or `alt=""`, and the `<img>` SHALL be rendered without an `alt` attribute,
so automated checks report it; rind-ui SHALL NOT default to `alt=""`.

#### Scenario: Missing alt (regression: React Spectrum S2 warning only)

- **WHEN** an untyped caller renders `<Image.Root>` without `alt`
- **THEN** a development error is logged and axe reports `image-alt` for the `img`

#### Scenario: Types

- **WHEN** a TypeScript consumer writes `<Image.Root><Image.Img src="x" /></Image.Root>`
- **THEN** the code does not compile

### Requirement: One Name In Every Status

For a named image (non-empty `alt`), exactly one exposed element SHALL carry the name
`alt` in every status: while `loading` and `loaded`, the `<img>` (its `alt` attribute)
with Root carrying no role; while `idle` and `error`, Root, with `role="img"` and
`aria-label` set to `alt`. Every Fallback SHALL carry `aria-hidden="true"` in every
status. The name text SHALL NOT change between statuses.

#### Scenario: Still named while loading (regression: Kobalte Image renders the img only when loaded)

- **WHEN** a named image is `loading` with its Fallback visible
- **THEN** the `img` is in the accessibility tree named by `alt`, and the Fallback is not
  exposed

#### Scenario: Still named after an error

- **WHEN** a named image's request fails and its Fallback "Image unavailable" is shown
- **THEN** Root is an image named by `alt`, the text "Image unavailable" is not exposed,
  and no other element is exposed as an image

#### Scenario: No Fallback rendered

- **WHEN** a named image without any Fallback part has no source
- **THEN** Root is an image named by `alt`

### Requirement: Decorative Images

With `alt=""`, Root SHALL carry no role, the `<img>` SHALL carry `alt=""`, every Fallback
SHALL carry `aria-hidden="true"`, and Root SHALL carry `data-decorative`, so nothing of
the image is exposed in any status.

#### Scenario: Decorative in error

- **WHEN** a decorative image fails to load
- **THEN** no element of the image is exposed to assistive technology

### Requirement: Source-Less Image Is Hidden

In `idle` (no `src` and no `srcSet`) and in `error`, the `<img>` SHALL carry `hidden`, so
a source-less or broken image never draws its alt text or a broken-image glyph and never
duplicates Root's name. While `loading` it SHALL NOT be hidden (lazy-safe rendering).

#### Scenario: One-frame flash (regression: chakra-ui#4648)

- **WHEN** an Image is remounted with no source
- **THEN** no frame shows a source-less `<img>`

### Requirement: Native Image Attributes

Every attribute the consumer passes to Img (`loading`, `decoding`, `fetchPriority`,
`srcSet`, `sizes`, `width`, `height`, `referrerPolicy`, `crossOrigin`, …) SHALL reach the
rendered `<img>` unchanged, in the attribute order `image-loading-status` requires.
Image SHALL NOT default `loading` (the browser default applies), and the fallback rules
SHALL NOT depend on `loading`.

#### Scenario: Lazy image keeps its fallback (regression: chakra-ui#7956, #7192)

- **WHEN** an Image with `loading="lazy"` and a Fallback is rendered below the fold
- **THEN** no request is made until it nears the viewport, the Fallback is shown while it
  loads, and the image replaces it once loaded

#### Scenario: Server HTML has the source (regression: chakra-ui#462)

- **WHEN** an Image with a `src` is server-rendered
- **THEN** the HTML contains the `<img>` with its `src`

#### Scenario: One request (regression: chakra-ui#5285)

- **WHEN** an Image with a Fallback loads in Chromium with the cache disabled
- **THEN** exactly one request is made for its source

### Requirement: Ratio Box

Root SHALL accept CSS sizing from the consumer (including `aspect-ratio` and the
`--rind-image-aspect-ratio` token the theme reads) and SHALL keep its box in every
status, so the Fallback occupies the same area as the image and the swap does not shift
the layout. The core SHALL write no inline styles.

#### Scenario: Error keeps the box

- **WHEN** an Image whose Root has `aspect-ratio: 16 / 9` and a width of 320 px fails to
  load
- **THEN** Root stays 320 × 180 px and the Fallback fills it

### Requirement: Data Attributes

Root, Img and Fallback SHALL carry `data-scope="image"`, their `data-part` (`root`,
`img`, `fallback`), `data-instance` and `data-state` set to the status (`idle`,
`loading`, `loaded`, `error`). Root SHALL carry `data-decorative` when `alt` is empty.
Every part SHALL forward `data-variant`, `data-size` and `data-tone` unchanged; the core
SHALL NOT read them.

#### Scenario: Different fallbacks per status

- **WHEN** a consumer styles `[data-part="fallback"][data-state="loading"]` as a
  skeleton and `[data-state="error"]` as an icon
- **THEN** each status shows its own fallback look

### Requirement: Image Contract

The `image` contract SHALL locate a named instance by role `img` and exact accessible
name in every status, and a decorative one by `data-instance`. It SHALL declare the
queries `status()`, `isFallbackVisible()` and `name()`, the action `waitForStatus(status)`
(an observation with a postcondition, no keyboard twin), no traits, and map the image's
load, error, mount and settle events to `{ skip }` with the reason "browser image
fixtures" and source changes to `$props:src` steps, as Avatar's contract does.

#### Scenario: Same handle in every status

- **WHEN** a test gets `const img = getImage(screen, { name: "A red bicycle" })` while it
  loads, and the request then fails
- **THEN** the same driver keeps locating it, and `await img.status()` is `"error"`

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the image contract SHALL run over the props classes no source,
data-URL source, failing source and slow source, each named and decorative, and SHALL
check after each step that exactly one exposed element has role `img` and name `alt`
(zero for decorative), that it is the `<img>` in `loading`/`loaded` and Root in
`idle`/`error`, and that the `<img>` is `hidden` exactly in `idle` and `error`.

#### Scenario: Wrapper drops the name

- **WHEN** a consumer wrapper overrides Root's `aria-label` with an empty string and runs
  `testMachine`
- **THEN** the run fails in the `error` step naming the Root part

### Requirement: Theme Expectations

The theme stylesheet SHALL stack Img and Fallback in the same area of Root (a one-cell
grid), make the Img fill Root with `object-fit` from `--rind-image-fit` (default
`cover`) when Root has a ratio, read the ratio from `--rind-image-aspect-ratio` (default
`auto`), never fade the image in, and draw a 1 px `CanvasText` border on a visible
Fallback under `forced-colors: active`. It SHALL read only `--rind-image-*` tokens with
semantic fallbacks and SHALL NOT override `[hidden]`.

#### Scenario: Cached image paints at once

- **WHEN** a server-rendered Image whose source is cached is hydrated
- **THEN** the image is painted without any transition and no Fallback frame is shown

#### Scenario: Forced colors

- **WHEN** an Image in `error` is rendered with `forced-colors: active`
- **THEN** its Fallback box is visible

