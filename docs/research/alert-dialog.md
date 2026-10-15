# Alert Dialog — research

Status: done · Wave: 1

Everything an alert dialog shares with Dialog (sources, parts, overlay behaviour,
bug history of the shared machinery) is in [dialog.md](dialog.md) and
[overlay-infrastructure.md](overlay-infrastructure.md). This note covers only what
differs.

## Pattern

- WAI-ARIA APG: [Alert and Message Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/).
- Roles and attributes: `role="alertdialog"` on the container, `aria-modal="true"`,
  `aria-labelledby` → title, `aria-describedby` → the element containing the alert
  message (ARIA 1.2: authors SHOULD reference it).
- Keyboard: as Dialog (Tab wraps, Escape closes). Initial focus on the **least
  destructive** action is recommended ("Cancel" before "Delete").
- An alert dialog is always modal; it interrupts the workflow and expects a response.

## How the others built it

### Radix (`alert-dialog/src/alert-dialog.tsx`), Reka, Kobalte

- Parts: `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`,
  `Cancel`, `Action`. Built on `Dialog` with `modal` forced, `role="alertdialog"`,
  `onPointerDownOutside`/`onInteractOutside` always `preventDefault()`, and
  `onOpenAutoFocus` focusing a `cancelRef`. Escape still closes. `Action` and
  `Cancel` are both `Dialog.Close` — `Action` always closes (radix#1747, #1779:
  async work needs a plain button). Reka is the Vue port; Kobalte overrides only the
  content's `role`.
- Problems: separate wrappers drift — reka-ui#2702 made only AlertDialog content
  unclickable; radix#1738 (users expect backdrop dismissal; by design no).

### Base UI (`alert-dialog/*`, `dialog/root/useRenderDialogRoot.tsx`)

