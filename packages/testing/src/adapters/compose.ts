// A complete IME composition on a text field, synthesised in the page: the DOM adapter calls
// it directly, the Playwright adapter evaluates it in Firefox and WebKit (Chromium gets the
// real thing through the DevTools protocol). Self-contained: Playwright serialises it.

/**
 * compositionstart; per update a composing keydown, compositionupdate and input; then the
 * commit as a last composing input (value = committed text) and compositionend with it.
 * Without `commit` the composition stays open; a later call continues it (no new
 * compositionstart) and can end it.
 */
export function composeInPage(
  el: Element,
  { updates, commit }: { readonly updates: readonly string[]; readonly commit?: string },
): void {
  const field = el as HTMLInputElement & {
    __rindComposition?: { readonly before: string; readonly after: string }
  }
  const open = field.__rindComposition
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? start
  const { before, after } = open ?? {
    before: field.value.slice(0, start),
    after: field.value.slice(end),
  }
  // The prototype's setter, so frameworks tracking the value (React) see the change.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set
  /** The field's value with `text` composed at the caret, the caret after it. */
  const setValue = (text: string) => {
    const value = before + text + after
    if (setter) setter.call(field, value)
    else field.value = value
    const caret = before.length + text.length
    field.setSelectionRange?.(caret, caret)
  }
  const key = (type: "keydown" | "keyup") => {
    const e = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: "Process",
      isComposing: true,
    })
    Object.defineProperty(e, "keyCode", { value: 229 })
    field.dispatchEvent(e)
  }
  const input = (text: string) =>
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        isComposing: true,
        inputType: "insertCompositionText",
        data: text,
      }),
    )
  if (!open) {
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }))
    field.__rindComposition = { before, after }
  }
  for (const text of updates) {
    key("keydown")
    field.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: text }))
    setValue(text)
    input(text)
    key("keyup")
  }
  if (commit === undefined) return
  // As Chromium and Firefox do: the commit is a last composing input, then compositionend.
  setValue(commit)
  input(commit)
  delete field.__rindComposition
  field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: commit }))
}
