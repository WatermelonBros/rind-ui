## Purpose

Defines rind-ui's Toast: brief notifications created from anywhere in an application,
shown in a named region, announced to assistive technology without moving focus,
paused while the user attends to them, reachable and dismissible by keyboard, and
usable above modal layers — its store, lifetime, parts, attributes, keyboard
behaviour and the contracts its drivers and model-based tests are generated from.
Announcer, keep-visible, presence, portal and swipe mechanics come from the changes
this one depends on and are not restated.

## ADDED Requirements

### Requirement: Toaster Store

`createToaster(options)` SHALL return a store that can be created and called from any
module, with no framework, provider or component mounted. Options SHALL include
`placement` (`top-start`, `top-center`, `top-end`, `bottom-start`, `bottom-center`,
`bottom-end`; default `bottom-end`), `limit` (default 3), `duration` (default 5000 ms),
`gap`, `expand` (default `false`), `hotkey` (default `F6`) and `swipeDirections`. The store SHALL offer `show`,
`success`, `error`, `info`, `warning`, `loading`, `promise`, `update`, `dismiss` (one id,
or all), `pause`, `resume`, `get(id)`, `toasts()` and `subscribe`. Several stores SHALL
coexist on a page, each shown by its own region, and no toast SHALL appear in a region
other than its store's. Store operations SHALL be synchronous and applied in call order.

#### Scenario: Called from library code (Reado `notify`)

- **WHEN** a non-UI module imports a store created with `createToaster()` and calls
  `toaster.error("Could not save")` before any component renders
- **THEN** the call returns an id and, once the store's region mounts, an error toast
  titled "Could not save" is shown

#### Scenario: Two toasters

- **WHEN** an app has a `bottom-end` store for notifications and a `top-center` store
  for connection status, and calls `status.info("Offline")`
- **THEN** the toast appears only in the `top-center` region

#### Scenario: Add while another disappears (react-spectrum#9930)

- **WHEN** one toast's timer elapses and another toast is shown in the same task
- **THEN** the first is dismissed and the second is shown

### Requirement: Toast Data And Ids

A toast SHALL carry an `id` (generated unless given), a `type` (`info` default,
`success`, `warning`, `error`, `loading`), an optional `title`, an optional
`description`, an optional `action` (`{ label, onAction, closes? }`), an optional
`duration`, an optional `dismissible` (default `true`) and optional consumer `meta`.
Showing a toast with the id of a toast that is visible SHALL update it in place and
restart its lifetime. Showing a toast with the id of a toast that is being dismissed
SHALL create a new toast instance with that id, independent of the leaving one.

#### Scenario: Same id while visible

- **WHEN** `show({ id: "sync", title: "Syncing…" })` is followed by `show({ id: "sync",
  title: "Synced" })`
- **THEN** one toast is shown, titled "Synced", and its lifetime restarted

#### Scenario: Same id during exit (sonner#791, sonner#730, mui/base-ui#5253)

- **WHEN** a toast with id `"saved"` is dismissed and, while its exit animation runs,
  `show({ id: "saved", title: "Saved" })` is called
- **THEN** the leaving toast finishes its exit and is removed, a new "Saved" toast is
  shown with correct stack index, and it is not marked as dismissed

### Requirement: Toasts Without A Region

A store SHALL keep toasts shown while no region of that store is mounted, and SHALL
show them, newest first, when a region mounts. A toast's lifetime SHALL NOT elapse
while no region of its store is mounted. A toast that was dismissed SHALL never be
shown again by a region that mounts later.

#### Scenario: Toast before the toaster mounts (zag#2922, sonner#723, mui/base-ui#4986)

- **WHEN** an app shows a toast during start-up, before the `Toaster` has rendered
- **THEN** the toast is shown when the `Toaster` mounts, with its full lifetime

#### Scenario: Route change unmounts the toaster (sonner#786)

- **WHEN** a toast is visible, a route change unmounts the layout holding the
  `Toaster`, and a new layout mounts another `Toaster` for the same store
- **THEN** the toast is shown again with the lifetime it had left, and once it is
  dismissed no later mount shows it

