// hidden-form-input: the one native input through which a control that is not a native
// form field takes part in forms — submission, constraint validation, reset and implicit
// submission. Values are written as properties (never the `checked` attribute, which is
// the default a reset restores); events are dispatched for user changes only, never a
// synthetic `click` (radix#3265, zag#633, base-ui#5175).

import type { Modality } from "../contract/env"
import type { ModalityEnv, MotionEnv, SchedulerEnv } from "../env/capabilities"
import { keepControlValidity } from "./constraint-validity"
import { focusSafely } from "./focus-safely"

/** The value a hidden input mirrors. */
export interface HiddenInputValue {
  readonly checked?: boolean | undefined
  readonly indeterminate?: boolean | undefined
  /** The `value` property (a text or typed input; a checkbox's submitted value). */
  readonly value?: string | undefined
  /**
   * A list value (Select, Combobox): the adapter renders one hidden carrier per entry; the
   * constraint input is the validity proxy, empty (valueMissing when required) exactly
   * when the list is.
   */
  readonly values?: readonly string[] | undefined
  /** The second input of a two-part value (`endName`). */
  readonly endValue?: string | undefined
}

export interface SyncOptions {
  /** A user change: dispatch `input` then `change` after writing (same task). */
  readonly dispatch: boolean
}

export interface TrackOptions {
  /** The form's `reset`: the machine restores the current default (RESET). */
  readonly onReset: () => void
  /** The component's value now, for the re-sync after a reset or a framework reset. */
  readonly current: () => HiddenInputValue
  /** False when a group owns the reset (add-checkbox-group). Default true. */
  readonly resetsWithForm?: boolean
  /**
   * Adopting native input (autofill, password managers): called for an `input`/`change`
   * the component did not dispatch. Return true when the machine accepted the native value
   * (it follows); false re-syncs the input from the component.
   */
  readonly onNativeInput?: (input: HTMLInputElement) => boolean
}

/** What a machine reaches the hidden input through (injected, so node tests record it). */
export interface FormInputCapability {
  sync(value: HiddenInputValue, options: SyncOptions): void
  track(options: TrackOptions): () => void
}

export interface HiddenInputElements {
  /** The constraint (validity) input. */
  readonly input: () => HTMLInputElement | null
  /** The second input of a two-part value, if rendered. */
  readonly end?: () => HTMLInputElement | null
  /** The visible control focus is forwarded to; none for an accessible native input. */
  readonly control?: () => HTMLElement | null
}

const proto = (el: HTMLInputElement) =>
  Object.getPrototypeOf(el) as typeof HTMLInputElement.prototype
/** The prototype's setter, so React's value tracker is not confused. */
function setProperty(
  el: HTMLInputElement,
  name: "checked" | "indeterminate" | "value",
  v: unknown,
) {
  let p: object | null = proto(el)
  while (p) {
    const d = Object.getOwnPropertyDescriptor(p, name)
    if (d?.set) {
      d.set.call(el, v)
      return
    }
    p = Object.getPrototypeOf(p)
  }
  ;(el as unknown as Record<string, unknown>)[name] = v
}

function write(el: HTMLInputElement, v: HiddenInputValue, end?: HTMLInputElement | null) {
  if (v.checked !== undefined && el.checked !== v.checked) setProperty(el, "checked", v.checked)
  if (v.indeterminate !== undefined && el.indeterminate !== v.indeterminate) {
    setProperty(el, "indeterminate", v.indeterminate)
  }
  const value = v.values ? v.values.join(",") : v.value
  if (value !== undefined && el.value !== value) setProperty(el, "value", value)
  if (end && v.endValue !== undefined && end.value !== v.endValue)
    setProperty(end, "value", v.endValue)
  // A re-sync never clears a validity message (the Field's, or the control's own).
  keepControlValidity(el)
}

