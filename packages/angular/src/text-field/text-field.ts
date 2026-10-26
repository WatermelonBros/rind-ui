import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  untracked,
} from "@angular/core"
import {
  announcerCapability,
  autosize as attachAutosize,
  defaultCount,
  focusSafely,
  injectStyle,
  type MessageOverrides,
  mergeFieldProps,
  type TextFieldDetails,
  type TextFieldMessages,
  type TextFieldOwnEvent,
  type TextFieldReason,
  type TextFieldSubmitDetails,
  type TextFieldVisibilityHideReason,
  textFieldCancelStyle,
  textFieldConnect,
  textFieldKeysConnect,
  textFieldMachine,
  textFieldMessages,
  textFieldRevealStyle,
  textFieldVisibilityConnect,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { FIELD_CONTROL, FIELD_HOST, injectFieldControl } from "../field/context"
import { FieldDescription, FieldErrorMessage, FieldLabel, FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { RindIds } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

export type { TextFieldDetails }
export type TextFieldVisibilityReason = "PRESS" | "SUBMIT" | "RESET"
export interface TextFieldVisibilityDetails {
  readonly reason: TextFieldVisibilityReason
}

interface CountState {
  readonly id: string
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

const TEXT_FIELD = new InjectionToken<TextFieldRoot>("rind-ui.text-field")

function injectTextField(part: string): TextFieldRoot {
  const root = inject(TEXT_FIELD, { optional: true })
  if (!root) throw new Error(`rindTextField${part} must be inside rindTextFieldRoot`)
  return root
}

/** `undefined` stays undefined (the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/** The `type` last rendered (the `data-state` it carries agrees with it). */
const renderedType = (el: HTMLInputElement) =>
  el.getAttribute("data-state") === "visible" ? "text" : "password"

/**
 * A text input with its label, description and error: `<div rindTextFieldRoot name="email">`
 * holding a Label and an `<input rindTextFieldInput>`. Alone it is a Field (it composes
 * `rindFieldRoot`); inside a Field it joins that one.
 */
@Directive({
  selector: "[rindTextFieldRoot]",
  exportAs: "rindTextFieldRoot",
  hostDirectives: [
    {
      directive: FieldRoot,
      inputs: [
        "name",
        "disabled",
        "readonly",
        "required",
        "invalid",
        "touched",
        "dirty",
        "errors",
        "validate",
        "validationMode",
        "validationBehavior",
        "validationDebounce",
        "errorMessageAttribute",
        "messages: fieldMessages",
        "id",
      ],
    },
  ],
  providers: [
    { provide: TEXT_FIELD, useExisting: forwardRef(() => TextFieldRoot) },
    { provide: FIELD_HOST, useValue: { scope: "text-field" } },
  ],
})
export class TextFieldRoot {
  /**
   * The Input's native type. `"password"`: the visibility parts and rules (hidden on submit and
   * reset, caret kept, privacy attributes); `"search"`: a searchbox, "Clear search", Escape
   * clears.
   */
  readonly type = input<string>()
  /** `type="password"`: controlled visibility (`[(visible)]`). */
  readonly visible = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultVisible = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Escape clears a non-empty editable value (default: true for `type="search"`). */
  readonly escapeClears = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Controlled value (`[(value)]`). */
  readonly value = input<string | null>()
  readonly defaultValue = input<string>()
  /** Disabled but focusable: read-only + aria-disabled; nothing changes the value. */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  /** Announce the count when this many or fewer characters remain. */
  readonly countThreshold = input<number>()
  readonly messages = input<MessageOverrides<TextFieldMessages>>()
  /** Every change, with the reason and the native event. */
  readonly valueChangeDetails = output<{ value: string; details: TextFieldDetails }>()
  /** The new value, for `[(value)]`. */
  readonly valueChange = output<string>()
  readonly visibleChangeDetails = output<{
    visible: boolean
    details: TextFieldVisibilityDetails
  }>()
  readonly visibleChange = output<boolean>()
  /** Enter (not composing). The form still submits unless `details.event` is prevented. */
  readonly submit = output<{ value: string; details: TextFieldSubmitDetails }>()

  /** @internal */
  readonly scope = "text-field"
  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof textFieldMachine>>["view"]
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof textFieldMachine>>["send"]
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly readOnlyState: () => boolean
  /** @internal */
  readonly texts: () => TextFieldMessages
  /** @internal */
  readonly countState = signal<CountState | null>(null)
  /** @internal */
  readonly maxLength = signal<number | undefined>(undefined)
  /** @internal */
  readonly limit = () => this.maxLength() ?? this.countState()?.max
  /** @internal */
  readonly controlEl: { current: HTMLInputElement | HTMLTextAreaElement | null } = {
    current: null,
  }
  /** @internal */
  readonly controlId = signal<string | undefined>(undefined)
  /** @internal */
  readonly mountedParts = signal({ clearTriggers: 0, triggers: 0 })
  /** @internal */
  readonly pendingSelection: { current: readonly [number, number] | null } = { current: null }
  /** @internal */
  readonly controls = { current: 0 }
  /** @internal */
  readonly takeReason: () => TextFieldReason | undefined
  /** @internal Writes the soft-limit validity for `value` (before the Field sees the change). */
  readonly applySoftLimit: (value: string) => void

  constructor() {
    const env = injectEnvironment(announcerCapability)
    this.instance = this.field.instance
    this.texts = injectMessages("text-field", textFieldMessages, () => this.messages())
    // The enclosing Field's state (this element's own Field is its own inputs).
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const fieldsetDisabled = injectFieldsetDisabled()
    this.disabledState = () =>
      this.field.disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    this.readOnlyState = () => this.field.readonly() || enclosing?.().state.readOnly === true
    let reason: TextFieldReason | undefined
    this.takeReason = () => reason
    const controlEl = this.controlEl
    const pendingSelection = this.pendingSelection
    const { view, send } = injectMachine(
      textFieldMachine,
      () => ({
        visible: this.visible(),
        defaultVisible: this.defaultVisible(),
        onVisibleChange: (visible: boolean, details: unknown) => {
          const e = (details as { event: { type: string; reason?: TextFieldVisibilityHideReason } })
            .event
          this.visibleChangeDetails.emit({
            visible,
            details: { reason: e.type === "VISIBILITY.HIDE" ? (e.reason ?? "SUBMIT") : "PRESS" },
          })
          this.visibleChange.emit(visible)
        },
        keepSelection: (selection: readonly [number, number]) => {
          pendingSelection.current = selection
        },
        watchForm:
          this.type() !== "password"
            ? undefined
            : (on: { readonly submit: () => void; readonly reset: () => void }) => {
                const form = controlEl.current?.form
                if (!form) return () => {}
                const onSubmit = () => {
                  const el = controlEl.current
                  // The browser builds the form data (and a password manager reads it) right
                  // after this event: the input is a password input by then.
                  if (el instanceof HTMLInputElement && el.type !== "password") {
                    el.type = "password"
                    env.scheduler.setTimeout(() => {
                      if (controlEl.current === el) el.type = renderedType(el)
                    }, 0)
                  }
                  on.submit()
                }
                // The consumer may prevent the reset in a later listener: read it once
                // dispatch ends.
                const onReset = (e: Event) =>
                  env.scheduler.setTimeout(() => {
                    if (!e.defaultPrevented) on.reset()
                  }, 0)
                form.addEventListener("submit", onSubmit)
                form.addEventListener("reset", onReset)
                return () => {
                  form.removeEventListener("submit", onSubmit)
                  form.removeEventListener("reset", onReset)
                }
              },
        escapeClears: this.escapeClears() ?? this.type() === "search",
        onSubmit: (value: string, details: TextFieldSubmitDetails) =>
          this.submit.emit({ value, details }),
        value: this.value() === undefined ? undefined : (this.value() ?? ""),
        defaultValue: this.defaultValue() ?? "",
        onValueChange: (v: string, details: unknown) => {
          // Machine details → the public ones (reason, native event, isComposing).
          const e = (
            details as {
              event: { type: string; reason?: string; event?: Event | null; composing?: boolean }
            }
          ).event
          const pub = {
            reason: e.type === "RESET" ? "RESET" : (e.reason ?? "INPUT"),
            event: e.event ?? null,
            isComposing: e.composing === true,
          } as TextFieldDetails
          this.valueChangeDetails.emit({ value: v, details: pub })
          this.valueChange.emit(v)
        },
        disabled: this.disabledState(),
        readOnly: this.readOnlyState(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        limit: this.limit(),
        threshold: this.countThreshold(),
        count: this.countState()?.count,
        messages: this.texts(),
        id: this.instance(),
        // The only DOM write: the native setter, then one bubbling `input` event, which comes
        // back as an ordinary INPUT carrying this reason (base-ui#4643).
        clearInput: (why: TextFieldReason, focus: boolean) => {
          const el = controlEl.current
          if (!el) return
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set
          reason = why
          setter?.call(el, "")
          el.dispatchEvent(new Event("input", { bubbles: true }))
          reason = undefined
          if (focus && el.ownerDocument.activeElement !== el)
            void focusSafely(el, env, "programmatic")
        },
      }),
      env,
    )
    this.view = view
    this.send = send
    const modality = injectModality(env.modality, () => view().context.focused)
    // A soft limit is a control-owned validity message (the Field displays it), written from
    // the new value synchronously, before the change is reported.
    let softSet = false
    this.applySoftLimit = (next: string) => {
      const el = controlEl.current
      const max = this.countState()?.max
      if (!el || max === undefined) return
      const used = (this.countState()?.count ?? defaultCount)(next)
      if (used > max) {
        el.setCustomValidity(this.texts().charactersOver(used - max))
        softSet = true
      } else if (softSet) {
        el.setCustomValidity("")
        softSet = false
      }
    }
    bindProps(
      () => {
        const focused = view().context.focused
        return {
          "data-focus": focused ? "" : undefined,
          "data-focus-visible":
            focused && modality() !== "pointer" && modality() !== "touch" ? "" : undefined,
          "data-composing": view().matches("composing") ? "" : undefined,
          ...keysOf(this).root(),
          ...(this.type() === "password" ? visibility(this).root() : {}),
        }
      },
      {
        owns: [
          "countthreshold",
          "defaultvalue",
          "defaultvisible",
          "escapeclears",
          "fieldmessages",
          "focusablewhendisabled",
          "messages",
          "type",
          "value",
          "visible",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // Exactly one Input or Textarea (development error otherwise).
    afterNextRender(() => {
      if (process.env.NODE_ENV !== "production" && this.controls.current !== 1) {
        console.error(
          `[rind-ui] text-field: renders ${this.controls.current} Input/Textarea parts; exactly one is required.`,
        )
      }
    })
    // After the `type` change is in the DOM: the caret stays where the user left it.
    afterEveryRender(() => {
      const selection = pendingSelection.current
      pendingSelection.current = null
      const el = controlEl.current
      if (selection && el && el.ownerDocument.activeElement === el) {
        el.setSelectionRange(selection[0], selection[1])
      }
    })
  }
}

function keysOf(root: TextFieldRoot) {
  return textFieldKeysConnect(
    {
      value: root.view().values.value ?? "",
      composing: root.view().state === "composing",
      search: root.type() === "search",
      customClear: root.mountedParts().clearTriggers > 0,
    },
    // Sound: the Text Field machine accepts ESCAPE and SUBMIT (its key preset).
    root.send as unknown as (event: TextFieldOwnEvent) => void,
  )
}

/** The machine's `visible` (its visibility preset). */
// Sound: the Text Field machine has the `visible` value (its visibility preset).
const visibleOf = (root: TextFieldRoot) =>
  (root.view().values as unknown as { readonly visible: boolean }).visible

function visibility(root: TextFieldRoot, extra: Record<string, unknown> = {}) {
  return textFieldVisibilityConnect({
    scope: root.scope,
    instance: root.instance(),
    visible: visibleOf(root),
    disabled: root.disabledState() || root.focusableWhenDisabled(),
    controlId: root.controlId() ?? "",
    fieldData: {},
    toggleLabel: root.texts().toggleLabel,
    customReveal: root.mountedParts().triggers > 0,
    ...extra,
  })
}

/** The control's static attributes the part reads by name (forwarded to `mergeFieldProps`). */
function injectControlAttrs() {
  const read = (name: string) =>
    inject(new HostAttributeToken(name), { optional: true }) ?? undefined
  return {
    required: read("required"),
    name: read("name"),
    maxlength: read("maxlength"),
    describedBy: read("aria-describedby"),
    ariaLabel: read("aria-label"),
    ariaLabelledBy: read("aria-labelledby"),
  }
}

/** The Input and Textarea: the Field's control. */
function injectControl(part: "input" | "textarea", id: () => string | undefined) {
  const root = injectTextField(part === "input" ? "Input" : "Textarea")
  const binding = injectFieldControl()
  const env = injectEnvironment()
  const generated = `text-field-control-${inject(RindIds).next()}`
  const controlId = () => id() ?? binding?.().controlId ?? generated
  const el: HTMLInputElement | HTMLTextAreaElement = inject(ElementRef).nativeElement
  const attrs = injectControlAttrs()
  // The value the Field last heard of: a parent's controlled change is reported too (not a
  // user change), so its validity and data-filled follow (react-spectrum#8659).
  let reported: string | null = null
  effect(() => {
    const current = root.view().values.value ?? ""
    untracked(() => {
      const b = binding?.()
      if (root.value() === undefined || !b) return
      if (reported === null || reported === current) {
        reported = current
        return
      }
      reported = current
      b.report({ type: "change", value: current, user: false, composing: false })
    })
  })
  const maxlength = attrs.maxlength === undefined ? undefined : Number(attrs.maxlength)
  root.controls.current += 1
  const destroy = inject(DestroyRef)
  destroy.onDestroy(() => {
    root.controls.current -= 1
  })
  const modality = injectModality(env.modality, () => root.view().context.focused)
  if (inject(PLATFORM_ID) === "browser") {
    let unregister: (() => void) | undefined
    let ready = false
    let registeredId: string | undefined
    const register = (cid: string) => {
      registeredId = cid
      unregister?.()
      unregister = binding?.().register(
        {
          id: cid,
          labelable: true,
          focus: (m) => void focusSafely(el, env, "programmatic", m),
          validityElement: () => el,
          value: () => el.value ?? "",
        },
        cid,
      )
    }
    afterNextRender(() => {
      ready = true
      // After the first render, like React's layout effects: the server render does not know them.
      root.maxLength.set(maxlength)
      root.controlId.set(untracked(controlId))
      root.controlEl.current = el
      // autoFocus: focused before the handlers ran (base-ui#3172).
      if (el.ownerDocument.activeElement === el) {
        root.send({ type: "FOCUS", modality: env.modality.modality() })
      }
      register(untracked(controlId))
      // Development: the placeholder is never a name; a control needs a Label or an ARIA name.
      if (process.env.NODE_ENV !== "production") {
        const named =
          (el.labels?.length ?? 0) > 0 ||
          el.hasAttribute("aria-label") ||
          el.hasAttribute("aria-labelledby")
        if (!named) {
          console.warn(
            `[rind-ui] ${root.scope}: the ${part} has no accessible name (a placeholder is not one); render a Label or pass aria-label / aria-labelledby.`,
          )
        }
      }
      // A form reset: the DOM value is re-read once the reset ran (the latest defaultValue).
      const form = el.form
      if (form) {
        const onReset = (e: Event) =>
          env.scheduler.setTimeout(() => {
            if (!e.defaultPrevented) root.send({ type: "RESET", value: el.value })
          }, 0)
        form.addEventListener("reset", onReset)
        destroy.onDestroy(() => form.removeEventListener("reset", onReset))
      }
    })
    // Only a new id re-registers: registering changes the Field's binding, which this reads.
    effect(() => {
      const cid = controlId()
      if (!ready || cid === registeredId) return
      untracked(() => {
        root.controlId.set(cid)
        register(cid)
      })
    })
    destroy.onDestroy(() => unregister?.())
  }
  bindProps(
    () => {
      const field = mergeFieldProps(
        {
          role: "textbox",
          labelable: true,
          disabled: root.disabledState(),
          readOnly: root.readOnlyState(),
          required: attrs.required !== undefined && attrs.required !== "false",
          name: attrs.name,
          consumerDescribedBy: attrs.describedBy,
          ariaLabel: attrs.ariaLabel,
          ariaLabelledBy: attrs.ariaLabelledBy,
        },
        binding?.() ?? null,
      )
      const api = textFieldConnect(
        {
          scope: root.scope,
          instance: root.instance(),
          state: root.view().state,
          value: root.view().values.value ?? "",
          controlled: root.value() !== undefined,
          defaultValue: root.defaultValue(),
          focused: root.view().context.focused,
          modality: modality(),
          focusableWhenDisabled: root.focusableWhenDisabled(),
          field,
          fieldData: binding?.().data ?? {},
          controlId: controlId(),
          countId: root.countState()?.id,
          limit: root.limit(),
          count: root.countState()?.count,
          clearLabel: root.type() === "search" ? root.texts().clearSearch : root.texts().clear,
        },
        {
          send: root.send,
          report: (event) => {
            if (event.type === "change") {
              root.applySoftLimit(String(event.value))
              reported = String(event.value)
            }
            binding?.().report(event)
          },
          takeReason: root.takeReason,
        },
      )
      const type = root.type()
      // The preset's input attributes win; its handlers run after Text Field's.
      return joinHandlers(
        { ...api.control(part), maxlength, "aria-label": attrs.ariaLabel },
        {
          ...(type !== undefined && type !== "password" && type !== "search" ? { type } : {}),
          ...keysOf(root).input(),
          ...(type === "password" ? visibility(root).input() : {}),
        },
      )
    },
    {
      owns: [
        "aria-describedby",
        "aria-label",
        "aria-labelledby",
        "id",
        "maxlength",
        "name",
        "required",
      ],
    },
  )
  return { root, el }
}

/** The text input: `<input rindTextFieldInput>`. */
@Directive({ selector: "[rindTextFieldInput]", exportAs: "rindTextFieldInput" })
export class TextFieldInput {
  readonly id = input<string>()
  constructor() {
    injectControl("input", () => this.id())
  }
}

/** A multi-line control: `<textarea rindTextFieldTextarea [autosize]="true">`. */
@Directive({ selector: "[rindTextFieldTextarea]", exportAs: "rindTextFieldTextarea" })
export class TextFieldTextarea {
  readonly id = input<string>()
  /** Grows with its content. */
  readonly autosize = input(false, { transform: booleanAttribute })
  constructor() {
    const { root, el } = injectControl("textarea", () => this.id())
    if (inject(PLATFORM_ID) !== "browser") return
    const env = injectEnvironment()
    let handle: ReturnType<typeof attachAutosize> | null = null
    let ready = false
    const apply = (on: boolean) => {
      handle?.dispose()
      handle = null
      if (on && el instanceof HTMLTextAreaElement) handle = attachAutosize(el, env)
    }
    afterNextRender(() => {
      ready = true
      apply(untracked(this.autosize))
    })
    effect(() => {
      const on = this.autosize()
      if (ready) untracked(() => apply(on))
    })
    // Every value commit (controlled, programmatic, reset) re-measures (kobalte#484).
    effect(() => {
      root.view().values.value
      untracked(() => handle?.measure())
    })
    inject(DestroyRef).onDestroy(() => handle?.dispose())
  }
}

/**
 * Clears the value: shown while there is something to clear (React renders nothing otherwise).
 * With `type="search"`, the browser's own cancel button is hidden meanwhile.
 */
@Directive({ selector: "[rindTextFieldClearTrigger]", exportAs: "rindTextFieldClearTrigger" })
export class TextFieldClearTrigger {
  constructor() {
    const root = injectTextField("ClearTrigger")
    const env = injectEnvironment()
    const press = injectPress({
      env,
      // Pressing never moves focus away from the input.
      focusOnPress: false,
      send: (e) => {
        if (e.type === "PRESS") root.send({ type: "CLEAR", modality: e.modality, reason: "CLEAR" })
      },
    })
    bindProps(() => {
      const value = root.view().values.value ?? ""
      const clearable =
        !root.disabledState() &&
        !root.readOnlyState() &&
        !root.focusableWhenDisabled() &&
        value !== ""
      if (!clearable) return absentProps(root.scope, root.instance())
      return {
        "data-scope": root.scope,
        "data-part": "clear-trigger",
        "data-instance": root.instance(),
        type: "button",
        "aria-label": root.type() === "search" ? root.texts().clearSearch : root.texts().clear,
        tabindex: -1,
        ...press.props,
      }
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Rendered or not, the browser's own clear control is hidden while a trigger exists.
    const destroy = inject(DestroyRef)
    const el: Element = inject(ElementRef).nativeElement
    afterNextRender(() => {
      root.mountedParts.update((m) => ({ ...m, clearTriggers: m.clearTriggers + 1 }))
      if (root.type() === "search") {
        injectStyle(el.ownerDocument, "text-field-cancel", textFieldCancelStyle, env)
      }
    })
    destroy.onDestroy(() =>
      root.mountedParts.update((m) => ({ ...m, clearTriggers: m.clearTriggers - 1 })),
    )
  }
}

/** "12/80": the characters used, and the limit. */
@Directive({ selector: "[rindTextFieldCharacterCount]", exportAs: "rindTextFieldCharacterCount" })
export class TextFieldCharacterCount {
  /** A soft limit: going over it is a `tooLong`-style error, never a truncation. */
  readonly max = input<number>()
  /** Replaces the counter (default: UTF-16 code units, a line break counts once). */
  readonly count = input<(value: string) => number>()
  readonly id = input<string>()
  constructor() {
    const root = injectTextField("CharacterCount")
    const own = () =>
      this.id() ?? `${root.scope}-${root.instance()}-character-count`.replace(/:/g, "")
    const used = computed(() => (this.count() ?? defaultCount)(root.view().values.value ?? ""))
    bindProps(
      () => {
        const limit = root.limit()
        return {
          "data-scope": root.scope,
          "data-part": "character-count",
          "data-instance": root.instance(),
          id: own(),
          "data-over-limit": limit !== undefined && used() > limit ? "" : undefined,
          children: limit === undefined ? String(used()) : `${used()}/${limit}`,
        }
      },
      { owns: ["count", "id", "max"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    inject(DestroyRef).onDestroy(() => root.countState.set(null))
    // After the first render, like React's layout effect (the server render shows the count
    // alone); then when the limit or the counter changes, the soft-limit validity is written.
    let ready = false
    afterNextRender(() => {
      ready = true
      root.countState.set({ id: own(), max: this.max(), count: this.count() })
    })
    effect(() => {
      const next = { id: own(), max: this.max(), count: this.count() }
      if (ready) untracked(() => root.countState.set(next))
    })
    effect(() => {
      root.limit()
      this.count()
      if (ready) untracked(() => root.applySoftLimit(root.controlEl.current?.value ?? ""))
    })
  }
}

/** `type="password"`: shows and hides the password; its name stays, `aria-pressed` says it. */
@Directive({
  selector: "[rindTextFieldVisibilityTrigger]",
  exportAs: "rindTextFieldVisibilityTrigger",
})
export class TextFieldVisibilityTrigger {
  constructor() {
    const root = injectTextField("VisibilityTrigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    let selection: readonly [number, number] | null = null
    const press = injectPress({
      env,
      // Mouse and pen leave focus in the input; touch moves it nowhere (the keyboard stays).
      focusOnPress: false,
      disabled: () => root.disabledState() || root.focusableWhenDisabled(),
      send: (e) => {
        const control = root.controlEl.current
        if (!control) return
        const focusedNow = () => control.ownerDocument.activeElement === control
        if (e.type === "PRESS.START") {
          selection =
            focusedNow() && control.selectionStart !== null && control.selectionEnd !== null
              ? [control.selectionStart, control.selectionEnd]
              : null
          return
        }
        if (e.type !== "PRESS") return
        let inputFocused = focusedNow()
        if ((e.pointerType === "mouse" || e.pointerType === "pen") && !inputFocused) {
          void focusSafely(control, env, "programmatic")
          inputFocused = true
        }
        // Sound: the same service accepts the preset's events (merged by name at runtime).
        ;(root.send as unknown as (event: TextFieldOwnEvent) => void)({
          type: "VISIBILITY.TOGGLE",
          modality: e.modality,
          inputFocused,
          selection,
        })
        selection = null
      },
    })
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    // Peek, never claim: the Input is the Field's one control.
    const binding = root.field.binding
    bindProps(() =>
      joinHandlers(
        visibility(root, {
          fieldData: binding?.().data ?? {},
          triggerFocused: focused(),
          modality: modality(),
        }).trigger(),
        press.props,
        { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
      ),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      injectStyle(el.ownerDocument, "text-field-reveal", textFieldRevealStyle, env)
      root.mountedParts.update((m) => ({ ...m, triggers: m.triggers + 1 }))
      // Development: the trigger belongs to a password field.
      if (process.env.NODE_ENV !== "production" && root.type() !== "password") {
        console.warn(
          '[rind-ui] text-field: a VisibilityTrigger needs `type="password"` on rindTextFieldRoot.',
        )
      }
    })
    destroy.onDestroy(() => root.mountedParts.update((m) => ({ ...m, triggers: m.triggers - 1 })))
    // Development: the name must not follow the state (the pressed state says it).
    let lastName: string | null = null
    afterEveryRender(() => {
      if (process.env.NODE_ENV === "production") return
      const name = el.getAttribute("aria-label") ?? el.textContent ?? ""
      if (lastName !== null && lastName !== name) {
        console.warn(
          `[rind-ui] text-field: the VisibilityTrigger's name changed with its state ("${lastName}" → "${name}"); keep one name, aria-pressed carries the state.`,
        )
      }
      lastName = name
    })
  }
}

/** Follows the visibility (`data-state`): show an icon per state with `@if`. */
@Directive({
  selector: "[rindTextFieldVisibilityIndicator]",
  exportAs: "rindTextFieldVisibilityIndicator",
})
export class TextFieldVisibilityIndicator {
  constructor() {
    const root = injectTextField("VisibilityIndicator")
    // Peek, never claim: the Input is the Field's one control.
    const binding = root.field.binding
    bindProps(() => visibility(root, { fieldData: binding?.().data ?? {} }).indicator())
  }
}

/** The Text Field's parts (its Label, Description and ErrorMessage are the Field's), for `imports`. */
export const TextField = [
  TextFieldRoot,
  FieldLabel,
  FieldDescription,
  FieldErrorMessage,
  TextFieldInput,
  TextFieldTextarea,
  TextFieldClearTrigger,
  TextFieldCharacterCount,
  TextFieldVisibilityTrigger,
  TextFieldVisibilityIndicator,
] as const
