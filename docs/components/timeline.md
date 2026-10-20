# Timeline

An ordered list of events: an order's progress, an activity feed, a release log, a pipeline. It is an `<ol>` in reading order, whatever the layout (alternating sides, horizontal). On a progress timeline each event's title ends with its status for screen readers ("Shipped (completed)") and the current event has `aria-current="step"`, so progress is never colour alone; dates are `<time datetime>`.

## When to use

- **Use it for** a history or a process shown as a sequence of dated or ordered events.
- **Over a styled list of divs**:
  - list semantics and an ordered list (some kits use divs or `<ul>`);
  - progress statuses in the text, not only the dot colour;
  - a layout that never reverses the reading order;
  - machine-readable dates.
- **Don't use it for** steps the user moves through ([Stepper](stepper.md)) or a single progress value ([Progress](progress.md)).

```tsx
import { Timeline } from "@rind-ui/react"

<Timeline.Root aria-label="Order status" current={1}>
  {events.map((e, index) => (
    <Timeline.Item key={e.id} index={index}>
      <Timeline.Indicator />
      <Timeline.Connector />
      <Timeline.Content>
        <Timeline.Title>{e.title}</Timeline.Title>
        <Timeline.Description>{e.text}</Timeline.Description>
        <Timeline.Time dateTime={e.at} />
      </Timeline.Content>
    </Timeline.Item>
  ))}
</Timeline.Root>
```

## API

<!-- api:timeline -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Timeline.Root` | `root` | `<ol>`; `current`, `orientation`, `align`. |
| `Timeline.Item` | `item` | `<li>`; `index`, `status`; `aria-current="step"` when current. |
| `Timeline.Indicator` | `indicator` | `aria-hidden` dot, or your icon. |
| `Timeline.Connector` | `connector` | `aria-hidden` line to the next event; `data-last` on the last. |
| `Timeline.Content`, `Title`, `Description` | `content`, `title`, `description` | The event; the Title ends with its status on a progress timeline. |
| `Timeline.Time` | `time` | `<time datetime>` from a `Date` or string; without children, the date for the locale. |
| `Timeline.Opposite` | `opposite` | Content on the other side of the rail (with `align="alternate"`). |

## Statuses

| Status | From | Spoken | Theme |
|---|---|---|---|
| `completed` | before `current` | "(completed)" | filled dot, solid line |
| `current` | at `current` | "(current)", `aria-current="step"` | ringed dot |
| `pending` | an Item's `status` | "(in progress)" | pulsing dot, dashed line |
| `upcoming` | after `current` | "(not started)" | hollow dot, muted title |

Without `current` and without statuses the timeline is a plain log: no status words, nothing current. An Item's own `status` wins over `current`.

## Accessibility notes

- **An ordered list**: screen readers announce the count and each event's position.
- **Reading order is DOM order**: `align` and `orientation` only change the layout. Render a newest-first feed newest first.
- **Status in text**, not only in colour or shape (`messages.status`).
- **Decorations hidden**: dots and lines are `aria-hidden`; an icon that means something ("failed") needs words in the content.

## Testing

```tsx
import { getTimeline } from "@rind-ui/testing"

const timeline = getTimeline(screen, { name: "Order status" })
expect(await timeline.current()).toBe(1)
expect(await timeline.titles()).toEqual(["Ordered (completed)", "Shipped (current)", "Delivered (not started)"])
```

Queries: `count`, `current`, `status(index)`, `titles`.

## Tested with

<!-- tested-with:timeline -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