const fire = (el: EventTarget) => {
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

/** The hidden input of one control (its DOM side of `FormInputCapability`). */
export function hiddenFormInput(
  elements: HiddenInputElements,
  env: SchedulerEnv & ModalityEnv & Partial<MotionEnv>,
): FormInputCapability {
  let dispatching = false
  return {
    sync(value, { dispatch }) {
      const input = elements.input()
      if (!input) return
      const end = elements.end?.() ?? null
      write(input, value, end)
      if (!dispatch) return
      dispatching = true
      try {
        fire(input)
        if (end && value.endValue !== undefined) fire(end)
      } finally {
        dispatching = false
      }
    },
    track(options) {
      const input = elements.input()
      if (!input) return () => {}
      const doc = input.ownerDocument
      let frame: ReturnType<SchedulerEnv["scheduler"]["requestAnimationFrame"]> | null = null
      // After the browser (or a framework) changed the input behind the component.
      const resync = () => {
        if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
        frame = env.scheduler.requestAnimationFrame(() => {
          frame = null
          const el = elements.input()
          if (el) write(el, options.current(), elements.end?.() ?? null)
        })
      }
      // Bubbling, on the document: the input's form is read at event time (the `form` prop
      // may change), and a reset someone prevented (defaultPrevented) is ignored.
      const onReset = (e: Event) => {
        const el = elements.input()
        if (!el || e.target !== el.form || e.defaultPrevented) return
        if (options.resetsWithForm !== false) options.onReset()
        // The browser resets the input to its default after this event: re-sync after it.
        resync()
      }
      doc.addEventListener("reset", onReset)
      // Validation, script or a label focusing the input: the visible control instead, with
      // a ring (keyboard), so the user sees which field failed (react-spectrum#7317).
      const onFocus = () => {
        const control = elements.control?.()
        if (control) void focusSafely(control, env, "programmatic", "keyboard" satisfies Modality)
      }
      if (elements.control) input.addEventListener("focus", onFocus)
      // Native input the component did not dispatch (autofill), or a framework writing it.
      const onNative = () => {
        if (dispatching) return
        if (options.onNativeInput?.(input)) return
        resync()
      }
      input.addEventListener("input", onNative)
      input.addEventListener("change", onNative)
      return () => {
        if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
        doc.removeEventListener("reset", onReset)
        input.removeEventListener("focus", onFocus)
        input.removeEventListener("input", onNative)
        input.removeEventListener("change", onNative)
      }
    },
  }
}

/** The HTML default button of `form`: its first submit button in tree order (incl. `form=`). */
function defaultButton(form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | null {
  for (const el of Array.from(form.elements)) {
    if (
      (el instanceof HTMLButtonElement && el.type === "submit") ||
      (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "image"))
    ) {
      return el
    }
  }
  return null
}

/**
 * Implicit submission (Enter on a checkbox, switch or radio in a form): the default button
 * is activated if there is one and it is enabled; with none, nothing happens (what Chromium,
 * Firefox and WebKit do for checkboxes).
 */
export function implicitSubmit(form: HTMLFormElement | null): void {
  if (!form) return
  const button = defaultButton(form)
  if (button && !button.disabled) button.click()
}

/**
 * The hidden input's style: visually hidden at its static position (no offsets: it sits
 * next to the control), never a pointer target. `fixed`, not `absolute`: an absolute box
 * whose containing block is the page (no positioned ancestor) escapes a scroll container's
 * clipping and stretches the document's scroll size (radix#3588, radix#2402); a fixed box
 * adds to no scroll size, and focusing it scrolls nothing (ark#3705).
 */
export const hiddenFormInputStyle = {
  border: "0",
  clip: "rect(0 0 0 0)",
  "clip-path": "inset(50%)",
  height: "1px",
  width: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "fixed",
  "white-space": "nowrap",
  "pointer-events": "none",
} as const

/** A recording fake, for machine tests without a DOM. */
export function recordingFormInput() {
  const calls: { value: HiddenInputValue; dispatch: boolean }[] = []
  let reset: (() => void) | null = null
  const capability: FormInputCapability = {
    sync: (value, { dispatch }) => {
      calls.push({ value, dispatch })
    },
    track: (o) => {
      reset = o.onReset
      return () => {
        reset = null
      }
    },
  }
  return { capability, calls, reset: () => reset?.() }
}
