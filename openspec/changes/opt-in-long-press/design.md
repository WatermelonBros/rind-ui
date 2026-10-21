## Context

`createPress(options)` is one closure. Long press touches it in five places: pointer down on
touch starts a timer (`options.longPress.threshold ?? 500`); pointer move beyond
`moveTolerance` or a second pointer cancels; pointer up after it fired suppresses `PRESS`;
the callout attribute `data-rind-long-pressing`; `contextmenu` suppression while held. Only
`context-menu.tsx` sets `longPress`.

## Decisions

1. **Extension shape.**
   ```ts
   interface PressExtension {
     down(e: PointerEvent, ctx: PressExtensionContext): void
     move(e: PointerEvent): void
     end(): { readonly suppressPress: boolean }
     cancel(): void
     holdsContextMenu(): boolean
   }
   ```
   `ctx` carries `env.scheduler`, `send`, the part element and `modality`. `createPress` calls the
   hooks where it reads `options.longPress` today; with no extension each call site is a
   `?.` on `undefined`.
   Why an object of hooks, not a subclass or flags: it is the only extension, and the hooks are
   exactly the five existing touch points.
2. **`longPressExtension(options)`** in `dom/long-press.ts` holds the timer, tolerance, pointer
   tracking and callout attribute, moved verbatim.
3. **Tests**: the existing press long-press tests run against `createPress` with the extension;
   one test asserts a press without it never schedules a long-press timer.
4. **Size check**: `Button` metafile must not include `dom/long-press`.

## Risks / Trade-offs

- [Press is quirk-heavy; moving code can shift event order] → move code verbatim, keep the
  call order of the hooks identical to today's inline order, run the full press and Context
  Menu suites in all three engines.
