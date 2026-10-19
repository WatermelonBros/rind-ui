## Context

See [stepper.md](../../../docs/research/stepper.md).

## Decisions

### 1. Props

`count` (steps); `step` / `defaultStep` (0) / `onStepChange(step, details)`, with
`details.reason` being `next`, `prev` or `select`, and `cancel()`; `linear`
(default true); `orientation` (layout); `messages`.

Items declare `index`, `disabled?` and `completed?`. The machine receives `disabledSteps`
and `completedSteps` (index sets) gathered from the items: registered in a layout effect
and unregistered on unmount, so conditional steps never inflate the count (reka#2777).

### 2. Machine

One state, `active`. Controllable value `step`. `visited`: the highest step reached.
Events:
- `NEXT`: step + 1, if not the last.
- `PREV`: step − 1, if not the first.
- `SELECT { index }`: allowed if not disabled, and either non-linear or
  `index ≤ visited`.
- `STEP.SYNCED`: onProps for `step`.

Each user event writes `step` through the controllable value (cancellable), with its reason,
and sets `focusContent`. When the change lands (uncontrolled at once, controlled when the
prop arrives), the effects run: `env.focusContent()` and the announcement
`messages.stepAnnouncement(index, count, title)`. A change the parent makes through `step` does
neither. Disabled steps are skipped by `NEXT` and `PREV`.

Derived (pure, exported):
- `stepStatus(index)`: `completed` / `current` / `upcoming`;
- `stepReachable(index)`: whether the step renders as a button.

### 3. Connect

Parts:
- `root`: a group named by the consumer;
- `list`: `ol`;
- `item`: `li`, with `aria-current="step"` on the current step and `data-status`;
- `trigger`: a `<button type="button">` when reachable, else a `span`; its name is the
  title plus a visually hidden status (`messages.status`);
- `indicator`: `aria-hidden`, showing the number or a check;
- `title`, `description`: describe the trigger;
- `separator`: `aria-hidden`;
- `content`: `role="region"`, `tabindex="-1"`, `aria-labelledby` the step's progress label,
  `hidden` unless current (kept mounted);
- `prev-trigger`, `next-trigger`: `type="button"`, disabled at the ends;
- `progress`: the text "Step 2 of 4".

Every part carries `data-scope`, `data-part`, `data-instance`, `data-orientation`; the
step parts also carry `data-status` and `data-index`.

### 4. Contract

Located by the Root's role (`group`) and name. Actions: `next`, `prev`, `select(index)`.
Queries: `step`, `count`, `status(index)`, `reachable(index)`, `focusInContent`.
Invariant: exactly one item has `aria-current="step"`; an unreachable step is not a
button; the current content is the only one not hidden.

### 5. Theme

`stepper.css`, family `decoration`: circles with numbers that turn into a check when
completed, connecting separators, horizontal or vertical layout, and the current step in
the accent colour. Forced colours. Logical properties only.
