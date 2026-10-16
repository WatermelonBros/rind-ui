## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-overlay-infrastructure` are applied (runtime, press, modality, messages, overlay effect, presence, Portal, `modal`/`presence` traits)
- [x] 0.2 Confirm add-overlay-infrastructure tasks 12.1 (stacking family) and 12.2 (dismiss surfaces) are done — both hooks are now specified there (`layer-stack`, `dismissable-layer`)

## 1. Machine (`core/components/dialog/dialog.machine.ts`)

- [x] 1.1 Shared definition builder (`buildDialogMachine({ kind, closeEvents, defaults })`, static at module load) so `add-alert-dialog` presets the same machine; event union, context (`opener`, `closeReason`, `rendered`), controllable `open`, props with defaults (`modal`, `closeOnEscape`, `closeOnInteractOutside`, `initialFocus`, `finalFocus`, `keepMounted`) — `extend` moved to add-drawer D.1; the builder takes `scope` and `kind`
- [x] 1.2 `overlay` effect wiring: kind `dialog`, parent = nearest dialog-family layer, opener (trigger or previously focused), dismiss options per modality, veto through `onEscapeKeyDown`/`onInteractOutside`, `initialFocus` part names
- [x] 1.3 `nameCheck` effect (one dev warning, no throw, from registered parts + content attributes)
- [x] 1.4 `node` tests for every transition, refusal, `cancel()`, open+close in one task (zag#3324), parent-change without `onOpenChange`

## 2. Connect (`dialog.connect.ts`, `dialog.messages.ts`)

- [x] 2.1 Part props per design §3, consumer `aria-labelledby`/`aria-describedby` merging, layer meta with the kind family, `data-close-reason`
- [x] 2.2 Non-modal: backdrop hidden, positioner pointer-through, no `aria-modal`
- [x] 2.3 Title `tabindex=-1` while it is the initial focus target; close-trigger name from `messages.close` when empty
- [x] 2.4 Submit-type closing parts send on the form's `submit` event
- [x] 2.5 Unit tests for every attribute in the spec's Roles and Data Attributes requirements

## 3. React parts (`packages/react/src/dialog`)

- [x] 3.1 `Root` (service, `LayerProvider` scope, `api`), `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `CloseTrigger`; `render` prop on each
- [x] 3.2 `usePresence` per animated part; lazy mount, unmount after exit, `keepMounted`
- [x] 3.3 React tests: Strict Mode, SSR + hydrate inline with `defaultOpen`, portalled `defaultOpen`, conditional mount with `open` (ark#2744), React `autoFocus` inside, dialog rendered inside a menu-like layer that unmounts (radix#1836)

## 4. Contract and driver

- [x] 4.1 `dialog.contract.ts` per design §5 (traits, actions with keyboard twins, queries, event map)
- [x] 4.2 `getDialog` export from `@rind-ui/testing`; driver tests in `browser` and `jsdom` projects and through Playwright against Storybook

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix#1109, #1615, #1836, #1858, #2986, #3007, #3484, #3604, #3811, #3855, #998; zag#2933, #3324, #3401; ark#2557, #2744, #3812, #3892, #4182; mui/base-ui#1165, #1325, #3153, #4169, #5650; react-spectrum#4898, #8791) — scenarios needing Menu / Popover / Alert Dialog (menu autoFocus, opened from a menu item by mouse, alert dialog inside a dialog) use the test-only layer fixture as a menu-like layer, or wait for those changes
- [x] 5.2 `testMachine` over the contract: props sets modal, non-modal, `closeOnEscape: false`, `closeOnInteractOutside: false`; all modalities incl. `virtual`; both directions; `layer`, `modal`, `restores-focus`, `presence` invariants; axe per state
- [x] 5.3 Nested and sibling dialogs, dialog-in-popover-in-dialog, toast above a modal dialog, third-party portal inside a dialog (driver tests) — dialog-in-popover-in-dialog and toast above a modal wait for add-popover / add-toast; nested, sibling and drawer-parent dialogs are covered
- [x] 5.4 Virtual screen reader reading-order test (name, description, first control)

## 6. Theme (`packages/theme/src/dialog.css`)

- [x] 6.1 Backdrop, centred positioner, content surface, close trigger; `@starting-style` entry and `[data-state=closed]` exit using duration tokens (zero under reduced motion); nested backdrop toned by `data-nested`
- [x] 6.2 Forced colors: content border in `CanvasText`, focus ring visible, backdrop not the only separation; Playwright forced-colors captures

## 7. Stories (`apps/storybook`)

- [x] 7.1 Default, controlled, non-modal, nested, form inside (Enter submits, submit-type close), long content with `initialFocus="title"`, opened from a menu-like trigger, two triggers, keep mounted, exit animation; state stories for `open` and `closed` — the "opened from a menu-like trigger" story waits for add-menu
- [x] 7.2 A driver story (docs testing example); all stories pass axe

## 8. Docs and manual checks

- [x] 8.1 Docs page (generated API facts + guide: naming, initial focus choices, non-modal, forms, nesting, Reado/Ark migration, testing with `getDialog`/`testMachine`)
- [x] 8.2 Manual tier-1 pass (assistive-tech note §2.8): name/description on open (radix#3348, #2038, #3377), VO iOS focus into the dialog, announcer speech under an open `aria-modal` dialog in VO + Safari (overlay decision); record in "Tested with"; add a quirk entry only for a reproduced failure — deferred to the manual protocol (docs/accessibility/manual-protocol.md, Dialog) — needs the user on devices
- [x] 8.3 Mark `docs/research/dialog.md` done when this change is archived; set Dialog to `wip`/`done` in `docs/components.md` as it progresses
- [x] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-drawer)

- [x] A.1 Moved to add-drawer D.1 (the extension points land with their first real user)
- [x] A.2 Parent layer: `drawer` counts as a dialog-like parent (spec "Parent Layer"), stacking families stay separate; test dialog-from-drawer

## Amendments (from add-heading)

- [x] A.3 `Title` renders `h{level}` (`level` ?? 2) with attributes from add-heading's `headingProps`; `Content` wraps its children in `Heading.Level` at title level + 1; tests for the "Title Heading Level" scenarios
