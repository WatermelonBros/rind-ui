## Context

See [timeline.md](../../../docs/research/timeline.md).

## Decisions

### 1. Connect

`timelineConnect({ instance, orientation, align, current, messages })` describes the parts.

- `root`: `<ol>` with `data-orientation` and `data-align`.
- `item(index, status?)`:
  - `data-index`;
  - `data-status`, from the Item's own status, else from `current`;
  - `data-side`, `start` or `end`: alternating by index when `align="alternate"`;
  - `aria-current="step"` when the status is current.
- `indicator` and `connector`: `aria-hidden`, with `data-status`. The connector also carries
  `data-last` on the last item, which has no line after it.
- `content`, `title`, `description` and `opposite`: plain parts carrying `data-status`.
- `statusText(status)`: " (completed)" through `messages.status`. It is rendered visually
  hidden after the Title, and only on a progress timeline, meaning when any status is known.
- `time`: a `<time>` with `dateTime`, which the React part takes from a `Date` or a string.

### 2. React

- `Timeline.Root` takes `current`, `orientation` (default vertical), `align` (default
  start), `messages`, `locale` and `render`.
- `Item` takes `index` (as Stepper's Items) and `status`. Items register their index with the
  Root, which counts them, so the last Item knows it is last.
- `Time` takes `dateTime: Date | string` and renders the children, or a locale's medium date
  when none are given.

### 3. Contract

Located by the list's name (`aria-label`), or the only Timeline in the target. No actions.
Queries:
- `count`;
- `current`: the index of `aria-current`, or -1;
- `status(i)`;
- `titles`.

### 4. Theme

`timeline.css`, family `decoration`:
- vertical rail: the indicator is a dot on a connector line, and the content sits beside it;
- `alternate`: a two-column grid with the rail in the middle, items on `data-side`;
- horizontal: a row, with the connector between dots;
- statuses:
  - `completed`: filled accent dot and solid line;
  - `current`: ringed accent dot;
  - `pending`: dashed line and a pulsing dot (no pulse under reduced motion);
  - `upcoming`: hollow muted dot;
- forced colours.
