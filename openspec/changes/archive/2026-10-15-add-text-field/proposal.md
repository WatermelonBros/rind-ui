## Why

Text input is the most common form control. Four libraries ship it, and Reado has its own
`Input` and `Textarea` atoms. The hard parts are behaviour:
- IME composition: writing `.value` or acting on Enter while composing breaks Japanese and
  Korean input (kobalte#737, react-spectrum#10249);
- uncontrolled inputs that stay truly native, so autofill, tab restore and React 19 action
  resets work (react-spectrum#6601, react-spectrum#8995);
- an autosizing textarea that does not patch `value` (zag#3204);
- a clear button that goes through the change path (base-ui#4643);
- a character count that is announced, not just shown.

Text Field is also the first control to implement `field-control`, and its autosize module
is reused by Prompt Input and Editable.

Research: [text-field](../../../docs/research/text-field.md) ·
[field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §6, §7 ·
[native-platform](../../../docs/research/native-platform.md) §11

Depends on: `add-foundations`, `add-a11y-foundations` (IME guard, `announcer`, `messages`,
`press-interactions` press without focus, `interaction-modality`), `add-field` (`field`,
`field-control`, `field-validation`), `add-label`, `add-button` (`button-like-element` for
the ClearTrigger).

## What Changes

- A public **Text Field** component. Parts:
  - `Root`, which is a Field when not already inside one;
  - `Label`, `Description` and `ErrorMessage` (the Field parts);
  - exactly one of `Input` (`<input>`) or `Textarea` (`<textarea>`);
  - `ClearTrigger`;
  - `CharacterCount`.
- Value: `value` / `defaultValue` / `onValueChange(value, details)`, where details carry the
  reason (`INPUT`, `CLEAR`, `RESET`, or a preset's clear reason), the native event and `isComposing`. Uncontrolled
  fields keep the DOM in charge (`defaultValue`). Every native input attribute is forwarded.
- **IME**: no value writes, selection moves, validation or announcements during
  composition. `onValueChange` still fires, flagged.
- **ClearTrigger**: a button named "Clear" (from `messages`), out of the tab order. It does
  not take focus, clears through the change path and keeps focus in the input. It is not
  rendered when the field is empty, disabled or read-only.
- **CharacterCount**: counts against `maxLength` (hard limit) or its own `max` (soft limit:
  over-limit is a `tooLong` error through Field). It counts like the browser does, unless a
  `count` function is given. It is part of the input's description, and is announced
  politely near and over the limit, only while focused.
- **Shared capability `autosize-textarea`**, specified here once: `field-sizing: content`
  when supported, else a measured fallback that never patches `value` or dispatches
  events. Reused by Prompt Input and Editable.
- **Extension points** for the components built on Text Field: `buildTextFieldMachine(preset)`
  (Password Input and Search Field are the first presets), the clear action's reason as a
  parameter, and the shared Root-as-Field helper `react/src/field/use-field-host.ts` (reused
  by Number Input, Pin Input, Password Input and Search Field).
- `field-control` implementation and the `field-associated` trait. A theme stylesheet in the
  `field` family (`outline` default, `soft`), the contract and driver (`getTextField`),
  model-based tests, stories and a docs page.

## Capabilities

### New Capabilities

- `text-field`: the Text Field component: anatomy, value model, native attributes, IME,
  ClearTrigger, CharacterCount, Field integration, data attributes, contract, theme.
- `autosize-textarea`: content-sized textareas with a native-first strategy and a
  side-effect-free fallback.

### Modified Capabilities

None.

## Non-goals

- Search Field (`type="search"`, `searchbox` role, Escape clears), Password Input
  (visibility toggle), Number Input, Pin Input: their own changes.
- Submit-on-Enter and Cmd/Ctrl+Enter submission (Prompt Input). Reado's `Textarea`
  `onSubmit`/`onCancel` become a docs recipe.
- Input masking, formatting and caret management for formatted values. `details.event` is
  exposed for consumers that do it.
- Leading and trailing adornments as parts. They are the consumer's markup inside Root.
- Rich text (`contenteditable`). Framework adapters other than React; fx.

## Impact

- `packages/core`:
  - `components/text-field/` (machine, connect, contract, messages);
  - `dom/autosize.ts` (`autosize-textarea`);
  - the first use of `components/shared/field-control.ts`.
- `packages/react/src/text-field/`, `@rind-ui/testing` (`getTextField`),
  `@rind-ui/theme/text-field.css`, stories, docs.
- Reado: `atoms/Input.tsx` maps to Root + Input (its `trailing` clear button becomes
  ClearTrigger). `atoms/Textarea.tsx` maps to Root + Textarea (`autosize` optional; its
  keyboard shortcuts stay in Reado).
- No new runtime dependency.