### Requirement: Lifetime

A toast SHALL be dismissed with reason `timeout` when its lifetime elapses while not
paused. The lifetime SHALL be the toast's `duration`, else the store's. A toast SHALL be
persistent (no timeout) when its type is `loading`, its duration is `Infinity`, or it
has an action and no explicit `duration`. Updating a toast's type or duration SHALL
reset its remaining time to the new duration. Pausing and resuming SHALL keep the time
already elapsed. Timers SHALL use the injected scheduler and clock.

#### Scenario: Undo stays until handled (mui/base-ui#4253)

- **WHEN** `show({ title: "Message archived", action: { label: "Undo", onAction } })`
  is called with no duration
- **THEN** the toast does not dismiss itself, and a keyboard user can reach "Undo"
  with the hotkey at any later time

#### Scenario: Loading becomes success (radix#2233)

- **WHEN** a loading toast that was paused while persistent is updated to `success`
  with a 5000 ms duration and the pause ends
- **THEN** it dismisses 5000 ms later

#### Scenario: Repeated hover (zag#295)

- **WHEN** a 5000 ms toast is hovered for 1 s after 2 s, then left, three times
- **THEN** it dismisses after 5000 ms of un-hovered time in total, not earlier and not
  later

### Requirement: Pausing

A toast's lifetime SHALL be paused while at least one pause reason holds, and SHALL
resume only when none holds. The reasons SHALL be: a mouse or pen pointer is over its
region (never touch hover); focus is inside its region; the document is hidden
(`page-visibility`); the toast is being swiped; no region of its store is mounted; the
toast is beyond the visible limit; or the consumer paused it or the whole store with
`pause()`, until the matching `resume()`. Window blur SHALL NOT be a reason. A toast
shown while region-level reasons hold SHALL start with them. Dismissing a toast SHALL
clear the reasons it held, so no reason outlives the condition that set it.

#### Scenario: Explicit pause survives a tab switch (zag#2238)

- **WHEN** the consumer calls `toaster.pause(id)`, switches tabs and comes back
- **THEN** the toast is still paused until `toaster.resume(id)`

#### Scenario: Closing a focused toast (radix#2268, radix#2461, kobalte#564)

- **WHEN** the user tabs into the region, presses a toast's close trigger, and focus
  leaves the region
- **THEN** the remaining toasts' timers run again, and toasts shown afterwards dismiss
  on time

#### Scenario: Shown while hovered (react-spectrum#8131)

- **WHEN** the pointer is over the region and a new toast is shown
- **THEN** the new toast is paused until the pointer leaves

#### Scenario: Iframe focus (radix#1362)

- **WHEN** the user clicks into an iframe on the page while a toast is shown
- **THEN** the toast's timer keeps running

#### Scenario: Background tab

- **WHEN** a toast is shown and the tab is hidden for a minute and shown again
- **THEN** the toast is still shown with the lifetime it had when the tab was hidden

### Requirement: Dismissal Reasons

Every dismissal SHALL carry a reason: `close-trigger`, `action`, `escape-key`, `swipe`,
`timeout` or `api`, passed to the toast's `onDismiss(reason)` and the store's
subscribers, and exposed as `data-dismiss-reason` while the toast exits. A toast with
`dismissible: false` SHALL ignore `close-trigger`, `escape-key` and `swipe` and render
its close trigger disabled.

#### Scenario: Reason in the callback

- **WHEN** the user presses Escape on a focused toast
- **THEN** `onDismiss` receives `"escape-key"` and the exiting toast has
  `data-dismiss-reason="escape-key"`

### Requirement: Announcements

Each shown toast and each change of a shown toast's title, description or type SHALL be
announced once through the injected announcer, with the toast's locale, as the title
and description text (and, when the toast has an action, the `actionHint` message
naming the hotkey), keyed by the toast id so a pending message for the same toast is
replaced. The priority SHALL be `assertive` for `error` toasts and `polite` otherwise.
The region, the list and the toasts SHALL NOT be live regions and SHALL NOT carry
`aria-live`. Nothing SHALL be announced on dismissal.

