## Why

`createPress` (`packages/core/src/dom/press.ts`, 2.8 kB gzip on its own) contains the
long-press logic inline: its timer, movement tolerance, second-pointer cancel, callout
attribute and trailing-press suppression. Only Context Menu opts into long press, yet every
pressable component (Button, Toggle, Checkbox, Tabs, Menu items, …) ships it.

## What Changes

- Long press becomes an extension module passed to `createPress` by the part that opts in
  (`longPress: longPressExtension({ threshold, moveTolerance })`) instead of a plain options
  object read by code that is always bundled.
- `createPress` exposes the few hooks the extension needs (pointer down/move/up/cancel,
  "suppress trailing press", "suppress touch context menu"); behaviour without the extension
  is unchanged, and with it identical to today.
- Context Menu passes the extension. No other part changes.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bundle-size`: pressable components that do not opt into long press do not ship it.

The `press-interactions` requirements (Long Press, Touch Context Menu Suppression Without Long
Press) are unchanged: the same behaviour, opted into differently.

## Non-goals

- Changing long-press timing, tolerance, hint or contract actions.
- Splitting other parts of `press` (label forwarding, text selection): measured as small and
  needed by most pressables.

## Impact

- `packages/core/src/dom/press.ts`, new `packages/core/src/dom/long-press.ts`.
- `packages/react/src/context-menu/context-menu.tsx`, `packages/core/src/dom/index.ts` export.
- **BREAKING** for direct `createPress` callers that passed `longPress: { … }` (core's DOM
  utilities are public): they now pass `longPressExtension({ … })`. Changeset says so.