- Same root as Dialog with `mode: 'alert-dialog'`: `modal = true`,
  `disablePointerDismissal = true`, `role = 'alertdialog'`; parts are Dialog's
  (`Close` for both buttons). Escape closes and they recommend not disabling it
  (mui/base-ui#1688). Typed handles keep Dialog handles out of AlertDialog roots.
- Problems: nested dialog accounting missed the cross-kind case (mui/base-ui#1165);
  docs did not explain Dialog vs AlertDialog (#1687, #2146).

### Zag / Ark

- No separate component: `role: "alertdialog"` prop on the dialog machine, which then
  sets `closeOnInteractOutside: false` and `initialFocusEl` = close trigger
  (`dialog.machine.ts` `props()`). No `Action`/`Cancel` parts.

### React Aria

- `useDialog({ role: "alertdialog" })`; Spectrum's `AlertDialog` wires the content
  slot as `aria-describedby` but RAC did not (react-spectrum#9916). `isDismissable`
  defaults to false. `onCancel` is not called on Escape (react-spectrum#1773, open);
  no pending state for the primary action (#4362).

### Bits UI

- Radix-shaped; v1 changed `Action` to **never** close (bits-ui#1008: "people were
  confused by the action closing the dialog before they finished the work"), and
  users reported it as a regression. Default focus on `Cancel` regressed once
  (bits-ui#1695); delayed autofocus could focus replaced content (bits-ui#2136).

### Headless UI, Ariakit

- No alert dialog component: `role="alertdialog"` passes through `Dialog`.

## Accessibility

Applies [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md);
everything in [dialog.md § Accessibility](dialog.md#accessibility) holds. Additions:

- **Role.** `alertdialog` makes AT treat the dialog as an alert: JAWS and NVDA read
  the name and the description on open (the description is the message), VoiceOver
  may not read the description (radix#2038, cause I) — keep the message short and
  in the `Description`, never only in other content.
- **Naming.** Title *and* description are expected. Missing either → one dev warning
  each (react-spectrum#9916), never an exception.
- **`aria-modal`.** Always `"true"`; modality from `inert` as for Dialog.
- **Initial focus.** `Cancel` (least destructive), whatever the modality — a button
  does not open the on-screen keyboard, so Base UI's touch rule does not apply.
  Resolved lazily at focus time from the live parts (bits-ui#2136). Without a
  `Cancel`, the content (so a single "OK" is not activated by a stray Enter).
- **Escape.** Closes (APG), reason `ESCAPE_KEY`. Consumers who need a forced choice
  veto it; JS handling makes that reliable even without user activation, unlike
  native `<dialog>`'s non-cancelable `cancel` ([native-platform.md §1](native-platform.md)).
- **Announcements.** None from the component (rule 23); focus on `Cancel` makes AT
  read name + description + the focused button.
- **Forced colors / reduced motion / RTL.** As Dialog. The destructive `Action`
  must not rely on colour alone (theme: border + text).

## Bug history

Searched (2026-10-14) the ten trackers for "alert dialog", "AlertDialog",
"alertdialog", plus the Dialog searches in [dialog.md](dialog.md#bug-history).
About 160 hits, 22 read in full. **Spec** = scenario in
`openspec/changes/add-alert-dialog`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#1747](https://github.com/radix-ui/primitives/issues/1747) | Alert closes before the async operation finishes | `Action` = `Dialog.Close`, always closes | Docs: use your own button | `Action` closes unless cancelled; async = cancel then close (Spec) |
| Radix / Bits | [RX#1779](https://github.com/radix-ui/primitives/issues/1779), [BITS#324](https://github.com/huntabyte/bits-ui/issues/324) | "Form submission canceled because the form is not connected"; `type=submit` Action can't submit | Content unmounted inside the click | Docs / fixed in v1 | Submit-type Action closes on the form's `submit` (Spec) |
| Bits UI | [#1008](https://github.com/huntabyte/bits-ui/issues/1008) | `Action` no longer closes an uncontrolled dialog | Redesign to never close | By design | The opposite extreme also confuses: close by default, explicit cancel (design) |
| Radix | [#1738](https://github.com/radix-ui/primitives/issues/1738) | Users expect backdrop click to dismiss | By design, undocumented | Closed | No outside dismissal, documented (Spec) |
| Radix / Base UI | [RX#2227](https://github.com/radix-ui/primitives/issues/2227), [BU#1688](https://github.com/mui/base-ui/issues/1688) | Requests to stop Escape closing; `dismissible={false}` did not cover Escape | Escape and pointer dismissal treated differently on purpose | Base UI: keep Escape | Escape closes by default; veto possible (Spec) |
| React Aria | [#1773](https://github.com/adobe/react-spectrum/issues/1773) | `onCancel` not called on Escape | Escape and Cancel take different paths | Open | One reason union distinguishes `CANCEL_PRESS`/`ESCAPE_KEY`/`ACTION_PRESS` (Spec) |
| React Aria | [#8139](https://github.com/adobe/react-spectrum/issues/8139) | Cancel can't close a controlled alert dialog | Missing `onOpenChange` wiring | User error, docs | Controlled cancel scenario in docs and tests (Spec) |
| React Aria | [#9916](https://github.com/adobe/react-spectrum/issues/9916) | `alertdialog` without `aria-describedby` | Content slot not wired in RAC | Fixed by warning | Warn on missing description (Spec) |
| React Aria | [#4362](https://github.com/adobe/react-spectrum/issues/4362) | No pending state for the primary action | Needs a pending Button | Backlog | Out of scope; consumer renders pending UI (Non-goal) |
| Radix / Bits | [RX#1615](https://github.com/radix-ui/primitives/issues/1615), [BITS#1695](https://github.com/huntabyte/bits-ui/issues/1695) | Cancel not focused / `autoFocus` ignored when opened from a dropdown | Initial focus regressions; library overrides app focus | Fixed / documented | Cancel by default; app focus respected (Spec) |
| Bits UI | [#2136](https://github.com/huntabyte/bits-ui/issues/2136) | Delayed autofocus focuses replacement content | Ref read when the timer fires | Open | Resolve the target at focus time, connected only (Spec) |
| Base UI | [#1165](https://github.com/mui/base-ui/issues/1165) | Alert dialog inside a dialog not counted as nested | Separate nesting per component | Fixed | One kind family for stacking metadata (Spec) |
| Radix | [#1858](https://github.com/radix-ui/primitives/issues/1858) | Alert stacked on a dialog closes both | Popover ancestor dismissed by the press | Closed | Alert child of the dialog; menus/popovers never parents (Spec) |
| Reka | [#2702](https://github.com/unovue/reka-ui/issues/2702), [#2727](https://github.com/unovue/reka-ui/issues/2727) | Alert dialog content unclickable after a patch; Dialog fine | Separate code path; body `pointer-events` | Fixed | Same machine, no body styles (Spec) |
| Radix | [#3100](https://github.com/radix-ui/primitives/issues/3100) | `forceMount` alert dialog locks scroll while closed | Lock tied to mount | Workaround | `keepMounted` holds no layer (Dialog spec) |
| Reka | [#244](https://github.com/unovue/reka-ui/issues/244) | Focus not returned to the trigger on close | Restore missing in the port | Fixed | Shared restore path (overlay) |
| Base UI / Reka | [BU#1687](https://github.com/mui/base-ui/issues/1687), [BU#2146](https://github.com/mui/base-ui/issues/2146), [RK#720](https://github.com/unovue/reka-ui/issues/720) | Users unsure when to use Dialog vs AlertDialog | Undocumented differences | Open | Docs page section "Dialog or Alert Dialog?" (tasks) |

## Known pitfalls

- Destructive default focus (focusing "Delete") — APG says least destructive.
- Escape policy confusion: disabling Escape is usually wrong; vetoing is possible.
- Async confirm closing too early, or never closing (Radix vs Bits extremes).
- Separate implementations drifting from Dialog.

## Testing notes

- The contract must assert that outside presses leave it open (the oracle has no
  outside-press edge), and that `CANCEL_PRESS` / `ACTION_PRESS` produce distinct
  `closeReason`s.
- Async confirm test: fake timers; dialog open, inert page and focus unchanged while
  pending.

## Decisions

- Parts: `Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`,
  `Description`, `Cancel`, `Action` (Radix/Base names; no `CloseTrigger`).
- Machine: `buildDialogMachine({ kind: "alertdialog", closeEvents: ["CANCEL_PRESS",
  "ACTION_PRESS"], defaults: { modal: true, closeOnInteractOutside: false,
  initialFocus: "cancel" } })`; `modal` and `closeOnInteractOutside` are not props.
- `data-*`: as Dialog with `data-scope="alert-dialog"`, parts `cancel`/`action`,
  `data-modal` always, `data-close-reason` `cancel-press` / `action-press`.
- Contract: role `alertdialog`; Dialog's actions minus `close`, plus `cancel()` and
  `confirm(name?)`; `pressOutside` expects it to stay open.
- Deliberately different: preset of one machine (not a role prop like Zag, not a copy
  like Radix/Reka/Bits/Kobalte); `Action` closes unless cancelled (between Radix's
  always and Bits' never).

## Open questions

None that change the specs. The VO description-on-open behaviour is a manual
tier-1 check.
