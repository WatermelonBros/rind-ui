# Dialog & Alert Dialog — research

Status: done · Wave: 1 (first component; proves the machine runtime,
`core/dom`, contract and both test adapters — see
[0002](../decisions/0002-architecture.md#build-order))

Shared infrastructure (layer stack, dismiss, focus trap/restore, inert, scroll
lock, presence, portal) is researched in
[overlay-infrastructure.md](overlay-infrastructure.md); this note covers the
component itself and only references those modules.

## Pattern

- WAI-ARIA APG: [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
  [Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/). APG has no
  non-modal dialog pattern; non-modal follows the same roles without the
  modality guarantees.
- Roles and attributes:
  - Container `role="dialog"` (or `"alertdialog"`), `aria-modal="true"` when modal.
  - Accessible name: `aria-labelledby` → visible title, or `aria-label`.
  - `aria-describedby` → description. Optional for dialog; for alertdialog the
    message that explains the alert is expected to be the description.
  - Trigger: a button; `aria-haspopup="dialog"` and `aria-expanded` are common
    practice (not required by APG), `aria-controls` only while the content exists.
- Keyboard:
  - On open, focus moves inside: generally the first focusable element; a static
    element (title, container with `tabindex=-1`) when content is long or the first
    control would be destructive; for alertdialog, the **least destructive**
    action.
  - Tab / Shift+Tab cycle within the dialog (wrap at edges).
  - Escape closes the dialog.
  - On close, focus returns to the invoking element, unless it no longer exists or
    the workflow suggests a more logical target.
- Content outside a modal dialog is inert (not reachable by keyboard, pointer or
  screen reader virtual cursor).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/dialog/src/{dialog.machine,dialog.connect,dialog.dom,dialog.types}.ts`; Ark wraps it in `ark/packages/react/src/components/dialog/*` (+ `Portal`, presence via `lazyMount` / `unmountOnExit`).
- Parts: `trigger`, `backdrop`, `positioner`, `content`, `title`, `description`, `closeTrigger`. Ark: `Dialog.Root/RootProvider/Trigger/Backdrop/Positioner/Content/Title/Description/CloseTrigger` + generic `Portal`.
- State model: `open | closed`; events `OPEN`, `CLOSE`, `TOGGLE`, `CONTROLLED.OPEN`, `CONTROLLED.CLOSE`, `TRIGGER_VALUE.SET`. Controlled mode: guard `isOpenControlled` only calls `onOpenChange`; a `watch` on `open` sends `CONTROLLED.*`. Effects in `open`: `trackDismissableElement`, `trapFocus`, `preventScroll`, `hideContentBelow`.
- Props: `modal` (default true) derives `trapFocus`, `preventScroll`, `closeOnInteractOutside` (`modal && !alertDialog`); `closeOnEscape`, `restoreFocus`, `initialFocusEl`, `finalFocusEl`, `persistentElements`, `role: "dialog" | "alertdialog"`, multi-trigger via `triggerValue` (one dialog, many triggers; focus returns to the active one).
- Notable: alertdialog's default initial focus is the **close trigger** (`dialog.machine.ts` `props()`); title/description presence checked after a frame (`checkRenderedElements`) so `aria-labelledby` never points at a missing id; positioner gets `pointer-events: none` when non-modal so the page stays clickable; layer metadata `data-nested`, `data-has-nested`, `--layer-index`, `--nested-layer-count` for stacked styling.
- Problems: zag#3401 backdrop ignored `modal: false` and intercepted all input; zag#3346 `initialFocusEl` returning `false` coerced to "unset"; zag#3302 open-state props not reactive; zag#3408 nested dialog under an `aria-hidden` ancestor (Solid); zag#3207 stacked exit animation hidden by z-index reset; zag#3248 Escape deferred a frame; ark#3842 scroll lock + pointer-events not restored after Strict Mode unmount; ark#2925 closes when clicking the scrollbar; ark#2291 content not interactable when `open` is true on first mount; ark#3675 backdrop doesn't animate on close; ark#3175 dismiss broken with `lazyMount`/`unmountOnExit` in Next.js.

### Radix

- Source: `radix/packages/react/dialog/src/dialog.tsx` (683 lines), `alert-dialog/src/alert-dialog.tsx`.
- Parts: `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close`; AlertDialog adds `Action`, `Cancel`.
- State: `useControllableState` (`open`/`defaultOpen`/`onOpenChange`), `modal` (default true). `Content` switches between `DialogContentModal` and `DialogContentNonModal`.
- Modal: `hideOthers(content)` (aria-hidden), `RemoveScroll` around the **Overlay** with content and nested branches as shards (#3423), `FocusScope trapped={context.open}` (no trap while animating out), `disableOutsidePointerEvents={context.open}`, right-click / ctrl-click outside ignored, focus-outside always prevented. Non-modal: tracks "interacted outside" to avoid stealing focus back to the trigger on close; ignores clicks on the trigger (it toggles itself); Safari focus-after-pointer workaround.
- Alert dialog: `role="alertdialog"`, `onPointerDownOutside`/`onInteractOutside` always prevented, `onOpenAutoFocus` → `Cancel` (`cancelRef`), Escape still closes.
- Notable: cancelable auto-focus events (`onOpenAutoFocus`, `onCloseAutoFocus`) are a clean extension point; description ids are collected as a set so consumers' `aria-describedby` is merged (#2598); the Overlay is registered as a "dismiss surface" so consumer `stopPropagation` doesn't break closing (#3346).
- Problems: body `pointer-events: none` stuck (#1241, #3317 dialog from DropdownMenu freezes UI, #1836, #3648 sibling dialogs, #3645 exit animation, #2122 third-party modals); broken ARIA refs to missing title/description (#2836); VoiceOver doesn't announce the title on open (#3348, open) and description never read (#2038); scroll inside a popover inside a dialog (#1159, open); iOS height jump (#3078) and drag-selection in inputs (#3331); no exit animation when content is wrapped (#3324), framer-motion needs `forceMount` (#1061); `Dialog.Positioner` request (#2798); native `<dialog>` discussion (#2830); focus lock bypass for third-party widgets (#1859); Shadow DOM (#3353); controlled parent closed by a nested layer's outside dismissal (#4035).

### React Aria / React Aria Components

- Source: `react-aria/src/dialog/useDialog.ts`, `overlays/{useModalOverlay,useOverlay,Overlay}.ts(x)`, `react-aria-components/src/{Dialog,Modal}.tsx`.
- API: `DialogTrigger` (state) → `ModalOverlay` (underlay) → `Modal` → `Dialog` with `Heading slot="title"`; `isDismissable` (outside click, default **false**), `isKeyboardDismissDisabled`; `role="dialog" | "alertdialog"` on `useDialog`.
- Notable: focuses the **dialog container** on open (not first tabbable), waits for the enter animation (`isEntering`) before focusing and before hiding the outside; iOS VoiceOver refocus hack after 500 ms; **no `aria-modal`** (WebKit 211934, iframe focus bug) — uses `inert` outside instead; dev warning when no title; `data-entering` / `data-exiting` from `getAnimations()`; for alertdialog the content id is auto-wired as `aria-describedby`.
- Problems: Escape handled on the overlay (only works when focus is inside); react-spectrum#10291 (open) stacked modals: closing overlay dismisses the one beneath during its exit animation; #8784 / #5916 inert breaks third-party overlays portalled into body; #8951 parent modal overlaps nested modal; #4419, #8802 exit animation flicker; #5926, #7902, #2030 iOS keyboard / scrolling / paste issues.

### Base UI

- Source: `base-ui/packages/react/src/dialog/*` (`root/useDialogRoot.ts`, `popup/DialogPopup.tsx`, `store/DialogStore.ts`), `alert-dialog/*`.
- Parts: `Root`, `Trigger`, `Portal`, `Backdrop`, `Viewport`, `Popup`, `Title`, `Description`, `Close`. AlertDialog reuses the same root (`useRenderDialogRoot('alert-dialog', …)`) and removes `modal` and `disablePointerDismissal` from its props.
- State: store-based; `onOpenChange(open, eventDetails)` with a **reason** (`trigger-press`, `outside-press`, `escape-key`, `close-press`, `focus-out`, `imperative-action`) and `preventUnmountOnClose()`; `actionsRef` (`close`, `unmount`); `handle` to connect detached triggers with a payload.
- `modal: boolean | 'trap-focus'` (trap without scroll lock / pointer block; mui/base-ui#1554 reworked it). `initialFocus` may be a function of the interaction type (touch → popup itself to keep the virtual keyboard closed); `finalFocus`.
- Notable: `data-open`, `data-closed`, `data-starting-style`, `data-ending-style`, `data-nested`, `data-nested-dialog-open`, CSS var for nested count; nested dialogs counted via `onNestedDialogOpen` so only the topmost reacts to Escape/outside; pointer blocking via an invisible fixed `InternalBackdrop`, not body styles; outside press only on the dialog's *own* backdrop (#1320). Drawer is built on the same internals (`isDrawer`, nested drawer counts).
- Problems: #485 / native `<dialog>` (open); #1687 Dialog vs AlertDialog difference undocumented; #2312 click events bubble to React ancestors through the portal; #2186 portal stays mounted; #4645, #5720 scroll lock edge cases.

### Headless UI

- Source: `headlessui/packages/@headlessui-react/src/components/dialog/dialog.tsx`.
- API: `Dialog` (`open`, `onClose` — **always controlled**), `DialogPanel`, `DialogTitle`, `DialogBackdrop`, `Description`, `CloseButton`; `role`, `autoFocus`, `transition`, `unmount`.
- Notable: invalid `role` values warn and fall back to `dialog`; inert others + scroll lock disabled as soon as closing starts; `[data-autofocus]` attribute for initial focus; `useIsTopLayer` stack per scope for Escape/outside click; polyfills `getAnimations` in tests.
- Problems: no non-modal mode; no alertdialog-specific behaviour beyond role.

### Ariakit

- Source: `ariakit/packages/ariakit-react-components/src/dialog/{dialog.tsx,utils/*}`.
- API: `Dialog` (`modal`, `backdrop`, `hideOnEscape`, `hideOnInteractOutside` — boolean or callback, `getPersistentElements`, `preventBodyScroll`, `autoFocusOnShow/Hide`, `initialFocus`, `finalFocus`, `portal`, `unmountOnHide`), `DialogHeading`, `DialogDescription`, `DialogDismiss`, `DialogDisclosure`, `useDialogStore`.
- Notable: tree snapshot at open — only elements present then count as "outside" (third-party nodes added later are neither inerted nor dismissing); exiting dialog made `inert` (`disableTree`); Safari mousedown focus fallback; Escape still closes the topmost dialog when focus is on a marked outside element.

### Reka UI / Bits UI / Kobalte

- Reka (`reka-ui/packages/core/src/{Dialog,AlertDialog}`): Radix port, same parts; adds browser + SSR tests (`Dialog.ssr.test.ts`).
- Bits (`bits-ui/src/lib/bits/dialog`, `utilities/*-layer`): Radix-shaped parts; per-layer `escapeKeydownBehavior` and `interactOutsideBehavior` = `close | defer-otherwise-close | defer-otherwise-ignore | ignore`; outside interaction fires on pointer **up**.
- Kobalte (`kobalte/packages/core/src/{dialog,alert-dialog}`): React Aria-inspired; `createHideOutside`, `createFocusScope`, `solid-prevent-scroll`, `solid-presence`; AlertDialog content only overrides `role`; body `pointer-events: none` layer stack copied from Radix (`dismissable-layer/layer-stack.tsx`).

## What Drawer reuses

Drawer (Wave 1, used by Reado; Zag/Ark don't ship it, Base UI and Vaul do) is a
dialog with a gesture. It reuses **the same machine, connect and contract** with:

- an extra event `SWIPE_END { velocity, offset }` → `CLOSE { reason: "swipe" }` and
  an optional `snapPoint` context value (new states, not flags);
- presence driven by transitions on `transform` (`waitForExit` already handles
  transitions, unlike Radix/Zag keyframe-only presence);
- the same `core/dom` modules; iOS scroll lock matters more (sheets are mobile-first);
- `kind: "drawer"` in the layer stack so nested-drawer styling (Base UI's
  nested drawer count) is a connect query, not a new mechanism;
- parts `Handle` (drag affordance) added; `Positioner` holds the swipe direction
  (`data-swipe-direction`).

The Drawer research note decides gestures; this note only guarantees the
dialog machine does not need forking for it.

## Accessibility

Applies [accessibility.md](accessibility.md) (rules by number) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (causes by
letter) to the dialog pattern. What the overlay modules guarantee (inert outside,
focus never on `body`, Escape topmost-only, announcer kept exposed) is in
[overlay-infrastructure.md § Accessibility](overlay-infrastructure.md#accessibility)
and not repeated. Alert Dialog specifics: [alert-dialog.md](alert-dialog.md).

**APG.** [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
`role="dialog"`, `aria-modal="true"`, a name (`aria-labelledby` → visible title, or
`aria-label`), optional `aria-describedby`; focus moves in on open (first focusable,
or a static element at the top when content is long or the first control is
destructive), Tab/Shift+Tab wrap, Escape closes, focus returns to the invoker
unless it is gone or the workflow suggests another target. APG's examples use an
`h2` title (react-spectrum#2632 moved from `h3`).

**`aria-modal`.** Emitted (`"true"`) only for modal dialogs; never `"false"`.
Modality is real through `inert`, so the attribute is a hint: VoiceOver has
historically ignored it, WebKit 211934 focuses the first focusable in iframes
(React Aria drops it for that), and Safari 18.4–26 let the VO cursor behind both
ARIA and native modals (WebKit #311125/#314893, fixed in 27). The `modal` trait
checks inertness, not the attribute. If the iframe bug reproduces in Reado, the fix
is a quirk entry that omits the attribute in WebKit iframes.

**Naming (rules 1, 2, 5).** A dialog needs a name. Sources, in order: rendered
`Title` (via `aria-labelledby`, set only while it is rendered — radix#3007,
#1094, mui/base-ui#1325, ark#4182), consumer `aria-labelledby`, `aria-label` (Reado
uses this today). Missing name = **one development warning**, never an exception
(radix#2986 broke design-system abstractions and shadow DOM, radix#3484); the
model invariant "named role" fails consumers' wrappers instead. The check uses the
part registry, not `document.getElementById`, so it works in shadow roots. A
visually hidden title is fine (`VisuallyHidden`).

**Description.** Optional for Dialog — no warning (radix#3855; APG says
"optionally"). `aria-describedby` only while a `Description` is rendered, merged
with consumer ids (radix#2598 pattern). VoiceOver often does not read the
description on open (radix#2038, cause I): keep it short and never the only place
for essential text. Name ≠ description (invariant 15).

**Initial focus and speech.** First tabbable by default (APG), the content on
touch (keeps the keyboard closed; Base UI), `initialFocus="title"` for long text so
reading starts at the top. NVDA can read the heading twice when focus lands on a
control after the title (radix#3377): AT behaviour, recorded in the manual protocol,
no workaround. VO + Chrome does not speak the title on open (radix#3348, open;
Chrome-specific per its comments) and Safari 26 did not follow `focus()` into new
content (RA#9814, cause L, fixed in 27): manual tier-1 checks, no blur/refocus hack
(React Aria's 500 ms refocus) until reproduced — blur/refocus causes its own speech
bugs (BU#5296). iOS VoiceOver focus into the dialog is on the device checklist.

**Announcements (rule 23).** None. The name and description reach AT through the
focus move. The overlay change made "announcer under an open `aria-modal` dialog in
VO + Safari" a tier-1 manual check owned by this component.

**Close button name (rule 7).** An icon-only `CloseTrigger` is named by
`messages.close` ("Close"); a text one by its text (2.5.3 Label in Name). No hidden
dismiss button by default (AK#7310 adds one; RA#8998 shows VO users find duplicated
dismiss buttons confusing); TalkBack cannot press visually hidden buttons (RA#3047),
so a hidden dismiss would only ever be a quirk entry.

**Focus visible (rule 12).** Modality is preserved through rind's focus moves: a
dialog opened from a menu item with the mouse shows no ring on its first control
(ark#3812), and a pointer close shows no ring on the restored trigger
(bits-ui#1186).

**Reduced motion (rule 26).** The theme's duration tokens are zero under
`prefers-reduced-motion`; presence completes immediately with no running
animation. No JS motion in the dialog.

**Forced colors (rule 28).** Backdrops are translucent background colours; under
forced colors the background is replaced (alpha kept), and `box-shadow` — the usual
content "elevation" — is dropped, so the content can disappear into the page. Theme:
a `1px solid CanvasText` border on the content under `forced-colors: active`, focus
rings as `outline`, never relying on the backdrop for separation.

**RTL.** Nothing direction-specific in the dialog; the portal host copies
`dir`/`lang` (overlay), and the close trigger's position is the theme's.

**Native platform.** `<dialog>.showModal()` is not used ([native-platform.md
Recommendation](native-platform.md#recommendation-dialog--alert-dialog)): child
layers and toasts would be inert, Escape cannot be vetoed without user activation,
exit animations need Chrome-only `overlay`, jsdom lacks it. We copy its semantics
(cancelable close request with a reason, focus restore to the previously focused
element) and the Portal renders into a consumer's open native dialog.

## Bug history

Searched open and closed issues (2026-10-14) of radix-ui/primitives, chakra-ui/zag,
chakra-ui/ark, mui/base-ui, adobe/react-spectrum, tailwindlabs/headlessui,
ariakit/ariakit, unovue/reka-ui, huntabyte/bits-ui and kobaltedev/kobalte with `gh
search issues` for: dialog + title / description / aria-describedby /
aria-labelledby, autofocus / initial focus, focus restore / finalFocus, controlled
open, nested, dropdown / menu, form submit, modal false, VoiceOver, lazyMount;
alert dialog. About 700 hits, ~45 read in full. Infrastructure bugs (body
`pointer-events`, scroll lock, inert, presence, Escape routing, outside-press
rules) are in [overlay-infrastructure.md § Bug history](overlay-infrastructure.md#bug-history)
and only cited here when the Dialog adds a rule of its own. Alert Dialog rows are in
[alert-dialog.md](alert-dialog.md#bug-history). **Spec** = scenario in
`openspec/changes/add-dialog`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3007](https://github.com/radix-ui/primitives/issues/3007), [#1094](https://github.com/radix-ui/primitives/issues/1094), [#2836](https://github.com/radix-ui/primitives/issues/2836) | `aria-describedby` / `aria-labelledby` point at ids that are not rendered (WAVE/axe errors) | Ids wired unconditionally | Partly fixed; consumers pass `aria-describedby={undefined}` | Relations only for rendered parts (Spec) |
| Base UI | [#1325](https://github.com/mui/base-ui/issues/1325) | Dialogs unlabelled: Title/Description had no id | Part ids not generated | Fixed | Ids from the shared `partId` (Spec) |
| Ark / Zag | [ARK#4182](https://github.com/chakra-ui/ark/issues/4182), [ZG#3400](https://github.com/chakra-ui/zag/issues/3400) | Lazy-mounted content loses `aria-labelledby`; Toast references a title never rendered | Presence of title checked once, not per open | Fixed (detect on each open) | Parts register on mount/unmount (Spec) |
| Radix | [#2986](https://github.com/radix-ui/primitives/issues/2986), [#3484](https://github.com/radix-ui/primitives/issues/3484) | Abstractions and shadow DOM throw "DialogContent requires a DialogTitle" | Hard error; title found by `document.getElementById` | Changed to console error; shadow DOM still wrong | Dev warning only, from the part registry (Spec) |
| Radix | [#3855](https://github.com/radix-ui/primitives/issues/3855) | Warning for a missing description | Description treated as required | Closed | No description warning for Dialog (Spec) |
| Radix | [#2038](https://github.com/radix-ui/primitives/issues/2038), [#3348](https://github.com/radix-ui/primitives/issues/3348) | VO does not read the description; VO + Chrome does not speak the title on open (open) | AT/browser behaviour | Open | Manual tier-1 check; short descriptions (Accessibility) |
| Radix | [#3377](https://github.com/radix-ui/primitives/issues/3377) | NVDA reads the heading twice when a checkbox is focused | NVDA reads name + content up to focus | Closed | Manual protocol; no workaround |
| Radix | [#1615](https://github.com/radix-ui/primitives/issues/1615) | `autoFocus` input not focused in a dialog opened from a dropdown | Library initial focus overrode the element React focused | "Use `onOpenAutoFocus`" | Leave focus where the app put it (Spec) |
| React Aria | [#8791](https://github.com/adobe/react-spectrum/issues/8791) | `autoFocus` fails when a Modal is opened from a MenuItem by keyboard | Menu's `inert` cleanup ran after native autofocus | Closed | Same rule; late nodes never inert (Spec) |
| React Aria / Radix | [RA#4898](https://github.com/adobe/react-spectrum/issues/4898), [RX#3604](https://github.com/radix-ui/primitives/issues/3604), [RX#3059](https://github.com/radix-ui/primitives/issues/3059) | `autoFocus` scrolls the page to the portal at the end of `body`; page jumps on close | Focus before positioning / without `preventScroll` | "Use focus() later" | `data-autofocus` with `preventScroll` after layout (Spec) |
| Headless UI | [#265](https://github.com/tailwindlabs/headlessui/issues/265) | Dialog throws with no focusable elements | Trap required a tabbable | Fixed | Content is the fallback target (overlay) |
| Ark | [#3812](https://github.com/chakra-ui/ark/issues/3812) | Focus ring on the first control of a dialog opened from a menu by mouse | Browser `:focus-visible` heuristic after programmatic focus | Closed (by design) | Modality-driven `data-focus-visible` (Spec) |
| Bits UI / Reka | [BITS#1186](https://github.com/huntabyte/bits-ui/issues/1186), [RK#2649](https://github.com/unovue/reka-ui/issues/2649) | Ring on the trigger after an outside-click close; focus to `body` after an overlay click | `:focus-visible` persisted; restore skipped for pointer closes | Fixed | Restore after backdrop close, pointer modality kept (Spec) |
| Base UI | [#4169](https://github.com/mui/base-ui/issues/4169) | Programmatic open + multiple triggers: focus returns to the wrong trigger | Restore target = registered trigger | Fixed | Programmatic open restores to the previously focused element (Spec) |
| Radix / Kobalte / Bits | [RX#1836](https://github.com/radix-ui/primitives/issues/1836), [RX#3317](https://github.com/radix-ui/primitives/issues/3317), [RX#3462](https://github.com/radix-ui/primitives/issues/3462), [KB#335](https://github.com/kobaltedev/kobalte/issues/335), [BITS#1339](https://github.com/huntabyte/bits-ui/issues/1339) | Dialog triggered from a dropdown item does not open, freezes the page, or its inputs are not editable | Dialog nested under the menu's layer/focus scope; menu teardown hits the dialog | Workarounds (render outside, controlled) | Menus/popovers are never a dialog's parent (Spec) |
| Zag | [#2933](https://github.com/chakra-ui/zag/issues/2933) | Dialog → Popover → Dialog: closing the inner dialog closes all three | Stack-order nesting | Fixed | Parent = nearest dialog-family layer (Spec) |
| Radix / Ark / Base UI | [RX#1858](https://github.com/radix-ui/primitives/issues/1858), [ARK#2557](https://github.com/chakra-ui/ark/issues/2557), [BU#5650](https://github.com/mui/base-ui/issues/5650) | Closing a nested dialog also closes the parent (touch, closed shadow root, popover ancestor) | Close press counted as outside the parent | Fixed | Child close never dismisses the parent (Spec) |
| Base UI | [#3345](https://github.com/mui/base-ui/issues/3345) | Dialog nested in a menu: Shift+Tab escapes to the trigger and closes it | Focus scopes nested by React tree | Fixed | Dialog is a root layer there; Tab wraps (overlay) |
| Base UI / Headless UI | [BU#4583](https://github.com/mui/base-ui/issues/4583), [HUI#3330](https://github.com/tailwindlabs/headlessui/issues/3330), [HUI#3193](https://github.com/tailwindlabs/headlessui/issues/3193) | Sibling dialogs: Escape closes several; wrong one closes; clicking the second closes the first | Implicit nesting / racing registration | Open / fixed | Explicit roots (overlay) |
| Zag | [#3324](https://github.com/chakra-ui/zag/issues/3324) | `setOpen(true); setOpen(false)` leaves the dialog open | Check against committed state, deferred send | Fixed | Run-to-completion sends (Spec) |
| Zag / Bits | [ZG#3138](https://github.com/chakra-ui/zag/issues/3138), [BITS#2169](https://github.com/huntabyte/bits-ui/issues/2169) | `onOpenChange` not called when the parent changes `open` | Callback = proposal only | By design / open | Same rule, documented (Spec) |
| Ark | [#2744](https://github.com/chakra-ui/ark/issues/2744) | Conditionally rendered controlled dialog closes immediately | Opening click counted as outside press | Fixed | Press must start after registration (Spec) |
| Ark | [#2291](https://github.com/chakra-ui/ark/issues/2291), [RX#4093](https://github.com/radix-ui/primitives/issues/4093) | Content not clickable when mounted open / first frame | Body `pointer-events` applied before content's `auto` | Fixed / open | No pointer-events mutation (overlay) |
| Zag / Ark | [ZG#3401](https://github.com/chakra-ui/zag/issues/3401), [ARK#3892](https://github.com/chakra-ui/ark/issues/3892), [ZG#2957](https://github.com/chakra-ui/zag/issues/2957) | Non-modal dialog still blocks the page (backdrop intercepts input; outside click closes it) | Backdrop had no modality handling; dismiss defaults copied from modal | Partly fixed (`api.modal`) | Non-modal: no backdrop, pointer-through positioner, no outside dismissal (Spec) |
| Radix | [#3811](https://github.com/radix-ui/primitives/issues/3811) | Safari: non-modal dialog closes while tabbing through a form | Focus-outside dismissal + WebKit focus quirks | Closed | Non-modal dialogs ignore outside focus (Spec) |
| Radix | [#1109](https://github.com/radix-ui/primitives/issues/1109) | `Dialog.Close type="submit"`: "Form submission canceled because the form is not connected" | Content unmounted inside the click, before `submit` | Closed (documented) | Submit-type close parts close on `submit` (Spec) |
| Zag | [#3259](https://github.com/chakra-ui/zag/issues/3259) | Trigger without `type="button"` submits the surrounding form | Missing default type | Fixed | `type="button"` default (Spec) |
| Radix / Headless UI | [RX#998](https://github.com/radix-ui/primitives/issues/998), [HUI#2403](https://github.com/tailwindlabs/headlessui/issues/2403) | Force-mounted closed dialog locks scroll and traps focus | Effects tied to mount | Open PR / workaround | `keepMounted` holds no layer (Spec) |
| Base UI | [#3153](https://github.com/mui/base-ui/issues/3153) | Clicking Close again during the exit animation fires again | Exiting content still interactive | Open | Exiting content is inert (Spec) |
| Zag | [#3081](https://github.com/chakra-ui/zag/issues/3081) | `data-has-nested` on a single dialog mounted open in Strict Mode | Double registration | Fixed | Idempotent push (overlay); meta test under Strict Mode |
| Base UI | [#1477](https://github.com/mui/base-ui/issues/1477) | Nested dialogs hide their backdrop with no escape hatch | Library decided nested backdrop visibility | Fixed (CSS recipe) | Backdrop always rendered; styling via `data-nested` |
| React Aria | [#2632](https://github.com/adobe/react-spectrum/issues/2632) | Dialog heading was `h3` | Storybook relic | Fixed (`h2`) | `Title` is `h2` |
| Radix | [#1386](https://github.com/radix-ui/primitives/issues/1386) | Hydration failure with an initially open portal | Portal rendered on the server | Fixed | Portal is client-only; inline parts render on the server (Spec) |

## Known pitfalls

- Global style teardown bugs (body `pointer-events`, overflow, padding) after
  overlapping overlays, Strict Mode, or exit animations — see
  [overlay-infrastructure §2, §5](overlay-infrastructure.md).
- Teardown at unmount instead of close (stacked modals, trap during exit).
- `aria-labelledby` / `aria-describedby` pointing at ids that are not rendered
  (radix#2836) — must reflect actual presence of Title / Description.
- iOS VoiceOver: title not announced on open (radix#3348), container focus
  needed and sometimes a re-focus (React Aria's 500 ms hack); Safari in iframes
  with `aria-modal` (WebKit 211934).
- Dialog opened from a Menu item: the trigger (menu item) is gone on close →
  focus restore needs a fallback (react-spectrum#2444; Base UI's WeakRef history).
- Opening click immediately counted as an outside click; touch ghost clicks.
- Third-party widgets (date pickers, translation tools, chat bubbles) rendered
  outside the dialog become unusable (radix#1859, #3145, react-spectrum#5916).
- React synthetic events bubbling through the portal to the trigger's ancestors
  (mui/base-ui#2312) — parts must not rely on React bubbling for dismissal.

## Testing notes

- Hard parts: async focus moves (initial focus in a frame), presence (content still
  in the DOM with `data-state="closed"`), portals (content not under the root),
  inert/Tab order (browser only).
- `@rind-ui/testing/setup` polyfills `getAnimations` → `[]` (Headless UI does the
  same, React Aria feature-detects) so presence resolves instantly in jsdom.
- The driver locates the dialog by **role + accessible name**
  (`dialog`/`alertdialog`), the trigger by role `button` + name, falling back to
  `data-scope="dialog"` + `data-part`. Actions await the state change they cause
  (open → content visible and focus inside; close → `data-state="closed"`;
  `waitForUnmount()` separately awaits presence).
- Model-based invariants (see overlay note): `aria-expanded` ⇔ `open`; focus inside
  while open; focus on trigger (or fallback) after close; Escape closes topmost
  only; outside inert iff a modal is open; DOM clean after all close.

## Decisions

### Parts

| Part | Element | Notes |
|---|---|---|
| `Root` | none | Provides the machine. |
| `Trigger` | `button` | Many triggers allowed (Zag's `value`); focus returns to the one that opened. |
| `Portal` | generic | Shared adapter component (overlay note §7). Optional. |
| `Backdrop` | `div` | Presentational, `aria-hidden`, own presence. Click on it = outside. |
| `Positioner` | `div` | Optional fixed, scrollable full-viewport wrapper for centring and long dialogs (Zag, Base UI `Viewport`, radix#2798). Clicks on it outside `Content` = outside. |
| `Content` | `div` | `role`, `aria-modal`, `tabindex=-1`, label/description wiring. |
| `Title` | `h2` | Sets `aria-labelledby` only while rendered. |
| `Description` | `p` | Sets `aria-describedby` only while rendered; merged with consumer ids. |
| `CloseTrigger` | `button` | `type=button`; named by `messages.close` when it has no content. |

`CloseTrigger` sends `CLOSE_TRIGGER_PRESS`. Alert Dialog (same parts minus
`CloseTrigger`, plus `Cancel` and `Action`) is decided in
[alert-dialog.md](alert-dialog.md). Naming follows Ark (`CloseTrigger`,
`Backdrop`, `Positioner`) because Reado migrates from Ark.

### Machine

Pure, two states (`closed | open`); presence is the shared presence machine. The
binding sketch is in `openspec/changes/add-dialog/design.md` §1; this supersedes the
earlier `OPEN`/`CLOSE { reason }` sketch, because the runtime puts the **event type**
in `onOpenChange` `details.reason` — so each cause is its own event:
`TRIGGER_PRESS`, `CLOSE_TRIGGER_PRESS`, `ESCAPE_KEY`, `OUTSIDE_PRESS`,
`OUTSIDE_FOCUS`, `PARENT_DISMISSED`, `OPEN`, `CLOSE` (API), plus `PARTS.MOUNT` /
`PARTS.UNMOUNT` for Title/Description. `data-close-reason` is the kebab-case form.

- One definition builder, `buildDialogMachine({ kind, closeEvents, defaults })`,
  evaluated at module load: Dialog and Alert Dialog are the same graph with
  different defaults and two extra events (reka-ui#2702 shows copies drifting).
- The only DOM effect is the overlay effect (layer, dismiss, initial focus, restore;
  inert / scroll lock / Tab containment follow the stack). Vetoes
  (`onEscapeKeyDown`, `onInteractOutside`) happen before the event is sent;
  `onOpenChange`'s `cancel()` is the runtime's.
- Controlled/uncontrolled via `controllable()`: proposals, `$sync`, `$reverted`;
  parent-made changes do not call `onOpenChange` (zag#3138, bits-ui#2169 — same
  rule, documented).

**Defaults**

| Prop | Dialog | Why |
|---|---|---|
| `modal` | `true` | APG modal pattern; every library |
| `closeOnEscape` | `true` | APG |
| `closeOnInteractOutside` | `true` if modal, `false` if non-modal | Non-modal dialogs are worked alongside the page (zag#2957, ark#3892); light dismiss is Popover's job |
| outside focus closes | never | radix#3811: WebKit focus quirks closed non-modal dialogs mid-form |
| `initialFocus` | overlay default: `data-autofocus` → first tabbable → content; content on touch. Also accepts `"title"` (gets `tabindex=-1`) and `"content"` | APG (static element for long content); Base UI touch rule |
| `finalFocus` | the trigger that opened it; for programmatic/controlled opens the element focused before open; then the overlay fallback chain | mui/base-ui#4169 |
| `keepMounted` | `false` (lazy mount, unmount after exit — what Reado passes to Ark today) | |

**Parent layer.** The nearest open `dialog`/`alertdialog` layer among the logical
ancestors; menus, popovers, listboxes and tooltips are never a dialog's parent, so
a dialog opened from a menu item survives the menu closing (radix#1836, #3317,
zag#2933). Stacking metadata counts `dialog` and `alertdialog` as one kind
(mui/base-ui#1165).

**Backdrop / Positioner presses** are outside presses of the dialog (Radix's
"dismiss surfaces"); see Open questions for the overlay hook this needs.

**Forms.** Closing parts rendered as submit buttons send their close on the form's
`submit` event, not on `click`, so the form is connected when it submits
(radix#1109, #1779). Trigger/close parts default to `type="button"` (zag#3259).

**Non-modal.** Backdrop renders nothing; positioner is pointer-transparent; no
`aria-modal`; the trigger stays operable and toggles (`TRIGGER_PRESS` while open).

### `data-*` attributes

- Every part: `data-scope="dialog"` (`"alert-dialog"` for the preset),
  `data-part="trigger|backdrop|positioner|content|title|description|close-trigger|cancel|action"`.
- `Trigger`, `Backdrop`, `Positioner`, `Content`: `data-state="open|closed"`
  (`closed` while exiting is the exit-animation hook; `@starting-style` covers
  enter). With several triggers only the opener has `data-state="open"` and
  `aria-expanded="true"`.
- `Content`, `Backdrop`, `Positioner`: `data-modal` when modal; `data-nested`
  when the parent layer is a dialog; `data-has-nested` while a child dialog is
  open; CSS vars `--layer-index`, `--nested-layer-count` (Zag / Base UI
  stacked-dialog styling).
- `Content`: `data-close-reason` (kebab-case event type, e.g. `escape-key`) from
  close until the next open — exit animations can differ per reason.
- ARIA (owned by connect): trigger `aria-haspopup="dialog"`, `aria-expanded`,
  `aria-controls` only while content is mounted; content `role`, `aria-modal`,
  `aria-labelledby` / `aria-describedby` only for rendered parts.

### Contract

Binding shape in `openspec/changes/add-dialog/design.md` §5: locate by role
`dialog` + exact name (Alert Dialog has its own contract, role `alertdialog`);
traits `layer`, `restores-focus`, `presence`, plus `modal` when modal; actions
`open`, `close`, `pressEscape`, `pressOutside`, `tab`, `shiftTab`,
`waitForUnmount` (each with keyboard twins and postconditions); queries `isOpen`,
`isModal`, `title`, `description`, `hasFocus`, `isTopmost`, `closeReason`. The
environment support (press outside every layer, press at a part, wait for detach,
computed inertness) comes from `add-overlay-infrastructure`'s overlay-testing
capability.

### Deliberately different from the others, and why

1. **Close-time teardown** — layer, trap, inert, scroll lock and focus restore are
   released when the machine leaves `open`, never at unmount. Fixes by design what
   Radix (#3645) and React Aria (#10291) patch.
2. **No body `pointer-events`** — `inert` outside + backdrop. Removes the
   most-reported Radix/Kobalte bug class (#1241, #3317, #3648).
3. **Explicit layer parentage** instead of stack order (Zag) or React tree
   (Radix/RA/Base): sibling dialogs are not "nested", and it works the same in
   any framework adapter.
4. **Close reason on every close** (`onOpenChange` details and
   `data-close-reason`), like Base UI, but as a typed union — model tests
   enumerate it.
5. **`aria-modal="true"` is kept** (React Aria drops it); inert does the real
   work, `aria-modal` costs nothing elsewhere. Revisit if the WebKit iframe bug
   bites (open question).
6. **Alert Dialog is a preset of the same machine** with its own scope and
   contract (`confirm`/`cancel`), not a role prop (Zag) and not a full copy
   (Radix/Reka/Bits); `Action` closes unless the request is cancelled, so async
   confirms are explicit ([alert-dialog.md](alert-dialog.md)).
8. **Menus and popovers are never a dialog's parent** — a dialog opened from a menu
   item is a root (or the child of the enclosing dialog), removing the
   "dialog from dropdown item" bug class (radix#1836, #3317, #3462).
9. **No hard error for a missing title** — one dev warning plus a failing model
   invariant for consumers' wrappers (radix#2986).
7. **Exported invariants**: consumers run `testMachine(dialogContract, …)` to
   prove their styled wrapper still traps focus, restores it and leaves the DOM
   clean.

## Open questions

Resolved (see `add-dialog` design §6):

- Native `<dialog>.showModal()`: not used (native-platform.md Recommendation).
- `aria-modal`: kept on modal dialogs only; modality comes from `inert`; a WebKit
  iframe failure would become a quirk entry.
- Initial focus default: first tabbable (APG, Radix, Zag), content on touch;
  `initialFocus="title"` for long content.
- Non-modal `closeOnInteractOutside`: `false`; outside focus never closes.
- `Positioner`: optional; when used it is the scroll container (gets
  `overscroll-behavior: contain` while locked).
- iOS VoiceOver refocus hack: not adopted; device check on the release checklist.

Still open (do not change the specs):

- `add-overlay-infrastructure` counts backdrop and positioner as *inside* the layer
  and its `meta()` matches a single kind. Dialog needs two additive hooks: a
  "dismiss surface" (press on the backdrop/positioner itself = outside) and a kind
  family for stacking metadata. To be added to that change by its owner
  (`add-dialog` task 0.2).
- VO + Safari: are announcer messages spoken while an `aria-modal` dialog is open?
  (manual check owned by `add-dialog`, decided fallback in the overlay note).
