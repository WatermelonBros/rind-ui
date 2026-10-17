# Tour

A guided tour over the page: an ordered list of steps, each a card that points at a real element (dimming the rest of the page around it) or sits centred as a plain dialog. The page stays usable behind an anchored step; steps can wait for late targets, run effects before they show, and wait for the user to do something.

```tsx
import { Tour } from "@rind-ui/react"

const steps = [
  { id: "welcome", title: "Welcome", description: "Three quick steps." },
  {
    id: "search",
    title: "Search",
    description: "Find any file by name.",
    target: () => document.getElementById("search"),
    actions: [{ action: "prev" }, { action: "next" }],
  },
]

<Tour.Root steps={steps}>
  <Tour.Trigger>Take the tour</Tour.Trigger>
  <Tour.Portal>
    <Tour.Backdrop />
    <Tour.Spotlight />
    <Tour.Positioner>
      <Tour.Content>
        <Tour.Arrow />
        <Tour.Title />
        <Tour.Description />
        <Tour.ProgressText />
        <Tour.Actions>
          {(actions) => actions.map((a) => <Tour.ActionTrigger key={String(a.action)} action={a} />)}
        </Tour.Actions>
        <Tour.CloseTrigger />
      </Tour.Content>
    </Tour.Positioner>
  </Tour.Portal>
</Tour.Root>
```

`useTour(props)` returns the same API (`start`, `stop`, `next`, `prev`, `goto`, `reposition`, `setSteps`, `addStep`, `removeStep`, `updateStep`, `open`, `stepId`, `stepIndex`) for a tour started from anywhere: render `<Tour.Root tour={tour}>`. `Title` and `Description` render the shown step's `title` and `description` unless they have children.

## API

<!-- api:tour -->

## Steps

A step has a unique `id` (two steps with the same id throw a configuration error). A step with a `target` is anchored: the card is positioned beside it and the backdrop cuts a spotlight around it. A step without one is a centred dialog step. `type: "wait"` shows no card at all: the step exists so its effect can wait for something the user does.

Steps are data: passing a new `steps` array with the same ids (a translated one) neither restarts the shown step nor runs its effect again. A shown step that disappears from the array ends the tour with reason `steps-changed`.

## Preparing a step and its effect

Entering a step first prepares it: the tour waits for its target to be rendered (connected, visible, with a box), watching the page for it rather than polling, and runs its `effect`. While a step is prepared, the backdrop stays as it was, no card is shown, and Next, Back and the arrow keys are ignored (a double press advances one step). A step whose target and effect are ready at once is shown within the same update.

The `effect` receives `show()`, `update(patch)`, `next()`, `goto(id)`, `dismiss()`, a `signal` aborted when the step is left, the resolved `target`, and `waitForElement` / `waitForEvent` helpers bound to that signal. It may be async and may return a cleanup or a promise of one: the cleanup runs exactly once whenever the step is left, by any path, and a cleanup that arrives after the step was left runs at once. The step is shown when the effect calls `show()`, or, for a step that is not a wait step, when the effect returns or settles without navigating.

```tsx
{
  id: "editor",
  title: "Your file",
  target: () => document.querySelector("[data-editor]"),
  effect: async ({ waitForElement, update, show }) => {
    openFile("README.md")
    await waitForElement(() => document.querySelector("[data-editor]"))
    update({ description: "It opened for you." })
    show()
    return () => closeFile("README.md")
  },
}
```

When the target or the effect is not ready within the step's `timeout` (default `prepareTimeout`, 5000 ms), `missingTarget` decides: `skip` (default) moves on in the direction of travel (completing the tour when nothing is left forward), `stop` ends it with reason `target-missing`, and `center` shows the step as a centred dialog step with `data-target-missing`. `onMissingTarget({ stepId, policy })` is called in each case. An effect that throws is logged and treated the same way.

## Wait steps

A wait step's effect is what moves the tour on, through `next()`, `goto()` or `dismiss()`. Advance on an explicit completion (a committed field, a Next that becomes enabled), not on the first keystroke. Back skips wait steps, and they do not count in the progress.

```tsx
{
  id: "press-enter",
  type: "wait",
  target: () => document.getElementById("search"),
  effect: async ({ waitForEvent, target, next }) => {
    await waitForEvent(target, "keydown", { predicate: (e) => e.key === "Enter" })
    next()
  },
}
```

## Modality per step

