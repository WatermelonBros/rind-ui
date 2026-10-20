# Timeline — research

An ordered list of events: an order history, an activity feed, a release log, or the progress
of a process ("Ordered, Shipped, Out for delivery"). It looks like a vertical rail of dots and
connectors with content beside it. There is no interaction, so the hard parts are semantic:
- the order and the list must survive the visual layout (alternating sides, newest first);
- a progress timeline's "where we are" must reach a screen reader, not only the dot colour;
- dates must be machine-readable.

None of the nine headless libraries ships it. Sources read (October 2026):
- Mantine `Timeline`, `TimelineItem`;
- Chakra UI v3 `timeline.tsx`;
- MUI Lab `Timeline`, `TimelineItem`;
- PrimeReact `Timeline`;
- the trackers of Mantine, MUI, PrimeReact, Chakra and Ant Design.

## Pattern

No APG pattern. HTML: an ordered list (`<ol>`) whose items are the events, each event's date in
`<time datetime>`. For a progress timeline, the current event carries `aria-current="step"`
(as in a stepper), and each event's status is part of its text.

## How the others built it

### Mantine (`Timeline`)

- `<div>`s, with no list semantics. The order exists for sighted users only.
- `active` index: items up to it get `data-active`, and the line up to it is filled.
  `reverseActive` reverses the direction visually. Neither reaches assistive technology:
  no `aria-current`, no status text.
- `align` left / right, `bulletSize`, `lineWidth`, per-item `lineVariant` (dashed).
- #5324 (closed): alternate sides (opposite content) were requested.

### Chakra UI v3 (`Timeline`)

- `div role="list"` / `role="listitem"`. Parts: Item, Separator, Indicator, Connector,
  Content, Title, Description.
- No status or current item.

### MUI Lab (`Timeline`)

- `<ul>` and `<li>`, an unordered list for an ordered sequence.
- `position` left / right / alternate / alternate-reverse, done with classes.
- #37678 (closed): `alternate-reverse` generated the wrong class name.
- Parts: Separator, Dot, Connector, Content, OppositeContent.

### PrimeReact (`Timeline`)

- `value` array plus `content` / `opposite` / `marker` templates; `align` (left, right,
  alternate, top, bottom); `layout` vertical / horizontal. Plain `div`s.

### Ant Design (`Timeline`)

- `<ol>`/`<li>`, `pending` (a last item with a spinner), `reverse` (the order of the DOM
  reversed), `mode` alternate.
- #59576, #59556 (open): variant through ConfigProvider.

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt, Bits, Zag / Ark.

## Accessibility

- **`<ol>`**: events are ordered. A `div` list (Mantine, PrimeReact) loses the count and
  position ("3 of 5"), and `<ul>` (MUI) says the order does not matter.
- **Reading order is DOM order**: alternating sides and a horizontal layout are CSS only. A
  "newest first" timeline is rendered newest first, never reversed by CSS (Mantine's
  `reverseActive` and `flex-direction: column-reverse` disagree with the reading order).
- **Progress status in text**: on a progress timeline, each event's name ends with its status
  ("Shipped (completed)", "Out for delivery (current)") and the current one has
  `aria-current="step"`. Colour and dot fill are not enough (WCAG 1.4.1).
- **Dates**: `<time datetime="2026-10-20T09:00">`. The visible format is the consumer's.
- **Decorations hidden**: dots, icons and connectors are `aria-hidden`; an icon that carries
  meaning ("failed") needs text in the content.
- **Pending**: an ongoing last event ("Processing…") is a status ("in progress"), not just a
  spinner.

## Bug history (the patterns)

- No list semantics (Mantine, PrimeReact divs; Chakra fixed it with roles).
- Unordered list for an ordered sequence (MUI).
- Progress shown by colour only (Mantine `active`).
- Visual reversal disagreeing with the reading order (`reverseActive`, column-reverse).
- Alternate-side class naming bugs (MUI #37678): position as a data attribute avoids class
  maths.

## Decisions

1. **Parts**:
   - `Root` (`<ol>`);
   - `Item` (`<li>`);
   - `Indicator` (dot or icon, `aria-hidden`);
   - `Connector` (`aria-hidden`);
   - `Content`, `Title`, `Description`;
   - `Time` (`<time dateTime>`);
   - `Opposite` (content on the other side).
2. **Statuses, not an index trick**:
   - an Item takes `status`: `"completed" | "current" | "pending" | "upcoming"`, or none for
     a plain event log;
   - Root `current={index}` derives the statuses (before: completed; at: current; after:
     upcoming);
   - an Item's own `status` wins.
3. **Status reaches assistive technology**: a visually hidden " (completed)" after the Title
   (as in Stepper); `aria-current="step"` on the current item; `messages.status`.
4. **Layout as data, not structure**:
   - `orientation` vertical / horizontal;
   - `align` start / end / alternate, exposed as `data-align` and `data-side` per item;
   - the order is always the DOM's.
5. **Stateless**: connect plus parts, no machine.

## Open questions

- A "load more" for long activity feeds is the consumer's button after the list.
