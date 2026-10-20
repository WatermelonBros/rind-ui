## Why

Order histories, activity feeds, release logs and progress trackers are timelines. Where
libraries ship one, it is often built from `div`s, so it loses list semantics (Mantine,
PrimeReact), or it uses an unordered list for an ordered sequence (MUI). Progress is shown by
colour alone (Mantine `active`), and some reverse the order visually against the reading
order.

Research: [timeline](../../../docs/research/timeline.md)

Depends on: `add-foundations`, `add-theme-system`.

## What Changes

- A public **Timeline** in `@rind-ui/core` (connect, contract, messages, meta) and
  `@rind-ui/react`. Parts: `Root` (ol), `Item` (li), `Indicator`, `Connector`, `Content`,
  `Title`, `Description`, `Time`, `Opposite`. No machine.
- Statuses: `completed`, `current`, `pending` and `upcoming`, per Item or derived from
  `current` on the Root. The status is in the text and the current Item has
  `aria-current="step"`.
- `orientation` and `align` (start, end, alternate) as data attributes; the order is always
  the DOM's.
- `getTimeline` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `timeline`.