A centred step is a modal dialog: the page outside is inert, scrolling is locked, Tab wraps in the card and the content has `aria-modal`. An anchored step is non-modal by default: nothing is inert, the page scrolls and the card follows its target in the Tab order (Tab from the target enters the card, Tab past the card's end continues after the target, Shift+Tab from the card returns to it). A step's own `modal` overrides this, and `modal` on the tour makes every step modal; a modal anchored step keeps its target operable and exposed.

## Spotlight and target

The backdrop dims the viewport and cuts the target's rectangle, padded by `spotlight.padding` (8) and rounded by `spotlight.radius` (8, clamped). `spotlight.content` also cuts the card; overlapping holes are merged. The geometry follows the same tracking as the card (scroll, resize, layout shifts) without a polling loop, and `reposition()` forces a pass for a target that moves without any event. The `Spotlight` part sits over the padded target (`--rind-tour-spotlight-*`): ring it in your theme, or set `preventTargetInteraction` to make it swallow pointer presses on the target. The target is never made `inert`; while its step is shown it carries `data-rind-tour-target`. A step with `backdrop: false` dims nothing. The spotlight moves between steps only: the tour sets `data-step-changing` on it for one step change (until its transition ends, or a later scroll or resize), so a theme transitions it under that attribute and it never tweens while the page scrolls or resizes.

A target that is replaced is followed; one that is removed sends the tour back to preparing the same step, and its missing-target policy applies after the timeout.

## Scrolling

When an anchored step is shown, its target is scrolled into view with `scrollIntoView({ block: "nearest", inline: "nearest" })` (override with `scroll`, or `scroll: false`), so your `scroll-margin` and `scroll-padding` for sticky headers apply. Under reduced motion the scroll is instant. Scrolling never moves focus.

## Focus and announcements

When the tour starts, focus moves to the card once it is placed, so its name and description are read (`initialFocus` chooses another element). On later steps focus stays where it is: on a control in the card that still exists, or outside the tour (the user typing in the highlighted field); it moves to the card only when the focused control disappeared. When focus did not move to the card, the step change is announced politely ("Step 3 of 5: Search"). When the tour ends, focus returns to where it was at the start (or the `Trigger`), unless the user has moved on to something else on the page.

## Keyboard

Escape ends the tour when it is the topmost layer: a dialog opened from the target closes first. With `keyboardNavigation` (default on), ArrowRight and ArrowLeft inside the card are Next and Back (swapped right-to-left), except in text fields and at the ends of the tour, where they never complete or close it.

## Dismissal

A stray click outside the card does not end the tour: `closeOnOutsidePress` and `closeOnOutsideFocus` are off by default. Every request goes through `onOpenChange(open, details)` with `details.reason`, `stepId`, `stepIndex`, `complete` and `cancel()`; a controlled `open` only changes when the parent passes it.

`onOpenChange` and `onStepChange` run before the change is committed, as every rind-ui change callback does, so `cancel()` can veto it.

## Actions and progress

`Tour.Actions` calls its children with the shown step's `actions`; `Tour.ActionTrigger` runs one (`next`, `prev`, `dismiss`, `skip`, or a function receiving `{ next, prev, dismiss, skip, goto }`) and is named by its visible content, else by `messages`. Next on the last step completes the tour ("Done"); Back on the first step is `aria-disabled` and stays focusable. `Tour.ProgressText` renders "3 of 12", 1-based, without wait steps; the content exposes `--rind-tour-progress` (0–1).

## Persisting progress

The tour does not store anything. Save `stepId` from `onStepChange`, and resume with `start({ stepId })` or `defaultStepId`.

## Coming from another Tour component

| Elsewhere | rind-ui |
|---|---|
| `placement: "right-start"`, `offset` | `side: "right"`, `align: "start"`, `sideOffset`, `alignOffset`; `sticky` instead of a negative offset |
| `type: "floating"` | an anchored step with `backdrop: false` |
| `onStatusChange({ status })` | `onOpenChange(false, { reason })`: `complete`, `skip`, `dismiss`, `escape-key`, `target-missing` |
| a zero-based `progressText({ current, total })` | one-based `current` |
| `start()` resuming the old step | `start()` begins at the first step; `start({ stepId })` resumes |
| `closeOnInteractOutside` | `closeOnOutsidePress` (off by default) |

## Testing

```ts
import { getTour } from "@rind-ui/testing"

const tour = getTour(screen, { name: "Take the tour" })
await tour.start()
expect(await tour.title()).toBe("Welcome")
await tour.next()
await tour.pressEscape()
```

The same driver runs in Vitest (jsdom or browser mode) and through Playwright. Before a release, run the manual checks in [releasing](../releasing.md): a three-step tour with VoiceOver and NVDA, and pinch-zoom on a device.
