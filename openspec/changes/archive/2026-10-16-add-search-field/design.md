## Context

[search-field.md](../../../docs/research/search-field.md) has the comparison and the bug
history. Search Field is a Text Field preset; everything about value, IME, ClearTrigger,
Field and the theme family is Text Field's (`add-text-field`). Escape ownership is the
dismissable layer's rule: an inner widget that handles Escape calls `preventDefault()` and the
layer stays open (`add-overlay-infrastructure` `dismissable-layer`, `add-popover`).

| Change | What Search Field uses |
|---|---|
| `add-text-field` | machine via `buildTextFieldMachine` (requested in `add-password-input`), `clearInput` with a reason parameter, connect/parts/contract under scope `search-field` |
| `add-a11y-foundations` | IME guard (`composing` on key events, Safari commit-Enter quirk), press interactions for the ClearTrigger |
| `add-overlay-infrastructure` | `dismissable-layer` Escape consumption rule |
| `add-pin-input` | injected-style helper (cancel button hiding) |

## Goals / Non-Goals

**Goals:**
- Two events on the Text Field machine, nothing else.

**Non-Goals:**
- A `search` landmark part or debouncing (proposal Non-goals).

## Decisions

### 1. Machine: a Text Field preset

```ts
export const searchFieldMachine = buildTextFieldMachine({
  scope: "search-field",
  events: {
    ESCAPE: { guard: { and: ["notComposing", "hasValue", "editable"] },
              actions: ["consumeKey", { clearInput: { reason: "ESCAPE" } }] },
    SUBMIT: { guard: "notComposing", actions: ["reportCommit", "callOnSubmit"] },
  },
})
// { type: "ESCAPE"; event: KeyboardEvent; composing: boolean }
// { type: "SUBMIT"; event: KeyboardEvent; composing: boolean }
```

- Both are global events; `composing` comes from `keyboard-interactions` (so Safari's commit
  Enter after `compositionend` is still `composing`). In the `composing` state the guards fail
  anyway; the explicit `notComposing` guard covers the Safari ordering.
- `consumeKey` calls `preventDefault()` and `stopPropagation()` on the native event only when
  the transition is taken; otherwise connect leaves the event alone, so it reaches the layer
  (react-spectrum#5480). Our handler runs after the consumer's (react-adapter merge order:
  consumer first), so a consumer `onKeyDown` always sees Escape (react-spectrum#2253).
- `SUBMIT` never prevents the native event: implicit submission proceeds (design difference
  from React Aria, which prevents it when `onSubmit` is set).
- *Alternative*: a `clearOnEscape` flag on Text Field (rejected: CLAUDE.md "a new behaviour is
  a new event, not a boolean prop"); a separate copied machine (rejected: copies drift, the
  Alert Dialog precedent).

### 2. Connect

| Part | Attributes |
|---|---|
| Root | Text Field's + `data-empty` |
| Input | Text Field's binding + `type="search"`, `enterKeyHint="search"` (consumer wins), `data-empty`, `data-custom-clear` while a ClearTrigger is registered; keydown Escape → `ESCAPE`, Enter → `SUBMIT` |
| ClearTrigger | Text Field's, name `messages.clear` = "Clear search" |

Injected style (helper from `add-pin-input`'s request):
`[data-scope="search-field"][data-part="input"][data-custom-clear]::-webkit-search-cancel-button
{ appearance: none; display: none }`.

### 3. Contract and model-based tests

- Text Field's actions reused; new `escape`, `submit`; `clear` gains Escape as its keyboard
  implementation.
- Configurations: standalone, inside a Dialog story (Escape ownership), inside a form, with a
  Field and `minLength` (react-spectrum#7265), read-only, disabled, controlled.

### 4. Theme

`search-field.css`, family `field`, `--rind-search-field-*` tokens falling back to
`--rind-text-field-*`; resets `-webkit-appearance` of the input and its
`::-webkit-search-decoration`; leading icon slot padding (`--rind-search-field-icon-space`);
ClearTrigger transparent with a `currentColor` glyph; forced colors; a `data-tone="danger"`
capture.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-text-field**: the `buildTextFieldMachine` builder and the reason parameter of the
  clear action, as requested in `add-password-input` (one request, two presets).
- **add-a11y-foundations**: the injected-style helper requested in `add-pin-input`.

## Risks / Trade-offs

- [Some users expect Escape to clear even inside a combobox-like popup] → that is
  Autocomplete; a plain search field has no popup.
- [Native Escape clearing on `type=search` is replaced by ours only when we handle the key] →
  on an empty field nothing is cleared either way.