#### Scenario: First toast is spoken (radix#3634, reka-ui#2469, kobalte#411)

- **WHEN** the first toast of the page session is shown
- **THEN** exactly one polite announcement with its title and description is made, and
  no element of the toaster carries `aria-live`

#### Scenario: Promise toast

- **WHEN** a promise toast shows "Uploading…" and the promise rejects 2 s later with
  error options "Upload failed"
- **THEN** "Uploading…" was announced politely and "Upload failed" assertively

#### Scenario: Readable text (reka-ui#2611)

- **WHEN** a toast with title "Saved" and description "3 files" is shown
- **THEN** the announcement text is "Saved. 3 files", with no markup, brackets or
  `null`

#### Scenario: Action hint

- **WHEN** a toast with an "Undo" action is shown with the default hotkey and messages
- **THEN** the announcement ends with "Press F6 to reach the action."

### Requirement: Region

While its store has at least one shown toast, the region part SHALL render as a
`section` with `role="region"`, an accessible name from `messages.regionLabel` that
includes the hotkey (default "Notifications (F6)"), `tabindex="-1"` and
`data-rind-top-layer`; it SHALL contain a list part (`ol`) whose items are the toasts,
newest first in DOM and Tab order regardless of placement. With no toast shown, the
region SHALL render nothing. The region SHALL work inline or inside the shared `Portal`
part, and SHALL carry `dir` and `lang` of its logical parent.

#### Scenario: Empty toaster is not a landmark (zag#2988)

- **WHEN** no toast is shown
- **THEN** the page has no toaster region in its landmarks

#### Scenario: Valid list semantics (radix#1750, radix#3190, reka-ui#2486, ark#3686)

- **WHEN** three toasts are shown and axe runs
- **THEN** there are no `aria-allowed-role`, `list` or `listitem` violations, and a
  screen reader reports each toast's position in the list

### Requirement: Toast Semantics

Each toast's root part SHALL be an `li` with no `role` attribute, `tabindex="0"`,
`aria-labelledby` pointing at its title part and `aria-describedby` at its description
part, each only while that part is rendered, never the same id, and never `aria-hidden`.

#### Scenario: Custom content without a title part (zag#3400)

- **WHEN** a toast with a `title` in its data is rendered with custom markup that omits
  the title part
- **THEN** the root has no `aria-labelledby`

#### Scenario: Name and description differ (react-spectrum#5329)

- **WHEN** a toast with a title and a description is focused
- **THEN** its accessible name is the title and its description is the description

### Requirement: Hotkey And Focus

Pressing the hotkey anywhere in the document while the region is rendered SHALL
remember the focused element, move focus to the newest toast, expand the stack and
prevent the key's default action. It SHALL be matched with the shared hotkey matcher
and SHALL do nothing while the region is not rendered. Focus SHALL return to the
remembered element (when connected and not inert; otherwise focus stays in the region
or, if it empties, on the nearest connected history entry) when the user presses the
hotkey again inside the region, Shift+Tab on the first tabbable element of the newest
toast, or Tab on the last tabbable element of the oldest toast. When the focused toast
is removed, focus SHALL move to the next newer toast, else the next older toast, else
the remembered element; never to `body`. When focus entered the region with a pointer,
removal of the focused toast SHALL return focus to the remembered element. No focus
sentinel element SHALL be rendered.

#### Scenario: Jump in and back

- **WHEN** focus is in a text field, two toasts are shown, the user presses F6, then
  Shift+Tab
- **THEN** F6 focused the newest toast and paused both, Shift+Tab returned focus to the
  text field, and the timers resumed

#### Scenario: No sentinels (radix#2584, reka-ui#2776)

- **WHEN** toasts are shown and axe runs
- **THEN** there is no `aria-hidden` element with a `tabindex` in the toaster

#### Scenario: Focused toast removed

- **WHEN** keyboard focus is on the middle of three toasts and it is dismissed
- **THEN** focus is on the newer of the two remaining toasts

#### Scenario: Close button reached by Tab (zag#2258)

