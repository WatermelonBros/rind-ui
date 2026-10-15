# Alert — research

Status: done · Wave: 3

An inline message box in the page: "Your changes could not be saved", "This project is
archived", "Connection lost — retrying". Not a dialog (it takes no focus and blocks
nothing), not a toast (it lives in the layout, not in a stacked region, and does not time
out). The hard part is **when it speaks**: an error that appears after a user action
must reach screen-reader users at once; the same box present when the page loads must
not interrupt them; a re-render must not speak it again.

Sources: shallow clones read 2026-10-14 (Kobalte; React Spectrum S2 via `git show`);
Material UI and Chakra UI trackers for the styled Alerts most apps use. Bug history:
`gh search issues` over the ten trackers in [README.md](README.md) (`alert`, `role=alert`,
`alert announce`) plus Material UI, Chakra UI and shadcn/ui; ~120 hits, 16 read in full.
Cross-cutting: [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.2 D (live regions announce nothing the first time) and E (hide-outside silences
live regions); [accessibility.md](accessibility.md) §7.

## Pattern

- WAI-ARIA APG: [Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) — "an element
  that displays a brief, important message in a way that attracts the user's attention
  without interrupting the user's task". `role="alert"` (implicit `aria-live="assertive"`,
  `aria-atomic="true"`). APG notes:
  - alerts "present when the page loads" are not announced and should not be (they are
    not time-sensitive news);
  - "it is crucial they do not affect keyboard focus";
  - frequent interrupting alerts hurt usability; auto-disappearing alerts fail WCAG
    2.2.3.
- `role="status"` (polite, atomic) is the WCAG 4.1.3 role for advisory messages
  ("Saved", "3 results"), `role="alert"` for important, time-sensitive ones (errors,
  session expiry).
- Keyboard: none for the alert. A dismiss button is an ordinary button.
- WCAG: 4.1.3 Status Messages (dynamic messages reach AT without focus), 1.4.1 / 1.1.1
  (severity not by colour or icon alone), 1.4.3 (text contrast per tone), 2.2.3 / 2.2.1
  (no auto-dismiss — that is Toast's job, with its pause rules), 2.4.3 / 2.4.11 (focus
  after dismissal is not lost and not hidden).

## How the others built it

Only Kobalte ships a headless Alert. React Spectrum (InlineAlert), Material UI, Chakra
UI and shadcn/ui ship styled ones.

### Kobalte

- Source: `kobalte/packages/core/src/alert/alert-root.tsx`.
- API: `Alert.Root` (`div`), nothing else. Output: `role="alert"` always.
- Problems: every Alert is assertive, including success and info messages and alerts
  rendered on page load; nothing about dismissal, icon or title; the "region mounted
  with its text" problem (AT note cause D) is left to the browser.

### React Spectrum — InlineAlert (S2)

