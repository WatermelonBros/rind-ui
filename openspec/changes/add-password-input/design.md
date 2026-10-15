## Context

[password-input.md](../../../docs/research/password-input.md) has the comparison and the bug
history. Password Input is a Text Field (`add-text-field`) plus one boolean. It builds on,
without re-specifying:

| Change | What Password Input uses |
|---|---|
| `add-text-field` | the `text-field` machine (through the builder requested below), connect, parts, contract actions, `field-control` implementation, theme family `field` |
| `add-a11y-foundations` | press interactions (press without focus, virtual click), modality, Announcer, messages |
| `add-button` | `button-like-element` for the trigger |
| `add-toggle` | rules reused, not the machine: explicit `aria-pressed`, a name that never follows the state (enforced the same way: invariant + dev warning) |
| `add-pin-input` | the injected-style helper it requests from `add-a11y-foundations` |
| `add-foundations` | controllable values, effects reading live props (the radix#4157 class), contracts, `testMachine` |

## Goals / Non-Goals

**Goals:**
- No second machine: one Text Field definition with a preset (as Alert Dialog is a Dialog
  preset), so IME, value, Field and ClearTrigger behaviour cannot drift.

**Non-Goals:**
- Using the Toggle machine for the trigger: the state belongs to the field (it changes the
  input's `type` and resets on submit), so it is a value of the field's machine, not a sibling
  service the parts would have to synchronise.

## Decisions

### 1. Machine: a Text Field preset

```ts
export const passwordInputMachine = buildTextFieldMachine({
  scope: "password-input",
  values: { visible: controllable("visible", { fallback: false }) },      // not state-bound
  events: {
    "VISIBILITY.TOGGLE": { guard: "notDisabled", actions: ["toggleVisible", "keepSelection", "announceIfInputFocused"] },
    "VISIBILITY.HIDE":   { actions: ["hide"] },                            // reason SUBMIT | RESET
  },                                                                      // added to `on` (global), so both states accept them
  effects: ["formVisibilityReset"],                                       // service effect: form submit (always) + reset (if not prevented) → VISIBILITY.HIDE
})
// events: { type: "VISIBILITY.TOGGLE"; modality: Modality; inputFocused: boolean; selection: [number, number] | null }
//         { type: "VISIBILITY.HIDE"; reason: "SUBMIT" | "RESET" }
```

- States stay Text Field's `idle | composing`; `visible` is a second controllable in context.
  Making it state-bound would double the graph (`idle × visible`) for no transition that
  depends on it.
- `formVisibilityReset` reads `visible`/`onVisibleChange` from live props when the event
  fires (machine-runtime "Stale reads"), which is exactly radix#4157's failure.
- `keepSelection`: the event carries the selection captured by connect at press start;
  `type` changes in the commit; a `core/dom` call restores the range in the same frame
  (`requestAnimationFrame` through the scheduler, cancelled if focus left). Radix restores a
  selection saved on blur one frame later; ours never loses focus to begin with.
- `announceIfInputFocused`: only when `inputFocused` (pointer press with press-without-focus);
  keyed per field.

### 2. Connect

| Part | Attributes |
|---|---|
| Root | Text Field's + `data-state` |
| Input | Text Field's binding + `type`, `autoComplete` default `current-password`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck=false`, `data-state`; `data-custom-reveal` while a trigger is mounted (selector for the injected `::-ms-reveal { display: none }`) |
| VisibilityTrigger | button-like props, `aria-pressed`, `aria-controls`, `aria-label` from `messages.toggleLabel` unless the consumer names it, `data-state`; press handlers with press-without-focus for pointer/touch, mouse/pen focus the input if needed; selection captured on `PRESS.START` |
| Indicator | `aria-hidden="true"`, `data-state` |

The trigger stays in the tab order (no keyboard alternative exists — WCAG 2.1.1), unlike
Text Field's ClearTrigger.

### 3. React parts

`PasswordInput.Root` uses the Root-as-Field helper with the preset machine; `Label`,
`Description`, `ErrorMessage`, `Input` are Text Field's parts bound to scope
`password-input`; `VisibilityTrigger` and `Indicator` are new. `ClearTrigger` and
`CharacterCount` are re-exported for consumers who want them.

### 4. Contract and model-based tests

- Text Field's contract actions are reused through contract composition (same anatomy names);
  new actions `toggleVisibility`, `submitForm`, `resetForm`.
- Configurations: uncontrolled, controlled applying proposals, controlled refusing,
  `new-password`, read-only (toggle allowed), disabled (toggle refused), inside a Field with
  `invalid`, in a form with submit and reset buttons.

### 5. Theme

`password-input.css`, family `field`, reuses Text Field's control tokens through
`--rind-password-input-*` with fallbacks to `--rind-text-field-*`; trigger sizing, inline-end
padding (`--rind-password-input-trigger-space`) so password-manager badges and the trigger do
not overlap the text, pressed state with an icon change plus `aria-pressed` styling, forced
colors, a `data-tone="danger"` capture.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-text-field**: export a machine builder `buildTextFieldMachine(preset)` (as
  `add-dialog`'s `buildDialogMachine`): a preset may add controllable values, global events
  with their guards and actions, service effects and a scope; the empty preset is Text Field.
  The Text Field connect, parts and contract accept the scope as a parameter. Also make the
  ClearTrigger's change reason a parameter of the clear action (Search Field passes `ESCAPE`).
  Password Input and Search Field are the first two presets.
- **add-a11y-foundations**: the injected-style helper requested by `add-pin-input` (here:
  hiding `::-ms-reveal`).

## Risks / Trade-offs

- [Selection restore depends on engines keeping focus through a `type` change] → focus never
  leaves the input; the restore is unconditional while focused; browser tests in three engines.
- [Hiding on every submit hides it even when submission is prevented for client validation]
  → intentional (Radix, GOV.UK): the user reveals again; safer than storing the text.
- [Reveal-on-press-and-hold patterns are not supported] → non-goal.

## Migration Plan

Reado: `molecules/VaultBar.tsx` replaces the plain input with `PasswordInput.Root` +
`Input` (+ `VisibilityTrigger`); its `autoComplete="off"` stays as a prop and its Enter
handler stays as `onKeyDown` guarded with the exported IME guard.
