## Context

`createPress(options)` is one closure. Long press touches it in five places: pointer down on
touch starts a timer (`options.longPress.threshold ?? 500`); pointer move beyond
`moveTolerance` or a second pointer cancels; pointer up after it fired suppresses `PRESS`;
the callout attribute `data-rind-long-pressing`; `contextmenu` suppression while held. Only
`context-menu.tsx` sets `longPress`.

## Decisions

1. **Extension shape.** `longPress(options)` (in `dom/long-press.ts`, beside the hint helpers)
   returns `{ start(input): LongPressGesture }`. `createPress` calls `start` on a primary
   pointerdown with the target, the event, the scheduler, its `listen` (listeners removed with
   the press) and `fire` (which checks the press is still in and sends `LONG_PRESS`). The
   gesture owns the timer, the move tolerance, the second-pointer cancel and the touch callout;
   it exposes `cancel()` (pointer left) and `end()` (press ended: cancel + restore callout).
   `press.ts` keeps only the `longPressed` flag that suppresses the trailing click and the
   context menu. Why these two hooks: they are exactly the places press.ts touched the timer.
2. **Behaviour unchanged.** The code is moved verbatim; the callout is now set after
   `PRESS.START` instead of before it, within the same pointerdown handler (not observable).
3. **Tests**: the existing press long-press tests run against `createPress` with the extension;
   one test asserts a press without it never schedules a long-press timer.
4. **Size check**: Switch's bundle must not contain `dom/long-press`; Context Menu's must.

## Risks / Trade-offs

- [Press is quirk-heavy; moving code can shift event order] → move code verbatim, keep the
  call order of the hooks identical to today's inline order, run the full press and Context
  Menu suites in all three engines.