- Source: `packages/@react-spectrum/s2/src/InlineAlert.tsx`.
- `role="alert"` always; `autoFocus` prop focuses the alert itself (`tabIndex=-1`)
  when it first renders — the APG "error summary" pattern for form submission; variants
  `neutral | informative | positive | notice | negative`; the variant icon carries an
  `aria-label` ("Informative", "Error", …), so the severity is spoken; `Heading` and
  `Content` slots ([RS#1343](https://github.com/adobe/react-spectrum/issues/1343): the
  original RFC, button group removed by design).
- Problems: same "always assertive" choice; the icon's label is read inside the alert's
  atomic text, so severity depends on the icon being present.

### Material UI

- `Alert` with `severity`, `AlertTitle`, `action`, `onClose` (renders a close
  `IconButton`, "Close").
- [MUI#40198](https://github.com/mui/material-ui/issues/40198): `role="alert"` on every
  variant is too assertive for success/info; dynamically injected live regions are not
  reliably announced (Scott O'Hara, "Are we live?": an empty region that exists first and
  receives content is the only robust pattern); maintainers proposed `role="status"`
  default, then reverted to consistency with other libraries (all use `alert`). No
  library got this right.
- [MUI#49440](https://github.com/mui/material-ui/issues/49440) (open, 2026 WCAG 2.2
  assessment): test that an Alert added after load is announced without moving focus;
  that a page that *loads* with several Alerts is not "too assertive"; that severity is
  available as text, not only icon and colour; the close button's name.

### Chakra UI

- `Alert` (`role="alert"`), `status` prop for colour/icon. Lesson from its form errors:
  [CH#3240](https://github.com/chakra-ui/chakra-ui/issues/3240) — `FormErrorMessage`
  mounted together with its `aria-live` text was announced by VoiceOver but not by NVDA;
  the conclusion was "should not use `aria-live` … a separate live region component …
  permanently mounted". Also: multiple assertive regions talk over each other.

### Ariakit (design notes, not shipped)

- [AK#7235](https://github.com/ariakit/ariakit/issues/7235) (open, Notification): the
  visible surface must not be the announcement channel — "the visible card carries
  `role="alert"`, so every remount and reorder is a candidate utterance" (WebKit fires
  its `ALERT` event when a `role=alert` node is inserted, so a React remount re-speaks
  it). Ariakit's design keeps no `aria-live`, `role="alert"`, `role="status"` or
  `role="log"` in the visible tree and speaks through one announcer.

### Not shipped

Radix (an early `Status`/`Alert` idea, [RX#19](https://github.com/radix-ui/primitives/issues/19),
was closed in favour of the internal `Announce`), Reka, Bits, Base UI, Headless UI,
Zag/Ark, React Aria Components.

### Reado

`role="alert"` divs: `GuidedReviewPanel.tsx` `ErrorRow` (dismissible, "Dismiss"
button), `editor/CodeOverlays.tsx` `SaveErrorBanner` (dismissible, icon button),
`Editor.tsx` (file read error, rendered **as the editor view** — page content when the
file opens), `ImageView.tsx` (image failed). `role="status"` divs for placeholders
(`Editor.tsx` binary/large file, `NotebookView.tsx`). Reado also has its own announcer
(`molecules/Announcer.tsx`). Problems: the editor error is view content, yet it is announced
assertively every time the view remounts on a tab switch; the dismissible ones lose focus to `body` when the
focused Dismiss button unmounts.

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

### Why rind-ui's Alert does not render `role="alert"`

Rule 23 allows Alert to own a live region. We decide **not** to use it, and announce
through the injected Announcer like Toast does, because a component-owned `role="alert"`
fails in exactly the ways the cross-cutting notes catalogue:

1. **Mounted with its text** (cause D). `{error && <Alert>…}` inserts the region and
   the text together. Chromium/Firefox + NVDA/JAWS usually speak an inserted
   `role=alert`; VoiceOver and TalkBack are unreliable; a `role="status"` inserted with
   text is usually silent (CH#3240, MUI#40198, RA#5191). The invariant "every live
   region exists before its first message" (rule 6 of the AT note's invariants) cannot
   hold for a conditionally rendered Alert.
2. **Page-load content.** Server-rendered HTML that already contains a `role="alert"`
   is exposed as an alert; some AT speak it on load, and on hydration-time remounts it
   becomes "new" (MUI#49440's second check). Content present at load is not a status
   message.
3. **Re-insertion re-speaks** (AK#7235): WebKit fires `ALERT` whenever a
   `role=alert` node is inserted, so a reorder, a portal move or a remount of an
   unchanged alert speaks again. A view whose page content happens to be an error
   (Reado's editor) speaks every time it remounts on a tab switch, because the role
   makes it live whether or not it is news.
4. **Repeats are silent.** The same error text after a second failed save is not a
   change; nothing is spoken (accessibility.md §7.1).
5. **Hide-outside silences it** (cause E, RX#1820): while a menu or dialog is open,
   `aria-hidden`/`inert` over the page swallows the alert; the Announcer's regions are
   exempt by the keep-visible rule.
6. **No language, no background-tab muting, no test log.** The Announcer sets `lang`
   per message, drops messages in hidden documents, and records every message for the
   driver's announcement log (0003) — "exactly one announcement" becomes a testable
   invariant instead of an AT-dependent hope.

What we give up: the word "alert" that some screen readers prefix, and the alert in
NVDA's/JAWS's alert history. The docs say how to get it back (a consumer `role`) and
that the contract then fails `testMachine`'s rule-23 check, by design.

### The resulting rules

- **Announce only on appearance or change, never on page load.** An Alert with
  `announce="polite" | "assertive"` announces its text once when it appears after
  hydration (a client mount — `{error && <Alert …>}` — or `open` becoming true), and
  again when its text changes while shown; a DOM move is not an appearance; an Alert rendered on the server (present at load) or with
  `announce="off"` (the default) never speaks. Keyed per instance, so a burst of text
  changes collapses into one message.
- **Priority is semantic, tone is visual.** `announce="assertive"` is for important,
  time-sensitive messages (errors, failures, session expiry) — the Announcer's "Assertive
  Only For Errors" rule, documented for consumers; `data-tone` (consumer, theme only) is
  never read by the core. A "danger" box can be static; a neutral "Reconnecting…" can be
  polite.
- **What is spoken**: the Title and Description text (or the root's text when neither
  part is used), skipping `aria-hidden` subtrees and the close button; a consumer
  `announcement` string replaces it (for a message that reads better than the visible
  text). Speech never includes the "Dismiss" label.
- **Focus is never moved on appearance** (APG). The "error summary" pattern that
  focuses the box on submit is the consumer's (`focus()` on Root with `tabIndex=-1`);
  documented, not built in (S2's `autoFocus` is the only library with it).
- **Dismissible alerts**: `CloseTrigger` is a `button` named by the `dismiss` message
  ("Dismiss") unless it has its own text or label; closing moves focus — only if focus
  was inside the alert — to the consumer's `finalFocus`, else the next tabbable element
  after the alert, else the previous one, so focus never falls to `body` (rule 11;
  Reado's bug). Nothing is announced on dismissal. No Escape handling: an alert is not a
  layer.
- **Icons are decorative** (`aria-hidden`); the severity belongs in text ("Error:" in
  the Title, or an Icon `label`, which turns the icon into `role="img"` with that name —
  the S2 approach, opt-in). Colour and icon alone fail 1.4.1 (MUI#49440).
- **Title** is a `div` by default; a page-level banner that users navigate to by
  headings renders it with `render={<Heading />}` (add-heading) at the right level.
- **No `aria-labelledby`/`aria-describedby` on Root**: a root with no role is `generic`
  and cannot be named (rule 4). A consumer who gives Root `role="region"` names it
  through `aria-labelledby` → Title (documented).
- **Forced colors**: background tints vanish; the theme keeps a 1 px border
  (`CanvasText`) so the box is visible, and the icon uses `currentColor`.
- **Motion**: presence exit animation only through duration tokens (reduced motion = 0).
- **Native platform**: nothing native (no `<alert>`); `<output>` is a form-associated
  status element and wrong here.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Material UI | [#40198](https://github.com/mui/material-ui/issues/40198) | Every Alert variant is `role="alert"`; dynamically injected alerts not reliably announced | Live role on the visible box, inserted with its text | Closed; kept `role="alert"` for consistency, docs updated | Severity ≠ priority: priority is an explicit prop; announce through a pre-existing region (the Announcer) |
| Material UI | [#49440](https://github.com/mui/material-ui/issues/49440) (open) | Must check: announced after load without focus move; page loading with several Alerts too assertive; severity only icon + colour; close button name | Same | Open (WCAG 2.2) | Scenarios: dynamic appearance announces once; server-rendered never; severity as text; CloseTrigger named by messages |
| Chakra UI | [#3240](https://github.com/chakra-ui/chakra-ui/issues/3240) | Error message with `aria-live` announced in VoiceOver, silent in NVDA | Region mounted with its text | Closed; maintainers: describedby + one permanently mounted region | The Announcer's regions exist first; component renders no live region |
| Ariakit | [#7235](https://github.com/ariakit/ariakit/issues/7235) (open) | Visible card with `role="alert"` re-speaks on every remount and reorder | WebKit `ALERT` event on insertion; surface = channel | Design: no live roles in the visible tree, one announcer | Same split; DOM moves and reorders never announce, only appearance and text changes do |
| React Spectrum | [#5191](https://github.com/adobe/react-spectrum/issues/5191) (open) | LiveAnnouncer's first message lost in NVDA/JAWS | Region created on first message | Open | `announcer.prepare()` when an announcing Alert mounts |
| Radix | [#1820](https://github.com/radix-ui/primitives/issues/1820) | `role=alert` content silent while a Dialog/Dropdown is open | `hideOthers` hid the live region | Fixed upstream: `aria-hidden` (the library) stopped hiding live elements | Announcer exempt from hide-outside (keep-visible rule) |
| React Spectrum | [#7318](https://github.com/adobe/react-spectrum/issues/7318) | Request to use `status`/`alert` instead of `alertdialog` for toasts | Interactive content inside `alert`/`status` is not navigable as such | Closed: alertdialog chosen for interactive toasts | An Alert with buttons is still plain content; its buttons are reachable by Tab, no focus trap |
| React Spectrum | [#1343](https://github.com/adobe/react-spectrum/issues/1343) | InlineAlert RFC; button group removed by design | — | Shipped: Heading + Content, icon by variant | Title/Description parts; actions are consumer buttons |
| Kobalte | [#659](https://github.com/kobaltedev/kobalte/issues/659) | "Upgrade `<Alert>`" tracker (no body) | — | Closed | (No technical content) |
| Radix | [#19](https://github.com/radix-ui/primitives/issues/19) | Status/Alert primitive proposed | — | Closed in favour of `Announce` | Announcing is infrastructure, not the visible component |
| Base UI | [#4181](https://github.com/mui/base-ui/issues/4181) | Autocomplete "limited results" status not announced | Status region mounted with its text | Fixed; Base UI now nudges such regions (`useInitialLiveRegionTextMutation`, U+2060) | Do not rely on mount-time live text |
| Material UI | [#29080](https://github.com/mui/material-ui/issues/29080) | Snackbar containing an Alert not read by NVDA (Firefox; Chrome when triggered from a closing dialog) | Nested `role="alert"` (Snackbar and Alert); the region left with the dialog | Closed; workaround: `role="alert"` only on the innermost message | One channel: an Alert inside a Toast adds no second region; the Announcer's regions never leave with a layer |
| Reado | `Editor.tsx`, `GuidedReviewPanel.tsx`, `CodeOverlays.tsx` | Editor read error re-announced on each remount; focused Dismiss unmounts → focus on `body` | `role="alert"` on view content; no focus target on dismissal | Present today | View content is `announce="off"` (the default); dismiss moves focus to a neighbour |

## Known pitfalls

- Mount-with-text live regions (every library with a live-role Alert).
- `role="alert"` on content present at load, and on views that remount.
- Assertive success messages; several assertive alerts talking over each other.
- Severity conveyed by colour/icon only.
- Focus lost when a focused dismiss button unmounts.
- Naming a role-less root with `aria-labelledby` (prohibited on `generic`).
- Auto-dismissing alerts (2.2.3) — not supported; that is Toast.

## Testing notes

- The Announcer's recording backend (add-a11y-foundations) makes announcements a
  Node-testable output: machine tests assert exactly one message per appearance and per
  text change, zero for server-rendered alerts.
- Hydration test (React): server-render an Alert with `announce="assertive"`, hydrate;
  the announcement log is empty. Client mount after hydration: one assertive message.
- Strict Mode double mount: one announcement, not two (keyed, debounced by the
  Announcer).
- Dismiss: focus inside → after close, focus is on `finalFocus` / next / previous
  tabbable, never `body`; focus outside → unchanged.
- Hide-outside: open a menu, then show an Alert; the message reaches the regions.
- Driver: `getAlert(screen, { title })` → `dismiss()`, `isOpen()`, `title()`,
  `description()`, plus the driver's `announcements`.

## Decisions

- **Parts**: `Root` (`div`), `Icon` (`span`), `Title` (`div`), `Description` (`div`),
  `CloseTrigger` (`button`).
- **Machine** (`alert.machine.ts`): `open` / `closed`, `open` controllable
  (`open`/`defaultOpen` true/`onOpenChange`); events `ROOT.MOUNT { hydrating }`,
  `CONTENT.CHANGE { text }`, `CLOSE { reason }`; effects `announce` (on client mount
  while open, on `$sync:open` → open, on `CONTENT.CHANGE` while open — never while
  `hydrating`, never with `announce="off"`), `prepareAnnouncer` (mount), `moveFocus` (on
  close, if focus was inside). Presence for the exit animation.
- **`data-*`**: Root `data-state="open|closed"` (closed only while exiting); every
  part `data-scope="alert"`, `data-part`; consumer `data-variant`/`data-size`/`data-tone`
  passed through (theme `status` family).
- **Contract**: locate by Title text (or `within`); actions `dismiss`; queries
  `isOpen`, `title`, `description`; no traits (no `live-region`).
- **Deliberately different**: no live role (Kobalte, S2, MUI, Chakra) — the Announcer
  instead; priority prop separate from visual tone; no announcement on page load or
  remount; focus kept on dismissal.

## Open questions

- Should `announce` default to `"polite"` instead of `"off"`? "Off" is safe for static
  banners (the common case at load) but silent for a consumer who forgets it; revisit
  after Reado's migration (all its dynamic alerts set it explicitly).