- **WHEN** focus is on a toast and the user presses Tab
- **THEN** focus moves to the first button inside that toast

### Requirement: Keyboard Interactions

The toaster SHALL support: the hotkey (default F6) to enter and leave the region;
Tab and Shift+Tab through toasts and their buttons in native order, newest toast first;
Escape on a focused toast or an element inside it to dismiss that toast only, with
`preventDefault()` so no layer beneath closes; Enter and Space on action and close
triggers to activate them.

#### Scenario: Escape closes only the focused toast (radix#2906)

- **WHEN** three toasts are shown, focus is on the oldest, and the user presses Escape
- **THEN** only the oldest toast is dismissed

### Requirement: Actions

An `action-trigger` part SHALL render a `button` with `type="button"`, named by its
content or `action.label`. Activating it SHALL call `onAction` and dismiss the toast
with reason `action`, unless `action.closes` is `false`. The action SHALL be reachable
through the hotkey for as long as the toast is shown.

#### Scenario: Action that keeps the toast (reka-ui#2626)

- **WHEN** an action with `closes: false` is activated
- **THEN** `onAction` runs and the toast stays shown

### Requirement: Close Trigger

A `close-trigger` part SHALL render a `button` with `type="button"`, named by its
content or, when it renders none, by `messages.close` (default "Dismiss
notification"). Activating it SHALL dismiss the toast with reason `close-trigger`. In
development, a persistent toast rendered without a close trigger SHALL log one warning,
because touch screen-reader users cannot press Escape or swipe.

#### Scenario: Icon-only close

- **WHEN** a close trigger renders only an icon with `messages={{ close: "Chiudi" }}`
- **THEN** its accessible name is "Chiudi"

#### Scenario: Persistent without a way out

- **WHEN** an actionable toast with no duration is rendered without a close trigger
- **THEN** one development warning names the toast id

### Requirement: Stacking And Expansion

The toaster SHALL be `collapsed` by default and SHALL become `expanded` while a mouse
or pen pointer is over the region, while focus is in it, or by the hotkey, and
`collapsed` when none holds — not while a swipe is in progress and not while the pointer
crosses the gaps between toasts. With the store option `expand: true` the toaster SHALL stay
expanded. Each toast's layout height SHALL be measured
(ignoring CSS transforms) when it mounts and whenever its size changes, and exposed with
its stack position as CSS custom properties on the toast and region parts. A toast
SHALL keep its last offset while it exits.

#### Scenario: Hover across gaps (ark#3404)

- **WHEN** the pointer moves from one toast to the next across the gap between them
- **THEN** the toaster stays expanded

#### Scenario: Collapsed sibling measured unscaled (zag#3173)

- **WHEN** a sibling toast is scaled to 0.9 in the collapsed stack and its height is
  measured
- **THEN** `--rind-toast-height` is its unscaled layout height

#### Scenario: Content grows after a promise resolves (mui/base-ui#3336)

- **WHEN** a loading toast's description becomes two lines longer on success
- **THEN** `--rind-toast-height` and the offsets of older toasts update

### Requirement: Visible Limit

At most `limit` toasts SHALL be presented; older shown toasts beyond the limit SHALL be
held: kept in the store, marked `data-limited`, `inert`, not announced again, and with
their lifetime paused. When a presented toast leaves, the newest held toast SHALL be
presented again. No toast SHALL be dropped because of the limit.

#### Scenario: Burst of five with limit 3 (zag#2403, react-spectrum#7917)

- **WHEN** five toasts are shown in a row with `limit: 3` and the newest is dismissed
- **THEN** the toast shown second (now third newest) is presented again, and every
  toast is eventually presented

### Requirement: Swipe To Dismiss

Each toast root SHALL be swipeable through the shared `swipe-gesture` with the store's
`swipeDirections`, by default the placement's edge (`down` for bottom placements, `up`
for top ones) and the inline-end direction (`right` in left-to-right, `left` in
right-to-left documents). A release SHALL dismiss with reason `swipe` only when it
reports an allowed, non-null direction and its offset reaches the threshold (default
45 px) or its velocity reaches the threshold (default 0.11 px/ms); otherwise the toast
SHALL return to rest. A swipe SHALL pause the toast while it is in progress. A
`dismissible: false` toast SHALL NOT be swipeable.

