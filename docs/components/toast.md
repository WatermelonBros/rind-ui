# Toast

A short message that appears over the page without taking focus, then goes away by itself: "Saved", "Message sent", "Item archived. Undo".

## When to use

Use a toast to confirm something the user just did, or to report something that happened in the background, when the message needs no decision and can be missed without harm. A toast is announced to screen readers when it appears, but it does not interrupt: focus stays where it was.

What it adds over plain HTML: HTML has no notification element. A toast adds a store you can call from anywhere (a click handler, a data layer, a plain module), an announcement through one polite channel, timers that pause while the pointer or focus is on the stack or the tab is hidden, a stack that expands on hover, swipe and Escape to dismiss, a hotkey to reach the toasts from the keyboard, and a limit that holds older toasts instead of dropping them.

Do not use a toast for:

- An error the user must fix, or anything they must read: put it next to the field, or use an [Alert](alert.md) in the page. A message that disappears in five seconds is not for that.
- A choice, a confirmation or a form: use a [Dialog](dialog.md) or a [confirmation](dialog.md#confirmation-alert-dialog).
- A persistent state of the page ("You are offline"): use an Alert that stays.
- Anything the user cannot afford to miss. If a toast carries the only copy of the information, a user who reads slowly, uses magnification or looks away loses it.

## Basic use

Create the store once, outside React, and render one `Toaster` for it.

```tsx
// toaster.ts
import { createToaster } from "@rind-ui/core"

export const toaster = createToaster({ placement: "bottom-end", limit: 3 })
```

```tsx
// App.tsx
import { Toast, Toaster } from "@rind-ui/react"
import { toaster } from "./toaster"

<Toaster toaster={toaster}>
  {(t) => (
    <Toast.Root>
      <Toast.Title />
      {t.data.description ? <Toast.Description /> : null}
      {t.data.action ? <Toast.ActionTrigger /> : null}
      <Toast.CloseTrigger>
        <svg aria-hidden="true" width="12" height="12" />
      </Toast.CloseTrigger>
    </Toast.Root>
  )}
</Toaster>
```

```ts
toaster.show("Saved")
toaster.success({ title: "Saved", description: "3 files" })
```

The store is plain TypeScript: import it from a click handler, a request layer or a test, with no component mounted. Toasts shown before a `Toaster` mounts wait, with their timers paused, and start when it does. The `Toaster` renders nothing while the store is empty, and its children are called once per toast (newest first), so you decide the markup. `Title` and `Description` default to the toast's own text; `ActionTrigger` to the action's label.

## API

<!-- api:toast -->

## Types

`show` uses the type `info`; `success`, `warning`, `error` and `loading` set `data-type`, which the theme turns into an accent and a glyph. The type is styling only: it is not spoken, so put what matters in the title ("Upload failed", not "Failed" in red).

## Actions and WCAG 2.2.1

A toast with an action keeps its time limit only if you ask for one:

```ts
toaster.show({
  title: "Message archived",
  action: { label: "Undo", onAction: () => restore() },
})
```

Without an explicit `duration`, an actionable toast persists until it is acted on or dismissed. WCAG 2.2.1 (timing adjustable) requires that a user can have enough time, and a button that vanishes while a keyboard or screen-reader user is reaching for it fails that. `loading` toasts and `duration: Infinity` persist the same way; the toast's state is `persistent`. Pass a `duration` to opt back in to a timer: it is then your call, and the toast still pauses while hovered or focused.

An action runs once and dismisses the toast with reason `action`; `closes: false` keeps it open. Always render a `Toast.CloseTrigger` on a persistent toast: touch screen readers cannot press Escape or swipe, and a development warning says so when it is missing.

The announcement of an actionable toast ends with a hint ("Press F6 to reach the action."), in the language of `messages.actionHint`.

## Reaching toasts from the keyboard

Toasts do not take focus, so a keyboard user needs a way in. While toasts exist, the hotkey (`F6` by default, `hotkey` on the store) moves focus to the newest toast and the stack expands and pauses; pressing it again returns focus to where it was. Escape dismisses the focused toast only, never a dialog beneath it. Tab moves through the toasts and their buttons.

Tell users the key exists: the region is named "Notifications (F6)" (`messages.regionLabel` and `messages.hotkeyLabel` for other languages), and an actionable toast's announcement carries the hint. If your product has a help page or a shortcut list, add it there. `F6` is also the browsers' pane-cycling key; it is intercepted only while toasts exist. Pick another with `hotkey: "Alt+T"` if that is a problem.

## Several toasters

A store is one placement. For two (a corner for status and the top for banners), create two stores and render two `Toaster`s:

```tsx
export const status = createToaster({ placement: "bottom-end" })
export const banners = createToaster({ placement: "top-center", limit: 1 })
```

Each region has its own name by default: pass `messages={{ regionLabel: () => "Status" }}` to tell them apart. Each registers its own hotkey; give them different ones.

## Stack, limit and pausing

Collapsed, the newest toast shows in full and the next two peek behind it; hover, focus or `expand: true` spreads them out. Past `limit`, older toasts are held, not dropped: they are inert, paused and hidden (`data-limited`), and they appear, with their remaining time, when a toast ahead of them goes.

A toast's timer pauses while the pointer or focus is on the stack, while the page is hidden, while it is swiped, and on `toaster.pause()`. It resumes only when no reason is left, with the time that remained. A change of window focus alone is not a reason.

## Updating and promises

Showing a toast with the id of one that is visible updates it in place and restarts its time. `toaster.update(id, patch)` changes it, and `toaster.dismiss(id)` (or `dismiss()` for all) ends it with reason `api`.

```ts
toaster.promise(save(), {
  loading: "Saving…",
  success: (file) => `Saved ${file.name}`,
  error: "Could not save",
})
```

The toast is `loading` (persistent) until the promise settles, then becomes a `success` or `error` toast with its normal time, announced again. If the user dismissed it meanwhile, nothing reappears. The call returns `{ id, result }`, where `result` is your promise.

## Above dialogs

The region carries `data-rind-top-layer`: a modal dialog or drawer does not make it inert, and pressing a toast does not count as an outside press, so the dialog stays open when the user presses Undo.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/toast.css`: placement from `data-side` and `data-align` with safe-area insets, the collapsed and expanded stack, a gap filler so hover does not drop between toasts, the swipe and the swipe-out in the direction it was thrown, entry and exit transitions, a type glyph, a 24 px hit area on the buttons, no slide under reduced motion, and forced-colors borders; with `--rind-toast-*` tokens (`bg`, `fg`, `border`, `radius`, `shadow`, `padding`, `gap`, `width`, `offset`, `duration`, and `success`, `warning`, `error`, `info` accents).

Variables written by the connect: `--rind-toast-gap` and `--rind-toast-front-height` on the region; `--rind-toast-index`, `--rind-toast-height` and `--rind-toast-offset` on each toast; `--rind-toast-swipe-x` and `--rind-toast-swipe-y` while it is dragged.

## Testing

Contract actions: on the region, `enter()`, `leave()`, `waitForAll()`; on a toast, `dismiss()`, `swipe(direction)`, `act()`, `hover()`, `unhover()`, `waitForTimeout()`. Queries: `titles()` (newest first), `count()`, `isExpanded()`, `isPaused()`, `hasFocus()` on the region; `isShown()`, `type()`, `title()`, `description()`, `isPaused()`, `isLimited()`, `dismissReason()` on a toast. The region is located by its name, a toast by its title.

```tsx
import { createToaster } from "@rind-ui/core"
import { getToast, getToaster } from "@rind-ui/testing"

const toaster = createToaster({ duration: 3000 })
render(<App toaster={toaster} />)

act(() => void toaster.success("Saved"))
const region = getToaster(screen, { name: "Notifications (F6)" })
expect(await region.titles()).toEqual(["Saved"])

const toast = getToast(screen, { name: "Saved" })
await toast.via("keyboard").dismiss()
expect(await toast.dismissReason()).toBe("escape-key")
```

Timers run on the environment's clock, so fake time works: advance it with the driver instead of waiting.

```tsx
vi.useFakeTimers()
const env = domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
const toast = getToast(env, { name: "Brief" }).via("keyboard")
await toast.waitForTimeout() // advances until it is gone
expect(await toast.isShown()).toBe(false)
```

Create a store per test so toasts do not leak between them. `testMachine(toastContract, …)` and `testMachine(toasterContract, …)` run the machine graphs against your own wrapper.

## Tested with

<!-- tested-with:toast -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
