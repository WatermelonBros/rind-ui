---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Combobox and Listbox fixes from the cross-library audit:

- A selected option the server-filtered results no longer contain keeps its text on blur and on its chip (it reverted to an empty input while the value stayed).
- A parent clearing the controlled value clears the input text.
- Enter on typed text the combobox rejects no longer submits the form.
- Inline mode (a command palette) loops by default, as specified.
- A press on a disabled option no longer closes the popup.
- Listbox with `strategy="active-descendant"` announces the highlighted option in VoiceOver with Safari.
- The highlight stays during an IME composition; a pointer choice mid-composition is final.
- A caret moved before async results arrive is never overwritten by an inline completion.
- Chips follow a read-only Field; Clear with nothing selected reports no value change; a disabled selected option is never the keyboard entry highlight.
