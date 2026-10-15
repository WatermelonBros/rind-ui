// Native constraint validity as the Field's source of truth (field-validation): reading the
// failing key, setting and clearing only the custom message rind-ui set (a foreign one is
// restored), and the first invalid element of a form in tree order.

export type ValidityKey =
  | "valueMissing"
  | "typeMismatch"
  | "patternMismatch"
  | "tooShort"
  | "tooLong"
  | "rangeUnderflow"
  | "rangeOverflow"
  | "stepMismatch"
  | "badInput"
  | "customError"

/** In the order a failing element reports them (the first that applies is the cause). */
export const VALIDITY_KEYS: readonly ValidityKey[] = [
  "valueMissing",
  "typeMismatch",
  "patternMismatch",
  "tooShort",
  "tooLong",
  "rangeUnderflow",
  "rangeOverflow",
  "stepMismatch",
  "badInput",
  "customError",
]

/** The element a form validates: the control's input, or its hidden input. */
export type ConstraintElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLButtonElement

export interface ValidityReading {
  readonly valid: boolean
  readonly key: ValidityKey | null
  readonly message: string
}

/** The message rind-ui set, and the foreign one it replaced, per element. */
const own = new WeakMap<ConstraintElement, { readonly message: string; readonly foreign: string }>()

export function readValidity(el: ConstraintElement): ValidityReading {
  const key = VALIDITY_KEYS.find((k) => el.validity[k]) ?? null
  return { valid: key === null, key, message: key === null ? "" : el.validationMessage }
}

export function setOwnCustomValidity(el: ConstraintElement, message: string): void {
  const mine = own.get(el)
  // A message someone else set (not ours) is kept to restore later.
  const foreign =
    mine && el.validationMessage === mine.message
      ? mine.foreign
      : el.validity.customError
        ? el.validationMessage
        : ""
  own.set(el, { message, foreign })
  el.setCustomValidity(message)
}

/** Clears only the message rind-ui set, restoring a foreign one. */
export function clearOwnCustomValidity(el: ConstraintElement): void {
  const mine = own.get(el)
  if (!mine) return
  own.delete(el)
  // Someone replaced ours since: theirs stays.
  if (el.validity.customError && el.validationMessage !== mine.message) return
  el.setCustomValidity(mine.foreign)
}

/** Whether rind-ui's own message is the element's custom validity now. */
export const hasOwnCustomValidity = (el: ConstraintElement) => own.has(el)

/** The first element of `form` (tree order, `form.elements`) that fails validation. */
export function firstInvalidInTreeOrder(form: HTMLFormElement): Element | null {
  for (const el of Array.from(form.elements)) {
    const c = el as Partial<ConstraintElement>
    if (c.willValidate && c.validity && !c.validity.valid) return el
  }
  return null
}

/** The capability machines read validity through (dependency inversion: no DOM in machines). */
/**
 * The browser's own "required" message for an element like `el`, read from a detached copy
 * (no `required` on the real element: `aria` behaviour never blocks submission).
 */
export function requiredMessage(el: ConstraintElement): string {
  const probe = el.ownerDocument.createElement(el.tagName.toLowerCase()) as ConstraintElement
  if ("type" in probe && el instanceof HTMLInputElement) (probe as HTMLInputElement).type = el.type
  probe.setAttribute("required", "")
  return probe.validationMessage
}

export interface ConstraintValidity {
  read(el: ConstraintElement): ValidityReading
  requiredMessage(el: ConstraintElement): string
  setOwn(el: ConstraintElement, message: string): void
  clearOwn(el: ConstraintElement): void
  firstInvalid(form: HTMLFormElement): Element | null
}

export const constraintValidity: ConstraintValidity = {
  read: readValidity,
  requiredMessage,
  setOwn: setOwnCustomValidity,
  clearOwn: clearOwnCustomValidity,
  firstInvalid: firstInvalidInTreeOrder,
}