#### Scenario: Flick in an excluded direction (sonner#762)

- **WHEN** `swipeDirections` is `["up", "right"]` and the user flicks a toast left fast
- **THEN** the toast stays shown

#### Scenario: Right-to-left (radix#2368)

- **WHEN** a `bottom-end` toaster renders under `dir="rtl"` and the user swipes a
  toast left past the threshold
- **THEN** it is dismissed with reason `swipe`

#### Scenario: Released outside the window (radix#4141, sonner#779)

- **WHEN** a swipe is cancelled by `pointercancel` or the pointer is released outside
  the window
- **THEN** the toast returns to rest, its swipe variables are 0 and its timer resumes

### Requirement: Promise Toasts

`toaster.promise(promiseOrFunction, { loading, success, error }, shared?)` SHALL show a
`loading` toast, then update the same toast to `success` (options or a function of the
value) or `error` (options or a function of the reason), each with its own `duration`
and other options, and SHALL return the id and a promise of the original outcome. When
`success` or `error` is omitted, the toast SHALL be dismissed on that outcome. A toast
dismissed or re-shown with a new promise before the first settles SHALL NOT be updated
by the first promise.

#### Scenario: Per-state duration (mui/base-ui#2291)

- **WHEN** `success` is `{ title: "Done", duration: 2000 }`
- **THEN** the toast dismisses 2000 ms after the promise resolves

#### Scenario: Dismissed while loading

- **WHEN** the user dismisses a loading toast and its promise resolves later
- **THEN** no toast reappears

### Requirement: Above Modal Layers

The region SHALL stay exposed, focusable and pressable while a modal layer is open, by
carrying `data-rind-top-layer` (outside-inert keep-visible rule). Pressing or focusing
anything inside the region SHALL NOT dismiss any open layer. Toasts SHALL NOT be layers:
opening or closing a dialog SHALL NOT dismiss toasts, and Escape SHALL dismiss a toast
only when focus is inside it.

#### Scenario: Undo above a modal dialog (radix#4115, radix#2949)

- **WHEN** a modal dialog is open and a toast with "Undo" is shown
- **THEN** the region is not inert, has no `aria-hidden` ancestor, and "Undo" can be
  activated by pointer and by F6 then Tab

#### Scenario: Pressing a toast keeps the dialog open (zag#885, ark#2974, radix#2690, reka-ui#624)

- **WHEN** a dialog or drawer that closes on outside press is open and the user presses
  a toast's close trigger
- **THEN** the toast is dismissed and the dialog stays open

#### Scenario: Escape on a toast inside a dialog session

- **WHEN** a modal dialog is open, the user presses F6 and then Escape
- **THEN** the toast is dismissed, the dialog stays open, and focus returns to the
  element in the dialog that had it

### Requirement: Exit

A dismissed toast SHALL get `data-state="closed"` and remain mounted until its exit
animations finish (shared presence), then be removed from the store. Before it becomes
`inert` for its exit, focus inside it SHALL be moved by the focus rules above. Presses
on an exiting toast SHALL do nothing and SHALL NOT keep it mounted.

#### Scenario: Click during exit (mui/base-ui#5135)

- **WHEN** the user clicks a toast while its 300 ms exit animation runs
- **THEN** it is removed when the animation ends and leaves nothing over the page

#### Scenario: Focus leaves before inert (mui/base-ui#3466)

- **WHEN** a focused toast is dismissed with its close trigger
- **THEN** focus has moved out of it before it becomes inert, and no aria-hidden or
  inert focus warning is logged

### Requirement: Messages

The toaster SHALL take its AT-facing strings from typed messages with English defaults:
`regionLabel(hotkey)` ("Notifications (F6)"), `close` ("Dismiss notification"),
`actionHint(hotkey)` ("Press F6 to reach the action."), and the hotkey's spoken label.

#### Scenario: Localised region

