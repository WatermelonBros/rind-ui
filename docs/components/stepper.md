# Stepper

A sequence of steps (checkout, onboarding, a long form) with where you are, what is done, and how to move. It is an ordered list with `aria-current="step"`, never tabs; a step you can go to is a button, the others plain text, and each step's name ends with its status ("Shipping (completed)"). Moving by the user focuses the new step's content and announces "Step 2 of 4: Shipping"; in a linear flow you go back freely and forward only with Next, which your validation can refuse.

## When to use

- **Use it for** ordered tasks split into steps, where the order matters and progress is worth showing.
- **Over Tabs**: tabs are peers you switch freely; steps are a sequence, often gated. Tab roles on a stepper are wrong (zag#1791).
- **Over a hand-made indicator**: the linear rule that clicking ahead cannot skip validation (reka#2437), focus and announcement on each move, buttons that never submit the form (zag#3259), steps counted from your declaration rather than the DOM (reka#2777), and field values kept as you move.
- **Don't use it for** navigation between unrelated pages (a nav) or for a progress value alone ([Progress](progress.md)).

```tsx
import { Stepper } from "@rind-ui/react"

<Stepper.Root aria-label="Checkout" count={3} onStepChange={(next, details) => {
  if (details.reason === "next" && !form.valid) details.cancel()
}}>
  <Stepper.List>
    {["Cart", "Shipping", "Payment"].map((title, i) => (
      <Stepper.Item key={title} index={i}>
        <Stepper.Trigger>
          <Stepper.Indicator />
          <Stepper.Title>{title}</Stepper.Title>
        </Stepper.Trigger>
        <Stepper.Separator />
      </Stepper.Item>
    ))}
  </Stepper.List>
  <Stepper.Content index={0}>…</Stepper.Content>
  <Stepper.Content index={1}>…</Stepper.Content>
  <Stepper.Content index={2}>…</Stepper.Content>
  <Stepper.PrevTrigger />
  <Stepper.Progress />
  <Stepper.NextTrigger />
</Stepper.Root>
```

## API

<!-- api:stepper -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Stepper.Root` | `root` | `<div role="group">`; name it (`aria-label`). |
| `Stepper.List` | `list` | `<ol>`. |
| `Stepper.Item` | `item` | `<li>`; `index`, `disabled`, `completed`; `aria-current="step"` when current. |
| `Stepper.Trigger` | `trigger` | `<button type="button">` if you can go to the step, else `<span>`; named title + status. |
| `Stepper.Indicator` | `indicator` | `aria-hidden`; your number, or empty: the theme draws a check when completed. |
| `Stepper.Title`, `Stepper.Description` | `title`, `description` | The step's title (in the announcement) and a description of the Trigger. |
| `Stepper.Separator` | `separator` | `aria-hidden` rail to the next step. |
| `Stepper.Content` | `content` | `role="region"` "Step 2 of 4: Shipping", hidden unless current, kept mounted (fields keep their values). |
| `Stepper.PrevTrigger`, `Stepper.NextTrigger` | `prev-trigger`, `next-trigger` | One step back / forward; disabled at the ends. |
| `Stepper.Progress` | `progress` | "Step 2 of 4". |

## Rules

| Move | Linear (default) | `linear={false}` |
|---|---|---|
| Go back | Any visited step | Any step not disabled |
| Go forward | Only with Next, one step | Any step not disabled |

Next and Previous skip disabled steps. A step before the current one is completed unless its Item says `completed={false}` (skipped). `onStepChange(step, { reason, cancel })` reports `"next"`, `"prev"` or `"select"`; `cancel()` keeps the step (validation). A change you make through `step` neither moves focus nor announces.

## Keyboard

| Key | Action |
|---|---|
| Tab | Through the steps you can go to, then the content and its buttons. |
| Enter, Space | On a step: go to it. On Previous / Next: move one step. |

No arrow keys: a stepper is navigation, and the step's fields keep their own keys.

## Accessibility notes

- **A list, not tabs**, with `aria-current="step"`.
- **Status in the name**: "Cart (completed)", "Shipping (current)", "Payment (not started)" (`messages.status`).
- **No dead tab stops**: steps you cannot go to are text, not disabled buttons.
- **Focus and announcement** on your moves: the step's region takes focus and "Step 2 of 4: Shipping" is announced.
- **Shape, not only colour**: completed steps show a check.

## Testing

```tsx
import { getStepper } from "@rind-ui/testing"

const steps = getStepper(screen, { name: "Checkout" })
await steps.next()
expect(await steps.step()).toBe(1)
expect(await steps.reachable(2)).toBe(false)
expect(await steps.focusInContent()).toBe(true)
```

Contract actions: `next`, `prev`, `select(index)`. Queries: `step`, `count`, `status(index)`, `reachable(index)`, `focusInContent`.

## Tested with

<!-- tested-with:stepper -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