- **WHEN** a store's region is rendered with `messages={{ regionLabel: (k) =>
  \`Notifiche (${k})\` }}`
- **THEN** the region is named "Notifiche (F6)"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="toast"`, `data-part` (`region`, `list`, `root`,
`title`, `description`, `action-trigger`, `close-trigger`) and `data-instance`.
Additionally:

- `region`: `data-placement`, `data-side` (`top`/`bottom`), `data-align`
  (`start`/`center`/`end`), `data-expanded` when expanded, `data-paused` while any
  region-level reason holds; CSS variables `--rind-toast-gap` and
  `--rind-toast-front-height`.
- `root`: `data-state` (`open`, `closed` while exiting), `data-type`, `data-index` (0 =
  newest), `data-front` on the newest, `data-expanded`, `data-limited`, `data-paused`,
  `data-swiping` during a swipe, `data-swipe-direction` (the release direction),
  `data-swipe-out` when dismissed by swipe, `data-dismiss-reason` while exiting; CSS
  variables `--rind-toast-index`, `--rind-toast-height`, `--rind-toast-offset` (sum of
  the heights and gaps of newer presented toasts) and the swipe variables of
  `swipe-gesture` with the prefix `toast`.
- `action-trigger`, `close-trigger`: `data-focus`, `data-focus-visible`,
  `data-pressed`, `data-disabled` when disabled.

#### Scenario: Stack variables

- **WHEN** two toasts 60 px and 80 px tall are shown with a 14 px gap
- **THEN** the older one has `data-index="1"` and `--rind-toast-offset: 74px` when the
  newer is 60 px tall, and the region has `--rind-toast-front-height: 60px`

### Requirement: Toaster Contract

The `toaster` contract SHALL locate a region by role `region` and exact accessible
name, and SHALL declare the actions `enter` (keyboard: the hotkey; pointer: hover the
region), `leave` (keyboard: the hotkey again; pointer: move the pointer away) and
`waitForAll` (advance time until no toast is shown), and the queries `titles` (newest
first), `count`, `isExpanded`, `isPaused`, `hasFocus` and `announcements`; traits
`timed` and `presence`.

#### Scenario: Driver round trip

- **WHEN** a test shows two toasts, runs `const t = getToaster(screen, { name:
  "Notifications (F6)" })`, `await t.enter()` and reads `await t.titles()`
- **THEN** `enter()` resolves with focus on the newest toast and `titles()` lists both,
  newest first

### Requirement: Toast Contract

The `toast` contract SHALL locate one toast by role `listitem` and exact accessible
name (its title), and SHALL declare the actions `dismiss` (pointer and touch: press the
close trigger; keyboard: focus the toast and press Escape), `swipe(direction)` (pointer
and touch: the shared drag input past the threshold; keyboard: none, with the reason
that `dismiss` is its keyboard twin), `act(label?)` (pointer and keyboard on the action
trigger), `hover`/`unhover` (keyboard twin: focus into and out of the region) and
`waitForTimeout` (advance its remaining time), each with a postcondition; and the
queries `isShown`, `type`, `title`, `description`, `isPaused`, `isLimited` and
`dismissReason`; traits `timed` and `presence`.

#### Scenario: Swipe via Playwright and Testing Library

- **WHEN** `await getToast(page, { name: "Saved" }).swipe("right")` runs in Playwright
  and the same test runs with `screen`
- **THEN** both end with the toast removed and `dismissReason` `"swipe"`

### Requirement: Model-Based Coverage

`testMachine` over the toast and toaster contracts SHALL cover every transition in
every declared modality including `virtual`, and SHALL pass every generic,
accessibility, `timed` and `presence` invariant. Store-only events with no user action
(`api` dismissal, promise settlement, region mount/unmount, visibility changes) SHALL be
reported as uncovered by the runner and covered by unit tests of the store and machines.

#### Scenario: Wrapper renders the toast as a live region

- **WHEN** a consumer wrapper adds `aria-live="polite"` to each toast and runs
  `testMachine(toastContract, …)`
- **THEN** the run fails because the contract does not declare the `live-region` trait
